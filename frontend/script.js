// === 1. Criar mapa base ===
const map = L.map("map").setView([-14.2, -51.9], 4);

// === 2. Bases ===
const baseRua = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

const baseSatelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "© Esri & NASA",
});

// === 3. Carregar GeoJSONs ===
const estados = fetch("../data/processed/estados_brasil.geojson").then(res => res.json());
const municipios = fetch("../data/processed/municipios_sp.geojson").then(res => res.json());
const biomas = fetch("../data/processed/biomas_brasil.geojson").then(res => res.json());

Promise.all([estados, municipios, biomas]).then(([estadosData, municipiosData, biomasData]) => {
  const estadoSelect = document.getElementById("estadoSelect");
  const biomaSelect = document.getElementById("biomaSelect");
  const muniSelect = document.getElementById("muniSelect");

  // === Camada de estados com popup + gráfico
  const layerEstados = L.geoJSON(estadosData, {
    onEachFeature: (feature, layer) => {
      const props = feature.properties;
      const html = `
        <strong>${props.name_state}</strong><br>
        UF: ${props.abbrev_state}<br>
        Região: ${props.name_region}<br>
        Código Estado: ${props.code_state}<br>
        <canvas id="grafico-${props.code_state}" width="200" height="100"></canvas>
      `;
      layer.bindPopup(html);

      layer.on("popupopen", () => {
        const ctx = document.getElementById(`grafico-${props.code_state}`);
        if (ctx) {
          new Chart(ctx, {
            type: "doughnut",
            data: {
              labels: ["População", "Infraestrutura", "Ambiental"],
              datasets: [{
                label: "Indicadores",
                data: [
                  Math.floor(Math.random() * 100),
                  Math.floor(Math.random() * 100),
                  Math.floor(Math.random() * 100)
                ],
                backgroundColor: ["#007bff", "#28a745", "#ffc107"]
              }]
            },
            options: {
              responsive: false,
              plugins: { legend: { display: true } }
            }
          });
        }
      });
    },
    style: { color: "#333", weight: 1 }
  }).addTo(map);

  map.fitBounds(layerEstados.getBounds());

  // === Camada de biomas com estilo temático
  function estiloBioma(feature) {
    const cores = {
      "Amazônia": "#228B22",
      "Cerrado": "#DAA520",
      "Caatinga": "#C8705F",
      "Pampa": "#66CDAA",
      "Pantanal": "#5F9EA0",
      "Mata Atlântica": "#4682B4"
    };
    return {
      color: cores[feature.properties.name_biome] || "#999",
      weight: 1,
      fillOpacity: 0.4
    };
  }

  const layerBiomas = L.geoJSON(biomasData, {
    onEachFeature: (feature, layer) => {
      layer.bindPopup(`<strong>${feature.properties.name_biome}</strong>`);
    },
    style: estiloBioma
  }).addTo(map);

  // === Camada de municípios SP
  const layerMunicipios = L.geoJSON(null, {
    onEachFeature: (feature, layer) => {
      layer.bindPopup(`<strong>${feature.properties.name_muni}</strong><br>Código: ${feature.properties.code_muni}`);
    },
    style: { color: "#0066cc", weight: 1 }
  }).addTo(map);

  // === Preencher select de estados
  estadosData.features.forEach((f) => {
    const option = document.createElement("option");
    option.value = f.properties.name_state;
    option.textContent = f.properties.name_state;
    estadoSelect.appendChild(option);
  });

  // === Preencher select de biomas
  const nomesBiomas = [...new Set(biomasData.features.map(f => f.properties.name_biome))];
  nomesBiomas.forEach(nome => {
    const option = document.createElement("option");
    option.value = nome;
    option.textContent = nome;
    biomaSelect.appendChild(option);
  });

  // === Filtro por estado
  estadoSelect.addEventListener("change", (e) => {
    const nomeSelecionado = e.target.value;
    muniSelect.innerHTML = '<option value="">-- Selecione um município --</option>';
    layerEstados.clearLayers();
    layerMunicipios.clearLayers();

    if (nomeSelecionado === "") {
      layerEstados.addData(estadosData);
      map.fitBounds(layerEstados.getBounds());
    } else {
      const estadoFiltrado = {
        ...estadosData,
        features: estadosData.features.filter(f => f.properties.name_state === nomeSelecionado)
      };
      layerEstados.addData(estadoFiltrado);
      map.fitBounds(layerEstados.getBounds());

      // === Atualizar municípios
      const codeUF = estadoFiltrado.features[0].properties.code_state;
      const municipiosFiltrados = municipiosData.features.filter(
        f => parseInt(f.properties.code_state) === parseInt(codeUF)
      );

      municipiosFiltrados.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = f.properties.name_muni;
        opt.textContent = f.properties.name_muni;
        muniSelect.appendChild(opt);
      });

      layerMunicipios.addData({
        ...municipiosData,
        features: municipiosFiltrados
      });
    }
  });

  // === Filtro por município
  muniSelect.addEventListener("change", (e) => {
    const nomeMuni = e.target.value;
    const nomeEstado = estadoSelect.value;
    layerMunicipios.clearLayers();

    if (nomeMuni === "") {
      const codeUF = estadosData.features.find(f => f.properties.name_state === nomeEstado)?.properties.code_state;
      const municipiosFiltrados = municipiosData.features.filter(m => m.properties.code_state === codeUF);
      layerMunicipios.addData({ ...municipiosData, features: municipiosFiltrados });
    } else {
      const municipioFiltrado = municipiosData.features.filter(f => f.properties.name_muni === nomeMuni);
      layerMunicipios.addData({ ...municipiosData, features: municipioFiltrado });
      map.fitBounds(L.geoJSON(municipioFiltrado).getBounds());
    }
  });

  // === Filtro por bioma
  biomaSelect.addEventListener("change", (e) => {
    const nomeSelecionado = e.target.value;
    layerBiomas.clearLayers();

    if (nomeSelecionado === "") {
      layerBiomas.addData(biomasData);
      map.fitBounds(layerBiomas.getBounds());
    } else {
      const biomaFiltrado = {
        ...biomasData,
        features: biomasData.features.filter(
          f => f.properties.name_biome === nomeSelecionado
        )
      };
      layerBiomas.addData(biomaFiltrado);
      map.fitBounds(layerBiomas.getBounds());
    }
  });

  // === Controle de camadas
  const baseMaps = {
    "Ruas": baseRua,
    "Satélite": baseSatelite
  };

  const overlayMaps = {
    "Estados": layerEstados,
    "Biomas": layerBiomas,
    "Municípios SP": layerMunicipios
  };

  L.control.layers(baseMaps, overlayMaps).addTo(map);
});
