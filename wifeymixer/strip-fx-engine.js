(function(){
  "use strict";

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)));
  const dbToGain=db=>Math.pow(10,Number(db||0)/20);
  const deepCopy=value=>JSON.parse(JSON.stringify(value));

  const DEFINITIONS=Object.freeze({
    cmp:Object.freeze({
      label:"CMP",name:"COMPRESSOR",defaultMode:"wet",defaultMix:100,
      params:Object.freeze({
        threshold:{label:"THRESH",min:-60,max:0,step:1,default:-18,unit:"dB"},
        ratio:{label:"RATIO",min:1,max:20,step:.5,default:3.5,unit:":1"},
        attack:{label:"ATTACK",min:0,max:200,step:1,default:10,unit:"ms"},
        release:{label:"RELEASE",min:20,max:1000,step:5,default:180,unit:"ms"},
        knee:{label:"KNEE",min:0,max:40,step:1,default:18,unit:"dB"},
        makeup:{label:"MAKEUP",min:-6,max:12,step:.5,default:1.5,unit:"dB"}
      })
    }),
    del:Object.freeze({
      label:"DEL",name:"DELAY",defaultMode:"send",defaultMix:20,
      params:Object.freeze({
        time:{label:"TIME",min:25,max:1000,step:5,default:320,unit:"ms"},
        feedback:{label:"FDBK",min:0,max:85,step:1,default:32,unit:"%"},
        tone:{label:"TONE",min:900,max:12000,step:100,default:5200,unit:"Hz"}
      })
    }),
    chrs:Object.freeze({
      label:"CHRS",name:"CHORUS",defaultMode:"wet",defaultMix:26,
      params:Object.freeze({
        rate:{label:"RATE",min:.05,max:6,step:.05,default:.8,unit:"Hz"},
        delay:{label:"DELAY",min:2,max:20,step:.5,default:8,unit:"ms"},
        depth:{label:"DEPTH",min:.2,max:12,step:.2,default:4.8,unit:"ms"},
        spread:{label:"SPREAD",min:0,max:100,step:1,default:72,unit:"%"}
      })
    }),
    phs:Object.freeze({
      label:"PHS",name:"PHASER",defaultMode:"wet",defaultMix:24,
      params:Object.freeze({
        rate:{label:"RATE",min:.03,max:4,step:.03,default:.32,unit:"Hz"},
        center:{label:"CENTER",min:160,max:3200,step:20,default:900,unit:"Hz"},
        depth:{label:"DEPTH",min:0,max:100,step:1,default:68,unit:"%"},
        q:{label:"Q",min:.15,max:4,step:.05,default:.75,unit:""}
      })
    }),
    flng:Object.freeze({
      label:"FLNG",name:"FLANGER",defaultMode:"wet",defaultMix:20,
      params:Object.freeze({
        rate:{label:"RATE",min:.03,max:3,step:.03,default:.22,unit:"Hz"},
        delay:{label:"DELAY",min:.3,max:12,step:.1,default:2.4,unit:"ms"},
        depth:{label:"DEPTH",min:.1,max:7,step:.1,default:1.7,unit:"ms"},
        feedback:{label:"FDBK",min:-75,max:75,step:1,default:24,unit:"%"}
      })
    }),
    trem:Object.freeze({
      label:"TREM",name:"TREMOLO",defaultMode:"wet",defaultMix:28,
      params:Object.freeze({
        rate:{label:"RATE",min:.1,max:14,step:.1,default:4.2,unit:"Hz"},
        depth:{label:"DEPTH",min:0,max:100,step:1,default:44,unit:"%"}
      })
    }),
    vib:Object.freeze({
      label:"VIB",name:"VIBRATO",defaultMode:"wet",defaultMix:30,
      params:Object.freeze({
        rate:{label:"RATE",min:.1,max:12,step:.1,default:5.1,unit:"Hz"},
        delay:{label:"DELAY",min:2,max:16,step:.2,default:6,unit:"ms"},
        depth:{label:"DEPTH",min:.1,max:7,step:.1,default:2.4,unit:"ms"}
      })
    })
  });
  const ORDER=Object.freeze(Object.keys(DEFINITIONS));
  const WORKLET_READY=new WeakSet();
  const WORKLET_FAILED=new WeakSet();
  const WORKLET_PROMISES=new WeakMap();

  async function prepareContext(ctx){
    if(!ctx||WORKLET_READY.has(ctx))return true;
    if(WORKLET_FAILED.has(ctx)||!ctx.audioWorklet?.addModule)return false;
    if(WORKLET_PROMISES.has(ctx))return WORKLET_PROMISES.get(ctx);
    const promise=ctx.audioWorklet.addModule("strip-fx-compressor-worklet.js")
      .then(()=>{WORKLET_READY.add(ctx);return true})
      .catch(error=>{WORKLET_FAILED.add(ctx);console.warn("Zero-lookahead strip compressor unavailable; using native compressor fallback.",error);return false})
      .finally(()=>WORKLET_PROMISES.delete(ctx));
    WORKLET_PROMISES.set(ctx,promise);
    return promise;
  }

  function defaultSlotState(key){
    const def=DEFINITIONS[key];
    return {
      enabled:false,
      mode:def.defaultMode,
      mix:def.defaultMix,
      params:Object.fromEntries(Object.entries(def.params).map(([name,param])=>[name,param.default]))
    };
  }

  function defaultState(){
    return Object.fromEntries(ORDER.map(key=>[key,defaultSlotState(key)]));
  }

  function normalizeState(raw){
    const source=raw&&typeof raw==="object"?raw:{};
    const result={};
    for(const key of ORDER){
      const def=DEFINITIONS[key],incoming=source[key]&&typeof source[key]==="object"?source[key]:{};
      const slot=defaultSlotState(key);
      slot.enabled=!!incoming.enabled;
      slot.mode=incoming.mode==="send"?"send":"wet";
      slot.mix=clamp(Number.isFinite(Number(incoming.mix))?incoming.mix:def.defaultMix,0,100);
      for(const [paramName,paramDef] of Object.entries(def.params)){
        const candidate=Number(incoming.params?.[paramName]);
        slot.params[paramName]=clamp(Number.isFinite(candidate)?candidate:paramDef.default,paramDef.min,paramDef.max);
      }
      result[key]=slot;
    }
    return result;
  }

  function smooth(param,value,time=.018){
    if(!param)return;
    const ctx=param.context||null;
    const now=ctx?.currentTime;
    try{
      if(Number.isFinite(now)){
        param.cancelScheduledValues(now);
        param.setTargetAtTime(Number(value),now,time);
      }else param.value=Number(value);
    }catch(_){try{param.value=Number(value)}catch(__){}}
  }

  function startOscillator(ctx,frequency,type="sine"){
    const osc=ctx.createOscillator();
    osc.type=type;
    osc.frequency.value=frequency;
    osc.start();
    return osc;
  }

  function disconnectAll(nodes){
    for(const node of nodes||[]){
      try{node?.disconnect?.()}catch(_){}
      try{if(typeof node?.stop==="function")node.stop()}catch(_){}
    }
  }

  function createCompressor(ctx){
    const input=ctx.createGain(),output=ctx.createGain();
    if(WORKLET_READY.has(ctx)&&typeof AudioWorkletNode!=="undefined"){
      const worklet=new AudioWorkletNode(ctx,"wifey-zero-lookahead-compressor",{
        numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],
        parameterData:{threshold:-18,ratio:3.5,attack:.010,release:.180,knee:18,makeup:1.5}
      });
      input.connect(worklet);worklet.connect(output);
      return {
        input,output,nodes:[input,worklet,output],zeroLookahead:true,
        update(params){
          const set=(name,value)=>{const param=worklet.parameters.get(name);if(param)param.value=value};
          set("threshold",params.threshold);set("ratio",params.ratio);set("attack",params.attack/1000);set("release",params.release/1000);set("knee",params.knee);set("makeup",params.makeup);
        },
        destroy(){disconnectAll([input,worklet,output])}
      };
    }
    // Compatibility fallback. The Web Audio specification defines a fixed
    // 6 ms look-ahead for DynamicsCompressorNode, so this path is only used
    // when AudioWorklet cannot be loaded (for example, an insecure context).
    const comp=ctx.createDynamicsCompressor(),makeup=ctx.createGain();
    input.connect(comp);comp.connect(makeup);makeup.connect(output);
    return {
      input,output,nodes:[input,comp,makeup,output],zeroLookahead:false,
      update(params){
        smooth(comp.threshold,params.threshold);smooth(comp.knee,params.knee);smooth(comp.ratio,params.ratio);
        smooth(comp.attack,params.attack/1000);smooth(comp.release,params.release/1000);smooth(makeup.gain,dbToGain(params.makeup));
      },
      destroy(){disconnectAll([input,comp,makeup,output])}
    };
  }

  function createDelay(ctx){
    const input=ctx.createGain(),delay=ctx.createDelay(2.2),tone=ctx.createBiquadFilter(),feedback=ctx.createGain(),output=ctx.createGain();
    tone.type="lowpass"; tone.Q.value=.48;
    input.connect(delay);delay.connect(tone);tone.connect(output);tone.connect(feedback);feedback.connect(delay);
    return {
      input,output,nodes:[input,delay,tone,feedback,output],
      update(params){smooth(delay.delayTime,params.time/1000);smooth(feedback.gain,params.feedback/100);smooth(tone.frequency,params.tone,.03)},
      destroy(){disconnectAll([input,delay,tone,feedback,output])}
    };
  }

  function createChorus(ctx){
    const input=ctx.createGain(),output=ctx.createGain();
    const delayL=ctx.createDelay(.06),delayR=ctx.createDelay(.06);
    const panL=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();
    const panR=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();
    if(panL.pan)panL.pan.value=-.72;if(panR.pan)panR.pan.value=.72;
    const levelL=ctx.createGain(),levelR=ctx.createGain();levelL.gain.value=.52;levelR.gain.value=.52;
    const lfoL=startOscillator(ctx,.8),lfoR=startOscillator(ctx,.91);
    const depthL=ctx.createGain(),depthR=ctx.createGain();
    input.connect(delayL);input.connect(delayR);
    delayL.connect(panL);panL.connect(levelL);levelL.connect(output);
    delayR.connect(panR);panR.connect(levelR);levelR.connect(output);
    lfoL.connect(depthL);depthL.connect(delayL.delayTime);
    lfoR.connect(depthR);depthR.connect(delayR.delayTime);
    return {
      input,output,nodes:[input,delayL,delayR,panL,panR,levelL,levelR,lfoL,lfoR,depthL,depthR,output],
      update(params){
        const base=params.delay/1000,depth=Math.min(base*.94,params.depth/1000),spread=params.spread/100;
        smooth(delayL.delayTime,base);smooth(delayR.delayTime,base*1.07);
        smooth(depthL.gain,depth*(.82+.18*spread));smooth(depthR.gain,depth*(.66+.34*spread));
        smooth(lfoL.frequency,params.rate);smooth(lfoR.frequency,params.rate*(1.035+.045*spread));
        if(panL.pan)smooth(panL.pan,-(.18+.78*spread));if(panR.pan)smooth(panR.pan,.18+.78*spread);
      },
      destroy(){disconnectAll([lfoL,lfoR,input,delayL,delayR,panL,panR,levelL,levelR,depthL,depthR,output])}
    };
  }

  function createPhaser(ctx){
    const input=ctx.createGain(),output=ctx.createGain();
    const filters=Array.from({length:4},()=>ctx.createBiquadFilter());
    const scales=[.56,.82,1.18,1.68];
    filters.forEach(filter=>{filter.type="allpass";filter.Q.value=.75});
    input.connect(filters[0]);for(let i=0;i<filters.length-1;i++)filters[i].connect(filters[i+1]);filters.at(-1).connect(output);
    const lfo=startOscillator(ctx,.32),mods=filters.map(()=>ctx.createGain());
    mods.forEach((mod,index)=>{lfo.connect(mod);mod.connect(filters[index].frequency)});
    return {
      input,output,nodes:[input,...filters,lfo,...mods,output],
      update(params){
        const depth=params.depth/100;
        filters.forEach((filter,index)=>{const base=params.center*scales[index];smooth(filter.frequency,base,.03);smooth(filter.Q,params.q,.03);smooth(mods[index].gain,Math.min(base*.82,params.center*.78*depth),.03)});
        smooth(lfo.frequency,params.rate,.03);
      },
      destroy(){disconnectAll([lfo,input,...filters,...mods,output])}
    };
  }

  function createFlanger(ctx){
    const input=ctx.createGain(),delay=ctx.createDelay(.04),feedback=ctx.createGain(),output=ctx.createGain();
    const lfo=startOscillator(ctx,.22),depth=ctx.createGain();
    input.connect(delay);delay.connect(output);delay.connect(feedback);feedback.connect(delay);lfo.connect(depth);depth.connect(delay.delayTime);
    return {
      input,output,nodes:[input,delay,feedback,lfo,depth,output],
      update(params){
        const base=params.delay/1000,mod=Math.min(base*.92,params.depth/1000);
        smooth(delay.delayTime,base);smooth(depth.gain,mod);smooth(feedback.gain,params.feedback/100);smooth(lfo.frequency,params.rate);
      },
      destroy(){disconnectAll([lfo,input,delay,feedback,depth,output])}
    };
  }

  function createTremolo(ctx){
    const input=ctx.createGain(),amp=ctx.createGain(),output=ctx.createGain(),lfo=startOscillator(ctx,4.2),depth=ctx.createGain();
    input.connect(amp);amp.connect(output);lfo.connect(depth);depth.connect(amp.gain);
    return {
      input,output,nodes:[input,amp,lfo,depth,output],
      update(params){const d=params.depth/100;smooth(amp.gain,1-d*.5);smooth(depth.gain,d*.5);smooth(lfo.frequency,params.rate)},
      destroy(){disconnectAll([lfo,input,amp,depth,output])}
    };
  }

  function createVibrato(ctx){
    const input=ctx.createGain(),delay=ctx.createDelay(.05),output=ctx.createGain(),lfo=startOscillator(ctx,5.1),depth=ctx.createGain();
    input.connect(delay);delay.connect(output);lfo.connect(depth);depth.connect(delay.delayTime);
    return {
      input,output,nodes:[input,delay,lfo,depth,output],
      update(params){const base=params.delay/1000,mod=Math.min(base*.92,params.depth/1000);smooth(delay.delayTime,base);smooth(depth.gain,mod);smooth(lfo.frequency,params.rate)},
      destroy(){disconnectAll([lfo,input,delay,depth,output])}
    };
  }

  const FACTORIES={cmp:createCompressor,del:createDelay,chrs:createChorus,phs:createPhaser,flng:createFlanger,trem:createTremolo,vib:createVibrato};

  function createSlot(ctx,key){
    const input=ctx.createGain(),dry=ctx.createGain(),wet=ctx.createGain(),output=ctx.createGain();
    input.connect(dry);dry.connect(output);wet.connect(output);
    return {ctx,key,input,dry,wet,output,processor:null};
  }

  function ensureProcessor(slot){
    if(slot.processor)return slot.processor;
    const processor=FACTORIES[slot.key](slot.ctx);
    slot.input.connect(processor.input);processor.output.connect(slot.wet);slot.processor=processor;
    return processor;
  }

  function destroyProcessor(slot){
    if(!slot?.processor)return;
    try{slot.input.disconnect(slot.processor.input)}catch(_){}
    try{slot.processor.output.disconnect(slot.wet)}catch(_){}
    try{slot.processor.destroy?.()}catch(_){}
    slot.processor=null;
  }

  function applySlotState(slot,state){
    const clean=normalizeState({[slot.key]:state})[slot.key];
    if(clean.enabled){
      const processor=ensureProcessor(slot);processor.update(clean.params);
      const x=clean.mix/100;
      if(clean.mode==="send"){
        smooth(slot.dry.gain,1);smooth(slot.wet.gain,x);
      }else{
        smooth(slot.dry.gain,Math.cos(x*Math.PI*.5));smooth(slot.wet.gain,Math.sin(x*Math.PI*.5));
      }
    }else{
      smooth(slot.dry.gain,1);smooth(slot.wet.gain,0);
      destroyProcessor(slot);
    }
  }

  function createRack(ctx,rawState){
    const state=normalizeState(rawState),input=ctx.createGain(),output=ctx.createGain();
    const slots=ORDER.map(key=>createSlot(ctx,key));
    input.connect(slots[0].input);
    for(let i=0;i<slots.length-1;i++)slots[i].output.connect(slots[i+1].input);
    slots.at(-1).output.connect(output);
    const rack={ctx,input,output,slots,state};
    applyRackState(rack,state);
    return rack;
  }

  function applyRackState(rack,rawState){
    if(!rack)return;
    const state=normalizeState(rawState);rack.state=state;
    rack.slots.forEach(slot=>applySlotState(slot,state[slot.key]));
  }

  function destroyRack(rack){
    if(!rack)return;
    for(const slot of rack.slots||[]){
      destroyProcessor(slot);disconnectAll([slot.input,slot.dry,slot.wet,slot.output]);
    }
    disconnectAll([rack.input,rack.output]);
  }

  function hasEnabled(rawState){
    const state=normalizeState(rawState);return ORDER.some(key=>state[key].enabled);
  }

  function formatParam(key,paramName,value){
    const def=DEFINITIONS[key]?.params?.[paramName];if(!def)return String(value);
    const n=Number(value);let text;
    if(def.step<1)text=Math.abs(n)>=10?n.toFixed(1):n.toFixed(2);else text=String(Math.round(n));
    text=text.replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');
    if(def.unit===":1")return `${text}:1`;
    return def.unit?`${text} ${def.unit}`:text;
  }

  window.WIFEY_STRIP_FX=Object.freeze({DEFINITIONS,ORDER,prepareContext,defaultState,normalizeState,createRack,applyRackState,destroyRack,hasEnabled,formatParam,deepCopy});
})();
