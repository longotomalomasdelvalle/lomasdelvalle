import { verificarPassword } from '../utils/password.js';

export function obtenerCredencialesAdmin() {
  return {
    usuario: process.env.ADMIN_USER ?? '',
    clave: process.env.ADMIN_PASSWORD ?? '',
    claveHash: process.env.ADMIN_PASSWORD_HASH ?? ''
  };
}

export function credencialesAdminConfiguradas() {
  const { usuario, clave, claveHash } = obtenerCredencialesAdmin();
  return usuario.trim() !== '' && (clave.trim() !== '' || claveHash.trim() !== '');
}

export function validarCredencialesAdmin(usuario, clave) {
  if (!credencialesAdminConfiguradas()) {
    return false;
  }

  const credenciales = obtenerCredencialesAdmin();
  const passwordGuardada = credenciales.claveHash || credenciales.clave;

  return usuario === credenciales.usuario && verificarPassword(clave, passwordGuardada);
}
