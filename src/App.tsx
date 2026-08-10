"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

declare global { interface Window { L: any } }

type Status = "idle" | "loading" | "ok" | "empty" | "error";
type ParcelHistory = { year:number; code:string; label:string; group:string; surface:number; id:string; feature:any };
type Parcel = ParcelHistory & { history:ParcelHistory[]; historyUnavailable:number[] };
type Farm = { name: string; activity: string; source: string; lat: number; lon: number; siret?: string; commune?: string; address?: string; bio?: boolean; created?: string; category?: string };
type Commune = { name: string; code: string };
type Cadastre = { section:string; numero:string; idu:string; contenance:number; gid:string; feature:any };

const layers = [
  { id: "rpg", label: "Parcelles agricoles", detail: "RPG 2024 · couleurs par culture", color: "linear-gradient(135deg,#f2ea73 0 25%,#55e96a 25% 50%,#d9aa48 50% 75%,#4d9698 75%)" },
  { id: "bio", label: "Parcelles biologiques", detail: "CartoBio · Agence Bio", color: "#18753c" },
  { id: "farms", label: "Fermes et exploitations", detail: "SIRENE · 1 133 établissements actifs", color: "#18753c" },
  { id: "coops", label: "Coopératives agricoles", detail: "SIRENE · établissements géolocalisés", color: "#6a4c93" },
  { id: "equipment", label: "Matériel agricole", detail: "SIRENE · commerce de gros · 46.61Z", color: "#c65d21" },
  { id: "hedges", label: "Haies et bocage", detail: "BD Haie · IGN", color: "#2f6b3c" },
  { id: "water", label: "Cours d’eau", detail: "Géoportail · IGN", color: "#0078f3" },
  { id: "cadastre", label: "Parcelles cadastrales", detail: "Parcellaire Express · visible dès le zoom 14", color: "#6f00d9" },
];

const cropNames: Record<string,string> = {
  BTH:"Blé tendre", BTN:"Blé tendre", BDH:"Blé dur", ORH:"Orge d’hiver", ORP:"Orge de printemps",
  MIS:"Maïs", MIE:"Maïs ensilage", COL:"Colza", TOU:"Tournesol", PPH:"Prairie permanente",
  PTR:"Prairie temporaire", LU5:"Luzerne", J6S:"Jachère", VIG:"Vigne", VRG:"Verger",
  PTC:"Pois protéagineux", BET:"Betterave", POM:"Pomme de terre", LEG:"Légumes",
};
const activityNames:Record<string,string>={
  "01.11Z":"Culture de céréales, légumineuses et graines oléagineuses","01.13Z":"Culture de légumes, melons, racines et tubercules",
  "01.19Z":"Autres cultures non permanentes","01.21Z":"Culture de la vigne","01.24Z":"Culture de fruits à pépins et à noyau",
  "01.25Z":"Culture d’autres fruits d’arbres ou d’arbustes","01.30Z":"Reproduction de plantes","01.41Z":"Élevage de vaches laitières",
  "01.42Z":"Élevage d’autres bovins et de buffles","01.43Z":"Élevage de chevaux","01.45Z":"Élevage d’ovins et de caprins",
  "01.46Z":"Élevage de porcins","01.47Z":"Élevage de volailles","01.50Z":"Culture et élevage associés",
  "01.61Z":"Activités de soutien aux cultures","01.62Z":"Activités de soutien à la production animale",
  "01.63Z":"Traitement primaire des récoltes","01.64Z":"Traitement des semences",
  "46.61Z":"Commerce de gros de matériel agricole","46.21Z":"Commerce de gros de céréales, semences et aliments pour animaux"
};
function activityLabel(code:string){return activityNames[code]||(code.startsWith("02")?"Sylviculture et exploitation forestière":code.startsWith("03")?"Pêche et aquaculture":"Activité agricole");}

function wmts(layer: string,format="image/png") {
  return `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=${format}`;
}
const sauTrend=[58819.7,58781.2,58696.2,58547.9,58231.2,58053.7,58104.9,57906.9,57671.2,57521.4].map((value,i)=>({year:2015+i,value}));
const bioTrend=[749,803,814,896,872,902].map((value,i)=>({year:2019+i,value}));
const cropMix=[
  ["Blé tendre",20356.1],["Maïs grain et ensilage",7825.4],["Colza",6138.4],["Orge",6113.9],
  ["Cultures industrielles",4693.6],["Prairies permanentes",2876.2],["Surfaces gelées",2157.8],["Prairies temporaires",1403.5]
] as [string,number][];
const communeRanking=[
  ["Chars",1207],["Avernes",1170],["Arronville",1039],["Magny-en-Vexin",1036],["Saint-Gervais",1018],
  ["Omerville",961],["Fontenay-en-Parisis",960],["Gonesse",860],["Bréançon",811],["Saint-Clair-sur-Epte",808]
] as [string,number][];
const productionYears=Array.from({length:15},(_,i)=>2010+i);
const productionSeries=[
  {label:"Betterave",color:"#a5581b",values:[515768,597748,536640,539306,556250,497940,480320,661200,561495,495975,247940,427938,381420,342181,326320]},
  {label:"Blé tendre",color:"#dcae3e",values:[204859,190513,210863,209483,211816,229548,123550,199178,177331,206404,165516,198121,190017,190530,129237]},
  {label:"Maïs grain",color:"#18753c",values:[57340,54500,55335,69064,62802,45840,32797,47300,42288,44672,38919,60848,45724,59897,70235]}
];
const phytoTrend=[261,271,246,217,217,142,170,174,179,158].map((value,i)=>({year:2014+i,value}));

