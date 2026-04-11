import { randomUUID } from 'node:crypto';

const DURACION_SESION_SEGUNDOS = 60 * 60 * 8;
const sesiones = new Map();

function limpiarSesionesExpiradas() {
  const ahora = Date.now();

  for (const [token, sesion] of sesiones.entries()) {
    if (sesion.expiraEn <= ahora) {
      sesiones.delete(token);
    }
  }
}

export function crearSesion(datos) {
  limpiarSesionesExpiradas();

  const token = randomUUID();
  const expiraEn = Date.now() + DURACION_SESION_SEGUNDOS * 1000;

  sesiones.set(token, {
    ...datos,
    expiraEn
  });

  return {
    token,
    maxAge: DURACION_SESION_SEGUNDOS
  };
}

export function obtenerSesion(token) {
  limpiarSesionesExpiradas();

  if (!token) {
    return null;
  }

  const sesion = sesiones.get(token);

  if (!sesion) {
    return null;
  }

  if (sesion.expiraEn <= Date.now()) {
    sesiones.delete(token);
    return null;
  }

  return sesion;
}

export function eliminarSesion(token) {
  sesiones.delete(token);
}
