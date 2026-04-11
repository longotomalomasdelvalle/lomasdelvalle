export default function LoginAdmin({
  usuarioAdmin,
  claveAdmin,
  setUsuarioAdmin,
  setClaveAdmin,
  onSubmit,
  error,
  cargando
}) {
  return (
    <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Acceso administrador</h2>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Usuario"
            value={usuarioAdmin}
            onChange={(e) => setUsuarioAdmin(e.target.value)}
            disabled={cargando}
            className="border border-slate-300 rounded-2xl px-4 py-3"
          />

          <input
            type="password"
            placeholder="Contrasena"
            value={claveAdmin}
            onChange={(e) => setClaveAdmin(e.target.value)}
            disabled={cargando}
            className="border border-slate-300 rounded-2xl px-4 py-3"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={cargando}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-medium hover:bg-emerald-700 transition"
        >
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
