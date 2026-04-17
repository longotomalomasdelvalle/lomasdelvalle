import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { TODOS_LOS_MESES, VALOR_MES } from '../constants/pagos.js';
import {
  esFilaFantasma,
  formatearContactoEditable,
  formatearRutEditable,
  sanitizarValorCelda,
  validarContacto,
  validarRut
} from '../utils/adminRows.js';
import { crearVecino, limpiarNumero, normalizarTexto } from '../utils/pagos.js';

function formatearMonto(valor) {
  return `$${Number(valor || 0).toLocaleString('es-CL')}`;
}

function formatearPorcentaje(valor) {
  return `${Number(valor || 0).toFixed(1)}%`;
}

function normalizarMesVisible(mes) {
  const original = String(mes ?? '').trim();
  if (!original) return '';

  const clave = normalizarTexto(original);
  if (clave === 'sin pago') return 'Sin pago';

  if (clave === 'mayonesa' || clave === 'mayoneza' || clave === 'may0') {
    return 'MAYO';
  }

  const mesesCanonicos = new Set(TODOS_LOS_MESES);
  const enMayusculas = original.toUpperCase();
  if (mesesCanonicos.has(enMayusculas)) {
    return enMayusculas;
  }

  return enMayusculas;
}

const CAMPOS_BASE_DETALLE = [
  'NOMBRE DE PROPIETARIO',
  'RUT',
  'N-CONTACTO',
  'F/FIRMA',
  'OBSERVACION',
  'PARCELA',
  'SITIO',
  'ESTADO'
];

function obtenerEtiquetaDetalle(campo) {
  const campoNormalizado = String(campo ?? '').trim().toUpperCase().replace(/\s+/g, '');

  if (campoNormalizado === 'RODERA' || campoNormalizado === 'R' || campoNormalizado === 'RUT') return 'RUT';
  if (campoNormalizado === 'NOMBREDEPROPIETARIO') return 'Nombre';
  if (campoNormalizado === 'N-CONTACTO' || campoNormalizado === 'N_CONTACTO' || campoNormalizado === 'CONTACTO' || campoNormalizado === 'NUMERODECONTACTO') return 'Contacto';
  if (campoNormalizado === 'F/FIRMA' || campoNormalizado === 'FECHAFIRMA') return 'Fecha firma';
  if (campoNormalizado === 'OBSERVACION' || campoNormalizado === 'OBSERVACIONES') return 'Observacion';
  return campo;
}

