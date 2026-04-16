import { useMemo } from 'react';
import { TODOS_LOS_MESES } from '../constants/pagos.js';
import { esFilaFantasma } from '../utils/adminRows.js';
import { crearVecino, limpiarNumero } from '../utils/pagos.js';

function formatearMonto(valor) {
  return `$${Number(valor || 0).toLocaleString('es-CL')}`;
}

function obtenerNombreParcela(vecino) {
  return `Parcela ${vecino.parcela} Sitio ${vecino.sitio}`;
}

export default function EstadisticasAdmin({ filas, configuracion }) {
  const estadisticas = useMemo(() => {
    const filasValidas = filas.filter((fila) => !esFilaFantasma(fila));
    const vecinos = filasValidas.map((fila, index) => crearVecino(fila, index, configuracion));
    const totalPagado = vecinos.reduce((acc, vecino) => acc + vecino.totalPagado, 0);
    const totalPendiente = vecinos.reduce((acc, vecino) => acc + vecino.totalPendiente, 0);
    const totalCuotasExtra = vecinos.reduce((acc, vecino) => acc + vecino.totalPagadoCuotasExtra, 0);

    const resumenMensual = TODOS_LOS_MESES.map((mes) => {
      const pagado = filasValidas.reduce((acc, fila) => acc + limpiarNumero(fila[mes]), 0);
      const conPago = filasValidas.filter((fila) => limpiarNumero(fila[mes]) > 0).length;

      return { mes, pagado, conPago };
    });

    const rankingPagado = [...vecinos]
      .sort((a, b) => b.totalPagado - a.totalPagado)
      .slice(0, 5);

    const rankingPendiente = [...vecinos]
      .sort((a, b) => b.totalPendiente - a.totalPendiente)
      .slice(0, 5);

    const parcelasConAportes = [...vecinos]
      .reduce((acc, vecino) => {
        const clave = vecino.parcela || '-';
        const actual = acc.get(clave) || { parcela: clave, pagado: 0, pendiente: 0, vecinos: 0 };
        actual.pagado += vecino.totalPagado;
        actual.pendiente += vecino.totalPendiente;
        actual.vecinos += 1;
        acc.set(clave, actual);
        return acc;
      }, new Map())
      .values();

    const rankingParcelas = [...parcelasConAportes]
      .sort((a, b) => b.pagado - a.pagado)
      .slice(0, 5);

    return {
      totalPagado,
      totalPendiente,
      totalCuotasExtra,
      vecinosPagados: vecinos.filter((vecino) => vecino.estado === 'Pagado').length,
      vecinosPendientes: vecinos.filter((vecino) => vecino.estado !== 'Pagado').length,
      resumenMensual,
      rankingPagado,
      rankingPendiente,
      rankingParcelas
    };
  }, [configuracion, filas]);

  return (
    <div className="bg-white rounded-[2rem] shadow-xl p-4 md:p-6 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Dashboard General
        </p>
        <p className="mt-1 text-sm md:text-base font-semibold text-slate-900">
          Resumen del estado de cobros y aportes
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Total pagado</p>
            <p className="mt-2 text-lg font-bold text-emerald-700">
              {formatearMonto(estadisticas.totalPagado)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Total pendiente</p>
            <p className="mt-2 text-lg font-bold text-red-600">
              {formatearMonto(estadisticas.totalPendiente)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Cuotas extra</p>
            <p className="mt-2 text-lg font-bold text-amber-700">
              {formatearMonto(estadisticas.totalCuotasExtra)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Socios al dia</p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {estadisticas.vecinosPagados}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Socios pendientes</p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {estadisticas.vecinosPendientes}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Top aportes</p>
            <div className="mt-3 space-y-2">
              {estadisticas.rankingPagado.map((vecino) => (
                <div
                  key={`pagado-${vecino.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{vecino.nombre}</p>
                    <p className="text-[11px] text-slate-500">{obtenerNombreParcela(vecino)}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700">
                    {formatearMonto(vecino.totalPagado)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Mas pendientes</p>
            <div className="mt-3 space-y-2">
              {estadisticas.rankingPendiente.map((vecino) => (
                <div
                  key={`pendiente-${vecino.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{vecino.nombre}</p>
                    <p className="text-[11px] text-slate-500">{obtenerNombreParcela(vecino)}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600">
                    {formatearMonto(vecino.totalPendiente)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Parcelas con mas aportes</p>
            <div className="mt-3 space-y-2">
              {estadisticas.rankingParcelas.map((parcela) => (
                <div
                  key={`parcela-${parcela.parcela}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">Parcela {parcela.parcela}</p>
                    <p className="text-[11px] text-slate-500">{parcela.vecinos} registros</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700">
                    {formatearMonto(parcela.pagado)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">Resumen por mes</p>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {estadisticas.resumenMensual.map((mes) => (
              <div key={mes.mes} className="rounded-xl bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold text-slate-500">{mes.mes}</p>
                <p className="mt-2 text-sm font-bold text-slate-900">
                  {formatearMonto(mes.pagado)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">{mes.conPago} con aporte</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
