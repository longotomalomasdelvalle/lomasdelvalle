export function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const separatorIndex = item.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();

      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

export function serializarCookie(nombre, valor, opciones = {}) {
  const partes = [`${nombre}=${encodeURIComponent(valor)}`];

  if (opciones.httpOnly) partes.push('HttpOnly');
  if (opciones.sameSite) partes.push(`SameSite=${opciones.sameSite}`);
  if (opciones.path) partes.push(`Path=${opciones.path}`);
  if (opciones.maxAge !== undefined) partes.push(`Max-Age=${opciones.maxAge}`);
  if (opciones.secure) partes.push('Secure');

  return partes.join('; ');
}
