#!/usr/bin/env python3
"""Build data/pokestops.json from REAL OpenStreetMap POIs in downtown Palo Alto.

PokeStops are Niantic "Wayspots" — public art, plaques, monuments, fountains,
landmarks — which are largely present in OpenStreetMap (open data, ODbL). This
queries the Overpass API for those POI types and writes them as our stop set.
It's a legitimate, downloadable PROXY for the real stops (good overlap, not exact)
— curate it toward the true game stops using the app's add/delete tools.

Run: python3 scripts/fetch_osm_pokestops.py
"""
import json
import os
import time
import urllib.parse
import urllib.request

# Downtown Palo Alto core (south, west, north, east).
BBOX = (37.4400, -122.1690, 37.4510, -122.1500)
CENTER = {"lat": 37.4442, "lng": -122.1615}

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# POI kinds that commonly become PokeStops.
QUERY = f"""
[out:json][timeout:60];
(
  nwr["tourism"~"artwork|attraction|gallery|museum"]{BBOX};
  nwr["historic"]{BBOX};
  nwr["amenity"~"fountain|place_of_worship|library|community_centre|theatre|arts_centre|townhall|marketplace|cinema"]{BBOX};
  nwr["man_made"~"obelisk|tower|water_well|clock"]{BBOX};
  nwr["leisure"~"park|garden|fitness_station"]{BBOX};
);
out center tags;
"""


def humanize(tags):
    if tags.get("name"):
        return tags["name"]
    for k in ("tourism", "historic", "amenity", "man_made", "leisure"):
        if k in tags:
            return tags[k].replace("_", " ").title()
    return "PokéStop"


def fetch():
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    last = None
    for url in ENDPOINTS:
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": "pogo-router/1.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa
            last = e
            print(f"  {url} failed ({e}); trying next mirror…")
            time.sleep(1)
    raise SystemExit(f"All Overpass mirrors failed: {last}")


def main():
    print("Querying Overpass for downtown Palo Alto POIs…")
    res = fetch()
    stops, seen = [], set()
    for el in res.get("elements", []):
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lng = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lng is None:
            continue
        key = (round(lat, 5), round(lng, 5))   # dedupe near-duplicates
        if key in seen:
            continue
        seen.add(key)
        stops.append({
            "id": len(stops),
            "name": humanize(el.get("tags", {})),
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "src": "osm",
        })

    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "data", "pokestops.json")
    with open(out, "w") as f:
        json.dump({"center": CENTER, "stops": stops}, f, indent=2)
    print(f"wrote {len(stops)} real OSM stops -> {os.path.relpath(out)}")


if __name__ == "__main__":
    main()
