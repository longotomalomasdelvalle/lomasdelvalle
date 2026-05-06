import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import EstadoCarga from './components/EstadoCarga';
import AdminAnalytics from './components/AdminAnalytics';
import AdminVecinosGrid from './components/AdminVecinosGrid';
import AdminRespaldos from './components/AdminRespaldos';
import FiltrosBusqueda from './components/FiltrosBusqueda';
import LoginAdmin from './components/LoginAdmin';
import TarjetaVecino from './components/TarjetaVecino';
import ContactoModal from './components/ContactoModal';
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

function IconoLupa() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="9" cy="9" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoContacto() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M3.5 6.5H16.5V14.5H3.5V6.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 7L10 11L16.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoMenu() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4 6H16M4 10H16M4 14H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
  const [adminVista, setAdminVista] = useState(() => {
    if (typeof window === 'undefined') {
      return 'analitica';
    }
    const vistaGuardada = window.localStorage.getItem('lomas_admin_vista');
    return vistaGuardada || 'analitica';
  });
  const [vecinoSeleccionadoIndice, setVecinoSeleccionadoIndice] = useState(null);
  const [tema, setTema] = useState(() => localStorage.getItem('tema_lomas') || 'claro');
  const [mostrarContacto, setMostrarContacto] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [adminMenuAbierto, setAdminMenuAbierto] = useState(false);
  const [esMobile, setEsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
  );
  const detalleVecinoRef = useRef(null);
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
    importarExcel,
    exportarExcel,
    exportarJson,
    respaldarGithub,
    respaldarYBorrarPlanilla
  } = useAdminVecinos(logueado, recargar);

  useEffect(() => {
    const esOscuro = tema === 'oscuro';
    document.documentElement.classList.toggle('theme-dark', esOscuro);
    localStorage.setItem('tema_lomas', tema);
  }, [tema]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('lomas_admin_vista', adminVista);
  }, [adminVista]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    function actualizarModo() {
      setEsMobile(mediaQuery.matches);
    }

    actualizarModo();
    mediaQuery.addEventListener('change', actualizarModo);
    return () => mediaQuery.removeEventListener('change', actualizarModo);
  }, []);

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
  const indiceSeleccionadoSeguroDesktop = vecinosFiltrados.length
    ? Math.min(Math.max(vecinoSeleccionadoIndice ?? 0, 0), vecinosFiltrados.length - 1)
    : null;
  const indiceSeleccionadoSeguroMobile =
    vecinoSeleccionadoIndice !== null &&
    vecinoSeleccionadoIndice >= 0 &&
    vecinoSeleccionadoIndice < vecinosFiltrados.length
      ? vecinoSeleccionadoIndice
      : null;

  const vecinoSeleccionado = useMemo(
    () => {
      if (!vecinosFiltrados.length) {
        return null;
      }
      if (esMobile) {
        return indiceSeleccionadoSeguroMobile === null
          ? null
          : vecinosFiltrados[indiceSeleccionadoSeguroMobile] || null;
      }
      return indiceSeleccionadoSeguroDesktop === null
        ? null
        : vecinosFiltrados[indiceSeleccionadoSeguroDesktop] || null;
    },
    [vecinosFiltrados, esMobile, indiceSeleccionadoSeguroDesktop, indiceSeleccionadoSeguroMobile]
  );

  useEffect(() => {
    if (!esMobile || vecinoSeleccionadoIndice === null || !detalleVecinoRef.current) {
      return;
    }
    detalleVecinoRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [esMobile, vecinoSeleccionadoIndice]);

  const mostrarVistaPublica = !logueado && !mostrarLogin;
  const telefonoWhatsapp = String(import.meta.env.VITE_CONTACTO_WHATSAPP || '56900000000').replace(
    /\D/g,
    ''
  );
  const enlaceWhatsapp = `https://wa.me/${telefonoWhatsapp}?text=${encodeURIComponent(
    'Hola, necesito ayuda con Lomas del Valle Longotoma.'
  )}`;
  const claseContenedorPrincipal = logueado
    ? 'h-[calc(100dvh-1px)] overflow-hidden bg-slate-100 theme-transition'
    : 'min-h-screen bg-slate-100 p-1.5 md:p-3 xl:p-4 theme-transition';

  const adminNavegacion = [
    { key: 'gestion', etiqueta: 'Gestion de planilla' },
    { key: 'analitica', etiqueta: 'Analitica detallada' },
    { key: 'respaldos', etiqueta: 'Respaldos' }
  ];

  function volverAlInicio() {
    setMostrarLogin(false);
    setMostrarContacto(false);
    setMenuMovilAbierto(false);
    setVecinoSeleccionadoIndice(null);
    setFiltroNombre('');
    setFiltroParcela('');
    setFiltroSitio('');
  }

  return (
    <div className={claseContenedorPrincipal}>
      <div
        className={`w-full max-w-none mx-auto box-border ${
          logueado
            ? 'h-full p-1 md:p-2 xl:p-2.5 flex flex-col gap-2 md:gap-2.5 overflow-hidden'
            : 'space-y-3 md:space-y-4'
        }`}
      >
        {mostrarVistaPublica ? (
            <section className="rounded-2xl bg-white p-4 md:p-5 shadow-lg border border-slate-200">
              <div className="md:hidden mb-3">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                  <button
                    onClick={volverAlInicio}
                    className="shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                    title="Ir al inicio"
                  >
                    <img
                      src="/logo-lomas-del-valle.jpg"
                      alt="Logo de Lomas del Valle"
                      className="h-8 w-8 rounded object-cover"
                    />
                  </button>

                  <p className="flex-1 truncate text-sm font-semibold text-slate-800">
                    Lomas del Valle Longotoma
                  </p>

                  <div className="relative flex items-center gap-1.5">
                    <button
                      onClick={() => setTema((actual) => (actual === 'oscuro' ? 'claro' : 'oscuro'))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                      title={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    >
                      {tema === 'oscuro' ? <IconoTemaClaro /> : <IconoTemaOscuro />}
                    </button>

                    <button
                      onClick={() => setMenuMovilAbierto((valor) => !valor)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                      title="Menu"
                    >
                      <IconoMenu />
                    </button>

                    {menuMovilAbierto ? (
                      <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                        <button
                          onClick={volverAlInicio}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                        >
                          Inicio
                        </button>
                        <button
                          onClick={() => {
                            setMostrarContacto(true);
                            setMenuMovilAbierto(false);
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                        >
                          Contacto
                        </button>
                        <button
                          onClick={() => {
                            setMostrarLogin(true);
                            setMenuMovilAbierto(false);
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                        >
                          Iniciar sesion
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="hidden md:flex md:flex-row md:items-start md:justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={volverAlInicio}
                    className="shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
                    title="Ir al inicio"
                  >
                    <img
                      src="/logo-lomas-del-valle.jpg"
                      alt="Logo de Lomas del Valle"
                      className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                    />
                  </button>
                  <div>
                    <p className="text-xs text-slate-500">Bienvenidos Comunidad</p>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900">Lomas del Valle Longotoma</h1>
                    <p className="text-sm text-slate-500">Consulta tu estado de pago por nombre, parcela o sitio.</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={volverAlInicio}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <IconoInicio />
                    Inicio
                  </button>
                  <button
                    onClick={() => setMostrarContacto(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <IconoContacto />
                    Contacto
                  </button>
                  <button
                    onClick={() => setTema((actual) => (actual === 'oscuro' ? 'claro' : 'oscuro'))}
                    className="inline-flex items-center justify-center bg-slate-100 text-slate-700 h-9 w-9 rounded-lg hover:bg-slate-200 transition"
                    title={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  >
                    {tema === 'oscuro' ? <IconoTemaClaro /> : <IconoTemaOscuro />}
                  </button>
                  <button
                    onClick={() => setMostrarLogin(true)}
                    disabled={cargandoSesion}
                    className="inline-flex items-center justify-center bg-emerald-700 text-white h-9 w-9 rounded-lg hover:bg-emerald-600 transition"
                    title={cargandoSesion ? 'Verificando...' : 'Iniciar sesion administrador'}
                  >
                    <IconoAdministrador />
                  </button>
                </div>
              </div>

              <FiltrosBusqueda
                filtroNombre={filtroNombre}
                filtroParcela={filtroParcela}
                filtroSitio={filtroSitio}
                setFiltroNombre={(valor) => {
                  setFiltroNombre(valor);
                  setVecinoSeleccionadoIndice(null);
                }}
                setFiltroParcela={(valor) => {
                  setFiltroParcela(valor);
                  setVecinoSeleccionadoIndice(null);
                }}
                setFiltroSitio={(valor) => {
                  setFiltroSitio(valor);
                  setVecinoSeleccionadoIndice(null);
                }}
                onBuscar={() => {}}
              />

              <div className="space-y-3">
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
                  <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-600 mb-2">
                        Resultados ({vecinosFiltrados.length})
                      </p>
                      <div className="space-y-2 max-h-[540px] overflow-auto pr-1">
                        {vecinosFiltrados.map((vecino, index) => (
                          <button
                            key={vecino.id}
                            onClick={() => setVecinoSeleccionadoIndice(index)}
                            className={`w-full text-left rounded-lg border p-2.5 transition ${
                              index ===
                              (esMobile
                                ? indiceSeleccionadoSeguroMobile
                                : indiceSeleccionadoSeguroDesktop)
                                ? 'border-emerald-400 bg-emerald-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <p className="text-sm font-semibold text-slate-800 leading-tight">{vecino.nombre}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Parcela: {vecino.parcela} | Sitio: {vecino.sitio}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between">
                              <span className="text-xs text-emerald-700 font-medium">
                                Pagado ${vecino.totalPagado.toLocaleString('es-CL')}
                              </span>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full ${
                                  vecino.estado === 'Pagado'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {vecino.estado}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="min-w-0">
                      {vecinoSeleccionado ? (
                        <div
                          ref={detalleVecinoRef}
                          key={`detalle-${vecinoSeleccionadoIndice ?? 'none'}`}
                          className={esMobile ? 'mobile-detail-enter' : ''}
                        >
                          <TarjetaVecino vecino={vecinoSeleccionado} />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                          Selecciona un vecino para ver su detalle.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden lg:sticky lg:top-2 z-30 shrink-0">
            <div className="flex items-stretch">
              <button
                onClick={volverAlInicio}
                className="w-[120px] md:w-[138px] shrink-0 border-r border-slate-200 bg-slate-50 flex items-center justify-center"
                title="Ir al inicio"
              >
                <img
                  src="/logo-lomas-del-valle.jpg"
                  alt="Logo de Lomas del Valle"
                  className="w-14 h-14 md:w-[66px] md:h-[66px] object-contain rounded-lg bg-white"
                />
              </button>
              <div className="flex-1 min-w-0 px-3.5 py-2 md:px-4 md:py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] text-slate-600 leading-none">
                    Administración · Bienvenido,{' '}
                    <span className="text-emerald-700 font-semibold">
                      {resumenAdmin?.usuario || 'Administrador'}
                    </span>
                  </p>
                  <h1 className="text-[21px] md:text-[23px] leading-[1.05] font-semibold text-slate-900 mt-0.5">
                    Lomas del Valle Longotoma
                  </h1>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  <button
                    onClick={() => setTema((actual) => (actual === 'oscuro' ? 'claro' : 'oscuro'))}
                    className="inline-flex items-center gap-2 border border-slate-200 bg-white text-slate-700 h-9 px-3.5 rounded-lg hover:bg-slate-50 transition text-xs font-semibold"
                    title={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  >
                    {tema === 'oscuro' ? <IconoTemaClaro /> : <IconoTemaOscuro />}
                    {tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {logueado ? (
          <div className="flex-1 min-h-0 overflow-hidden lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-2.5 xl:gap-3">
            <aside className="hidden lg:flex lg:flex-col rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
              <div className="px-2 py-2 text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-500">
                Navegacion
              </div>
              <div className="space-y-1.5">
                {adminNavegacion.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setAdminVista(item.key)}
                    className={`w-full h-9 text-left px-3 rounded-xl text-[13px] font-medium transition ${
                      adminVista === item.key
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.etiqueta}
                  </button>
                ))}
              </div>
              <div className="mt-auto pt-4">
                <button
                  onClick={cerrarSesion}
                  className="w-full px-3 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition"
                >
                  Cerrar sesion
                </button>
              </div>
            </aside>

            <div className="space-y-3 lg:pr-1 text-[13px] min-h-0 overflow-auto rounded-2xl">
              <div className="lg:hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-2.5 flex items-center justify-between">
                <button
                  onClick={() => setAdminMenuAbierto(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold"
                >
                  <IconoMenu />
                  Menu
                </button>
                <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">
                  Administrador conectado
                </span>
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
                  onAddRow={() => {
                    setAdminVista('gestion');
                    agregarFila();
                  }}
                  onDeleteRow={eliminarFila}
                  onReplaceRow={reemplazarFila}
                  onSave={async (...args) => {
                    const resultado = await guardarFilas(...args);
                    setAdminVista('gestion');
                    return resultado;
                  }}
                  onImportExcel={importarExcel}
                  onExportExcel={exportarExcel}
                  onExportJson={exportarJson}
                  onBackupGithub={respaldarGithub}
                  onBackupAndReset={respaldarYBorrarPlanilla}
                />
              ) : null}

              {adminVista === 'respaldos' ? <AdminRespaldos /> : null}
            </div>

            {adminMenuAbierto && esMobile ? (
              <div className="lg:hidden fixed inset-0 z-40">
                <button
                  onClick={() => setAdminMenuAbierto(false)}
                  className="absolute inset-0 bg-slate-900/35"
                  aria-label="Cerrar menu"
                />
                <div className="absolute left-0 top-0 h-full w-[82%] max-w-[300px] bg-white shadow-2xl border-r border-slate-200 p-3 flex flex-col">
                  <div className="flex items-center justify-between px-1 py-2">
                    <p className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500">
                      Administracion
                    </p>
                    <button
                      onClick={() => setAdminMenuAbierto(false)}
                      className="text-slate-600 text-sm font-semibold px-2 py-1 rounded-lg hover:bg-slate-100"
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {adminNavegacion.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setAdminVista(item.key);
                          setAdminMenuAbierto(false);
                        }}
                        className={`w-full h-9 text-left px-3 rounded-xl text-[13px] font-medium transition ${
                          adminVista === item.key
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {item.etiqueta}
                      </button>
                    ))}
                  </div>
                  <div className="mt-auto pt-4">
                    <button
                      onClick={cerrarSesion}
                      className="w-full px-3 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition border border-red-200"
                    >
                      Cerrar sesion
                    </button>
                  </div>
                </div>
              </div>
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

        <ContactoModal
          abierto={mostrarContacto && !logueado}
          onCerrar={() => setMostrarContacto(false)}
          enlaceWhatsapp={enlaceWhatsapp}
        />

      </div>
    </div>
  );
}
