# ⚡ PokéStop Route Optimizer (Palo Alto)

A map of ~72 PokéStops in downtown Palo Alto + a **Python algorithm sandbox**. The UI and
infra are done; **you implement the routing algorithms in [`algorithms.py`](algorithms.py)**
and watch your routes draw on the map — on your laptop or your iPhone.

Python runs **in the browser** via [Pyodide](https://pyodide.org) (WASM), so there's no server:
edit `algorithms.py`, refresh, done.

![what it is](icon.svg)

## Run it

**Locally:**
```bash
python3 -m http.server 8000
# open http://localhost:8000  (first load boots Pyodide, ~5–10s)
```

**On your iPhone:** open the GitHub Pages URL below in Safari → Share → **Add to Home Screen**
(it's a PWA, so it opens fullscreen like a native app).

> **Live:** https://samyalihamad.github.io/pokemon-go-router/  *(after Pages finishes building)*

## What to build

Six functions in [`algorithms.py`](algorithms.py) are stubbed (they return `None`; the UI shows a
hint). Implement them one at a time:

1. `nearest_neighbor_route` — greedy baseline
2. `optimal_tour` — exact TSP (small n)
3. `max_stops_within_budget` — orienteering
4. `best_cooldown_loop` — max spins/hour (the real game)
5. `cluster_stops` — k-means / grid clustering
6. `street_distance` — real sidewalk-graph walking distance (advanced)

The full derivation, the objective ladder, and the math (including why greedy isn't optimal and
the `rate = k / max(T, C)` cooldown model) are in **[PLAN.md](PLAN.md)**.

## Regenerate the stops
```bash
python3 scripts/generate_pokestops.py
```

## Stack
Leaflet + OpenStreetMap · Pyodide (Python/numpy in the browser) · static site (GitHub Pages) · PWA.
