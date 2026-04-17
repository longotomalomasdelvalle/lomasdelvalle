import { CAMPOS_CORTA_FUEGO, TODOS_LOS_MESES, VALOR_MES } from '../constants/pagos.js';
import {
  COLUMNA_CUOTA_EXTRA_POR_DEFECTO,
  CONFIGURACION_COLUMNAS_POR_DEFECTO,
  normalizarConfiguracionColumnas,
  normalizarNombreColumna
} from './columnas.js';

const VALOR_CORTA_FUEGO = 10000;
const INDICE_MES = TODOS_LOS_MESES.reduce((mapa, mes, index) => {
  mapa[mes] = index;
  return mapa;
}, {});
const ALIAS_MESES = {
  MAYO: ['MAYONESA', 'MAY0']
};

export function obtenerValorCampo(fila, campos = []) {
  return campos
    .map((campo) => fila[campo])
    .find((valor) => valor !== undefined && valor !== null && String(valor).trim() !== '');
}

export function limpiarNumero(valor) {
  if (!valor) return 0;

  return (
    Number(
      String(valor).replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '').trim()
    ) || 0
  );
}

export function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizarNombrePropietario(nombre) {
  const limpio = String(nombre ?? '').trim().replace(/\s+/g, ' ');
  if (!limpio) {
    return '';
  }

  const tokens = limpio.split(' ').filter(Boolean);
  const tokensMayus = tokens.map((token) =>
    normalizarTexto(token).replace(/[^a-z0-9]/g, '').toUpperCase()
  );
  const deIndexes = tokensMayus
    .map((token, index) => (token === 'DE' ? index : -1))
    .filter((index) => index >= 0);

  const estructuraInversaSimple =
    deIndexes.length >= 2 &&
    deIndexes[0] === 1 &&
    deIndexes[1] === 3 &&
    tokens.length >= 6 &&
    tokens.length <= 8;

  if (estructuraInversaSimple) {
    const apellido1 = tokens[0];
    const apellido2 = tokens[2];
    const nombres = tokens.slice(4).reverse();
    return [...nombres, apellido2, apellido1].join(' ').replace(/\s+/g, ' ').trim();
  }

  const partesDe = limpio.split(/\s+DE\s+/i).map((parte) => parte.trim()).filter(Boolean);
  const pareceInversionConDe =
    partesDe.length === 3 &&
    !partesDe[0].includes(' ') &&
    !partesDe[1].includes(' ') &&
    partesDe[2].split(' ').length >= 2 &&
    partesDe[2].split(' ').length <= 3;

  if (!pareceInversionConDe) {
    return limpio;
  }

  const nombres = partesDe[2].split(' ').reverse().join(' ');
  return `${nombres} ${partesDe[1]} ${partesDe[0]}`.replace(/\s+/g, ' ').trim();
}

export function obtenerParcelaYSitio(fila) {
  const codigo = String(fila['PARC/ST'] || fila.SITIO || fila.PARCELA || '')
    .trim()
    .toUpperCase();

  let parcela = '-';
  let sitio = '-';

  const partes = codigo.match(/(\d+)?ST(\d+)/);

  if (partes) {
    parcela = partes[1] || '-';
    sitio = partes[2] || '-';
  } else if (codigo.includes('ST')) {
    sitio = codigo.replace(/[^0-9]/g, '') || '-';
  } else {
    parcela = codigo.replace(/[^0-9]/g, '') || '-';
  }

  return { parcela, sitio };
}

export function obtenerCortaFuego(fila) {
  const valor = obtenerValorCampo(fila, CAMPOS_CORTA_FUEGO);

  return limpiarNumero(valor);
}

export function obtenerCuotasExtra(fila, configuracion = CONFIGURACION_COLUMNAS_POR_DEFECTO) {
  const extras = [];
  const configuracionNormalizada = normalizarConfiguracionColumnas(configuracion, [fila]);
  const cuotasConfiguradas = configuracionNormalizada.cuotasExtra.map(normalizarNombreColumna);

  cuotasConfiguradas.forEach((columna) => {
    const valor =
      columna === COLUMNA_CUOTA_EXTRA_POR_DEFECTO
        ? obtenerValorCampo(fila, [COLUMNA_CUOTA_EXTRA_POR_DEFECTO, ...CAMPOS_CORTA_FUEGO])
        : fila[columna];
    const montoPagado = limpiarNumero(valor);
    const montoEsperado =
      columna === COLUMNA_CUOTA_EXTRA_POR_DEFECTO ? VALOR_CORTA_FUEGO : montoPagado;
    const montoPendiente = Math.max(montoEsperado - montoPagado, 0);

    if (montoPagado > 0 || montoPendiente > 0) {
      extras.push({
        nombre: columna,
        montoPagado,
        montoEsperado,
        montoPendiente,
        incompleta: montoPendiente > 0
      });
    }
  });

  return extras;
}

