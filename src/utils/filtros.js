import { normalizarTexto } from './pagos.js';

export function filtrarVecinos(vecinos, filtros) {
  const { filtroParcela, filtroSitio, filtroNombre } = filtros;

  const hayFiltrosActivos =
    filtroParcela.trim() !== '' || filtroSitio.trim() !== '' || filtroNombre.trim() !== '';

  if (!hayFiltrosActivos) {
    return {
      hayFiltrosActivos,
      vecinosFiltrados: []
    };
  }

  const filtroNombreNormalizado = normalizarTexto(filtroNombre);

  const vecinosFiltrados = vecinos.filter((vecino) => {
    const coincideParcela = filtroParcela ? vecino.parcela.includes(filtroParcela.trim()) : true;
    const coincideSitio = filtroSitio ? vecino.sitio.includes(filtroSitio.trim()) : true;
    const coincideNombre = filtroNombreNormalizado
      ? filtroNombreNormalizado
          .split(' ')
          .filter(Boolean)
          .every((parte) => normalizarTexto(vecino.nombre).includes(parte))
      : true;

    return coincideParcela && coincideSitio && coincideNombre;
  });

  return {
    hayFiltrosActivos,
    vecinosFiltrados
  };
}
