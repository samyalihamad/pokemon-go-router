#!/usr/bin/env python3
"""Build data/pokestops.json from a REAL Pokemon GO map-objects capture.

Personal use only: this reads a `realityChannelMapObjects` response you captured
from your own game session and flattens it into the app's flat stop schema. Not
wired into the app or the public API — it's a local motivation booster so the map
shows the actual stops you walk past.

The PGO payload is grouped by S2 cell, then by object type; real stops live at
  data.realityChannelMapObjectsByS2Cells.mapObjectsBySMapCellsAndTypes[].
    mapObjectsByType[] where type == "PGO_POKESTOP" -> mapObjects[]
Each object carries an opaque base64 id and pgoPokestop.location.{latitude,longitude}.
There is NO name in this call (names come from a separate stop-details fetch), so
stops are named "PokeStop N".

A capture file may contain ONE response, or several responses concatenated
(just copy/pasted back-to-back, `}{` or `}\n{`) — the game returns one payload
per map region, so a walk across town is many responses. We parse them all.

Run: python3 scripts/import_pgo_stops.py path/to/capture.json
     python3 scripts/import_pgo_stops.py capture.json --merge     # keep existing stops
     python3 scripts/import_pgo_stops.py a.json b.json --merge     # several captures at once
"""
import base64
import json
import os
import sys

CENTER = {"lat": 37.4442, "lng": -122.1615}   # downtown Palo Alto (matches OSM script)


def short_id(raw_b64):
    """Decode pgorelease.PGO_POKESTOP.<hash>.<n> -> the <hash>, for a stable tag."""
    try:
        pad = raw_b64 + "=" * (-len(raw_b64) % 4)
        parts = base64.b64decode(pad).decode("utf-8", "replace").split(".")
        return parts[2] if len(parts) >= 3 else raw_b64
    except Exception:
        return raw_b64


def parse_stream(text):
    """Yield each JSON object from a file holding one or more concatenated responses."""
    dec = json.JSONDecoder()
    i, n = 0, len(text)
    while i < n:
        while i < n and text[i] in " \t\r\n":   # skip whitespace between objects
            i += 1
        if i >= n:
            break
        obj, end = dec.raw_decode(text, i)
        yield obj
        i = end


def extract(payload):
    """Flatten the S2-cell / type nesting into (lat, lng, hash) tuples."""
    cells = (payload.get("data", {})
             .get("realityChannelMapObjectsByS2Cells", {})
             .get("mapObjectsByS2CellsAndTypes", []))
    for cell in cells:
        for group in cell.get("mapObjectsByType", []):
            if group.get("type") != "PGO_POKESTOP":
                continue
            for obj in group.get("mapObjects", []):
                stop = obj.get("pgoPokestop") or {}
                loc = stop.get("location") or {}
                lat, lng = loc.get("latitude"), loc.get("longitude")
                if lat is None or lng is None:
                    continue
                yield round(lat, 6), round(lng, 6), short_id(obj.get("id", ""))


def main():
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    merge = "--merge" in sys.argv[1:]
    if not files:
        sys.exit("usage: import_pgo_stops.py <capture.json> [more.json ...] [--merge]")

    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "data", "pokestops.json")

    stops, seen = [], set()
    if merge and os.path.exists(out):
        for s in json.load(open(out)).get("stops", []):
            key = (round(s["lat"], 5), round(s["lng"], 5))
            seen.add(key)
            stops.append(s)

    added = 0
    for path in files:
        with open(path) as f:
            text = f.read()
        for payload in parse_stream(text):        # one file may hold many responses
            for lat, lng, sid in extract(payload):
                key = (round(lat, 5), round(lng, 5))   # dedupe near-duplicates (same as OSM script)
                if key in seen:
                    continue
                seen.add(key)
                stops.append({
                    "id": len(stops),
                    "name": f"PokeStop {len(stops) + 1}",
                    "lat": lat,
                    "lng": lng,
                    "src": "pgo",
                    "pgo_hash": sid,       # extra: real stop hash, for cross-referencing later
                })
                added += 1

    with open(out, "w") as f:
        json.dump({"center": CENTER, "stops": stops}, f, indent=2)
    print(f"added {added} real PGO stops ({len(stops)} total) -> {os.path.relpath(out)}")


if __name__ == "__main__":
    main()
