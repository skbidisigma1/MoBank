document.addEventListener('DOMContentLoaded', () => { initializeMetronomeUI(); });

function initializeMetronomeUI() {

const tempoSlider               = document.getElementById('tempo-slider'),
      tempoDisplay              = document.getElementById('tempo-display'),
      tempoDecreaseBtn          = document.getElementById('tempo-decrease'),
      tempoIncreaseBtn          = document.getElementById('tempo-increase'),
      tempoPlayBtn              = document.getElementById('tempo-play'),
      decreaseBeatsBtn          = document.querySelector('[data-action="decrease-beats"]'),
      increaseBeatsBtn          = document.querySelector('[data-action="increase-beats"]'),
      decreaseNoteValueBtn      = document.querySelector('[data-action="decrease-note-value"]'),
      increaseNoteValueBtn      = document.querySelector('[data-action="increase-note-value"]'),
      timeSignatureNumerator    = document.getElementById('time-sig-numerator'),
      timeSignatureDenominator  = document.getElementById('time-sig-denominator'),
      accentPattern             = document.getElementById('accent-pattern'),
      soundButtons              = document.querySelectorAll('.sound-button'),
      volumeSlider              = document.getElementById('volume-slider'),
      pendulum                  = document.querySelector('.tempo-pendulum'),
      subdivisionSelector       = document.getElementById('subdivision-selector'),
      tapButton                 = document.getElementById('tap-tempo-button'),
      tapDisplay                = document.getElementById('tap-tempo-display'),
      useVoiceCountingCheckbox  = document.getElementById('use-voice-counting'),
      voiceOptionsPanel         = document.querySelector('.voice-options-panel'),
      useClickSubdivisionCheckbox = document.getElementById('use-click-subdivision'),
      voiceVolumeSlider         = document.getElementById('voice-volume-slider'),
      presetModal               = document.getElementById('preset-modal'),
      presetTabs                = document.querySelectorAll('.preset-tab'),
      presetTabContents         = document.querySelectorAll('.preset-tab-content'),
      presetNameInput           = document.getElementById('preset-name'),
      presetDescInput           = document.getElementById('preset-description'),
      presetSaveBtn             = document.getElementById('preset-save'),
      presetCancelBtn           = document.getElementById('preset-cancel'),
      presetCloseBtn            = document.getElementById('preset-close'),
      presetUpdateBtn           = document.getElementById('preset-update'),
      presetCancelEditBtn       = document.getElementById('preset-cancel-edit'),
      presetList                = document.getElementById('preset-list'),
      emptyPresets              = document.getElementById('empty-presets'),
      saveTabButtons            = document.getElementById('save-tab-buttons'),
      editTabButtons            = document.getElementById('edit-tab-buttons'),
      presetsGrid               = document.getElementById('presets-grid'),
      presetForm                = document.getElementById('preset-form'),
      includeTempoCheck         = document.getElementById('include-tempo'),
      includeTimeSignatureCheck = document.getElementById('include-time-signature'),
      includeSubdivisionCheck   = document.getElementById('include-subdivision'),
      includeAccentPatternCheck = document.getElementById('include-accent-pattern'),
      includeSoundCheck         = document.getElementById('include-sound'),
      includeVolumeCheck        = document.getElementById('include-volume'),
      includeVoiceSettingsCheck = document.getElementById('include-voice-settings'),
      presetDecreaseBeats       = document.getElementById('preset-decrease-beats'),
      presetIncreaseBeats       = document.getElementById('preset-increase-beats'),
      presetDecreaseNoteValue   = document.getElementById('preset-decrease-note-value'),
      presetIncreaseNoteValue   = document.getElementById('preset-increase-note-value'),
      presetSoundButtons        = document.querySelectorAll('.preset-sound-button'),
      presetVolumeSlider        = document.getElementById('preset-volume-slider'),
      presetVoiceVolumeSlider   = document.getElementById('preset-voice-volume-slider'),
      alertModal                = document.getElementById('alert-modal'),
      alertMessage              = document.getElementById('alert-message'),
      alertConfirm              = document.getElementById('alert-confirm'),
      confirmModal              = document.getElementById('confirm-modal'),
      confirmMessage            = document.getElementById('confirm-message'),
      confirmOk                 = document.getElementById('confirm-ok'),
      confirmCancel             = document.getElementById('confirm-cancel');

let isPlaying               = false,
    currentTempo            = parseInt(tempoDisplay.value),
    beatsPerMeasure         = parseInt(timeSignatureNumerator.textContent),
    noteValue               = parseInt(timeSignatureDenominator.textContent),
    subdivision             = parseInt(subdivisionSelector.value),
    currentBeat             = 0,
    pendulumAngle           = 0,
    selectedSound           = 'click',
    volume                  = parseFloat(volumeSlider.value)/100*1.5,
    audioContext            = null,
    metronomeProcessor      = null,
    tempoDebounceTimeout    = null,
    sounds                  = {click:{hi:null,lo:null},glassTick:{hi:null,lo:null},bell:{hi:null,lo:null}},
    useVoiceCounting        = false,
    selectedVoice           = 'male',
    useClickSubdivision     = false,
    voiceVolume             = parseFloat(voiceVolumeSlider.value)/100*1.5,
    voiceSounds             = {male:{numbers:{},subdivisions:{}}},
    pendulumRaf             = null,
    constValid              = [1,2,4,8,16,32],
    tapTimes                = [],
    tapTimeout              = null,
    currentEditingPresetId  = null,
    presetModalSelectedSound= selectedSound,
    overlayPointerDown      = false,
    wakeLock                = null,
    audioContextStartTime   = 0,
    lateNoteScheduleThreshold = 0.01,
    scheduledVisuals        = [],
    PRESET_CACHE_MS         = 20000,
    droppedNoteCount        = 0,
    perfectNoteCount        = 0,
    schedulerId             = null;

function createSimpleLoggingContainer(){
  const container=document.createElement('div');
  container.id='metronome-log-container';
  container.style.cssText='margin-top:50px;padding:20px;border-top:2px solid #444;background:#f5f5f5';
  const heading=document.createElement('h3');
  heading.textContent='Metronome Timing Log';
  heading.style.cssText='margin:0 0 10px 0';
  const toggle=document.createElement('button');
  toggle.id='log-toggle-btn';
  toggle.textContent='Start Logging';
  toggle.style.cssText='margin-bottom:10px;padding:5px 10px';
  toggle.onclick=toggleDesyncLogging;
  const content=document.createElement('div');
  content.id='metronome-log-content';
  container.append(heading,toggle,content);
  document.body.appendChild(container);
  return container;
}
createSimpleLoggingContainer();

const desyncLogging={
  enabled:false,
  initialized:false,
  beatInterval:0,
  expectedBeats:[],
  desyncs:[],
  maxDesync:0,
  totalDesync:0,
  beatCount:0,
  logFrequency:10,
  startTime:0,
  subdivisionDesync:false,
  audioLatency:0,
  initialize(startTime,interval){
    this.initialized=true;
    this.startTime=startTime;
    this.beatInterval=interval;
    this.expectedBeats=[];
    this.desyncs=[];
    this.maxDesync=0;
    this.totalDesync=0;
    this.beatCount=0;
    this.log(`Metronome logging initialized: ${currentTempo} BPM`,'heading');
  },
  log(msg,type='normal'){
    const el=document.getElementById('metronome-log-content');
    if(!el)return;
    const p=document.createElement('p');
    p.textContent=msg;
    p.style.margin='3px 0';
    if(type==='heading'){p.style.fontWeight='bold';p.style.color='#4CAF50';p.style.fontSize='16px'}
    else if(type==='error'){p.style.fontWeight='bold';p.style.color='#F44336'}
    else if(type==='stat'){p.style.color='#2196F3';p.style.marginLeft='20px'}
    else if(type==='warning'){p.style.color='#FF9800'}
    el.appendChild(p);
    window.scrollTo(0,document.body.scrollHeight);
  },
  calculateJitter(){
    const mean=this.totalDesync/this.desyncs.length;
    const variance=this.desyncs.reduce((s,d)=>s+Math.pow(Math.abs(d)-mean,2),0)/this.desyncs.length;
    return Math.sqrt(variance);
  },
  logBeat(desync,isSub=false){
    if(!this.enabled)return;
    if(isSub&&!this.subdivisionDesync)return;
    this.desyncs.push(desync);
    this.totalDesync+=Math.abs(desync);
    this.maxDesync=Math.max(this.maxDesync,Math.abs(desync));
    this.beatCount++;
    const c=Math.abs(desync)>5?'warning':'normal';
    this.log(`Beat ${this.beatCount}: desync = ${desync}ms${isSub?' (sub)':''}`,c);
    if(this.beatCount%this.logFrequency===0)this.logStats();
  },
  logStats(){
    if(!this.enabled||this.beatCount===0)return;
    const avg=Math.round(this.totalDesync/this.beatCount);
    this.log('Metronome Timing Stats:','heading');
    this.log(`Beats tracked: ${this.beatCount}`,'stat');
    this.log(`Average desync: ${avg}ms`,'stat');
    this.log(`Max desync: ${this.maxDesync}ms`,'stat');
    if(this.desyncs.length>1)this.log(`Timing jitter: ${Math.round(this.calculateJitter())}ms`,'stat');
    if(audioContext&&this.beatCount>10){
      if(audioContext.outputLatency){this.audioLatency=audioContext.outputLatency;this.log(`Audio output latency: ${(this.audioLatency*1000).toFixed(2)}ms`,'stat')}
      this.log(`Audio hardware: ${audioContext.sampleRate}Hz`,'stat');
      if(metronomeProcessor)this.log('Using AudioWorklet for high precision timing','stat');
      else this.log('Using setInterval fallback (less precise)','warning');
    }
  },
  reset(){
    if(this.beatCount>0){this.logStats();this.log('Metronome logging reset','heading')}
    this.initialized=false;
    this.expectedBeats=[];
    this.desyncs=[];
    this.maxDesync=0;
    this.totalDesync=0;
    this.beatCount=0;
    this.startTime=0;
  },
  startLogging(){
    document.getElementById('log-toggle-btn').textContent='Stop Logging';
    document.getElementById('log-toggle-btn').style.background='#F44336';
    document.getElementById('log-toggle-btn').style.color='#fff';
  },
  stopLogging(){
    document.getElementById('log-toggle-btn').textContent='Start Logging';
    document.getElementById('log-toggle-btn').style.background='';
    document.getElementById('log-toggle-btn').style.color='';
  }
};

async function requestWakeLock(){
  try{if('wakeLock'in navigator){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{if(isPlaying)requestWakeLock()})}}catch{}
}
function releaseWakeLock(){if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null}}