export default function Home() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<Record<string,any>>({});
  const baseRef = useRef<Record<string,any>>({});
  const territoryBoundsRef = useRef<any>(null);
  const activeRef = useRef<string[]>(["rpg"]);
  const selectionRef = useRef<any>(null);
  const cadastreSelectionRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const selectionGenerationRef = useRef(0);
  const [active, setActive] = useState(["rpg"]);
  const [drawer, setDrawer] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [commune, setCommune] = useState<Commune | null>(null);
  const [cadastre, setCadastre] = useState<Cadastre | null>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [farm, setFarm] = useState<Farm | null>(null);
  const [status, setStatus] = useState<Record<string,Status>>({ commune:"idle", rpg:"idle", farms:"idle" });
  const [coordinates, setCoordinates] = useState<[number,number] | null>(null);
  const [zoom, setZoom] = useState(10);
  const [farmCount, setFarmCount] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [basemap, setBasemap] = useState<"plan"|"ortho">("plan");

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const boot = () => {
      if (!window.L || !mapEl.current || mapRef.current) return;
      const L = window.L;
      const map = L.map(mapEl.current, { zoomControl:false, attributionControl:true, minZoom:6, maxZoom:19 }).setView([49.075,2.105],10);
      mapRef.current = map;
      L.control.zoom({position:"bottomright"}).addTo(map);
      const base = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom:19, className:"neutral-tiles", attribution:"© contributeurs OpenStreetMap"
      }).addTo(map);
      baseRef.current.plan=base;
      baseRef.current.ortho=L.tileLayer(wmts("ORTHOIMAGERY.ORTHOPHOTOS","image/jpeg"),{maxZoom:19,zIndex:200,attribution:"Photographies aériennes · IGN"});
      base.getContainer()?.classList.add("neutral-tiles");

      layerRef.current.rpg = L.tileLayer(wmts("LANDUSE.AGRICULTURE2024"), { opacity:.72, maxZoom:19, zIndex:350, attribution:"RPG 2024 · IGN / ASP" }).addTo(map);
      layerRef.current.hedges = L.tileLayer(wmts("IGNF_BD-HAIE-V1_2020"), { className:"hedge-tiles", opacity:.9, maxZoom:19, zIndex:400, attribution:"BD Haie · IGN" });
      layerRef.current.water = L.tileLayer(wmts("HYDROGRAPHY.HYDROGRAPHY"), { opacity:.72, maxZoom:19, zIndex:400, attribution:"Hydrographie · IGN" });
      layerRef.current.cadastre = L.tileLayer(wmts("CADASTRALPARCELS.PARCELLAIRE_EXPRESS"), { opacity:.78, minZoom:14, maxZoom:19, zIndex:430, attribution:"Parcellaire Express · IGN" });

      fetch("data/cartobio-val-doise.geojson").then(r=>r.json()).then(data=>{
        layerRef.current.bio = L.geoJSON(data, {
          style:{color:"#18753c",weight:1.3,fillColor:"#55a66b",fillOpacity:.58},
          onEachFeature:(feature:any, layer:any)=>layer.on("click",(e:any)=>{
            L.DomEvent.stopPropagation(e);
            selectBio(feature,e.latlng);
          })
        });
        if(activeRef.current.includes("bio"))layerRef.current.bio.addTo(map);
      }).catch(()=>undefined);

      fetch("https://geo.api.gouv.fr/departements/95/communes?fields=nom,code,contour&format=geojson&geometry=contour")
        .then(r=>r.json()).then(data=>{
          const holes:any[]=[];
          data.features?.forEach((feature:any)=>{
            const g=feature.geometry;
            if(g?.type==="Polygon"&&g.coordinates?.[0]) holes.push(g.coordinates[0]);
            if(g?.type==="MultiPolygon") g.coordinates?.forEach((polygon:any)=>{if(polygon?.[0]) holes.push(polygon[0]);});
          });
          L.geoJSON({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[
            [[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],...holes
          ]}},{
            pane:"overlayPane",interactive:false,
            style:{stroke:false,fillColor:"#eef1f5",fillOpacity:.88,fillRule:"evenodd"}
          }).addTo(map);
          const territory=L.geoJSON(data,{style:{color:"#6a6a6a",weight:.7,opacity:.65,fillOpacity:0},interactive:false}).addTo(map);
          const b=territory.getBounds();
          if(b.isValid()){
            territoryBoundsRef.current=b;
            requestAnimationFrame(()=>{map.invalidateSize();map.fitBounds(b,{padding:[24,24],animate:false});});
          }
        }).catch(()=>undefined);
      map.on("zoomend",()=>setZoom(map.getZoom()));
      map.on("click",(e:any)=>inspectPoint(e.latlng.lng,e.latlng.lat));
      loadFarms(map);
      loadServices(map,"coops","data/cooperatives-agricoles-95.geojson","Coopérative","♟");
      loadServices(map,"equipment","data/materiel-agricole-95.geojson","Matériel agricole","⚙");
    };
    if(window.L) boot(); else {
      const link=document.createElement("link"); link.rel="stylesheet"; link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(link);
      const script=document.createElement("script"); script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.onload=boot; document.body.appendChild(script);
    }
  },[]);

  useEffect(()=>{
    activeRef.current=active;
    const map=mapRef.current; if(!map) return;
    for(const [id,layer] of Object.entries(layerRef.current)){
      if(!layer) continue;
      const show=active.includes(id);
      if(show&&!map.hasLayer(layer)) layer.addTo(map);
      if(!show&&map.hasLayer(layer)) map.removeLayer(layer);
    }
    if(cadastreSelectionRef.current){
      if(active.includes("cadastre")&&!map.hasLayer(cadastreSelectionRef.current))cadastreSelectionRef.current.addTo(map);
      if(!active.includes("cadastre")&&map.hasLayer(cadastreSelectionRef.current))map.removeLayer(cadastreSelectionRef.current);
    }
  },[active]);

  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    Object.entries(baseRef.current).forEach(([id,layer])=>{
      if(id===basemap&&!map.hasLayer(layer))layer.addTo(map);
      if(id!==basemap&&map.hasLayer(layer))map.removeLayer(layer);
    });
  },[basemap]);

  useEffect(()=>{
    const map=mapRef.current;
    if(!map)return;
    const timer=window.setTimeout(()=>{
      map.invalidateSize();
      if(drawer&&map.getZoom()<=10&&territoryBoundsRef.current){
        map.fitBounds(territoryBoundsRef.current,{padding:[24,24],animate:false});
      }else if(drawer&&coordinates){
        map.panInside([coordinates[1],coordinates[0]],{paddingTopLeft:[30,30],paddingBottomRight:[30,30],animate:true});
      }
    },40);
    return()=>window.clearTimeout(timer);
  },[drawer]);

  function toggleLayer(id:string){
    const enabling=!activeRef.current.includes(id);
    if(id==="cadastre"&&enabling&&mapRef.current?.getZoom()<14)mapRef.current.setZoom(14);
    setActive(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  }

  async function loadFarms(map:any){
    setStatus(s=>({...s,farms:"loading"}));
    try{
      const r=await fetch("data/exploitations-sirene-95.geojson");
      if(!r.ok) throw new Error();
      const data=await r.json(); const L=window.L;
      const group=L.layerGroup();
      data.features.forEach((feature:any)=>{
        const [lon,lat]=feature.geometry.coordinates,p=feature.properties||{};
        const f:Farm={name:p.nom||"Exploitation agricole",activity:p.activite||"Activité non renseignée",source:p.source||"SIRENE",lat,lon,siret:p.siret,commune:p.commune,address:p.adresse,bio:Boolean(p.bio),created:p.date_creation};
        const icon=L.divIcon({className:"agri-map-icon",html:`<span class="${f.bio?"bio":""}" aria-hidden="true">🚜</span>`,iconSize:[27,27],iconAnchor:[13,13]});
        L.marker([lat,lon],{icon}).bindTooltip(f.name,{direction:"top",offset:[0,-13]}).on("click",(e:any)=>{L.DomEvent.stopPropagation(e);clearMapSelection();setFarm(f);setParcel(null);setCoordinates([lon,lat]);setDrawer(true);setCommune(f.commune?{name:f.commune,code:""}:null);if(!f.commune)resolveCommune(lon,lat);else setStatus(s=>({...s,commune:"ok"}));}).addTo(group);
      });
      setFarmCount(data.features.length);
      layerRef.current.farms=group; if(activeRef.current.includes("farms")) group.addTo(map);
      setStatus(s=>({...s,farms:data.features.length?"ok":"empty"}));
    }catch{setStatus(s=>({...s,farms:"error"}));}
  }

  async function loadServices(map:any,id:string,url:string,category:string,glyph:string){
    try{
      const data=await fetch(url).then(r=>r.json()),L=window.L,group=L.layerGroup();
      data.features?.forEach((feature:any)=>{
        const [lon,lat]=feature.geometry.coordinates,p=feature.properties||{};
        const f:Farm={name:p.nom||category,activity:p.activite||"Non renseignée",source:p.source||"SIRENE",lat,lon,siret:p.siret,commune:p.commune,address:p.adresse,created:p.date_creation,category:p.categorie||category};
        const icon=L.divIcon({className:`agri-map-icon service ${id}`,html:`<span aria-hidden="true">${glyph}</span>`,iconSize:[27,27],iconAnchor:[13,13]});
        L.marker([lat,lon],{icon}).bindTooltip(f.name,{direction:"top",offset:[0,-13]}).on("click",(e:any)=>{
          L.DomEvent.stopPropagation(e);clearMapSelection();setFarm(f);setParcel(null);setCoordinates([lon,lat]);setDrawer(true);
          setCommune(f.commune?{name:f.commune,code:""}:null);
          if(!f.commune)resolveCommune(lon,lat);else setStatus(s=>({...s,commune:"ok"}));
        }).addTo(group);
      });
      layerRef.current[id]=group;if(activeRef.current.includes(id))group.addTo(map);
    }catch{}
  }

  async function resolveCommune(lon:number,lat:number){
    setStatus(s=>({...s,commune:"loading"}));
    try{
      const r=await fetch(`https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=nom,code&format=json`);
      if(!r.ok) throw new Error(); const d=await r.json();
      if(d[0]){setCommune({name:d[0].nom,code:d[0].code});setStatus(s=>({...s,commune:"ok"}));}
      else{setCommune(null);setStatus(s=>({...s,commune:"empty"}));}
    }catch{setStatus(s=>({...s,commune:"error"}));}
  }

  async function resolveCadastre(lon:number,lat:number,generation=selectionGenerationRef.current){
    setCadastre(null);
    try{
      const geom=encodeURIComponent(JSON.stringify({type:"Point",coordinates:[lon,lat]}));
      const r=await fetch(`https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geom}`);
      if(!r.ok)throw new Error();
      const d=await r.json(),feature=d.features?.[0];if(generation!==selectionGenerationRef.current||!feature)return;
      const p=feature.properties||{};
      const item:Cadastre={section:String(p.section||"—"),numero:String(p.numero||"—"),idu:String(p.idu||"Non publié"),contenance:Number(p.contenance||0),gid:String(p.gid||"Non publié"),feature};
      setCadastre(item);
      const L=window.L;
      if(cadastreSelectionRef.current&&mapRef.current?.hasLayer(cadastreSelectionRef.current))mapRef.current.removeLayer(cadastreSelectionRef.current);
      cadastreSelectionRef.current=L.geoJSON(feature,{style:{color:"#4f0099",weight:4,fillColor:"#c9a7ff",fillOpacity:.16},interactive:false});
      if(activeRef.current.includes("cadastre"))cadastreSelectionRef.current.addTo(mapRef.current);
    }catch{}
  }

  async function inspectPoint(lon:number,lat:number){
    clearMapSelection();
    const generation=selectionGenerationRef.current;
    const map=mapRef.current,L=window.L; setCoordinates([lon,lat]);setDrawer(true);setFarm(null);setParcel(null);setCadastre(null);
    if(markerRef.current) map.removeLayer(markerRef.current);
    markerRef.current=L.circleMarker([lat,lon],{radius:7,color:"#000091",weight:3,fillColor:"#fff",fillOpacity:1}).addTo(map);
    resolveCommune(lon,lat);
    resolveCadastre(lon,lat,generation);
    setStatus(s=>({...s,rpg:"loading"}));
    try{
      const geom=encodeURIComponent(JSON.stringify({type:"Point",coordinates:[lon,lat]}));
      const years=[2024,2023,2022,2021,2020];
      const responses=await Promise.allSettled(years.map(async year=>{
        const r=await fetch(`https://apicarto.ign.fr/api/rpg/v2?annee=${year}&geom=${geom}`);
        if(!r.ok) throw new Error(String(r.status));
        const data=await r.json();return {year,feature:data.features?.[0]};
      }));
      if(generation!==selectionGenerationRef.current)return;
      const unavailable:number[]=[],history:ParcelHistory[]=[];
      responses.forEach((result,index)=>{
        const year=years[index];
        if(result.status==="rejected"){unavailable.push(year);return;}
        const f=result.value.feature;if(!f)return;
        const p=f.properties||{},code=p.code_cultu||p.CODE_CULTU||"—";
        history.push({year,code,label:cropNames[code]||p.lib_cultu||`Culture ${code}`,group:String(p.code_group??p.CODE_GROUP??"Non renseigné"),surface:Number(p.surf_parc??p.SURF_PARC??0),id:String(p.id_parcel??p.ID_PARCEL??"Non publié"),feature:f});
      });
      const current=history.find(h=>h.year===2024)||history[0];
      if(!current){setStatus(s=>({...s,rpg:unavailable.length===years.length?"error":"empty"}));return;}
      setParcel({...current,history,historyUnavailable:unavailable});
      if(selectionRef.current) map.removeLayer(selectionRef.current);
      selectionRef.current=L.geoJSON(current.feature,{style:{color:"#000091",weight:4,fillColor:"#fff",fillOpacity:.18}}).addTo(map);
      setStatus(s=>({...s,rpg:"ok"}));
    }catch{if(generation===selectionGenerationRef.current)setStatus(s=>({...s,rpg:"error"}));}
  }

  function selectBio(feature:any,latlng:any){
    clearMapSelection();
    const p=feature.properties||{},L=window.L,map=mapRef.current; setDrawer(true);setFarm(null);setCoordinates([latlng.lng,latlng.lat]);
    const current={year:Number(p.annee||2024),code:p.code_culture||"BIO",label:p.culture_nom||"Culture biologique",group:p.groupe_culture||"Non renseigné",surface:Number(p.surface_ha||0),id:String(p.id||feature.id||"Non publié"),feature};
    setParcel({...current,history:[current],historyUnavailable:[]});
    if(L&&map)selectionRef.current=L.geoJSON(feature,{style:{color:"#0f5b2d",weight:4,fillColor:"#8bd3a0",fillOpacity:.22},interactive:false}).addTo(map);
    setStatus(s=>({...s,rpg:"ok"}));resolveCommune(latlng.lng,latlng.lat);
  }

  async function search(e:FormEvent){
    e.preventDefault(); if(!query.trim()) return;
    try{
      const r=await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query+" Val-d'Oise")}&limit=1`);
      const d=await r.json(),f=d.features?.[0]; if(!f)return;
      const [lon,lat]=f.geometry.coordinates;setQuery(f.properties.label);mapRef.current?.setView([lat,lon],14);inspectPoint(lon,lat);
    }catch{}
  }

  function reset(){
    const map=mapRef.current,bounds=territoryBoundsRef.current;
    clearSelection();
    if(map&&bounds){map.invalidateSize();map.fitBounds(bounds,{padding:[24,24],animate:true});}
    else map?.setView([49.075,2.105],9);
  }

  function clearSelection(){
    clearMapSelection();
    setDrawer(false);
    setQuery("");
    setCommune(null);
    setParcel(null);
    setFarm(null);
    setCoordinates(null);
    setStatus(s=>({...s,commune:"idle",rpg:"idle"}));
  }

  function clearMapSelection(){
    selectionGenerationRef.current+=1;
    const map=mapRef.current;
    if(map&&selectionRef.current)map.removeLayer(selectionRef.current);
    if(map&&markerRef.current)map.removeLayer(markerRef.current);
    if(map&&cadastreSelectionRef.current&&map.hasLayer(cadastreSelectionRef.current))map.removeLayer(cadastreSelectionRef.current);
    selectionRef.current=null;
    markerRef.current=null;
    cadastreSelectionRef.current=null;
    setCadastre(null);
  }

  async function exportParcelPdf(){
    if(!parcel||!coordinates)return;
    const safe=(value:unknown)=>String(value??"Non renseigné").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
    const report=window.open("","_blank","width=900,height=1100");if(!report)return;
    report.document.write("<p style='font-family:Arial;padding:30px'>Préparation de la fiche…</p>");
    const asData=async(path:string)=>new Promise<string>((resolve,reject)=>{fetch(path).then(r=>r.blob()).then(blob=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob)}).catch(reject)});
    try{
      const [logo,regular,medium,bold]=await Promise.all([asData("prefet-val-doise-logo.png"),asData("fonts/Marianne-Regular.woff2"),asData("fonts/Marianne-Medium.woff2"),asData("fonts/Marianne-Bold.woff2")]);
      const uniqueCrops=new Set(parcel.history.map(h=>h.code)).size;
      const timeline=parcel.history.map((h,index)=>`<div class="event"><div class="year">${h.year}</div><div class="rail"><i class="${index===0?"now":""}"></i></div><div class="event-card"><strong>${safe(h.label)}</strong><span>Code ${safe(h.code)} · groupe ${safe(h.group)}</span><small>${h.surface?h.surface.toLocaleString("fr-FR")+" ha":"Surface non publiée"} · RPG ${safe(h.id)}</small></div></div>`).join("");
      report.document.open();
      report.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche parcelle agricole · RPG ${safe(parcel.id)}${cadastre?` · Cadastre ${safe(cadastre.section)} ${safe(cadastre.numero)}`:""}</title><style>
      @font-face{font-family:Marianne;src:url("${regular}") format("woff2")}@font-face{font-family:Marianne;src:url("${medium}") format("woff2");font-weight:500}@font-face{font-family:Marianne;src:url("${bold}") format("woff2");font-weight:700}
      @page{size:A4;margin:14mm}*{box-sizing:border-box}html{background:#ececf2}body{font-family:Marianne,Arial,sans-serif;color:#161616;margin:0;background:#ececf2;font-size:10px;line-height:1.35}.sheet{width:182mm;min-height:267mm;margin:10mm auto;padding:13mm;background:#fff;box-shadow:0 5px 24px #0002}.print{position:fixed;right:18px;top:18px;border:0;border-radius:5px;background:#000091;color:#fff;padding:10px 14px;font:700 11px Marianne}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #000091;padding-bottom:9mm}.head img{width:31mm;height:auto}.head-copy{text-align:right}.head h1{font-size:19px;line-height:1.15;color:#000091;margin:0}.head p{font-size:10px;margin:4px 0 0;color:#555}.hero{margin-top:7mm;background:#f4f4ff;border-left:4px solid #000091;padding:5mm;display:grid;grid-template-columns:1.2fr .8fr;gap:5mm}.eyebrow{text-transform:uppercase;letter-spacing:.08em;color:#666;font-size:8px}.hero strong{display:block;font-size:19px;color:#000091;margin:2px 0}.hero p{margin:0}.section{margin-top:6mm}.section h2{font-size:13px;color:#000091;margin:0 0 3mm;padding-bottom:2mm;border-bottom:1px solid #ddd}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:3mm}.card{border:1px solid #ddd;padding:3.5mm;min-height:18mm}.card small{display:block;color:#777;margin-bottom:1mm}.card b{font-size:11px}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin-top:3mm}.fact{background:#f6f6f6;padding:3mm}.fact b{display:block;font-size:12px;color:#000091}.timeline{margin-top:1mm}.event{display:grid;grid-template-columns:12mm 5mm 1fr;gap:2mm;min-height:17mm}.year{font-weight:700;padding-top:2mm}.rail{position:relative}.rail:after{content:"";position:absolute;left:2mm;top:6mm;bottom:-3mm;border-left:1px solid #b7b7c7}.event:last-child .rail:after{display:none}.rail i{position:absolute;left:.6mm;top:2.4mm;width:3mm;height:3mm;border:1.5px solid #666;border-radius:50%;background:#fff;z-index:1}.rail i.now{background:#000091;border-color:#000091}.event-card{border-bottom:1px solid #eee;padding:1mm 0 3mm}.event-card strong{font-size:11px}.event-card span,.event-card small{display:block;color:#555;margin-top:.5mm}.source{font-size:8px;color:#666;margin-top:6mm;border-top:1px solid #ccc;padding-top:3mm}.url{color:#000091}.unavailable{color:#a34a21}.footer{display:flex;justify-content:space-between;margin-top:5mm;font-size:8px;color:#777}
      @media print{html,body{background:#fff}.sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.print{display:none}}</style></head><body><button class="print" onclick="window.print()">Enregistrer en PDF</button><main class="sheet">
      <header class="head"><img src="${logo}" alt="Préfet du Val-d’Oise"><div class="head-copy"><h1>Fiche parcelle agricole · RPG ${safe(parcel.id)}</h1><p>${cadastre?`Cadastre ${safe(cadastre.section)} ${safe(cadastre.numero)} · `:""}Val-d’Oise · 27/07/2026</p></div></header>
      <section class="hero"><div><span class="eyebrow">Culture déclarée en ${parcel.year}</span><strong>${safe(parcel.label)}</strong><p>Code ${safe(parcel.code)} · groupe ${safe(parcel.group)}</p></div><div><span class="eyebrow">Surface publiée</span><strong>${parcel.surface?parcel.surface.toLocaleString("fr-FR")+" ha":"Non renseignée"}</strong><p>Identifiant RPG ${safe(parcel.id)}</p></div></section>
      <section class="section"><h2>Localisation et identification</h2><div class="grid"><div class="card"><small>Commune</small><b>${safe(commune?.name)}</b><br>Code INSEE ${safe(commune?.code)}</div><div class="card"><small>Coordonnées WGS84</small><b>${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}</b><br><span class="url">openstreetmap.org · zoom 17</span></div><div class="card"><small>Identifiant RPG ${parcel.year}</small><b>${safe(parcel.id)}</b><br>Code culture ${safe(parcel.code)} · groupe ${safe(parcel.group)}</div><div class="card"><small>Référence cadastrale</small><b>${cadastre?`${safe(cadastre.section)} ${safe(cadastre.numero)}`:"Non trouvée"}</b><br>${cadastre?`IDU ${safe(cadastre.idu)} · ${cadastre.contenance.toLocaleString("fr-FR")} m²`:"Cadastre interrogé au point sélectionné"}</div></div><div class="facts"><div class="fact"><small>Millésimes trouvés</small><b>${parcel.history.length}</b></div><div class="fact"><small>Cultures distinctes</small><b>${uniqueCrops}</b></div><div class="fact"><small>Période observée</small><b>${Math.min(...parcel.history.map(h=>h.year))}–${Math.max(...parcel.history.map(h=>h.year))}</b></div></div></section>
      <section class="section"><h2>Frise de l’historique cultural</h2><div class="timeline">${timeline}</div>${parcel.historyUnavailable.length?`<p class="unavailable">Millésimes momentanément indisponibles : ${parcel.historyUnavailable.join(", ")}.</p>`:""}</section>
      <p class="source"><b>Source :</b> Registre parcellaire graphique (RPG), ASP / IGN. Les cultures correspondent aux déclarations PAC publiées pour chaque millésime. L’historique est recherché au point sélectionné ; une évolution des contours peut entraîner un changement d’identifiant ou de surface. La surface est celle publiée par la source, sans recalcul. Cette fiche ne contient pas l’identité de l’exploitant.</p>
      <footer class="footer"><span>Agriculture du Val-d’Oise</span><span>Fiche générée le 27/07/2026</span></footer></main>
      </body></html>`);
      report.document.close();
    }catch{report.document.body.innerHTML="<p>La fiche n’a pas pu charger ses ressources. Fermez cette fenêtre et réessayez.</p>";}
  }

  return <main className="shell">
    <header className="institutional">
      <div className="brand"><img src="prefet-val-doise-logo.png" alt="Préfet du Val-d’Oise"/><div><span>AGRICULTURE ET TERRITOIRES · VAL-D’OISE</span><strong>Agriculture</strong><small><b>Val-d’Oise</b> · cultures · exploitations · bio · haies</small></div></div>
      <div className="header-status"><i/><p><strong>{farmCount?`${farmCount.toLocaleString("fr-FR")} exploitations agricoles`:"Chargement des exploitations"}</strong><small>SIRENE · établissements actifs géolocalisés</small></p></div>
    </header>

    <div className={`workspace ${drawer?"details-open":""}`}>
      <aside className="left-panel">
        <h1>Rechercher et comprendre<br/><span>l’agriculture</span></h1>
        <form onSubmit={search} className="search"><div><input aria-label="Rechercher une commune" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Adresse ou commune…"/><button aria-label="Rechercher">Rechercher</button></div></form>
        <div className="reading"><b>Lecture de la carte</b><p>Activez les informations utiles, puis cliquez sur une parcelle ou une exploitation pour ouvrir sa fiche.</p></div>
        <div className="quick-actions"><button onClick={reset}>Recentrer</button><button onClick={()=>dialogRef.current?.showModal()}>Données & évolutions</button></div>
        <section className="purpose"><h3>À quoi sert cet outil ?</h3><p>Localiser les exploitations agricoles, identifier les cultures déclarées et croiser les données utiles à la connaissance du territoire.</p></section>
        <button className="layers-title" onClick={()=>setLayersOpen(!layersOpen)}><span>Couches de la carte</span><b>{active.length} actives {layersOpen?"−":"+"}</b></button>
        {layersOpen&&<div className="layer-list">{layers.map(l=><label key={l.id} className="layer-row"><input type="checkbox" checked={active.includes(l.id)} onChange={()=>toggleLayer(l.id)}/><i style={{background:l.color}}/><span><strong>{l.label}</strong><small>{l.detail}</small></span></label>)}</div>}
        <div className="basemap-choice"><strong>Fond de carte</strong><div><button className={basemap==="plan"?"active":""} onClick={()=>setBasemap("plan")}>Plan neutre</button><button className={basemap==="ortho"?"active":""} onClick={()=>setBasemap("ortho")}>Photo aérienne</button></div></div>
      </aside>

      <section className="map-zone">
        <div ref={mapEl} className="map" aria-label="Carte agricole interactive du Val-d’Oise"/>
        <div className="legend"><b>Légende</b>{active.includes("rpg")&&<span><i className="lg-rpg"/>Cultures RPG</span>}{active.includes("bio")&&<span><i className="lg-bio"/>Parcelles bio</span>}{active.includes("farms")&&<span><i className="lg-farm"/>Exploitations</span>}{active.includes("coops")&&<span><i className="lg-coop"/>Coopératives</span>}{active.includes("equipment")&&<span><i className="lg-equipment"/>Matériel agricole</span>}{active.includes("hedges")&&<span><i className="lg-hedge"/>Haies</span>}{active.includes("water")&&<span><i className="lg-water"/>Cours d’eau</span>}{active.includes("cadastre")&&<span><i className="lg-cadastre"/>Parcelles cadastrales</span>}</div>
      </section>

      <dialog ref={dialogRef} className="dialog dashboard-dialog" onClick={e=>{ if(e.target===dialogRef.current) dialogRef.current?.close(); }}>
        <button className="dialog-close" onClick={()=>dialogRef.current?.close()} aria-label="Fermer">×</button>
        <Dashboard/>
      </dialog>

      {drawer&&<aside className="drawer">
        <button className="close" onClick={clearSelection} aria-label="Fermer et effacer la sélection">×</button>
        <div className="drawer-head"><small>POINT OBSERVÉ</small><h2>{commune?.name||farm?.name||"Analyse en cours"}</h2>{coordinates&&<p>{coordinates[1].toFixed(5)} · {coordinates[0].toFixed(5)}</p>}{parcel&&<button className="drawer-primary" onClick={exportParcelPdf}>Ouvrir la fiche de la parcelle ↗</button>}</div>
        <div className="drawer-body">
          <div className="drawer-section-title">INFORMATIONS DU POINT CLIQUÉ</div>
          <Result title="Commune" status={status.commune}><dl><div><dt>Nom</dt><dd>{commune?.name}</dd></div><div><dt>Code INSEE</dt><dd>{commune?.code}</dd></div></dl></Result>
          {cadastre&&<Result title="Parcelle cadastrale" status="ok"><dl><div><dt>Section et numéro</dt><dd>{cadastre.section} {cadastre.numero}</dd></div><div><dt>Identifiant cadastral (IDU)</dt><dd>{cadastre.idu}</dd></div><div><dt>Contenance cadastrale</dt><dd>{cadastre.contenance.toLocaleString("fr-FR")} m²</dd></div><div><dt>Identifiant technique IGN</dt><dd>{cadastre.gid}</dd></div><div><dt>Source</dt><dd>Cadastre · API Carto IGN</dd></div></dl></Result>}
          {farm&&<Result title={farm.category||"Exploitation sélectionnée"} status="ok"><div className="object-title"><i className="farm-dot"/><div><strong>{farm.name}</strong><span>{farm.category||activityLabel(farm.activity)}</span></div></div><dl><div><dt>Activité / code APE</dt><dd>{activityLabel(farm.activity)} · {farm.activity}</dd></div><div><dt>Commune</dt><dd>{farm.commune||commune?.name||"Non renseignée"}</dd></div><div><dt>Adresse diffusée</dt><dd>{farm.address||"Non diffusée"}</dd></div><div><dt>SIRET</dt><dd>{farm.siret||"Non renseigné"}</dd></div>{!farm.category&&<div><dt>Agriculture biologique</dt><dd>{farm.bio?"Référencée Agence Bio":"Non renseignée"}</dd></div>}<div><dt>Création</dt><dd>{farm.created||"Non renseignée"}</dd></div><div><dt>Source</dt><dd>{farm.source}</dd></div></dl></Result>}
          {!farm&&<Result title="Parcelle agricole" status={status.rpg}>{parcel&&<><div className="object-title"><i className="parcel-dot"/><div><strong>{parcel.label}</strong><span>Culture déclarée · {parcel.year}</span></div></div><dl><div><dt>Code culture</dt><dd>{parcel.code}</dd></div><div><dt>Groupe</dt><dd>{parcel.group}</dd></div><div><dt>Surface publiée</dt><dd>{parcel.surface?`${parcel.surface.toLocaleString("fr-FR")} ha`:"Non renseignée"}</dd></div><div><dt>Identifiant RPG</dt><dd>{parcel.id}</dd></div>{cadastre&&<><div><dt>Parcelle cadastrale</dt><dd>{cadastre.section} {cadastre.numero}</dd></div><div><dt>Identifiant cadastral</dt><dd>{cadastre.idu}</dd></div><div><dt>Contenance cadastrale</dt><dd>{cadastre.contenance.toLocaleString("fr-FR")} m²</dd></div></>}<div><dt>Localisation</dt><dd>{coordinates?`${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`:"—"}</dd></div><div><dt>Source</dt><dd>RPG · ASP / IGN</dd></div></dl>
            <div className="parcel-history"><div className="history-head"><strong>Historique cultural</strong><small>au point sélectionné</small></div>{parcel.history.map((h,index)=><div className="history-row" key={h.year}><b>{h.year}</b><i className={index===0?"current":""}/><span><strong>{h.label}</strong><small>code {h.code} · {h.surface?h.surface.toLocaleString("fr-FR")+" ha":"surface non renseignée"}</small></span></div>)}{parcel.historyUnavailable.length>0&&<p>Millésime(s) momentanément indisponible(s) : {parcel.historyUnavailable.join(", ")}.</p>}</div>
            </>}</Result>}
          <div className="honesty"><b>Lecture indépendante</b><p>Chaque source répond séparément. Une panne RPG ne masque jamais la commune ni l’objet déjà sélectionné.</p></div>
        </div>
      </aside>}
    </div>
  </main>;
}

