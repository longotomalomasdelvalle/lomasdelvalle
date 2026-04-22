# Lomas del Valle - Portal de Pagos

Portal publico para consulta de estado de pagos y panel de administracion para gestion de planilla.

## Comprobantes de pago (Blob + correo)

Se implemento flujo para que cada socio adjunte su comprobante en imagen desde la tarjeta publica.

### Flujo

1. El socio adjunta una imagen (`JPG/PNG/WebP`) desde su tarjeta.
2. El navegador optimiza la imagen (resize + compresion) antes de subirla.
3. El backend valida tamano/formato y guarda el archivo en Vercel Blob.
4. El backend registra metadatos del comprobante.
5. Se envia un correo interno con link al archivo en Blob.

### Variables de entorno necesarias

Configura estas variables en local y en Vercel:

- `BLOB_READ_WRITE_TOKEN`
- `BLOB_ACCESS=private`
- `COMPROBANTE_BLOB_ACCESS=private`
- `COMPROBANTE_MAX_BYTES=1000000`
- `RESEND_API_KEY`
- `COMPROBANTE_EMAIL_FROM` (ejemplo: `Pagos Lomas <pagos@tu-dominio.com>`)
- `COMPROBANTE_EMAIL_TO` (correo interno que recibe avisos)

### Probar rapido

1. Ejecuta backend y frontend:
   - `npm run dev:server`
   - `npm run dev:client`
2. Abre la vista publica, filtra un vecino y adjunta un comprobante.
3. Verifica:
   - mensaje de exito en la UI
   - archivo en Blob
   - correo recibido en `COMPROBANTE_EMAIL_TO`

Si falta configuracion de correo, el comprobante igual se guarda y se informa el motivo en la respuesta.
