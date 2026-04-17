import { CAMPOS_CORTA_FUEGO, TODOS_LOS_MESES } from '../constants/pagos.js';

export const COLUMNA_CUOTA_EXTRA_POR_DEFECTO = 'CORTA FUEGO';
export const COLUMNA_ACTUALIZACION = '_UPDATED_AT';

export const CONFIGURACION_COLUMNAS_POR_DEFECTO = {
  cuotasExtra: [COLUMNA_CUOTA_EXTRA_POR_DEFECTO],
  camposTransversales: []
};

export const NOMBRES_VISIBLES_COLUMNAS = {
  R: 'RUT',
  RODERA: 'RUT',
  N_CONTACTO: 'N-CONTACTO',
  'NÂ¬CONTACTO': 'N-CONTACTO',
  'NÃ‚Â¬CONTACTO': 'N-CONTACTO',
  CONTACTO: 'N-CONTACTO',
  'NUMERO DE CONTACTO': 'N-CONTACTO',
  'FECHA FIRMA': 'F/FIRMA',
  OBSERVACIONES: 'OBSERVACION'
};

export const CAMPOS_RESERVADOS_COLUMNAS = new Set([
  'NOMBRE DE PROPIETARIO',
  'RUT',
  'N-CONTACTO',
  'F/FIRMA',
  'OBSERVACION',
  'PARCELA',
  'SITIO',
  'ESTADO',
  COLUMNA_ACTUALIZACION,
  ...TODOS_LOS_MESES,
  'PARC/ST',
  'PROPIETARIO',
  'R',
  'RODERA',
  'N_CONTACTO',
  'NÂ¬CONTACTO',
  'NÃ‚Â¬CONTACTO',
  'NUMERO DE CONTACTO',
  'CONTACTO',
  'FECHA FIRMA',
  'OBSERVACIONES',
  'TOTAL',
  'TOTAL 2026'
]);

function limpiarNombreColumna(valor) {
  return String(valor ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function deduplicarColumnas(columnas = []) {
  return [...new Set(columnas.map(limpiarNombreColumna).filter(Boolean))];
}

export function normalizarNombreColumna(columna) {
  const nombre = limpiarNombreColumna(columna);

  if (!nombre) {
    return '';
  }

  if (CAMPOS_CORTA_FUEGO.map(limpiarNombreColumna).includes(nombre)) {
    return COLUMNA_CUOTA_EXTRA_POR_DEFECTO;
  }

  // Defensivo: planillas antiguas han llegado con variantes de "RODERA".
  if (nombre === 'R' || nombre.includes('RODERA')) {
    return 'RUT';
  }

  return NOMBRES_VISIBLES_COLUMNAS[nombre] || nombre;
}

export function obtenerColumnasPersonalizadas(filas = [], aliasesSistema = []) {
  const columnas = new Set();
  const aliases = new Set(aliasesSistema);

  filas.forEach((fila) => {
    Object.keys(fila).forEach((columna) => {
      const nombre = normalizarNombreColumna(columna);

      if (!nombre || CAMPOS_RESERVADOS_COLUMNAS.has(nombre) || aliases.has(columna)) {
        return;
      }

      columnas.add(nombre);
    });
  });

  return [...columnas];
}

export function normalizarConfiguracionColumnas(
  configuracion = {},
  filas = [],
  aliasesSistema = []
) {
  const cuotasExtra = deduplicarColumnas(
    configuracion.cuotasExtra?.length
      ? configuracion.cuotasExtra
      : CONFIGURACION_COLUMNAS_POR_DEFECTO.cuotasExtra
  )
    .map(normalizarNombreColumna)
    .filter((columna) => columna && !CAMPOS_RESERVADOS_COLUMNAS.has(columna));

  const camposTransversalesConfigurados = deduplicarColumnas(configuracion.camposTransversales)
    .map(normalizarNombreColumna)
    .filter(
      (columna) =>
        columna && !CAMPOS_RESERVADOS_COLUMNAS.has(columna) && !cuotasExtra.includes(columna)
    );

  const columnasDescubiertas = obtenerColumnasPersonalizadas(filas, aliasesSistema).filter(
    (columna) => !cuotasExtra.includes(columna)
  );

  return {
    cuotasExtra: cuotasExtra.length > 0 ? cuotasExtra : [...CONFIGURACION_COLUMNAS_POR_DEFECTO.cuotasExtra],
    camposTransversales: deduplicarColumnas([
      ...camposTransversalesConfigurados,
      ...columnasDescubiertas
    ])
  };
}
