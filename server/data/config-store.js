import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { escribirJsonBlob, leerJsonBlob, usaBlob } from './blob-store.js';

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const CONFIG_FILE = path.join(DATA_DIR, 'configuracion-columnas.json');
const CONFIG_BLOB_PATH = 'lomas/configuracion-columnas.json';
const CONFIGURACION_POR_DEFECTO = {
  cuotasExtra: ['CORTA FUEGO'],
  camposTransversales: []
};

function limpiarColumna(valor) {
  return String(valor ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function deduplicar(columnas = []) {
  return [...new Set(columnas.map(limpiarColumna).filter(Boolean))];
}

function normalizarConfiguracion(configuracion = {}) {
  const cuotasExtra = deduplicar(
    configuracion.cuotasExtra?.length
      ? configuracion.cuotasExtra
      : CONFIGURACION_POR_DEFECTO.cuotasExtra
  );
  const camposTransversales = deduplicar(configuracion.camposTransversales).filter(
    (columna) => !cuotasExtra.includes(columna)
  );

  return {
    cuotasExtra: cuotasExtra.length > 0 ? cuotasExtra : [...CONFIGURACION_POR_DEFECTO.cuotasExtra],
    camposTransversales
  };
}

async function asegurarDirectorio() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function escribirConfiguracion(configuracion) {
  await asegurarDirectorio();
  await writeFile(CONFIG_FILE, JSON.stringify(normalizarConfiguracion(configuracion), null, 2), 'utf8');
}

export async function cargarConfiguracionColumnas() {
  if (usaBlob()) {
    const configBlob = await leerJsonBlob(CONFIG_BLOB_PATH);

    if (!configBlob) {
      await escribirJsonBlob(CONFIG_BLOB_PATH, CONFIGURACION_POR_DEFECTO);
      return { ...CONFIGURACION_POR_DEFECTO };
    }

    return normalizarConfiguracion(configBlob);
  }

  await asegurarDirectorio();

  if (!existsSync(CONFIG_FILE)) {
    await escribirConfiguracion(CONFIGURACION_POR_DEFECTO);
    return { ...CONFIGURACION_POR_DEFECTO };
  }

  const contenido = await readFile(CONFIG_FILE, 'utf8');

  if (!contenido.trim()) {
    return { ...CONFIGURACION_POR_DEFECTO };
  }

  return normalizarConfiguracion(JSON.parse(contenido));
}

export async function guardarConfiguracionColumnas(configuracion) {
  const normalizada = normalizarConfiguracion(configuracion);

  if (usaBlob()) {
    await escribirJsonBlob(CONFIG_BLOB_PATH, normalizada);
    return normalizada;
  }

  await escribirConfiguracion(normalizada);
  return normalizada;
}
