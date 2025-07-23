// frontend/js/app.js
import MapManager    from './mapManager.js';
import LayerManager  from './layerManager.js';
import FilterManager from './filterManager.js';
import UIManager     from './uiManager.js';

class App {
  constructor() {
    this.init();
  }

  async init() {
    // 1. Inicializa o mapa
    this.mapManager   = new MapManager();
    this.layerManager = new LayerManager(this.mapManager);

    // 2. Cria apenas o WMS de MapBiomas (não adicionamos mais o Fishnet WMS)
    const map = this.mapManager.getMap();
    const { mapBiomas } = this.layerManager.createWMSLayers();

    // Conecta loader aos eventos de tile
    mapBiomas.on('loading',   () => this.uiManager?.showLoading(true));
    mapBiomas.on('load',      () => this.uiManager?.showLoading(false));
    mapBiomas.on('tileerror', () => this.uiManager?.showError('Erro ao carregar camada'));

    // Adiciona ao mapa
    mapBiomas.addTo(map);

    // 3. Configura UI e exibe loader
    this.uiManager = new UIManager(this.mapManager);
    this.uiManager.showLoading(true);

    try {
      // 4. Carrega as camadas vetoriais
      const vectorLayers = await this.layerManager.loadVectorLayers();

      // 5. Ativa as camadas vetoriais que já devem vir marcadas
      this.layerManager.toggleLayer('estados', true);
      this.layerManager.toggleLayer('biomas',  true);

      // 6. Configura o filtro de desenho
      this.filterManager = new FilterManager(this.mapManager, this.layerManager);

      // 7. Finaliza a UI (controles, eventos e selects)
      this.uiManager.completeInit(this.layerManager, this.filterManager);
      this.uiManager.populateEstadoSelect();
      this.uiManager.populateBiomaSelect();

      // 8. Zoom inicial no Brasil
      this.mapManager.resetView();
    } catch (error) {
      console.error('Erro na inicialização:', error);
      this.uiManager.showError('Falha ao carregar dados');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new App());
