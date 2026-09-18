// Mean Sun distances (million km), NASA NSSDCA Planetary Fact Sheet.
// Fixed orbital phases illustrate the architecture; they are not an ephemeris.
// Display radii are deliberately enlarged, but leave the inner orbits clear.
export const SOLAR_DISPLAY={unitsPerAU:3,sunRadius:.32,sunGlowDiameter:1.4,earthGlowDiameter:.85};
export const PLANETS=[
 ['Mercury',57.9,'#bbb4a8',.065,2.3],['Venus',108.2,'#e6c693',.14,4.0],
 ['Earth',149.6,'#71d5ec',.15,.6],['Mars',228,'#da9273',.085,5.2],
 ['Jupiter',778.5,'#d7b590',1.65,2.0],['Saturn',1432,'#dfcaa4',1.4,4.1],
 ['Uranus',2867,'#9bd6d9',1.15,.6],['Neptune',4515,'#748eda',1.1,3.3]
].map(([name,distance,color,radius,phase])=>({name,au:distance/149.6,color,radius,phase}));
export function globePoint(lat,lon,radius=100){
 const p=lat*Math.PI/180,l=lon*Math.PI/180;
 return [radius*Math.cos(p)*Math.cos(l),radius*Math.sin(p),-radius*Math.cos(p)*Math.sin(l)];
}
export function seededRandom(seed=7219){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}

// Normalized image coordinates read from ESA's matching labelled 2025 map.
// Image 1: unlabelled 2100 px; reference: labelled 2300 px (same framing).
export const GAIA_MAP={center:[.5,.5],sun:[.5,.705],width:26000/(.705-.5)/500,source:'https://www.esa.int/ESA_Multimedia/Images/2025/01/The_best_Milky_Way_map_by_Gaia_labelled'};
