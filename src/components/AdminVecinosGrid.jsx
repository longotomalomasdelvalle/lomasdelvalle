import { useEffect, useMemo, useState } from 'react';
import { TODOS_LOS_MESES } from '../constants/pagos.js';
import {
  formatearContactoEditable,
  formatearRutEditable,
  obtenerNombreVisibleColumna,
  sanitizarValorCelda,
  validarContacto,
  validarRut
} from '../utils/adminRows.js';
import { COLUMNA_ACTUALIZACION } from '../utils/columnas.js';
import { normalizarTexto } from '../utils/pagos.js';

const FILAS_POR_PAGINA = 10;

function formatearFechaRespaldo(iso) {
  if (!iso) return '-';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return String(iso);
  return fecha.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function abreviarCommit(sha) {
  const valor = String(sha ?? '').trim();
  return valor ? valor.slice(0, 8) : '-';
}

function esCampoMonetario(columna, columnasCuotaExtra) {
  return TODOS_LOS_MESES.includes(columna) || columnasCuotaExtra.includes(columna);
}

function esCampoFecha(columna) {
  return columna === 'F/FIRMA';
}

function obtenerEstadoValidacion(columna, valor) {
  if (columna === 'RUT') {
    return validarRut(valor);
  }

  if (columna === 'N-CONTACTO') {
    return validarContacto(valor);
  }

  return { valido: true, sugerencia: '' };
}

function formatearMontoInput(valor) {
  const numeros = String(valor ?? '').replace(/[^\d]/g, '');

  if (!numeros) {
    return '';
  }

  return Number(numeros).toLocaleString('es-CL');
}

function confirmarEliminacionFila(index, onDeleteRow) {
  const confirmar = window.confirm(`Vas a eliminar la fila ${index + 1}.`);

  if (confirmar) {
    onDeleteRow(index);
  }
}

function confirmarEliminacionColumna(tipo, columna, onDeleteConfiguredColumn) {
  const texto = tipo === 'cuota' ? 'la cuota extra' : 'el campo transversal';
  const confirmar = window.confirm(`Vas a eliminar ${texto} ${columna} de todas las filas.`);

  if (confirmar) {
    onDeleteConfiguredColumn(columna, tipo);
  }
}

function IconoEditar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M4.167 13.75V15.833H6.25L14.271 7.813L12.188 5.729L4.167 13.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.938 6.979L13.021 9.063"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.563 3.854L12.604 2.813C13.179 2.238 14.113 2.238 14.688 2.813L16.146 4.271C16.721 4.846 16.721 5.779 16.146 6.354L15.104 7.396"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoEliminar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M5.833 7.083V14.583C5.833 15.043 6.207 15.417 6.667 15.417H13.333C13.793 15.417 14.167 15.043 14.167 14.583V7.083"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4.167 5.417H15.833"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7.917 5.417V4.583C7.917 4.123 8.29 3.75 8.75 3.75H11.25C11.71 3.75 12.083 4.123 12.083 4.583V5.417"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.333 8.75V12.917"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11.667 8.75V12.917"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconoConfirmar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M4.167 10.417L8.125 14.375L15.833 6.667"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoDescartar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M6.667 6.667L13.333 13.333"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13.333 6.667L6.667 13.333"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconoImportar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M10 13.75V4.167" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.667 7.5L10 4.167L13.333 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.167 15.833H15.833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoAgregar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M10 4.167V15.833M4.167 10H15.833" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconoExcel() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="3.75" y="2.917" width="12.5" height="14.167" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 7.5L12.5 12.5M12.5 7.5L7.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoJson() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M7.083 4.583C5.926 4.583 5 5.51 5 6.667V8.333C5 9.023 4.44 9.583 3.75 9.583C4.44 9.583 5 10.143 5 10.833V12.5C5 13.657 5.926 14.583 7.083 14.583" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.917 4.583C14.074 4.583 15 5.51 15 6.667V8.333C15 9.023 15.56 9.583 16.25 9.583C15.56 9.583 15 10.143 15 10.833V12.5C15 13.657 14.074 14.583 12.917 14.583" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoGithub() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M10 2.917C5.857 2.917 2.5 6.273 2.5 10.417C2.5 13.733 4.65 16.543 7.63 17.535C8.005 17.606 8.143 17.371 8.143 17.169V15.94C6.05 16.392 5.61 14.982 5.61 14.982C5.268 14.113 4.774 13.883 4.774 13.883C4.09 13.417 4.826 13.426 4.826 13.426C5.583 13.479 5.982 14.203 5.982 14.203C6.654 15.351 7.746 15.02 8.179 14.828C8.247 14.34 8.442 14.008 8.658 13.82C6.985 13.629 5.225 12.983 5.225 10.098C5.225 9.275 5.519 8.602 6.001 8.073C5.923 7.881 5.664 7.108 6.074 6.063C6.074 6.063 6.705 5.862 8.14 6.833C8.739 6.667 9.383 6.584 10.026 6.581C10.669 6.584 11.313 6.667 11.912 6.833C13.347 5.862 13.978 6.063 13.978 6.063C14.388 7.108 14.129 7.881 14.051 8.073C14.533 8.602 14.827 9.275 14.827 10.098C14.827 12.991 13.064 13.626 11.384 13.813C11.655 14.047 11.898 14.509 11.898 15.218V17.169C11.898 17.373 12.037 17.61 12.417 17.534C15.395 16.54 17.5 13.731 17.5 10.417C17.5 6.273 14.143 2.917 10 2.917Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function BotonGestion({ abierta, etiquetaAbierta, etiquetaCerrada, onClick, className }) {
  return (
    <button onClick={onClick} className={className}>
      {abierta ? etiquetaAbierta : etiquetaCerrada}
    </button>
  );
}

function obtenerOrdenActualizacion(fila, index) {
  const timestamp = Date.parse(String(fila[COLUMNA_ACTUALIZACION] ?? ''));
  return Number.isNaN(timestamp) ? index : timestamp;
}

function BloqueGestionColumnas({
  titulo,
  descripcion,
  tipo,
  abierta,
  columnas,
  guardando,
  onToggle,
  onAddColumn,
  onDeleteConfiguredColumn
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {titulo}
          </p>
          <p className="text-sm md:text-base font-semibold text-slate-900 mt-1">{descripcion}</p>
        </div>
        <span className="text-sm font-semibold text-slate-600">
          {abierta ? 'Ocultar' : 'Mostrar'}
        </span>
      </button>

      {abierta ? (
        <div className="border-t border-slate-200 px-4 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const nombre = window.prompt(
                  tipo === 'cuota'
                    ? 'Nombre de la nueva cuota extra'
                    : 'Nombre del nuevo campo transversal'
                );

                if (nombre?.trim()) {
                  onAddColumn(nombre.trim(), tipo);
                }
              }}
              disabled={guardando}
              className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm font-semibold text-white transition ${
                tipo === 'cuota'
                  ? 'bg-violet-600 hover:bg-violet-700'
                  : 'bg-cyan-600 hover:bg-cyan-700'
              }`}
            >
              {tipo === 'cuota' ? 'Agregar cuota extra' : 'Agregar campo transversal'}
            </button>
          </div>

          {columnas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {columnas.map((columna) => (
                <div
                  key={columna}
                  className="inline-flex items-center gap-2 bg-white text-slate-900 border border-slate-200 px-3 py-2 rounded-2xl text-xs font-semibold"
                >
                  <span>{obtenerNombreVisibleColumna(columna)}</span>
                  <button
                    onClick={() =>
                      confirmarEliminacionColumna(tipo, columna, onDeleteConfiguredColumn)
                    }
                    disabled={guardando}
                    className="bg-red-100 text-red-700 px-2 py-1 rounded-lg text-[10px] font-bold"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {tipo === 'cuota'
                ? 'No hay cuotas extra configuradas.'
                : 'No hay campos transversales configurados.'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MobileField({
  columna,
  fila,
  index,
  editable,
  guardando,
  columnasCuotaExtra,
  onChangeCell
}) {
  const esNumerico =
    columna === 'PARCELA' ||
    columna === 'SITIO' ||
    columna === 'N-CONTACTO' ||
    esCampoMonetario(columna, columnasCuotaExtra);
  const esMonto = esCampoMonetario(columna, columnasCuotaExtra);
  const validacion = obtenerEstadoValidacion(columna, fila[columna]);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wide text-slate-600">
        {obtenerNombreVisibleColumna(columna)}
      </span>
      <div className="relative">
        {esMonto ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
            $
          </span>
        ) : null}
        <input
          type={esCampoFecha(columna) ? 'date' : 'text'}
          value={
            esMonto
              ? formatearMontoInput(fila[columna])
              : columna === 'RUT'
                ? formatearRutEditable(fila[columna])
                : columna === 'N-CONTACTO'
                  ? formatearContactoEditable(fila[columna])
                : esCampoFecha(columna)
                  ? fila[columna] ?? ''
                  : fila[columna] ?? ''
          }
          disabled={guardando || !editable}
          inputMode={esNumerico ? 'numeric' : 'text'}
          onChange={(event) =>
            onChangeCell(
              index,
              columna,
              esCampoFecha(columna)
                ? event.target.value
                : columna === 'RUT'
                  ? formatearRutEditable(event.target.value)
                  : columna === 'N-CONTACTO'
                    ? formatearContactoEditable(event.target.value)
                : sanitizarValorCelda(columna, event.target.value, columnasCuotaExtra)
            )
          }
          className={`w-full border rounded-xl px-3 py-2 text-sm ${
            validacion.valido
              ? 'border-slate-300'
              : 'border-red-300 bg-red-50 text-red-700'
          } ${esMonto ? 'pl-7' : ''}`}
        />
      </div>
      {!validacion.valido ? (
        <span className="text-[11px] text-red-600">{validacion.sugerencia}</span>
      ) : null}
    </label>
  );
}

function MobileRowCard({
  fila,
  index,
  columnas,
  columnasCuotaExtra,
  editable,
  onSelectRow,
  guardando,
  onChangeCell,
  onDeleteRow
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Fila {index + 1}
          </p>
          <p className="text-base font-bold text-slate-900">
            {fila['NOMBRE DE PROPIETARIO'] || 'Sin nombre'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onSelectRow(index)}
            disabled={guardando}
            className={`px-3 py-2 rounded-xl text-xs font-semibold ${
              editable ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {editable ? 'Editando' : 'Editar'}
          </button>
          <button
            onClick={() => confirmarEliminacionFila(index, onDeleteRow)}
            disabled={guardando}
            className="bg-red-100 text-red-700 px-3 py-2 rounded-xl text-xs font-semibold"
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {columnas.map((columna) => (
          <MobileField
            key={`${index}-${columna}`}
            columna={columna}
            fila={fila}
            index={index}
            editable={editable}
            guardando={guardando}
            columnasCuotaExtra={columnasCuotaExtra}
            onChangeCell={onChangeCell}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminVecinosGrid({
  filas,
  configuracion,
  cargando,
  guardando,
  mensaje,
  error,
  onChangeCell,
  onDeleteConfiguredColumn,
  onAddRow,
  onDeleteRow,
  onReplaceRow,
  onSave,
  onImportExcel,
  onExportExcel,
  onExportJson,
  onBackupGithub,
  ultimoRespaldoGithub
}) {
  const [filtros, setFiltros] = useState({
    nombre: '',
    rut: '',
    parcela: '',
    sitio: '',
    contacto: ''
  });
  const [paginaActual, setPaginaActual] = useState(1);
  const [filaSeleccionada, setFilaSeleccionada] = useState(null);
  const [respaldoFila, setRespaldoFila] = useState(null);
  const [mostrarCuotasExtra, setMostrarCuotasExtra] = useState(false);
  const [mostrarCamposTransversales, setMostrarCamposTransversales] = useState(false);
  const [mensajeFila, setMensajeFila] = useState('');
  const [respaldandoGithub, setRespaldandoGithub] = useState(false);

  useEffect(() => {
    if (!mensajeFila) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setMensajeFila('');
    }, 2400);

    return () => window.clearTimeout(timeoutId);
  }, [mensajeFila]);

  function iniciarEdicion(index, fila) {
    if (filaSeleccionada !== index) {
      setRespaldoFila({ index, fila: { ...fila } });
    }
    setFilaSeleccionada(index);
  }

  async function confirmarEdicion() {
    const textoExito = 'Fila actualizada con exito.';
    const guardado = await onSave(textoExito);

    if (guardado) {
      setFilaSeleccionada(null);
      setRespaldoFila(null);
      setMensajeFila(textoExito);
      window.alert(textoExito);
    }
  }

  function descartarEdicion() {
    if (respaldoFila) {
      onReplaceRow(respaldoFila.index, respaldoFila.fila);
    }
    setFilaSeleccionada(null);
    setRespaldoFila(null);
  }

  async function respaldarEnGithub() {
    if (!onBackupGithub) return;
    setRespaldandoGithub(true);
    try {
      const ok = await onBackupGithub();
      if (ok) {
        window.alert('Respaldo enviado a GitHub correctamente.');
      }
    } finally {
      setRespaldandoGithub(false);
    }
  }

  const columnasCuotaExtra = useMemo(
    () => configuracion?.cuotasExtra ?? [],
    [configuracion]
  );
  const columnasTransversales = useMemo(
    () => configuracion?.camposTransversales ?? [],
    [configuracion]
  );
  const columnasPersonalizadas = useMemo(
    () => [...columnasTransversales, ...columnasCuotaExtra],
    [columnasCuotaExtra, columnasTransversales]
  );
  const columnasBaseOrdenadas = useMemo(
    () => [
      'PARCELA',
      'SITIO',
      'NOMBRE DE PROPIETARIO',
      'RUT',
      'N-CONTACTO',
      'F/FIRMA',
      'OBSERVACION'
    ],
    []
  );
  const columnas = useMemo(
    () => [...columnasBaseOrdenadas, ...columnasPersonalizadas, ...TODOS_LOS_MESES],
    [columnasBaseOrdenadas, columnasPersonalizadas]
  );

  const filasFiltradas = useMemo(() => {
    const terminosNombre = normalizarTexto(filtros.nombre).split(' ').filter(Boolean);
    const filtroRut = normalizarTexto(filtros.rut);
    const filtroParcela = normalizarTexto(filtros.parcela);
    const filtroSitio = normalizarTexto(filtros.sitio);
    const filtroContacto = normalizarTexto(filtros.contacto);

    const filasBase = filas
      .map((fila, indiceOriginal) => ({ fila, indiceOriginal }))
      .filter(({ fila }) => {
      const nombre = normalizarTexto(fila['NOMBRE DE PROPIETARIO']);
      const rut = normalizarTexto(fila.RUT);
      const parcela = normalizarTexto(fila.PARCELA);
      const sitio = normalizarTexto(fila.SITIO);
      const contacto = normalizarTexto(fila['N-CONTACTO']);
      const coincideNombre =
        terminosNombre.length === 0 ||
        terminosNombre.every((termino) => nombre.includes(termino));

      return (
        coincideNombre &&
        (!filtroRut || rut.includes(filtroRut)) &&
        (!filtroParcela || parcela.includes(filtroParcela)) &&
        (!filtroSitio || sitio.includes(filtroSitio)) &&
        (!filtroContacto || contacto.includes(filtroContacto))
      );
      });

    return filasBase
      .sort(
        (itemA, itemB) =>
          obtenerOrdenActualizacion(itemB.fila, itemB.indiceOriginal) -
          obtenerOrdenActualizacion(itemA.fila, itemA.indiceOriginal)
      );
  }, [filas, filtros]);

  const totalPaginas = Math.max(1, Math.ceil(filasFiltradas.length / FILAS_POR_PAGINA));
  const paginaVisible = Math.min(paginaActual, totalPaginas);
  const inicio = (paginaVisible - 1) * FILAS_POR_PAGINA;
  const filasPagina = filasFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);

  return (
    <div className="bg-white rounded-[2rem] shadow-xl p-4 md:p-6 space-y-4">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Gestion de planilla</h2>
          <p className="text-sm md:text-base text-slate-600 mt-1">
            Importa, edita y exporta la planilla. El respaldo a GitHub se hace solo cuando presionas el boton.
          </p>
        </div>

        <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Acciones principales
        </p>
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3">
          <label className="inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-800 px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-xs md:text-sm font-semibold cursor-pointer hover:bg-slate-200 transition text-center">
            <IconoImportar />
            <span>Importar Excel</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={guardando}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onImportExcel(file);
                }
                event.target.value = '';
              }}
            />
          </label>

          <button
            onClick={onAddRow}
            disabled={guardando}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-xs md:text-sm font-semibold hover:bg-emerald-700 transition"
          >
            <IconoAgregar />
            <span>Agregar fila</span>
          </button>

          <BotonGestion
            abierta={mostrarCuotasExtra}
            etiquetaAbierta="Ocultar cuotas"
            etiquetaCerrada="Cuotas extra"
            onClick={() => setMostrarCuotasExtra((valorActual) => !valorActual)}
            className="bg-violet-600 text-white px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-xs md:text-sm font-semibold hover:bg-violet-700 transition"
          />

          <BotonGestion
            abierta={mostrarCamposTransversales}
            etiquetaAbierta="Ocultar campos"
            etiquetaCerrada="Campos extra"
            onClick={() => setMostrarCamposTransversales((valorActual) => !valorActual)}
            className="bg-cyan-600 text-white px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-xs md:text-sm font-semibold hover:bg-cyan-700 transition"
          />

          <button
            onClick={onExportExcel}
            disabled={guardando || cargando || filas.length === 0}
            className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-xs md:text-sm font-semibold hover:bg-amber-600 transition"
          >
            <IconoExcel />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={onExportJson}
            disabled={guardando || cargando || filas.length === 0}
            className="inline-flex items-center justify-center gap-2 bg-sky-600 text-white px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-xs md:text-sm font-semibold hover:bg-sky-700 transition"
          >
            <IconoJson />
            <span>Descargar JSON</span>
          </button>

          <button
            onClick={respaldarEnGithub}
            disabled={guardando || cargando || respaldandoGithub}
            className="col-span-2 md:col-span-1 inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-3 py-3 md:px-4 md:py-3 rounded-2xl text-xs md:text-sm font-semibold hover:bg-slate-700 transition disabled:opacity-60"
          >
            <IconoGithub />
            <span>{respaldandoGithub ? 'Respaldando...' : 'Respaldar en GitHub'}</span>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 md:px-4">
          <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Ultimo respaldo GitHub
          </p>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs md:text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-500">Fecha:</span>{' '}
              {formatearFechaRespaldo(ultimoRespaldoGithub?.generadoEn)}
            </p>
            <p>
              <span className="font-semibold text-slate-500">Commit:</span>{' '}
              {abreviarCommit(ultimoRespaldoGithub?.commitSha)}
            </p>
            <p>
              <span className="font-semibold text-slate-500">Repo:</span>{' '}
              {ultimoRespaldoGithub?.repo || '-'}
            </p>
            <p>
              <span className="font-semibold text-slate-500">Branch:</span>{' '}
              {ultimoRespaldoGithub?.branch || '-'}
            </p>
            <p className="md:col-span-2">
              <span className="font-semibold text-slate-500">Ruta:</span>{' '}
              {ultimoRespaldoGithub?.path || '-'}
            </p>
          </div>
          {ultimoRespaldoGithub?.fileUrl ? (
            <a
              href={ultimoRespaldoGithub.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-xs font-semibold text-sky-700 hover:text-sky-800 underline"
            >
              Ver archivo en GitHub
            </a>
          ) : null}
        </div>
      </div>

      {mostrarCuotasExtra ? (
        <BloqueGestionColumnas
          titulo="Gestion de cuotas extra"
          descripcion={`${columnasCuotaExtra.length} cuota${columnasCuotaExtra.length === 1 ? '' : 's'} configurada${columnasCuotaExtra.length === 1 ? '' : 's'}`}
          tipo="cuota"
          abierta={mostrarCuotasExtra}
          columnas={columnasCuotaExtra}
          guardando={guardando}
          onToggle={() => setMostrarCuotasExtra((valorActual) => !valorActual)}
          onAddColumn={(nombre, tipo) => onChangeCell(-1, '__add_column__', nombre, { tipo })}
          onDeleteConfiguredColumn={onDeleteConfiguredColumn}
        />
      ) : null}

      {mostrarCamposTransversales ? (
        <BloqueGestionColumnas
          titulo="Gestion de campos transversales"
          descripcion={`${columnasTransversales.length} campo${columnasTransversales.length === 1 ? '' : 's'} transversal${columnasTransversales.length === 1 ? '' : 'es'} configurado${columnasTransversales.length === 1 ? '' : 's'}`}
          tipo="transversal"
          abierta={mostrarCamposTransversales}
          columnas={columnasTransversales}
          guardando={guardando}
          onToggle={() => setMostrarCamposTransversales((valorActual) => !valorActual)}
          onAddColumn={(nombre, tipo) => onChangeCell(-1, '__add_column__', nombre, { tipo })}
          onDeleteConfiguredColumn={onDeleteConfiguredColumn}
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
        <input
          type="text"
          value={filtros.nombre}
          onChange={(event) => {
            setFiltros((actual) => ({ ...actual, nombre: event.target.value }));
            setPaginaActual(1);
          }}
          placeholder="Nombre o apellidos"
          className="w-full border border-slate-300 rounded-2xl px-3 py-2.5 text-sm"
        />

        <input
          type="text"
          value={filtros.rut}
          onChange={(event) => {
            setFiltros((actual) => ({ ...actual, rut: event.target.value }));
            setPaginaActual(1);
          }}
          placeholder="RUT"
          className="w-full border border-slate-300 rounded-2xl px-3 py-2.5 text-sm"
        />

        <input
          type="text"
          value={filtros.parcela}
          onChange={(event) => {
            setFiltros((actual) => ({ ...actual, parcela: event.target.value }));
            setPaginaActual(1);
          }}
          placeholder="Parcela"
          className="w-full border border-slate-300 rounded-2xl px-3 py-2.5 text-sm"
        />

        <input
          type="text"
          value={filtros.sitio}
          onChange={(event) => {
            setFiltros((actual) => ({ ...actual, sitio: event.target.value }));
            setPaginaActual(1);
          }}
          placeholder="Sitio"
          className="w-full border border-slate-300 rounded-2xl px-3 py-2.5 text-sm"
        />

        <input
          type="text"
          value={filtros.contacto}
          onChange={(event) => {
            setFiltros((actual) => ({ ...actual, contacto: event.target.value }));
            setPaginaActual(1);
          }}
          placeholder="Contacto"
          className="w-full border border-slate-300 rounded-2xl px-3 py-2.5 text-sm"
        />
      </div>

      <div className="flex justify-end">
        <div className="text-xs md:text-sm text-slate-600">
          Mostrando {filasPagina.length} de {filasFiltradas.length} filas
        </div>
      </div>

      {mensaje ? <p className="text-xs md:text-sm text-emerald-700">{mensaje}</p> : null}
      {mensajeFila ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs md:text-sm font-semibold text-emerald-700 shadow-sm">
          {mensajeFila}
        </div>
      ) : null}
      {error ? <p className="text-xs md:text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3 md:hidden">
        {filasPagina.map(({ fila, indiceOriginal }) => {
          const index = indiceOriginal;

          return (
            <MobileRowCard
              key={`mobile-fila-${index}`}
              fila={fila}
              index={index}
              columnas={columnas}
              columnasCuotaExtra={columnasCuotaExtra}
              editable={filaSeleccionada === index}
              onSelectRow={(rowIndex) => iniciarEdicion(rowIndex, fila)}
              guardando={guardando}
              onChangeCell={onChangeCell}
              onDeleteRow={onDeleteRow}
            />
          );
        })}

        {!cargando && filasFiltradas.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No se encontraron filas con ese filtro.
          </div>
        ) : null}
      </div>

      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-2xl bg-white">
        <table className="min-w-max w-full text-[11px] lg:text-xs leading-tight">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-2 py-2 text-left sticky left-0 z-20 bg-slate-100 shadow-[6px_0_10px_-10px_rgba(15,23,42,0.35)] text-[10px] uppercase tracking-wide">
                Acciones
              </th>
              {columnas.map((columna) => (
                <th
                  key={columna}
                  className="px-2 py-2 text-left whitespace-nowrap text-[10px] uppercase tracking-wide"
                >
                  {obtenerNombreVisibleColumna(columna)}
                </th>
              ))}
              <th className="px-2 py-2 text-left sticky right-0 z-20 bg-slate-100 shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] text-[10px] uppercase tracking-wide">
                Edicion
              </th>
            </tr>
          </thead>
          <tbody>
            {filasPagina.map(({ fila, indiceOriginal }) => {
              const index = indiceOriginal;
              const filaActiva = filaSeleccionada === index;

              return (
                <tr
                  key={`fila-${index}`}
                  className={`border-t ${
                    filaActiva
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'border-slate-200'
                  }`}
                >
                  <td
                    className={`px-2 py-1.5 sticky left-0 z-10 align-top shadow-[6px_0_10px_-10px_rgba(15,23,42,0.35)] ${
                      filaActiva ? 'bg-amber-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-[72px]">
                      <button
                        onClick={() => iniciarEdicion(index, fila)}
                        disabled={guardando}
                        title={filaSeleccionada === index ? 'Editando' : 'Editar'}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${
                          filaSeleccionada === index
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <IconoEditar />
                      </button>
                      <button
                        onClick={() => confirmarEliminacionFila(index, onDeleteRow)}
                        disabled={guardando}
                        title="Eliminar"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                      >
                        <IconoEliminar />
                      </button>
                    </div>
                  </td>
                  {columnas.map((columna) => {
                    const esMonto = esCampoMonetario(columna, columnasCuotaExtra);
                    const validacion = obtenerEstadoValidacion(columna, fila[columna]);
                    const anchoInput =
                      columna === 'NOMBRE DE PROPIETARIO'
                        ? 'w-64 lg:w-72'
                        : columna === 'OBSERVACION'
                          ? 'w-40 lg:w-48'
                          : columna === 'PARCELA' || columna === 'SITIO'
                            ? 'w-16 lg:w-20'
                            : 'w-24 lg:w-28';

                    return (
                      <td key={`${index}-${columna}`} className="px-2 py-1.5 align-top">
                        <div className="relative">
                          {esMonto ? (
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500">
                              $
                            </span>
                          ) : null}
                          <input
                            type={esCampoFecha(columna) ? 'date' : 'text'}
                            value={
                              esMonto
                                ? formatearMontoInput(fila[columna])
                                : columna === 'RUT'
                                  ? formatearRutEditable(fila[columna])
                                  : columna === 'N-CONTACTO'
                                    ? formatearContactoEditable(fila[columna])
                                : esCampoFecha(columna)
                                  ? fila[columna] ?? ''
                                  : fila[columna] ?? ''
                            }
                            disabled={guardando || filaSeleccionada !== index}
                            inputMode={
                                columna === 'PARCELA' ||
                                columna === 'SITIO' ||
                                columna === 'N-CONTACTO' ||
                                esMonto
                                ? 'numeric'
                                : 'text'
                            }
                            onChange={(event) =>
                              onChangeCell(
                                index,
                                columna,
                                esCampoFecha(columna)
                                  ? event.target.value
                                  : columna === 'RUT'
                                    ? formatearRutEditable(event.target.value)
                                    : columna === 'N-CONTACTO'
                                      ? formatearContactoEditable(event.target.value)
                                  : sanitizarValorCelda(columna, event.target.value, columnasCuotaExtra)
                              )
                            }
                            className={`${anchoInput} rounded-lg px-2.5 py-1.5 text-[11px] ${
                              !validacion.valido
                                ? 'border-red-300 bg-red-50 text-red-700 ring-1 ring-red-200'
                                : filaActiva
                                  ? 'border-amber-300 bg-white ring-1 ring-amber-200'
                                  : 'border-slate-300 bg-white'
                            } ${
                              esMonto ? 'pl-6' : ''
                            }`}
                          />
                        </div>
                        {!validacion.valido ? (
                          <p className="mt-1 max-w-48 text-[10px] leading-tight text-red-600">
                            {validacion.sugerencia}
                          </p>
                        ) : null}
                      </td>
                    );
                  })}
                  <td
                    className={`px-2 py-1.5 sticky right-0 z-10 align-top shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.35)] ${
                      filaActiva ? 'bg-amber-50' : 'bg-white'
                    }`}
                  >
                    {filaActiva ? (
                      <div className="flex items-center justify-center gap-1 min-w-[72px]">
                        <button
                          onClick={confirmarEdicion}
                          disabled={guardando}
                          title="Confirmar"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
                        >
                          <IconoConfirmar />
                        </button>
                        <button
                          onClick={descartarEdicion}
                          disabled={guardando}
                          title="Descartar"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
                        >
                          <IconoDescartar />
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-[72px]" />
                    )}
                  </td>
                </tr>
              );
            })}

            {!cargando && filasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={columnas.length + 2} className="p-6 text-center text-slate-500">
                  No se encontraron filas con ese filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-slate-200 pt-3">
        <p className="text-xs md:text-sm text-slate-600">
          Pagina {paginaVisible} de {totalPaginas}
        </p>

        <div className="grid grid-cols-2 gap-2 md:flex">
          <button
            onClick={() => setPaginaActual((pagina) => Math.max(1, pagina - 1))}
            disabled={paginaVisible === 1}
            className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold disabled:opacity-50"
          >
            Anterior
          </button>

          <button
            onClick={() => setPaginaActual((pagina) => Math.min(totalPaginas, pagina + 1))}
            disabled={paginaVisible === totalPaginas}
            className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
