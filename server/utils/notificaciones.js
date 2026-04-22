function configurarCorreo() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.COMPROBANTE_EMAIL_FROM || '').trim();
  const to = String(process.env.COMPROBANTE_EMAIL_TO || '').trim();

  if (!apiKey || !from || !to) {
    return null;
  }

  return { apiKey, from, to };
}

export async function enviarCorreoComprobante(payload) {
  const config = configurarCorreo();
  if (!config) {
    return {
      ok: false,
      reason: 'not_configured',
      message:
        'Correo no configurado. Define RESEND_API_KEY, COMPROBANTE_EMAIL_FROM y COMPROBANTE_EMAIL_TO.'
    };
  }

  const subject = `Nuevo comprobante: ${payload.nombre} (${payload.parcela}/${payload.sitio})`;
  const enlaceComprobante = payload.enlacePublico || payload.blobUrl;
  const html = `
    <h2>Nuevo comprobante de pago</h2>
    <p><strong>Nombre:</strong> ${payload.nombre}</p>
    <p><strong>Parcela/Sitio:</strong> ${payload.parcela} / ${payload.sitio}</p>
    <p><strong>Fecha de pago:</strong> ${payload.fechaPago || 'No informada'}</p>
    <p><strong>Detalle/Comentario:</strong> ${payload.observacion || 'Sin detalle'}</p>
    <p><strong>Archivo:</strong> ${payload.archivoNombre} (${payload.archivoMime}, ${payload.archivoBytes} bytes)</p>
    <p><strong>Blob path:</strong> ${payload.blobPath}</p>
    <p><a href="${enlaceComprobante}" target="_blank" rel="noopener noreferrer">Abrir comprobante</a></p>
  `;

  const text = [
    'Nuevo comprobante de pago',
    `Nombre: ${payload.nombre}`,
    `Parcela/Sitio: ${payload.parcela} / ${payload.sitio}`,
    `Fecha de pago: ${payload.fechaPago || 'No informada'}`,
    `Detalle/Comentario: ${payload.observacion || 'Sin detalle'}`,
    `Archivo: ${payload.archivoNombre} (${payload.archivoMime}, ${payload.archivoBytes} bytes)`,
    `Blob path: ${payload.blobPath}`,
    `Enlace: ${enlaceComprobante}`
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: config.from,
      to: [config.to],
      subject,
      html,
      text,
      attachments: payload.archivoContenidoBase64
        ? [
            {
              filename: payload.archivoNombre || 'comprobante.jpg',
              content: payload.archivoContenidoBase64
            }
          ]
        : undefined
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      reason: 'send_failed',
      message: data?.message || `Resend respondio ${response.status}`
    };
  }

  return { ok: true, id: data?.id || '' };
}
