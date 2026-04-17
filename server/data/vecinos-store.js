import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { CAMPOS_CORTA_FUEGO, TODOS_LOS_MESES } from '../../src/constants/pagos.js';
import { escribirJsonBlob, leerJsonBlob, usaBlob } from './blob-store.js';

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const DATA_FILE = path.join(DATA_DIR, 'vecinos.json');
const DATA_BLOB_PATH = 'lomas/vecinos.json';
const BACKUP_EXCEL_FILE = path.join(DATA_DIR, 'vecinos-respaldo.xlsx');
const EXCEL_FILE = path.resolve(process.cwd(), 'public/PLANILLA GASTOS COMUNES.xlsx');
const CAMPOS_CONTACTO_ALTERNATIVOS = [
  'N_CONTACTO',
  'N-CONTACTO',
  'NÂ¬CONTACTO',
  'NÃ‚Â¬CONTACTO',
  'NÃƒâ€šÃ‚Â¬CONTACTO',
  'NUMERO DE CONTACTO',
  'CONTACTO'
];

const ALIAS_A_CANONICOS = {
  R: 'RUT',
  RODERA: 'RUT',
  'FECHA FIRMA': 'F/FIRMA',
  OBSERVACIONES: 'OBSERVACION'
};

function normalizarNombrePropietario(nombre) {
  const limpio = String(nombre ?? '').trim().replace(/\s+/g, ' ');
  if (!limpio) {
    return '';
  }

  const partesDe = limpio.split(/\s+DE\s+/i).map((parte) => parte.trim()).filter(Boolean);
  const pareceInversionConDe =
    partesDe.length === 3 &&
    !partesDe[0].includes(' ') &&
    !partesDe[1].includes(' ') &&
    partesDe[2].split(' ').length >= 2 &&
    partesDe[2].split(' ').length <= 3;

  if (!pareceInversionConDe) {
    return limpio;
  }

  const nombres = partesDe[2].split(' ').reverse().join(' ');
  return `${nombres} ${partesDe[1]} ${partesDe[0]}`.replace(/\s+/g, ' ').trim();
}

