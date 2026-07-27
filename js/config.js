window.APP_CONFIG = {
  title: 'Agriculture 95',
  departmentCode: '95',
  departmentName: "Val-d'Oise",
  initialView: { center: [49.075, 2.10], zoom: 9 },
  bounds: [[48.86, 1.55], [49.25, 2.62]],
  rpgMinZoom: 13,
  rpgApi: 'https://apicarto.ign.fr/api/rpg/v2',
  communesApi: 'https://geo.api.gouv.fr/departements/95/communes?format=geojson&geometry=contour',
  reverseCommuneApi: 'https://geo.api.gouv.fr/communes',
  bioApi: 'https://opendata.agencebio.org/api/gouv/operateurs/',
  baseLayers: {
    osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 },
    ortho: { url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', attribution: '&copy; IGN', maxZoom: 19 },
    hydro: { url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=HYDROGRAPHIE.THEME&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', attribution: '&copy; IGN', maxZoom: 18 }
  },
  cropFamilies: [
    { keys:['BLE','BTH','BDH','ORH','ORP','AVH','AVP','TCR'], label:'Céréales', color:'#d9b44a' },
    { keys:['MIS','MIE','SOG'], label:'Maïs et sorgho', color:'#edca2e' },
    { keys:['CZH','TRN','SOJ','OLI'], label:'Oléagineux', color:'#e6a23c' },
    { keys:['PPH','PTR','PRA','SPH'], label:'Prairies', color:'#6ba94b' },
    { keys:['LUZ','LOT','TRE','FVL','PHI'], label:'Légumineuses', color:'#3b9b72' },
    { keys:['VRG','VRC','VRT','POT','CAR','OIG','MAR'], label:'Maraîchage', color:'#1f8f5f' },
    { keys:['VIG'], label:'Vignes', color:'#8b5a8c' },
    { keys:['VER','NOX','PFR','ARB'], label:'Arboriculture', color:'#4f7d3a' },
    { keys:['JAC','J6S','J5M'], label:'Jachères', color:'#b8a88a' },
    { keys:[], label:'Autres cultures', color:'#9a7b55' }
  ]
};