async function initAudio(){
  try{
    audioContext=new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive',sampleRate:48000});
    await loadSounds();
    await loadVoiceSounds();
    await initAudioWorklet();
  }catch(e){console.error('Audio init error:',e);showAlert('Error initializing audio system.')}
}
async function initAudioWorklet(){
  if(!audioContext)return;
  try{
    if(!audioContext.audioWorklet){console.warn('AudioWorklet not supported');return}
    await audioContext.audioWorklet.addModule('/tools/js/metronome-processor.js');
    metronomeProcessor=new AudioWorkletNode(audioContext,'metronome-processor',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1],processorOptions:{beatsPerMeasure,subdivision}});
    metronomeProcessor.port.onmessage=handleWorkletMessage;
    metronomeProcessor.connect(audioContext.destination);
  }catch(e){console.error('AudioWorklet init failed:',e);console.warn('Falling back to setInterval-based scheduling')}
}

function adjustedTime(t){return t+(audioContext.outputLatency||0)}

function handleWorkletMessage(event){
  if(!isPlaying)return;
  const data=event.data;
  if(data.type==='batch'){
    data.events.forEach(ev=>{
      const scheduledTime=ev.time;
      if(!desyncLogging.initialized){
        const beatMs=(60/currentTempo)*(4/noteValue)*1000;
        const intervalMs=subdivision>1?beatMs/subdivision:beatMs;
        desyncLogging.initialize(scheduledTime*1000,intervalMs);
      }
      const expected=desyncLogging.startTime+desyncLogging.beatCount*desyncLogging.beatInterval;
      const desync=Math.round(scheduledTime*1000-expected);
      desyncLogging.logBeat(desync,!ev.isMainBeat);
      const now=audioContext.currentTime;
      if(scheduledTime<now+lateNoteScheduleThreshold){droppedNoteCount++;playTickSound(ev)}
      else{perfectNoteCount++;playTickSound(ev,scheduledTime)}
      scheduleVisual(()=>{if(ev.isMainBeat)updateVisualBeat(ev.beatInMeasure)},scheduledTime);
    });
  }
}

