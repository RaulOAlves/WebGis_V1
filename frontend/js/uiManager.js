// frontend/js/uiManager.js
class UIManager {
  constructor(mapManager) {
    this.mapManager   = mapManager;
    this.map          = mapManager.getMap();
    this.fishnetLayer = null;    // guardará o recorte Turf
    this.initUI();
  }

  initUI() {
    this.createFilterStatusPanel();
    this.setupPanelToggle();
  }

  completeInit(layerManager, filterManager) {
    this.layerManager  = layerManager;
    this.filterManager = filterManager;

    this.setupToolbarEvents();
    this.setupLayerControls();
    this.populateEstadoSelect();
    this.populateBiomaSelect();
    this.setupEventListeners();
  }

  populateEstadoSelect() {
    const sel = document.getElementById('estadoSelect');
    sel.innerHTML = '<option value="">-- Todos Estados --</option>';
    this.layerManager.layers.vector.estados.eachLayer(layer => {
      const nome = layer.feature.properties.name_state;
      const opt  = document.createElement('option');
      opt.value   = nome;
      opt.text    = nome;
      sel.append(opt);
    });
    sel.disabled = false;
  }

  populateBiomaSelect() {
    const sel = document.getElementById('biomaSelect');
    sel.innerHTML = '<option value="">-- Todos Biomas --</option>';
    ['Amazônia','Cerrado','Caatinga','Pampa','Pantanal','Mata Atlântica']
      .forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.text  = b;
        sel.append(opt);
      });
  }

  createFilterStatusPanel() {
    this.statusPanel = L.control({ position: 'topright' });
    this.statusPanel.onAdd = () => {
      this.statusContainer = L.DomUtil.create('div', 'filter-status');
      this.updateStatus(false);
      return this.statusContainer;
    };
    this.statusPanel.addTo(this.map);
  }

  setupPanelToggle() {
    const btn   = document.getElementById('togglePanel');
    const panel = document.getElementById('controlPanel');
    btn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      btn.querySelector('i').classList.toggle('fa-chevron-left');
      btn.querySelector('i').classList.toggle('fa-chevron-right');
    });
  }

  setupToolbarEvents() {
    document.getElementById('drawPolygon').addEventListener('click', () =>
      new L.Draw.Polygon(this.map, this.filterManager.drawControl.options.draw.polygon).enable()
    );
    document.getElementById('drawRectangle').addEventListener('click', () =>
      new L.Draw.Rectangle(this.map, this.filterManager.drawControl.options.draw.rectangle).enable()
    );
    document.getElementById('clearDrawing').addEventListener('click', () => {
      this.filterManager.clearFilters();
      this.updateStatus(false);
      this.mapManager.resetView();
    });
    document.getElementById('zoomToBrazil').addEventListener('click', () =>
      this.mapManager.resetView()
    );
  }

  setupLayerControls() {
    const container = document.getElementById('layerControls');
    container.innerHTML = ''; // limpa controles

    const layers = {
      estados:   'Estados',
      biomas:    'Biomas',
      mapBiomas: 'MapBiomas'
    };

    Object.entries(layers).forEach(([id,label]) => {
      const div = document.createElement('div');
      div.className = 'layer-item';
      div.innerHTML = `
        <input type="checkbox" id="toggle_${id}"
          ${['estados','biomas','mapBiomas'].includes(id)?'checked':''}>
        <label for="toggle_${id}">${label}</label>
      `;
      container.append(div);
      div.querySelector('input').addEventListener('change', e => {
        this.layerManager.toggleLayer(id, e.target.checked);
      });
    });
  }

  setupEventListeners() {
    // >>> ESTADO: zoom + recorte WFS+Turf
    document.getElementById('estadoSelect').addEventListener('change', async e => {
      const nome = e.target.value;
      this._clearStateFilter();
      this.updateStatus(false);

      if (!nome) {
        this.mapManager.resetView();
        return;
      }

      // 1) Acha o layer do estado
      let estadoLayer;
      this.layerManager.layers.vector.estados.eachLayer(l => {
        if (l.feature.properties.name_state === nome) estadoLayer = l;
      });
      if (!estadoLayer) return;

      // 2) Zoom naquele estado
      const bounds = estadoLayer.getBounds();
      this.mapManager.fitBounds(bounds);
      this.updateStatus(true, bounds);

      // 3) WFS + Turf para recorte
      try {
        this.showLoading(true);
        const url =
          'http://localhost:8080/geoserver/proj_Muni_v0/ows?' +
          'service=WFS&version=1.0.0&request=GetFeature&' +
          'typeName=proj_Muni_v0:Fishnet_Climatica_Taxa_desmatamento&' +
          'outputFormat=application/json';
        const resp = await fetch(url);
        const json = await resp.json();

        // 4) Intersect exato de cada hexágono com o estado
        const feats = [];
        json.features.forEach(feat => {
          const inter = turf.intersect(feat, estadoLayer.feature);
          if (inter) feats.push(inter);
        });
        const clipped = turf.featureCollection(feats);

        // 5) Desenha no mapa
        this.fishnetLayer = L.geoJSON(clipped, {
          style: { color: '#ff0000', weight: 1 }
        }).addTo(this.map);

      } catch (err) {
        console.error('Erro WFS Fishnet:', err);
        this.showError('Falha ao carregar Fishnet');
      } finally {
        this.showLoading(false);
      }
    });

    // >>> BIOMA: mantém o filtro por bbox via FilterManager
    document.getElementById('biomaSelect').addEventListener('change', e => {
      const nome = e.target.value;
      this._clearStateFilter();
      this.updateStatus(false);

      if (!nome) {
        this.filterManager.clearFilters();
        this.mapManager.resetView();
        return;
      }
      let b;
      this.layerManager.layers.vector.biomas.eachLayer(l => {
        if (l.feature.properties.name_biome === nome) b = l.getBounds();
      });
      if (!b) return;
      this.filterManager.applyFilter(b);
      this.mapManager.fitBounds(b);
      this.updateStatus(true, b);
    });

    // btns Aplicar / Limpar
    document.getElementById('applyFilter').addEventListener('click', () =>
      alert('Filtro aplicado com sucesso!')
    );
    document.getElementById('clearFilter').addEventListener('click', () => {
      this.filterManager.clearFilters();
      this._clearStateFilter();
      this.updateStatus(false);
      document.getElementById('estadoSelect').value  = '';
      document.getElementById('biomaSelect').value   = '';
      this.mapManager.resetView();
    });
  }

  _clearStateFilter() {
    if (this.fishnetLayer) {
      this.map.removeLayer(this.fishnetLayer);
      this.fishnetLayer = null;
    }
  }

  updateStatus(active, bounds = null) {
    if (active && bounds) {
      this.statusContainer.innerHTML = `
        <div class="status-active">
          <strong>Filtro Ativo</strong><br>${bounds.toBBoxString()}
          <button class="btn-clear-filter">Remover</button>
        </div>
      `;
      this.statusContainer.querySelector('.btn-clear-filter')
        .addEventListener('click', () => {
          this.filterManager.clearFilters();
          this._clearStateFilter();
          this.updateStatus(false);
          this.mapManager.resetView();
        });
    } else {
      this.statusContainer.innerHTML = `
        <div class="status-inactive">
          <strong>Nenhum Filtro Ativo</strong>
        </div>
      `;
    }
  }

  showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    loader.classList[ show ? 'add' : 'remove' ]('active');
  }

  showError(msg) {
    const div = document.getElementById('mapStatus');
    div.innerHTML = `<div class="error-message">${msg}</div>`;
    setTimeout(() => div.innerHTML = '', 5000);
  }
}

export default UIManager;
