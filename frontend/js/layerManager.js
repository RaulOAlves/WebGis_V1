// frontend/js/layerManager.js
class LayerManager {
  constructor(mapManager) {
    this.map = mapManager.getMap();
    this.layers = { vector: {}, raster: {} };
    this.geoserverURL = 'http://localhost:8080/geoserver';
  }

  async loadVectorLayers() {
    const [estados, biomas] = await Promise.all([
      fetch('../data/processed/estados_brasil.geojson').then(r => r.json()),
      fetch('../data/processed/biomas_brasil.geojson').then(r => r.json())
    ]);

    this.layers.vector.estados = L.geoJSON(estados, {
      style: { color: '#333', weight: 1, fillOpacity: 0.1 },
      onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.name_state}</strong>`)
    });

    const coresBiomas = {
      'Amazônia': '#228B22', 'Cerrado': '#DAA520', 'Caatinga': '#C8705F',
      'Pampa': '#66CDAA', 'Pantanal': '#5F9EA0', 'Mata Atlântica': '#4682B4'
    };
    this.layers.vector.biomas = L.geoJSON(biomas, {
      style: f => ({
        color: coresBiomas[f.properties.name_biome] || '#999',
        weight: 2, fillOpacity: 0.3
      }),
      onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.name_biome}</strong>`)
    });

    return this.layers.vector;
  }

  // frontend/js/layerManager.js
createWMSLayers() {
  const url = `${this.geoserverURL}/wms`;
  // parâmetros comuns
  const common = {
    format:      'image/png',
    transparent: true,
    tiled:       true,
    version:     '1.1.1',
    // **não** declare `crs` aqui
  };

  // MapBiomas
  this.layers.raster.mapBiomas = L.tileLayer.wms(url, {
    layers:       'proj_Muni_v0:brasil_coverage_2023',
    ...common,
    // permite filtrar mais tarde
    CQL_FILTER:   '',
    GEOMETRYNAME: 'the_geom'
  });

  // Fishnet
  this.layers.raster.fishnet = L.tileLayer.wms(url, {
    layers:       'proj_Muni_v0:Fishnet_Climatica_Taxa_desmatamento',
    ...common,
    CQL_FILTER:   '',
    GEOMETRYNAME: 'the_geom'
  });

  return this.layers.raster;
}


  toggleLayer(name, visible) {
    // vetorial
    if (this.layers.vector[name]) {
      visible
        ? this.map.addLayer(this.layers.vector[name])
        : this.map.removeLayer(this.layers.vector[name]);
    }
    // raster
    if (this.layers.raster[name]) {
      visible
        ? this.layers.raster[name].addTo(this.map)
        : this.map.removeLayer(this.layers.raster[name]);
    }
  }
}

export default LayerManager;
