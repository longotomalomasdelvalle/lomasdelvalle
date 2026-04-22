import { list, put } from '@vercel/blob';

function blobHabilitado() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function accesoBlob() {
  return process.env.BLOB_ACCESS === 'public' ? 'public' : 'private';
}

function normalizarAccesoBlob(access) {
  if (access === 'public') {
    return 'public';
  }
  if (access === 'private') {
    return 'private';
  }
  return accesoBlob();
}

async function buscarBlob(pathname) {
  const resultado = await list({
    prefix: pathname,
    limit: 100
  });
  const blobs = (resultado?.blobs || []).filter((blob) => blob.pathname === pathname);

  if (blobs.length === 0) {
    return null;
  }

  return blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
}

export async function leerJsonBlob(pathname) {
  if (!blobHabilitado()) {
    return null;
  }

  const blob = await buscarBlob(pathname);

  if (!blob) {
    return null;
  }

  const response = await fetch(blob.url, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo leer blob ${pathname}: ${response.status}`);
  }

  return response.json();
}

export async function escribirJsonBlob(pathname, data) {
  if (!blobHabilitado()) {
    return false;
  }

  await put(pathname, JSON.stringify(data, null, 2), {
    access: accesoBlob(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });

  return true;

}

export async function escribirArchivoBlob(pathname, data, options = {}) {
  if (!blobHabilitado()) {
    return null;
  }

  return put(pathname, data, {
    access: normalizarAccesoBlob(options.access),
    addRandomSuffix: options.addRandomSuffix ?? false,
    allowOverwrite: options.allowOverwrite ?? false,
    contentType: options.contentType || 'application/octet-stream'
  });
}

export function usaBlob() {
  return blobHabilitado();
}
