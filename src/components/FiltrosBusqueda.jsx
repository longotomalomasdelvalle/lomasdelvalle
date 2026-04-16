export default function FiltrosBusqueda({
  filtroNombre,
  filtroParcela,
  filtroSitio,
  setFiltroNombre,
  setFiltroParcela,
  setFiltroSitio
}) {
  return (
    <div className="grid md:grid-cols-3 gap-3 md:gap-4 mb-5 md:mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:p-4">
      <div>
        <label className="block text-xs md:text-sm font-medium text-slate-700 mb-2" htmlFor="filtro-nombre">
          Buscar por nombre completo
        </label>
        <input
          id="filtro-nombre"
          type="text"
          placeholder="Ej: Juan Perez Gonzalez"
          value={filtroNombre}
          onChange={(e) => setFiltroNombre(e.target.value)}
          className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-sm md:text-base outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-xs md:text-sm font-medium text-slate-700 mb-2" htmlFor="filtro-parcela">
          Buscar por parcela
        </label>
        <input
          id="filtro-parcela"
          type="text"
          placeholder="Ej: 5"
          value={filtroParcela}
          onChange={(e) => setFiltroParcela(e.target.value)}
          inputMode="numeric"
          className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-sm md:text-base outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="block text-xs md:text-sm font-medium text-slate-700 mb-2" htmlFor="filtro-sitio">
          Buscar por sitio
        </label>
        <input
          id="filtro-sitio"
          type="text"
          placeholder="Ej: 6"
          value={filtroSitio}
          onChange={(e) => setFiltroSitio(e.target.value)}
          inputMode="numeric"
          className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-sm md:text-base outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
    </div>
  );
}
