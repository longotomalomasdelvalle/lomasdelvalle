import { createServer } from 'node:http';
import { URL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import {
  credencialesAdminConfiguradas,
  validarCredencialesAdmin
} from './config/admin.js';
import {
  cargarConfiguracionColumnas,
  guardarConfiguracionColumnas
} from './data/config-store.js';
import { escribirArchivoBlob, usaBlob } from './data/blob-store.js';
import {
  guardarRegistroComprobante,
  obtenerRegistroComprobante
} from './data/comprobantes-store.js';
import { cargarFilasVecinos, guardarFilasVecinos } from './data/vecinos-store.js';
import { parseCookies, serializarCookie } from './utils/cookies.js';
import { enviarCorreoComprobante, enviarCorreoContacto } from './utils/notificaciones.js';
import { crearSesion, eliminarSesion, obtenerSesion } from './utils/sessions.js';

const PORT = Number(process.env.PORT || 8787);
const COOKIE_NOMBRE = 'lomas_admin_session';
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'Lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production'
};
const TIPOS_IMAGEN_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES_COMPROBANTE = Number(process.env.COMPROBANTE_MAX_BYTES || 8_000_000);
const RESPALDOS_LOCALES_DIR = path.resolve(process.cwd(), 'server/data/respaldos-locales');
const EXCEL_BASE_FILE = path.resolve(process.cwd(), 'public/PLANILLA GASTOS COMUNES.xlsx');
const EXCEL_TEMPLATE_FILE = path.resolve(process.cwd(), 'server/data/plantilla-maestra.xlsx');

