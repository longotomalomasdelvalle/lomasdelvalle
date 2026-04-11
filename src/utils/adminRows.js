import { CAMPOS_CORTA_FUEGO, TODOS_LOS_MESES } from '../constants/pagos.js';
import {
  CAMPOS_RESERVADOS_COLUMNAS,
  COLUMNA_ACTUALIZACION,
  COLUMNA_CUOTA_EXTRA_POR_DEFECTO,
  CONFIGURACION_COLUMNAS_POR_DEFECTO,
  NOMBRES_VISIBLES_COLUMNAS,
  normalizarConfiguracionColumnas,
  normalizarNombreColumna
} from './columnas.js';
import { obtenerParcelaYSitio, obtenerValorCampo } from './pagos.js';

export const CAMPOS_FIJOS_ADMIN = [
  'NOMBRE DE PROPIETARIO',
  'RUT',
  'N-CONTACTO',
  'F/FIRMA',
  'OBSERVACION',
  'PARCELA',
  'SITIO',
  'ESTADO'
];

export const CAMPOS_IDENTIFICACION_ADMIN = [
  'RUT',
  'N-CONTACTO',
  'F/FIRMA',
  'OBSERVACION'
];

const ALIAS_COLUMNAS = {
  RUT: ['RUT', 'R', 'RODERA'],
  'N-CONTACTO': [
    'N-CONTACTO',
    'N_CONTACTO',
    'NÂ¬CONTACTO',
    'NÃ‚Â¬CONTACTO',
    'NUMERO DE CONTACTO',
    'CONTACTO'
  ],
  'F/FIRMA': ['F/FIRMA', 'FECHA FIRMA'],
  OBSERVACION: ['OBSERVACION', 'OBSERVACIONES']
};

function excelSerialToDate(serial) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(excelEpoch.getTime() + Number(serial) * 86400000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function normalizarFechaEditable(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return '';
  }

  if (typeof valor === 'number' || /^\d{5}$/.test(String(valor).trim())) {
    return excelSerialToDate(valor);
  }

  const texto = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  const matchLatino = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);

  if (matchLatino) {
    const [, dd, mm, yy] = matchLatino;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  return texto;
}

export function formatearFechaVisible(valor) {
  const normalizada = normalizarFechaEditable(valor);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizada)) {
    return String(valor ?? '').trim();
  }

  const [year, month, day] = normalizada.split('-');
  return `${day}-${month}-${year}`;
}

