import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { escribirJsonBlob, leerJsonBlob, usaBlob } from './blob-store.js';

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const DATA_FILE = path.join(DATA_DIR, 'comprobantes.json');
const DATA_BLOB_PATH = 'lomas/comprobantes.json';

async function asegurarDirectorio() {
  await mkdir(DATA_DIR, { recursive: true });
}

function normalizarRegistro(registro = {}) {
  return {
    id: String(registro.id || '').trim(),
    creadoEn: String(registro.creadoEn || '').trim(),
    nombre: String(registro.nombre || '').trim(),
    parcela: String(registro.parcela || '').trim(),
    sitio: String(registro.sitio || '').trim(),
    monto: String(registro.monto || '').trim(),
    fechaPago: String(registro.fechaPago || '').trim(),
    observacion: String(registro.observacion || '').trim(),
    archivoNombre: String(registro.archivoNombre || '').trim(),
    archivoMime: String(registro.archivoMime || '').trim(),
    archivoBytes: Number(registro.archivoBytes || 0),
    blobPath: String(registro.blobPath || '').trim(),
    blobUrl: String(registro.blobUrl || '').trim(),
    emailNotificado: Boolean(registro.emailNotificado)
  };
}

async function leerRegistros() {
  if (usaBlob()) {
    const registrosBlob = await leerJsonBlob(DATA_BLOB_PATH);
    if (!Array.isArray(registrosBlob)) {
      return [];
    }
    return registrosBlob.map(normalizarRegistro);
  }

  await asegurarDirectorio();
  if (!existsSync(DATA_FILE)) {
    return [];
  }

  const contenido = await readFile(DATA_FILE, 'utf8');
  if (!contenido.trim()) {
    return [];
  }

  const registros = JSON.parse(contenido);
  return Array.isArray(registros) ? registros.map(normalizarRegistro) : [];
}

async function escribirRegistros(registros) {
  const normalizados = registros.map(normalizarRegistro);

  if (usaBlob()) {
    await escribirJsonBlob(DATA_BLOB_PATH, normalizados);
    return normalizados;
  }

  await asegurarDirectorio();
  await writeFile(DATA_FILE, JSON.stringify(normalizados, null, 2), 'utf8');
  return normalizados;
}

export async function guardarRegistroComprobante(registro) {
  const actuales = await leerRegistros();
  const actualizado = [normalizarRegistro(registro), ...actuales].slice(0, 3000);
  await escribirRegistros(actualizado);
  return actualizado[0];
}

export async function obtenerRegistroComprobante(id) {
  const idBuscado = String(id || '').trim();
  if (!idBuscado) {
    return null;
  }

  const registros = await leerRegistros();
  return registros.find((item) => item.id === idBuscado) || null;
}
