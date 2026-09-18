# Context beyond California

The Earth, Solar System and Milky Way views are separate from the field observations, export layers and true-scale LiDAR scene.

## Earth

`earth-blue-marble.jpg` is NASA Earth Observatory's December 2004 Blue Marble Next Generation composite, with topography and bathymetry, downloaded at 5400 × 2700 pixels on 18 September 2026. Original download URL is in `earth-source.txt`.

Source and imagery credits: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/

The equirectangular texture is mapped onto a sphere. Rivendell uses the atlas center (39.72892 N, 123.64404 W); it is not placed by eye. The initial camera faces western North America. Imagery is a historical composite, not live cloud cover.

## Solar System

NASA NSSDCA mean Sun distances are represented by circular orbital radii on one linear AU scale. Planet symbols are enlarged for legibility. Orbital phases are fixed illustrative positions, not current ephemerides. The view shows the eight planetary orbits and an illustrative asteroid belt, not the full extent of the heliosphere or Oort Cloud.

Distance and Earth diameter source: https://nssdc.gsfc.nasa.gov/planetary/factsheet/

## Milky Way

The galaxy uses ESA's **15 January 2025 Gaia-based Milky Way reconstruction**, credited to **ESA/Gaia/DPAC, Stefan Payne-Wardenaar**, under **CC BY-SA 3.0 IGO**. The unmodified 2100 × 2100 JPEG is rendered as a rotatable map plane. It is an observation-informed artist's reconstruction, not an external photograph or a catalog of individual 3D stars. No procedural spiral is used.

- Image page: https://www.esa.int/ESA_Multimedia/Images/2025/01/The_best_Milky_Way_map_by_Gaia
- Image file: https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2025/01/the_best_milky_way_map_by_gaia/26530987-1-eng-GB/The_best_Milky_Way_map_by_Gaia.jpg
- Licence: https://creativecommons.org/licenses/by-sa/3.0/igo/
- Labelled reference: https://www.esa.int/ESA_Multimedia/Images/2025/01/The_best_Milky_Way_map_by_Gaia_labelled

The Solar System marker is registered to the Sun indicated in ESA's matching labelled image: approximately x = 50%, y = 70.5%, with the galactic center at (50%, 50%). Both images share the same framing; the labelled reference is 2300 × 2300. This is an approximate reading of the published reconstruction, not a precise astrometric position. The camera and interactive label use that same map-plane coordinate. The display scale uses an approximately 26,000-light-year center-to-Sun distance, following NASA's overview; the image includes space beyond the main stellar disk.

Scale references:
- https://science.nasa.gov/universe/exoplanets/our-milky-way-galaxy-how-big-is-space/
- https://science.nasa.gov/learn/basics-of-space-flight/chapter1-1/

The views load on demand and use the atlas's existing bundled Three.js renderer. Both images are served locally; no new API key or external runtime service is required.
