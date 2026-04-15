import { createHmac, timingSafeEqual } from 'node:crypto';

const DURACION_SESION_SEGUNDOS = 60 * 60 * 8;
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.ADMIN_PASSWORD_HASH ||
  process.env.ADMIN_PASSWORD ||
  'dev-session-secret-change-me';

function base64urlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64urlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function firmarPayload(payloadCodificado) {
  return createHmac('sha256', SESSION_SECRET).update(payloadCodificado).digest('base64url');
}

function crearToken(payload) {
  const payloadCodificado = base64urlEncode(JSON.stringify(payload));
  const firma = firmarPayload(payloadCodificado);
  return `${payloadCodificado}.${firma}`;
}

function verificarToken(token) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [payloadCodificado, firmaRecibida] = token.split('.', 2);

  if (!payloadCodificado || !firmaRecibida) {
    return null;
  }

  const firmaEsperada = firmarPayload(payloadCodificado);
  const firmaEsperadaBuffer = Buffer.from(firmaEsperada);
  const firmaRecibidaBuffer = Buffer.from(firmaRecibida);

  if (firmaEsperadaBuffer.length !== firmaRecibidaBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(firmaEsperadaBuffer, firmaRecibidaBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64urlDecode(payloadCodificado));

    if (!payload?.expiraEn || Number(payload.expiraEn) <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function crearSesion(datos) {
  const expiraEn = Date.now() + DURACION_SESION_SEGUNDOS * 1000;
  const payload = {
    ...datos,
    expiraEn
  };

  return {
    token: crearToken(payload),
    maxAge: DURACION_SESION_SEGUNDOS
  };
}

export function obtenerSesion(token) {
  return verificarToken(token);
}

export function eliminarSesion(token) {
  return Boolean(token);
}
