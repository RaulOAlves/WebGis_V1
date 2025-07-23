// frontend/js/filterManager.js
class FilterManager {
  constructor(mapManager, layerManager) {
    this.map          = mapManager.getMap();
    this.layerManager = layerManager;
    this.drawnItems   = new L.FeatureGroup();
    this.initDrawControls();
  }

  initDrawControls() {
    this.map.addLayer(this.drawnItems);
    this.drawControl = new L.Control.Draw({
      draw: { rectangle: true, polygon: true, circle: false, marker: false, polyline: false },
      edit: { featureGroup: this.drawnItems }
    });
    this.map.addControl(this.drawControl);
    this.map.on('draw:created', e => this._onDraw(e.layer));
    this.map.on('draw:edited', e => e.layers.eachLayer(l => this._onDraw(l)));
    this.map.on('draw:deleted', () => this.clearFilters());
  }

  _onDraw(layer) {
    this.drawnItems.clearLayers().addLayer(layer);
    this.applyFilterLayer(layer);
  }

  geometryToWKT({ type, coordinates }) {
    if (type === 'Polygon') {
      const rings = coordinates
        .map(r => r.map(c => `${c[0]} ${c[1]}`).join(', '))
        .join('),(');
      return `POLYGON((${rings}))`;
    }
    if (type === 'MultiPolygon') {
      const polys = coordinates
        .map(poly => {
          const rings = poly
            .map(r => r.map(c => `${c[0]} ${c[1]}`).join(', '))
            .join('),(');
          return `((${rings}))`;
        })
        .join(',');
      return `MULTIPOLYGON(${polys})`;
    }
    throw new Error('Geometria não suportada: ' + type);
  }

    // frontend/js/filterManager.js
    applyFilterWKT(wkt) {
    Object.values(this.layerManager.layers.raster).forEach(layer => {
        const params = {
        CQL_FILTER:    `INTERSECTS(the_geom,'${wkt}')`,
        geometryName:  'the_geom',   // ← minúsculo!
        _:             Date.now()
        };
        console.log('🔍 setParams →', params);
        layer.setParams(params).redraw();
        console.log('🔍 wmsParams agora →', layer.wmsParams);
    });
    }


  applyFilterLayer(layer) {
    const wkt = this.geometryToWKT(layer.feature.geometry);
    this.applyFilterWKT(wkt);
  }

  clearFilters() {
    this.drawnItems.clearLayers();
    Object.values(this.layerManager.layers.raster).forEach(layer => {
      layer.setParams({ CQL_FILTER: null, _: Date.now() }).redraw();
    });
  }
}

export default FilterManager;
