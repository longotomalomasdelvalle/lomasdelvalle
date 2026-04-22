import { createServer } from 'node:http';
import { URL, fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  credencialesAdminConfiguradas,
  validarCredencialesAdmin
} from './config/admin.js';
import {
  cargarConfiguracionColumnas,
  guardarConfiguracionColumnas
} from './data/config-store.js';
import { escribirArchivoBlob, usaBlob } from './data/blob-store.js';
import {
  guardarRegistroComprobante,
  obtenerRegistroComprobante
} from './data/comprobantes-store.js';
import { cargarFilasVecinos, guardarFilasVecinos } from './data/vecinos-store.js';
import { parseCookies, serializarCookie } from './utils/cookies.js';
import { enviarCorreoComprobante } from './utils/notificaciones.js';
import { crearSesion, eliminarSesion, obtenerSesion } from './utils/sessions.js';

const PORT = Number(process.env.PORT || 8787);
const COOKIE_NOMBRE = 'lomas_admin_session';
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'Lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production'
};
const TIPOS_IMAGEN_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES_COMPROBANTE = Number(process.env.COMPROBANTE_MAX_BYTES || 1_000_000);

function slug(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function extensionPorMime(mime) {
  if (mime === 'image/png') {
    return 'png';
  }
  if (mime === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
}

function parseDataUrlImagen(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Imagen invalida. Envia un archivo JPG, PNG o WebP.');
  }

  const mime = match[1].toLowerCase();
  if (!TIPOS_IMAGEN_PERMITIDOS.has(mime)) {
    throw new Error('Formato no permitido. Usa JPG, PNG o WebP.');
  }

  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length) {
    throw new Error('La imagen esta vacia.');
  }

  if (bytes.length > MAX_BYTES_COMPROBANTE) {
    throw new Error(
      `La imagen supera el limite permitido (${Math.round(MAX_BYTES_COMPROBANTE / 1024)} KB).`
    );
  }

  return { mime, bytes };
}

