import { useState } from 'react';

function IconoUsuario() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M10 10.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 16c0-2.1 2.4-3.8 5.5-3.8s5.5 1.7 5.5 3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoCandado() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="4.5" y="8.5" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.2 8.5V6.9c0-1.6 1.3-2.9 2.8-2.9s2.8 1.3 2.8 2.9v1.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconoOjo({ abierto }) {
  if (abierto) {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
        <path d="M2.7 10s2.7-4.3 7.3-4.3S17.3 10 17.3 10s-2.7 4.3-7.3 4.3S2.7 10 2.7 10Z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M2.7 10s2.7-4.3 7.3-4.3S17.3 10 17.3 10s-2.7 4.3-7.3 4.3S2.7 10 2.7 10Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 4l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconoLogin() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="5" y="8.5" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 8.5V7a2.5 2.5 0 1 1 5 0v1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function LoginAdmin({
  usuarioAdmin,
  claveAdmin,
  setUsuarioAdmin,
  setClaveAdmin,
  onSubmit,
  error,
  cargando
}) {
  const [mostrarClave, setMostrarClave] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[500px] rounded-3xl border border-slate-300 bg-slate-50 p-6 md:p-7 shadow-xl">
      <div className="mb-3 flex justify-center">
        <img
          src="/logo-lomas-del-valle.jpg"
          alt="Lomas del Valle"
          className="h-28 w-auto object-contain"
        />
      </div>
      <h2 className="text-center text-3xl font-bold text-slate-700 leading-tight">Acceso administrador</h2>
      <p className="mt-1 text-center text-lg text-slate-500">Ingresa tus credenciales para continuar.</p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div>
          <p className="mb-1.5 text-sm font-semibold text-slate-700">Usuario</p>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-slate-400 focus-within:border-emerald-400">
            <IconoUsuario />
            <input
              type="text"
              placeholder="Ingresa tu usuario"
              value={usuarioAdmin}
              onChange={(e) => setUsuarioAdmin(e.target.value)}
              disabled={cargando}
              className="w-full bg-transparent text-base text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-slate-700">Contrasena</p>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-slate-400 focus-within:border-emerald-400">
            <IconoCandado />
            <input
              type={mostrarClave ? 'text' : 'password'}
              placeholder="Ingresa tu contrasena"
              value={claveAdmin}
              onChange={(e) => setClaveAdmin(e.target.value)}
              disabled={cargando}
              className="w-full bg-transparent text-base text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setMostrarClave((v) => !v)}
              className="text-slate-500 hover:text-slate-700"
              aria-label={mostrarClave ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            >
              <IconoOjo abierto={mostrarClave} />
            </button>
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={cargando}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 py-3 text-xl font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
        >
          <IconoLogin />
          {cargando ? 'Ingresando...' : 'Iniciar sesion'}
        </button>
      </form>
    </div>
  );
}
