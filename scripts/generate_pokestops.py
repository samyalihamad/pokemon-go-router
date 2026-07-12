#!/usr/bin/env python3
"""Generate a synthetic-but-plausible set of PokeStops over downtown Palo Alto.

The real screenshot's exact coordinates aren't recoverable, so we lay stops on a
rotated street grid (Palo Alto's downtown is rotated ~40 deg from N) with jitter,
covering roughly the University Ave core. Output: data/pokestops.json.

Deterministic (fixed seed) so the map is stable across regenerations.
Run: python3 scripts/generate_pokestops.py
"""
import json
import math
import os
import random

random.seed(42)

# Downtown Palo Alto core, ~University Ave & Waverley St.
LAT0, LNG0 = 37.4442, -122.1615
M_PER_DEG_LAT = 111_320.0
M_PER_DEG_LNG = 111_320.0 * math.cos(math.radians(LAT0))
THETA = math.radians(40.0)  # grid rotation

# Street names for flavor (avenues run one way, streets the cross way).
AVENUES = ["Lytton Ave", "Everett Ave", "University Ave", "Hamilton Ave",
           "Forest Ave", "Homer Ave", "Channing Ave"]
STREETS = ["Alma St", "High St", "Emerson St", "Ramona St", "Bryant St",
           "Waverley St", "Cowper St", "Webster St"]

PLACE_KINDS = ["Mural", "Plaque", "Fountain", "Cafe", "Bookstore", "Sculpture",
               "Historic Marker", "Bench", "Community Board", "Gallery"]


def local_to_latlng(x, y):
    """Rotate local meters (x east-ish, y north-ish) by THETA, convert to lat/lng."""
    xr = x * math.cos(THETA) - y * math.sin(THETA)
    yr = x * math.sin(THETA) + y * math.cos(THETA)
    return LAT0 + yr / M_PER_DEG_LAT, LNG0 + xr / M_PER_DEG_LNG


def build():
    spacing = 135.0  # meters between grid lines
    stops = []
    sid = 0
    n_ave, n_str = len(AVENUES), len(STREETS)
    x0 = -(n_str - 1) * spacing / 2
    y0 = -(n_ave - 1) * spacing / 2

    for i, ave in enumerate(AVENUES):
        for j, st in enumerate(STREETS):
            # skip ~15% of intersections so it's not a perfect lattice
            if random.random() < 0.15:
                continue
            x = x0 + j * spacing + random.uniform(-16, 16)
            y = y0 + i * spacing + random.uniform(-16, 16)
            lat, lng = local_to_latlng(x, y)
            kind = random.choice(PLACE_KINDS)
            near = ave if random.random() < 0.5 else st
            stops.append({
                "id": sid,
                "name": f"{kind} near {ave} & {st}",
                "lat": round(lat, 6),
                "lng": round(lng, 6),
            })
            sid += 1
            # ~35% of blocks get an extra mid-block stop toward the next street
            if j < n_str - 1 and random.random() < 0.35:
                xm = x + spacing / 2 + random.uniform(-14, 14)
                ym = y + random.uniform(-14, 14)
                lat, lng = local_to_latlng(xm, ym)
                stops.append({
                    "id": sid,
                    "name": f"{random.choice(PLACE_KINDS)} on {near}",
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                })
                sid += 1
    return stops


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "data", "pokestops.json")
    stops = build()
    with open(out, "w") as f:
        json.dump({"center": {"lat": LAT0, "lng": LNG0}, "stops": stops}, f, indent=2)
    print(f"wrote {len(stops)} pokestops -> {os.path.relpath(out)}")


if __name__ == "__main__":
    main()
