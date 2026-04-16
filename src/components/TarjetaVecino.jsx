import { formatearFechaVisible } from '../utils/adminRows.js';

export default function TarjetaVecino({ vecino }) {
  const totalCuotasExtra = vecino.cuotasExtra.reduce((total, item) => total + item.montoPagado, 0);
  const totalPendienteCuotasExtra = vecino.cuotasExtra.reduce(
    (total, item) => total + item.montoPendiente,
    0
  );

  return (
    <div className="rounded-2xl border border-slate-200 p-4 md:p-5 bg-white shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base md:text-xl font-semibold text-slate-900 leading-tight">
            {vecino.nombre}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Parcela: {vecino.parcela} | Sitio: {vecino.sitio}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            {vecino.rut ? (
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                RUT: {vecino.rut}
              </span>
            ) : null}
            {vecino.contacto ? (
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                Contacto: {vecino.contacto}
              </span>
            ) : null}
            {vecino.fechaFirma ? (
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                Firma: {formatearFechaVisible(vecino.fechaFirma)}
              </span>
            ) : null}
          </div>
        </div>

        <span
          className={`self-start px-3 py-1.5 rounded-full text-xs font-medium ${
            vecino.estado === 'Pagado'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {vecino.estado}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl p-3 border border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">Total pagado</p>
          <p className="text-xl md:text-2xl font-semibold text-emerald-700 mt-1 break-words">
            ${vecino.totalPagado.toLocaleString('es-CL')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Meses: ${vecino.totalPagadoMeses.toLocaleString('es-CL')} | Extra: $
            {vecino.totalPagadoCuotasExtra.toLocaleString('es-CL')}
          </p>
        </div>

        <div className="rounded-xl p-3 border border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">Total pendiente</p>
          <p className="text-xl md:text-2xl font-semibold text-red-600 mt-1 break-words">
            ${vecino.totalPendiente.toLocaleString('es-CL')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Meses: ${vecino.totalPendienteMeses.toLocaleString('es-CL')} | Extra: $
            {vecino.totalPendienteCuotasExtra.toLocaleString('es-CL')}
          </p>
        </div>

        <div className="rounded-xl p-3 border border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">Cuotas extra</p>
          <p className="text-xl md:text-2xl font-semibold text-amber-700 mt-1 break-words">
            ${totalCuotasExtra.toLocaleString('es-CL')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Pendiente extra: ${totalPendienteCuotasExtra.toLocaleString('es-CL')}
          </p>
        </div>

        <div className="rounded-xl p-3 border border-slate-200 md:col-span-3">
          {vecino.observaciones ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Observaciones</p>
              <p className="mt-1 text-sm text-slate-800">{vecino.observaciones}</p>
            </div>
          ) : null}

          <p className="text-xs text-slate-500 mb-2">Meses pagados</p>

          <div className="flex flex-wrap gap-2">
            {vecino.mesesPagados.length > 0 ? (
              vecino.mesesPagados.map((item) => (
                <span
                  key={item.mes}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    item.incompleto ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {item.mes} - ${item.monto.toLocaleString('es-CL')} / $
                  {item.montoEsperado.toLocaleString('es-CL')}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">Sin pagos registrados</span>
            )}
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-slate-600">Detalle cuotas extra</p>
                <p className="text-lg md:text-xl font-semibold text-amber-700 mt-1">
                  ${totalCuotasExtra.toLocaleString('es-CL')}
                </p>
              </div>

              <div>
                <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-medium">
                  {vecino.cuotasExtra.length > 0 ? 'Cuotas registradas' : 'Sin cuotas extra'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {vecino.cuotasExtra.length > 0 ? (
                vecino.cuotasExtra.map((item) => (
                  <span
                    key={item.nombre}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      item.incompleta
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {item.nombre} - ${item.montoPagado.toLocaleString('es-CL')} / $
                    {item.montoEsperado.toLocaleString('es-CL')}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-600">No hay cuotas extra registradas.</span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-4 mb-2">Meses pendientes</p>

          <div className="flex flex-wrap gap-2">
            {vecino.mesesPendientes.length > 0 ? (
              vecino.mesesPendientes.map((item) => (
                <span
                  key={item.mes}
                  className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-medium"
                >
                  {item.mes} - Faltan ${item.montoPendiente.toLocaleString('es-CL')}
                  {item.incompleto ? ' (pago parcial)' : ''}
                </span>
              ))
            ) : (
              <span className="text-sm text-emerald-600 font-medium">No tiene meses pendientes</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
