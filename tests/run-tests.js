import assert from 'node:assert/strict';
import { parseCookies, serializarCookie } from '../server/utils/cookies.js';
import { crearHashPassword, verificarPassword } from '../server/utils/password.js';
import {
  crearFilaEditable,
  formatearContactoEditable,
  formatearRutEditable,
  normalizarFilaEditable,
  validarContacto,
  validarRut
} from '../src/utils/adminRows.js';
import { normalizarConfiguracionColumnas } from '../src/utils/columnas.js';
import { filtrarVecinos } from '../src/utils/filtros.js';
import {
  crearVecino,
  limpiarNumero,
  normalizarTexto,
  obtenerParcelaYSitio
} from '../src/utils/pagos.js';

function runTest(nombre, fn) {
  try {
    fn();
    console.log(`OK: ${nombre}`);
  } catch (error) {
    console.error(`ERROR: ${nombre}`);
    throw error;
  }
}

runTest('limpiarNumero convierte texto monetario a numero', () => {
  assert.equal(limpiarNumero('$10.500'), 10500);
  assert.equal(limpiarNumero('8,000'), 8000);
  assert.equal(limpiarNumero(''), 0);
});

runTest('normalizarTexto elimina tildes y espacios sobrantes', () => {
  assert.equal(normalizarTexto('  Pérez González '), 'perez gonzalez');
});

runTest('obtenerParcelaYSitio separa correctamente codigo parcela/sitio', () => {
  assert.deepEqual(obtenerParcelaYSitio({ 'PARC/ST': '12ST8' }), {
    parcela: '12',
    sitio: '8'
  });
});

runTest('crearVecino calcula totales y solo suma cuotas extra configuradas', () => {
  const vecino = crearVecino(
    {
      'NOMBRE DE PROPIETARIO': 'Juan Perez',
      'PARC/ST': '5ST6',
      R: '12.345.678-9',
      'N-CONTACTO': '987000111',
      'F/FIRMA': '24-11-2022',
      OBSERVACION: 'Vecino con observacion',
      ENERO: '$10.000',
      FEBRERO: '$8.000',
      'CORTA FUEGO': '$3.000',
      MULTA: '$2.000',
      ESTADO: 'Pendiente'
    },
    0,
    {
      cuotasExtra: ['CORTA FUEGO'],
      camposTransversales: ['MULTA']
    }
  );

  assert.equal(vecino.nombre, 'Juan Perez');
  assert.equal(vecino.parcela, '5');
  assert.equal(vecino.sitio, '6');
  assert.equal(vecino.rut, '12.345.678-9');
  assert.equal(vecino.contacto, '987000111');
  assert.equal(vecino.fechaFirma, '24-11-2022');
  assert.equal(vecino.observaciones, 'Vecino con observacion');
  assert.equal(vecino.totalPagado, 18000);
  assert.equal(vecino.cuotasExtra.length, 1);
  assert.equal(vecino.cuotasExtra[0].monto, 3000);
  assert.equal(vecino.totalPendiente, 79000);
  assert.equal(vecino.mesesPagados[1].incompleto, true);
  assert.ok(vecino.mesesPendientes.includes('MARZO'));
});

runTest('normalizarConfiguracionColumnas manda columnas desconocidas a campos transversales', () => {
  const configuracion = normalizarConfiguracionColumnas(
    { cuotasExtra: ['CORTA FUEGO'] },
    [{ 'CORTA FUEGO': '10000', 'N-CONTACTO': '999', MULTA: '2500' }]
  );

  assert.deepEqual(configuracion.cuotasExtra, ['CORTA FUEGO']);
  assert.deepEqual(configuracion.camposTransversales, ['MULTA']);
});

runTest('filtrarVecinos indica cuando no hay filtros activos', () => {
  const vecinos = [
    { id: 1, nombre: 'Juan Perez Gonzalez', parcela: '5', sitio: '6' },
    { id: 2, nombre: 'Maria Lopez', parcela: '7', sitio: '2' }
  ];

  const resultado = filtrarVecinos(vecinos, {
    filtroParcela: '',
    filtroSitio: '',
    filtroNombre: ''
  });

  assert.equal(resultado.hayFiltrosActivos, false);
  assert.deepEqual(resultado.vecinosFiltrados, []);
});

