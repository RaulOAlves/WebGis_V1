// === 1. Inicialização do mapa ===
const map = L.map("map").setView([-14.2, -51.9], 4);

// === 2. Camadas base ===
const baseRua = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
}).addTo(map);

const baseSatelite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "© Esri & NASA" }
);

// === 3. Configuração do GeoServer ===
const geoserverURL = "http://localhost:8080/geoserver";

// === 4. Variáveis globais para WMS e desenho ===
let layerRasterMapBiomas, layerVetorFishnet;
let drawnItems;

// === 5. Cria (ou recria) as camadas WMS ===
function criarCamadasWMS() {
    if (layerRasterMapBiomas) map.removeLayer(layerRasterMapBiomas);
    if (layerVetorFishnet)  map.removeLayer(layerVetorFishnet);

    layerRasterMapBiomas = L.tileLayer.wms(
        `${geoserverURL}/wms`,
        {
            layers: "proj_Muni_v0:brasil_coverage_2023",
            format: "image/png",
            transparent: true,
            tiled: true,
            version: "1.1.0",
            crs: L.CRS.EPSG4326,
            attribution: "MapBiomas 2023"
        }
    );

    layerVetorFishnet = L.tileLayer.wms(
        `${geoserverURL}/wms`,
        {
            layers: "proj_Muni_v0:Fishnet_Climatica_Taxa_desmatamento",
            format: "image/png",
            transparent: true,
            tiled: true,
            version: "1.1.0",
            crs: L.CRS.EPSG4326,
            attribution: "Fishnet Desmatamento"
        }
    );
}

// === 6. Funções de filtro WMS ===
function boundsToPolygonWKT(bounds) {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const coords = [
        `${sw.lng} ${sw.lat}`,
        `${ne.lng} ${sw.lat}`,
        `${ne.lng} ${ne.lat}`,
        `${sw.lng} ${ne.lat}`,
        `${sw.lng} ${sw.lat}`
    ].join(", ");
    return `POLYGON((${coords}))`;
}

function aplicarFiltroFishnet(bounds) {
    try {
        const wkt = boundsToPolygonWKT(bounds);
        if (map.hasLayer(layerVetorFishnet)) {
            layerVetorFishnet
                .setParams({ CQL_FILTER: `INTERSECTS(the_geom, ${wkt})`, _: Date.now() })
                .redraw();
        }
        if (map.hasLayer(layerRasterMapBiomas)) {
            layerRasterMapBiomas
                .setParams({ CQL_FILTER: `INTERSECTS(the_geom, ${wkt})`, _: Date.now() })
                .redraw();
        }
        showFilterStatus(true, bounds);
    } catch (e) {
        console.error("Erro ao aplicar filtro:", e);
        showFilterStatus(false);
    }
}

function removerFiltros() {
    if (layerVetorFishnet) {
        layerVetorFishnet.setParams({ CQL_FILTER: null, _: Date.now() }).redraw();
    }
    if (layerRasterMapBiomas) {
        layerRasterMapBiomas.setParams({ CQL_FILTER: null, _: Date.now() }).redraw();
    }
    showFilterStatus(false);
}

// === 7. Feedback visual dos filtros ===
function showFilterStatus(active, bounds = null) {
    const div = document.getElementById("filter-status") || createFilterStatusDiv();
    if (active && bounds) {
        div.innerHTML = `
            <div style="background:#28a745;color:#fff;padding:10px;border-radius:5px;margin:10px 0;">
                <strong>Filtro Ativo</strong><br>
                ${bounds.toBBoxString()}
                <button onclick="removerFiltros()" style="margin-left:10px;padding:5px;">Remover</button>
            </div>
        `;
    } else {
        div.innerHTML = `
            <div style="background:#6c757d;color:#fff;padding:10px;border-radius:5px;margin:10px 0;">
                <strong>Nenhum Filtro Ativo</strong>
            </div>
        `;
    }
}

function createFilterStatusDiv() {
    const d = document.createElement("div");
    d.id = "filter-status";
    d.style.position = "absolute";
    d.style.top = "10px";
    d.style.right = "10px";
    d.style.zIndex = "1000";
    document.body.appendChild(d);
    return d;
}

// === 8. Carrega GeoJSONs, vetoriais, WMS e inicializa controles ===
async function init() {
    // 8.1 Carrega GeoJSONs
    const [estadosData, municipiosData, biomasData] = await Promise.all([
        fetch("../data/processed/estados_brasil.geojson").then(r => r.json()),
        fetch("../data/processed/municipios_sp.geojson").then(r => r.json()),
        fetch("../data/processed/biomas_brasil.geojson").then(r => r.json())
    ]);

    // 8.2 Camadas vetoriais
    const layerEstados = L.geoJSON(estadosData, {
        style: { color: "#333", weight: 1, fillOpacity: 0.1 },
        onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.name_state}</strong>`)
    }).addTo(map);

    const coresBiomas = {
        "Amazônia": "#228B22",
        Cerrado: "#DAA520",
        Caatinga: "#C8705F",
        Pampa: "#66CDAA",
        Pantanal: "#5F9EA0",
        "Mata Atlântica": "#4682B4"
    };
    const layerBiomas = L.geoJSON(biomasData, {
        style: f => ({
            color: coresBiomas[f.properties.name_biome] || "#999",
            weight: 2,
            fillOpacity: 0.3
        }),
        onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.name_biome}</strong>`)
    }).addTo(map);

    const layerMunicipios = L.geoJSON(null, {
        style: { color: "#0066cc", weight: 1, fillOpacity: 0.2 },
        onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.name_muni}</strong>`)
    });

    // 8.3 Camadas WMS
    criarCamadasWMS();
    layerRasterMapBiomas.addTo(map);
    layerVetorFishnet.addTo(map);

    // 8.4 FeatureGroup de desenho
    drawnItems = new L.FeatureGroup().addTo(map);
    map.addControl(new L.Control.Draw({
        draw: { rectangle: true, polygon: true },
        edit: { featureGroup: drawnItems }
    }));

    map.on("draw:created", e => {
        drawnItems.clearLayers();
        drawnItems.addLayer(e.layer);
        aplicarFiltroFishnet(e.layer.getBounds());
    });
    map.on("draw:edited", e => e.layers.eachLayer(l => aplicarFiltroFishnet(l.getBounds())));
    map.on("draw:deleted", () => removerFiltros());

    // 8.5 Controle de camadas
    const baseMaps = {
        "Ruas": baseRua,
        "Satélite": baseSatelite
    };
    const overlays = {
        "Estados": layerEstados,
        "Biomas": layerBiomas,
        "Municípios SP": layerMunicipios,
        "Área Desenhada": drawnItems,
        "Raster MapBiomas": layerRasterMapBiomas,
        "Fishnet Desmatamento": layerVetorFishnet
    };
    L.control.layers(baseMaps, overlays, { position: "topright", collapsed: false }).addTo(map);

    map.fitBounds(layerEstados.getBounds());
    showFilterStatus(false);
}

// Expor global para botões
window.removerFiltros = removerFiltros;
window.aplicarFiltroFishnet = aplicarFiltroFishnet;

// Inicia quando DOM estiver pronto
document.addEventListener("DOMContentLoaded", init);
