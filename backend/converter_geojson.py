import geopandas as gpd
from geobr import read_state, read_municipality, read_biomes

def salvar_geojson(gdf, nome_saida):
    gdf = gdf.to_crs(epsg=4326)
    caminho_saida = fr"/Volumes/Externo_Mac/00_Projetos/Projetos_Gis/webgis-mvp/data/processed/{nome_saida}.geojson"
    print(f"💾 Salvando {nome_saida} em {caminho_saida}")
    gdf.to_file(caminho_saida, driver="GeoJSON")

# === ESTADOS ===
print("🔽 Baixando estados do Brasil...")
estados = read_state(year=2020)
salvar_geojson(estados, "estados_brasil")

# === MUNICÍPIOS ===
print("🔽 Baixando municípios de SP...")
municipios_sp = read_municipality(code_muni=35, year=2022)  # 35 = SP
salvar_geojson(municipios_sp, "municipios_sp")

# === BIOMAS ===
print("🔽 Baixando biomas do Brasil...")
biomas = read_biomes(year=2019)
salvar_geojson(biomas, "biomas_brasil")

print("✅ Todos os arquivos foram convertidos com sucesso!")
