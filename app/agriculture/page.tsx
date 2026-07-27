"use client";

import { useEffect, useRef, useState } from "react";
import { ToolHeader } from "../components/ToolHeader";

const layerCatalog = [
  { id: "cultures", label: "Cultures déclarées", detail: "RPG 2024 · types de cultures", layer: "LANDUSE.AGRICULTURE2024", kind: "wmts", color: "linear-gradient(135deg,#f7e86a 0 25%,#00d822 25% 50%,#e54225 50% 75%,#099184 75%)", active: true },
  { id: "prairies", label: "Prairies permanentes", detail: "RPG 2024 · surfaces en herbe", layer: "IGNF_RPG_PRAIRIES-PERMANENTES_2024", kind: "wmts", color: "#ffda73", active: false },
  { id: "fermes", label: "Exploitations agricoles", detail: "SIRENE géolocalisé · établissements actifs", layer: "", kind: "farms", color: "#b8752a", active: true },
  { id: "haies", label: "Haies et bocage", detail: "Linéaires OSM · détail cliquable", layer: "", kind: "hedges", color: "#18753c", active: false },
  { id: "znieff1", label: "ZNIEFF de type I", detail: "Secteurs de fort intérêt écologique", layer: "Patrinat_ZNIEFF1", kind: "wmts", color: "#008b2d", active: false },
  { id: "znieff2", label: "ZNIEFF de type II", detail: "Grands ensembles naturels", layer: "Patrinat_ZNIEFF2", kind: "wmts", color: "#86ce8d", active: false },
];

const cultureNames: Record<string, string> = {
  BTH: "Blé tendre", BTN: "Blé tendre", BDH: "Blé dur", ORH: "Orge d’hiver", ORP: "Orge de printemps",
  MIS: "Maïs", MIE: "Maïs ensilage", MID: "Maïs doux", COL: "Colza", TOU: "Tournesol", SOJ: "Soja",
  PPH: "Prairie permanente", PTR: "Prairie temporaire", LU5: "Luzerne", J6S: "Jachère", VIG: "Vigne",
  VRG: "Verger", PTC: "Pois protéagineux", BET: "Betterave", POM: "Pomme de terre", LEG: "Légumes",
};

type CropYear = { year: number; code: string; name: string; surface: number; group?: string; feature?: any };
type AgricultureMode = "all" | "bio";
type BioParcel = { culture: string; group: string; surface: number; year: number };
type BioStat = { label: string; surface: number };
type EnvironmentItem = { label: string; names: string[] };
type Farm = { id: string; name: string; activity: string; address: string; commune: string; siret?: string; lat: number; lon: number; source: string };
type Hedge = { id: string; name: string; species: string; length: number; source: string };

function wmtsUrl(layer: string) {
  return `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`;
}

