/*
  WIFEY MIX-8 — filename/folder tag rules
  ----------------------------------------
  This is the actual parser vocabulary, not just documentation.
  Add/remove aliases here and index.html will use them on the next page load.

  Syntax is deliberately forgiving:
    guitar lvl72 pan65 rm18.mid
    guitar [lvl=72] [pan=65] [room=18].mid
    guitar instclean-guitar sfrush.mid
    Song bp118 mas82

  Value tags are only recognized when they HAVE a value. A plain word such as
  "midi" is therefore just part of the track name; "midi2" / "midi=2" is a tag.
  Boolean tags are the intentional exception: mute, solo, agc, ignr, etc.
*/
(function(){
  const scopes={track:["track"],folder:["folder"],both:["track","folder"]};
  const tags=[
    // Identity / organization
    {key:"name",type:"text",scope:scopes.both,aliases:["name","nm"],joined:["name","nm"],consumeRemainder:true},
    {key:"role",type:"enum",scope:scopes.track,aliases:["role","rle","rl"],joined:["role","rle","rl"]},
    {key:"instrument",type:"text",scope:scopes.track,aliases:["instrument","instr","inst","ins"],joined:["inst","ins"],consumeRemainder:true},
    {key:"order",type:"integer",scope:scopes.track,min:0,max:999,aliases:["order","ordr","ord","or"]},
    {key:"group",type:"text",scope:scopes.both,aliases:["group","grp","gr"],joined:["group","grp","gr"]},
    {key:"ignore",type:"boolean",scope:scopes.both,aliases:["ignore","ignr","ign"],falseAliases:["noignore","noignr"]},

    // Per-track mixer defaults
    {key:"level",type:"number",scope:scopes.track,min:0,max:100,aliases:["level","lvl","lv","fader","fdr"]},
    {key:"pan",type:"pan",scope:scopes.track,min:0,max:100,aliases:["pan","pn"]},
    {key:"room",type:"number",scope:scopes.track,min:0,max:100,aliases:["room","rm","rvb","reverb"]},
    {key:"trim",type:"number",scope:scopes.track,min:0,max:100,aliases:["trim","trm"]},
    {key:"mute",type:"boolean",scope:scopes.track,aliases:["mute","mut"],falseAliases:["unmute","nomute"]},
    {key:"solo",type:"boolean",scope:scopes.track,aliases:["solo","sol"],falseAliases:["unsolo","nosolo"]},
    {key:"agc",type:"boolean",scope:scopes.both,aliases:["agc","autogain"],falseAliases:["noagc","agcoff","autogainoff"]},
    {key:"lock",type:"boolean",scope:scopes.track,aliases:["lock","lck"],falseAliases:["unlock","unlck"]},

    // MIDI / patch defaults (instrument/role still remain useful metadata on audio stems)
    {key:"lockInstrument",type:"boolean",scope:scopes.track,aliases:["lockinst","lckinst","lcki","instlock"],falseAliases:["unlockinst","unlcki","nolockinst"]},
    {key:"soundfont",type:"enum",scope:scopes.track,aliases:["soundfont","sfont","sf"],joined:["sfont","sf"]},
    {key:"bank",type:"integer",scope:scopes.track,min:0,max:16383,aliases:["bank","bnk"]},
    {key:"program",type:"program",scope:scopes.track,aliases:["program","prgm","prog","pgm"],joined:["prgm","prog","pgm"]},
    {key:"transpose",type:"integer",scope:scopes.track,min:-48,max:48,aliases:["transpose","transp","trnsps","trns","tp"]},
    {key:"octave",type:"integer",scope:scopes.track,min:-4,max:4,aliases:["octave","oct"]},
    {key:"velocity",type:"integer",scope:scopes.track,min:1,max:127,aliases:["velocity","vel"]},
    {key:"velocityScale",type:"number",scope:scopes.track,min:0,max:400,aliases:["velocityscale","velscale","velscl","vscale","vscl"]},
    {key:"channel",type:"integer",scope:scopes.track,min:1,max:16,aliases:["channel","chan","chn","ch"]},
    {key:"midiTrack",type:"integer",scope:scopes.track,min:1,max:999,aliases:["miditrack","miditrk","midi","mid"]},
    {key:"drumMap",type:"enum",scope:scopes.track,aliases:["drummap","drmmap","drm","dm"],joined:["drummap","drmmap","drm","dm"]},

    // Timing / layout metadata
    {key:"start",type:"seconds",scope:scopes.track,min:-86400,max:86400,aliases:["start","strt","str"]},
    {key:"offset",type:"seconds",scope:scopes.track,min:-86400,max:86400,aliases:["offset","ofs","off"]},
    {key:"end",type:"seconds",scope:scopes.track,min:0,max:86400,aliases:["end","stop","stp"]},
    {key:"length",type:"seconds",scope:scopes.track,min:0,max:86400,aliases:["length","len","lng"]},
    {key:"loopStart",type:"seconds",scope:scopes.both,min:0,max:86400,aliases:["loopstart","lpstart","lpstrt","lps"]},
    {key:"loopEnd",type:"seconds",scope:scopes.both,min:0,max:86400,aliases:["loopend","lpend","lpe"]},
    {key:"bars",type:"integer",scope:scopes.both,min:1,max:4096,aliases:["bars","bar"]},
    {key:"beats",type:"number",scope:scopes.both,min:1,max:64,aliases:["beats","bts","beat"]},
    {key:"ppq",type:"integer",scope:scopes.both,min:1,max:32767,aliases:["ppq"]},
    {key:"loop",type:"boolean",scope:scopes.track,aliases:["loop","lp"],falseAliases:["noloop","nlp"]},
    {key:"oneShot",type:"boolean",scope:scopes.track,aliases:["oneshot","1shot"],falseAliases:["nooneshot"]},

    // Optional source-processing defaults
    {key:"reverse",type:"boolean",scope:scopes.track,aliases:["reverse","rev"],falseAliases:["noreverse","norev"]},
    {key:"mono",type:"boolean",scope:scopes.track,aliases:["mono"],falseAliases:["stereo","nomono"]},
    {key:"swapLR",type:"boolean",scope:scopes.track,aliases:["swaplr","swplr"],falseAliases:["noswaplr"]},
    {key:"phaseInvert",type:"boolean",scope:scopes.track,aliases:["phaseinvert","phaseinv","phinv","invphase"],falseAliases:["nophaseinvert","nophinv"]},
    {key:"fadeIn",type:"seconds",scope:scopes.track,min:0,max:3600,aliases:["fadein","fin"]},
    {key:"fadeOut",type:"seconds",scope:scopes.track,min:0,max:3600,aliases:["fadeout","fout"]},
    {key:"gain",type:"db",scope:scopes.track,min:-60,max:36,aliases:["gain","gn"]},
    {key:"pitch",type:"number",scope:scopes.track,min:-36,max:36,aliases:["pitch","pch"]},
    {key:"stretch",type:"stretch",scope:scopes.track,min:0.1,max:8,aliases:["stretch","strch","stch"]},
    {key:"key",type:"text",scope:scopes.track,aliases:["key"]},
    {key:"root",type:"text",scope:scopes.track,aliases:["root","rt"],joined:["rt"]},

    // Folder / playlist defaults
    {key:"bpm",type:"integer",scope:scopes.folder,min:60,max:180,aliases:["bpm","bp","tempo","tmp"]},
    {key:"master",type:"number",scope:scopes.folder,min:0,max:100,aliases:["master","mstr","mas","mst"]},
    {key:"masterPan",type:"pan",scope:scopes.folder,min:0,max:100,aliases:["masterpan","mstrpan","maspan","mpan"]},
    {key:"masterRoom",type:"number",scope:scopes.folder,min:0,max:100,aliases:["masterroom","mstrroom","masroom","mroom","mrvb"]},
    {key:"tone",type:"number",scope:scopes.folder,min:0,max:100,aliases:["tone","tn"]},
    {key:"megaphone",type:"boolean",scope:scopes.folder,aliases:["megaphone","mega","phone","meg"],falseAliases:["nomegaphone","nomega","nophone"]},
    {key:"mode",type:"enum",scope:scopes.folder,aliases:["mode","md"],joined:["mode","md"]},
    {key:"autoplay",type:"boolean",scope:scopes.folder,aliases:["autoplay","autop","aplay"],falseAliases:["noautoplay"]}
  ];

  const valueAliases={
    role:{
      drum:"drums",drums:"drums",kit:"drums",beat:"drums",
      perc:"percussion",percussion:"percussion",shaker:"percussion",
      bass:"bass",sub:"bass","808":"sub-808",
      guitar:"guitar",gtr:"guitar",pluck:"plucked-strings",
      piano:"piano",keys:"keys",keyboards:"keys",rhodes:"rhodes",wurli:"wurli",organ:"organ",
      vox:"lead-vocal",vocal:"lead-vocal",vocals:"lead-vocal",leadvox:"lead-vocal",backingvox:"backing-vocals",
      synth:"synth",lead:"synth",melody:"synth",pad:"pads",pads:"pads",
      strings:"strings",string:"strings",brass:"brass",woodwind:"woodwinds",woodwinds:"woodwinds",
      mallet:"mallets",mallets:"mallets",fx:"ear-candy",sfx:"ear-candy",effect:"ear-candy",effects:"ear-candy",candy:"ear-candy",earcandy:"ear-candy",
      flair:"ear-candy",flourish:"ear-candy",sweetener:"ear-candy",stinger:"ear-candy",riser:"ear-candy",impact:"ear-candy",
      whoosh:"ear-candy",sweep:"ear-candy",transition:"ear-candy",texture:"ear-candy",ambience:"ambience-room",room:"ambience-room",
      sample:"loops-samples",samples:"loops-samples",loop:"loops-samples",guide:"click-guide",click:"click-guide"
    },
    soundfont:{
      sf64:"sf64",sf:"sf64",rush:"rush",gottarush:"rush",gotta:"rush",
      genies:"genies",genie:"genies",meow:"meow",cat:"meow",
      casino:"casino",sonic:"casino",sonicdrums:"casino"
    },
    drumMap:{sonic:"sonic",casino:"sonic",gm:"gm",general:"gm",native:"native",none:"native"},
    mode:{loop:"loop",lp:"loop",shuffle:"shuffle",shuf:"shuffle",random:"shuffle",sequential:"sequential",seq:"sequential",next:"sequential"},
    instrument:{
      "clean-guitar":"clean guitar","cleanguitar":"clean guitar",
      "muted-guitar":"mute guitar","muteguitar":"mute guitar",
      "nylon-guitar":"nylon guitar","steel-guitar":"steel guitar",
      "dist-guitar":"dist guitar","distortion-guitar":"distortion guitar","overdrive-guitar":"overdrive guitar",
      "baritone-sax":"baritone sax","barisax":"baritone sax",
      "water-palace-synth":"water palace synth","waterpalacesynth":"water palace synth",
      "e-piano":"e piano 1","epiano":"e piano 1","electric-piano":"electric piano 1",
      "grand-piano":"grand piano","grandpiano":"grand piano",
      "saw-lead":"sawtooth","lead-saw":"sawtooth","square-lead":"square",
      "finger-bass":"electric bass f","fretless-bass":"fretless bass","slap-bass":"slap bass",
      "warm-pad":"warm pad","vibes":"vibraphone","vibraphone":"vibraphone"
    }
  };

  window.WIFEY_FILENAME_TAG_RULES=Object.freeze({version:2,tags:Object.freeze(tags),valueAliases:Object.freeze(valueAliases)});
})();