function Dashboard(){
  return <>
    <div className="dialog-header"><span className="eyebrow">VAL-D’OISE · SÉRIE 2010–2024</span><h2>L’agriculture en chiffres</h2><p>Un tableau de bord pour suivre les surfaces, les productions et les dynamiques territoriales. Sources : RPG · Agreste/SSP · Agence Bio.</p></div>
    <div className="dashboard-kpis">
      <Kpi label="Surface agricole déclarée" value="57 521 ha" delta="−2,2 % depuis 2015"/>
      <Kpi label="Surface certifiée bio" value="902 ha" delta="+20,4 % depuis 2019" positive/>
      <Kpi label="Exploitations agricoles" value="520" delta="Recensement agricole 2020"/>
      <Kpi label="Emplois agricoles" value="1 046 ETP" delta="Recensement agricole 2020"/>
    </div>
    <div className="dashboard-grid">
      <article className="chart-card span-3"><ChartTitle title="Évolution de la surface agricole déclarée" subtitle="Hectares · RPG 2015–2024"/><LineChart data={sauTrend} color="#000091" unit=" ha"/><p className="insight">La surface déclarée recule de 1 298 ha en neuf ans, malgré un léger rebond en 2021.</p></article>
      <article className="chart-card"><ChartTitle title="Progression des surfaces bio" subtitle="Hectares certifiés · 2019–2024"/><LineChart data={bioTrend} color="#18753c" unit=" ha"/><p className="insight">La bio progresse de 153 ha depuis 2019, avec un repli ponctuel en 2023.</p></article>
      <article className="chart-card"><ChartTitle title="Principales cultures en 2024" subtitle="Surface déclarée en hectares"/><Bars data={cropMix.slice(0,6)}/></article>
      <article className="dashboard-note"><span>COMMENT LIRE</span><h3>Deux sources, deux échelles</h3><p>Le RPG décrit les surfaces déclarées à la parcelle ; le recensement agricole et Agreste comptent les exploitations et leurs emplois. Ces séries ne se recoupent pas millésime par millésime.</p></article>
      <article className="chart-card span-3"><ChartTitle title="Productions végétales comparées" subtitle="Indice 100 en 2010 · tonnes produites · 2010–2024"/><IndexedLines/><p className="insight">Le maïs dépasse son niveau de 2010 ; le blé et la betterave terminent 2024 nettement en retrait.</p></article>
      <article className="chart-card span-3"><ChartTitle title="Communes les plus agricoles" subtitle="Surface agricole déclarée en 2024 · hectares"/><Bars data={communeRanking}/></article>
      <article className="chart-card span-2"><ChartTitle title="Ventes de produits phytosanitaires" subtitle="Tonnes de substances actives vendues dans le Val-d’Oise · 2014–2023"/><LineChart data={phytoTrend} color="#c43c00" unit=" t"/><div className="phyto-facts"><span><b>158 t</b> vendues en 2023</span><span><b>−11,6 %</b> par rapport à 2022</span><span><b>27,3 t</b> de glyphosate</span><span><b>76</b> substances</span></div><p className="insight warning">Ces ventes départementales ne décrivent ni l’usage ni le traitement d’une parcelle précise.</p></article>
      <article className="dashboard-note"><span>SOURCES ET PRÉCAUTIONS</span><h3>Lecture indépendante</h3><p>RPG IGN/ASP pour les surfaces déclarées ; Agreste/SSP pour les productions ; CartoBio et Agence Bio pour le bio ; BNV-D/Hub’Eau pour les ventes phytosanitaires. Les établissements SIRENE et les exploitations du recensement ne répondent pas à la même définition.</p></article>
    </div>
  </>
}
function Kpi({label,value,delta,positive=false}:{label:string,value:string,delta:string,positive?:boolean}){return <article><small>{label}</small><strong>{value}</strong><span className={positive?"positive":""}>{delta}</span></article>}
function ChartTitle({title,subtitle}:{title:string,subtitle:string}){return <><h3>{title}</h3><p>{subtitle}</p></>}
function LineChart({data,color,unit}:{data:{year:number,value:number}[],color:string,unit:string}){
  const w=620,h=205,p={l:52,r:18,t:14,b:32},min=Math.min(...data.map(d=>d.value)),max=Math.max(...data.map(d=>d.value)),pad=(max-min)*.16||1;
  const lo=min-pad,hi=max+pad,x=(i:number)=>p.l+i*(w-p.l-p.r)/(data.length-1),y=(v:number)=>p.t+(hi-v)*(h-p.t-p.b)/(hi-lo);
  const path=data.map((d,i)=>`${i?"L":"M"}${x(i)},${y(d.value)}`).join(" ");
  return <svg className="line-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Graphique d’évolution">
    {[0,.5,1].map((t,i)=>{const yy=p.t+t*(h-p.t-p.b),val=hi-t*(hi-lo);return <g key={i}><line x1={p.l} x2={w-p.r} y1={yy} y2={yy} className="gridline"/><text x={p.l-8} y={yy+4} textAnchor="end">{Math.round(val).toLocaleString("fr-FR")}</text></g>})}
    <path d={path} fill="none" stroke={color} strokeWidth="3"/>
    {data.map((d,i)=><g key={d.year}><circle cx={x(i)} cy={y(d.value)} r="3.5" fill="#fff" stroke={color} strokeWidth="2"/>{(i===0||i===data.length-1)&&<text x={x(i)} y={y(d.value)-10} textAnchor={i===0?"start":"end"} className="point-label">{d.value.toLocaleString("fr-FR")}{unit}</text>}<text x={x(i)} y={h-9} textAnchor="middle">{d.year}</text></g>)}
  </svg>
}
function Bars({data}:{data:[string,number][]}){
  const max=Math.max(...data.map(d=>d[1]));
  return <>{data.map(([label,value])=><div className="bar-row" key={label}><span title={label}>{label}</span><div className="bar-track"><i style={{["--pct" as any]:`${Math.max(6,value/max*100)}%`}}/></div><b>{value.toLocaleString("fr-FR")} ha</b></div>)}</>
}
function IndexedLines(){
  const w=760,h=230,p={l:45,r:22,t:20,b:34},indexed=productionSeries.map(s=>({...s,values:s.values.map(v=>v/s.values[0]*100)}));
  const all=indexed.flatMap(s=>s.values),lo=Math.min(...all)*.9,hi=Math.max(...all)*1.08,x=(i:number)=>p.l+i*(w-p.l-p.r)/(productionYears.length-1),y=(v:number)=>p.t+(hi-v)*(h-p.t-p.b)/(hi-lo);
  return <><div className="series-legend">{indexed.map(s=><span key={s.label}><i style={{background:s.color}}/>{s.label}</span>)}</div><svg className="line-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Évolution comparée des productions végétales">
    {[50,100,150].filter(v=>v>=lo&&v<=hi).map(v=><g key={v}><line x1={p.l} x2={w-p.r} y1={y(v)} y2={y(v)} className={v===100?"baseline":"gridline"}/><text x={p.l-8} y={y(v)+4} textAnchor="end">{v}</text></g>)}
    {indexed.map(s=><path key={s.label} d={s.values.map((v,i)=>`${i?"L":"M"}${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2.7"/>)}
    {productionYears.map((yr,i)=>(i%3===0||i===productionYears.length-1)&&<text key={yr} x={x(i)} y={h-10} textAnchor="middle">{yr}</text>)}
  </svg></>
}

function Result({title,status,children}:{title:string,status:Status,children:any}){
  return <section className="result"><div className="result-title"><h3>{title}</h3><StatusPill status={status}/></div>
    {status==="loading"&&<p className="state">Interrogation de la source…</p>}
    {status==="empty"&&<p className="state">Aucune donnée trouvée à cet emplacement.</p>}
    {status==="error"&&<p className="state error">Cette source ne répond pas pour le moment. Les autres résultats restent disponibles.</p>}
    {status==="ok"&&children}
  </section>
}
function StatusPill({status}:{status:Status}){
  const label={idle:"En attente",loading:"Recherche",ok:"Disponible",empty:"Aucun objet",error:"Indisponible"}[status];
  return <span className={`status ${status}`}>{label}</span>
}