const scheduledSources=new Map();

function playSound(accent,atTime=null){
  if(!audioContext||!sounds[selectedSound])return;
  const buffer=accent?sounds[selectedSound].hi:sounds[selectedSound].lo;
  const source=audioContext.createBufferSource();
  const gain=audioContext.createGain();
  source.buffer=buffer;
  gain.gain.value=volume;
  source.connect(gain);gain.connect(audioContext.destination);
  const start=Math.max(adjustedTime(atTime??audioContext.currentTime),audioContext.currentTime);
  source.start(start);
  scheduledSources.set(start,{source,gain});
  setTimeout(()=>{scheduledSources.delete(start)},(start-audioContext.currentTime)*1000+1000);
}
function playVoiceSound(n,atTime=null){
  if(!audioContext||!voiceSounds[selectedVoice].numbers[n])return;
  const s=audioContext.createBufferSource(),g=audioContext.createGain();
  s.buffer=voiceSounds[selectedVoice].numbers[n];
  g.gain.value=voiceVolume*(n==='2'?0.9:1);
  s.connect(g);g.connect(audioContext.destination);
  const start=Math.max(adjustedTime(atTime??audioContext.currentTime),audioContext.currentTime);
  s.start(start);
}
function playVoiceSubdivision(t,atTime=null){
  if(!audioContext||!voiceSounds[selectedVoice].subdivisions[t])return;
  const s=audioContext.createBufferSource(),g=audioContext.createGain();
  g.gain.value=voiceVolume*(t==='and'?0.64:0.8);
  s.buffer=voiceSounds[selectedVoice].subdivisions[t];
  s.connect(g);g.connect(audioContext.destination);
  const start=Math.max(adjustedTime(atTime??audioContext.currentTime),audioContext.currentTime);
  s.start(start);
}
function playSubdivisionSound(p,atTime=null){
  if(useVoiceCounting&&!useClickSubdivision){
    let s=null;
    if(subdivision===2)s='and';
    else if(subdivision===3){if(p===1)s='trip';else if(p===2)s='let'}
    else if(subdivision===4){if(p===1)s='e';else if(p===2)s='and';else if(p===3)s='a'}
    if(s){playVoiceSubdivision(s,atTime);return}
  }
  if(!audioContext||!sounds[selectedSound])return;
  const b=audioContext.createBufferSource(),g=audioContext.createGain();
  b.buffer=sounds[selectedSound].lo;
  if(!b.buffer)return;
  g.gain.value=volume*0.6;
  b.connect(g);g.connect(audioContext.destination);
  const start=Math.max(adjustedTime(atTime??audioContext.currentTime),audioContext.currentTime);
  b.start(start);
}

