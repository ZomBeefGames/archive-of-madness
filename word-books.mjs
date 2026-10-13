// Physical spell-books are the firearms of The Last Shelf. Each bullet is
// literally a printed word from the book. All cadence, ammo, aim and upgrades
// are checked on the server; the browser renders the same authored catalogue.
export const WORD_BOOKS=Object.freeze([
 {id:'primer',name:'POCKET PRIMER',rarity:'WORN',price:0,damage:2,cadence:330,mag:18,reserve:90,range:13,reload:1450,pierce:1,
  colour:'#e9d3a3',words:['NO','STOP','HUSH','TURN','AWAY']},
 {id:'index',name:'INDEX OF ASH',rarity:'UNCOMMON',price:420,damage:3,cadence:205,mag:26,reserve:120,range:16,reload:1700,pierce:1,
  colour:'#f6a356',words:['ASH','CINDER','BURN','EMBER','SMOKE']},
 {id:'redact',name:'THE REDACTION CODEX',rarity:'RARE',price:780,damage:5,cadence:350,mag:15,reserve:100,range:18,reload:1900,pierce:2,
  colour:'#d86f70',words:['ERASE','VOID','STRIKE','SILENCE','DENY']},
 {id:'choir',name:'CHOIR OF CINDERS',rarity:'RARE',price:1060,damage:4,cadence:145,mag:38,reserve:190,range:16,reload:2350,pierce:1,
  colour:'#ffbd6f',words:['SING','SCREAM','WAKE','BLAZE','CHOIR']},
 {id:'atlas',name:'ATLAS OF SPLINTERS',rarity:'EPIC',price:1560,damage:9,cadence:610,mag:9,reserve:68,range:21,reload:2200,pierce:3,
  colour:'#b9c9ff',words:['BREAK','SPLINTER','FRACTURE','SHATTER']},
 {id:'last',name:'THE BOOK OF LAST WORDS',rarity:'LEGENDARY',price:2450,damage:15,cadence:880,mag:6,reserve:42,range:23,reload:2550,pierce:4,
  colour:'#fff2bf',words:['REMEMBER','ETERNITY','OBLIVION','THE END']}
]);
export const WORD_BOOK_BY_ID=Object.freeze(Object.fromEntries(WORD_BOOKS.map(b=>[b.id,b])));
export const WORD_UPGRADE_PRICE=900;
export function newBookInventory(){
 return{owned:['primer'],equipped:'primer',clips:{primer:WORD_BOOKS[0].mag},
   reserves:{primer:WORD_BOOKS[0].reserve},points:250,kills:0,hits:0,
   shots:0,reloadUntil:0,lastShot:0,upgrade:0};
}
export function allowedWordHit(attacker,target,book,cone=.10){
 if(!attacker||!target||!book||target.dead||attacker.floor!==target.floor)return false;
 const dx=target.x-attacker.x,dy=target.y-attacker.y,dist=Math.hypot(dx,dy);
 if(dist<.32||dist>book.range)return false;
 const dot=(dx*Math.cos(attacker.f)+dy*Math.sin(attacker.f))/dist;
 const half=cone+Math.atan2(.35,dist);
 return dot>=Math.cos(half);
}
export function ammoPackCost(book){return Math.max(120,Math.round(book.price*.20)||120)}