function slug(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function extensionPorMime(mime) {
  if (mime === 'image/png') {
    return 'png';
  }
  if (mime === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
}

function esBlobUrlValida(blobUrl) {
  try {
    const url = new URL(String(blobUrl || ''));
    return url.protocol === 'https:' && /\.blob\.vercel-storage\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function parseDataUrlImagen(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Imagen invalida. Envia un archivo JPG, PNG o WebP.');
  }

  const mime = match[1].toLowerCase();
  if (!TIPOS_IMAGEN_PERMITIDOS.has(mime)) {
    throw new Error('Formato no permitido. Usa JPG, PNG o WebP.');
  }

  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length) {
    throw new Error('La imagen esta vacia.');
  }

  if (bytes.length > MAX_BYTES_COMPROBANTE) {
    throw new Error(
      `La imagen supera el limite permitido (${Math.round(MAX_BYTES_COMPROBANTE / 1024)} KB).`
    );
  }

  return { mime, bytes };
}

function parseBase64Imagen(base64, mimeEntrada) {
  const mime = String(mimeEntrada || '').toLowerCase().trim();
  const contenido = String(base64 || '').trim();

  if (!mime || !TIPOS_IMAGEN_PERMITIDOS.has(mime)) {
    throw new Error('Formato no permitido. Usa JPG, PNG o WebP.');
  }
  if (!contenido) {
    throw new Error('La imagen esta vacia.');
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(contenido)) {
    throw new Error('Imagen invalida. Envia un archivo JPG, PNG o WebP.');
  }

  const bytes = Buffer.from(contenido, 'base64');
  if (!bytes.length) {
    throw new Error('La imagen esta vacia.');
  }
  if (bytes.length > MAX_BYTES_COMPROBANTE) {
    throw new Error(
      `La imagen supera el limite permitido (${Math.round(MAX_BYTES_COMPROBANTE / 1024)} KB).`
    );
  }

  return { mime, bytes };
}

function parsearRepositorioGithub(valor) {
  const limpio = String(valor ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  const partes = limpio.split('/').filter(Boolean);
  if (partes.length < 2) {
    return { owner: '', repo: '' };
  }
  return { owner: partes[0], repo: partes[1] };
}

function codificarPathGithub(pathname) {
  return String(pathname || '')
    .split('/')
    .filter(Boolean)
    .map((segmento) => encodeURIComponent(segmento))
    .join('/');
}

async function crearRespaldoGithub() {
  const token = String(process.env.GITHUB_TOKEN ?? '').trim();
  const repoConfig = String(process.env.GITHUB_BACKUP_REPO ?? '').trim();
  const branch = String(process.env.GITHUB_BACKUP_BRANCH ?? 'main').trim() || 'main';
  const rutaRespaldo = String(process.env.GITHUB_BACKUP_PATH ?? 'respaldos/vecinos-respaldo.json').trim();

  const [filas, configuracion] = await Promise.all([
    cargarFilasVecinos(),
    cargarConfiguracionColumnas()
  ]);

  const generadoEn = new Date().toISOString();
  const payload = {
    generadoEn,
    fuente: 'lomasdelvalle-admin',
    branch,
    configuracion,
    filas
  };

  if (!token || !repoConfig) {
    const directorioRespaldos = path.resolve(process.cwd(), 'server/data/respaldos-locales');
    await mkdir(directorioRespaldos, { recursive: true });
    const nombreArchivo = `vecinos-respaldo-${generadoEn.replace(/[:.]/g, '-')}.json`;
    const rutaArchivo = path.join(directorioRespaldos, nombreArchivo);
    await writeFile(rutaArchivo, JSON.stringify(payload, null, 2), 'utf8');

    return {
      ok: true,
      generadoEn,
      repo: 'local',
      path: `server/data/respaldos-locales/${nombreArchivo}`,
      branch: 'local',
      commitSha: '',
      fileUrl: ''
    };
  }

  const { owner, repo } = parsearRepositorioGithub(repoConfig);
  if (!owner || !repo) {
    throw new Error('GITHUB_BACKUP_REPO debe tener formato owner/repo.');
  }

  const contenidoBase64 = Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString('base64');
  const rutaCodificada = codificarPathGithub(rutaRespaldo);
  const endpointBase = `https://api.github.com/repos/${owner}/${repo}/contents/${rutaCodificada}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'lomasdelvalle-admin'
  };

  let shaActual;
  const consultaActual = await fetch(`${endpointBase}?ref=${encodeURIComponent(branch)}`, {
    headers
  });
  if (consultaActual.status === 200) {
    const actual = await consultaActual.json();
    shaActual = actual?.sha;
  } else if (consultaActual.status !== 404) {
    const detalle = await consultaActual.text();
    throw new Error(`GitHub respondio ${consultaActual.status}: ${detalle}`);
  }

  const commitMessage = `chore: respaldo planilla ${new Date().toISOString()}`;
  const body = {
    message: commitMessage,
    content: contenidoBase64,
    branch
  };
  if (shaActual) {
    body.sha = shaActual;
  }

  const escritura = await fetch(endpointBase, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const resultado = await escritura.json().catch(() => ({}));
  if (!escritura.ok) {
    const detalle = resultado?.message || `GitHub respondio ${escritura.status}`;
    throw new Error(`No se pudo subir respaldo a GitHub: ${detalle}`);
  }

  return {
    ok: true,
    generadoEn,
    repo: `${owner}/${repo}`,
    path: rutaRespaldo,
    branch,
    commitSha: resultado?.commit?.sha || '',
    fileUrl: resultado?.content?.html_url || ''
  };
}

function nombreRespaldoValido(nombreArchivo) {
  return /^[a-zA-Z0-9._-]+\.json$/.test(String(nombreArchivo || ''));
}

async function listarRespaldosLocales() {
  try {
    const nombres = await readdir(RESPALDOS_LOCALES_DIR);
    const respaldos = await Promise.all(
      nombres
        .filter((nombre) => nombreRespaldoValido(nombre))
        .map(async (nombre) => {
          const ruta = path.join(RESPALDOS_LOCALES_DIR, nombre);
          const metadata = await stat(ruta);
          return {
            nombreArchivo: nombre,
            generadoEn: metadata.mtime.toISOString(),
            sizeBytes: metadata.size,
            rutaRelativa: `server/data/respaldos-locales/${nombre}`
          };
        })
    );

    return respaldos.sort(
      (a, b) => new Date(b.generadoEn).getTime() - new Date(a.generadoEn).getTime()
    );
  } catch {
    return [];
  }
}

async function leerRespaldoLocal(nombreArchivo) {
  if (!nombreRespaldoValido(nombreArchivo)) {
    throw new Error('Nombre de respaldo invalido.');
  }

  const ruta = path.join(RESPALDOS_LOCALES_DIR, nombreArchivo);
  const contenido = await readFile(ruta, 'utf8');
  return JSON.parse(contenido);
}

function normalizarTituloColumna(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function obtenerNombreColumnaPlanilla(columnaRespaldo) {
  const normalizada = normalizarTituloColumna(columnaRespaldo);
  const compacta = normalizada.replace(/\s+/g, '');
  if (normalizada === 'RODERA' || normalizada === 'R') return 'RUT';
  if (compacta === 'N¬CONTACTO' || compacta === 'N-CONTACTO' || compacta === 'NCONTACTO') {
    return 'N-CONTACTO';
  }
  if (normalizada === 'N_CONTACTO' || normalizada === 'CONTACTO') return 'N-CONTACTO';
  if (normalizada === 'OBSERVACIONES') return 'OBSERVACION';
  if (normalizada === 'PARC/ST') return 'PARCELA';
  return normalizada;
}

function limpiarNumeroExportacion(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return 0;
  return (
    Number(
      String(valor)
        .replace(/\$/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '')
        .trim()
    ) || 0
  );
}

function calcularTotalFilaRespaldo(fila, configuracion = {}) {
  const meses = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE'
  ];
  const cuotas = Array.isArray(configuracion?.cuotasExtra) ? configuracion.cuotasExtra : [];
  const columnasTotales = [...meses, ...cuotas];
  return columnasTotales.reduce(
    (total, columna) => total + limpiarNumeroExportacion(fila?.[columna]),
    0
  );
}

function limpiarTextoParaExcel(valor) {
  return String(valor ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function construirCodigoParcSt(parcela, sitio) {
  const parcelaTexto = String(parcela ?? '').trim();
  const sitioTexto = String(sitio ?? '').trim();
  if (!parcelaTexto || !sitioTexto) return '';
  return `P${parcelaTexto}ST${sitioTexto}`;
}

function obtenerTextoCeldaExcelJS(valorCelda) {
  if (valorCelda === null || valorCelda === undefined) return '';
  if (typeof valorCelda === 'string' || typeof valorCelda === 'number' || typeof valorCelda === 'boolean') {
    return String(valorCelda);
  }
  if (typeof valorCelda === 'object') {
    if (Array.isArray(valorCelda.richText)) {
      return valorCelda.richText.map((p) => p?.text || '').join('');
    }
    if (typeof valorCelda.text === 'string') {
      return valorCelda.text;
    }
    if (valorCelda.result !== undefined && valorCelda.result !== null) {
      return String(valorCelda.result);
    }
    if (typeof valorCelda.formula === 'string') {
      return valorCelda.formula;
    }
  }
  return String(valorCelda ?? '');
}

function actualizarCeldaHoja(worksheet, fila, col, valor) {
  const address = XLSXStyle.utils.encode_cell({ r: fila, c: col });
  const actual = worksheet[address];

  if (valor === null || valor === undefined || valor === '') {
    if (actual) {
      delete actual.v;
      delete actual.w;
      actual.t = 'z';
      worksheet[address] = actual;
    }
    return;
  }

  const esNumero = typeof valor === 'number' || (/^-?\d+([.,]\d+)?$/.test(String(valor)));
  const v = typeof valor === 'number' ? valor : esNumero ? Number(String(valor).replace(',', '.')) : String(valor);
  const t = typeof v === 'number' && !Number.isNaN(v) ? 'n' : 's';
  worksheet[address] = {
    ...(actual || {}),
    t,
    v
  };
}

function ordenarColumnasRespaldo(filas = [], configuracion = {}) {
  const cuotas = Array.isArray(configuracion?.cuotasExtra) ? configuracion.cuotasExtra : [];
  const transversales = Array.isArray(configuracion?.camposTransversales)
    ? configuracion.camposTransversales
    : [];
  const meses = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE'
  ];

  const detectadas = new Set();
  filas.forEach((fila) => {
    Object.keys(fila || {}).forEach((k) => detectadas.add(obtenerNombreColumnaPlanilla(k)));
  });

  const columnasSistemaExcluidas = new Set([
    'PARCELA',
    'SITIO',
    'NOMBRE DE PROPIETARIO',
    'RUT',
    'N-CONTACTO',
    'F/FIRMA',
    'OBSERVACION',
    'ESTADO',
    '_UPDATED_AT',
    ...meses
  ]);

  // Solo columnas dinamicas: no reinsertar campos base del layout.
  const orden = [...transversales, ...cuotas];
  const extras = [...detectadas].filter(
    (c) => c && !orden.includes(c) && !columnasSistemaExcluidas.has(c)
  );
  return [...orden, ...extras];
}

function crearExcelPlanoDesdeRespaldo(respaldo) {
  const filas = Array.isArray(respaldo?.filas) ? respaldo.filas : [];
  const columnas = ordenarColumnasRespaldo(filas, respaldo?.configuracion);
  const filasNormalizadas = filas.map((fila) => {
    const salida = {};
    columnas.forEach((columna) => {
      salida[columna] = '';
    });
    Object.entries(fila || {}).forEach(([key, value]) => {
      salida[obtenerNombreColumnaPlanilla(key)] = value ?? '';
    });
    return salida;
  });

  const worksheet = XLSXStyle.utils.json_to_sheet(filasNormalizadas, {
    header: columnas
  });
  const workbook = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(workbook, worksheet, 'Vecinos');
  return XLSXStyle.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

async function construirExcelDesdeRespaldo(respaldo) {
  const filas = Array.isArray(respaldo?.filas) ? respaldo.filas : [];
  const templateBuffer = await readFile(EXCEL_BASE_FILE);
  const workbook = XLSXStyle.read(templateBuffer, { type: 'buffer', cellStyles: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const range = XLSXStyle.utils.decode_range(worksheet['!ref'] || 'A1:A1');

  const cabeceras = {};
  let filaCabecera = range.s.r;
  let maxCoincidencias = -1;
  const cabecerasEsperadas = new Set([
    'PARCELA',
    'SITIO',
    'NOMBRE DE PROPIETARIO',
    'RUT',
    'N-CONTACTO',
    'F/FIRMA',
    'OBSERVACION',
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE',
    'CORTA FUEGO'
  ]);

  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 40); r += 1) {
    let coincidencias = 0;
    const cabecerasFila = {};
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSXStyle.utils.encode_cell({ r, c });
      const raw = worksheet[addr]?.v;
      const titulo = obtenerNombreColumnaPlanilla(raw);
      if (!titulo) continue;
      cabecerasFila[titulo] = c;
      if (cabecerasEsperadas.has(titulo)) {
        coincidencias += 1;
      }
    }
    if (coincidencias > maxCoincidencias) {
      maxCoincidencias = coincidencias;
      filaCabecera = r;
      Object.keys(cabeceras).forEach((key) => delete cabeceras[key]);
      Object.assign(cabeceras, cabecerasFila);
    }
  }

  const tieneCabecerasValidas =
    typeof cabeceras['NOMBRE DE PROPIETARIO'] === 'number' &&
    (typeof cabeceras.ENERO === 'number' || typeof cabeceras.DICIEMBRE === 'number');

  if (!tieneCabecerasValidas) {
    return crearExcelPlanoDesdeRespaldo(respaldo);
  }

  // Limpia el bloque de datos existente manteniendo estilos.
  for (let r = filaCabecera + 1; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      actualizarCeldaHoja(worksheet, r, c, '');
    }
  }

  // Mapea columnas del respaldo a columnas de la planilla.
  for (let i = 0; i < filas.length; i += 1) {
    const fila = filas[i] || {};
    const rowIndex = filaCabecera + 1 + i;
    Object.keys(fila).forEach((key) => {
      const columnaDestino = obtenerNombreColumnaPlanilla(key);
      const colIndex = cabeceras[columnaDestino];
      if (typeof colIndex !== 'number') return;
      actualizarCeldaHoja(worksheet, rowIndex, colIndex, fila[key]);
    });
  }

  const ultimaFila = Math.max(range.e.r, filaCabecera + filas.length + 1);
  const ultimaColumna = Math.max(
    range.e.c,
    ...Object.values(cabeceras).filter((n) => typeof n === 'number')
  );
  worksheet['!ref'] = XLSXStyle.utils.encode_range({
    s: { r: range.s.r, c: range.s.c },
    e: { r: ultimaFila, c: ultimaColumna }
  });

  return XLSXStyle.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer',
    cellStyles: true
  });
}

async function construirExcelDesdeRespaldoConTemplate(respaldo) {
  const filas = Array.isArray(respaldo?.filas) ? respaldo.filas : [];
  const workbook = new ExcelJS.Workbook();
  let rutaPlantilla = EXCEL_TEMPLATE_FILE;
  try {
    await stat(rutaPlantilla);
  } catch {
    rutaPlantilla = EXCEL_BASE_FILE;
  }
  await workbook.xlsx.readFile(rutaPlantilla);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No se encontro hoja en la plantilla base.');
  }

  const cabecerasEsperadas = new Set([
    'PARCELA',
    'SITIO',
    'NOMBRE DE PROPIETARIO',
    'RUT',
    'N-CONTACTO',
    'F/FIRMA',
    'OBSERVACION',
    'CORTA FUEGO',
    'TOTAL 2026',
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE'
  ]);

  const lastCol = Math.max(worksheet.columnCount, 20);
  const maxScanRow = Math.min(Math.max(worksheet.rowCount, 1), 40);
  let headerRowNumber = 1;
  let bestMatches = -1;
  const headerMap = {};

  for (let r = 1; r <= maxScanRow; r += 1) {
    let matches = 0;
    const rowMap = {};
    for (let c = 1; c <= lastCol; c += 1) {
      const raw = worksheet.getRow(r).getCell(c).value;
      const text = obtenerTextoCeldaExcelJS(raw);
      const normalized = obtenerNombreColumnaPlanilla(text);
      if (!normalized) continue;
      rowMap[normalized] = c;
      if (cabecerasEsperadas.has(normalized)) matches += 1;
    }
    if (matches > bestMatches) {
      bestMatches = matches;
      headerRowNumber = r;
      Object.keys(headerMap).forEach((k) => delete headerMap[k]);
      Object.assign(headerMap, rowMap);
    }
  }

  if (!headerMap['NOMBRE DE PROPIETARIO']) {
    throw new Error('No se pudieron detectar las cabeceras de la plantilla base.');
  }

  const headerRow = worksheet.getRow(headerRowNumber);
  let columnaParcSt = null;
  for (let c = 1; c <= lastCol; c += 1) {
    const raw = obtenerTextoCeldaExcelJS(headerRow.getCell(c).value);
    const bruto = String(raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .toUpperCase();
    if (bruto.includes('PARC/ST') || bruto.includes('PARC/S')) {
      columnaParcSt = c;
      break;
    }
  }

  const columnasRespaldo = ordenarColumnasRespaldo(filas, respaldo?.configuracion);
  const usedCols = Object.values(headerMap)
    .filter((c) => typeof c === 'number')
    .sort((a, b) => a - b);
  const firstCol = usedCols[0] || 1;
  let lastUsedCol = usedCols[usedCols.length - 1] || lastCol;

  // Agrega columnas faltantes junto a CORTA FUEGO para mantener el diseño esperado.
  const columnasFaltantes = columnasRespaldo.filter((columna) => !headerMap[columna]);
  if (columnasFaltantes.length > 0) {
    const colCorta = headerMap['CORTA FUEGO'] || headerMap.FUEGO || null;
    const colInsercionBase = colCorta ? colCorta + 1 : lastUsedCol + 1;
    const styleHeaderRef = worksheet.getRow(headerRowNumber).getCell(colCorta || lastUsedCol).style;
    const styleDataRef = worksheet.getRow(headerRowNumber + 1).getCell(colCorta || lastUsedCol).style;
    const maxStyleRows = Math.max(worksheet.rowCount, headerRowNumber + filas.length + 10);

    columnasFaltantes.forEach((columna, index) => {
      const insertAt = colInsercionBase + index;
      worksheet.spliceColumns(insertAt, 0, []);

      // Recalcula mapa de cabeceras desplazadas tras insertar columna.
      Object.keys(headerMap).forEach((key) => {
        if (headerMap[key] >= insertAt) {
          headerMap[key] += 1;
        }
      });
      headerMap[columna] = insertAt;
      lastUsedCol += 1;

      const headerCell = worksheet.getRow(headerRowNumber).getCell(insertAt);
      headerCell.value = limpiarTextoParaExcel(columna);
      if (styleHeaderRef) {
        headerCell.style = { ...styleHeaderRef };
      }

      for (let r = headerRowNumber + 1; r <= maxStyleRows; r += 1) {
        const dataCell = worksheet.getRow(r).getCell(insertAt);
        if (styleDataRef) {
          dataCell.style = { ...styleDataRef };
        }
      }
    });
  }

  const maxRow = Math.max(worksheet.rowCount, headerRowNumber + filas.length + 5);

  // Limpia valores de filas de datos, manteniendo estilos.
  for (let r = headerRowNumber + 1; r <= maxRow; r += 1) {
    for (let c = firstCol; c <= lastUsedCol; c += 1) {
      worksheet.getRow(r).getCell(c).value = null;
    }
  }

  for (let i = 0; i < filas.length; i += 1) {
    const rowNumber = headerRowNumber + 1 + i;
    const fila = filas[i] || {};
    const filaConTotales = {};
    Object.entries(fila).forEach(([key, value]) => {
      filaConTotales[obtenerNombreColumnaPlanilla(key)] = value;
    });
    const totalCalculado = calcularTotalFilaRespaldo(filaConTotales, respaldo?.configuracion);
    Object.keys(headerMap).forEach((header) => {
      if (header.startsWith('TOTAL')) {
        filaConTotales[header] = totalCalculado;
      }
    });

    if (columnaParcSt) {
      const codigoParcSt = construirCodigoParcSt(filaConTotales.PARCELA, filaConTotales.SITIO);
      worksheet.getRow(rowNumber).getCell(columnaParcSt).value = codigoParcSt || null;
    }

    Object.entries(headerMap).forEach(([targetHeader, col]) => {
      const value = filaConTotales[targetHeader];
      if (!col) return;
      if (columnaParcSt && col === columnaParcSt) {
        return;
      }
      const cell = worksheet.getRow(rowNumber).getCell(col);
      if (value === '' || value === null || value === undefined) {
        cell.value = null;
        return;
      }
      const esNumerico =
        typeof value === 'number' || /^-?\d+([.,]\d+)?$/.test(String(value).trim());
      cell.value = esNumerico
        ? Number(String(value).replace(',', '.'))
        : limpiarTextoParaExcel(value);
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function responderJson(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    ...extraHeaders
  });

  response.end(JSON.stringify(body));
}

function leerBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });

    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON invalido'));
      }
    });

    request.on('error', reject);
  });
}

function leerBodyBuffer(request, maxBytes = MAX_BYTES_COMPROBANTE) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(
          new Error(
            `La imagen supera el limite permitido (${Math.round(maxBytes / 1024)} KB).`
          )
        );
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    request.on('error', reject);
  });
}

function obtenerSesionRequest(request) {
  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[COOKIE_NOMBRE];
  return token ? { token, sesion: obtenerSesion(token) } : { token: '', sesion: null };
}

function responderNoAutorizado(response) {
  responderJson(response, 401, {
    ok: false,
    message: 'Sesion no valida o expirada.'
  });
}

async function procesarComprobantePago(body, publicBaseUrl) {
  if (!usaBlob()) {
    throw new Error(
      'No hay almacenamiento Blob configurado. Define BLOB_READ_WRITE_TOKEN para recibir comprobantes.'
    );
  }

  const nombre = String(body.nombre || '').trim();
  const parcela = String(body.parcela || '').trim();
  const sitio = String(body.sitio || '').trim();
  const monto = String(body.monto || '').trim();
  const fechaPago = String(body.fechaPago || '').trim();
  const observacion = String(body.observacion || '').trim();
  const archivoNombre = String(body.archivoNombre || 'comprobante').trim();

  if (!nombre || !parcela || !sitio || (!body.imagenDataUrl && !body.imagenBase64)) {
    throw new Error('Debes enviar nombre, parcela, sitio e imagen del comprobante.');
  }

  const { mime, bytes } = body.imagenBase64
    ? parseBase64Imagen(body.imagenBase64, body.imagenMime)
    : parseDataUrlImagen(body.imagenDataUrl);
  const extension = extensionPorMime(mime);
  const fecha = new Date();
  const nombreSeguro = slug(nombre) || 'vecino';
  const identificador = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const blobPath = `lomas/comprobantes/${fecha.getUTCFullYear()}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${identificador}-${nombreSeguro}.${extension}`;

  const blob = await escribirArchivoBlob(blobPath, bytes, {
    contentType: mime,
    access: process.env.COMPROBANTE_BLOB_ACCESS || process.env.BLOB_ACCESS || 'private'
  });

  if (!blob?.url) {
    throw new Error('No se pudo guardar el comprobante en Blob.');
  }

  const registro = await guardarRegistroComprobante({
    id: identificador,
    creadoEn: fecha.toISOString(),
    nombre,
    parcela,
    sitio,
    monto,
    fechaPago,
    observacion,
    archivoNombre,
    archivoMime: mime,
    archivoBytes: bytes.length,
    blobPath,
    blobUrl: blob.url,
    blobDownloadUrl: blob.downloadUrl || '',
    emailNotificado: false
  });
  const enlacePublico =
    blob.downloadUrl ||
    `${publicBaseUrl}/api/comprobantes/archivo?u=${encodeURIComponent(blob.url)}`;

  const notificacion = await enviarCorreoComprobante({
    ...registro,
    blobPath,
    blobUrl: blob.url,
    enlacePublico,
    archivoContenidoBase64: bytes.toString('base64')
  });

  if (notificacion.ok) {
    await guardarRegistroComprobante({
      ...registro,
      emailNotificado: true
    });
  }

  return {
    id: registro.id,
    blobUrl: blob.url,
    enlacePublico,
    blobPath,
    archivoBytes: bytes.length,
    emailEnviado: Boolean(notificacion.ok),
    emailMensaje: notificacion.ok
      ? 'Correo enviado.'
      : notificacion.message || 'Comprobante guardado, pero el correo no se pudo enviar.'
  };
}

async function procesarComprobanteBinario(request, url, publicBaseUrl) {
  if (!usaBlob()) {
    throw new Error(
      'No hay almacenamiento Blob configurado. Define BLOB_READ_WRITE_TOKEN para recibir comprobantes.'
    );
  }

  const nombre = String(url.searchParams.get('nombre') || '').trim();
  const parcela = String(url.searchParams.get('parcela') || '').trim();
  const sitio = String(url.searchParams.get('sitio') || '').trim();
  const monto = String(url.searchParams.get('monto') || '').trim();
  const fechaPago = String(url.searchParams.get('fechaPago') || '').trim();
  const observacion = String(url.searchParams.get('observacion') || '').trim();
  const archivoNombre = String(url.searchParams.get('archivoNombre') || 'comprobante').trim();
  const mimeHeader = String(url.searchParams.get('archivoMime') || request.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (!nombre || !parcela || !sitio) {
    throw new Error('Debes enviar nombre, parcela y sitio del comprobante.');
  }
  if (!TIPOS_IMAGEN_PERMITIDOS.has(mimeHeader)) {
    throw new Error('Formato no permitido. Usa JPG, PNG o WebP.');
  }

  const bytes = await leerBodyBuffer(request, MAX_BYTES_COMPROBANTE);
  if (!bytes.length) {
    throw new Error('La imagen esta vacia.');
  }

  const extension = extensionPorMime(mimeHeader);
  const fecha = new Date();
  const nombreSeguro = slug(nombre) || 'vecino';
  const identificador = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const blobPath = `lomas/comprobantes/${fecha.getUTCFullYear()}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${identificador}-${nombreSeguro}.${extension}`;

  const blob = await escribirArchivoBlob(blobPath, bytes, {
    contentType: mimeHeader,
    access: process.env.COMPROBANTE_BLOB_ACCESS || process.env.BLOB_ACCESS || 'private'
  });

  if (!blob?.url) {
    throw new Error('No se pudo guardar el comprobante en Blob.');
  }

  const registro = await guardarRegistroComprobante({
    id: identificador,
    creadoEn: fecha.toISOString(),
    nombre,
    parcela,
    sitio,
    monto,
    fechaPago,
    observacion,
    archivoNombre,
    archivoMime: mimeHeader,
    archivoBytes: bytes.length,
    blobPath,
    blobUrl: blob.url,
    blobDownloadUrl: blob.downloadUrl || '',
    emailNotificado: false
  });

  const enlacePublico =
    blob.downloadUrl ||
    `${publicBaseUrl}/api/comprobantes/archivo?u=${encodeURIComponent(blob.url)}`;

  const notificacion = await enviarCorreoComprobante({
    ...registro,
    blobPath,
    blobUrl: blob.url,
    enlacePublico,
    archivoContenidoBase64: bytes.toString('base64')
  });

  if (notificacion.ok) {
    await guardarRegistroComprobante({
      ...registro,
      emailNotificado: true
    });
  }

  return {
    id: registro.id,
    blobUrl: blob.url,
    enlacePublico,
    blobPath,
    archivoBytes: bytes.length,
    emailEnviado: Boolean(notificacion.ok),
    emailMensaje: notificacion.ok
      ? 'Correo enviado.'
      : notificacion.message || 'Comprobante guardado, pero el correo no se pudo enviar.'
  };
}

export async function handleRequest(request, response) {
  try {
    const host = request.headers.host || 'localhost';
    const url = new URL(request.url || '/', `http://${host}`);

    const publicBaseUrl =
      process.env.PUBLIC_APP_URL || `${process.env.VERCEL_URL ? 'https' : 'http'}://${host}`;

    if (request.method === 'GET' && url.pathname === '/api/health') {
      responderJson(response, 200, { ok: true });
      return;
    }

  if (request.method === 'GET' && url.pathname === '/api/vecinos') {
    const [filas, configuracion] = await Promise.all([
      cargarFilasVecinos(),
      cargarConfiguracionColumnas()
    ]);
    responderJson(response, 200, {
      ok: true,
      filas,
      configuracion
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/comprobantes/archivo') {
    const blobUrlDirecta = String(url.searchParams.get('u') || '').trim();
    const id = String(url.searchParams.get('id') || '').trim();
    let blobUrl = '';
    let archivoMime = 'application/octet-stream';

    if (blobUrlDirecta) {
      if (!esBlobUrlValida(blobUrlDirecta)) {
        responderJson(response, 400, { ok: false, message: 'URL de comprobante invalida.' });
        return;
      }
      blobUrl = blobUrlDirecta;
    } else if (id) {
      const registro = await obtenerRegistroComprobante(id);
      if (!registro?.blobUrl) {
        responderJson(response, 404, { ok: false, message: 'Comprobante no encontrado.' });
        return;
      }
      blobUrl = registro.blobDownloadUrl || registro.blobUrl;
      archivoMime = registro.archivoMime || archivoMime;
    } else {
      responderJson(response, 400, { ok: false, message: 'Falta identificador de comprobante.' });
      return;
    }

    const headers = blobUrl.includes('.private.blob.vercel-storage.com')
      ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
      : {};
    const descarga = await fetch(blobUrl, { headers });

    if (!descarga.ok) {
      responderJson(response, 404, { ok: false, message: 'No se pudo abrir el comprobante.' });
      return;
    }

    const buffer = Buffer.from(await descarga.arrayBuffer());
    response.writeHead(200, {
      'Content-Type': descarga.headers.get('content-type') || archivoMime,
      'Content-Length': buffer.length,
      'Cache-Control': 'private, max-age=120'
    });
    response.end(buffer);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/comprobantes') {
    try {
      const mode = String(url.searchParams.get('mode') || '').trim().toLowerCase();
      if (mode === 'bin') {
        const resultadoBin = await procesarComprobanteBinario(request, url, publicBaseUrl);
        responderJson(response, 200, {
          ok: true,
          message: resultadoBin.emailEnviado
            ? 'Comprobante recibido y notificado por correo.'
            : 'Comprobante recibido. El correo no se pudo enviar.',
          ...resultadoBin
        });
        return;
      }

      if (mode === 'contacto') {
        const bodyContacto = await leerBody(request);
        const nombre = String(bodyContacto.nombre || '').trim();
        const email = String(bodyContacto.email || '').trim();
        const celular = String(bodyContacto.celular || '').trim();
        const mensaje = String(bodyContacto.mensaje || '').trim();

        if (!nombre || !email || !mensaje) {
          responderJson(response, 400, {
            ok: false,
            message: 'Debes completar nombre, correo y mensaje.'
          });
          return;
        }
        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailValido) {
          responderJson(response, 400, {
            ok: false,
            message: 'Correo invalido.'
          });
          return;
        }
        if (celular) {
          const celularNormalizado = celular.replace(/[^\d+]/g, '');
          if (celularNormalizado.length < 8 || celularNormalizado.length > 16) {
            responderJson(response, 400, {
              ok: false,
              message: 'Celular invalido. Debe tener entre 8 y 16 digitos.'
            });
            return;
          }
        }
        const resultadoContacto = await enviarCorreoContacto({ nombre, email, celular, mensaje });
        if (!resultadoContacto.ok) {
          responderJson(response, 400, {
            ok: false,
            message: resultadoContacto.message || 'No se pudo enviar el mensaje de contacto.'
          });
          return;
        }
        responderJson(response, 200, {
          ok: true,
          message: 'Mensaje enviado correctamente.'
        });
        return;
      }

      const body = await leerBody(request);
      const resultado = await procesarComprobantePago(body, publicBaseUrl);
      responderJson(response, 200, {
        ok: true,
        message: resultado.emailEnviado
          ? 'Comprobante recibido y notificado por correo.'
          : 'Comprobante recibido. El correo no se pudo enviar.',
        ...resultado
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo procesar el comprobante.'
      });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/comprobantes/upload-bin') {
    try {
      const resultado = await procesarComprobanteBinario(request, url, publicBaseUrl);
      responderJson(response, 200, {
        ok: true,
        message: resultado.emailEnviado
          ? 'Comprobante recibido y notificado por correo.'
          : 'Comprobante recibido. El correo no se pudo enviar.',
        ...resultado
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo procesar el comprobante.'
      });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/contacto') {
    try {
      const body = await leerBody(request);
      const nombre = String(body.nombre || '').trim();
      const email = String(body.email || '').trim();
      const celular = String(body.celular || '').trim();
      const mensaje = String(body.mensaje || '').trim();

      if (!nombre || !email || !mensaje) {
        responderJson(response, 400, {
          ok: false,
          message: 'Debes completar nombre, correo y mensaje.'
        });
        return;
      }

      const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailValido) {
        responderJson(response, 400, {
          ok: false,
          message: 'Correo invalido.'
        });
        return;
      }
      if (celular) {
        const celularNormalizado = celular.replace(/[^\d+]/g, '');
        if (celularNormalizado.length < 8 || celularNormalizado.length > 16) {
          responderJson(response, 400, {
            ok: false,
            message: 'Celular invalido. Debe tener entre 8 y 16 digitos.'
          });
          return;
        }
      }

      const resultado = await enviarCorreoContacto({ nombre, email, celular, mensaje });
      if (!resultado.ok) {
        responderJson(response, 400, {
          ok: false,
          message: resultado.message || 'No se pudo enviar el mensaje de contacto.'
        });
        return;
      }

      responderJson(response, 200, {
        ok: true,
        message: 'Mensaje enviado correctamente.'
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo procesar el mensaje.'
      });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/session') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    responderJson(response, 200, {
      ok: true,
      usuario: sesion.usuario
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/resumen') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    responderJson(response, 200, {
      ok: true,
      resumen: {
        usuario: sesion.usuario,
        acceso: 'administrador',
        autenticado: true
      }
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/vecinos') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    const [filas, configuracion] = await Promise.all([
      cargarFilasVecinos(),
      cargarConfiguracionColumnas()
    ]);
    responderJson(response, 200, {
      ok: true,
      filas,
      configuracion
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/login') {
    if (!credencialesAdminConfiguradas()) {
      responderJson(response, 500, {
        ok: false,
        message:
          'Debes configurar ADMIN_USER y ADMIN_PASSWORD o ADMIN_PASSWORD_HASH en el servidor.'
      });
      return;
    }

    try {
      const body = await leerBody(request);
      const usuario = String(body.usuario ?? '');
      const clave = String(body.clave ?? '');

      if (!usuario || !clave) {
        responderJson(response, 400, {
          ok: false,
          message: 'Debes enviar usuario y clave.'
        });
        return;
      }

      if (!validarCredencialesAdmin(usuario, clave)) {
        responderJson(response, 401, {
          ok: false,
          message: 'Usuario o clave incorrecta.'
        });
        return;
      }

      const sesion = crearSesion({ usuario });
      const setCookie = serializarCookie(COOKIE_NOMBRE, sesion.token, {
        ...COOKIE_BASE,
        maxAge: sesion.maxAge
      });

      responderJson(
        response,
        200,
        {
          ok: true,
          usuario
        },
        { 'Set-Cookie': setCookie }
      );
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'Solicitud invalida.'
      });
    }

    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/vecinos/import') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const body = await leerBody(request);
      const filas = Array.isArray(body.filas) ? body.filas : null;

      if (!filas) {
        responderJson(response, 400, {
          ok: false,
          message: 'Debes enviar filas validas para importar.'
        });
        return;
      }

      const configuracion = await guardarConfiguracionColumnas(body.configuracion || {});
      const guardadas = await guardarFilasVecinos(filas);
      responderJson(response, 200, {
        ok: true,
        filas: guardadas,
        configuracion
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo importar la planilla.'
      });
    }

    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/admin/vecinos') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const body = await leerBody(request);
      const filas = Array.isArray(body.filas) ? body.filas : null;

      if (!filas) {
        responderJson(response, 400, {
          ok: false,
          message: 'Debes enviar una lista valida de filas.'
        });
        return;
      }

      const configuracion = await guardarConfiguracionColumnas(body.configuracion || {});
      const guardadas = await guardarFilasVecinos(filas);
      responderJson(response, 200, {
        ok: true,
        filas: guardadas,
        configuracion
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo guardar la planilla.'
      });
    }

    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/vecinos/normalizar') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const [filasActuales, configuracionActual] = await Promise.all([
        cargarFilasVecinos(),
        cargarConfiguracionColumnas()
      ]);
      const guardadas = await guardarFilasVecinos(filasActuales);
      const configuracion = await guardarConfiguracionColumnas(configuracionActual);

      responderJson(response, 200, {
        ok: true,
        filas: guardadas,
        configuracion
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo normalizar la planilla.'
      });
    }

    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/vecinos/reset') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const configuracion = await guardarConfiguracionColumnas({});
      const filas = await guardarFilasVecinos([]);

      responderJson(response, 200, {
        ok: true,
        message: 'Planilla limpiada correctamente.',
        filas,
        configuracion
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo limpiar la planilla.'
      });
    }

    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/backup/github') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const resultado = await crearRespaldoGithub();
      const esLocal = resultado.repo === 'local';
      responderJson(response, 200, {
        ok: true,
        message: esLocal
          ? `Respaldo local creado en ${resultado.path}.`
          : `Respaldo enviado a GitHub (${resultado.repo}@${resultado.branch}).`,
        ...resultado
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo crear el respaldo en GitHub.'
      });
    }

    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/backups') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const respaldos = await listarRespaldosLocales();
      responderJson(response, 200, {
        ok: true,
        respaldos
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudieron listar los respaldos.'
      });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/backups/file') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const nombre = String(url.searchParams.get('name') || '').trim();
      if (!nombre) {
        responderJson(response, 400, {
          ok: false,
          message: 'Debes indicar el nombre del respaldo.'
        });
        return;
      }

      const respaldo = await leerRespaldoLocal(nombre);
      responderJson(response, 200, {
        ok: true,
        respaldo
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo leer el respaldo.'
      });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/backups/file/excel') {
    const { sesion } = obtenerSesionRequest(request);
    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const nombre = String(url.searchParams.get('name') || '').trim();
      if (!nombre) {
        responderJson(response, 400, {
          ok: false,
          message: 'Debes indicar el nombre del respaldo.'
        });
        return;
      }

      const respaldo = await leerRespaldoLocal(nombre);
      const excelBuffer = await construirExcelDesdeRespaldoConTemplate(respaldo);
      const nombreDescarga = String(nombre).replace(/\.json$/i, '.xlsx');
      response.writeHead(200, {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombreDescarga}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0'
      });
      response.end(excelBuffer);
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo descargar el respaldo en Excel.'
      });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/vecinos/export/excel') {
    const { sesion } = obtenerSesionRequest(request);
    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const body = await leerBody(request);
      const filasBody = Array.isArray(body?.filas) ? body.filas : [];
      const configuracionBody =
        body?.configuracion && typeof body.configuracion === 'object'
          ? body.configuracion
          : {};
      const respaldoTemporal = {
        filas: filasBody,
        configuracion: configuracionBody
      };
      const excelBuffer = await construirExcelDesdeRespaldoConTemplate(respaldoTemporal);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const nombreDescarga = `vecinos-exportados-${timestamp}.xlsx`;

      response.writeHead(200, {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombreDescarga}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0'
      });
      response.end(excelBuffer);
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo exportar el Excel con plantilla base.'
      });
    }
    return;
  }


  if (request.method === 'POST' && url.pathname === '/api/admin/logout') {
    const { token } = obtenerSesionRequest(request);

    if (token) {
      eliminarSesion(token);
    }

    responderJson(
      response,
      200,
      { ok: true },
      {
        'Set-Cookie': serializarCookie(COOKIE_NOMBRE, '', {
          ...COOKIE_BASE,
          maxAge: 0
        })
      }
    );
    return;
  }

    responderJson(response, 404, {
      ok: false,
      message: 'Ruta no encontrada.'
    });
  } catch (error) {
    responderJson(response, 500, {
      ok: false,
      message: error?.message || 'Error interno del servidor.'
    });
  }
}

function ejecutadoDirecto() {
  const currentFile = fileURLToPath(import.meta.url);
  const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return currentFile === executedFile;
}

if (ejecutadoDirecto()) {
  const server = createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`Servidor admin escuchando en http://localhost:${PORT}`);
  });
}
