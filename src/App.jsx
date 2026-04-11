import { useState } from 'react';
import EstadoCarga from './components/EstadoCarga';
import AdminVecinosGrid from './components/AdminVecinosGrid';
import EstadisticasAdmin from './components/EstadisticasAdmin';
import FiltrosBusqueda from './components/FiltrosBusqueda';
import LoginAdmin from './components/LoginAdmin';
import TarjetaVecino from './components/TarjetaVecino';
import useAdminVecinos from './hooks/useAdminVecinos';
import useAdminSession from './hooks/useAdminSession';
import useVecinos from './hooks/useVecinos';
import { filtrarVecinos } from './utils/filtros';

function IconoAdministrador() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M10 10.417C11.841 10.417 13.333 8.925 13.333 7.083C13.333 5.241 11.841 3.75 10 3.75C8.159 3.75 6.667 5.241 6.667 7.083C6.667 8.925 8.159 10.417 10 10.417Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.583 16.25C4.583 13.949 7.006 12.083 10 12.083C12.994 12.083 15.417 13.949 15.417 16.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconoInicio() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M3.75 8.542L10 3.75L16.25 8.542V15.417C16.25 15.877 15.877 16.25 15.417 16.25H4.583C4.123 16.25 3.75 15.877 3.75 15.417V8.542Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M7.917 16.25V11.667H12.083V16.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PortalPagosPasaje() {
  const [filtroParcela, setFiltroParcela] = useState('');
  const [filtroSitio, setFiltroSitio] = useState('');
  const [filtroNombre, setFiltroNombre] = useState('');
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [usuarioAdmin, setUsuarioAdmin] = useState('');
  const [claveAdmin, setClaveAdmin] = useState('');
  const {
    logueado,
    cargandoSesion,
    cargandoLogin,
    errorLogin,
    resumenAdmin,
    iniciarSesion,
    cerrarSesion
  } = useAdminSession();
  const { vecinos, cargando, errorCarga, recargar } = useVecinos();
  const {
    filas,
    configuracion,
    cargando: cargandoAdminVecinos,
    guardando: guardandoAdminVecinos,
    mensaje: mensajeAdminVecinos,
    error: errorAdminVecinos,
    actualizarCelda,
    eliminarColumnaConfigurada,
    agregarFila,
    eliminarFila,
    reemplazarFila,
    guardarFilas,
    normalizarPlanilla,
    importarExcel,
    exportarExcel,
    exportarJson
  } = useAdminVecinos(logueado, recargar);

  async function iniciarSesionAdmin() {
    const ok = await iniciarSesion(usuarioAdmin, claveAdmin);

    if (ok) {
      setMostrarLogin(false);
      setUsuarioAdmin('');
      setClaveAdmin('');
    }
  }

  const { hayFiltrosActivos, vecinosFiltrados } = filtrarVecinos(vecinos, {
    filtroParcela,
    filtroSitio,
    filtroNombre
  });

  const tituloCabecera = logueado
    ? 'Administracion Lomas del Valle Longotoma'
    : 'Bienvenidos Comunidad Lomas del Valle Longotoma';

  function volverAlInicio() {
    setMostrarLogin(false);
    setFiltroNombre('');
    setFiltroParcela('');
    setFiltroSitio('');
  }

  return (
    <div className="min-h-screen bg-slate-100 p-3 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl shadow-xl p-4 md:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 md:gap-6">
          <div className="flex items-center justify-end gap-2 lg:order-3 lg:self-start">
            {!logueado ? (
              <button
                onClick={volverAlInicio}
                className="inline-flex items-center justify-center bg-slate-100 text-slate-700 h-11 w-11 rounded-2xl hover:bg-slate-200 transition shadow-sm"
                title="Volver al inicio"
              >
                <IconoInicio />
              </button>
            ) : null}
            {logueado ? (
              <div className="flex items-center gap-2">
                <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl font-medium text-sm whitespace-nowrap">
                  Administrador conectado
                </div>
                <button
                  onClick={cerrarSesion}
                  className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-slate-700 transition whitespace-nowrap"
                >
                  Cerrar sesion
                </button>
              </div>
            ) : (
              <button
                onClick={() => setMostrarLogin((valorActual) => !valorActual)}
                disabled={cargandoSesion}
                className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl font-medium hover:bg-slate-700 transition whitespace-nowrap shadow-sm"
              >
                <IconoAdministrador />
                {cargandoSesion ? 'Verificando...' : 'Iniciar sesion'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 md:gap-4 lg:flex-1">
            <button
              onClick={volverAlInicio}
              className="shrink-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-300"
              title="Ir al inicio"
            >
              <img
                src="/logo-lomas-del-valle.jpg"
                alt="Logo de Lomas del Valle"
                className="w-16 h-16 md:w-24 md:h-24 object-contain rounded-2xl bg-white p-2 shadow"
              />
            </button>

            <div className="min-w-0">
              <h1 className="text-xl md:text-4xl font-bold text-slate-900 leading-tight">
                {tituloCabecera}
              </h1>
              {logueado ? (
                <p className="text-emerald-700 mt-2 text-xs md:text-sm font-medium">
                  Sesion administradora activa: {resumenAdmin?.usuario || 'Administrador'}
                </p>
              ) : (
                <p className="text-slate-500 mt-2 text-sm md:text-base">
                  Consulta tu estado de pago por nombre, parcela o sitio.
                </p>
              )}
            </div>
          </div>
        </div>

        {logueado ? (
          <div className="space-y-6">
            <EstadisticasAdmin filas={filas} configuracion={configuracion} />
            <AdminVecinosGrid
              filas={filas}
              configuracion={configuracion}
              cargando={cargandoAdminVecinos}
              guardando={guardandoAdminVecinos}
              mensaje={mensajeAdminVecinos}
              error={errorAdminVecinos}
              onChangeCell={actualizarCelda}
              onDeleteConfiguredColumn={eliminarColumnaConfigurada}
              onAddRow={agregarFila}
              onDeleteRow={eliminarFila}
              onReplaceRow={reemplazarFila}
              onSave={guardarFilas}
              onNormalize={normalizarPlanilla}
              onImportExcel={importarExcel}
              onExportExcel={exportarExcel}
              onExportJson={exportarJson}
            />
          </div>
        ) : null}

        {mostrarLogin && !logueado && (
          <LoginAdmin
            usuarioAdmin={usuarioAdmin}
            claveAdmin={claveAdmin}
            setUsuarioAdmin={setUsuarioAdmin}
            setClaveAdmin={setClaveAdmin}
            onSubmit={iniciarSesionAdmin}
            error={errorLogin}
            cargando={cargandoLogin}
          />
        )}

        {!logueado && !mostrarLogin ? (
          <div className="bg-white rounded-3xl shadow-xl p-4 md:p-8">
            <FiltrosBusqueda
              filtroNombre={filtroNombre}
              filtroParcela={filtroParcela}
              filtroSitio={filtroSitio}
              setFiltroNombre={setFiltroNombre}
              setFiltroParcela={setFiltroParcela}
              setFiltroSitio={setFiltroSitio}
            />

            <div className="space-y-4">
              {!hayFiltrosActivos || cargando || errorCarga || vecinosFiltrados.length === 0 ? (
                <EstadoCarga
                  cargando={cargando}
                  error={errorCarga}
                  sinResultados={
                    hayFiltrosActivos &&
                    !cargando &&
                    !errorCarga &&
                    vecinosFiltrados.length === 0
                  }
                />
              ) : (
                vecinosFiltrados.map((vecino) => <TarjetaVecino key={vecino.id} vecino={vecino} />)
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
