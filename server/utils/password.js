import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function crearHashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verificarPassword(password, passwordGuardada) {
  if (!passwordGuardada) {
    return false;
  }

  if (!passwordGuardada.startsWith('scrypt$')) {
    return password === passwordGuardada;
  }

  const [, salt, hashGuardado] = passwordGuardada.split('$');

  if (!salt || !hashGuardado) {
    return false;
  }

  const hashCalculado = scryptSync(password, salt, 64);
  const hashOriginal = Buffer.from(hashGuardado, 'hex');

  if (hashCalculado.length !== hashOriginal.length) {
    return false;
  }

  return timingSafeEqual(hashCalculado, hashOriginal);
}