function parsearRepositorioGithub(valor) {
  const limpio = String(valor ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  const partes = limpio.split('/').filter(Boolean);
  if (partes.length < 2) {
    return { owner: '', repo: '' };
  }
  return { owner: partes[0], repo: partes[1] };
}

function codificarPathGithub(pathname) {
  return String(pathname || '')
    .split('/')
    .filter(Boolean)
    .map((segmento) => encodeURIComponent(segmento))
    .join('/');
}

async function crearRespaldoGithub() {
  const token = String(process.env.GITHUB_TOKEN ?? '').trim();
  const repoConfig = String(process.env.GITHUB_BACKUP_REPO ?? '').trim();
  const branch = String(process.env.GITHUB_BACKUP_BRANCH ?? 'main').trim() || 'main';
  const rutaRespaldo = String(process.env.GITHUB_BACKUP_PATH ?? 'respaldos/vecinos-respaldo.json').trim();

  if (!token || !repoConfig) {
    throw new Error(
      'Configura GITHUB_TOKEN y GITHUB_BACKUP_REPO para habilitar el respaldo en GitHub.'
    );
  }

  const { owner, repo } = parsearRepositorioGithub(repoConfig);
  if (!owner || !repo) {
    throw new Error('GITHUB_BACKUP_REPO debe tener formato owner/repo.');
  }

  const [filas, configuracion] = await Promise.all([
    cargarFilasVecinos(),
    cargarConfiguracionColumnas()
  ]);

  const generadoEn = new Date().toISOString();
  const payload = {
    generadoEn,
    fuente: 'lomasdelvalle-admin',
    branch,
    configuracion,
    filas
  };
  const contenidoBase64 = Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString('base64');
  const rutaCodificada = codificarPathGithub(rutaRespaldo);
  const endpointBase = `https://api.github.com/repos/${owner}/${repo}/contents/${rutaCodificada}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'lomasdelvalle-admin'
  };

  let shaActual;
  const consultaActual = await fetch(`${endpointBase}?ref=${encodeURIComponent(branch)}`, {
    headers
  });
  if (consultaActual.status === 200) {
    const actual = await consultaActual.json();
    shaActual = actual?.sha;
  } else if (consultaActual.status !== 404) {
    const detalle = await consultaActual.text();
    throw new Error(`GitHub respondio ${consultaActual.status}: ${detalle}`);
  }

  const commitMessage = `chore: respaldo planilla ${new Date().toISOString()}`;
  const body = {
    message: commitMessage,
    content: contenidoBase64,
    branch
  };
  if (shaActual) {
    body.sha = shaActual;
  }

  const escritura = await fetch(endpointBase, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const resultado = await escritura.json().catch(() => ({}));
  if (!escritura.ok) {
    const detalle = resultado?.message || `GitHub respondio ${escritura.status}`;
    throw new Error(`No se pudo subir respaldo a GitHub: ${detalle}`);
  }

  return {
    ok: true,
    generadoEn,
    repo: `${owner}/${repo}`,
    path: rutaRespaldo,
    branch,
    commitSha: resultado?.commit?.sha || '',
    fileUrl: resultado?.content?.html_url || ''
  };
}

function responderJson(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    ...extraHeaders
  });

  response.end(JSON.stringify(body));
}

function leerBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });

    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON invalido'));
      }
    });

    request.on('error', reject);
  });
}

function obtenerSesionRequest(request) {
  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[COOKIE_NOMBRE];
  return token ? { token, sesion: obtenerSesion(token) } : { token: '', sesion: null };
}

function responderNoAutorizado(response) {
  responderJson(response, 401, {
    ok: false,
    message: 'Sesion no valida o expirada.'
  });
}

async function procesarComprobantePago(body, publicBaseUrl) {
  if (!usaBlob()) {
    throw new Error(
      'No hay almacenamiento Blob configurado. Define BLOB_READ_WRITE_TOKEN para recibir comprobantes.'
    );
  }

  const nombre = String(body.nombre || '').trim();
  const parcela = String(body.parcela || '').trim();
  const sitio = String(body.sitio || '').trim();
  const monto = String(body.monto || '').trim();
  const fechaPago = String(body.fechaPago || '').trim();
  const observacion = String(body.observacion || '').trim();
  const archivoNombre = String(body.archivoNombre || 'comprobante').trim();

  if (!nombre || !parcela || !sitio || !body.imagenDataUrl) {
    throw new Error('Debes enviar nombre, parcela, sitio e imagen del comprobante.');
  }

  const { mime, bytes } = parseDataUrlImagen(body.imagenDataUrl);
  const extension = extensionPorMime(mime);
  const fecha = new Date();
  const nombreSeguro = slug(nombre) || 'vecino';
  const identificador = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const blobPath = `lomas/comprobantes/${fecha.getUTCFullYear()}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${identificador}-${nombreSeguro}.${extension}`;

  const blob = await escribirArchivoBlob(blobPath, bytes, {
    contentType: mime,
    access: process.env.COMPROBANTE_BLOB_ACCESS || process.env.BLOB_ACCESS || 'private'
  });

  if (!blob?.url) {
    throw new Error('No se pudo guardar el comprobante en Blob.');
  }

  const registro = await guardarRegistroComprobante({
    id: identificador,
    creadoEn: fecha.toISOString(),
    nombre,
    parcela,
    sitio,
    monto,
    fechaPago,
    observacion,
    archivoNombre,
    archivoMime: mime,
    archivoBytes: bytes.length,
    blobPath,
    blobUrl: blob.url,
    emailNotificado: false
  });
  const enlacePublico = `${publicBaseUrl}/api/comprobantes/archivo?id=${encodeURIComponent(registro.id)}`;

  const notificacion = await enviarCorreoComprobante({
    ...registro,
    blobPath,
    blobUrl: blob.url,
    enlacePublico
  });

  if (notificacion.ok) {
    await guardarRegistroComprobante({
      ...registro,
      emailNotificado: true
    });
  }

  return {
    id: registro.id,
    blobUrl: blob.url,
    enlacePublico,
    blobPath,
    archivoBytes: bytes.length,
    emailEnviado: Boolean(notificacion.ok),
    emailMensaje: notificacion.ok
      ? 'Correo enviado.'
      : notificacion.message || 'Comprobante guardado, pero el correo no se pudo enviar.'
  };
}

export async function handleRequest(request, response) {
  try {
    const host = request.headers.host || 'localhost';
    const url = new URL(request.url || '/', `http://${host}`);

    const publicBaseUrl =
      process.env.PUBLIC_APP_URL || `${process.env.VERCEL_URL ? 'https' : 'http'}://${host}`;

    if (request.method === 'GET' && url.pathname === '/api/health') {
      responderJson(response, 200, { ok: true });
      return;
    }

  if (request.method === 'GET' && url.pathname === '/api/vecinos') {
    const [filas, configuracion] = await Promise.all([
      cargarFilasVecinos(),
      cargarConfiguracionColumnas()
    ]);
    responderJson(response, 200, {
      ok: true,
      filas,
      configuracion
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/comprobantes/archivo') {
    const id = String(url.searchParams.get('id') || '').trim();
    if (!id) {
      responderJson(response, 400, { ok: false, message: 'Falta id de comprobante.' });
      return;
    }

    const registro = await obtenerRegistroComprobante(id);
    if (!registro?.blobUrl) {
      responderJson(response, 404, { ok: false, message: 'Comprobante no encontrado.' });
      return;
    }

    const descarga = await fetch(registro.blobUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
      }
    });

    if (!descarga.ok) {
      responderJson(response, 404, { ok: false, message: 'No se pudo abrir el comprobante.' });
      return;
    }

    const buffer = Buffer.from(await descarga.arrayBuffer());
    response.writeHead(200, {
      'Content-Type': registro.archivoMime || 'application/octet-stream',
      'Content-Length': buffer.length,
      'Cache-Control': 'private, max-age=120'
    });
    response.end(buffer);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/comprobantes') {
    try {
      const body = await leerBody(request);
      const resultado = await procesarComprobantePago(body, publicBaseUrl);
      responderJson(response, 200, {
        ok: true,
        message: resultado.emailEnviado
          ? 'Comprobante recibido y notificado por correo.'
          : 'Comprobante recibido. El correo no se pudo enviar.',
        ...resultado
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo procesar el comprobante.'
      });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/session') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    responderJson(response, 200, {
      ok: true,
      usuario: sesion.usuario
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/resumen') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    responderJson(response, 200, {
      ok: true,
      resumen: {
        usuario: sesion.usuario,
        acceso: 'administrador',
        autenticado: true
      }
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/vecinos') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    const [filas, configuracion] = await Promise.all([
      cargarFilasVecinos(),
      cargarConfiguracionColumnas()
    ]);
    responderJson(response, 200, {
      ok: true,
      filas,
      configuracion
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/login') {
    if (!credencialesAdminConfiguradas()) {
      responderJson(response, 500, {
        ok: false,
        message:
          'Debes configurar ADMIN_USER y ADMIN_PASSWORD o ADMIN_PASSWORD_HASH en el servidor.'
      });
      return;
    }

    try {
      const body = await leerBody(request);
      const usuario = String(body.usuario ?? '');
      const clave = String(body.clave ?? '');

      if (!usuario || !clave) {
        responderJson(response, 400, {
          ok: false,
          message: 'Debes enviar usuario y clave.'
        });
        return;
      }

      if (!validarCredencialesAdmin(usuario, clave)) {
        responderJson(response, 401, {
          ok: false,
          message: 'Usuario o clave incorrecta.'
        });
        return;
      }

      const sesion = crearSesion({ usuario });
      const setCookie = serializarCookie(COOKIE_NOMBRE, sesion.token, {
        ...COOKIE_BASE,
        maxAge: sesion.maxAge
      });

      responderJson(
        response,
        200,
        {
          ok: true,
          usuario
        },
        { 'Set-Cookie': setCookie }
      );
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'Solicitud invalida.'
      });
    }

    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/vecinos/import') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const body = await leerBody(request);
      const filas = Array.isArray(body.filas) ? body.filas : null;

      if (!filas) {
        responderJson(response, 400, {
          ok: false,
          message: 'Debes enviar filas validas para importar.'
        });
        return;
      }

      const configuracion = await guardarConfiguracionColumnas(body.configuracion || {});
      const guardadas = await guardarFilasVecinos(filas);
      responderJson(response, 200, {
        ok: true,
        filas: guardadas,
        configuracion
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo importar la planilla.'
      });
    }

    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/admin/vecinos') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const body = await leerBody(request);
      const filas = Array.isArray(body.filas) ? body.filas : null;

      if (!filas) {
        responderJson(response, 400, {
          ok: false,
          message: 'Debes enviar una lista valida de filas.'
        });
        return;
      }

      const configuracion = await guardarConfiguracionColumnas(body.configuracion || {});
      const guardadas = await guardarFilasVecinos(filas);
      responderJson(response, 200, {
        ok: true,
        filas: guardadas,
        configuracion
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo guardar la planilla.'
      });
    }

    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/vecinos/normalizar') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const [filasActuales, configuracionActual] = await Promise.all([
        cargarFilasVecinos(),
        cargarConfiguracionColumnas()
      ]);
      const guardadas = await guardarFilasVecinos(filasActuales);
      const configuracion = await guardarConfiguracionColumnas(configuracionActual);

      responderJson(response, 200, {
        ok: true,
        filas: guardadas,
        configuracion
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo normalizar la planilla.'
      });
    }

    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/backup/github') {
    const { sesion } = obtenerSesionRequest(request);

    if (!sesion) {
      responderNoAutorizado(response);
      return;
    }

    try {
      const resultado = await crearRespaldoGithub();
      responderJson(response, 200, {
        ok: true,
        message: `Respaldo enviado a GitHub (${resultado.repo}@${resultado.branch}).`,
        ...resultado
      });
    } catch (error) {
      responderJson(response, 400, {
        ok: false,
        message: error.message || 'No se pudo crear el respaldo en GitHub.'
      });
    }

    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/logout') {
    const { token } = obtenerSesionRequest(request);

    if (token) {
      eliminarSesion(token);
    }

    responderJson(
      response,
      200,
      { ok: true },
      {
        'Set-Cookie': serializarCookie(COOKIE_NOMBRE, '', {
          ...COOKIE_BASE,
          maxAge: 0
        })
      }
    );
    return;
  }

    responderJson(response, 404, {
      ok: false,
      message: 'Ruta no encontrada.'
    });
  } catch (error) {
    responderJson(response, 500, {
      ok: false,
      message: error?.message || 'Error interno del servidor.'
    });
  }
}

function ejecutadoDirecto() {
  const currentFile = fileURLToPath(import.meta.url);
  const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return currentFile === executedFile;
}

if (ejecutadoDirecto()) {
  const server = createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`Servidor admin escuchando en http://localhost:${PORT}`);
  });
}