function checkScheduledVisuals(){
  const now=audioContext?.currentTime||performance.now()/1000;
  for(let i=scheduledVisuals.length-1;i>=0;i--){
    if(now>=scheduledVisuals[i].time){scheduledVisuals[i].callback();scheduledVisuals.splice(i,1)}
  }
  requestAnimationFrame(checkScheduledVisuals);
}
function scheduleVisual(cb,time){scheduledVisuals.push({time:adjustedTime(time),callback:cb})}
checkScheduledVisuals();

function tempoToSliderPosition(t){const m=10,x=1000,l=Math.log(m),M=Math.log(x);return 100/(M-l)*(Math.log(t)-l)}
function sliderPositionToTempo(p){const m=10,x=1000,l=Math.log(m),M=Math.log(x);return Math.round(Math.exp(l+p*(M-l)/100))}

function updateTempo(v){
  let n=parseInt(v);if(isNaN(n)||n<=0)n=10;
  currentTempo=Math.min(Math.max(n,10),1000);
  tempoDisplay.value=currentTempo;tempoSlider.value=tempoToSliderPosition(currentTempo);
  if(isPlaying){
    clearTimeout(tempoDebounceTimeout);
    if(metronomeProcessor){
      tempoDebounceTimeout=setTimeout(()=>{
        const beatSec=(60/currentTempo)*(4/noteValue);
        const subSec=subdivision>1?beatSec/subdivision:beatSec;
        metronomeProcessor.port.postMessage({type:'update',interval:subSec,tempo:currentTempo});
      },150);
    }else tempoDebounceTimeout=setTimeout(restartMetronome,150);
  }
}
function updateBeatsPerMeasure(v){
  beatsPerMeasure=Math.min(Math.max(v,1),12);
  timeSignatureNumerator.textContent=beatsPerMeasure;
  updateAccentPattern();updateBeatLights();
  if(isPlaying)restartMetronome();
}
function updateNoteValue(v){if(constValid.includes(v)){noteValue=v;timeSignatureDenominator.textContent=noteValue;updateAccentPattern();updateBeatLights();if(isPlaying)restartMetronome()}}

