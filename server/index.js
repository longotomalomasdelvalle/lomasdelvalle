import { createServer } from 'node:http';
import { URL } from 'node:url';
import {
  credencialesAdminConfiguradas,
  validarCredencialesAdmin
} from './config/admin.js';
import {
  cargarConfiguracionColumnas,
  guardarConfiguracionColumnas
} from './data/config-store.js';
import { cargarFilasVecinos, guardarFilasVecinos } from './data/vecinos-store.js';
import { parseCookies, serializarCookie } from './utils/cookies.js';
import { crearSesion, eliminarSesion, obtenerSesion } from './utils/sessions.js';

const PORT = Number(process.env.PORT || 8787);
const COOKIE_NOMBRE = 'lomas_admin_session';
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'Lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production'
};

function responderJson(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);

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
});

server.listen(PORT, () => {
  console.log(`Servidor admin escuchando en http://localhost:${PORT}`);
});
