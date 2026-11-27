// Presentation only: saved integer balances are never mutated by interpolation.
export const SCORE_FORMAT=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
export function balanceDuration(delta,currency){return Math.min(1050,360+Math.log10(Math.abs(delta)+1)*100+(currency==='stars'?220:0));}
export function balanceFrame(from,to,elapsed,duration){
 if(elapsed>=duration||duration<=0)return to;
 if(elapsed<=0)return from;
 const t=1-(1-elapsed/duration)**3;
 return Math.max(Math.min(from,to),Math.min(Math.max(from,to),Math.round(from+(to-from)*t)));
}
// CSS monospace metrics plus conservative rounding; actual text is never truncated.
export function balanceLayout(width,points,stars){
 const icon=width<120?12:width<165?15:19, gap=width<120?3:4;
 const textBudget=Math.max(1,width-14-icon*2-gap*3-5);
 const p=SCORE_FORMAT.format(points).length,s=SCORE_FORMAT.format(stars).length;
 return {icon,gap,font:Math.min(16,Math.floor(textBudget/((p+s)*.62)*10)/10),p,s};
}
export function balanceParticles(currency,delta){return currency==='stars'?Math.min(9,4+Math.abs(delta)):Math.min(8,3+Math.floor(Math.log10(Math.abs(delta)+1)));}
