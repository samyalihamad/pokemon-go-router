"""
algorithms.py  —  YOUR PRACTICE SANDBOX (Python, runs in the browser via Pyodide)
================================================================================
The UI calls the functions below and draws whatever route they return on the map.
The INFRA at the top is done for you. The STUBS at the bottom are the algorithms
we derived together — implement them one at a time, push, and watch your route
light up on the Palo Alto map (on your laptop or your iPhone).

Route contract (what every routing function returns):
  a list of stop INDICES into `stops`, in visit order, e.g. [4, 1, 7, 2].
  A loop/cycle should NOT repeat the first index at the end — the UI closes it.
  Return None while a function is unimplemented (the UI shows a hint).

A `stop` is a dict: {"id": int, "name": str, "lat": float, "lng": float}.
numpy IS available (Pyodide loads it) if you want vectorized k-means, etc.
"""
import math

# --------------------------------- INFRA (done) -----------------------------

WALK_SPEED_MPS = 1.35      # ~human walking speed (m/s)
COOLDOWN_SECONDS = 300     # a PokeStop re-arms 5 minutes after you spin it


def haversine(a, b):
    """Great-circle distance between two stops, in METERS (straight-line)."""
    R = 6371000.0
    lat1, lat2 = math.radians(a["lat"]), math.radians(b["lat"])
    dlat = math.radians(b["lat"] - a["lat"])
    dlng = math.radians(b["lng"] - a["lng"])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def dist(a, b):
    """Distance the algorithms use. Swap to street_distance once you build it and
    every algorithm upgrades from straight-line to real walking distance."""
    return haversine(a, b)


def route_distance(stops, route, close_loop=False):
    """Total meters along a route (open path). close_loop=True for a cycle."""
    if not route or len(route) < 2:
        return 0.0
    d = sum(dist(stops[route[i]], stops[route[i + 1]]) for i in range(len(route) - 1))
    if close_loop:
        d += dist(stops[route[-1]], stops[route[0]])
    return d


def spin_rate_per_hour(k, loop_seconds, cooldown_seconds=COOLDOWN_SECONDS):
    """Spins/hour for a LOOP of k stops taking loop_seconds to walk.
    rate = k / max(T, C): a loop shorter than the cooldown idles; longer is walk-limited."""
    if k == 0:
        return 0.0
    cycle = max(loop_seconds, cooldown_seconds)
    return (k / cycle) * 3600.0


# --------------------------------- STUBS (you) ------------------------------
# Implement these. Each returns a route (list of indices) or None if unsolved.

def nearest_neighbor_route(stops, start_index=0):
    """PROBLEM 1 — Greedy nearest-neighbor  (heuristic, O(n^2), NOT optimal).
    From start_index, always walk to the NEAREST unvisited stop until all visited.
    Fast and decent — but you proved it's beatable (the stranded-stop counterexample).
    Good warm-up and a baseline to compare the others against.
    Return: list of all stop indices in visit order, beginning at start_index.
    """
    # TODO: keep a `visited` set; from the current stop, pick the min-dist() unvisited.
    return None


def optimal_tour(stops, start_index=0):
    """PROBLEM 2 — Optimal tour (TSP)  (exact; only feasible for small n).
    Shortest route visiting EVERY stop. NP-hard: brute force O(n!), Held-Karp DP
    O(2^n * n^2) (ok to ~15 stops). GUARD large n (return None) so you don't hang the
    browser — that guard *is* part of understanding NP-hardness.
    Return: optimal visit order, or None if n is too large.
    """
    # TODO: exact TSP for small subsets (brute force or Held-Karp bitmask DP).
    # This is what you run *inside a cluster* once clusters are small.
    return None


def max_stops_within_budget(stops, start_index=0, budget_meters=1200):
    """PROBLEM 3 — Max stops within a distance budget (Orienteering).
    Visit as MANY stops as possible without exceeding budget_meters of walking,
    starting at start_index. (Drop TSP's "must visit all.") Also NP-hard — a greedy
    or DP-with-pruning heuristic is expected.
    Return: a visit order whose route_distance <= budget_meters.
    """
    # TODO: prize-collecting / orienteering heuristic.
    return None


def best_cooldown_loop(stops, start_index=0):
    """PROBLEM 4 — Best farming LOOP (Objective C: maximize spins/hour).
    Find a CYCLE maximizing spin_rate_per_hour(k, loop_seconds), where
    loop_seconds = route_distance(cycle, close_loop=True) / WALK_SPEED_MPS.
    The twist you found: a loop shorter than the cooldown WASTES it (you idle); much
    longer is walk-limited. Sweet spot = a dense cycle whose walk-time ~ the cooldown.
    Return: the loop (indices; don't repeat the first at the end).
    """
    # TODO: search for the densest cycle whose walk-time ~ COOLDOWN_SECONDS.
    # Builds on Problems 2/3 plus the rate formula (spin_rate_per_hour).
    return None


def cluster_stops(stops, k=4):
    """PROBLEM 5 — Cluster the stops (divide & conquer for big maps).
    Partition stops into k clusters (k-means on lat/lng, or grid buckets). Then solve
    TSP *within* each small cluster and route between cluster super-nodes — the
    cluster-first-route-second idea that tames n! (at the cost of the optimality guarantee).
    Return: a list of clusters; each cluster is a list of stop indices.
    """
    # TODO: k-means (numpy is available) or grid clustering on (lat, lng).
    return None


def street_distance(a, b):
    """ADVANCED — Real walking distance on the sidewalk graph.
    Right now dist() is straight-line. Real life: you walk sidewalks, can't cut through
    buildings. Model a street graph (nodes=intersections, edges=segments), then shortest
    path (BFS if unit edges, Dijkstra if weighted) gives true stop-to-stop distance.
    Precompute an all-pairs matrix once and point dist() here — everything upgrades.
    Return: meters along the street graph (falls back to haversine for now).
    """
    # TODO: build the sidewalk graph + Dijkstra; return true walking distance.
    return haversine(a, b)