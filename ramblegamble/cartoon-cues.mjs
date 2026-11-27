// Quiet, finite, frame-clocked accents from recorded files only. A missed cue
// is never replayed in a burst on resume; each machine owns one replaceable voice.
export const SLOT_CARTOON_CUES = Object.freeze({
  crank: [[170,'cartoonTwang',1],[410,'cartoonClang',1],[730,'cartoonClatter',.72],[960,'cartoonClang',.56]],
  press: [[180,'cartoonTwang',.64],[300,'cartoonClang',.55]],
  win: [[285,'cartoonTwang',.72],[470,'cartoonClang',.65]],
  loss: [[220,'cartoonClatter',.84],[355,'cartoonClang',.72]],
});
export const ROULETTE_CARTOON_CUES = Object.freeze([
  [.045,'cartoonTwang',1],[.095,'cartoonClatter',.68],[.145,'cartoonClang',.9],
  [.19,'cartoonTwang',.72],[.29,'cartoonClatter',.85],[.36,'cartoonClang',.66],
  [.46,'cartoonTwang',.65],[.56,'cartoonClatter',.78],[.69,'cartoonClang',.63],
  [.76,'cartoonTwang',.55],[.90,'cartoonClang',.72],
]);
export function createCartoonCueTrack(foley,channel) {
  let cues=[], index=0, started=0, armed=false;
  function clear(){if(armed)foley?.stop(channel);armed=false;cues=[];index=0;}
  function begin(time,sequence,scale=1){clear();started=time;cues=(sequence||[]).map(([at,name,volume])=>[at*scale,name,volume]);armed=cues.length>0;}
  function update(time,active=true){
    if(!active){clear();return;}
    if(!armed)return;
    const age=time-started;let latest;
    while(index<cues.length&&age>=cues[index][0])latest=cues[index++];
    if(latest&&age-latest[0]<=105)foley?.start(channel,latest[1],{volume:latest[2],maxDelay:125});
  }
  return {begin,update,clear};
}
