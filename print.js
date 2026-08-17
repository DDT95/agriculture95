(function () {
  const opener = window.opener;
  const app = opener && opener.agriPrintApp;
  if (!app) {
    document.body.innerHTML =
      '<p style="padding:40px;font:16px Marianne,Arial,sans-serif">' +
      "Cette page s’ouvre depuis le bouton “Imprimer la carte” de la carte agricole." +
      "</p>";
    return;
  }
  const { layers, wmts, mapRef, activeRef } = app;
  const activeIds = activeRef.current || [];
  const activeLayers = layers.filter((l) => activeIds.includes(l.id));

  document.getElementById("printTitle").textContent = activeLayers.length
    ? activeLayers.map((l) => l.label).join(" · ")
    : "Agriculture du Val-d’Oise";

  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  document.getElementById("printSources").innerHTML = `
    <span class="src-line">Sources : IGN (RPG, BD Haie, Hydrographie, Cadastre) · SIRENE · CartoBio</span>
    <span class="src-line">Auteur : DDT 95 - BVAT PG</span>
    <span class="src-line">Date : ${today}</span>
  `;

  document.getElementById("printLegend").innerHTML = activeLayers.length
    ? activeLayers.map((l) => `<div class="legend-block"><i style="background:${l.color}"></i>${l.label}</div>`).join("")
    : '<div class="legend-empty">Aucune couche sélectionnée</div>';

  const map = L.map("printMapCanvas", {
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
    tap: false,
  });
  map.createPane("maskPane");
  map.getPane("maskPane").style.zIndex = 420;
  map.getPane("maskPane").style.pointerEvents = "none";
  map.createPane("boundaryPane");
  map.getPane("boundaryPane").style.zIndex = 430;
  map.getPane("boundaryPane").style.pointerEvents = "none";

  // html2canvas ne capture pas les filtres CSS (grayscale/hue-rotate) : le
  // même effet est donc appliqué pixel par pixel sur les tuiles concernées,
  // pour qu’il soit bien présent dans l’image capturée puis dans le PDF.
  function pixelTileLayer(transform) {
    return L.TileLayer.extend({
      createTile(coords, done) {
        const tile = document.createElement("canvas");
        const size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;
        const ctx = tile.getContext("2d");
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          ctx.drawImage(img, 0, 0, size.x, size.y);
          try {
            const data = ctx.getImageData(0, 0, size.x, size.y);
            transform(data.data);
            ctx.putImageData(data, 0, 0);
          } catch (e) {}
          done(null, tile);
        };
        img.onerror = (e) => done(e, tile);
        img.src = this.getTileUrl(coords);
        return tile;
      },
    });
  }

  function neutralize(d) {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      d[i] = Math.min(255, gray * 1.09);
      d[i + 1] = Math.min(255, gray * 1.09);
      d[i + 2] = Math.min(255, gray * 1.09);
    }
  }
  function greenify(d) {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 10) {
        d[i] = 0x2f;
        d[i + 1] = 0x6b;
        d[i + 2] = 0x3c;
      }
    }
  }

  const NeutralPlan = pixelTileLayer(neutralize);
  new NeutralPlan("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

  if (activeIds.includes("rpg")) L.tileLayer(wmts("LANDUSE.AGRICULTURE2024"), { opacity: 0.72, maxZoom: 19 }).addTo(map);
  if (activeIds.includes("hedges")) {
    const HedgeLayer = pixelTileLayer(greenify);
    new HedgeLayer(wmts("IGNF_BD-HAIE-V1_2020"), { opacity: 0.9, maxZoom: 19 }).addTo(map);
  }
  if (activeIds.includes("water")) L.tileLayer(wmts("HYDROGRAPHY.HYDROGRAPHY"), { opacity: 0.72, maxZoom: 19 }).addTo(map);
  if (activeIds.includes("cadastre")) L.tileLayer(wmts("CADASTRALPARCELS.PARCELLAIRE_EXPRESS"), { opacity: 0.78, minZoom: 14, maxZoom: 19 }).addTo(map);

  const dataFetches = [];
  if (activeIds.includes("bio")) dataFetches.push(fetch("data/cartobio-val-doise.geojson").then((r) => r.json()).then((d) => ({ id: "bio", data: d })).catch(() => null));
  if (activeIds.includes("farms")) dataFetches.push(fetch("data/exploitations-sirene-95.geojson").then((r) => r.json()).then((d) => ({ id: "farms", data: d })).catch(() => null));
  if (activeIds.includes("coops")) dataFetches.push(fetch("data/cooperatives-agricoles-95.geojson").then((r) => r.json()).then((d) => ({ id: "coops", data: d })).catch(() => null));
  if (activeIds.includes("equipment")) dataFetches.push(fetch("data/materiel-agricole-95.geojson").then((r) => r.json()).then((d) => ({ id: "equipment", data: d })).catch(() => null));

  const markerColors = { farms: "#18753c", coops: "#6a4c93", equipment: "#c65d21" };

  let territoryLayer = null;

  function niceScaleNumber(n) {
    const pow10 = Math.pow(10, String(Math.floor(n)).length - 1);
    const d = n / pow10;
    return pow10 * (d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1);
  }
  function renderScaleBar() {
    const targetPx = 160;
    const size = map.getSize();
    const y = size.y / 2;
    const maxMeters = map.distance(map.containerPointToLatLng([0, y]), map.containerPointToLatLng([targetPx, y]));
    const meters = niceScaleNumber(maxMeters);
    const fullPx = targetPx * (meters / maxMeters);
    const segments = 4;
    const segPx = fullPx / segments;
    const unit = meters >= 1000 ? meters / 1000 : meters;
    const unitLabel = meters >= 1000 ? "km" : "m";
    const bars = Array.from({ length: segments })
      .map((_, i) => `<div class="scale-seg ${i % 2 === 0 ? "on" : "off"}" style="width:${segPx}px"></div>`)
      .join("");
    const ticks = Array.from({ length: segments + 1 })
      .map((_, i) => `<span style="left:${i * segPx}px">${((unit / segments) * i).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</span>`)
      .join("");
    document.getElementById("printScale").innerHTML = `
      <div class="scale-frame" style="width:${fullPx}px">
        <div class="scale-bar-row">${bars}</div>
        <div class="scale-ticks" style="width:${fullPx}px">${ticks}<span class="scale-unit" style="left:${fullPx}px">${unitLabel}</span></div>
      </div>
    `;
  }

  const statusEl = document.getElementById("pdfStatus");

  async function buildPdf() {
    const node = document.getElementById("printPage");
    const canvas = await html2canvas(node, { scale: 2.5, useCORS: true, backgroundColor: "#ffffff" });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 420, 297, undefined, "FAST");
    const blobUrl = URL.createObjectURL(doc.output("blob"));
    window.location.replace(blobUrl);
  }

  function finalizeMap() {
    map.invalidateSize();
    if (territoryLayer) map.fitBounds(territoryLayer.getBounds(), { padding: [18, 18] });
    renderScaleBar();
    setTimeout(() => {
      buildPdf().catch((err) => {
        console.error(err);
        statusEl.textContent = "La génération du PDF a échoué. Réessayez depuis la carte.";
      });
    }, 900);
  }

  Promise.all([
    fetch("https://geo.api.gouv.fr/departements/95/communes?fields=nom,code,contour&format=geojson&geometry=contour").then((r) => r.json()),
    ...dataFetches,
  ]).then(([communes, ...results]) => {
    const holes = [];
    (communes.features || []).forEach((f) => {
      const g = f.geometry;
      if (g?.type === "Polygon" && g.coordinates?.[0]) holes.push(g.coordinates[0]);
      if (g?.type === "MultiPolygon") g.coordinates?.forEach((p) => { if (p?.[0]) holes.push(p[0]); });
    });
    L.geoJSON(
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...holes] },
      },
      { pane: "maskPane", interactive: false, style: { stroke: false, fillColor: "#ffffff", fillOpacity: 1, fillRule: "evenodd" } }
    ).addTo(map);
    territoryLayer = L.geoJSON(communes, {
      pane: "boundaryPane",
      interactive: false,
      style: { color: "#2d3240", weight: 1, opacity: 0.9, fillOpacity: 0 },
    }).addTo(map);

    results.filter(Boolean).forEach(({ id, data }) => {
      if (id === "bio") {
        L.geoJSON(data, { style: { color: "#18753c", weight: 1.3, fillColor: "#55a66b", fillOpacity: 0.58 } }).addTo(map);
        return;
      }
      const color = markerColors[id];
      (data.features || []).forEach((feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        L.circleMarker([lat, lon], { radius: 4, color: "#fff", weight: 1, fillColor: color, fillOpacity: 1 }).addTo(map);
      });
    });

    map.invalidateSize();
    if (territoryLayer) map.fitBounds(territoryLayer.getBounds(), { padding: [18, 18] });
    map.whenReady(() => setTimeout(finalizeMap, 700));
  });

  document.getElementById("printNow")?.addEventListener("click", () => window.print());
})();