export function obtenerMesesPagados(fila) {
  return TODOS_LOS_MESES.filter((mes) => {
    const valor = obtenerValorCampo(fila, [mes, ...(ALIAS_MESES[mes] || [])]);
    return valor && String(valor).trim() !== '';
  }).map((mes) => {
    const monto = limpiarNumero(obtenerValorCampo(fila, [mes, ...(ALIAS_MESES[mes] || [])]));
    const montoEsperado = VALOR_MES[mes] || 0;

    return {
      mes,
      monto,
      montoEsperado,
      incompleto: monto < montoEsperado
    };
  });
}

export function crearVecino(fila, index, configuracion = CONFIGURACION_COLUMNAS_POR_DEFECTO) {
  const { parcela, sitio } = obtenerParcelaYSitio(fila);
  const mesesPagados = obtenerMesesPagados(fila);
  const mapaMesesPagados = new Map(mesesPagados.map((item) => [item.mes, item]));
  const mesesPendientes = TODOS_LOS_MESES.map((mes) => {
    const pago = mapaMesesPagados.get(mes);
    const montoEsperado = VALOR_MES[mes] || 0;
    const montoPagado = pago?.monto || 0;
    const montoPendiente = Math.max(montoEsperado - montoPagado, 0);

    if (montoPendiente <= 0) {
      return null;
    }

    return {
      mes,
      montoPagado,
      montoEsperado,
      montoPendiente,
      incompleto: montoPagado > 0 && montoPagado < montoEsperado
    };
  }).filter(Boolean);

  const totalPagadoMeses = mesesPagados.reduce((total, item) => total + item.monto, 0);
  const totalPendienteMeses = mesesPendientes.reduce(
    (total, item) => total + item.montoPendiente,
    0
  );

  const cuotasExtra = obtenerCuotasExtra(fila, configuracion);
  const totalPagadoCuotasExtra = cuotasExtra.reduce((total, item) => total + item.montoPagado, 0);
  const totalPendienteCuotasExtra = cuotasExtra.reduce(
    (total, item) => total + item.montoPendiente,
    0
  );
  const mesActualIndex = new Date().getMonth();
  const tienePendientesHastaMesActual = mesesPendientes.some(
    (item) => (INDICE_MES[item.mes] ?? 12) <= mesActualIndex
  );
  const estadoCalculado = tienePendientesHastaMesActual ? 'Pendiente' : 'Pagado';

  const nombreBase = String(
    fila['NOMBRE DE PROPIETARIO'] || fila.PROPIETARIO || `Vecino ${index + 1}`
  ).trim();

  return {
    id: index + 1,
    nombre: normalizarNombrePropietario(nombreBase),
    rut: String(obtenerValorCampo(fila, ['RUT', 'R']) ?? '').trim(),
    contacto: String(
      obtenerValorCampo(fila, ['N-CONTACTO', 'N_CONTACTO', 'NUMERO DE CONTACTO', 'CONTACTO']) ?? ''
    ).trim(),
    fechaFirma: String(obtenerValorCampo(fila, ['F/FIRMA', 'FECHA FIRMA']) ?? '').trim(),
    observaciones: String(obtenerValorCampo(fila, ['OBSERVACION', 'OBSERVACIONES']) ?? '').trim(),
    parcela,
    sitio,
    estado: estadoCalculado,
    estadoManual: fila.ESTADO || '',
    mesesPagados,
    mesesPendientes,
    totalPagado: totalPagadoMeses + totalPagadoCuotasExtra,
    totalPagadoMeses,
    totalPagadoCuotasExtra,
    totalPendiente: totalPendienteMeses + totalPendienteCuotasExtra,
    totalPendienteMeses,
    totalPendienteCuotasExtra,
    cuotasExtra
  };
}
