// Two separate, finite playable districts built from the original Library's
// hexagonal rooms and bridge geometry. These coordinates never overlap the
// campaign starting region or one another. Shared server validation uses the
// same authored map coordinates as the in-engine client scenery.
export const CELL=16;
export const MODE_MAPS=Object.freeze({
 impostor:{id:'impostor',name:'THE REDACTED ANNEX',i:72,j:72,floor:0,radius:2,
   subtitle:'A sealed council of six witnesses · find the false scribe',
   zones:['judgment','study','quarantine','mirrorhall','vault','observatory','chain','memory','bindery'],
   bridges:['checkpoint','cage','chain','service']},
 horde:{id:'horde',name:'THE DEAD LETTER DEPOT',i:-72,j:72,floor:0,radius:3,
   subtitle:'The last stand · keep the books speaking',
   zones:['refuge','burned','puriflab','obliterated','skeleton','bindery','ashvoid','burning','red'],
   bridges:['patch','service','broken','burned','checkpoint']}
});
export const STATION_OFFSETS=Object.freeze([
 [0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1]
]);
export const BOOK_SITE_OFFSETS=Object.freeze([
 [0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1]
]);
export function modeSpawn(mode){
 const m=MODE_MAPS[mode];if(!m)return null;
 return{x:m.i*CELL+2.65,y:m.j*CELL+.5,floor:m.floor};
}
export function modeSite(mode,index,offsets=STATION_OFFSETS){
 const m=MODE_MAPS[mode];if(!m)return null;
 const [i,j]=offsets[index%offsets.length];
 return{x:(m.i+i)*CELL+2.65,y:(m.j+j)*CELL+.5,
   floor:m.floor,i:m.i+i,j:m.j+j};
}
export function modeInside(mode,point,pad=0){
 const m=MODE_MAPS[mode];if(!m||!point)return true;
 return Number.isFinite(point.x)&&Number.isFinite(point.y)&&
   point.floor===m.floor&&Math.abs(point.x-m.i*CELL)<=(m.radius+.45+pad)*CELL&&
   Math.abs(point.y-m.j*CELL)<=(m.radius+.45+pad)*CELL;
}
export function modeTheme(mode,i,j){
 const m=MODE_MAPS[mode];if(!m)return null;
 const dx=i-m.i,dy=j-m.j;
 if(Math.max(Math.abs(dx),Math.abs(dy))>m.radius)return 'ashvoid';
 const a=Math.abs(dx)*13+Math.abs(dy)*7+Math.abs(dx*dy)*5+(dx>0?3:0)+(dy>0?11:0);
 return m.zones[a%m.zones.length];
}