function esCampoRutDetalle(campo) {
  const campoNormalizado = String(campo ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return campoNormalizado === 'RUT' || campoNormalizado === 'R' || campoNormalizado.includes('RODERA');
}

function esCampoContactoDetalle(campo) {
  const campoNormalizado = String(campo ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return (
    campoNormalizado === 'N-CONTACTO' ||
    campoNormalizado === 'N_CONTACTO' ||
    campoNormalizado === 'CONTACTO' ||
    campoNormalizado === 'NUMERODECONTACTO'
  );
}

function esCampoMonetarioDetalle(campo, columnasCuotaExtra = []) {
  return TODOS_LOS_MESES.includes(campo) || columnasCuotaExtra.includes(campo);
}

function formatearValorDetalle(campo, valor, columnasCuotaExtra = []) {
  if (valor === undefined || valor === null || valor === '') {
    return '-';
  }

  if (esCampoMonetarioDetalle(campo, columnasCuotaExtra)) {
    return formatearMonto(limpiarNumero(valor));
  }

  return String(valor);
}

function obtenerUltimoMesConPago(vecino) {
  const mesesConPago = vecino.mesesPagados.filter((item) => item.monto > 0);
  return mesesConPago.length > 0
    ? normalizarMesVisible(mesesConPago[mesesConPago.length - 1].mes)
    : 'Sin pago';
}

function obtenerAniosPlanilla(filas) {
  const anios = new Set();

  filas.forEach((fila) => {
    Object.keys(fila).forEach((columna) => {
      const match = String(columna).match(/^TOTAL\s+(\d{4})$/i);
      if (match?.[1]) {
        anios.add(match[1]);
      }
    });
  });

  if (anios.size === 0) {
    anios.add(String(new Date().getFullYear()));
  }

  return [...anios].sort((a, b) => Number(a) - Number(b));
}

function descargarExcelAnalitica(data) {
  const resumen = [
    ['Metrica', 'Valor'],
    ['Total recaudado', data.totalPagado],
    ['Total pendiente', data.totalPendiente],
    ['Total meses recaudado', data.totalPagadoMeses],
    ['Total cuotas extra recaudado', data.totalCuotasExtra],
    ['Total esperado meses', data.totalEsperadoMeses],
    ['Cumplimiento meses (%)', Number(data.porcentajeCumplimientoMeses.toFixed(2))],
    ['Vecinos pagados', data.vecinosPagados],
    ['Vecinos pendientes', data.vecinosPendientes],
    ['Vecinos sin pagos', data.vecinosSinPagos]
  ];

  const mensual = [
    ['Mes', 'Esperado', 'Pagado', 'Pendiente', 'Cumplimiento (%)', 'Vecinos con pago'],
    ...data.resumenMensual.map((m) => [
      m.mes,
      m.esperado,
      m.pagado,
      m.pendiente,
      Number(m.cumplimiento.toFixed(2)),
      m.conPago
    ])
  ];

  const vecinos = [
    [
      'Nombre',
      'Parcela',
      'Sitio',
      'Estado',
      'Total pagado',
      'Total pendiente',
      'Meses completos',
      'Meses con aporte',
      'Ultimo mes con pago'
    ],
    ...data.vecinosOrdenados.map((v) => [
      v.nombre,
      v.parcela,
      v.sitio,
      v.estado,
      v.totalPagado,
      v.totalPendiente,
      v.mesesCompletos,
      v.mesesConAporte,
      v.ultimoMesConPago
    ])
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(mensual), 'Mensual');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(vecinos), 'Vecinos');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `analitica-completa-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function IconoGrafico() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M3.75 15.833H16.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.25 15.833V10.833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 15.833V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.75 15.833V4.167" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoVer() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M2.5 10C3.9 6.9 6.7 5 10 5C13.3 5 16.1 6.9 17.5 10C16.1 13.1 13.3 15 10 15C6.7 15 3.9 13.1 2.5 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconoModificar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M4.2 13.9V15.8H6.1L14 7.9L12.1 6L4.2 13.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 6.6L13.4 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12.4 4.7L13.2 3.9C13.7 3.4 14.5 3.4 15 3.9L16.1 5C16.6 5.5 16.6 6.3 16.1 6.8L15.3 7.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconoCerrarRojo() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M6 6L14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 6L6 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconoOrdenDesc() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M6.25 4.167V15.833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3.75 13.333L6.25 15.833L8.75 13.333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.25 6.667H16.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.25 10H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.25 13.333H13.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function coincideNombreFlexible(nombreVecino, filtroNombre) {
  const termino = normalizarTexto(filtroNombre);
  if (!termino) {
    return true;
  }

  const tokensFiltro = termino.split(/\s+/).filter(Boolean);
  if (tokensFiltro.length === 0) {
    return true;
  }

  const tokensNombre = normalizarTexto(nombreVecino).split(/\s+/).filter(Boolean);
  return tokensFiltro.every((token) => tokensNombre.some((parte) => parte.includes(token)));
}

export default function AdminAnalytics({
  filas,
  configuracion,
  guardando = false,
  onReplaceRow,
  onSave,
  modo = 'completo'
}) {
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroNivelPago, setFiltroNivelPago] = useState('todos');
  const [filtroMes, setFiltroMes] = useState('TODOS');
  const [filtroAnio, setFiltroAnio] = useState('TODOS');
  const [busquedaNombre, setBusquedaNombre] = useState('');
  const [busquedaParcela, setBusquedaParcela] = useState('');
  const [busquedaSitio, setBusquedaSitio] = useState('');
  const [orden, setOrden] = useState('pagado_desc');
  const [pagina, setPagina] = useState(1);
  const [detalleAbierto, setDetalleAbierto] = useState(null);
  const [detalleFila, setDetalleFila] = useState(null);
  const [guardandoDetalle, setGuardandoDetalle] = useState(false);
  const [mensajeDetalle, setMensajeDetalle] = useState('');
  const [vistaContenido, setVistaContenido] = useState('tabla');

  const data = useMemo(() => {
    const filasValidasConIndice = filas
      .map((fila, indexOriginal) => ({ fila, indexOriginal }))
      .filter(({ fila }) => !esFilaFantasma(fila));
    const filasValidas = filasValidasConIndice.map(({ fila }) => fila);
    const aniosDisponibles = obtenerAniosPlanilla(filasValidas);
    const filasPorAnio = filasValidas;

    const vecinos = filasValidasConIndice.map(({ fila, indexOriginal }, indexVisible) => ({
      ...crearVecino(fila, indexVisible, configuracion),
      rowIndex: indexOriginal,
      filaOriginal: fila
    }));

    const totalPagado = vecinos.reduce((acc, vecino) => acc + vecino.totalPagado, 0);
    const totalPendiente = vecinos.reduce((acc, vecino) => acc + vecino.totalPendiente, 0);
    const totalPagadoMeses = vecinos.reduce((acc, vecino) => acc + vecino.totalPagadoMeses, 0);
    const totalCuotasExtra = vecinos.reduce(
      (acc, vecino) => acc + vecino.totalPagadoCuotasExtra,
      0
    );
    const totalEsperadoMeses =
      vecinos.length * TODOS_LOS_MESES.reduce((acc, mes) => acc + (VALOR_MES[mes] || 0), 0);

    const resumenMensual = TODOS_LOS_MESES.map((mes) => {
      const esperado = vecinos.length * (VALOR_MES[mes] || 0);
      const pagado = filasPorAnio.reduce((acc, fila) => acc + limpiarNumero(fila[mes]), 0);
      const pendiente = Math.max(esperado - pagado, 0);
      const conPago = filasPorAnio.filter((fila) => limpiarNumero(fila[mes]) > 0).length;
      const cumplimiento = esperado > 0 ? (pagado / esperado) * 100 : 0;

      return { mes, esperado, pagado, pendiente, cumplimiento, conPago };
    });

    const vecinosEnriquecidos = vecinos.map((vecino) => ({
      ...vecino,
      mesesCompletos: vecino.mesesPagados.filter(
        (item) => item.monto >= (item.montoEsperado || 0)
      ).length,
      mesesConAporte: vecino.mesesPagados.filter((item) => item.monto > 0).length,
      ultimoMesConPago: obtenerUltimoMesConPago(vecino)
    }));

    const vecinosOrdenados = [...vecinosEnriquecidos].sort((a, b) => b.totalPagado - a.totalPagado);

    return {
      vecinos: vecinosEnriquecidos,
      vecinosOrdenados,
      aniosDisponibles,
      totalPagado,
      totalPendiente,
      totalPagadoMeses,
      totalCuotasExtra,
      totalEsperadoMeses,
      porcentajeCumplimientoMeses:
        totalEsperadoMeses > 0 ? (totalPagadoMeses / totalEsperadoMeses) * 100 : 0,
      vecinosPagados: vecinos.filter((vecino) => vecino.estado === 'Pagado').length,
      vecinosPendientes: vecinos.filter((vecino) => vecino.estado !== 'Pagado').length,
      vecinosSinPagos: vecinos.filter((vecino) => vecino.totalPagado === 0).length,
      resumenMensual
    };
  }, [configuracion, filas]);

  const vecinosFiltrados = useMemo(() => {
    const filtroParcelaTexto = normalizarTexto(busquedaParcela);
    const filtroSitioTexto = normalizarTexto(busquedaSitio);
    const base = data.vecinos
      .map((vecino) => {
        const datoMes =
          filtroMes === 'TODOS'
            ? null
            : vecino.mesesPagados.find((item) => item.mes === filtroMes) || null;

        const esperadoMes = filtroMes === 'TODOS' ? 0 : VALOR_MES[filtroMes] || 0;
        const pagadoMes = datoMes?.monto || 0;
        const pendienteMes = Math.max(esperadoMes - pagadoMes, 0);
        const nivelPago =
          filtroMes === 'TODOS'
            ? vecino.totalPagadoMeses <= 0
              ? 'sin_pago'
              : vecino.totalPendienteMeses <= 0
                ? 'completo'
                : 'parcial'
            : pagadoMes <= 0
              ? 'sin_pago'
              : pagadoMes >= esperadoMes
                ? 'completo'
                : 'parcial';

        const estadoVisible = nivelPago === 'sin_pago' ? 'Pendiente' : 'Pagado';
        return { ...vecino, pagadoMes, pendienteMes, nivelPago, estadoVisible };
      })
      .filter((vecino) => {
        const coincideNombre = coincideNombreFlexible(vecino.nombre, busquedaNombre);
        const coincideParcela =
          !filtroParcelaTexto || normalizarTexto(vecino.parcela).includes(filtroParcelaTexto);
        const coincideSitio =
          !filtroSitioTexto || normalizarTexto(vecino.sitio).includes(filtroSitioTexto);

        const coincideNivelPago =
          filtroNivelPago === 'todos' ||
          (filtroNivelPago === 'pendiente'
            ? vecino.nivelPago === 'sin_pago'
            : filtroNivelPago === vecino.nivelPago);
        const coincideEstado =
          filtroEstado === 'todos' ||
          (filtroEstado === 'al_dia'
            ? vecino.estadoVisible === 'Pagado'
            : vecino.estadoVisible === 'Pendiente');

        return coincideNombre && coincideParcela && coincideSitio && coincideNivelPago && coincideEstado;
      });

    const sorted = [...base];
    if (orden === 'pagado_desc') sorted.sort((a, b) => b.totalPagado - a.totalPagado);
    if (orden === 'pagado_asc') sorted.sort((a, b) => a.totalPagado - b.totalPagado);
    if (orden === 'pendiente_desc') sorted.sort((a, b) => b.totalPendiente - a.totalPendiente);
    if (orden === 'pendiente_asc') sorted.sort((a, b) => a.totalPendiente - b.totalPendiente);
    if (orden === 'nombre_asc') sorted.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (orden === 'nombre_desc') sorted.sort((a, b) => b.nombre.localeCompare(a.nombre, 'es'));

    return sorted;
  }, [busquedaNombre, busquedaParcela, busquedaSitio, data.vecinos, filtroNivelPago, filtroEstado, orden, filtroMes]);

  const analiticaFiltrada = useMemo(() => {
    const totalVecinos = vecinosFiltrados.length;
    const totalCompletos = vecinosFiltrados.filter((v) => v.nivelPago === 'completo').length;
    const totalParciales = vecinosFiltrados.filter((v) => v.nivelPago === 'parcial').length;
    const totalSinPago = vecinosFiltrados.filter((v) => v.nivelPago === 'sin_pago').length;
    const totalAlDia = totalCompletos + totalParciales;
    const totalPendientes = totalSinPago;
    const totalPagado = vecinosFiltrados.reduce((acc, v) => acc + v.totalPagado, 0);
    const totalPendiente = vecinosFiltrados.reduce((acc, v) => acc + v.totalPendiente, 0);
    const totalCuotasExtra = vecinosFiltrados.reduce((acc, v) => acc + v.totalPagadoCuotasExtra, 0);
    const totalPendienteCuotasExtra = vecinosFiltrados.reduce(
      (acc, v) => acc + v.totalPendienteCuotasExtra,
      0
    );
    const totalPagadoMeses = vecinosFiltrados.reduce((acc, v) => acc + v.totalPagadoMeses, 0);
    const totalEsperadoMeses =
      totalVecinos * TODOS_LOS_MESES.reduce((acc, mes) => acc + (VALOR_MES[mes] || 0), 0);

    const resumenMensual = TODOS_LOS_MESES.map((mes) => {
      const esperado = totalVecinos * (VALOR_MES[mes] || 0);
      const pagado = vecinosFiltrados.reduce((acc, vecino) => {
        const datoMes = vecino.mesesPagados.find((item) => item.mes === mes);
        return acc + (datoMes?.monto || 0);
      }, 0);
      const pendiente = Math.max(esperado - pagado, 0);
      const conPago = vecinosFiltrados.filter((vecino) =>
        vecino.mesesPagados.some((item) => item.mes === mes && item.monto > 0)
      ).length;
      const cumplimiento = esperado > 0 ? (pagado / esperado) * 100 : 0;

      return { mes, esperado, pagado, pendiente, conPago, cumplimiento };
    });

    return {
      totalVecinos,
      totalVecinosSafe: Math.max(totalVecinos, 1),
      totalCompletos,
      totalParciales,
      totalAlDia,
      totalPendientes,
      totalSinPago,
      totalPagado,
      totalPendiente,
      totalCuotasExtra,
      totalPendienteCuotasExtra,
      porcentajeCumplimientoMeses:
        totalEsperadoMeses > 0 ? (totalPagadoMeses / totalEsperadoMeses) * 100 : 0,
      resumenMensual
    };
  }, [vecinosFiltrados]);

  const mensualMetricas = useMemo(
    () =>
      analiticaFiltrada.resumenMensual.map((item) => ({
        ...item,
        valor: item.pagado
      })),
    [analiticaFiltrada.resumenMensual]
  );

  const maxMetrica = Math.max(...mensualMetricas.map((m) => m.valor), 1);
  const completosPct =
    (analiticaFiltrada.totalCompletos / analiticaFiltrada.totalVecinosSafe) * 100;
  const parcialesPct =
    (analiticaFiltrada.totalParciales / analiticaFiltrada.totalVecinosSafe) * 100;
  const sinPagoPct = (analiticaFiltrada.totalSinPago / analiticaFiltrada.totalVecinosSafe) * 100;

  const tituloMetrica = 'Aportes mensuales';
  const vistaActiva = modo === 'completo' ? vistaContenido : modo;

  const FILAS_POR_PAGINA = 10;
  const totalPaginas = Math.max(1, Math.ceil(vecinosFiltrados.length / FILAS_POR_PAGINA));
  const paginaVisible = Math.min(pagina, totalPaginas);
  const inicio = (paginaVisible - 1) * FILAS_POR_PAGINA;
  const vecinosPagina = vecinosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  const resumenCabecera = useMemo(() => {
    const totalVecinos = vecinosFiltrados.length;
    const totalCompletos = vecinosFiltrados.filter((v) => v.nivelPago === 'completo').length;
    const totalParciales = vecinosFiltrados.filter((v) => v.nivelPago === 'parcial').length;
    const totalSinPago = vecinosFiltrados.filter((v) => v.nivelPago === 'sin_pago').length;
    const totalAlDia = totalCompletos + totalParciales;
    const totalPendientes = totalSinPago;
    const totalPagado = vecinosFiltrados.reduce((acc, v) => acc + v.totalPagado, 0);
    const totalPendiente = vecinosFiltrados.reduce((acc, v) => acc + v.totalPendiente, 0);
    const totalCuotasExtra = vecinosFiltrados.reduce((acc, v) => acc + v.totalPagadoCuotasExtra, 0);
    const totalPendienteCuotasExtra = vecinosFiltrados.reduce(
      (acc, v) => acc + v.totalPendienteCuotasExtra,
      0
    );
    const totalPagadoMeses = vecinosFiltrados.reduce((acc, v) => acc + v.totalPagadoMeses, 0);
    const totalEsperadoMeses =
      totalVecinos * TODOS_LOS_MESES.reduce((acc, mes) => acc + (VALOR_MES[mes] || 0), 0);

    return {
      totalVecinos,
      totalAlDia,
      totalParciales,
      totalPendientes,
      totalPagado,
      totalPendiente,
      totalCuotasExtra,
      totalPendienteCuotasExtra,
      porcentajeCumplimientoMeses:
        totalEsperadoMeses > 0 ? (totalPagadoMeses / totalEsperadoMeses) * 100 : 0
    };
  }, [vecinosFiltrados]);

  const columnasCuotaExtra = useMemo(
    () => configuracion?.cuotasExtra ?? [],
    [configuracion]
  );
  const columnasTransversales = useMemo(
    () => configuracion?.camposTransversales ?? [],
    [configuracion]
  );
  const columnasDetalle = useMemo(
    () => [
      ...new Set([
        ...CAMPOS_BASE_DETALLE,
        ...columnasTransversales,
        ...columnasCuotaExtra,
        ...TODOS_LOS_MESES
      ])
    ],
    [columnasCuotaExtra, columnasTransversales]
  );
  const hayFiltrosAplicados =
    filtroMes !== 'TODOS' ||
    filtroAnio !== 'TODOS' ||
    filtroEstado !== 'todos' ||
    filtroNivelPago !== 'todos' ||
    busquedaNombre.trim() !== '' ||
    busquedaParcela.trim() !== '' ||
    busquedaSitio.trim() !== '' ||
    orden !== 'pagado_desc';

  function abrirDetalle(vecino, modo) {
    const fila = vecino.filaOriginal || filas[vecino.rowIndex] || null;
    if (!fila) {
      return;
    }

    setDetalleAbierto({
      modo,
      rowIndex: vecino.rowIndex,
      nombre: vecino.nombre
    });
    setDetalleFila({ ...fila });
    setMensajeDetalle('');
  }

  function cerrarDetalle() {
    setDetalleAbierto(null);
    setDetalleFila(null);
    setMensajeDetalle('');
  }

  function activarEdicionDetalle() {
    setDetalleAbierto((actual) => {
      if (!actual) return actual;
      return { ...actual, modo: 'editar' };
    });
  }

  function actualizarDetalle(campo, valor) {
    const valorNormalizado = esCampoRutDetalle(campo)
      ? formatearRutEditable(valor)
      : esCampoContactoDetalle(campo)
        ? formatearContactoEditable(valor)
      : sanitizarValorCelda(campo, valor, columnasCuotaExtra);

    setDetalleFila((actual) => {
      if (!actual) return actual;

      // Guardamos en claves canonicas para evitar que alias heredados (RODERA/R)
      // pisen el valor al normalizar/guardar en backend.
      if (esCampoRutDetalle(campo)) {
        return {
          ...actual,
          RUT: valorNormalizado,
          R: '',
          RODERA: ''
        };
      }

      if (esCampoContactoDetalle(campo)) {
        return {
          ...actual,
          'N-CONTACTO': valorNormalizado,
          N_CONTACTO: '',
          CONTACTO: '',
          'NUMERO DE CONTACTO': ''
        };
      }

      return {
        ...actual,
        [campo]: valorNormalizado
      };
    });
  }

  async function guardarDetalleSocio() {
    if (!detalleAbierto || !detalleFila || !onReplaceRow) {
      return;
    }

    setGuardandoDetalle(true);
    setMensajeDetalle('');

    try {
      onReplaceRow(detalleAbierto.rowIndex, detalleFila);

      if (onSave) {
        const guardadoOk = await onSave('Socio actualizado con exito.');

        if (!guardadoOk) {
          setMensajeDetalle('No se pudo guardar. Revisa los datos e intenta nuevamente.');
          return;
        }
      }

      window.alert('Cambios guardados correctamente.');
      cerrarDetalle();
    } finally {
      setGuardandoDetalle(false);
    }
  }

  function limpiarFiltros() {
    setFiltroMes('TODOS');
    setFiltroAnio('TODOS');
    setFiltroEstado('todos');
    setFiltroNivelPago('todos');
    setBusquedaNombre('');
    setBusquedaParcela('');
    setBusquedaSitio('');
    setOrden('pagado_desc');
    setPagina(1);
  }

  return (
    <div className="bg-white rounded-[2rem] shadow-xl p-4 md:p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-slate-500">
            Analitica completa
          </p>
          <h3 className="text-lg md:text-xl font-semibold text-slate-900 mt-1">
            Analisis general de toda la planilla con graficos dinamicos
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {modo === 'completo' ? (
            <div className="rounded-xl bg-slate-100 p-1 flex gap-1">
              <button
                onClick={() => setVistaContenido('tabla')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  vistaContenido === 'tabla'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Grilla y totales
              </button>
              <button
                onClick={() => setVistaContenido('graficos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  vistaContenido === 'graficos'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Graficos
              </button>
            </div>
          ) : null}

          <button
            onClick={() => descargarExcelAnalitica({ ...data, vecinosOrdenados: vecinosFiltrados })}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 transition"
          >
            <IconoGrafico />
            Exportar analitica en Excel
          </button>
        </div>
      </div>

      {vistaActiva === 'tabla' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Total vecinos</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{resumenCabecera.totalVecinos}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Recaudado</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatearMonto(resumenCabecera.totalPagado)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                / {formatearMonto(resumenCabecera.totalPendiente)} faltante
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Cuotas extra</p>
              <p className="mt-1 text-lg font-bold text-amber-700">
                {formatearMonto(resumenCabecera.totalCuotasExtra)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                / {formatearMonto(resumenCabecera.totalPendienteCuotasExtra)} faltante
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Cumplimiento meses</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatearPorcentaje(resumenCabecera.porcentajeCumplimientoMeses)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Vecinos al dia</p>
              <p className="mt-1 text-lg font-bold text-emerald-700">{resumenCabecera.totalAlDia}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Vecinos parciales</p>
              <p className="mt-1 text-lg font-bold text-amber-700">{resumenCabecera.totalParciales}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Vecinos pendientes</p>
              <p className="mt-1 text-lg font-bold text-red-600">{resumenCabecera.totalPendientes}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">
              Buscar socio
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={busquedaNombre}
                onChange={(event) => {
                  setBusquedaNombre(event.target.value);
                  setPagina(1);
                }}
                placeholder="Nombre / Apellidos"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <input
                type="text"
                value={busquedaParcela}
                onChange={(event) => {
                  setBusquedaParcela(event.target.value);
                  setPagina(1);
                }}
                placeholder="Parcela"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <input
                type="text"
                value={busquedaSitio}
                onChange={(event) => {
                  setBusquedaSitio(event.target.value);
                  setPagina(1);
                }}
                placeholder="Sitio"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={limpiarFiltros}
              disabled={!hayFiltrosAplicados}
              className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition disabled:opacity-50"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2.5">
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">
              Estado
            </span>
            <select
              value={filtroEstado}
              onChange={(event) => {
                setFiltroEstado(event.target.value);
                setPagina(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="al_dia">Pagado (al dia)</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">
              Nivel de pago
            </span>
            <select
              value={filtroNivelPago}
              onChange={(event) => {
                setFiltroNivelPago(event.target.value);
                setPagina(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="completo">Completo</option>
              <option value="parcial">Parcial</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">
              Mes
            </span>
            <select
              value={filtroMes}
              onChange={(event) => {
                setFiltroMes(event.target.value);
                setPagina(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="TODOS">Todos</option>
              {TODOS_LOS_MESES.map((mes) => (
                <option key={mes} value={mes}>
                  {mes}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">
              Año
            </span>
            <select
              value={filtroAnio}
              onChange={(event) => {
                setFiltroAnio(event.target.value);
                setPagina(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="TODOS">Todos</option>
              {data.aniosDisponibles.map((anio) => (
                <option key={anio} value={anio}>
                  {anio}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 inline-flex items-center gap-1">
              <IconoOrdenDesc />
              Orden
            </span>
            <select
              value={orden}
              onChange={(event) => {
                setOrden(event.target.value);
                setPagina(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="pagado_desc">Mayor pagado</option>
              <option value="pagado_asc">Menor pagado</option>
              <option value="nombre_asc">Nombre A-Z</option>
              <option value="nombre_desc">Nombre Z-A</option>
            </select>
          </label>
        </div>

        <div className="text-xs text-slate-500">
          Filtro activo: {filtroEstado === 'todos' ? 'Todos los estados' : filtroEstado === 'al_dia' ? 'Pagado (al dia)' : 'Pendiente'} |{' '}
          {filtroNivelPago === 'todos' ? 'Todos los niveles' : filtroNivelPago === 'pendiente' ? 'Nivel: Pendiente' : `Nivel: ${filtroNivelPago}`} |{' '}
          {filtroMes === 'TODOS' ? 'Todos los meses' : filtroMes} |{' '}
          {filtroAnio === 'TODOS' ? 'Todos los anios' : filtroAnio}
        </div>

        <div className="text-xs text-slate-500">
          Mostrando {vecinosPagina.length} de {vecinosFiltrados.length} vecinos filtrados
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table
            className={`w-full table-fixed text-xs md:text-sm ${
              filtroMes !== 'TODOS' ? 'min-w-[1180px]' : 'min-w-0'
            }`}
          >
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-center w-[30%]">Vecino</th>
                <th className="px-3 py-2 text-center w-[9%]">Parcela / Sitio</th>
                <th className="px-3 py-2 text-center w-[7%]">Estado</th>
                <th className="px-3 py-2 text-center w-[8%]">Nivel pago</th>
                <th className="px-3 py-2 text-center w-[8%]">Pagado</th>
                <th className="px-3 py-2 text-center w-[8%]">Pendiente</th>
                {filtroMes !== 'TODOS' ? (
                  <>
                    <th className="px-3 py-2 text-center w-[9%]">{`Pagado ${filtroMes}`}</th>
                    <th className="px-3 py-2 text-center w-[9%]">{`Pendiente ${filtroMes}`}</th>
                  </>
                ) : null}
                <th className="px-3 py-2 text-center w-[9%]">Meses completos</th>
                <th className="px-3 py-2 text-center w-[8%]">Ultimo pago</th>
                <th className="px-3 py-2 text-center whitespace-nowrap w-[13%]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vecinosPagina.map((vecino) => (
                <tr key={vecino.id} className="border-t border-slate-200">
                  <td
                    className="px-3 py-2 text-slate-900 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] md:max-w-[280px] xl:max-w-[360px]"
                    title={vecino.nombre}
                  >
                    {vecino.nombre}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    P{vecino.parcela} / S{vecino.sitio}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                        vecino.estadoVisible === 'Pagado'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {vecino.estadoVisible}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                        vecino.nivelPago === 'completo'
                          ? 'bg-emerald-100 text-emerald-700'
                          : vecino.nivelPago === 'parcial'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {vecino.nivelPago === 'completo'
                        ? 'Completo'
                        : vecino.nivelPago === 'parcial'
                          ? 'Parcial'
                          : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-700 font-semibold">
                    {formatearMonto(vecino.totalPagado)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-600 font-semibold">
                    {formatearMonto(vecino.totalPendiente)}
                  </td>
                  {filtroMes !== 'TODOS' ? (
                    <>
                      <td className="px-3 py-2 text-right text-emerald-700 font-semibold">
                        {formatearMonto(vecino.pagadoMes)}
                      </td>
                      <td className="px-3 py-2 text-right text-red-600 font-semibold">
                        {formatearMonto(vecino.pendienteMes)}
                      </td>
                    </>
                  ) : null}
                  <td className="px-3 py-2 text-right text-slate-700">
                    {vecino.mesesCompletos} / {TODOS_LOS_MESES.length}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{normalizarMesVisible(vecino.ultimoMesConPago)}</td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center justify-center gap-2 flex-nowrap whitespace-nowrap">
                      <button
                        onClick={() => abrirDetalle(vecino, 'ver')}
                        title="Ver detalle"
                        translate="no"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 transition whitespace-nowrap shrink-0"
                      >
                        <IconoVer />
                        <span className="notranslate">Ver</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {vecinosPagina.length === 0 ? (
                <tr>
                  <td
                    colSpan={filtroMes !== 'TODOS' ? 11 : 9}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    No hay vecinos para ese filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-500">
            Pagina {paginaVisible} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
              disabled={paginaVisible === 1}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
              disabled={paginaVisible === totalPaginas}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.9fr] gap-4">
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-900">{tituloMetrica}</p>

            <div className="space-y-2">
              {mensualMetricas.map((mes) => (
                <div key={mes.mes} className="grid grid-cols-[96px_1fr_92px] items-center gap-3">
                  <span className="text-xs font-medium text-slate-600">{normalizarMesVisible(mes.mes)}</span>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max((mes.valor / maxMetrica) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-600 text-right">
                    {formatearMonto(mes.valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Distribucion por nivel de pago</p>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="h-28 w-28 rounded-full border border-slate-200 shrink-0"
                style={{
                  background: `conic-gradient(
                    #10b981 0 ${completosPct}%,
                    #f59e0b ${completosPct}% ${Math.min(completosPct + parcialesPct, 100)}%,
                    #94a3b8 ${Math.min(completosPct + parcialesPct, 100)}% 100%
                  )`
                }}
              />
              <div className="space-y-2 text-sm">
                <p className="text-slate-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 mr-2" />
                  Completos: {analiticaFiltrada.totalCompletos} ({formatearPorcentaje(completosPct)})
                </p>
                <p className="text-slate-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 mr-2" />
                  Parciales: {analiticaFiltrada.totalParciales} ({formatearPorcentaje(parcialesPct)})
                </p>
                <p className="text-slate-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400 mr-2" />
                  Sin pagos: {analiticaFiltrada.totalSinPago} ({formatearPorcentaje(sinPagoPct)})
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {detalleAbierto && detalleFila ? (
        <div className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[1px] p-3 md:p-6 flex items-center justify-center">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
            <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-slate-200 px-4 md:px-6 py-4">
              <div className="min-w-[80px]">
                {detalleAbierto.modo === 'ver' ? (
                  <button
                    onClick={activarEdicionDetalle}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
                  >
                    <IconoModificar />
                    Editar
                  </button>
                ) : null}
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-slate-500">
                  {detalleAbierto.modo === 'ver' ? 'Detalle del socio' : 'Edicion del socio'}
                </p>
                <h4 className="text-base md:text-lg font-semibold text-slate-900 mt-1">
                  {detalleAbierto.nombre}
                </h4>
              </div>
              <button
                onClick={cerrarDetalle}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-100 text-red-700 px-3 py-2 text-xs font-semibold hover:bg-red-200 transition"
              >
                <IconoCerrarRojo />
                Cerrar
              </button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto px-4 md:px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {columnasDetalle.map((campo) => (
                  <label key={campo} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">
                      {obtenerEtiquetaDetalle(campo)}
                    </p>
                    {detalleAbierto.modo === 'ver' ? (
                      <p className="mt-1 text-sm font-medium text-slate-900 break-words">
                        {formatearValorDetalle(campo, detalleFila[campo], columnasCuotaExtra)}
                      </p>
                    ) : (
                      <>
                        <input
                          type={campo === 'F/FIRMA' ? 'date' : 'text'}
                          value={detalleFila[campo] ?? ''}
                          onChange={(event) => actualizarDetalle(campo, event.target.value)}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${
                            (esCampoRutDetalle(campo) && !validarRut(detalleFila[campo]).valido) ||
                            (esCampoContactoDetalle(campo) && !validarContacto(detalleFila[campo]).valido)
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : 'border-slate-300'
                          }`}
                          inputMode={
                            campo === 'PARCELA' || campo === 'SITIO' || esCampoMonetarioDetalle(campo, columnasCuotaExtra)
                              ? 'numeric'
                              : 'text'
                          }
                        />
                        {esCampoRutDetalle(campo) && !validarRut(detalleFila[campo]).valido ? (
                          <span className="mt-1 block text-[11px] text-red-600">
                            {validarRut(detalleFila[campo]).sugerencia}
                          </span>
                        ) : null}
                        {esCampoContactoDetalle(campo) && !validarContacto(detalleFila[campo]).valido ? (
                          <span className="mt-1 block text-[11px] text-red-600">
                            {validarContacto(detalleFila[campo]).sugerencia}
                          </span>
                        ) : null}
                      </>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {detalleAbierto.modo === 'editar' ? (
              <div className="border-t border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Modifica los campos necesarios y guarda para actualizar la planilla.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={cerrarDetalle}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarDetalleSocio}
                    disabled={guardandoDetalle || guardando}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {guardandoDetalle || guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            ) : null}

            {mensajeDetalle ? (
              <div className="px-4 md:px-6 pb-4">
                <p className="text-xs text-red-600">{mensajeDetalle}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