function updateAccentPattern(p=null){
  accentPattern.innerHTML='';
  for(let i=0;i<beatsPerMeasure;i++){
    let st='normal';
    if(p&&i<p.length)st=p[i];
    else if(noteValue===8&&(beatsPerMeasure===6||beatsPerMeasure===9||beatsPerMeasure===12)?i%3===0:i===0)st='accent';
    const b=document.createElement('button');
    b.className='accent-button';
    b.dataset.beat=i+1;b.dataset.state=st;b.type='button';
    if(st==='accent')b.classList.add('accent');
    else if(st==='silent')b.classList.add('silent');
    b.innerHTML=`<span>${i+1}</span>`;
    b.onclick=()=>{const s=b.dataset.state;b.dataset.state=s==='normal'?'accent':s==='accent'?'silent':'normal';b.classList.toggle('accent',b.dataset.state==='accent');b.classList.toggle('silent',b.dataset.state==='silent');updateBeatLights()};
    accentPattern.appendChild(b);
  }
  updateBeatLights();
}
function updateBeatLights(){
  const c=document.querySelector('.beat-lights');c.innerHTML='';
  for(let i=0;i<beatsPerMeasure;i++){
    const st=document.querySelector(`.accent-button[data-beat="${i+1}"]`)?.dataset.state||'normal';
    const d=document.createElement('div');d.className='beat-light';
    if(st==='accent')d.classList.add('accent');else if(st==='silent')d.classList.add('silent');
    d.dataset.beat=i+1;c.appendChild(d);
  }
}
function updateVisualBeat(i){
  document.querySelectorAll('.beat-light').forEach(l=>l.classList.remove('active'));
  const b=document.querySelector(`.beat-light[data-beat="${i+1}"]`);if(b)b.classList.add('active');
}

function animatePendulum(intervalMs){
  if(!audioContext)return;
  const intervalSec=intervalMs/1000;
  const audioTime=audioContext.currentTime-audioContextStartTime;
  const progress=(audioTime%intervalSec)/intervalSec;
  const direction=Math.floor(audioTime/intervalSec)%2===0?1:-1;
  pendulumAngle=Math.sin(progress*Math.PI)*0.392699*direction;
  pendulum.style.transform=`rotate(${pendulumAngle}rad) translate3d(0,0,0)`;
  pendulumRaf=requestAnimationFrame(()=>animatePendulum(intervalMs));
}

