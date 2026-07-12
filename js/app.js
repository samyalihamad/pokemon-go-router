/* app.js — boot Pyodide, load your algorithms.py, wire the UI to it. */

let STOPS = [];
let startIndex = 0;
let pyodide = null;
let WALK = 1.35;

const $ = (id) => document.getElementById(id);

function flash(msg, isError = false) {
  const el = $("status");
  el.innerHTML = msg;
  el.className = "status" + (isError ? " err" : "");
}

function setLoading(msg) {
  const o = $("loading");
  if (!msg) { o.classList.add("hidden"); return; }
  o.classList.remove("hidden");
  $("loadingMsg").textContent = msg;
}

/** (Re)load algorithms.py into Pyodide — cache-busted so your edits show on refresh. */
async function loadAlgorithms() {
  const src = await (await fetch("algorithms.py?t=" + Date.now())).text();
  pyodide.runPython(src);
  // dispatcher: routes UI calls to your functions, JSON in / JSON out (robust).
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
    const data = await (await fetch("data/pokestops.json")).json();
    STOPS = data.stops;
    MapUI.init(data.center, STOPS, (id) => {
      startIndex = id;
      $("startSel").value = String(id);
      flash(`Start set to #${id} — ${STOPS[id].name}`);
    });
    populateStartSelect();
    $("stopCount").textContent = STOPS.length;

    setLoading("Booting Python (Pyodide)… first load ~5–10s");
    pyodide = await loadPyodide();
    setLoading("Loading numpy…");
    await pyodide.loadPackage("numpy");
    // hand the stops to Python as a clean list-of-dicts
    pyodide.runPython("import json");
    pyodide.globals.set("STOPS_JSON", JSON.stringify(STOPS));
    pyodide.runPython("STOPS = json.loads(STOPS_JSON)");
    await loadAlgorithms();

    wireButtons();
    setLoading(null);
    flash("Ready. Pick a start, then run an algorithm. Edit <code>algorithms.py</code> and refresh.");
  } catch (e) {
    setLoading(null);
    flash("Boot failed: " + e.message, true);
    throw e;
  }
}

function populateStartSelect() {
  const sel = $("startSel");
  sel.innerHTML = STOPS.map((s) => `<option value="${s.id}">#${s.id} — ${s.name}</option>`).join("");
  sel.value = "0";
  sel.addEventListener("change", (e) => { startIndex = Number(e.target.value); });
}

const fmtM = (m) => (m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m");

function py(expr) {
  const r = pyodide.runPython(expr);
  return (r && typeof r.toJs === "function") ? r.toJs() : r;
}

/** distance in meters for a route (via Python — single source of truth). */
function routeMeters(route, closeLoop = false) {
  return py(`route_distance(STOPS, [${route.join(",")}], ${closeLoop ? "True" : "False"})`);
}

/** Call a stubbed routing function; render it, or show a hint if it's still a stub. */
function runRoute(name, { budget = 0, k = 0, closeLoop = false }, statFn) {
  MapUI.clearOverlays();
  let out;
  try {
    out = JSON.parse(py(`_dispatch("${name}", ${startIndex}, ${budget}, ${k})`));
  } catch (e) {
    flash(`${name}() raised: ${e.message}`, true);
    return;
  }
  if (out == null) {
    flash(`🧩 <code>${name}()</code> is still a stub — open <code>algorithms.py</code>, implement it, refresh.`, true);
    return;
  }
  MapUI.drawRoute(out, { closeLoop });
  flash(statFn(out));
}

function wireButtons() {
  $("btnGreedy").onclick = () => runRoute("nearest_neighbor_route", {}, (r) =>
    `Greedy: ${r.length} stops · ${fmtM(routeMeters(r))} walked`);

  $("btnOptimal").onclick = () => runRoute("optimal_tour", {}, (r) =>
    `Optimal (TSP): ${r.length} stops · ${fmtM(routeMeters(r))} walked`);

  $("btnBudget").onclick = () => {
    const budget = Number($("budget").value) || 1200;
    runRoute("max_stops_within_budget", { budget }, (r) =>
      `Orienteering: ${r.length} stops in ${fmtM(routeMeters(r))} (budget ${fmtM(budget)})`);
  };

  $("btnLoop").onclick = () => runRoute("best_cooldown_loop", { closeLoop: true }, (r) => {
    const meters = routeMeters(r, true);
    const secs = meters / WALK;
    const rate = py(`spin_rate_per_hour(${r.length}, ${meters} / WALK_SPEED_MPS)`);
    return `Loop: ${r.length} stops · ${fmtM(meters)} · ${(secs / 60).toFixed(1)} min · <b>${Math.round(rate)} spins/hr</b>`;
  });

  $("btnCluster").onclick = () => {
    const k = Number($("kClusters").value) || 4;
    MapUI.clearOverlays();
    let clusters;
    try { clusters = JSON.parse(py(`_dispatch("cluster_stops", ${startIndex}, 0, ${k})`)); }
    catch (e) { flash(`cluster_stops() raised: ${e.message}`, true); return; }
    if (clusters == null) {
      flash("🧩 <code>cluster_stops()</code> is still a stub — implement it in <code>algorithms.py</code>.", true);
      return;
    }
    MapUI.drawClusters(clusters);
    flash(`Clustered into ${clusters.length} groups (sizes: ${clusters.map((c) => c.length).join(", ")}).`);
  };

  $("btnClear").onclick = () => { MapUI.clearOverlays(); flash("Cleared."); };
}

boot();