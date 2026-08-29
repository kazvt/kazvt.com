/*
  WIFEY MIX-8 — drift-safe pitch-preserving tempo engine
  ------------------------------------------------------
  Offline WSOLA-style time stretching for decoded AudioBuffers.

  Design goals:
  - exact output duration for a requested tempo ratio;
  - no cumulative timing drift (every analysis frame is anchored to the
    theoretical source-time position, not the previous correlation winner);
  - one reusable alignment plan can be shared across a multitrack playlist;
  - equal-power overlap crossfades reduce grain-edge coloration;
  - no runtime dependency: this file works with the app's existing Web Audio graph.
*/
(function(){
  "use strict";

  const VERSION="2.1.0";
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)));
  const finiteOr=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;

  function normalizedOptions(sampleRate,options={}){
    const sr=Math.max(8000,finiteOr(sampleRate,48000));
    const sequenceMs=clamp(finiteOr(options.sequenceMs,64),32,120);
    const overlapMs=clamp(finiteOr(options.overlapMs,16),8,Math.min(32,sequenceMs*.44));
    const seekMs=clamp(finiteOr(options.seekMs,6),0,18);
    const sequence=Math.max(256,Math.round(sr*sequenceMs/1000));
    const overlap=Math.max(64,Math.min(sequence-64,Math.round(sr*overlapMs/1000)));
    const synthHop=Math.max(64,sequence-overlap);
    const searchRadius=Math.max(0,Math.round(sr*seekMs/1000));
    const candidateStep=Math.max(2,Math.round(finiteOr(options.candidateStep,sr/6000)));
    const correlationStride=Math.max(2,Math.round(finiteOr(options.correlationStride,sr/7000)));
    return {sampleRate:sr,sequenceMs,overlapMs,seekMs,sequence,overlap,synthHop,searchRadius,candidateStep,correlationStride};
  }

  function correlationScore(channelA,channelB,reference,candidate,length,stride){
    let dot=0,a2=0,b2=0;
    const stereo=!!channelB;
    for(let i=0;i<length;i+=stride){
      const ri=reference+i,ci=candidate+i;
      // A small first-difference component emphasizes attacks while retaining
      // waveform correlation for sustained material. Direct typed-array reads
      // keep this hot loop fast enough for long playlist stems.
      const ra0=(channelA[ri]||0)+(stereo?(channelB[ri]||0):0);
      const ca0=(channelA[ci]||0)+(stereo?(channelB[ci]||0):0);
      const ra1=(channelA[ri-1]||0)+(stereo?(channelB[ri-1]||0):0);
      const ca1=(channelA[ci-1]||0)+(stereo?(channelB[ci-1]||0):0);
      const a=ra0+(ra0-ra1)*.62;
      const b=ca0+(ca0-ca1)*.62;
      dot+=a*b;a2+=a*a;b2+=b*b;
    }
    const energy=Math.sqrt(a2*b2);
    return energy>1e-9?dot/energy:0;
  }

  function createPlan(referenceBuffer,tempoRatio,options={}){
    if(!referenceBuffer?.length||!referenceBuffer?.sampleRate)throw new TypeError("A decoded AudioBuffer-like reference is required.");
    const ratio=clamp(finiteOr(tempoRatio,1),.25,4);
    const cfg=normalizedOptions(referenceBuffer.sampleRate,options);
    const outputLength=Math.max(1,Math.round(referenceBuffer.length/ratio));
    const frameCount=Math.max(1,Math.ceil(Math.max(0,outputLength-cfg.sequence)/cfg.synthHop)+1);
    const sourceStarts=new Int32Array(frameCount);
    sourceStarts[0]=0;
    const maxStart=Math.max(0,referenceBuffer.length-cfg.sequence);
    const analysisHop=cfg.synthHop*ratio;
    const channelA=referenceBuffer.getChannelData(0);
    const channelB=(referenceBuffer.numberOfChannels||1)>1?referenceBuffer.getChannelData(1):null;

    for(let frame=1;frame<frameCount;frame++){
      // Critical anti-drift rule: anchor every frame to its absolute theoretical
      // position. Correlation may move a grain only inside the seek window; it can
      // never accumulate a different clock from another stem.
      const expected=Math.max(0,Math.min(maxStart,Math.round(frame*analysisHop)));
      const previous=sourceStarts[frame-1];
      const reference=Math.max(0,Math.min(referenceBuffer.length-cfg.overlap,previous+cfg.synthHop));
      const minProgress=Math.max(0,Math.round(Math.max(1,analysisHop-cfg.searchRadius*1.15)));
      const minCandidate=Math.max(previous+Math.min(minProgress,Math.max(1,Math.round(analysisHop*.28))),expected-cfg.searchRadius,0);
      const maxCandidate=Math.min(maxStart,expected+cfg.searchRadius);

      let best=expected;
      let bestScore=-Infinity;
      if(cfg.searchRadius>0&&maxCandidate>=minCandidate&&reference+cfg.overlap<=referenceBuffer.length){
        const scoreCandidate=candidate=>{
          let score=correlationScore(channelA,channelB,reference,candidate,cfg.overlap,cfg.correlationStride);
          const normalizedDistance=cfg.searchRadius?Math.abs(candidate-expected)/cfg.searchRadius:0;
          // Keep timing tight. This penalty is deliberately strong enough to stop
          // low-information pads/noise from wandering to arbitrary correlation peaks.
          score-=normalizedDistance*normalizedDistance*.115;
          if(score>bestScore){bestScore=score;best=candidate}
        };
        for(let candidate=minCandidate;candidate<=maxCandidate;candidate+=cfg.candidateStep)scoreCandidate(candidate);
        // Refine around the best coarse hit for better transient alignment without
        // paying dense-correlation cost across the whole seek window.
        const refineStep=Math.max(1,Math.floor(cfg.candidateStep/4));
        const refineMin=Math.max(minCandidate,best-cfg.candidateStep);
        const refineMax=Math.min(maxCandidate,best+cfg.candidateStep);
        for(let candidate=refineMin;candidate<=refineMax;candidate+=refineStep)scoreCandidate(candidate);
      }
      if(!Number.isFinite(bestScore)||bestScore<.015)best=expected;
      sourceStarts[frame]=Math.max(0,Math.min(maxStart,best));
    }

    return Object.freeze({
      version:VERSION,
      ratio,
      inputLength:referenceBuffer.length,
      outputLength,
      sampleRate:referenceBuffer.sampleRate,
      sequence:cfg.sequence,
      overlap:cfg.overlap,
      synthHop:cfg.synthHop,
      searchRadius:cfg.searchRadius,
      sourceStarts
    });
  }

  function copyLinearTail(src,dst,from,ratio){
    for(let i=from;i<dst.length;i++){
      const pos=i*ratio;
      const lo=Math.max(0,Math.min(src.length-1,Math.floor(pos)));
      const hi=Math.min(src.length-1,lo+1);
      const mix=Math.max(0,Math.min(1,pos-lo));
      dst[i]=(src[lo]||0)*(1-mix)+(src[hi]||0)*mix;
    }
  }

  function applyPlan(context,buffer,tempoRatio,plan=null,options={}){
    if(!context?.createBuffer)throw new TypeError("A BaseAudioContext-like object with createBuffer() is required.");
    if(!buffer?.length||!buffer?.sampleRate)throw new TypeError("A decoded AudioBuffer-like input is required.");
    const ratio=clamp(finiteOr(tempoRatio,1),.25,4);
    if(Math.abs(ratio-1)<.0005)return buffer;
    const cfg=plan&&Math.abs(Number(plan.ratio)-ratio)<.0005&&Number(plan.sampleRate)===Number(buffer.sampleRate)
      ?plan
      :createPlan(buffer,ratio,options);
    const channels=Math.max(1,buffer.numberOfChannels||1);
    const outputLength=Math.max(1,Math.round(buffer.length/ratio));
    const output=context.createBuffer(channels,outputLength,buffer.sampleRate);
    const sequence=Math.max(64,Math.min(Number(cfg.sequence)||2048,buffer.length));
    const overlap=Math.max(16,Math.min(Number(cfg.overlap)||512,sequence-1));
    const synthHop=Math.max(1,Number(cfg.synthHop)||sequence-overlap);
    const input=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
    const out=Array.from({length:channels},(_,c)=>output.getChannelData(c));
    const fadeIn=new Float32Array(overlap);
    const fadeOut=new Float32Array(overlap);
    for(let i=0;i<overlap;i++){
      const phase=(i+.5)/overlap*Math.PI*.5;
      const s=Math.sin(phase),co=Math.cos(phase);
      fadeIn[i]=s*s;fadeOut[i]=co*co;
    }

    let writtenUntil=0;
    const frameCount=Math.max(1,Math.ceil(Math.max(0,outputLength-sequence)/synthHop)+1);
    for(let frame=0;frame<frameCount;frame++){
      const outStart=frame*synthHop;
      if(outStart>=outputLength)break;
      const theoretical=Math.round(frame*synthHop*ratio);
      const planned=frame<cfg.sourceStarts.length?Number(cfg.sourceStarts[frame]):theoretical;
      const maxSourceStart=Math.max(0,buffer.length-sequence);
      const sourceStart=Math.max(0,Math.min(maxSourceStart,Number.isFinite(planned)?planned:theoretical));
      const available=Math.min(sequence,buffer.length-sourceStart,outputLength-outStart);
      if(available<=0)break;

      for(let c=0;c<channels;c++){
        const src=input[c],dst=out[c];
        if(frame===0){
          dst.set(src.subarray(sourceStart,sourceStart+available),outStart);
          continue;
        }
        const overlapCount=Math.min(overlap,available,outputLength-outStart);
        for(let i=0;i<overlapCount;i++){
          const fi=overlapCount===overlap?fadeIn[i]:Math.sin(((i+.5)/overlapCount)*Math.PI*.5)**2;
          const fo=1-fi;
          dst[outStart+i]=(dst[outStart+i]||0)*fo+(src[sourceStart+i]||0)*fi;
        }
        const tailStart=overlapCount;
        const tailCount=available-tailStart;
        if(tailCount>0)dst.set(src.subarray(sourceStart+tailStart,sourceStart+tailStart+tailCount),outStart+tailStart);
      }
      writtenUntil=Math.max(writtenUntil,outStart+available);
    }

    if(writtenUntil<outputLength){
      for(let c=0;c<channels;c++)copyLinearTail(input[c],out[c],writtenUntil,ratio);
    }
    return output;
  }

  async function stretchBuffer(context,buffer,tempoRatio,{plan=null,...options}={}){
    // Keep an async interface so callers can yield/render without changing the app's
    // existing tempo pipeline. The DSP itself is deterministic and synchronous.
    return applyPlan(context,buffer,tempoRatio,plan,options);
  }

  function scaleSecondsForTempo(seconds,nativeBpm,targetBpm){
    const value=Number(seconds);
    const native=Math.max(1,finiteOr(nativeBpm,1));
    const target=Math.max(1,finiteOr(targetBpm,native));
    return Number.isFinite(value)?value*(native/target):value;
  }

  window.WIFEY_TEMPO_STRETCH=Object.freeze({VERSION,createPlan,applyPlan,stretchBuffer,scaleSecondsForTempo,normalizedOptions});
})();
