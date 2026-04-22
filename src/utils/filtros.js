import { normalizarTexto } from './pagos.js';

export function filtrarVecinos(vecinos, filtros) {
  const { filtroParcela, filtroSitio, filtroNombre } = filtros;
  const parcelaBuscada = filtroParcela.trim();
  const sitioBuscado = filtroSitio.trim();
  const filtroNombreNormalizado = normalizarTexto(filtroNombre);
  const partesNombreBuscadas = filtroNombreNormalizado.split(' ').filter(Boolean);

  const hayFiltrosActivos =
    parcelaBuscada !== '' || sitioBuscado !== '' || filtroNombre.trim() !== '';

  if (!hayFiltrosActivos) {
    return {
      hayFiltrosActivos,
      vecinosFiltrados: []
    };
  }

  const vecinosFiltrados = vecinos.filter((vecino) => {
    const coincideParcela = parcelaBuscada ? vecino.parcela.includes(parcelaBuscada) : true;
    const coincideSitio = sitioBuscado ? vecino.sitio.includes(sitioBuscado) : true;
    const coincideNombre = partesNombreBuscadas.length > 0
      ? partesNombreBuscadas.every((parte) =>
          String(vecino.nombreBusqueda || normalizarTexto(vecino.nombre)).includes(parte)
        )
      : true;

    return coincideParcela && coincideSitio && coincideNombre;
  });

  return {
    hayFiltrosActivos,
    vecinosFiltrados
  };
}
