(function(global){
  "use strict";

  const GEN = Object.freeze({
    START_ADDRS_OFFSET:0,
    END_ADDRS_OFFSET:1,
    START_LOOP_ADDRS_OFFSET:2,
    END_LOOP_ADDRS_OFFSET:3,
    START_ADDRS_COARSE_OFFSET:4,
    END_ADDRS_COARSE_OFFSET:12,
    PAN:17,
    ATTACK_VOL_ENV:34,
    HOLD_VOL_ENV:35,
    DECAY_VOL_ENV:36,
    SUSTAIN_VOL_ENV:37,
    RELEASE_VOL_ENV:38,
    INSTRUMENT:41,
    KEY_RANGE:43,
    VEL_RANGE:44,
    START_LOOP_ADDRS_COARSE_OFFSET:45,
    INITIAL_ATTENUATION:48,
    END_LOOP_ADDRS_COARSE_OFFSET:50,
    COARSE_TUNE:51,
    FINE_TUNE:52,
    SAMPLE_ID:53,
    SAMPLE_MODES:54,
    SCALE_TUNING:56,
    OVERRIDING_ROOT_KEY:58
  });

  function readFourCC(view,offset){
    return String.fromCharCode(view.getUint8(offset),view.getUint8(offset+1),view.getUint8(offset+2),view.getUint8(offset+3));
  }

  function readAscii(view,offset,length){
    let out="";
    for(let i=0;i<length;i++){
      const c=view.getUint8(offset+i);
      if(!c) break;
      out+=String.fromCharCode(c);
    }
    return out.trim();
  }

  function signed16(value){return value&0x8000?value-0x10000:value}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
  function timecentsToSeconds(tc,fallback=0){
    tc=Number(tc);
    if(!Number.isFinite(tc)) return fallback;
    if(tc<=-32768) return 0;
    return Math.pow(2,tc/1200);
  }
  function centibelsToGain(cb){
    cb=Math.max(0,Number(cb)||0);
    return Math.pow(10,-cb/200);
  }

  function listChunks(view,start,end){
    const out=[];
    let pos=start;
    while(pos+8<=end){
      const id=readFourCC(view,pos);
      const size=view.getUint32(pos+4,true);
      const dataStart=pos+8;
      const dataEnd=Math.min(end,dataStart+size);
      if(id==="LIST"&&size>=4){
        out.push({id,type:readFourCC(view,dataStart),start:dataStart+4,end:dataEnd,size});
      }else{
        out.push({id,type:null,start:dataStart,end:dataEnd,size});
      }
      pos=dataStart+size+(size&1);
    }
    return out;
  }

  function findChunk(chunks,id,type){
    return chunks.find(chunk=>chunk.id===id&&(type===undefined||chunk.type===type));
  }

  function parseBags(view,chunk){
    const out=[];
    for(let p=chunk.start;p+4<=chunk.end;p+=4) out.push({gen:view.getUint16(p,true),mod:view.getUint16(p+2,true)});
    return out;
  }

  function parseGenerators(view,chunk){
    const out=[];
    for(let p=chunk.start;p+4<=chunk.end;p+=4) out.push({op:view.getUint16(p,true),amount:view.getUint16(p+2,true)});
    return out;
  }

  function parseZones(bags,gens,startBag,endBag){
    const zones=[];
    for(let bagIndex=startBag;bagIndex<endBag;bagIndex++){
      const genStart=bags[bagIndex]?.gen??0;
      const genEnd=bags[bagIndex+1]?.gen??gens.length;
      const map=new Map();
      for(let i=genStart;i<genEnd;i++) map.set(gens[i].op,gens[i].amount);
      zones.push(map);
    }
    return zones;
  }

  function rangeFrom(zone,op){
    if(!zone?.has(op)) return [0,127];
    const amount=zone.get(op);
    return [amount&0xff,(amount>>8)&0xff];
  }

  function matchesRange(zone,key,velocity){
    const [kl,kh]=rangeFrom(zone,GEN.KEY_RANGE);
    const [vl,vh]=rangeFrom(zone,GEN.VEL_RANGE);
    return key>=kl&&key<=kh&&velocity>=vl&&velocity<=vh;
  }

  function getSigned(zone,op,fallback=0){return zone?.has(op)?signed16(zone.get(op)):fallback}
  function getUnsigned(zone,op,fallback=0){return zone?.has(op)?zone.get(op):fallback}

  function sumSigned(op,...zones){
    let value=0;
    for(const zone of zones) if(zone?.has(op)) value+=signed16(zone.get(op));
    return value;
  }

  function sumSignedMaybe(op,...zones){
    let value=0,found=false;
    for(const zone of zones){
      if(zone?.has(op)){
        value+=signed16(zone.get(op));
        found=true;
      }
    }
    return found?value:undefined;
  }

  function timecentsFromZones(op,fallback,...zones){
    const value=sumSignedMaybe(op,...zones);
    return value===undefined?fallback:timecentsToSeconds(value,fallback);
  }

  function lastUnsigned(op,...zones){
    let found;
    for(const zone of zones) if(zone?.has(op)) found=zone.get(op);
    return found;
  }

  class SoundFontBank {
    constructor({buffer,view,smpl,presets,instruments,samples,info}){
      this.buffer=buffer;
      this.view=view;
      this.smpl=smpl;
      this.presets=presets;
      this.instruments=instruments;
      this.samples=samples;
      this.info=info;
      this.presetMap=new Map(presets.map(p=>[`${p.bank}:${p.program}`,p]));
      // Cache tiny leading-silence trims used by rendered MIDI. This is deliberately
      // separate from the SoundFont envelope: we remove only dead PCM before the
      // sample actually begins, never the authored attack/decay of the instrument.
      this.tightOnsetCache=new Map();
    }

    getPreset(bank,program){return this.presetMap.get(`${bank}:${program}`)||null}

    getPresetList(){
      return this.presets.map(({name,bank,program})=>({name,bank,program}));
    }

    resolveLayers(bank,program,midi,velocity=100){
      const preset=this.getPreset(bank,program);
      if(!preset) return [];
      const presetGlobal=preset.zones.find(zone=>!zone.has(GEN.INSTRUMENT))||null;
      const layers=[];

      for(const presetZone of preset.zones){
        if(!presetZone.has(GEN.INSTRUMENT)||!matchesRange(presetZone,midi,velocity)) continue;
        const instrument=this.instruments[presetZone.get(GEN.INSTRUMENT)];
        if(!instrument) continue;
        const instrumentGlobal=instrument.zones.find(zone=>!zone.has(GEN.SAMPLE_ID))||null;

        for(const instrumentZone of instrument.zones){
          if(!instrumentZone.has(GEN.SAMPLE_ID)||!matchesRange(instrumentZone,midi,velocity)) continue;
          const sample=this.samples[instrumentZone.get(GEN.SAMPLE_ID)];
          if(!sample) continue;
          const zones=[presetGlobal,presetZone,instrumentGlobal,instrumentZone];
          const rootRaw=lastUnsigned(GEN.OVERRIDING_ROOT_KEY,...zones);
          const rootKey=rootRaw===undefined||rootRaw===255?sample.originalPitch:rootRaw;
          const scaleTuningRaw=lastUnsigned(GEN.SCALE_TUNING,...zones);
          const scaleTuning=scaleTuningRaw===undefined?100:signed16(scaleTuningRaw);
          const sampleModes=lastUnsigned(GEN.SAMPLE_MODES,...zones)??0;
          const startOffset=sumSigned(GEN.START_ADDRS_OFFSET,...zones)+sumSigned(GEN.START_ADDRS_COARSE_OFFSET,...zones)*32768;
          const endOffset=sumSigned(GEN.END_ADDRS_OFFSET,...zones)+sumSigned(GEN.END_ADDRS_COARSE_OFFSET,...zones)*32768;
          const loopStartOffset=sumSigned(GEN.START_LOOP_ADDRS_OFFSET,...zones)+sumSigned(GEN.START_LOOP_ADDRS_COARSE_OFFSET,...zones)*32768;
          const loopEndOffset=sumSigned(GEN.END_LOOP_ADDRS_OFFSET,...zones)+sumSigned(GEN.END_LOOP_ADDRS_COARSE_OFFSET,...zones)*32768;

          layers.push({
            presetName:preset.name,
            instrumentName:instrument.name,
            sample,
            rootKey,
            scaleTuning,
            coarseTune:sumSigned(GEN.COARSE_TUNE,...zones),
            fineTune:sumSigned(GEN.FINE_TUNE,...zones),
            pan:clamp(sumSigned(GEN.PAN,...zones)/500,-1,1),
            attenuation:Math.max(0,sumSigned(GEN.INITIAL_ATTENUATION,...zones)),
            attack:timecentsFromZones(GEN.ATTACK_VOL_ENV,.003,...zones),
            hold:timecentsFromZones(GEN.HOLD_VOL_ENV,0,...zones),
            decay:timecentsFromZones(GEN.DECAY_VOL_ENV,.12,...zones),
            sustain:centibelsToGain(Math.max(0,sumSignedMaybe(GEN.SUSTAIN_VOL_ENV,...zones)??0)),
            release:timecentsFromZones(GEN.RELEASE_VOL_ENV,.08,...zones),
            sampleModes,
            start:clamp(sample.start+startOffset,sample.start,sample.end-1),
            end:clamp(sample.end+endOffset,sample.start+1,this.smpl.length),
            loopStart:sample.startLoop+loopStartOffset,
            loopEnd:sample.endLoop+loopEndOffset
          });
        }
      }
      return layers;
    }

    renderNote(target,{bank=0,program=0,midi=60,velocity=100,start=0,duration=.5,amp=1,pan=0,tightOnset=false}={}){
      if(!target?.left||!target?.right||!target?.sampleRate) return false;
      midi=clamp(Math.round(midi),0,127);
      velocity=clamp(Math.round(velocity),1,127);
      const layers=this.resolveLayers(bank,program,midi,velocity);
      if(!layers.length) return false;
      for(const layer of layers) this._renderLayer(target,layer,{midi,velocity,start,duration,amp,pan,tightOnset});
      return true;
    }

    _tightOnsetStart(layer){
      const sampleRate=Math.max(1,Number(layer?.sample?.sampleRate)||44100);
      const rawStart=Math.max(0,Math.floor(Number(layer?.start)||0));
      const rawEnd=Math.min(this.smpl.length,Math.floor(Number(layer?.end)||rawStart+1));
      const key=`${rawStart}:${rawEnd}:${sampleRate}`;
      if(this.tightOnsetCache.has(key)) return this.tightOnsetCache.get(key);
      // Only inspect the first 15 ms. A longer fade-in is articulation/envelope,
      // not scheduler latency, and must remain intact.
      const scanEnd=Math.min(rawEnd,rawStart+Math.max(8,Math.ceil(sampleRate*.015)));
      let peak=0;
      for(let i=rawStart;i<scanEnd;i++) peak=Math.max(peak,Math.abs(this.smpl[i]||0));
      const threshold=Math.max(6,peak*.015);
      let onset=rawStart;
      if(peak>threshold){
        for(let i=rawStart;i<scanEnd-2;i++){
          const a=Math.abs(this.smpl[i]||0),b=Math.abs(this.smpl[i+1]||0),c=Math.abs(this.smpl[i+2]||0);
          if(a>=threshold&&(b>=threshold*.55||c>=threshold*.55)){onset=i;break}
        }
      }
      // Keep ~0.35 ms of pre-transient material so the trim cannot shave the
      // leading edge off clicks, picks or drum attacks.
      onset=Math.max(rawStart,onset-Math.ceil(sampleRate*.00035));
      this.tightOnsetCache.set(key,onset);
      return onset;
    }

    _renderLayer(target,layer,{midi,velocity,start,duration,amp,pan,tightOnset=false}){
      const sr=target.sampleRate;
      const outStart=Math.max(0,Math.floor(start*sr));
      if(outStart>=target.left.length) return;

      const sample=layer.sample;
      const keyDelta=(midi-layer.rootKey)*(layer.scaleTuning/100);
      const cents=keyDelta*100+layer.coarseTune*100+layer.fineTune-sample.pitchCorrection;
      const rateRatio=Math.pow(2,cents/1200)*(sample.sampleRate/sr);
      if(!Number.isFinite(rateRatio)||rateRatio<=0) return;

      const looped=(layer.sampleModes&1)!==0&&layer.loopEnd-layer.loopStart>8;
      const attack=clamp(layer.attack,0,2);
      const hold=clamp(layer.hold,0,2);
      const decay=clamp(layer.decay,0,16);
      const sustain=clamp(layer.sustain,0,1);
      const release=clamp(layer.release,.015,6);
      const noteDuration=Math.max(.015,Number(duration)||.15);
      const naturalSeconds=Math.max(.01,(layer.end-(tightOnset?this._tightOnsetStart(layer):layer.start))/sample.sampleRate/Math.max(.0001,Math.pow(2,cents/1200)));
      const renderSeconds=looped?noteDuration+release+0.02:Math.min(naturalSeconds+0.02,Math.max(naturalSeconds,noteDuration+release));
      const maxOut=Math.min(target.left.length,outStart+Math.ceil(renderSeconds*sr));
      const velocityGain=Math.pow(velocity/127,1.35);
      const layerGain=(Number(amp)||0)*velocityGain*centibelsToGain(layer.attenuation);
      const combinedPan=clamp(layer.pan+(Number(pan)||0),-1,1);
      const leftPan=Math.sqrt((1-combinedPan)*.5);
      const rightPan=Math.sqrt((1+combinedPan)*.5);

      const sourceStart=tightOnset?this._tightOnsetStart(layer):layer.start;
      let srcPos=sourceStart;
      const sampleEnd=Math.min(layer.end,this.smpl.length-1);
      const loopStart=clamp(layer.loopStart,sourceStart,sampleEnd-2);
      const loopEnd=clamp(layer.loopEnd,loopStart+2,sampleEnd);

      for(let outIndex=outStart;outIndex<maxOut;outIndex++){
        const t=(outIndex-outStart)/sr;
        if(!looped&&srcPos>=sampleEnd-1) break;
        if(looped&&srcPos>=loopEnd){
          const span=loopEnd-loopStart;
          srcPos=loopStart+((srcPos-loopStart)%span+span)%span;
        }

        const i0=Math.max(0,Math.min(this.smpl.length-2,Math.floor(srcPos)));
        const frac=srcPos-i0;
        const s0=this.smpl[i0]/32768;
        const s1=this.smpl[i0+1]/32768;
        const sampleValue=s0+(s1-s0)*frac;

        let env=1;
        if(attack>0&&t<attack) env=t/attack;
        else if(t<attack+hold) env=1;
        else if(decay>0&&t<attack+hold+decay){
          const x=(t-attack-hold)/decay;
          env=sustain+(1-sustain)*Math.pow(1-x,1.7);
        }else env=sustain;

        if(looped&&t>noteDuration){
          const r=(t-noteDuration)/release;
          if(r>=1) break;
          env*=Math.pow(1-r,1.35);
        }

        const value=sampleValue*env*layerGain;
        target.left[outIndex]+=value*leftPan;
        target.right[outIndex]+=value*rightPan;
        srcPos+=rateRatio;
      }
    }
  }

  function parse(arrayBuffer){
    if(!(arrayBuffer instanceof ArrayBuffer)) throw new TypeError("SF2 parser expects an ArrayBuffer");
    const view=new DataView(arrayBuffer);
    if(view.byteLength<12||readFourCC(view,0)!=="RIFF"||readFourCC(view,8)!=="sfbk") throw new Error("Not a SoundFont2 RIFF bank");

    const top=listChunks(view,12,view.byteLength);
    const infoList=findChunk(top,"LIST","INFO");
    const sdtaList=findChunk(top,"LIST","sdta");
    const pdtaList=findChunk(top,"LIST","pdta");
    if(!sdtaList||!pdtaList) throw new Error("Incomplete SoundFont: missing sdta/pdta");

    const info={};
    if(infoList){
      for(const chunk of listChunks(view,infoList.start,infoList.end)){
        if(chunk.id==="ifil"&&chunk.size>=4) info.version=`${view.getUint16(chunk.start,true)}.${view.getUint16(chunk.start+2,true)}`;
        else info[chunk.id]=readAscii(view,chunk.start,Math.max(0,chunk.end-chunk.start));
      }
    }

    const sdta=listChunks(view,sdtaList.start,sdtaList.end);
    const smplChunk=findChunk(sdta,"smpl");
    if(!smplChunk) throw new Error("SoundFont has no PCM sample pool");
    const smpl=new Int16Array(arrayBuffer,smplChunk.start,Math.floor((smplChunk.end-smplChunk.start)/2));

    const pdta=listChunks(view,pdtaList.start,pdtaList.end);
    const phdr=findChunk(pdta,"phdr"),pbagChunk=findChunk(pdta,"pbag"),pgenChunk=findChunk(pdta,"pgen"),instChunk=findChunk(pdta,"inst"),ibagChunk=findChunk(pdta,"ibag"),igenChunk=findChunk(pdta,"igen"),shdr=findChunk(pdta,"shdr");
    if(!phdr||!pbagChunk||!pgenChunk||!instChunk||!ibagChunk||!igenChunk||!shdr) throw new Error("SoundFont pdta tables are incomplete");

    const pbag=parseBags(view,pbagChunk),pgen=parseGenerators(view,pgenChunk),ibag=parseBags(view,ibagChunk),igen=parseGenerators(view,igenChunk);

    const presetHeaders=[];
    for(let p=phdr.start;p+38<=phdr.end;p+=38){
      presetHeaders.push({name:readAscii(view,p,20),program:view.getUint16(p+20,true),bank:view.getUint16(p+22,true),bag:view.getUint16(p+24,true)});
    }

    const instrumentHeaders=[];
    for(let p=instChunk.start;p+22<=instChunk.end;p+=22) instrumentHeaders.push({name:readAscii(view,p,20),bag:view.getUint16(p+20,true)});

    const samples=[];
    for(let p=shdr.start;p+46<=shdr.end;p+=46){
      samples.push({
        name:readAscii(view,p,20),
        start:view.getUint32(p+20,true),
        end:view.getUint32(p+24,true),
        startLoop:view.getUint32(p+28,true),
        endLoop:view.getUint32(p+32,true),
        sampleRate:view.getUint32(p+36,true),
        originalPitch:view.getUint8(p+40),
        pitchCorrection:view.getInt8(p+41),
        sampleLink:view.getUint16(p+42,true),
        sampleType:view.getUint16(p+44,true)
      });
    }
    if(samples.at(-1)?.name==="EOS") samples.pop();

    const instruments=[];
    for(let i=0;i<instrumentHeaders.length-1;i++){
      const head=instrumentHeaders[i],next=instrumentHeaders[i+1];
      instruments.push({name:head.name,zones:parseZones(ibag,igen,head.bag,next.bag)});
    }

    const presets=[];
    for(let i=0;i<presetHeaders.length-1;i++){
      const head=presetHeaders[i],next=presetHeaders[i+1];
      presets.push({name:head.name,program:head.program,bank:head.bank,zones:parseZones(pbag,pgen,head.bag,next.bag)});
    }

    return new SoundFontBank({buffer:arrayBuffer,view,smpl,presets,instruments,samples,info});
  }

  async function load(url,{cache="force-cache"}={}){
    const response=await fetch(url,{cache});
    if(!response.ok) throw new Error(`Could not load SoundFont (${response.status})`);
    return parse(await response.arrayBuffer());
  }

  global.WifeySF2=Object.freeze({parse,load,SoundFontBank,GEN,timecentsToSeconds,centibelsToGain});
})(globalThis);
