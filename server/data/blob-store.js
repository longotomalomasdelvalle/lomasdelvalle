import { list, put } from '@vercel/blob';

function blobHabilitado() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json'
  });

  return true;
}

export function usaBlob() {
  return blobHabilitado();
}
