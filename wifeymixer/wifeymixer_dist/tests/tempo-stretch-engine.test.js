const assert=require('assert');
global.window=global;
require('../tempo-stretch-engine.js');
const E=global.WIFEY_TEMPO_STRETCH;

class FakeBuffer{
  constructor(channels,length,sampleRate){
    this.numberOfChannels=channels; this.length=length; this.sampleRate=sampleRate; this.duration=length/sampleRate;
    this._data=Array.from({length:channels},()=>new Float32Array(length));
  }
  getChannelData(c){return this._data[c]}
}
const ctx={createBuffer:(channels,length,sampleRate)=>new FakeBuffer(channels,length,sampleRate)};
function clickBuffer({seconds=8,sr=48000,bpm=120,channels=1,offsetSamples=0,phase=0}={}){
  const b=new FakeBuffer(channels,Math.round(seconds*sr),sr);
  const beat=60/bpm;
  for(let t=0;t<seconds;t+=beat){
    const center=Math.round((t+phase)*sr)+offsetSamples;
    for(let c=0;c<channels;c++){
      const d=b.getChannelData(c);
      for(let k=0;k<80;k++){
        const i=center+k;if(i>=0&&i<d.length)d[i]+=Math.exp(-k/17)*(c?0.78:1);
      }
    }
  }
  // Low sustained tone gives WSOLA waveform context between transients.
  for(let c=0;c<channels;c++){
    const d=b.getChannelData(c);
    for(let i=0;i<d.length;i++)d[i]+=0.025*Math.sin(2*Math.PI*(110+c*23)*i/sr);
  }
  return b;
}
function peakIndex(data,center,radius){
  let best=Math.max(0,center-radius),amp=-1;
  const end=Math.min(data.length,center+radius+1);
  for(let i=Math.max(0,center-radius);i<end;i++){const a=Math.abs(data[i]);if(a>amp){amp=a;best=i}}
  return best;
}
function assertFiniteBuffer(b){
  for(let c=0;c<b.numberOfChannels;c++)for(const v of b.getChannelData(c))assert(Number.isFinite(v),'non-finite sample');
}

assert(E && /^2\./.test(E.VERSION));
for(const ratio of [0.8,1.25,1.38]){
  const a=clickBuffer({channels:2});
  const b=clickBuffer({channels:1});
  const plan=E.createPlan(a,ratio);
  assert.strictEqual(plan.outputLength,Math.round(a.length/ratio));
  const expectedHop=plan.synthHop*ratio;
  const candidateStep=E.normalizedOptions(a.sampleRate).candidateStep;
  for(let frame=0;frame<plan.sourceStarts.length;frame++){
    const theoretical=Math.round(frame*expectedHop);
    const maxStart=Math.max(0,a.length-plan.sequence);
    const expected=Math.min(maxStart,theoretical);
    assert(Math.abs(plan.sourceStarts[frame]-expected)<=plan.searchRadius+candidateStep,
      `plan drifted outside bounded search at frame ${frame}`);
  }
  const outA=E.applyPlan(ctx,a,ratio,plan);
  const outB=E.applyPlan(ctx,b,ratio,plan);
  assert.strictEqual(outA.length,Math.round(a.length/ratio));
  assert.strictEqual(outB.length,Math.round(b.length/ratio));
  assertFiniteBuffer(outA);assertFiniteBuffer(outB);
  // Shared plan must keep corresponding transients aligned across stems.
  for(let beat=1;beat<=Math.min(10,Math.floor(7.2/(.5)));beat++){
    const expected=Math.round((beat*.5/ratio)*a.sampleRate);
    const pa=peakIndex(outA.getChannelData(0),expected,Math.round(.035*a.sampleRate));
    const pb=peakIndex(outB.getChannelData(0),expected,Math.round(.035*a.sampleRate));
    assert(Math.abs(pa-pb)<=2,`stems differ by ${Math.abs(pa-pb)} samples at ratio ${ratio}`);
    assert(Math.abs(pa-expected)<=Math.round(.035*a.sampleRate),`transient left expected tempo window at ratio ${ratio}`);
  }
}

// Silence and very short material must remain finite and exact-length.
for(const ratio of [.5,2]){
  const silence=new FakeBuffer(1,997,44100);
  const out=E.applyPlan(ctx,silence,ratio);
  assert.strictEqual(out.length,Math.round(997/ratio));
  assertFiniteBuffer(out);
}

assert.strictEqual(E.scaleSecondsForTempo(4,120,150),3.2);
assert.strictEqual(E.scaleSecondsForTempo(2.5,100,80),3.125);
assert.throws(()=>E.createPlan(null,1.2),/AudioBuffer-like/);
assert.throws(()=>E.applyPlan({},clickBuffer(),1.2),/createBuffer/);
console.log('tempo-stretch-engine: all assertions passed');
