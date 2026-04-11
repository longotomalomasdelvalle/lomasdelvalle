import { CAMPOS_CORTA_FUEGO, TODOS_LOS_MESES, VALOR_MES } from '../constants/pagos.js';
import {
  COLUMNA_CUOTA_EXTRA_POR_DEFECTO,
  CONFIGURACION_COLUMNAS_POR_DEFECTO,
  normalizarConfiguracionColumnas,
  normalizarNombreColumna
} from './columnas.js';

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
    const monto = limpiarNumero(valor);

    if (monto > 0) {
      extras.push({
        nombre: columna,
        monto
      });
    }
  });

  return extras;
}

export function obtenerMesesPagados(fila) {
  return TODOS_LOS_MESES.filter((mes) => {
    const valor = fila[mes];
    return valor && String(valor).trim() !== '';
  }).map((mes) => {
    const monto = limpiarNumero(fila[mes]);
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
  const mesesPendientes = TODOS_LOS_MESES.filter(
    (mes) => !mesesPagados.some((item) => item.mes === mes)
  );

  const totalPagado = mesesPagados.reduce((total, item) => total + item.monto, 0);
  const diferenciaMeses = mesesPagados.reduce((total, item) => {
    const faltante = item.montoEsperado - item.monto;
    return total + (faltante > 0 ? faltante : 0);
  }, 0);

  const totalPendienteMeses =
    mesesPendientes.reduce((total, mes) => total + (VALOR_MES[mes] || 0), 0) +
    diferenciaMeses;

  const cuotasExtra = obtenerCuotasExtra(fila, configuracion);
  const totalCuotasExtra = cuotasExtra.reduce((total, item) => total + item.monto, 0);

  return {
    id: index + 1,
    nombre:
      fila['NOMBRE DE PROPIETARIO'] || fila.PROPIETARIO || `Vecino ${index + 1}`,
    rut: String(obtenerValorCampo(fila, ['RUT', 'R']) ?? '').trim(),
    contacto: String(
      obtenerValorCampo(fila, ['N-CONTACTO', 'N_CONTACTO', 'NUMERO DE CONTACTO', 'CONTACTO']) ?? ''
    ).trim(),
    fechaFirma: String(obtenerValorCampo(fila, ['F/FIRMA', 'FECHA FIRMA']) ?? '').trim(),
    observaciones: String(obtenerValorCampo(fila, ['OBSERVACION', 'OBSERVACIONES']) ?? '').trim(),
    parcela,
    sitio,
    estado: fila.ESTADO || 'Pendiente',
    mesesPagados,
    mesesPendientes,
    totalPagado,
    totalPendiente: totalPendienteMeses + totalCuotasExtra,
    cuotasExtra
  };
}
