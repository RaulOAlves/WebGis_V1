// === 1. Criar mapa base ===
const map = L.map("map").setView([-14.2, -51.9], 4);

// === 2. Bases ===
const baseRua = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

const baseSatelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "© Esri & NASA",
});

// === 3. Camadas WMS do GeoServer ===
const geoserverURL = "http://localhost:8080/geoserver";

const layerRasterMapBiomas = L.tileLayer.wms(`${geoserverURL}/proj_Muni_v0/wms`, {
  layers: "proj_Muni_v0:brasil_coverage_2023",
  format: "image/png",
  transparent: true,
  tiled: true,
  attribution: "MapBiomas 2023"
});

const layerVetorFishnet = L.tileLayer.wms(`${geoserverURL}/proj_Muni_v0/wms`, {
  layers: "proj_Muni_v0:Fishnet_Climatica_Taxa_desmatamento",
  format: "image/png",
  transparent: true,
  tiled: true,
  attribution: "Fishnet"
});

// === 4. Camadas locais GeoJSON ===
async function carregarGeojsons() {
  const [estadosData, municipiosData, biomasData] = await Promise.all([
    fetch("../data/processed/estados_brasil.geojson").then(res => res.json()),
    fetch("../data/processed/municipios_sp.geojson").then(res => res.json()),
    fetch("../data/processed/biomas_brasil.geojson").then(res => res.json())
  ]);

  const estadoSelect = document.getElementById("estadoSelect");
  const biomaSelect = document.getElementById("biomaSelect");
  const muniSelect = document.getElementById("muniSelect");

  const layerEstados = L.geoJSON(estadosData, {
    onEachFeature: (feature, layer) => {
      const props = feature.properties;
      layer.bindPopup(`
        <strong>${props.name_state}</strong><br>
        UF: ${props.abbrev_state}<br>
        Código: ${props.code_state}<br>
        <canvas id="grafico-${props.code_state}" width="200" height="100"></canvas>
      `);
      layer.on("popupopen", () => {
        const ctx = document.getElementById(`grafico-${props.code_state}`);
        new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["População", "Infraestrutura", "Ambiental"],
            datasets: [{
              data: [Math.random()*100, Math.random()*100, Math.random()*100],
              backgroundColor: ["#007bff", "#28a745", "#ffc107"]
            }]
          },
          options: { responsive: false }
        });
      });
    },
    style: { color: "#333", weight: 1 }
  }).addTo(map);

  const coresBiomas = {
    "Amazônia": "#228B22", "Cerrado": "#DAA520", "Caatinga": "#C8705F",
    "Pampa": "#66CDAA", "Pantanal": "#5F9EA0", "Mata Atlântica": "#4682B4"
  };

  const layerBiomas = L.geoJSON(biomasData, {
    style: f => ({ color: coresBiomas[f.properties.name_biome] || "#999", weight: 1, fillOpacity: 0.4 }),
    onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.name_biome}</strong>`)
  }).addTo(map);

  const layerMunicipios = L.geoJSON(null, {
    onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.name_muni}</strong>`),
    style: { color: "#0066cc", weight: 1 }
  }).addTo(map);

  estadosData.features.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.properties.name_state;
    opt.textContent = f.properties.name_state;
    estadoSelect.appendChild(opt);
  });

  [...new Set(biomasData.features.map(f => f.properties.name_biome))].forEach(nome => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    biomaSelect.appendChild(opt);
  });

  estadoSelect.addEventListener("change", e => {
    const estado = e.target.value;
    layerEstados.clearLayers();
    layerMunicipios.clearLayers();
    muniSelect.innerHTML = "<option value=''>-- Selecione --</option>";

    if (estado === "") {
      layerEstados.addData(estadosData);
    } else {
      const estadoFiltrado = estadosData.features.find(f => f.properties.name_state === estado);
      const estadoCode = estadoFiltrado.properties.code_state;
      const bounds = L.geoJSON(estadoFiltrado).getBounds();
      const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

      layerEstados.addData({ ...estadosData, features: [estadoFiltrado] });

      const municipiosFiltrados = municipiosData.features.filter(f => f.properties.code_state == estadoCode);
      layerMunicipios.addData({ ...municipiosData, features: municipiosFiltrados });

      municipiosFiltrados.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.properties.name_muni;
        opt.textContent = f.properties.name_muni;
        muniSelect.appendChild(opt);
      });

      layerRasterMapBiomas.setParams({ BBOX: bbox });
      layerVetorFishnet.setParams({
        CQL_FILTER: `INTERSECTS(the_geom, POLYGON((${bounds.getWest()} ${bounds.getSouth()}, ${bounds.getEast()} ${bounds.getSouth()}, ${bounds.getEast()} ${bounds.getNorth()}, ${bounds.getWest()} ${bounds.getNorth()}, ${bounds.getWest()} ${bounds.getSouth()})))`
      });
    }
  });

  muniSelect.addEventListener("change", e => {
    const nomeMuni = e.target.value;
    const nomeEstado = estadoSelect.value;
    layerMunicipios.clearLayers();
    if (nomeMuni === "") {
      estadoSelect.dispatchEvent(new Event("change"));
    } else {
      const muniFiltrado = municipiosData.features.filter(f => f.properties.name_muni === nomeMuni);
      layerMunicipios.addData({ ...municipiosData, features: muniFiltrado });
      map.fitBounds(L.geoJSON(muniFiltrado).getBounds());
    }
  });

  biomaSelect.addEventListener("change", e => {
    const nome = e.target.value;
    layerBiomas.clearLayers();
    if (nome === "") {
      layerBiomas.addData(biomasData);
    } else {
      const filtrado = biomasData.features.filter(f => f.properties.name_biome === nome);
      layerBiomas.addData({ ...biomasData, features: filtrado });
      map.fitBounds(L.geoJSON(filtrado).getBounds());
    }
  });

  const drawnItems = new L.FeatureGroup().addTo(map);
  const drawControl = new L.Control.Draw({
    draw: { polygon: true, rectangle: true, circle: false, marker: false, polyline: false },
    edit: { featureGroup: drawnItems }
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, e => {
    drawnItems.clearLayers();
    const layer = e.layer;
    drawnItems.addLayer(layer);

    const bounds = layer.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    layerRasterMapBiomas.setParams({ BBOX: bbox });
    layerVetorFishnet.setParams({
      CQL_FILTER: `INTERSECTS(the_geom, POLYGON((${bounds.getWest()} ${bounds.getSouth()}, ${bounds.getEast()} ${bounds.getSouth()}, ${bounds.getEast()} ${bounds.getNorth()}, ${bounds.getWest()} ${bounds.getNorth()}, ${bounds.getWest()} ${bounds.getSouth()})))`
    });
  });

  const baseMaps = { "Ruas": baseRua, "Satélite": baseSatelite };
  const overlayMaps = {
    "Estados": layerEstados,
    "Biomas": layerBiomas,
    "Municípios SP": layerMunicipios,
    "Máscara Desenhada": drawnItems,
    "Raster MapBiomas": layerRasterMapBiomas,
    "Fishnet Desmatamento": layerVetorFishnet
  };
  L.control.layers(baseMaps, overlayMaps).addTo(map);

  layerRasterMapBiomas.addTo(map);
  layerVetorFishnet.addTo(map);

  map.fitBounds(layerEstados.getBounds());
}

carregarGeojsons();