function normalizarClaveAlias(key) {
  return String(key ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

const ALIAS_A_CANONICOS_NORMALIZADOS = Object.fromEntries(
  Object.entries(ALIAS_A_CANONICOS).map(([alias, canonico]) => [
    normalizarClaveAlias(alias),
    canonico
  ])
);

function esErrorSoloLectura(error) {
  return ['EROFS', 'EPERM', 'EACCES'].includes(error?.code);
}

CAMPOS_CONTACTO_ALTERNATIVOS.forEach((alias) => {
  ALIAS_A_CANONICOS[alias] = 'N-CONTACTO';
});

CAMPOS_CORTA_FUEGO.forEach((alias) => {
  ALIAS_A_CANONICOS[alias] = 'CORTA FUEGO';
});

function normalizarFila(fila = {}) {
  const filaNormalizada = {};

  Object.entries(fila).forEach(([key, value]) => {
    const claveOriginal = String(key ?? '').trim();
    const claveNormalizada = normalizarClaveAlias(claveOriginal);
    const claveCanonica = ALIAS_A_CANONICOS_NORMALIZADOS[claveNormalizada] || claveOriginal;
    const valorNormalizado = value === undefined || value === null ? '' : value;

    if (
      filaNormalizada[claveCanonica] === undefined ||
      filaNormalizada[claveCanonica] === null ||
      String(filaNormalizada[claveCanonica]).trim() === ''
    ) {
      filaNormalizada[claveCanonica] = valorNormalizado;
    }
  });

  const nombreCanonico = String(filaNormalizada['NOMBRE DE PROPIETARIO'] ?? '').trim();
  const nombreAlternativo = String(filaNormalizada.PROPIETARIO ?? '').trim();
  filaNormalizada['NOMBRE DE PROPIETARIO'] = normalizarNombrePropietario(
    nombreCanonico || nombreAlternativo
  );
  delete filaNormalizada.PROPIETARIO;

  return filaNormalizada;
}

function tieneMontoVisible(valor) {
  const numero = Number(String(valor ?? '').replace(/[^\d-]/g, ''));
  return Number.isFinite(numero) && numero > 0;
}

function esFilaResumen(fila = {}) {
  const codigo = String(fila['PARC/ST'] ?? '').trim();
  const parcela = String(fila.PARCELA ?? '').trim();
  const sitio = String(fila.SITIO ?? '').trim();
  const nombre = String(fila['NOMBRE DE PROPIETARIO'] ?? fila.PROPIETARIO ?? '').trim();
  const tieneIdentificacion = Boolean(codigo || parcela || sitio || nombre);

  const columnasResumen = ['TOTAL', 'TOTAL 2026', ...TODOS_LOS_MESES, ...CAMPOS_CORTA_FUEGO, 'CORTA FUEGO'];
  const tieneMontos = columnasResumen.some((columna) => tieneMontoVisible(fila[columna]));

  return !tieneIdentificacion && tieneMontos;
}

function esFilaVacia(fila = {}) {
  const camposVisibles = [
    'PARC/ST',
    'PARCELA',
    'SITIO',
    'NOMBRE DE PROPIETARIO',
    'PROPIETARIO',
    'RUT',
    'N-CONTACTO',
    'F/FIRMA',
    'OBSERVACION'
  ];

  return !camposVisibles.some((campo) => String(fila[campo] ?? '').trim() !== '');
}

function limpiarFilasResumen(filas = []) {
  return filas
    .map(normalizarFila)
    .filter((fila) => !esFilaResumen(fila))
    .filter((fila) => !esFilaVacia(fila));
}

async function asegurarDirectorio() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function leerExcelInicial() {
  const excelBuffer = await readFile(EXCEL_FILE);
  const workbook = XLSX.read(excelBuffer, { type: 'buffer' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return [];
  }

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!worksheet) {
    return [];
  }

  return limpiarFilasResumen(XLSX.utils.sheet_to_json(worksheet));
}

async function leerDatosInicialesFallback() {
  try {
    return await leerExcelInicial();
  } catch {
    if (existsSync(DATA_FILE)) {
      const contenido = await readFile(DATA_FILE, 'utf8');

      if (!contenido.trim()) {
        return [];
      }

      return limpiarFilasResumen(JSON.parse(contenido));
    }

    return [];
  }
}

async function escribirFilas(filas) {
  await asegurarDirectorio();
  await writeFile(DATA_FILE, JSON.stringify(filas, null, 2), 'utf8');

  const worksheet = XLSX.utils.json_to_sheet(filas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vecinos');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  await writeFile(BACKUP_EXCEL_FILE, excelBuffer);
  await writeFile(EXCEL_FILE, excelBuffer);
}

async function escribirFilasBlob(filas) {
  await escribirJsonBlob(DATA_BLOB_PATH, filas);
}

export async function cargarFilasVecinos() {
  if (usaBlob()) {
    const filasBlob = await leerJsonBlob(DATA_BLOB_PATH);

    if (!filasBlob) {
      const filasIniciales = await leerDatosInicialesFallback();
      await escribirFilasBlob(filasIniciales);
      return filasIniciales;
    }

    const filasLimpias = limpiarFilasResumen(filasBlob);
    if (JSON.stringify(filasLimpias) !== JSON.stringify(filasBlob)) {
      await escribirFilasBlob(filasLimpias);
    }
    return filasLimpias;
  }

  await asegurarDirectorio();

  if (!existsSync(DATA_FILE)) {
    const filasExcel = await leerDatosInicialesFallback();
    try {
      await escribirFilas(filasExcel);
    } catch {
      return filasExcel;
    }
    return filasExcel;
  }

  const contenido = await readFile(DATA_FILE, 'utf8');

  if (!contenido.trim()) {
    return [];
  }

  return limpiarFilasResumen(JSON.parse(contenido));
}

export async function guardarFilasVecinos(filas) {
  const filasNormalizadas = limpiarFilasResumen(filas);

  if (usaBlob()) {
    await escribirFilasBlob(filasNormalizadas);
    return filasNormalizadas;
  }

  try {
    await escribirFilas(filasNormalizadas);
  } catch (error) {
    if (esErrorSoloLectura(error)) {
      throw new Error(
        'No se puede guardar en disco en Vercel. Configura BLOB_READ_WRITE_TOKEN (y BLOB_ACCESS=private) en Variables de entorno.'
      );
    }

    throw error;
  }
  return filasNormalizadas;
}
