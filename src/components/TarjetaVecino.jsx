import { useRef, useState } from 'react';
import { optimizarComprobante } from '../utils/comprobantes.js';

const MAX_COMPROBANTE_BYTES = 1_000_000;
const MAX_COMPROBANTE_ORIGINAL_BYTES = 8_000_000;
const TIPOS_PERMITIDOS = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp'
]);
const TIPOS_NO_COMPATIBLES = new Set(['image/heic', 'image/heif', 'image/heic-sequence']);

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

function IconoAdjuntar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M7.5 10.8L11.8 6.5C12.8 5.5 14.4 5.5 15.4 6.5C16.4 7.5 16.4 9.1 15.4 10.1L9.5 16C8.1 17.4 5.8 17.4 4.4 16C3 14.6 3 12.3 4.4 10.9L10.6 4.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function normalizarEtiquetaMes(mes) {
  const valor = String(mes || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  if (valor === 'MAYONESA' || valor === 'MAY0' || valor === 'MAYONEZA') {
    return 'MAYO';
  }
  return valor;
}

function FormularioComprobante({ vecino }) {
  const inputArchivoRef = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [tamanoOptimizadoKb, setTamanoOptimizadoKb] = useState(null);
  const comentarioHabilitado = Boolean(archivo);

  function limpiarArchivo() {
    setArchivo(null);
    if (inputArchivoRef.current) {
      inputArchivoRef.current.value = '';
    }
  }

  function seleccionarArchivo(event) {
    const file = event.target.files?.[0] || null;
    setMensaje('');
    setError('');
    setTamanoOptimizadoKb(null);

    if (!file) {
      limpiarArchivo();
      return;
    }

    const tipo = String(file.type || '').toLowerCase();

    if (TIPOS_NO_COMPATIBLES.has(tipo)) {
      limpiarArchivo();
      setError('Tu celular envio HEIC. Cambia la camara a JPG (Most Compatible) y vuelve a intentar.');
      return;
    }

    if (!TIPOS_PERMITIDOS.has(tipo)) {
      limpiarArchivo();
      setError('Formato no permitido. Usa JPG, PNG o WEBP.');
      return;
    }

    if (file.size > MAX_COMPROBANTE_ORIGINAL_BYTES) {
      limpiarArchivo();
      setError('La imagen original es muy pesada. Maximo permitido: 8 MB.');
      return;
    }

    setArchivo(file);
  }

  async function enviarComprobante(event) {
    event.preventDefault();
    if (!archivo) {
      setError('Adjunta una imagen para continuar.');
      setMensaje('');
      return;
    }

    try {
      setEnviando(true);
      setError('');
      setMensaje('');

      let blobEnviar = archivo;
      let mimeEnviar = archivo.type || 'image/jpeg';
      try {
        const optimizada = await optimizarComprobante(archivo, {
          maxBytes: MAX_COMPROBANTE_BYTES,
          maxDimension: 1400,
          maxBytesFallback: MAX_COMPROBANTE_ORIGINAL_BYTES
        });
        blobEnviar = optimizada.blob;
        mimeEnviar = optimizada.mime || mimeEnviar;
        setTamanoOptimizadoKb(Math.round(optimizada.bytes / 1024));
      } catch {
        setTamanoOptimizadoKb(Math.round(archivo.size / 1024));
      }

      const query = new URLSearchParams({
        nombre: vecino.nombre,
        parcela: String(vecino.parcela || ''),
        sitio: String(vecino.sitio || ''),
        fechaPago: new Date().toISOString().slice(0, 10),
        observacion: detalle,
        archivoNombre: archivo.name,
        archivoMime: mimeEnviar
      });

      const response = await fetch(`/api/comprobantes?mode=bin&${query.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': mimeEnviar
        },
        body: blobEnviar
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
      limpiarArchivo();
      setDetalle('');
    } catch (submitError) {
      console.error('Error enviando comprobante', submitError);
      setError(submitError.message || 'No se pudo enviar el comprobante.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviarComprobante} className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-600 font-medium mb-2">Adjuntar comprobante de pago (imagen)</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[240px_1fr_170px]">
        <input
          ref={inputArchivoRef}
          id={`archivo-comprobante-${vecino.id}`}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={seleccionarArchivo}
          className="hidden"
        />
        <label
          htmlFor={`archivo-comprobante-${vecino.id}`}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm transition ${
            archivo
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
          } cursor-pointer`}
        >
          <IconoAdjuntar />
          {archivo ? 'Imagen lista' : 'Subir imagen'}
        </label>
        <input
          type="text"
          placeholder="Comentario o detalle (opcional)"
          value={detalle}
          onChange={(event) => setDetalle(event.target.value)}
          maxLength={300}
          disabled={!comentarioHabilitado}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={enviando || !comentarioHabilitado}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          {enviando ? 'Enviando...' : 'Enviar comprobante'}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {archivo ? `Archivo: ${archivo.name}` : 'Aun no ha seleccionado una imagen.'}
      </p>
      {tamanoOptimizadoKb !== null ? (
        <p className="mt-1 text-[11px] text-slate-500">Tamano optimizado aprox: {tamanoOptimizadoKb} KB</p>
      ) : null}
      {mensaje ? <p className="mt-1 text-xs text-emerald-700">{mensaje}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </form>
  );
}

export default function TarjetaVecino({ vecino }) {
  const totalCuotasExtra = vecino.cuotasExtra.reduce((total, item) => total + item.montoPagado, 0);
  const totalPendienteCuotasExtra = vecino.cuotasExtra.reduce(
    (total, item) => total + item.montoPendiente,
    0
  );
  const totalEsperado = vecino.totalPagado + vecino.totalPendiente;
  const porcentajePagado = totalEsperado > 0 ? Math.min(100, Math.round((vecino.totalPagado / totalEsperado) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-emerald-200/80 p-3 md:p-4 bg-white shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between mb-3">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-slate-800 leading-tight">
            {vecino.nombre}
          </h3>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Parcela: {vecino.parcela} | Sitio: {vecino.sitio}
          </p>
        </div>

        <span
          className={`self-start px-3 py-1 rounded-full text-xs font-semibold ${
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

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 mb-3">
        <div className="rounded-xl p-3 border border-slate-200 bg-emerald-50/60">
          <p className="text-[11px] text-slate-600 inline-flex items-center gap-1">
            <IconoMoneda />
            Total pagado
          </p>
          <p className="text-lg md:text-xl font-semibold text-emerald-700 mt-1 break-words">
            ${vecino.totalPagado.toLocaleString('es-CL')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Cuotas: ${vecino.totalPagadoMeses.toLocaleString('es-CL')} | Extra: $
            {vecino.totalPagadoCuotasExtra.toLocaleString('es-CL')}
          </p>
        </div>

        <div className="rounded-xl p-3 border border-slate-200 bg-rose-50/60">
          <p className="text-[11px] text-slate-600 inline-flex items-center gap-1">
            <IconoMoneda />
            Total pendiente
          </p>
          <p className="text-lg md:text-xl font-semibold text-red-600 mt-1 break-words">
            ${vecino.totalPendiente.toLocaleString('es-CL')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Cuotas: ${vecino.totalPendienteMeses.toLocaleString('es-CL')} | Extra: $
            {vecino.totalPendienteCuotasExtra.toLocaleString('es-CL')}
          </p>
        </div>

        <div className="rounded-xl p-3 border border-slate-200 bg-amber-50/60">
          <p className="text-[11px] text-slate-600 inline-flex items-center gap-1">
            <IconoMoneda />
            Cuotas extra
          </p>
          <p className="text-lg md:text-xl font-semibold text-amber-700 mt-1 break-words">
            ${totalCuotasExtra.toLocaleString('es-CL')}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Pendiente extra: ${totalPendienteCuotasExtra.toLocaleString('es-CL')}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1">
          <span>Progreso de pago</span>
          <span>{porcentajePagado}% pagado</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${porcentajePagado}%` }} />
        </div>
      </div>

      <div className="rounded-xl p-3 border border-slate-200 bg-slate-50/50">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-slate-600 mb-2 inline-flex items-center gap-1">
              <IconoCalendario />
              Meses pagados
            </p>
            <div className="flex flex-wrap gap-2">
              {vecino.mesesPagados.length > 0 ? (
                vecino.mesesPagados.map((item) => (
                  <span
                    key={item.mes}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold ${
                      item.incompleto ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {normalizarEtiquetaMes(item.mes)}
                    <span className="block font-medium">${item.monto.toLocaleString('es-CL')}</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">Sin pagos registrados</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-600 mb-2 inline-flex items-center gap-1">
              <IconoCalendario />
              Meses pendientes
            </p>
            <div className="flex flex-wrap gap-2">
              {vecino.mesesPendientes.length > 0 ? (
                vecino.mesesPendientes.map((item) => (
                  <span
                    key={item.mes}
                    className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-[11px] font-semibold"
                  >
                    {normalizarEtiquetaMes(item.mes)}
                    <span className="block font-medium">
                      ${item.montoPendiente.toLocaleString('es-CL')}
                      {item.incompleto ? ' parcial' : ''}
                    </span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-emerald-600 font-medium">No tiene meses pendientes</span>
              )}
            </div>
          </div>
        </div>

        {vecino.cuotasExtra.length > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] text-slate-600 mb-2">Cuotas extra</p>
            <div className="flex flex-wrap gap-2">
              {vecino.cuotasExtra.map((item) => (
                <span
                  key={item.nombre}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold ${
                    item.incompleta ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.nombre}
                  <span className="block font-medium">
                    ${item.montoPagado.toLocaleString('es-CL')} / ${item.montoEsperado.toLocaleString('es-CL')}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <FormularioComprobante vecino={vecino} />
      </div>
    </div>
  );
}
