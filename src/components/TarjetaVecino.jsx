import { VALOR_MES } from '../constants/pagos';
import { formatearFechaVisible } from '../utils/adminRows.js';

export default function TarjetaVecino({ vecino }) {
  const totalCuotasExtra = vecino.cuotasExtra.reduce((total, item) => total + item.monto, 0);

  return (
    <div className="border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm bg-slate-50">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg md:text-2xl font-bold text-slate-900 leading-tight">
            {vecino.nombre}
          </h3>
          <p className="text-sm md:text-base text-slate-500 mt-1">
            Parcela: {vecino.parcela} | Sitio: {vecino.sitio}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs md:text-sm text-slate-600">
            {vecino.rut ? (
              <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full">
                RUT: {vecino.rut}
              </span>
            ) : null}
            {vecino.contacto ? (
              <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full">
                Contacto: {vecino.contacto}
              </span>
            ) : null}
            {vecino.fechaFirma ? (
              <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full">
                Firma: {formatearFechaVisible(vecino.fechaFirma)}
              </span>
            ) : null}
          </div>
        </div>

        <span
          className={`self-start md:self-auto px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium ${
            vecino.estado === 'Pagado'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {vecino.estado}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-xs md:text-sm text-slate-500">Total pagado</p>
          <p className="text-2xl md:text-3xl font-bold text-emerald-700 mt-2 break-words">
            ${vecino.totalPagado.toLocaleString('es-CL')}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-xs md:text-sm text-slate-500">Total pendiente</p>
          <p className="text-2xl md:text-3xl font-bold text-red-600 mt-2 break-words">
            ${vecino.totalPendiente.toLocaleString('es-CL')}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-xs md:text-sm text-slate-500">Cuotas extra</p>
          <p className="text-2xl md:text-3xl font-bold text-amber-700 mt-2 break-words">
            ${totalCuotasExtra.toLocaleString('es-CL')}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 md:col-span-3">
          {vecino.observaciones ? (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs md:text-sm text-slate-500">Observaciones</p>
              <p className="mt-1 text-sm md:text-base text-slate-800">{vecino.observaciones}</p>
            </div>
          ) : null}

          <p className="text-xs md:text-sm text-slate-500 mb-3">Meses pagados</p>

          <div className="flex flex-wrap gap-2">
            {vecino.mesesPagados.length > 0 ? (
              vecino.mesesPagados.map((item) => (
                <span
                  key={item.mes}
                  className={`px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
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

          <div className="mt-4 text-xs md:text-sm text-slate-600">
            Total pagado registrado:
            <span className="font-bold text-emerald-700 ml-1">
              ${vecino.totalPagado.toLocaleString('es-CL')}
            </span>
          </div>

          <div className="mt-6 bg-amber-100 border border-amber-300 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs md:text-sm text-slate-600">Detalle cuotas extra</p>
                <p className="text-xl md:text-2xl font-bold text-amber-700 mt-1">
                  ${totalCuotasExtra.toLocaleString('es-CL')}
                </p>
              </div>

              <div>
                <span className="bg-amber-200 text-amber-800 px-3 py-1 rounded-full text-xs md:text-sm font-medium">
                  {vecino.cuotasExtra.length > 0 ? 'Incluidas en total pendiente' : 'Sin cuotas extra'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {vecino.cuotasExtra.length > 0 ? (
                vecino.cuotasExtra.map((item) => (
                  <span
                    key={item.nombre}
                    className="bg-amber-200 text-amber-900 px-3 py-1 rounded-full text-xs md:text-sm font-medium"
                  >
                    {item.nombre} - ${item.monto.toLocaleString('es-CL')}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-600">No hay cuotas extra registradas.</span>
              )}
            </div>
          </div>

          <p className="text-xs md:text-sm text-slate-500 mt-6 mb-3">Meses pendientes</p>

          <div className="flex flex-wrap gap-2">
            {vecino.mesesPendientes.length > 0 ? (
              vecino.mesesPendientes.map((mes) => (
                <span
                  key={mes}
                  className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs md:text-sm font-medium"
                >
                  {mes} - ${(VALOR_MES[mes] || 0).toLocaleString('es-CL')}
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
