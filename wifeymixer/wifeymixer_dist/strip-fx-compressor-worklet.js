class WifeyZeroLookaheadCompressor extends AudioWorkletProcessor {
  static get parameterDescriptors(){
    return [
      {name:'threshold',defaultValue:-18,minValue:-60,maxValue:0,automationRate:'k-rate'},
      {name:'ratio',defaultValue:3.5,minValue:1,maxValue:20,automationRate:'k-rate'},
      {name:'attack',defaultValue:.010,minValue:.0001,maxValue:.2,automationRate:'k-rate'},
      {name:'release',defaultValue:.180,minValue:.005,maxValue:1,automationRate:'k-rate'},
      {name:'knee',defaultValue:18,minValue:0,maxValue:40,automationRate:'k-rate'},
      {name:'makeup',defaultValue:1.5,minValue:-6,maxValue:12,automationRate:'k-rate'}
    ];
  }
  constructor(){super();this.gain=1}
  static gainReductionDb(levelDb,threshold,ratio,knee){
    if(knee<=.0001){
      if(levelDb<=threshold)return 0;
      return (threshold+(levelDb-threshold)/ratio)-levelDb;
    }
    const lower=threshold-knee*.5,upper=threshold+knee*.5;
    if(levelDb<=lower)return 0;
    if(levelDb>=upper)return (threshold+(levelDb-threshold)/ratio)-levelDb;
    const x=levelDb-lower;
    return (1/ratio-1)*(x*x)/(2*knee);
  }
  process(inputs,outputs,parameters){
    const input=inputs[0],output=outputs[0];
    if(!output?.length)return true;
    const frames=output[0]?.length||128;
    const threshold=parameters.threshold[0],ratio=Math.max(1,parameters.ratio[0]),attack=Math.max(.0001,parameters.attack[0]),release=Math.max(.005,parameters.release[0]),knee=Math.max(0,parameters.knee[0]),makeup=parameters.makeup[0];
    const attackCoeff=Math.exp(-1/(attack*sampleRate)),releaseCoeff=Math.exp(-1/(release*sampleRate));
    const makeupGain=Math.pow(10,makeup/20);
    let gain=this.gain;
    for(let i=0;i<frames;i++){
      let peak=0;
      for(let c=0;c<input.length;c++)peak=Math.max(peak,Math.abs(input[c]?.[i]||0));
      const levelDb=20*Math.log10(Math.max(1e-9,peak));
      const reductionDb=WifeyZeroLookaheadCompressor.gainReductionDb(levelDb,threshold,ratio,knee);
      const target=Math.pow(10,reductionDb/20);
      const coeff=target<gain?attackCoeff:releaseCoeff;
      gain=target+(gain-target)*coeff;
      for(let c=0;c<output.length;c++)output[c][i]=(input[Math.min(c,input.length-1)]?.[i]||0)*gain*makeupGain;
    }
    this.gain=gain;
    return true;
  }
}
registerProcessor('wifey-zero-lookahead-compressor',WifeyZeroLookaheadCompressor);
