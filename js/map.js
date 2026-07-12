/* map.js — Leaflet map, PokeStop overlay, and route/cluster rendering. */

const MapUI = (() => {
  let map, stopLayer, routeLayer, clusterLayer, startMarker;
  let stops = [];

  const CLUSTER_COLORS = ["#e6194B", "#3cb44b", "#4363d8", "#f58231", "#911eb4",
                          "#42d4f4", "#f032e6", "#bfef45", "#fabed4", "#469990"];

  function init(center, stopsData, onStopClick) {
    stops = stopsData;
    map = L.map("map", { zoomControl: true }).setView([center.lat, center.lng], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    stopLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    clusterLayer = L.layerGroup().addTo(map);

    renderStops(onStopClick);
    fitToStops();
  }

  function stopIcon(color) {
    return L.divIcon({
      className: "pokestop-icon",
      html: `<div class="pokestop-dot" style="--c:${color}"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  function renderStops(onStopClick) {
    stopLayer.clearLayers();
    stops.forEach((s) => {
      const m = L.marker([s.lat, s.lng], { icon: stopIcon("#2a75bb") })
        .bindTooltip(`#${s.id} · ${s.name}`, { direction: "top" });
      m.on("click", () => onStopClick && onStopClick(s.id));
      m.addTo(stopLayer);
    });
  }

  function fitToStops() {
    if (!stops.length) return;
    const b = L.latLngBounds(stops.map((s) => [s.lat, s.lng]));
    map.fitBounds(b, { padding: [40, 40] });
  }

  /** Draw a route (array of stop indices). closeLoop connects the last back to the first. */
  function drawRoute(route, { closeLoop = false, color = "#e3350d" } = {}) {
    routeLayer.clearLayers();
    if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
    if (!route || route.length === 0) return;

    const pts = route.map((i) => [stops[i].lat, stops[i].lng]);
    if (closeLoop) pts.push(pts[0]);
    L.polyline(pts, { color, weight: 4, opacity: 0.85 }).addTo(routeLayer);

    // number the visit order
    route.forEach((i, order) => {
      L.marker([stops[i].lat, stops[i].lng], {
        icon: L.divIcon({
          className: "order-badge",
          html: `<div class="order-num">${order + 1}</div>`,
          iconSize: [20, 20], iconAnchor: [10, 10],
        }),
      }).addTo(routeLayer);
    });

    // highlight the start
    const s = stops[route[0]];
    startMarker = L.marker([s.lat, s.lng], {
      icon: L.divIcon({ className: "start-icon", html: `<div class="start-dot"></div>`,
                        iconSize: [22, 22], iconAnchor: [11, 11] }),
    }).addTo(map);
  }

  /** Color stops by cluster: clusters is number[][] of stop indices. */
  function drawClusters(clusters) {
    clusterLayer.clearLayers();
    routeLayer.clearLayers();
    if (!clusters) return;
    clusters.forEach((idxs, ci) => {
      const color = CLUSTER_COLORS[ci % CLUSTER_COLORS.length];
      idxs.forEach((i) => {
        L.marker([stops[i].lat, stops[i].lng], { icon: stopIcon(color) })
          .bindTooltip(`cluster ${ci} · #${i}`, { direction: "top" })
          .addTo(clusterLayer);
      });
    });
  }

  function clearOverlays() {
    routeLayer.clearLayers();
    clusterLayer.clearLayers();
    if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  }

  return { init, drawRoute, drawClusters, clearOverlays };
})();