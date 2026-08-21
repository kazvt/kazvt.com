(function(global){
  "use strict";

  const DEFAULT_TEMPO_US = 500000;
  const MAX_MIDI_DURATION_SECONDS = 60 * 60;
  const RENDER_TAIL_SECONDS = 0.45;

  function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
  function readAscii(view,offset,length){
    let out="";
    for(let i=0;i<length;i++) out += String.fromCharCode(view.getUint8(offset+i));
    return out;
  }
  function readVarLen(view,state,end){
    let value=0;
    for(let i=0;i<4;i++){
      if(state.pos>=end) throw new Error("Unexpected end of MIDI variable-length value");
      const byte=view.getUint8(state.pos++);
      value=(value<<7)|(byte&0x7f);
      if(!(byte&0x80)) return value>>>0;
    }
    return value>>>0;
  }
  function bytesToText(bytes){
    try { return new TextDecoder("utf-8",{fatal:false}).decode(bytes).replace(/\0/g,"").trim(); }
    catch(_){ return Array.from(bytes,b=>String.fromCharCode(b)).join("").replace(/\0/g,"").trim(); }
  }

  function parse(arrayBuffer){
    const view=new DataView(arrayBuffer);
    if(view.byteLength<14 || readAscii(view,0,4)!=="MThd") throw new Error("Not a Standard MIDI file");
    const headerLength=view.getUint32(4,false);
    if(headerLength<6 || 8+headerLength>view.byteLength) throw new Error("Invalid MIDI header");
    const format=view.getUint16(8,false);
    const trackCount=view.getUint16(10,false);
    const divisionRaw=view.getUint16(12,false);
    const division = divisionRaw & 0x8000
      ? {type:"smpte",fps:-(divisionRaw>>8 & 0xff),ticksPerFrame:divisionRaw&0xff}
      : {type:"ppqn",ticksPerQuarter:divisionRaw};
    if(division.type==="ppqn" && !division.ticksPerQuarter) throw new Error("MIDI file has invalid PPQN division");
    if(division.type==="smpte" && (!division.fps || !division.ticksPerFrame)) throw new Error("MIDI file has invalid SMPTE division");

    let pos=8+headerLength;
    const events=[];
    const tempos=[{tick:0,usPerQuarter:DEFAULT_TEMPO_US,order:-1}];
    const trackNames=[];
    let globalOrder=0;
    let maxTick=0;

    for(let trackIndex=0;trackIndex<trackCount;trackIndex++){
      while(pos+8<=view.byteLength && readAscii(view,pos,4)!=="MTrk"){
        const skipLen=view.getUint32(pos+4,false);
        pos+=8+skipLen;
      }
      if(pos+8>view.byteLength) break;
      const trackLength=view.getUint32(pos+4,false);
      const start=pos+8;
      const end=Math.min(view.byteLength,start+trackLength);
      pos=end;

      const state={pos:start};
      let tick=0;
      let runningStatus=0;
      while(state.pos<end){
        tick+=readVarLen(view,state,end);
        maxTick=Math.max(maxTick,tick);
        if(state.pos>=end) break;

        let status=view.getUint8(state.pos++);
        let firstData=null;
        if(status<0x80){
          if(!runningStatus) throw new Error("MIDI running status used before a channel status byte");
          firstData=status;
          status=runningStatus;
        }else if(status<0xf0){
          runningStatus=status;
        }else{
          runningStatus=0;
        }

        if(status===0xff){
          if(state.pos>=end) break;
          const metaType=view.getUint8(state.pos++);
          const length=readVarLen(view,state,end);
          const dataStart=state.pos;
          const dataEnd=Math.min(end,dataStart+length);
          if(metaType===0x51 && dataEnd-dataStart>=3){
            const us=(view.getUint8(dataStart)<<16)|(view.getUint8(dataStart+1)<<8)|view.getUint8(dataStart+2);
            if(us>0) tempos.push({tick,usPerQuarter:us,order:globalOrder++});
          }else if((metaType===0x03 || metaType===0x04) && dataEnd>dataStart){
            const name=bytesToText(new Uint8Array(arrayBuffer,dataStart,dataEnd-dataStart));
            if(name && !trackNames[trackIndex]) trackNames[trackIndex]=name;
          }
          state.pos=dataEnd;
          if(metaType===0x2f) break;
          continue;
        }

        if(status===0xf0 || status===0xf7){
          const length=readVarLen(view,state,end);
          state.pos=Math.min(end,state.pos+length);
          continue;
        }
        if(status>=0xf0){
          const systemDataLength=status===0xf2?2:(status===0xf1 || status===0xf3?1:0);
          state.pos=Math.min(end,state.pos+systemDataLength);
          continue;
        }

        const type=status&0xf0;
        const channel=status&0x0f;
        const dataLength=(type===0xc0 || type===0xd0)?1:2;
        const data1=firstData!==null?firstData:(state.pos<end?view.getUint8(state.pos++):0);
        let data2=0;
        if(dataLength===2) data2=state.pos<end?view.getUint8(state.pos++):0;

        if(type===0x80 || type===0x90 || type===0xb0 || type===0xc0 || type===0xe0){
          events.push({tick,trackIndex,order:globalOrder++,type,channel,data1,data2});
        }
      }
    }

    tempos.sort((a,b)=>a.tick-b.tick || a.order-b.order);
    const tempoMap=[];
    let lastTick=0;
    let lastSeconds=0;
    let usPerQuarter=DEFAULT_TEMPO_US;
    for(const tempo of tempos){
      if(division.type!=="ppqn") break;
      if(tempo.tick<lastTick) continue;
      if(tempo.tick>lastTick){
        lastSeconds+=(tempo.tick-lastTick)*usPerQuarter/1000000/division.ticksPerQuarter;
        lastTick=tempo.tick;
      }
      usPerQuarter=tempo.usPerQuarter;
      const previous=tempoMap[tempoMap.length-1];
      if(previous && previous.tick===tempo.tick) tempoMap[tempoMap.length-1]={tick:tempo.tick,seconds:lastSeconds,usPerQuarter};
      else tempoMap.push({tick:tempo.tick,seconds:lastSeconds,usPerQuarter});
    }
    if(!tempoMap.length) tempoMap.push({tick:0,seconds:0,usPerQuarter:DEFAULT_TEMPO_US});

    function tickToSeconds(tick){
      if(division.type==="smpte") return tick/(division.fps*division.ticksPerFrame);
      let lo=0,hi=tempoMap.length-1,best=tempoMap[0];
      while(lo<=hi){
        const mid=(lo+hi)>>1;
        if(tempoMap[mid].tick<=tick){ best=tempoMap[mid]; lo=mid+1; }
        else hi=mid-1;
      }
      return best.seconds+(tick-best.tick)*best.usPerQuarter/1000000/division.ticksPerQuarter;
    }

    events.sort((a,b)=>a.tick-b.tick || a.order-b.order);
    const channelState=new Map();
    const active=new Map();
    const sustained=new Map();
    const notes=[];

    function stateKey(trackIndex,channel){ return `${trackIndex}:${channel}`; }
    function getChannelState(trackIndex,channel){
      const key=stateKey(trackIndex,channel);
      if(!channelState.has(key)) channelState.set(key,{program:0,volume:100,expression:127,pan:64,sustain:false,pitchBend:8192});
      return channelState.get(key);
    }
    function noteKey(trackIndex,channel,note){ return `${trackIndex}:${channel}:${note}`; }
    function finishEntry(entry,endTick){
      if(!entry) return;
      const startSeconds=tickToSeconds(entry.tick);
      const endSeconds=Math.max(startSeconds+0.01,tickToSeconds(Math.max(entry.tick+1,endTick)));
      notes.push({
        start:startSeconds,
        duration:endSeconds-startSeconds,
        midi:entry.note,
        velocity:entry.velocity,
        channel:entry.channel,
        program:entry.program,
        volume:entry.volume,
        expression:entry.expression,
        pan:entry.pan,
        pitchBend:entry.pitchBend,
        trackIndex:entry.trackIndex
      });
    }
    function releaseSustained(trackIndex,channel,endTick){
      const prefix=`${trackIndex}:${channel}:`;
      for(const [key,list] of [...sustained.entries()]){
        if(!key.startsWith(prefix)) continue;
        for(const entry of list) finishEntry(entry,endTick);
        sustained.delete(key);
      }
    }

    for(const event of events){
      const state=getChannelState(event.trackIndex,event.channel);
      if(event.type===0xc0){ state.program=event.data1&0x7f; continue; }
      if(event.type===0xb0){
        const controller=event.data1&0x7f,value=event.data2&0x7f;
        if(controller===7) state.volume=value;
        else if(controller===10) state.pan=value;
        else if(controller===11) state.expression=value;
        else if(controller===64){
          const next=value>=64;
          if(state.sustain && !next) releaseSustained(event.trackIndex,event.channel,event.tick);
          state.sustain=next;
        }else if(controller===120 || controller===123){
          const prefix=`${event.trackIndex}:${event.channel}:`;
          for(const [key,list] of [...active.entries()]){
            if(!key.startsWith(prefix)) continue;
            for(const entry of list) finishEntry(entry,event.tick);
            active.delete(key);
          }
          releaseSustained(event.trackIndex,event.channel,event.tick);
        }
        continue;
      }
      if(event.type===0xe0){ state.pitchBend=((event.data2&0x7f)<<7)|(event.data1&0x7f); continue; }

      const note=event.data1&0x7f;
      const velocity=event.data2&0x7f;
      const isNoteOn=event.type===0x90 && velocity>0;
      const isNoteOff=event.type===0x80 || (event.type===0x90 && velocity===0);
      if(!isNoteOn && !isNoteOff) continue;
      const key=noteKey(event.trackIndex,event.channel,note);

      if(isNoteOn){
        const list=active.get(key)||[];
        list.push({
          tick:event.tick,note,velocity,channel:event.channel,trackIndex:event.trackIndex,
          program:state.program,volume:state.volume,expression:state.expression,pan:state.pan,pitchBend:state.pitchBend
        });
        active.set(key,list);
      }else{
        const list=active.get(key);
        if(!list?.length) continue;
        const entry=list.shift();
        if(!list.length) active.delete(key);
        if(state.sustain){
          const held=sustained.get(key)||[];
          held.push(entry);
          sustained.set(key,held);
        }else finishEntry(entry,event.tick);
      }
    }

    const finalTick=maxTick+Math.max(1,division.type==="ppqn"?Math.floor(division.ticksPerQuarter/8):1);
    for(const list of active.values()) for(const entry of list) finishEntry(entry,finalTick);
    for(const list of sustained.values()) for(const entry of list) finishEntry(entry,finalTick);

    notes.sort((a,b)=>a.start-b.start || a.trackIndex-b.trackIndex || a.midi-b.midi);
    const eventEnd=notes.reduce((max,n)=>Math.max(max,n.start+n.duration),0);
    const duration=clamp(Math.max(tickToSeconds(maxTick),eventEnd,0.05),0.05,MAX_MIDI_DURATION_SECONDS);
    return {format,trackCount,division,notes,duration,trackNames,tempoMap};
  }

  function midiFrequency(midi,pitchBend=8192){
    const bendSemitones=((pitchBend-8192)/8192)*2;
    return 440*Math.pow(2,(midi+ bendSemitones -69)/12);
  }
  function panGains(panValue){
    const pan=clamp((Number(panValue)-64)/63,-1,1);
    return [Math.sqrt((1-pan)*0.5),Math.sqrt((1+pan)*0.5)];
  }
  function seededNoise(seed){
    let x=(seed>>>0)||1;
    return function(){ x^=x<<13; x^=x>>>17; x^=x<<5; return ((x>>>0)/4294967296)*2-1; };
  }
  function sampleEnvelope(t,duration,attack,release,decay=0,sustain=1){
    if(t<0 || t>duration+release) return 0;
    let env=attack>0?Math.min(1,t/attack):1;
    if(decay>0 && t>attack){
      const d=Math.min(1,(t-attack)/decay);
      env*=1-(1-sustain)*d;
    }
    if(t>duration){
      const r=release>0?1-(t-duration)/release:0;
      env*=clamp(r,0,1);
    }
    return env;
  }
  function addStereo(left,right,index,value,lGain,rGain){
    if(index<0 || index>=left.length) return;
    left[index]+=value*lGain;
    right[index]+=value*rGain;
  }

  function renderDrum(target,note,start,velocity,pan,seed){
    const {left,right,sampleRate:sr}=target;
    const [lGain,rGain]=panGains(pan);
    const amp=(velocity/127)*0.55;
    const from=Math.max(0,Math.floor(start*sr));
    const noise=seededNoise(seed);
    let length=0.18,kind="noise";
    if(note===35 || note===36){ length=.36; kind="kick"; }
    else if(note===38 || note===40){ length=.24; kind="snare"; }
    else if(note===42 || note===44){ length=.09; kind="hat"; }
    else if(note===46){ length=.32; kind="hat-open"; }
    else if(note>=49 && note<=59){ length=.72; kind="cymbal"; }
    else if(note>=41 && note<=48){ length=.30; kind="tom"; }
    const count=Math.min(left.length-from,Math.ceil(length*sr));
    let phase=0,prev=0;
    for(let n=0;n<count;n++){
      const t=n/sr;
      let value=0;
      if(kind==="kick"){
        const freq=45+105*Math.exp(-t*18);
        phase+=2*Math.PI*freq/sr;
        value=Math.sin(phase)*Math.exp(-t*12)*amp*1.15;
      }else if(kind==="snare"){
        value=(noise()*.78+Math.sin(2*Math.PI*185*t)*.22)*Math.exp(-t*15)*amp;
      }else if(kind==="hat" || kind==="hat-open" || kind==="cymbal"){
        const white=noise();
        const high=white-prev*.82; prev=white;
        const decay=kind==="hat"?45:kind==="hat-open"?12:5.5;
        value=high*Math.exp(-t*decay)*amp*(kind==="cymbal"?.62:.78);
      }else if(kind==="tom"){
        const freq=70+(48-note)*13;
        phase+=2*Math.PI*Math.max(55,freq)/sr;
        value=(Math.sin(phase)*.8+noise()*.2)*Math.exp(-t*10)*amp;
      }else{
        value=noise()*Math.exp(-t*18)*amp*.75;
      }
      addStereo(left,right,from+n,value,lGain,rGain);
    }
  }

  function programFamily(program){
    program=clamp(Math.round(program)||0,0,127);
    if(program<8) return "piano";
    if(program<16) return "bell";
    if(program<24) return "organ";
    if(program<32) return "guitar";
    if(program<40) return "bass";
    if(program<56) return "strings";
    if(program<64) return "brass";
    if(program<80) return "winds";
    if(program<88) return "lead";
    if(program<96) return "pad";
    if(program<112) return "fx";
    return "perc";
  }

  const WAVETABLE_SIZE=2048;
  const waveTableCache=new Map();
  function getWaveTable(family){
    if(waveTableCache.has(family)) return waveTableCache.get(family);
    const table=new Float32Array(WAVETABLE_SIZE);
    for(let i=0;i<WAVETABLE_SIZE;i++){
      const phase=2*Math.PI*i/WAVETABLE_SIZE;
      let wave=0;
      if(family==="piano") wave=Math.sin(phase)*.66+Math.sin(phase*2)*.21+Math.sin(phase*3)*.08+Math.sin(phase*4)*.03;
      else if(family==="bell") wave=Math.sin(phase)*.52+Math.sin(phase*2.01)*.20+Math.sin(phase*3.9)*.18+Math.sin(phase*6.8)*.08;
      else if(family==="organ") wave=Math.sin(phase)*.58+Math.sin(phase*2)*.26+Math.sin(phase*3)*.11+Math.sin(phase*4)*.05;
      else if(family==="guitar") wave=Math.sin(phase)*.68+Math.sin(phase*2)*.20+Math.sin(phase*3)*.10;
      else if(family==="bass") wave=Math.sin(phase)*.74+Math.sin(phase*2)*.18+Math.sin(phase*.5)*.08;
      else if(family==="strings" || family==="pad") wave=Math.sin(phase)*.58+Math.sin(phase*2)*.19+Math.sin(phase*3)*.09+Math.sin(phase*4)*.04;
      else if(family==="brass") wave=Math.sin(phase)*.55+Math.sin(phase*2)*.20+Math.sin(phase*3)*.15+Math.sin(phase*5)*.06;
      else if(family==="winds") wave=Math.sin(phase)*.72+Math.sin(phase*2)*.12+Math.sin(phase*3)*.06;
      else if(family==="lead") wave=Math.sin(phase)*.48+Math.sin(phase*2)*.25+Math.sin(phase*3)*.12+Math.sin(phase*4)*.06;
      else wave=Math.sin(phase)*.58+Math.sin(phase*2.02)*.20+Math.sin(phase*3.01)*.08;
      table[i]=wave;
    }
    waveTableCache.set(family,table);
    return table;
  }
  function tableSample(table,phase){
    phase%=WAVETABLE_SIZE;
    if(phase<0) phase+=WAVETABLE_SIZE;
    const i0=phase|0,i1=(i0+1)%WAVETABLE_SIZE,frac=phase-i0;
    return table[i0]+(table[i1]-table[i0])*frac;
  }

  function renderTonalNote(target,note){
    const {left,right,sampleRate:sr}=target;
    const family=programFamily(note.program);
    const table=getWaveTable(family);
    const [lGain,rGain]=panGains(note.pan);
    const velocity=clamp(note.velocity/127,0,1);
    const channelGain=clamp((note.volume/127)*(note.expression/127),0,1);
    const amp=velocity*channelGain*0.19;
    if(amp<=0) return;
    const freq=midiFrequency(note.midi,note.pitchBend);
    const from=Math.max(0,Math.floor(note.start*sr));
    let attack=.008,release=.10,decay=.08,sustain=.82;
    if(family==="piano"){ attack=.004; release=.18; decay=.34; sustain=.30; }
    else if(family==="bell"){ attack=.002; release=.35; decay=.25; sustain=.20; }
    else if(family==="organ"){ attack=.01; release=.08; decay=0; sustain=1; }
    else if(family==="guitar"){ attack=.003; release=.12; decay=.28; sustain=.38; }
    else if(family==="bass"){ attack=.005; release=.10; decay=.12; sustain=.72; }
    else if(family==="strings" || family==="pad"){ attack=.055; release=.28; decay=.10; sustain=.82; }
    else if(family==="brass"){ attack=.025; release=.14; decay=.08; sustain=.86; }
    else if(family==="winds"){ attack=.018; release=.12; decay=.05; sustain=.90; }
    else if(family==="lead"){ attack=.008; release=.12; decay=.04; sustain=.92; }
    else if(family==="fx"){ attack=.035; release=.22; decay=.10; sustain=.76; }

    const total=Math.max(.02,note.duration)+release;
    const count=Math.min(left.length-from,Math.ceil(total*sr));
    const phaseInc=freq*WAVETABLE_SIZE/sr;
    const detuneInc=phaseInc*1.004;
    let phase=0,detunePhase=WAVETABLE_SIZE*.137;
    for(let n=0;n<count;n++){
      const t=n/sr;
      const env=sampleEnvelope(t,note.duration,attack,release,decay,sustain);
      if(env>0){
        let wave=tableSample(table,phase);
        if(family==="strings" || family==="pad") wave=wave*.72+tableSample(table,detunePhase)*.28;
        if(family==="guitar") wave*=Math.exp(-t*.9);
        addStereo(left,right,from+n,wave*env*amp,lGain,rGain);
      }
      phase+=phaseInc;
      detunePhase+=detuneInc;
      if(phase>=WAVETABLE_SIZE) phase-=WAVETABLE_SIZE*Math.floor(phase/WAVETABLE_SIZE);
      if(detunePhase>=WAVETABLE_SIZE) detunePhase-=WAVETABLE_SIZE*Math.floor(detunePhase/WAVETABLE_SIZE);
    }
  }

  function render(audioCtx,parsed){
    if(!audioCtx?.createBuffer) throw new Error("Web Audio context is required for MIDI rendering");
    const sampleRate=Math.max(22050,Math.min(48000,Number(audioCtx.sampleRate)||44100));
    const duration=clamp((parsed?.duration||0.05)+RENDER_TAIL_SECONDS,0.05,MAX_MIDI_DURATION_SECONDS+RENDER_TAIL_SECONDS);
    const length=Math.max(1,Math.ceil(duration*sampleRate));
    const buffer=audioCtx.createBuffer(2,length,sampleRate);
    const target={buffer,left:buffer.getChannelData(0),right:buffer.getChannelData(1),sampleRate};

    for(let i=0;i<parsed.notes.length;i++){
      const note=parsed.notes[i];
      if(note.start>duration) continue;
      if(note.channel===9) renderDrum(target,note.midi,note.start,note.velocity,note.pan,(i+1)*2654435761 ^ (note.midi<<12) ^ Math.floor(note.start*1000));
      else renderTonalNote(target,note);
    }

    let peak=0;
    for(const data of [target.left,target.right]){
      for(let i=0;i<data.length;i++) peak=Math.max(peak,Math.abs(data[i]));
    }
    const gain=peak>0.94?0.94/peak:1;
    if(gain!==1){
      for(const data of [target.left,target.right]) for(let i=0;i<data.length;i++) data[i]*=gain;
    }
    return buffer;
  }

  async function parseAndRender(audioCtx,arrayBuffer){
    const parsed=parse(arrayBuffer);
    if(!parsed.notes.length) throw new Error("MIDI file contains no playable note events");
    return render(audioCtx,parsed);
  }

  global.WifeyMIDI=Object.freeze({parse,render,parseAndRender});
})(window);