async function startMetronome(){
  if(isPlaying)return;
  isPlaying=true;
  if(audioContext===null)await initAudio();else if(audioContext.state==='suspended')await audioContext.resume();
  await requestWakeLock();
  pendulum.style.transform='rotate(0rad)';
  audioContextStartTime=audioContext.currentTime;
  tempoPlayBtn.innerHTML='<svg width="24" height="24"><path d="M6 19h4V5H6zm8-14v14h4V5z" fill="currentColor"/></svg>';
  const beatSec=(60/currentTempo)*(4/noteValue);
  const subSec=subdivision>1?beatSec/subdivision:beatSec;
  const beatMs=beatSec*1000;
  desyncLogging.reset();
  if(pendulumRaf)cancelAnimationFrame(pendulumRaf);animatePendulum(beatMs);
  const patterns=[];document.querySelectorAll('.accent-button').forEach(btn=>patterns.push(btn.dataset.state||'normal'));
  if(metronomeProcessor){
    metronomeProcessor.port.postMessage({type:'start',interval:subSec,tempo:currentTempo,beatsPerMeasure,subdivision,beatPatterns:patterns});
  }
  droppedNoteCount=0;perfectNoteCount=0;
}
function stopMetronome(){
  isPlaying=false;
  releaseWakeLock();
  if(metronomeProcessor)metronomeProcessor.port.postMessage({type:'stop'});
  if(schedulerId){clearInterval(schedulerId);schedulerId=null}
  if(pendulumRaf){cancelAnimationFrame(pendulumRaf);pendulumRaf=null}
  pendulumAngle=0;
  pendulum.style.transition='transform 0.5s ease-out';
  pendulum.style.transform='rotate(0rad)';
  tempoPlayBtn.innerHTML='<svg width="24" height="24"><path d="M8 5V19L19 12Z" fill="currentColor"/></svg>';
  document.querySelectorAll('.beat-light').forEach(l=>l.classList.remove('active'));
  if(desyncLogging.enabled&&desyncLogging.beatCount>0){
    desyncLogging.log('Metronome Stopped - Final Stats:','error');desyncLogging.logStats();
    if(metronomeProcessor){const total=perfectNoteCount+droppedNoteCount;if(total>0){const pct=(perfectNoteCount/total*100).toFixed(2);desyncLogging.log('AudioWorklet timing stats:','heading');desyncLogging.log(`Perfect timing: ${perfectNoteCount} beats (${pct}%)`,'stat');desyncLogging.log(`Late scheduling: ${droppedNoteCount} beats (${(100-pct).toFixed(2)}%)`,'stat')}}
  }
}
function restartMetronome(){if(isPlaying){stopMetronome();startMetronome()}}

subdivisionSelector.onchange=()=>{subdivision=parseInt(subdivisionSelector.value);if(isPlaying)restartMetronome()};
tempoSlider.value=tempoToSliderPosition(currentTempo);
tempoSlider.oninput=()=>updateTempo(sliderPositionToTempo(parseFloat(tempoSlider.value)));
tempoDisplay.onchange=tempoDisplay.onblur=()=>updateTempo(tempoDisplay.value);
tempoDecreaseBtn.onclick=()=>updateTempo(currentTempo-1);
tempoIncreaseBtn.onclick=()=>updateTempo(currentTempo+1);
tempoPlayBtn.onclick=()=>isPlaying?stopMetronome():startMetronome();
decreaseBeatsBtn.onclick=()=>updateBeatsPerMeasure(beatsPerMeasure-1);
increaseBeatsBtn.onclick=()=>updateBeatsPerMeasure(beatsPerMeasure+1);
decreaseNoteValueBtn.onclick=()=>{const i=constValid.indexOf(noteValue);if(i>0)updateNoteValue(constValid[i-1])};
increaseNoteValueBtn.onclick=()=>{const i=constValid.indexOf(noteValue);if(i<constValid.length-1)updateNoteValue(constValid[i+1])};
volumeSlider.oninput=()=>{volume=parseFloat(volumeSlider.value)/100*1.5};
useVoiceCountingCheckbox.onchange=()=>{useVoiceCounting=useVoiceCountingCheckbox.checked;voiceOptionsPanel.style.display=useVoiceCounting?'block':'none';if(isPlaying)restartMetronome()};
useClickSubdivisionCheckbox.onchange=()=>{useClickSubdivision=useClickSubdivisionCheckbox.checked;if(isPlaying)restartMetronome()};
voiceVolumeSlider.oninput=()=>{voiceVolume=parseFloat(voiceVolumeSlider.value)/100*1.5};