export function formatearRutEditable(valor) {
  const limpio = String(valor ?? '')
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();

  if (!limpio) {
    return '';
  }

  if (limpio.length === 1) {
    return limpio;
  }

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${cuerpoConPuntos}-${dv}`;
}

function calcularDigitoVerificadorRut(cuerpo) {
  let suma = 0;
  let multiplicador = 2;

  for (let index = cuerpo.length - 1; index >= 0; index -= 1) {
    suma += Number(cuerpo[index]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);

  if (resto === 11) {
    return '0';
  }

  if (resto === 10) {
    return 'K';
  }

  return String(resto);
}

export function validarRut(valor) {
  const limpio = String(valor ?? '')
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();

  if (!limpio) {
    return { valido: true, sugerencia: '' };
  }

  if (limpio.length < 2) {
    return { valido: false, sugerencia: 'Completa el RUT con numero y digito verificador.' };
  }

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const dvEsperado = calcularDigitoVerificadorRut(cuerpo);

  if (dv !== dvEsperado) {
    return {
      valido: false,
      sugerencia: `RUT invalido. Revisa el digito verificador, deberia terminar en ${dvEsperado}.`
    };
  }

  return { valido: true, sugerencia: '' };
}

export function formatearContactoEditable(valor) {
  const numeros = String(valor ?? '').replace(/[^\d]/g, '');

  if (!numeros) {
    return '';
  }

  if (numeros.startsWith('56')) {
    const local = numeros.slice(2, 11);

    if (local.length <= 1) {
      return `+56 ${local}`;
    }

    if (local.length <= 5) {
      return `+56 ${local[0]} ${local.slice(1)}`.trim();
    }

    return `+56 ${local[0]} ${local.slice(1, 5)} ${local.slice(5, 9)}`.trim();
  }

  if (numeros.length <= 1) {
    return numeros;
  }

  if (numeros.length <= 5) {
    return `${numeros[0]} ${numeros.slice(1)}`.trim();
  }

  return `${numeros[0]} ${numeros.slice(1, 5)} ${numeros.slice(5, 9)}`.trim();
}

export function validarContacto(valor) {
  const numeros = String(valor ?? '').replace(/[^\d]/g, '');

  if (!numeros) {
    return { valido: true, sugerencia: '' };
  }

  const longitudValida = numeros.length === 9 || numeros.length === 11;

  if (!longitudValida) {
    return {
      valido: false,
      sugerencia: 'Contacto invalido. Usa 9 digitos o 56 mas 9 digitos.'
    };
  }

  if (numeros.length === 11 && !numeros.startsWith('56')) {
    return {
      valido: false,
      sugerencia: 'Si usas codigo de pais, el contacto debe comenzar con 56.'
    };
  }

  return { valido: true, sugerencia: '' };
}

export function crearFilaEditable(configuracion = CONFIGURACION_COLUMNAS_POR_DEFECTO) {
  const configuracionNormalizada = normalizarConfiguracionColumnas(configuracion);
  const columnasPersonalizadas = [
    ...configuracionNormalizada.camposTransversales,
    ...configuracionNormalizada.cuotasExtra
  ];

  return {
    'NOMBRE DE PROPIETARIO': '',
    RUT: '',
    'N-CONTACTO': '',
    'F/FIRMA': '',
    OBSERVACION: '',
    PARCELA: '',
    SITIO: '',
    ESTADO: 'Pendiente',
    [COLUMNA_ACTUALIZACION]: new Date().toISOString(),
    ...Object.fromEntries(columnasPersonalizadas.map((columna) => [columna, ''])),
    ...Object.fromEntries(TODOS_LOS_MESES.map((mes) => [mes, '']))
  };
}

export function normalizarFilaEditable(fila, configuracion = CONFIGURACION_COLUMNAS_POR_DEFECTO) {
  const { parcela, sitio } = obtenerParcelaYSitio(fila);
  const filaCanonica = { ...fila };

  [...Object.values(ALIAS_COLUMNAS).flat(), ...CAMPOS_CORTA_FUEGO].forEach((alias) => {
    delete filaCanonica[alias];
  });

  Object.keys(fila).forEach((columna) => {
    const columnaNormalizada = normalizarNombreColumna(columna);

    if (
      columnaNormalizada &&
      !CAMPOS_RESERVADOS_COLUMNAS.has(columnaNormalizada) &&
      columnaNormalizada !== columna
    ) {
      filaCanonica[columnaNormalizada] = fila[columna];
      delete filaCanonica[columna];
    }
  });

  const configuracionNormalizada = normalizarConfiguracionColumnas(configuracion, [filaCanonica]);

  return {
    ...crearFilaEditable(configuracionNormalizada),
    ...filaCanonica,
    RUT: formatearRutEditable(obtenerValorCampo(fila, ALIAS_COLUMNAS.RUT)),
    'N-CONTACTO': formatearContactoEditable(
      obtenerValorCampo(fila, ALIAS_COLUMNAS['N-CONTACTO'])
    ),
    'F/FIRMA': normalizarFechaEditable(obtenerValorCampo(fila, ALIAS_COLUMNAS['F/FIRMA'])),
    OBSERVACION: String(obtenerValorCampo(fila, ALIAS_COLUMNAS.OBSERVACION) ?? '').trim(),
    PARCELA: fila.PARCELA ?? parcela,
    SITIO: fila.SITIO ?? sitio,
    ESTADO: fila.ESTADO || 'Pendiente',
    [COLUMNA_ACTUALIZACION]: String(fila[COLUMNA_ACTUALIZACION] ?? '').trim(),
    [COLUMNA_CUOTA_EXTRA_POR_DEFECTO]: String(
      obtenerValorCampo(fila, CAMPOS_CORTA_FUEGO) ??
        fila[COLUMNA_CUOTA_EXTRA_POR_DEFECTO] ??
        ''
    ).trim()
  };
}

export function obtenerNombreVisibleColumna(columna) {
  return NOMBRES_VISIBLES_COLUMNAS[columna] || normalizarNombreColumna(columna) || columna;
}

export function esFilaFantasma(fila = {}) {
  const nombre = String(fila['NOMBRE DE PROPIETARIO'] ?? '').trim();
  const rut = String(fila.RUT ?? '').trim();
  const contacto = String(fila['N-CONTACTO'] ?? '').trim();
  const observacion = String(fila.OBSERVACION ?? '').trim();
  const parcela = String(fila.PARCELA ?? '').trim();
  const sitio = String(fila.SITIO ?? '').trim();
  const fechaFirma = String(fila['F/FIRMA'] ?? '').trim();

  const parcelaValida = parcela && parcela !== '-';
  const sitioValido = sitio && sitio !== '-';
  const fechaValida = fechaFirma && fechaFirma !== 'dd-mm-aaaa';

  return !nombre && !rut && !contacto && !observacion && !fechaValida && !parcelaValida && !sitioValido;
}

export function sanitizarValorCelda(campo, valor, columnasMonetarias = []) {
  const camposNumericos = new Set([
    'PARCELA',
    'SITIO',
    ...TODOS_LOS_MESES,
    ...columnasMonetarias.map(normalizarNombreColumna)
  ]);

  if (!camposNumericos.has(normalizarNombreColumna(campo))) {
    return valor;
  }

  return String(valor ?? '').replace(/[^\d]/g, '');
}
