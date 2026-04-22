import { useState } from 'react';
import { optimizarComprobante } from '../utils/comprobantes.js';

const MAX_COMPROBANTE_BYTES = 1_000_000;

function IconoMoneda() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6.5V13.5M7.75 8.5H11.25C12.0784 8.5 12.75 9.17157 12.75 10C12.75 10.8284 12.0784 11.5 11.25 11.5H8.75C7.92157 11.5 7.25 12.1716 7.25 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoCalendario() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="3.5" y="4.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 3.5V6M13.5 3.5V6M3.5 8H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoEstado() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4.5 10L8 13.5L15.5 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FormularioComprobante({ vecino }) {
  const [archivo, setArchivo] = useState(null);
  const [fechaPago, setFechaPago] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [tamanoOptimizadoKb, setTamanoOptimizadoKb] = useState(null);

  async function enviarComprobante(event) {
    event.preventDefault();
    if (!archivo) {
      setError('Selecciona una imagen de comprobante.');
      setMensaje('');
      return;
    }

    try {
      setEnviando(true);
      setError('');
      setMensaje('');

      const optimizada = await optimizarComprobante(archivo, {
        maxBytes: MAX_COMPROBANTE_BYTES,
        maxDimension: 1400
      });
      setTamanoOptimizadoKb(Math.round(optimizada.bytes / 1024));

      const response = await fetch('/api/comprobantes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nombre: vecino.nombre,
          parcela: vecino.parcela,
          sitio: vecino.sitio,
          fechaPago,
          observacion: detalle,
          archivoNombre: archivo.name,
          imagenDataUrl: optimizada.dataUrl
        })
      });

      const data = await response.json().catch(() => ({
        ok: false,
        message: 'Respuesta invalida del servidor.'
      }));

      if (!response.ok || !data.ok) {
        setError(data.message || 'No se pudo enviar el comprobante.');
        return;
      }

      setMensaje(data.message || 'Comprobante enviado correctamente.');
      setArchivo(null);
      setFechaPago('');
      setDetalle('');
    } catch (submitError) {
      console.error('Error enviando comprobante', submitError);
      setError(submitError.message || 'No se pudo enviar el comprobante.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviarComprobante} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-600 font-medium mb-3">Adjuntar comprobante de pago (imagen)</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setArchivo(event.target.files?.[0] || null)}
          className="md:col-span-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
        />
        <input
          type="date"
          value={fechaPago}
          onChange={(event) => setFechaPago(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 md:col-span-1"
        />
        <input
          type="text"
          placeholder="Comentario o detalle (opcional)"
          value={detalle}
          onChange={(event) => setDetalle(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 md:col-span-2"
        />
      </div>

      {tamanoOptimizadoKb !== null ? (
        <p className="mt-2 text-xs text-slate-500">Tamano optimizado aprox: {tamanoOptimizadoKb} KB</p>
      ) : null}
      {mensaje ? <p className="mt-2 text-xs text-emerald-700">{mensaje}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={enviando}
        className="mt-3 inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {enviando ? 'Enviando...' : 'Enviar comprobante'}
      </button>
    </form>
  );
}

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
            {vecino.contacto ? (
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                Contacto: {vecino.contacto}
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
          <span className="inline-flex items-center gap-1">
            <IconoEstado />
            {vecino.estado}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl p-3 border border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 inline-flex items-center gap-1">
            <IconoMoneda />
            Total pagado
          </p>
          <p className="text-xl md:text-2xl font-semibold text-emerald-700 mt-1 break-words">
            ${vecino.totalPagado.toLocaleString('es-CL')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Meses: ${vecino.totalPagadoMeses.toLocaleString('es-CL')} | Extra: $
            {vecino.totalPagadoCuotasExtra.toLocaleString('es-CL')}
          </p>
        </div>

        <div className="rounded-xl p-3 border border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 inline-flex items-center gap-1">
            <IconoMoneda />
            Total pendiente
          </p>
          <p className="text-xl md:text-2xl font-semibold text-red-600 mt-1 break-words">
            ${vecino.totalPendiente.toLocaleString('es-CL')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Meses: ${vecino.totalPendienteMeses.toLocaleString('es-CL')} | Extra: $
            {vecino.totalPendienteCuotasExtra.toLocaleString('es-CL')}
          </p>
        </div>

        <div className="rounded-xl p-3 border border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 inline-flex items-center gap-1">
            <IconoMoneda />
            Cuotas extra
          </p>
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
              <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                <IconoCalendario />
                Observaciones
              </p>
              <p className="mt-1 text-sm text-slate-800">{vecino.observaciones}</p>
            </div>
          ) : null}

          <p className="text-xs text-slate-500 mb-2 inline-flex items-center gap-1">
            <IconoCalendario />
            Meses pagados
          </p>

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

          <p className="text-xs text-slate-500 mt-4 mb-2 inline-flex items-center gap-1">
            <IconoCalendario />
            Meses pendientes
          </p>

          <div className="flex flex-wrap gap-2">
            {vecino.mesesPendientes.length > 0 ? (
              vecino.mesesPendientes.map((item) => (
                <span
                  key={item.mes}
                  className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-medium"
                >
                  {item.mes} - ${item.montoPendiente.toLocaleString('es-CL')}
                  {item.incompleto ? ' parcial' : ''}
                </span>
              ))
            ) : (
              <span className="text-sm text-emerald-600 font-medium">No tiene meses pendientes</span>
            )}
          </div>

          <FormularioComprobante vecino={vecino} />
        </div>
      </div>
    </div>
  );
}
