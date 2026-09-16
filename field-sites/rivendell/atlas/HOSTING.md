# Rivendell Field Atlas

Canonical URL: https://daviddralle.github.io/field-sites/rivendell/atlas/

Static Leaflet/Three.js atlas. All required map data and rendering libraries are included here; optional satellite imagery comes from Esri. No OpenAI hosting, API keys, or server runtime is required.

Initial migration from the independently hostable `dist/` tree in `/Users/daviddralle/Projects/rivendell-site-atlas`, source commit f02a1d5fa617efb6e0c5dd165e9bd5d2a6c2b950. The original checkout and complete portable bundle retain source data, reconstruction scripts, and QA reports. The GitHub copy adds a shared navigation bar from `/assets/rivendell-nav.css`.

Preserve the groundwater dashboard at the parent URL; it has its own data refresh process. Future atlas updates should be published here. The former OpenAI site is being retired from public access after this deployment is verified.

## Elevation and contour display

`terrain-surface.js` samples the triangles drawn by the 3D LiDAR mesh and splits
context/contour segments at facet boundaries. All surface points, well collars,
and VMS collars use that surface; subsurface lengths and angles are preserved.
Survey elevations remain original source attributes. Horizontal positions are
unchanged. `contour-labels.js` labels 10 m index contours with shared collision
avoidance for map and 3D views.

After replacing LiDAR terrain or feature coordinates, run:

```sh
python3 scripts/audit-atlas-ground.py
node scripts/check-atlas-terrain.cjs
```

The first command rebuilds `data/ground-elevations.json` for feature details;
the second checks triangle sampling, draping, VMS geometry and contour intervals.
