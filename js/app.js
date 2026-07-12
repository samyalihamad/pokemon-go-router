/* app.js — boot Pyodide, load algorithms.py, wire UI + stop maintenance. */

let baseStops = [], STOPS = [], CENTER = { lat: 37.4442, lng: -122.1615 };
let startIndex = 0, pyodide = null, WALK = 1.35, editMode = false;
let edits = { deleted: [], added: [], nextUserId: 1 };
const EDITS_KEY = "pogo_edits_v1";

const $ = (id) => document.getElementById(id);
const fmtM = (m) => (m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m");

function flash(msg, isError = false) { const el = $("status"); el.innerHTML = msg; el.className = "status" + (isError ? " err" : ""); }
function setLoading(msg) { const o = $("loading"); if (!msg) { o.classList.add("hidden"); return; } o.classList.remove("hidden"); $("loadingMsg").textContent = msg; }

/* ---- stop set: base (OSM) + local edits (localStorage) --------------------- */
function loadEdits() {
  try { const e = JSON.parse(localStorage.getItem(EDITS_KEY)); if (e) edits = { deleted: e.deleted || [], added: e.added || [], nextUserId: e.nextUserId || 1 }; }
  catch (_) {}
}
function saveEdits() { localStorage.setItem(EDITS_KEY, JSON.stringify(edits)); }
function computeStops() { const del = new Set(edits.deleted); return baseStops.filter((s) => !del.has(s.id)).concat(edits.added); }

function syncPython() {
  pyodide.globals.set("STOPS_JSON", JSON.stringify(STOPS));
  pyodide.runPython("STOPS = json.loads(STOPS_JSON)");
}
function refreshStops() {
  STOPS = computeStops();
  MapUI.setStops(STOPS);
  populateStartSelect();
  if (pyodide) syncPython();
  MapUI.clearOverlays();
  if (startIndex >= STOPS.length) startIndex = 0;
  $("stopCount").textContent = STOPS.length;
}

/* ---- Pyodide + algorithms.py ---------------------------------------------- */
async function loadAlgorithms() {
  const src = await (await fetch("algorithms.py?t=" + Date.now())).text();
  pyodide.runPython(src);
  pyodide.runPython(`
import json
def _dispatch(name, start_index, budget, k):
    fn = globals()[name]
    if name == "max_stops_within_budget":
        res = fn(STOPS, start_index, budget)
    elif name == "cluster_stops":
        res = fn(STOPS, k)
    else:
        res = fn(STOPS, start_index)
    return json.dumps(res)
`);
  WALK = pyodide.runPython("WALK_SPEED_MPS");
}

async function boot() {
  try {
    setLoading("Loading map + stops…");
    const data = await (await fetch("data/pokestops.json?t=" + Date.now())).json();
    baseStops = data.stops; CENTER = data.center || CENTER;
    loadEdits();
    STOPS = computeStops();
    MapUI.init(CENTER, STOPS, { onStopClick: handleStopClick, onMapClick: handleMapClick });
    populateStartSelect();
    $("stopCount").textContent = STOPS.length;

    setLoading("Booting Python (Pyodide)… first load ~5–10s");
    pyodide = await loadPyodide();
    setLoading("Loading numpy…");
    await pyodide.loadPackage("numpy");
    pyodide.runPython("import json");
    syncPython();
    await loadAlgorithms();

    wireButtons();
    setLoading(null);
    flash("Ready. Pick a start, run an algorithm, or ✏️ Edit stops to curate the map.");
  } catch (e) { setLoading(null); flash("Boot failed: " + e.message, true); throw e; }
}

function populateStartSelect() {
  const sel = $("startSel");
  sel.innerHTML = STOPS.map((s, i) => `<option value="${i}">#${i} — ${s.name}</option>`).join("");
  sel.value = String(Math.min(startIndex, STOPS.length - 1));
  sel.onchange = (e) => { startIndex = Number(e.target.value); };
}

/* ---- edit interactions ----------------------------------------------------- */
function handleStopClick(index) {
  if (editMode) return deleteStop(index);
  startIndex = index; $("startSel").value = String(index);
  flash(`Start set to #${index} — ${STOPS[index].name}`);
}
function handleMapClick(latlng) { if (editMode) addStop(latlng); }

function addStop(latlng) {
  const name = (prompt("Name for this stop?", "New stop") || "").trim() || "New stop";
  edits.added.push({ id: "u" + (edits.nextUserId++), name,
                     lat: +latlng.lat.toFixed(6), lng: +latlng.lng.toFixed(6), src: "user" });
  saveEdits(); refreshStops();
  flash(`➕ Added "${name}". ${STOPS.length} stops (saved on this device).`);
}
function deleteStop(index) {
  const s = STOPS[index];
  if (!confirm(`Delete "${s.name}"?`)) return;
  if (String(s.id).startsWith("u")) edits.added = edits.added.filter((a) => a.id !== s.id);
  else edits.deleted.push(s.id);
  saveEdits(); refreshStops();
  flash(`🗑️ Deleted "${s.name}". ${STOPS.length} stops.`);
}
function toggleEdit() {
  editMode = !editMode;
  document.body.classList.toggle("editing", editMode);
  $("btnEdit").classList.toggle("on", editMode);
  $("editBanner").classList.toggle("hidden", !editMode);
  flash(editMode ? "✏️ <b>Edit mode</b>: tap the map to ADD a stop, tap a stop to DELETE it."
                 : "Edit mode off.");
}
function exportStops() {
  const out = { center: CENTER, stops: STOPS.map((s, i) => ({ id: i, name: s.name, lat: s.lat, lng: s.lng, src: s.src || "osm" })) };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "pokestops.json"; a.click();
  flash(`Exported ${STOPS.length} stops → drop the file in <code>data/</code> and commit to make it canonical.`);
}
function resetStops() {
  if (!confirm("Discard your local add/delete edits and reset to the OSM base?")) return;
  edits = { deleted: [], added: [], nextUserId: 1 }; saveEdits(); refreshStops();
  flash("Reset to the base OSM stops.");
}

/* ---- algorithm runners ----------------------------------------------------- */
function py(expr) { const r = pyodide.runPython(expr); return (r && typeof r.toJs === "function") ? r.toJs() : r; }
function routeMeters(route, closeLoop = false) { return py(`route_distance(STOPS, [${route.join(",")}], ${closeLoop ? "True" : "False"})`); }

function runRoute(name, { budget = 0, k = 0, closeLoop = false }, statFn) {
  MapUI.clearOverlays();
  let out;
  try { out = JSON.parse(py(`_dispatch("${name}", ${startIndex}, ${budget}, ${k})`)); }
  catch (e) { flash(`${name}() raised: ${e.message}`, true); return; }
  if (out == null) { flash(`🧩 <code>${name}()</code> is still a stub — implement it in <code>algorithms.py</code>, refresh.`, true); return; }
  MapUI.drawRoute(out, { closeLoop });
  flash(statFn(out));
}

function wireButtons() {
  $("btnGreedy").onclick = () => runRoute("nearest_neighbor_route", {}, (r) => `Greedy: ${r.length} stops · ${fmtM(routeMeters(r))} walked`);
  $("btnOptimal").onclick = () => runRoute("optimal_tour", {}, (r) => `Optimal (TSP): ${r.length} stops · ${fmtM(routeMeters(r))} walked`);
  $("btnBudget").onclick = () => { const budget = Number($("budget").value) || 1200;
    runRoute("max_stops_within_budget", { budget }, (r) => `Orienteering: ${r.length} stops in ${fmtM(routeMeters(r))} (budget ${fmtM(budget)})`); };
  $("btnLoop").onclick = () => runRoute("best_cooldown_loop", { closeLoop: true }, (r) => {
    const meters = routeMeters(r, true), secs = meters / WALK;
    const rate = py(`spin_rate_per_hour(${r.length}, ${meters} / WALK_SPEED_MPS)`);
    return `Loop: ${r.length} stops · ${fmtM(meters)} · ${(secs / 60).toFixed(1)} min · <b>${Math.round(rate)} spins/hr</b>`;
  });
  $("btnCluster").onclick = () => {
    const k = Number($("kClusters").value) || 4;
    MapUI.clearOverlays();
    let clusters;
    try { clusters = JSON.parse(py(`_dispatch("cluster_stops", ${startIndex}, 0, ${k})`)); }
    catch (e) { flash(`cluster_stops() raised: ${e.message}`, true); return; }
    if (clusters == null) { flash("🧩 <code>cluster_stops()</code> is still a stub — implement it in <code>algorithms.py</code>.", true); return; }
    MapUI.drawClusters(clusters);
    flash(`Clustered into ${clusters.length} groups (sizes: ${clusters.map((c) => c.length).join(", ")}).`);
  };
  $("btnClear").onclick = () => { MapUI.clearOverlays(); flash("Cleared."); };

  $("btnEdit").onclick = toggleEdit;
  $("btnExport").onclick = exportStops;
  $("btnReset").onclick = resetStops;
}

boot();