function toggleDesyncLogging(){
  desyncLogging.enabled=!desyncLogging.enabled;
  if(desyncLogging.enabled){
    desyncLogging.startLogging();
    desyncLogging.log('Metronome timing logging enabled','heading');
    desyncLogging.log(`Current settings: ${currentTempo} BPM, ${beatsPerMeasure}/${noteValue}, subdivision: ${subdivision}`,'stat');
    if(isPlaying)desyncLogging.reset();
  }else{
    desyncLogging.log('Metronome timing logging disabled','error');
    desyncLogging.stopLogging();
  }
}

function showAlert(message,duration=5000){
  alertMessage.textContent=message;
  alertModal.classList.add('visible');
  setTimeout(()=>{alertModal.classList.remove('visible')},duration);
}

async function loadSounds(){
  const files=[
    {name:'click',file:'Perc_Tongue_hi.wav',type:'hi'},
    {name:'click',file:'Perc_Tongue_lo.wav',type:'lo'},
    {name:'glassTick',file:'Perc_Glass_hi.wav',type:'hi'},
    {name:'glassTick',file:'Perc_Glass_lo.wav',type:'lo'},
    {name:'bell',file:'Synth_Bell_A_hi.wav',type:'hi'},
    {name:'bell',file:'Synth_Bell_A_lo.wav',type:'lo'}
  ];
  await Promise.all(files.map(async f=>{
    const r=await fetch(`/tools/sounds/metronome/${f.file}`);if(!r.ok)return;
    const buf=await r.arrayBuffer();sounds[f.name][f.type]=await audioContext.decodeAudioData(buf);
  }));
  document.querySelector(`.sound-button[data-sound="${selectedSound}"]`)?.classList.add('selected');
}
async function loadVoiceSounds(){
  const nums=[];for(let i=1;i<=12;i++)nums.push(loadVoiceSound('numbers',i.toString(),`${i}.wav`));
  const subs=[{name:'e',file:'e.wav'},{name:'and',file:'and.wav'},{name:'a',file:'a.wav'},{name:'trip',file:'trip.wav'},{name:'let',file:'let.wav'}];
  const subp=subs.map(s=>loadVoiceSound('subdivisions',s.name,s.file));
  await Promise.all([...nums,...subp]);
}
async function loadVoiceSound(cat,name,file){
  const r=await fetch(`/tools/sounds/metronome/voice/male/${file}`);if(!r.ok)return;
  const buf=await r.arrayBuffer();voiceSounds.male[cat][name]=await audioContext.decodeAudioData(buf);
}

function playTickSound(data,atTime=null){
  if(data.silent)return;
  if(data.isMainBeat){
    if(useVoiceCounting)playVoiceSound((data.beatInMeasure+1).toString(),atTime);
    else playSound(data.accent,atTime);
  }else if(subdivision>1)playSubdivisionSound(data.subBeat,atTime);
}

updateAccentPattern();updateBeatLights();
initAudio();

window.addEventListener('keydown', e => {
  const active = document.activeElement;
  const isForm = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
  
  if (e.code === 'Space' && !isForm) {
    e.preventDefault();
    isPlaying ? stopMetronome() : startMetronome();
  }
  
  if (!isForm) {
    if (e.code === 'Enter') {
      if (active === tempoDisplay) {
        tempoDisplay.blur();
        e.preventDefault();
      } else {
        tempoDisplay.focus();
        tempoDisplay.select();
        e.preventDefault();
      }
    }
    
    let step = e.shiftKey && e.ctrlKey ? 20 : e.ctrlKey ? 10 : e.shiftKey ? 5 : 1;
    
    if (e.code === 'ArrowUp' || e.code === 'ArrowRight') {
      e.preventDefault();
      updateTempo(currentTempo + step);
    }
    
    if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') {
      e.preventDefault();
      updateTempo(currentTempo - step);
    }
    
    if (e.ctrlKey && e.altKey && e.code === 'KeyL') {
      e.preventDefault();
      toggleDesyncLogging();
    }
    
    if (e.ctrlKey && e.altKey && e.code === 'KeyS') {
      e.preventDefault();
      desyncLogging.subdivisionDesync = !desyncLogging.subdivisionDesync;
      desyncLogging.log(`Subdivision desync logging ${desyncLogging.subdivisionDesync ? 'enabled' : 'disabled'}`,
        desyncLogging.subdivisionDesync ? 'heading' : 'error');
    }
  }
});