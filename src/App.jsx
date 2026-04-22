import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import EstadoCarga from './components/EstadoCarga';
import AdminAnalytics from './components/AdminAnalytics';
import AdminVecinosGrid from './components/AdminVecinosGrid';
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

function IconoTemaClaro() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2.5V4.5M10 15.5V17.5M2.5 10H4.5M15.5 10H17.5M4.7 4.7L6.1 6.1M13.9 13.9L15.3 15.3M13.9 6.1L15.3 4.7M4.7 15.3L6.1 13.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoTemaOscuro() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M11.4 2.8C8.5 3.5 6.3 6.1 6.3 9.2C6.3 12.8 9.2 15.7 12.8 15.7C14.8 15.7 16.6 14.8 17.8 13.3C17 16.3 14.2 18.5 10.9 18.5C7 18.5 3.8 15.3 3.8 11.4C3.8 8.1 6 5.3 9 4.5C9.8 4.3 10.6 4.1 11.4 2.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
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
  const [adminVista, setAdminVista] = useState('analitica');
  const [tema, setTema] = useState(() => localStorage.getItem('tema_lomas') || 'claro');
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
    ultimoRespaldoGithub,
    actualizarCelda,
    eliminarColumnaConfigurada,
    agregarFila,
    eliminarFila,
    reemplazarFila,
    guardarFilas,
    importarExcel,
    exportarExcel,
    exportarJson,
    respaldarGithub
  } = useAdminVecinos(logueado, recargar);

  useEffect(() => {
    const esOscuro = tema === 'oscuro';
    document.documentElement.classList.toggle('theme-dark', esOscuro);
    localStorage.setItem('tema_lomas', tema);
  }, [tema]);

  async function iniciarSesionAdmin() {
    const ok = await iniciarSesion(usuarioAdmin, claveAdmin);

    if (ok) {
      setAdminVista('analitica');
      setMostrarLogin(false);
      setUsuarioAdmin('');
      setClaveAdmin('');
    }
  }

  const filtroNombreDiferido = useDeferredValue(filtroNombre);
  const filtroParcelaDiferido = useDeferredValue(filtroParcela);
  const filtroSitioDiferido = useDeferredValue(filtroSitio);
  const { hayFiltrosActivos, vecinosFiltrados } = useMemo(
    () =>
      filtrarVecinos(vecinos, {
        filtroParcela: filtroParcelaDiferido,
        filtroSitio: filtroSitioDiferido,
        filtroNombre: filtroNombreDiferido
      }),
    [vecinos, filtroNombreDiferido, filtroParcelaDiferido, filtroSitioDiferido]
  );

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
    <div className="min-h-screen bg-slate-100 p-3 md:p-6 theme-transition">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 md:gap-4">
          <div className="flex items-center justify-end gap-2 lg:order-3 lg:self-start">
            <button
              onClick={() => setTema((actual) => (actual === 'oscuro' ? 'claro' : 'oscuro'))}
              className="inline-flex items-center justify-center bg-slate-100 text-slate-700 h-10 w-10 rounded-xl hover:bg-slate-200 transition"
              title={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {tema === 'oscuro' ? <IconoTemaClaro /> : <IconoTemaOscuro />}
            </button>
            {!logueado ? (
              <button
                onClick={volverAlInicio}
                className="inline-flex items-center justify-center bg-slate-100 text-slate-700 h-10 w-10 rounded-xl hover:bg-slate-200 transition"
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
                  className="bg-slate-900 text-white px-3.5 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition whitespace-nowrap"
                >
                  Cerrar sesion
                </button>
              </div>
            ) : (
              <button
                onClick={() => setMostrarLogin((valorActual) => !valorActual)}
                disabled={cargandoSesion}
                className="inline-flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition whitespace-nowrap"
              >
                <IconoAdministrador />
                {cargandoSesion ? 'Verificando...' : 'Iniciar sesion'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 md:gap-4 lg:flex-1">
            <button
              onClick={volverAlInicio}
              className="shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300"
              title="Ir al inicio"
            >
              <img
                src="/logo-lomas-del-valle.jpg"
                alt="Logo de Lomas del Valle"
                className="w-14 h-14 md:w-16 md:h-16 object-contain rounded-xl bg-white p-1.5 shadow"
              />
            </button>

            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                {tituloCabecera}
              </h1>
              {logueado ? (
                <p className="text-emerald-700 mt-1.5 text-xs md:text-sm font-medium">
                  Sesion administradora activa: {resumenAdmin?.usuario || 'Administrador'}
                </p>
              ) : (
                <p className="text-slate-500 mt-1.5 text-sm">
                  Consulta tu estado de pago por nombre, parcela o sitio.
                </p>
              )}
            </div>
          </div>
        </div>

        {logueado ? (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white border border-slate-200 p-2 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAdminVista('analitica')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    adminVista === 'analitica'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Analitica detallada
                </button>
                <button
                  onClick={() => setAdminVista('gestion')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    adminVista === 'gestion'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Gestion planilla
                </button>
              </div>
            </div>

            {adminVista === 'analitica' ? (
              <AdminAnalytics
                filas={filas}
                configuracion={configuracion}
                guardando={guardandoAdminVecinos}
                onReplaceRow={reemplazarFila}
                onSave={guardarFilas}
              />
            ) : null}

            {adminVista === 'gestion' ? (
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
                onImportExcel={importarExcel}
                onExportExcel={exportarExcel}
                onExportJson={exportarJson}
                onBackupGithub={respaldarGithub}
                ultimoRespaldoGithub={ultimoRespaldoGithub}
              />
            ) : null}
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
