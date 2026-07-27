(()=>{
"use strict";
const C=window.APP_CONFIG,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={communes:null,communesLayer:null,rpgLayer:null,selection:null,marker:null,rpg:true,communesOn:true,orthoOn:false,lastKey:"",requestId:0};
const map=L.map("map",{zoomControl:true,minZoom:9,maxZoom:19,maxBounds:[[48.70,1.35],[49.40,2.85]],maxBoundsViscosity:.65});
map.fitBounds(C.bounds,{padding:[18,18]});
const osm=L.tileLayer(C.osm,{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);
const ortho=L.tileLayer(C.ortho,{maxZoom:19,attribution:"© IGN"});
L.control.scale({imperial:false}).addTo(map);
state.rpgLayer=L.geoJSON(null,{style:parcelStyle,onEachFeature:(f,l)=>l.on("click",e=>{L.DomEvent.stopPropagation(e);select(e.latlng,f);})}).addTo(map);
state.selection=L.geoJSON(null,{style:{color:"#e1000f",weight:4,fillColor:"#e1000f",fillOpacity:.12},interactive:false}).addTo(map);

function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function prop(p,n){for(const k of n)if(p?.[k]!==undefined&&p[k]!==null&&p[k]!=="")return p[k];return null}
function fam(p={}){const c=String(prop(p,["code_cultu","CODE_CULTU","code_culture","CODE_CULTURE"])||"").toUpperCase();
 if(["BTH","BDH","ORH","ORP","AVH","AVP"].some(x=>c.includes(x)))return["Céréales","#d9b44a"];
 if(["MIS","MIE","SOG"].some(x=>c.includes(x)))return["Maïs et sorgho","#edca2e"];
 if(["PPH","PTR","PRA","SPH"].some(x=>c.includes(x)))return["Prairies","#6ba94b"];
 if(["LUZ","LOT","TRE","FVL"].some(x=>c.includes(x)))return["Légumineuses","#3b9b72"];
 if(["VRG","VRC","VRT","POT","CAR","OIG"].some(x=>c.includes(x)))return["Maraîchage","#1f8f5f"];
 return["Autres cultures","#9a7b55"];}
function parcelStyle(f){return{color:"#70571e",weight:1,fillColor:fam(f.properties)[1],fillOpacity:.72}}
function status(t,sub,kind=""){ $("#status-text").textContent=t;$("#status-sub").textContent=sub;$("#status-dot").className="live-dot "+kind;}
function progress(v){$("#progress").style.width=v+"%"}
function openDrawer(){ $("#drawer").classList.add("open");$("#drawer").setAttribute("aria-hidden","false")}
function card(t,b){return`<article class="block"><div class="block-title">${esc(t)}</div>${b}</article>`}
function grid(rows){return`<div class="data-grid">${rows.map(([l,v])=>`<div class="data-row"><div class="l">${esc(l)}</div><div class="v">${v}</div></div>`).join("")}</div>`}
function area(v){const n=Number(v);if(!Number.isFinite(n))return"Non renseignée";if(n<1000)return n.toLocaleString("fr-FR")+" m²";return(n/10000).toLocaleString("fr-FR",{maximumFractionDigits:2})+" ha"}

async function loadCommunes(){
 progress(25);status("Chargement","Communes du Val-d’Oise");
 try{
  const r=await fetch(C.communesApi);if(!r.ok)throw new Error("HTTP "+r.status);
  state.communes=await r.json();
  state.communesLayer=L.geoJSON(state.communes,{style:{color:"#000091",weight:1.4,fillColor:"#000091",fillOpacity:.025},
   onEachFeature:(f,l)=>{l.bindTooltip(f.properties.nom,{sticky:true});l.on("click",e=>{L.DomEvent.stopPropagation(e);select(e.latlng,null,f.properties)})}}).addTo(map);
  $("#kpi-communes").textContent=state.communes.features.length;
  status("Données disponibles","Cliquez sur la carte","ok");progress(100);setTimeout(()=>progress(0),500)
 }catch(e){console.error(e);status("Service territorial indisponible","Le clic RPG reste disponible","ko");progress(0)}
}
function geomPoint(ll){return encodeURIComponent(JSON.stringify({type:"Point",coordinates:[ll.lng,ll.lat]}))}
async function parcelAt(ll){const r=await fetch(`${C.rpgApi}?geom=${geomPoint(ll)}`);if(!r.ok)throw new Error("RPG HTTP "+r.status);const d=await r.json();return d.features?.[0]||null}
async function communeAt(ll){const r=await fetch(`${C.reverseApi}?lat=${ll.lat}&lon=${ll.lng}&fields=nom,code,codesPostaux,departement,region&format=json&geometry=centre`);if(!r.ok)throw new Error("Commune HTTP "+r.status);const d=await r.json();return d?.[0]||null}

async function select(ll,knownParcel=null,knownCommune=null){
 const id=++state.requestId;
 if(state.marker)map.removeLayer(state.marker);
 state.marker=L.circleMarker(ll,{radius:7,color:"#fff",weight:3,fillColor:"#e1000f",fillOpacity:1}).addTo(map);
 state.selection.clearLayers();if(knownParcel)state.selection.addData(knownParcel);
 openDrawer();$("#drawer-city").textContent="Point sélectionné";$("#drawer-sub").textContent=`${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`;
 $("#summary-date").textContent=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
 $("#summary-status").textContent="Analyse en cours";$("#summary-text").textContent="Interrogation du RPG et identification de la commune.";
 $("#drawer-body").innerHTML='<div class="loading">Chargement des données officielles…</div>';
 try{
  const [parcel,commune]=await Promise.all([knownParcel?Promise.resolve(knownParcel):parcelAt(ll),knownCommune?Promise.resolve(knownCommune):communeAt(ll)]);
  if(id!==state.requestId)return;
  if(parcel&&!knownParcel){state.selection.clearLayers();state.selection.addData(parcel)}
  render(ll,parcel,commune);
 }catch(e){
  console.error(e);if(id!==state.requestId)return;
  $("#summary-status").textContent="Source indisponible";
  $("#summary-text").textContent="La réponse n’a pas pu être obtenue. Aucune approximation n’est affichée.";
  $("#drawer-body").innerHTML=card("Erreur de service",'<p>Une API officielle n’a pas répondu. Réessayez dans quelques instants.</p>');
 }
}
function render(ll,parcel,commune){
 const city=commune?.nom||"Commune non identifiée";$("#drawer-city").textContent=city;
 $("#drawer-sub").textContent=commune?.code?`Code INSEE ${commune.code}`:`${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`;
 let html="";
 if(parcel){
  const p=parcel.properties||{},f=fam(p);
  const culture=prop(p,["lib_cultu","LIB_CULTU","libelle_culture","culture"])||f[0];
  const code=prop(p,["code_cultu","CODE_CULTU","code_culture","CODE_CULTURE"])||"—";
  const surf=prop(p,["surf_parc","SURF_PARC","surface","SURFACE","surf_ha"]);
  const id=prop(p,["id_parcel","ID_PARCEL","id_parcelle","fid","id"])||"Non communiqué";
  const year=prop(p,["annee","ANNEE","millesime","MILLÉSIME"])||"2024";
  $("#summary-status").textContent=culture;$("#summary-text").textContent="Parcelle déclarée au Registre parcellaire graphique.";
  html+=card("Parcelle agricole",grid([["Culture",esc(culture)],["Code RPG",esc(code)],["Famille",esc(f[0])],["Surface publiée",esc(area(surf))],["Millésime",esc(year)],["Identifiant",esc(id)]]));
 }else{
  $("#summary-status").textContent="Aucune parcelle RPG";$("#summary-text").textContent="Aucune parcelle déclarée à la PAC n’a été trouvée exactement à ce point.";
  html+=card("Résultat RPG",'<p>Aucune parcelle agricole n’a été renvoyée à cette position. Cela ne prouve pas que le terrain n’est pas agricole.</p>');
 }
 html+=card("Territoire",grid([["Commune",esc(city)],["Code INSEE",esc(commune?.code||"Non identifié")],["Département",esc(commune?.departement?.nom||"Val-d’Oise")],["Coordonnées",`${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`]]));
 html+=card("Sources",'<p>Registre parcellaire graphique — IGN, API Carto. Limites communales — API Géographique.</p><a class="source-link" target="_blank" rel="noopener noreferrer" href="https://www.data.gouv.fr/datasets/rpg">Consulter la fiche officielle ↗</a>');
 $("#drawer-body").innerHTML=html;
}

function bbox(b){const w=b.getWest(),e=b.getEast(),s=b.getSouth(),n=b.getNorth();return{type:"Polygon",coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}}
async function loadVisibleRpg(){
 const z=map.getZoom(),zl=$("#zoom-level");
 zl.innerHTML=z<C.rpgMinZoom?"<strong>Vue départementale</strong><span>Cliquez pour interroger une position</span>":"<strong>Vue parcellaire</strong><span>Les cultures deviennent cliquables</span>";
 if(!state.rpg||z<C.rpgMinZoom){state.rpgLayer.clearLayers();$("#kpi-parcelles").textContent="0";return}
 const b=map.getBounds(),key=[z,b.getWest().toFixed(3),b.getSouth().toFixed(3),b.getEast().toFixed(3),b.getNorth().toFixed(3)].join("|");
 if(key===state.lastKey)return;state.lastKey=key;
 try{
  const geom=encodeURIComponent(JSON.stringify(bbox(b))),r=await fetch(`${C.rpgApi}?geom=${geom}`);if(!r.ok)throw new Error("HTTP "+r.status);
  const d=await r.json();state.rpgLayer.clearLayers();state.rpgLayer.addData(d);$("#kpi-parcelles").textContent=(d.features?.length||0).toLocaleString("fr-FR");
 }catch(e){console.error(e);$("#kpi-parcelles").textContent="—"}
}
function search(q){
 const box=$("#results");box.innerHTML="";if(!state.communes||q.trim().length<2)return;
 const norm=s=>s.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase();
 state.communes.features.filter(f=>norm(f.properties.nom).includes(norm(q))).slice(0,8).forEach(f=>{
  const b=document.createElement("button");b.textContent=f.properties.nom;b.onclick=()=>{map.fitBounds(L.geoJSON(f).getBounds(),{padding:[35,35],maxZoom:13});$("#search").value=f.properties.nom;box.innerHTML=""};box.appendChild(b)
 })
}
map.on("click",e=>select(e.latlng));map.on("moveend",loadVisibleRpg);map.on("zoomend",loadVisibleRpg);
$("#home").onclick=()=>map.fitBounds(C.bounds,{padding:[18,18]});
$("#close").onclick=()=>{$("#drawer").classList.remove("open");$("#drawer").setAttribute("aria-hidden","true")};
$("#search").oninput=e=>search(e.target.value);
$("#search-btn").onclick=()=>search($("#search").value);
$("#layers-btn").onclick=()=>$("#layers").classList.toggle("collapsed");
$$(".layer-row").forEach(b=>b.onclick=()=>{
 const name=b.dataset.layer,on=!b.classList.contains("active");b.classList.toggle("active",on);b.querySelector(".switch").textContent=on?"✓":"";
 if(name==="rpg"){state.rpg=on;on?state.rpgLayer.addTo(map):map.removeLayer(state.rpgLayer);loadVisibleRpg()}
 if(name==="communes"){state.communesOn=on;if(state.communesLayer)on?state.communesLayer.addTo(map):map.removeLayer(state.communesLayer)}
 if(name==="ortho"){state.orthoOn=on;if(on){map.removeLayer(osm);ortho.addTo(map)}else{map.removeLayer(ortho);osm.addTo(map)}}
});
loadCommunes();setTimeout(()=>map.invalidateSize(),100);window.addEventListener("resize",()=>map.invalidateSize());
})();