export default function AgriculturePage() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<Record<string, any>>({});
  const bioLayerRef = useRef<any>(null);
  const bioDataRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const parcelRef = useRef<any>(null);
  const farmsLayerRef = useRef<any>(null);
  const hedgesLayerRef = useRef<any>(null);
  const hedgesRequestRef = useRef(0);
  const hedgesEnabledRef = useRef(false);
  const [activeLayers, setActiveLayers] = useState<string[]>(["cultures", "fermes"]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Val-d’Oise");
  const [message, setMessage] = useState("Commencez par afficher les informations qui répondent à votre question.");
  const [cropHistory, setCropHistory] = useState<CropYear[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentItem[]>([]);
  const [agricultureMode, setAgricultureMode] = useState<AgricultureMode>("all");
  const [bioParcel, setBioParcel] = useState<BioParcel | null>(null);
  const [bioDataReady, setBioDataReady] = useState(false);
  const [bioStats, setBioStats] = useState<BioStat[]>([]);
  const [bioTotal, setBioTotal] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(10);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [selectedHedge, setSelectedHedge] = useState<Hedge | null>(null);
  const [farmCount, setFarmCount] = useState(0);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const launch = () => {
      const L = (window as any).L; if (!L || !mapNode.current || mapRef.current) return;
      const map = L.map(mapNode.current, { zoomControl: false, maxBoundsViscosity: .65 }).setView([49.075, 2.105], 10);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.createPane("baseTiles"); map.getPane("baseTiles").style.zIndex = "190";
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { pane: "baseTiles", maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      map.on("zoomend", () => setMapZoom(map.getZoom()));
      layerCatalog.filter((item) => item.kind === "wmts").forEach((item) => {
        const layer = L.tileLayer(wmtsUrl(item.layer), { minZoom: 6, maxZoom: 19, opacity: item.id === "cultures" ? .72 : .78, attribution: "© IGN · ASP · PatriNat" });
        overlaysRef.current[item.id] = layer;
        if (item.active) layer.addTo(map);
      });
      fetch("/data/cartobio-val-doise.geojson").then((response) => response.json()).then((data) => {
        bioDataRef.current = data;
        const totals = new Map<string, number>();
        data.features?.forEach((feature: any) => {
          const label = feature.properties?.groupe_culture || "Autres";
          totals.set(label, (totals.get(label) || 0) + Number(feature.properties?.surface_ha || 0));
        });
        setBioTotal([...totals.values()].reduce((sum, surface) => sum + surface, 0));
        setBioStats([...totals].map(([label, surface]) => ({ label, surface })).sort((a, b) => b.surface - a.surface).slice(0, 5));
        setBioDataReady(true);
      }).catch(() => undefined);
      fetch("https://geo.api.gouv.fr/departements/95/communes?fields=nom,code,contour&format=geojson&geometry=contour").then((r) => r.json()).then((communes) => {
        const holes: any[] = [];
        communes.features?.forEach((feature: any) => {
          const geometry = feature.geometry;
          if (geometry?.type === "Polygon" && geometry.coordinates?.[0]) holes.push(geometry.coordinates[0]);
          if (geometry?.type === "MultiPolygon") geometry.coordinates?.forEach((polygon: any) => { if (polygon?.[0]) holes.push(polygon[0]); });
        });
        L.geoJSON({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...holes] } }, {
          style: { stroke: false, fillColor: "#f4f7fb", fillOpacity: .82, fillRule: "evenodd" }, interactive: false,
        }).addTo(map);
        const territory = L.geoJSON(communes, { style: { color: "#667085", weight: .75, opacity: .58, fillOpacity: 0 }, interactive: false }).addTo(map);
        const bounds = territory.getBounds(); if (bounds.isValid()) { map.fitBounds(bounds, { padding: [25, 25] }); map.setMaxBounds(bounds.pad(.28)); }
      }).catch(() => undefined);
      map.on("click", (event: any) => locatePoint(event.latlng.lng, event.latlng.lat));
      map.on("moveend", () => { if (hedgesEnabledRef.current) loadHedgesInView(map); });
      mapRef.current = map;
      loadFarms(map);
    };
    if ((window as any).L) launch(); else {
      if (!document.getElementById("leaflet-css")) { const link = document.createElement("link"); link.id = "leaflet-css"; link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(link); }
      const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet="true"]');
      if (existing) existing.addEventListener("load", launch, { once: true }); else { const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.dataset.leaflet = "true"; script.onload = launch; document.body.appendChild(script); }
    }
  }, []);

  async function loadFarms(map: any) {
    const L = (window as any).L;
    try {
      const collected: Farm[] = [];
      for (let page = 1; page <= 6; page++) {
        const url = `https://recherche-entreprises.api.gouv.fr/search?departement=95&section_activite_principale=A&etat_administratif=A&per_page=25&page=${page}`;
        const response = await fetch(url);
        if (!response.ok) break;
        const data = await response.json();
        for (const company of data.results || []) {
          for (const establishment of company.matching_etablissements || []) {
            const lat = Number(establishment.latitude); const lon = Number(establishment.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            collected.push({
              id: establishment.siret || `${company.siren}-${lat}-${lon}`,
              name: company.nom_complet || company.nom_raison_sociale || "Exploitation agricole",
              activity: establishment.activite_principale || company.activite_principale || "Activité agricole",
              address: typeof establishment.adresse === "string" ? establishment.adresse : establishment.geo_adresse || establishment.libelle_voie || "Adresse non publiée",
              commune: establishment.libelle_commune || establishment.commune || "Val-d’Oise",
              siret: establishment.siret,
              lat, lon, source: "Répertoire SIRENE · API Recherche d’entreprises",
            });
          }
        }
        if (!data.results?.length || page >= Number(data.total_pages || page)) break;
      }
      if (!collected.length) {
        const centers = [[49.08,2.10],[49.12,1.78],[49.02,1.92],[49.05,2.35],[49.16,2.28]];
        for (const [lat, lon] of centers) {
          const response = await fetch(`https://recherche-entreprises.api.gouv.fr/near_point?lat=${lat}&long=${lon}&radius=25&section_activite_principale=A`);
          if (!response.ok) continue;
          const data = await response.json();
          for (const company of data.results || []) {
            for (const establishment of company.matching_etablissements || company.etablissements || []) {
              const farmLat = Number(establishment.latitude); const farmLon = Number(establishment.longitude);
              if (!Number.isFinite(farmLat) || !Number.isFinite(farmLon)) continue;
              collected.push({ id: establishment.siret || `${company.siren}-${farmLat}-${farmLon}`, name: company.nom_complet || company.nom_raison_sociale || "Exploitation agricole", activity: establishment.activite_principale || company.activite_principale || "Activité agricole", address: typeof establishment.adresse === "string" ? establishment.adresse : establishment.geo_adresse || "Adresse non publiée", commune: establishment.libelle_commune || establishment.commune || "Val-d’Oise", siret: establishment.siret, lat: farmLat, lon: farmLon, source: "Répertoire SIRENE · API Recherche d’entreprises" });
            }
          }
        }
      }
      const unique = [...new Map(collected.map((farm) => [farm.id, farm])).values()];
      farmsLayerRef.current = L.layerGroup(unique.map((farm) => {
        const marker = L.circleMarker([farm.lat, farm.lon], { radius: 5.5, color: "#fff", weight: 2, fillColor: "#b8752a", fillOpacity: .95 });
        marker.bindTooltip(farm.name, { direction: "top", offset: [0, -6] });
        marker.on("click", (event: any) => { L.DomEvent.stopPropagation(event); setSelectedFarm(farm); setSelectedHedge(null); setBioParcel(null); setCropHistory([]); setLocation(farm.name); setMessage("Siège d’exploitation agricole géolocalisé à partir du répertoire SIRENE."); setDetailsOpen(true); });
        return marker;
      }));
      setFarmCount(unique.length);
      if (activeLayers.includes("fermes")) farmsLayerRef.current.addTo(map);
    } catch { setFarmCount(0); }
  }

  async function loadHedgesInView(map = mapRef.current) {
    if (!map || !hedgesEnabledRef.current || map.getZoom() < 13) return;
    const requestId = ++hedgesRequestRef.current;
    const bounds = map.getBounds();
    const query = `[out:json][timeout:45];way["barrier"="hedge"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});out geom tags;`;
    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: query });
      if (!response.ok) throw new Error();
      const data = await response.json(); if (requestId !== hedgesRequestRef.current) return;
      const L = (window as any).L; if (hedgesLayerRef.current) map.removeLayer(hedgesLayerRef.current);
      hedgesLayerRef.current = L.layerGroup((data.elements || []).map((element: any) => {
        const coordinates = (element.geometry || []).map((point: any) => [point.lat, point.lon]);
        if (coordinates.length < 2) return null;
        const line = L.polyline(coordinates, { color: "#18753c", weight: 4, opacity: .9 });
        const length = coordinates.slice(1).reduce((sum: number, coordinate: any, index: number) => sum + map.distance(coordinates[index], coordinate), 0);
        const hedge: Hedge = { id: String(element.id), name: element.tags?.name || "Haie", species: element.tags?.species || element.tags?.genus || "Essences non renseignées", length, source: "OpenStreetMap · contributeurs" };
        line.bindTooltip(`${hedge.name} · ${Math.round(length)} m`, { sticky: true });
        line.on("click", (event: any) => { L.DomEvent.stopPropagation(event); setSelectedHedge(hedge); setSelectedFarm(null); setBioParcel(null); setCropHistory([]); setLocation(hedge.name); setMessage("Linéaire de haie sélectionné."); setDetailsOpen(true); });
        return line;
      }).filter(Boolean));
      hedgesLayerRef.current.addTo(map);
    } catch { /* Le fond IGN reste visible si Overpass ne répond pas. */ }
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.entries(overlaysRef.current).forEach(([id, layer]: [string, any]) => {
      const shouldShow = agricultureMode === "all" && activeLayers.includes(id);
      if (shouldShow && !map.hasLayer(layer)) layer.addTo(map);
      if (!shouldShow && map.hasLayer(layer)) map.removeLayer(layer);
    });
    if (farmsLayerRef.current) { const show = agricultureMode === "all" && activeLayers.includes("fermes"); if (show && !map.hasLayer(farmsLayerRef.current)) farmsLayerRef.current.addTo(map); if (!show && map.hasLayer(farmsLayerRef.current)) map.removeLayer(farmsLayerRef.current); }
    hedgesEnabledRef.current = activeLayers.includes("haies");
    if (!hedgesEnabledRef.current && hedgesLayerRef.current && map.hasLayer(hedgesLayerRef.current)) map.removeLayer(hedgesLayerRef.current);
    if (hedgesEnabledRef.current) loadHedgesInView(map);
    if (bioLayerRef.current) { map.removeLayer(bioLayerRef.current); bioLayerRef.current = null; }
    if (agricultureMode === "bio" && bioDataRef.current) {
      const L = (window as any).L;
      bioLayerRef.current = L.geoJSON(bioDataRef.current, {
        style: { color: "#18753c", weight: 1.4, fillColor: "#55a66b", fillOpacity: .55 },
        onEachFeature: (feature: any, layer: any) => layer.on("click", (event: any) => {
          L.DomEvent.stopPropagation(event);
          const properties = feature.properties || {};
          setBioParcel({ culture: properties.culture_nom || "Culture biologique", group: properties.groupe_culture || "Non renseigné", surface: Number(properties.surface_ha || 0), year: Number(properties.annee || 2024) });
          setCropHistory([]); setLocation("Parcelle certifiée bio"); setMessage("Parcelle CartoBio sélectionnée."); setDetailsOpen(true); loadEnvironment(event.latlng.lng, event.latlng.lat);
        }),
      }).addTo(map);
    }
  }, [agricultureMode, activeLayers, bioDataReady]);

  function toggleLayer(id: string) {
    if (agricultureMode === "bio") return;
    const map = mapRef.current; if (!map) return;
    setActiveLayers((current) => {
      const enabled = !current.includes(id); const next = enabled ? [...current, id] : current.filter((value) => value !== id);
      const layer = overlaysRef.current[id];
      if (layer) { if (enabled) layer.addTo(map); else map.removeLayer(layer); }
      if (id === "fermes" && farmsLayerRef.current) { if (enabled) farmsLayerRef.current.addTo(map); else map.removeLayer(farmsLayerRef.current); }
      if (id === "haies") { hedgesEnabledRef.current = enabled; if (enabled) setTimeout(() => loadHedgesInView(map), 0); else if (hedgesLayerRef.current) map.removeLayer(hedgesLayerRef.current); }
      return next;
    });
  }

  function changeAgricultureMode(mode: AgricultureMode) {
    setAgricultureMode(mode); setBioParcel(null);
    setMessage(mode === "bio" ? "Les parcelles certifiées bio sont affichées en vert." : "Commencez par afficher les informations qui répondent à votre question.");
  }

  async function loadEnvironment(lon: number, lat: number) {
    const geom = encodeURIComponent(JSON.stringify({ type: "Point", coordinates: [lon, lat] }));
    const sources = [
      ["ZNIEFF de type I", "znieff1"], ["ZNIEFF de type II", "znieff2"],
      ["Natura 2000 · habitats", "natura-habitat"], ["Natura 2000 · oiseaux", "natura-oiseaux"],
    ];
    try {
      const responses = await Promise.all(sources.map(([, endpoint]) => fetch(`https://apicarto.ign.fr/api/nature/${endpoint}?geom=${geom}`)));
      const collections = await Promise.all(responses.map((response) => response.ok ? response.json() : { features: [] }));
      setEnvironment(sources.map(([label], index) => ({ label, names: (collections[index].features || []).map((feature: any) => feature.properties?.nom_site || feature.properties?.nom || feature.properties?.site_name || "Zone identifiée") })));
    } catch { setEnvironment([]); }
  }

  async function locatePoint(lon: number, lat: number) {
    const L = (window as any).L; const map = mapRef.current;
    if (L && map) { if (markerRef.current) map.removeLayer(markerRef.current); markerRef.current = L.circleMarker([lat, lon], { radius: 7, color: "#e1000f", fillColor: "#fff", fillOpacity: 1, weight: 3 }).addTo(map); }
    setMessage("Lecture du RPG et du contexte environnemental…"); setAnalysisLoading(true); setCropHistory([]); setBioParcel(null); setSelectedFarm(null); setSelectedHedge(null); setEnvironment([]); setDetailsOpen(true); loadEnvironment(lon, lat);
    try {
      const geom = encodeURIComponent(JSON.stringify({ type: "Point", coordinates: [lon, lat] }));
      const [addressResponse, ...responses] = await Promise.all([
        fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}&limit=1`),
        fetch(`https://apicarto.ign.fr/api/rpg/v2?annee=2024&geom=${geom}`),
        fetch(`https://apicarto.ign.fr/api/rpg/v2?annee=2023&geom=${geom}`),
        fetch(`https://apicarto.ign.fr/api/rpg/v2?annee=2022&geom=${geom}`),
      ]);
      const data = await addressResponse.json(); const p = data.features?.[0]?.properties;
      setLocation(p ? `${p.city} · ${p.postcode}` : `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      const rpgData = await Promise.all(responses.slice(0, 3).map((response) => response.ok ? response.json() : { features: [] }));
      const history = rpgData.map((collection, index) => {
        const feature = collection.features?.[0]; const props = feature?.properties || {}; const code = props.code_cultu || "—";
        return feature ? { year: 2024 - index, code, name: cultureNames[code] || `Culture ${code}`, surface: Number(props.surf_parc || 0), group: props.code_group, feature } : null;
      }).filter(Boolean) as CropYear[];
      setCropHistory(history);
      if (parcelRef.current && map) map.removeLayer(parcelRef.current);
      if (history[0]?.feature && L && map) parcelRef.current = L.geoJSON(history[0].feature, { style: { color: "#000091", weight: 4, fillColor: "#fff", fillOpacity: .18 } }).addTo(map);
      setMessage(history.length ? "Parcelle RPG identifiée. Les informations détaillées sont affichées ci-dessous." : "Aucune parcelle déclarée au RPG n’a été trouvée à ce point.");
    } catch { setLocation(`${lat.toFixed(5)}, ${lon.toFixed(5)}`); setMessage("Le point est repéré, mais une source n’a pas répondu."); }
    finally { setAnalysisLoading(false); }
  }

  async function search(event: React.FormEvent) {
    event.preventDefault(); if (!query.trim()) return;
    setMessage("Recherche du lieu…");
    try {
      const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1&autocomplete=0`); const data = await response.json(); const feature = data.features?.[0];
      if (!feature) { setMessage("Lieu non trouvé dans la Base Adresse Nationale."); return; }
      const [lon, lat] = feature.geometry.coordinates; setQuery(feature.properties.label); mapRef.current?.setView([lat, lon], 15); await locatePoint(lon, lat);
    } catch { setMessage("La recherche est momentanément indisponible."); }
  }

  return <main className="agri-tool">
    <ToolHeader title="Observatoire agricole" subtitle="Cultures · prairies · haies · environnement" />
    <div className="agri-layout">
      <aside className="agri-panel">
        <div className="agri-intro"><span>Observatoire 03</span><h1>Lire les espaces agricoles</h1><p>Repérez les productions, les prairies et les continuités bocagères, puis croisez-les avec les secteurs d’intérêt écologique.</p></div>
        <form className="agri-search" onSubmit={search}><label htmlFor="agri-address">Rechercher une commune ou une adresse</label><div><input id="agri-address" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Marines, Cergy, 12 rue…" /><button>Localiser</button></div></form>
        <fieldset className="agriculture-mode" aria-label="Type d’agriculture"><div>
          <label><input type="radio" name="agriculture-mode" value="all" checked={agricultureMode === "all"} onChange={() => changeAgricultureMode("all")} /><span>Toutes les agricultures</span></label>
          <label><input type="radio" name="agriculture-mode" value="bio" checked={agricultureMode === "bio"} onChange={() => changeAgricultureMode("bio")} /><span>Bio uniquement</span></label>
        </div></fieldset>
        {agricultureMode === "bio" && bioStats.length > 0 && <section className="bio-chart"><div><strong>Surfaces bio</strong><small>{bioTotal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ha · principales cultures</small></div>{bioStats.map((item) => <div className="bio-chart-row" key={item.label}><span>{item.label}</span><i><em style={{ width: `${item.surface / bioStats[0].surface * 100}%` }} /></i><b>{item.surface.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ha</b></div>)}</section>}
        {agricultureMode === "all" && <section className="agri-layers"><div className="agri-section-title"><span>Choisir les informations</span><small>{activeLayers.length} couche(s) affichée(s)</small></div>{layerCatalog.map((item) => <label className="agri-layer" key={item.id}><input type="checkbox" checked={activeLayers.includes(item.id)} onChange={() => toggleLayer(item.id)} /><i style={{ background: item.color }} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></label>)}</section>}
        <a className="bio-link" href="https://www.agencebio.org/cartobio/" target="_blank" rel="noreferrer"><span><small>Agriculture biologique</small><strong>Explorer les parcelles certifiées bio</strong></span><b>↗</b></a>
      </aside>
      <section className="agri-map-wrap"><div className="agri-zoom-level"><strong>{mapZoom >= 13 ? "Détail territorial" : "Vue départementale"}</strong><span>{farmCount} exploitations géolocalisées</span></div><div className="agri-map-note"><strong>Cliquez sur la carte ou sur un objet</strong><span>Parcelle, exploitation, ferme bio ou haie : chaque objet ouvre sa fiche.</span></div><div ref={mapNode} className="agri-map" aria-label="Carte interactive des espaces agricoles du Val-d’Oise" /></section>
    </div>
    {detailsOpen && <aside className="observatory-drawer" aria-label="Détail agricole"><div className="observatory-drawer-head"><button onClick={() => setDetailsOpen(false)} aria-label="Fermer">×</button><small>Secteur observé</small><h2>{location}</h2><p>{message}</p></div><div className="observatory-drawer-body">
      {selectedFarm && <section className="crop-analysis"><div className="agri-section-title"><span>Exploitation agricole</span><small>SIRENE géolocalisé</small></div><div className="crop-primary farm-primary"><small>Établissement agricole actif</small><strong>{selectedFarm.name}</strong><span>{selectedFarm.activity}</span></div><div className="farm-detail-grid"><div><small>Commune</small><strong>{selectedFarm.commune}</strong></div><div><small>Adresse</small><strong>{selectedFarm.address}</strong></div><div><small>SIRET</small><strong>{selectedFarm.siret || "Non publié"}</strong></div><div><small>Source</small><strong>{selectedFarm.source}</strong></div></div><p className="ownership-note">Le point correspond au siège géocodé de l’établissement, pas nécessairement au centre de ses terres agricoles.</p></section>}
      {selectedHedge && <section className="crop-analysis"><div className="agri-section-title"><span>Haie sélectionnée</span><small>objet linéaire</small></div><div className="crop-primary hedge-primary"><small>Continuité bocagère</small><strong>{selectedHedge.name}</strong><span>{Math.round(selectedHedge.length)} m · {selectedHedge.species}</span></div><div className="farm-detail-grid"><div><small>Identifiant</small><strong>{selectedHedge.id}</strong></div><div><small>Source</small><strong>{selectedHedge.source}</strong></div></div><p className="ownership-note">Les haies vectorielles cliquables proviennent d’OpenStreetMap. La couche IGN reste disponible pour la lecture nationale de référence.</p></section>}
      {(analysisLoading || cropHistory.length > 0 || bioParcel) && <section className="crop-analysis"><div className="agri-section-title"><span>Lecture de la parcelle</span><small>{bioParcel ? "CartoBio · anonymisé" : "RPG public · anonymisé"}</small></div>{analysisLoading ? <p className="agri-loading">Analyse des millésimes agricoles…</p> : <>{bioParcel ? <div className="crop-primary"><small>Parcelle certifiée bio · {bioParcel.year}</small><strong>{bioParcel.culture}</strong><span>{bioParcel.surface.toLocaleString("fr-FR")} ha · {bioParcel.group}</span></div> : <><div className="crop-primary"><small>Culture déclarée en 2024</small><strong>{cropHistory[0]?.name}</strong><span>{cropHistory[0]?.surface.toLocaleString("fr-FR")} ha · code {cropHistory[0]?.code}</span></div><div className="crop-history"><strong>Historique cultural</strong>{cropHistory.map((crop) => <div key={crop.year}><b>{crop.year}</b><span>{crop.name}</span><i><em style={{ width: `${Math.min(100, Math.max(12, crop.surface * 5))}%` }} /></i><small>{crop.surface.toLocaleString("fr-FR")} ha</small></div>)}</div></>}<p className="ownership-note"><b>Exploitant non publié.</b> Les données parcellaires sont anonymisées.</p></>}</section>}
      {environment.length > 0 && <section className="agri-environment"><div className="agri-section-title"><span>Contexte environnemental</span><small>au point sélectionné</small></div>{environment.map((item) => <div key={item.label}><span>{item.label}</span><b className={item.names.length ? "inside" : ""}>{item.names.length ? item.names.join(" · ") : "Hors zone"}</b></div>)}</section>}
    </div></aside>}
  </main>;
}
