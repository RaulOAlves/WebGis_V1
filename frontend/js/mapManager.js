// frontend/js/mapManager.js
class MapManager {
  constructor() {
    // coordenadas e zoom padrão
    this.defaultCenter = [-14.2, -51.9];
    this.defaultZoom   = 4;
    this.initMap();
  }

  initMap() {
    this.map = L.map('map')
      .setView(this.defaultCenter, this.defaultZoom);

    // --- Reinclude o base map ---
    this.baseLayers = {
      'Ruas': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }),
      'Satélite': L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri & NASA' }
      )
    };
    // adiciona Ruas por padrão
    this.baseLayers['Ruas'].addTo(this.map);

    return this.map;
  }

  getMap() {
    return this.map;
  }

  fitBounds(bounds) {
    this.map.fitBounds(bounds);
  }

  resetView() {
    this.map.setView(this.defaultCenter, this.defaultZoom);
  }
}

export default MapManager;