runTest('filtrarVecinos encuentra por nombre ignorando tildes', () => {
  const vecinos = [
    { id: 1, nombre: 'Juan Perez Gonzalez', parcela: '5', sitio: '6' },
    { id: 2, nombre: 'Maria Lopez', parcela: '7', sitio: '2' }
  ];

  const resultado = filtrarVecinos(vecinos, {
    filtroParcela: '',
    filtroSitio: '',
    filtroNombre: 'Pérez'
  });

  assert.equal(resultado.hayFiltrosActivos, true);
  assert.equal(resultado.vecinosFiltrados.length, 1);
  assert.equal(resultado.vecinosFiltrados[0].id, 1);
});

runTest('filtrarVecinos combina nombre, parcela y sitio', () => {
  const vecinos = [
    { id: 1, nombre: 'Juan Perez Gonzalez', parcela: '5', sitio: '6' },
    { id: 2, nombre: 'Maria Lopez', parcela: '7', sitio: '2' }
  ];

  const resultado = filtrarVecinos(vecinos, {
    filtroParcela: '5',
    filtroSitio: '6',
    filtroNombre: 'juan gonzalez'
  });

  assert.equal(resultado.vecinosFiltrados.length, 1);
  assert.equal(resultado.vecinosFiltrados[0].id, 1);
});

runTest('serializarCookie y parseCookies mantienen el valor', () => {
  const cookie = serializarCookie('session', 'abc123', {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 10
  });

  const cookies = parseCookies(cookie);
  assert.equal(cookies.session, 'abc123');
});

runTest('verificarPassword acepta hash scrypt generado', () => {
  const hash = crearHashPassword('clave-segura');
  assert.equal(verificarPassword('clave-segura', hash), true);
  assert.equal(verificarPassword('otra-clave', hash), false);
});

runTest('crearFilaEditable genera la estructura base editable', () => {
  const fila = crearFilaEditable();
  assert.equal(fila['NOMBRE DE PROPIETARIO'], '');
  assert.equal(fila.PARCELA, '');
  assert.equal(fila.SITIO, '');
  assert.equal(fila.RUT, '');
  assert.equal(fila['N-CONTACTO'], '');
  assert.equal(fila['F/FIRMA'], '');
  assert.equal(fila.OBSERVACION, '');
  assert.equal(fila.ESTADO, 'Pendiente');
  assert.equal(fila.ENERO, '');
});

runTest('normalizarFilaEditable completa campos faltantes', () => {
  const fila = normalizarFilaEditable({
    'NOMBRE DE PROPIETARIO': 'Ana'
  });

  assert.equal(fila['NOMBRE DE PROPIETARIO'], 'Ana');
  assert.equal(fila.PARCELA, '-');
  assert.equal(fila.SITIO, '-');
  assert.equal(fila.RUT, '');
  assert.equal(fila.DICIEMBRE, '');
});

runTest('normalizarFilaEditable separa PARC/ST en parcela y sitio', () => {
  const fila = normalizarFilaEditable({
    'PARC/ST': '7ST3'
  });

  assert.equal(fila.PARCELA, '7');
  assert.equal(fila.SITIO, '3');
});

runTest('formatearRutEditable aplica formato chileno', () => {
  assert.equal(formatearRutEditable('255443976'), '25.544.397-6');
});

runTest('validarRut detecta digito verificador incorrecto', () => {
  assert.equal(validarRut('25.544.397-5').valido, false);
  assert.equal(validarRut('25.544.397-6').valido, true);
});

runTest('formatearContactoEditable aplica formato legible', () => {
  assert.equal(formatearContactoEditable('987654321'), '9 8765 4321');
  assert.equal(formatearContactoEditable('56987654321'), '+56 9 8765 4321');
});

runTest('validarContacto revisa largo de contacto chileno', () => {
  assert.equal(validarContacto('12345').valido, false);
  assert.equal(validarContacto('9 8765 4321').valido, true);
});

runTest('serializarCookie incluye atributos relevantes', () => {
  const cookie = serializarCookie('token', '123', {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60
  });

  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('SameSite=Lax'));
  assert.ok(cookie.includes('Path=/'));
  assert.ok(cookie.includes('Max-Age=60'));
});

console.log('Todas las pruebas pasaron.');
