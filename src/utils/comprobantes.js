const MAX_DIMENSION_DEFAULT = 1400;
const MAX_BYTES_DEFAULT = 1_000_000;

function cargarImagenDesdeArchivo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    image.src = url;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo codificar la imagen.'));
    reader.readAsDataURL(blob);
  });
}

function exportarCanvas(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export async function optimizarComprobante(file, options = {}) {
  const maxDimension = Number(options.maxDimension || MAX_DIMENSION_DEFAULT);
  const maxBytes = Number(options.maxBytes || MAX_BYTES_DEFAULT);
  const imagen = await cargarImagenDesdeArchivo(file);

  const ratio = Math.min(1, maxDimension / Math.max(imagen.width, imagen.height));
  const ancho = Math.max(1, Math.round(imagen.width * ratio));
  const alto = Math.max(1, Math.round(imagen.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d', { alpha: false });

  if (!ctx) {
    throw new Error('No se pudo preparar el compresor de imagen.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(imagen, 0, 0, ancho, alto);

  const formatos = ['image/webp', 'image/jpeg'];
  const calidades = [0.82, 0.74, 0.66, 0.58, 0.5];
  let mejorBlob = null;

  for (const formato of formatos) {
    for (const calidad of calidades) {
      const candidato = await exportarCanvas(canvas, formato, calidad);
      if (!mejorBlob || candidato.size < mejorBlob.size) {
        mejorBlob = candidato;
      }
      if (candidato.size <= maxBytes) {
        const dataUrl = await blobToDataUrl(candidato);
        return {
          blob: candidato,
          dataUrl,
          width: ancho,
          height: alto,
          mime: candidato.type || formato,
          bytes: candidato.size
        };
      }
    }
  }

  if (!mejorBlob) {
    throw new Error('No se pudo optimizar la imagen.');
  }

  if (mejorBlob.size > maxBytes) {
    throw new Error(
      `La imagen sigue muy pesada (${Math.round(mejorBlob.size / 1024)} KB). Prueba con una foto mas liviana.`
    );
  }

  const dataUrl = await blobToDataUrl(mejorBlob);
  return {
    blob: mejorBlob,
    dataUrl,
    width: ancho,
    height: alto,
    mime: mejorBlob.type || 'image/jpeg',
    bytes: mejorBlob.size
  };
}
