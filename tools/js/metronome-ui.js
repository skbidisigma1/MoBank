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

const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
if (isMobileDevice) {
  const warningEl = document.createElement('div');
  warningEl.id = 'mobile-silent-warning';
  warningEl.textContent = "Note: Make sure your device isn't in silent mode";
  warningEl.style.cssText = 'background: rgba(255, 165, 0, 0.1); color: #FFA500; font-size: 0.9rem; text-align: center; padding: 0.5rem 1rem; margin: 0.5rem 0; border-radius: 4px;';
  document.querySelector('.metronome-header')?.appendChild(warningEl);
}

let isPlaying               = false,
    currentTempo            = parseInt(tempoDisplay.value),
    beatsPerMeasure         = parseInt(timeSignatureNumerator.textContent),
    noteValue               = parseInt(timeSignatureDenominator.textContent),
    subdivision             = parseInt(subdivisionSelector.value),
    currentBeat             = 0,
    pendulumAngle           = 0,
    selectedSound           = 'click',
    volume                  = parseFloat(volumeSlider.value)/100,
    audioContext            = null,
    metronomeProcessor      = null,
    tempoDebounceTimeout    = null,
    sounds                  = {click:{hi:null,lo:null},glassTick:{hi:null,lo:null},bell:{hi:null,lo:null}},
    useVoiceCounting        = false,
    selectedVoice           = 'male',
    useClickSubdivision     = false,
    voiceVolume             = parseFloat(voiceVolumeSlider.value)/100,
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
    schedulerId             = null, silentNode = null;

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
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      // re-acquire if released (e.g., system interruption)
      wakeLock.addEventListener('release', async () => {
        console.warn('Screen Wake Lock was released');
        if (isPlaying) await requestWakeLock();
      });
    }
  } catch (err) {
    console.error('Failed to acquire Wake Lock:', err);
  }
}

function releaseWakeLock(){
  if (wakeLock) {
    wakeLock.release().catch(err => console.error('Failed to release Wake Lock:', err));
    wakeLock = null;
  }
}

// Re-request wake lock when page becomes visible again
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && isPlaying) {
    try { await requestWakeLock(); }
    catch (err) { console.error('Wake Lock re-request on visibility change failed:', err); }
  }
});

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
      const state = document.querySelector(`.accent-button[data-beat="${ev.beatInMeasure+1}"]`)?.dataset.state;
      const isSilent = state === 'silent';
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
      if(!isSilent) {
        if(scheduledTime<now+lateNoteScheduleThreshold){droppedNoteCount++;playTickSound(ev)}
        else{perfectNoteCount++;playTickSound(ev,scheduledTime)}
      }
      // Always schedule visual for main beats, even if silent
      scheduleVisual(()=>{if(ev.isMainBeat)updateVisualBeat(ev.beatInMeasure)},scheduledTime);
      if(!ev.isMainBeat && subdivision>1 && !isSilent) {
        playSubdivisionSound(ev.subBeat,scheduledTime);
      }
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
    b.onclick=()=>{
      const s=b.dataset.state;
      b.dataset.state=s==='normal'?'accent':s==='accent'?'silent':'normal';
      b.classList.toggle('accent',b.dataset.state==='accent');
      b.classList.toggle('silent',b.dataset.state==='silent');
      updateBeatLights();
      if (isPlaying) {
        restartPendulumLoop();
        if (metronomeProcessor) {
          const patterns = Array.from(document.querySelectorAll('.accent-button')).map(btn => btn.dataset.state);
          metronomeProcessor.port.postMessage({ type: 'update', beatPatterns: patterns });
        }
      }
    };
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

function restartPendulumLoop() {
  const beatSec = (60/currentTempo)*(4/noteValue);
  const beatMs = beatSec * 1000;
  if (pendulumRaf) cancelAnimationFrame(pendulumRaf);
  animatePendulum(beatMs);
}

async function startMetronome(){
  if(isPlaying) return;
  isPlaying = true;
  if(audioContext===null) await initAudio(); else if(audioContext.state==='suspended') await audioContext.resume();
  // Unlock audio output by playing a silent buffer (no CSP issues)
  if(!silentNode){
    const silentBuffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
    silentNode = audioContext.createBufferSource();
    silentNode.buffer = silentBuffer;
    silentNode.loop = true;
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    silentNode.connect(silentGain).connect(audioContext.destination);
    silentNode.start();
  }
  await requestWakeLock();
  pendulum.style.transform='rotate(0rad)';
  pendulum.style.transition='';
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
volumeSlider.oninput=()=>{volume=parseFloat(volumeSlider.value)/100};
useVoiceCountingCheckbox.onchange=()=>{useVoiceCounting=useVoiceCountingCheckbox.checked;voiceOptionsPanel.style.display=useVoiceCounting?'block':'none';if(isPlaying)restartMetronome()};
useClickSubdivisionCheckbox.onchange=()=>{useClickSubdivision=useClickSubdivisionCheckbox.checked;if(isPlaying)restartMetronome()};
voiceVolumeSlider.oninput=()=>{voiceVolume=parseFloat(voiceVolumeSlider.value)/100};

soundButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const sound = btn.getAttribute('data-sound');
    if (!sounds[sound]) return;
    selectedSound = sound;
    soundButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

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

function getCachedPresets() {
  const raw = localStorage.getItem('presetsCache');
  if (raw) {
    try {
      const { timestamp, data } = JSON.parse(raw);
      if (Date.now() - timestamp < PRESET_CACHE_MS) return data;
    } catch {}
  }
  return null;
}
function setCachedPresets(data) {
  localStorage.setItem('presetsCache', JSON.stringify({ timestamp: Date.now(), data }));
}
function clearCachedPresets() {
  localStorage.removeItem('presetsCache');
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

tapButton.addEventListener('click', function() {
  const now = Date.now();
  if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) {
    tapTimes.length = 0;
  }
  tapTimes.push(now);
  if (tapTimes.length > 8) tapTimes.shift();
  if (tapTimes.length >= 2) {
    const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avg);
    if (bpm >= 10 && bpm <= 1000) {
      updateTempo(bpm);
      tapDisplay.textContent = bpm + ' BPM';
    } else {
      tapDisplay.textContent = '-- BPM';
    }
  } else {
    tapDisplay.textContent = '-- BPM';
  }
  tapButton.classList.add('tapped');
  setTimeout(() => tapButton.classList.remove('tapped'), 200);
  clearTimeout(tapTimeout);
  tapTimeout = setTimeout(() => {
    tapTimes.length = 0;
    tapDisplay.textContent = '-- BPM';
  }, 2500);
});

// Open the preset modal when the Manage Presets button is clicked
const savePresetBtn = document.getElementById('save-preset');
if (savePresetBtn) {
  savePresetBtn.addEventListener('click', () => {
    // ensure Save footer is visible
    saveTabButtons.style.display = 'flex';
    editTabButtons.style.display = 'none';
    presetModal.classList.add('visible');
    // always show Save tab when opening
    presetTabs.forEach(t=>t.classList.remove('active'));
    document.querySelector('.preset-tab[data-tab="save"]').classList.add('active');
    presetTabContents.forEach(c=>{
      c.id === 'save-tab' ? c.classList.add('active') : c.classList.remove('active');
    });
    // initialize form defaults
    presetNameInput.value = '';
    presetDescInput.value = '';
    document.getElementById('preset-time-sig-numerator').textContent = beatsPerMeasure;
    document.getElementById('preset-time-sig-denominator').textContent = noteValue;
    presetSoundButtons.forEach(b => b.classList.remove('selected'));
    document.querySelector(`.preset-sound-button[data-sound="${selectedSound}"]`)?.classList.add('selected');
    renderPresetAccentPattern();
  });
}
// Close modal on close button
if (presetCloseBtn) {
  presetCloseBtn.addEventListener('click', () => {
    presetModal.classList.remove('visible');
  });
}

// --- Preset Modal Logic ---
async function fetchPresets() {
  const cached = getCachedPresets();
  if (cached) return cached;
  try {
    const token = await getToken();
    const res = await fetch('/api/metronomePresets', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load presets');
    const presets = await res.json();
    setCachedPresets(presets);
    return presets;
  } catch (e) {
    showAlert('Could not load presets.');
    return [];
  }
}

// Delete helper
async function deletePreset(id) {
  clearCachedPresets();
  if (!confirm('Are you sure you want to delete this preset?')) return;
  const token = await getToken();
  await fetch('/api/metronomePresets', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ presetId: id })
  });
  await loadAndDisplayPresets();
  await loadAndDisplayPagePresets();
}

// Open modal in edit mode
function openPresetEdit(preset) {
  // remember which preset is being edited
  currentEditingPresetId = preset.id;
  // hide Save footer and show Update footer
  saveTabButtons.style.display = 'none';
  editTabButtons.style.display = 'flex';
  presetModal.classList.add('visible');
  // switch to Save tab
  presetTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'save'));
  presetTabContents.forEach(c => c.classList.toggle('active', c.id === 'save-tab'));
  // fill form
  presetNameInput.value = preset.name;
  presetDescInput.value = preset.description;
  includeTempoCheck.checked = !!preset.settings.tempo;
  document.getElementById('tempo-control').style.display = includeTempoCheck.checked ? 'block':'none';
  // prefill time signature
  if (preset.settings.timeSignature) {
    includeTimeSignatureCheck.checked = true;
    document.getElementById('time-sig-control').style.display = 'block';
    timeSignatureNumerator.textContent = preset.settings.timeSignature[0];
    timeSignatureDenominator.textContent = preset.settings.timeSignature[1];
  }
  // prefill subdivision
  if (preset.settings.subdivision != null) {
    includeSubdivisionCheck.checked = true;
    document.getElementById('subdivision-control').style.display = 'block';
    document.getElementById('preset-subdivision-selector').value = preset.settings.subdivision;
  }
  // prefill accent pattern
  if (preset.settings.accentPattern) {
    includeAccentPatternCheck.checked = true;
    document.getElementById('accent-pattern-control').style.display = 'block';
    renderPresetAccentPattern(preset.settings.accentPattern);
  }
  // prefill sound
  if (preset.settings.sound) {
    includeSoundCheck.checked = true;
    document.getElementById('sound-control').style.display = 'block';
    presetSoundButtons.forEach(b=> b.classList.toggle('selected', b.dataset.sound===preset.settings.sound));
  }
  // prefill volume
  if (preset.settings.volume != null) {
    includeVolumeCheck.checked = true;
    document.getElementById('volume-control').style.display = 'block';
    document.getElementById('preset-volume-slider').value = preset.settings.volume * 100;
  }
  // prefill tempo
  if (preset.settings.tempo != null) {
    includeTempoCheck.checked = true;
    document.getElementById('tempo-control').style.display = 'block';
    document.getElementById('preset-tempo-value').value = preset.settings.tempo;
  }
  // prefill voice settings
  if (preset.settings.voice) {
    includeVoiceSettingsCheck.checked = true;
    document.getElementById('voice-settings-control').style.display = 'block';
    document.getElementById('preset-use-voice-counting').checked = preset.settings.voice.useVoiceCounting;
    document.getElementById('preset-use-click-subdivision').checked = preset.settings.voice.useClickSubdivision;
    document.getElementById('preset-voice-volume-slider').value = preset.settings.voice.voiceVolume * 100;
  }
  // show Update button, hide Save
  presetUpdateBtn.style.display = 'inline-block';
  presetCancelEditBtn.style.display = 'inline-block';
}

// Rename only
async function renamePreset(preset) {
  const newName = prompt('Enter new name:', preset.name);
  if (!newName) return;
  try {
    const token = await getToken();
    await fetch('/api/metronomePresets', { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ presetId: preset.id, name: newName, description: preset.description, settings: preset.settings }) });
    showAlert('Preset renamed',2000);
    await loadAndDisplayPresets();
    await loadAndDisplayPagePresets();
  } catch (_) { showAlert('Rename failed'); }
}

// Update full preset
async function updatePreset() {
  clearCachedPresets();
  const name = presetNameInput.value.trim();
  const description = presetDescInput.value.trim();
  if (!name) return showAlert('Preset name is required.');
  const settings = {};
  if (includeTempoCheck.checked) settings.tempo = parseInt(document.getElementById('preset-tempo-value').value);
  if (includeTimeSignatureCheck.checked) settings.timeSignature = [
    parseInt(document.getElementById('preset-time-sig-numerator').textContent),
    parseInt(document.getElementById('preset-time-sig-denominator').textContent)
  ];
  if (includeSubdivisionCheck.checked) settings.subdivision = parseInt(document.getElementById('preset-subdivision-selector').value);
  if (includeAccentPatternCheck.checked) settings.accentPattern = Array.from(document.querySelectorAll('#preset-accent-pattern .preset-accent-button')).map(b => b.dataset.state);
  if (includeSoundCheck.checked) settings.sound = document.querySelector('.preset-sound-button.selected')?.dataset.sound;
  if (includeVolumeCheck.checked) settings.volume = parseFloat(document.getElementById('preset-volume-slider').value)/100;
  if (includeVoiceSettingsCheck.checked) {
    settings.voice = {
      useVoiceCounting: document.getElementById('preset-use-voice-counting').checked,
      useClickSubdivision: document.getElementById('preset-use-click-subdivision').checked,
      voiceVolume: parseFloat(document.getElementById('preset-voice-volume-slider').value)/100
    };
  }
  try {
    const token = await getToken();
    const res = await fetch('/api/metronomePresets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ presetId: currentEditingPresetId, name, description, settings })
    });
    if (!res.ok) throw new Error('Update failed');
    showAlert('Preset updated!', 2000);
    presetModal.classList.remove('visible');
    await loadAndDisplayPresets();
    await loadAndDisplayPagePresets();
  } catch (e) {
    showAlert('Could not update preset.');
  }
}

// Wire up Update/Edit modal buttons
presetUpdateBtn.addEventListener('click', updatePreset);
// Cancel editing: hide modal, swap back to Save footer
presetCancelEditBtn.addEventListener('click', () => {
  presetModal.classList.remove('visible');
  editTabButtons.style.display = 'none';
  saveTabButtons.style.display = 'flex';
});

async function savePreset() {
  clearCachedPresets();
  const name = presetNameInput.value.trim();
  const description = presetDescInput.value.trim();
  if (!name) return showAlert('Preset name is required.');
  // Collect settings based on checked boxes
  const settings = {};
  if (includeTempoCheck.checked) settings.tempo = parseInt(document.getElementById('preset-tempo-value').value);
  if (includeTimeSignatureCheck.checked) settings.timeSignature = [
    parseInt(document.getElementById('preset-time-sig-numerator').textContent),
    parseInt(document.getElementById('preset-time-sig-denominator').textContent)
  ];
  if (includeSubdivisionCheck.checked) settings.subdivision = parseInt(document.getElementById('preset-subdivision-selector').value);
  if (includeAccentPatternCheck.checked) settings.accentPattern = Array.from(document.querySelectorAll('#preset-accent-pattern .preset-accent-button')).map(b => b.dataset.state);
  if (includeSoundCheck.checked) settings.sound = document.querySelector('.preset-sound-button.selected')?.dataset.sound;
  if (includeVolumeCheck.checked) settings.volume = parseFloat(document.getElementById('preset-volume-slider').value)/100;
  if (includeVoiceSettingsCheck.checked) {
    settings.voice = {
      useVoiceCounting: document.getElementById('preset-use-voice-counting').checked,
      useClickSubdivision: document.getElementById('preset-use-click-subdivision').checked,
      voiceVolume: parseFloat(document.getElementById('preset-voice-volume-slider').value)/100
    };
  }
  try {
    const token = await getToken();
    const res = await fetch('/api/metronomePresets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, description, settings })
    });
    if (!res.ok) {
      const data = await res.json();
      showAlert(data.message || 'Failed to save preset.');
      return;
    }
    showAlert('Preset saved!', 2000);
    presetModal.classList.remove('visible');
    await loadAndDisplayPresets();
    await loadAndDisplayPagePresets();
  } catch (e) {
    showAlert('Could not save preset.');
  }
}

async function loadAndDisplayPresets() {
  const presets = await fetchPresets();
  const grid = presetList;
  grid.innerHTML = '';
  if (!presets.length) {
    emptyPresets.style.display = 'block';
    return;
  }
  emptyPresets.style.display = 'none';
  presets.forEach(preset => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    const infoBtn = document.createElement('button');
    infoBtn.className = 'preset-button user-preset';
    infoBtn.innerHTML = `<div class='preset-tempo'>${preset.settings?.tempo || '--'} BPM</div><div class='preset-name'>${preset.name}</div>`;
    infoBtn.onclick = () => { applyPreset(preset); presetModal.classList.remove('visible'); };
    item.appendChild(infoBtn);
    const actions = document.createElement('div');
    actions.className = 'preset-item-actions';
    actions.style.display = 'flex';
    actions.style.justifyContent = 'center';
    actions.style.gap = '2rem';
    const editBtn = document.createElement('button');
    editBtn.className = 'preset-action-btn edit';
    editBtn.textContent = 'Edit';
    editBtn.style.minWidth = '100px';
    editBtn.style.padding = '0.5rem 1rem';
    editBtn.onclick = () => openPresetEdit(preset);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'preset-action-btn delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.minWidth = '100px';
    deleteBtn.style.padding = '0.5rem 1rem';
    deleteBtn.onclick = () => deletePreset(preset.id);
    [editBtn, deleteBtn].forEach(b => actions.appendChild(b));
    item.appendChild(actions);
    grid.appendChild(item);
  });
}

// Helper to apply a loaded preset immediately
function applyPreset(preset) {
  const s = preset.settings || {};
  if (s.tempo) updateTempo(s.tempo);
  if (s.timeSignature) {
    updateBeatsPerMeasure(s.timeSignature[0]);
    updateNoteValue(s.timeSignature[1]);
  }
  if (s.subdivision != null) {
    subdivision = s.subdivision;
    subdivisionSelector.value = subdivision;
    // trigger subdivision control update
    subdivisionSelector.onchange();
  }
  if (s.accentPattern) {
    updateAccentPattern(s.accentPattern);
    updateBeatLights();
    if (isPlaying) {
      restartPendulumLoop();
      if (metronomeProcessor) {
        const patterns = preset.settings.accentPattern;
        metronomeProcessor.port.postMessage({ type: 'update', beatPatterns: patterns });
      }
    }
  }
  if (s.sound) {
    selectedSound = s.sound;
    soundButtons.forEach(b => b.classList.remove('selected'));
    document.querySelector(`.sound-button[data-sound="${s.sound}"]`)?.classList.add('selected');
  }
  if (s.volume != null) {
    volume = s.volume;
    volumeSlider.value = volume * 100;
  }
  if (s.voice) {
    useVoiceCountingCheckbox.checked = s.voice.useVoiceCounting;
    useClickSubdivisionCheckbox.checked = s.voice.useClickSubdivision;
    voiceVolumeSlider.value = s.voice.voiceVolume * 100;
    voiceOptionsPanel.style.display = useVoiceCountingCheckbox.checked ? 'block' : 'none';
  }
  // only restart timing if core tempo or signature changed
  if (isPlaying && (s.tempo || s.timeSignature || s.subdivision != null)) restartMetronome();
}

// Build accent buttons inside the preset modal
function renderPresetAccentPattern(pattern = null) {
  const container = document.getElementById('preset-accent-pattern');
  const beats = parseInt(document.getElementById('preset-time-sig-numerator').textContent);
  container.innerHTML = '';
  for (let i = 0; i < beats; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-accent-button';
    btn.dataset.beat = i + 1;
    const state = pattern && pattern[i] ? pattern[i] : (i === 0 ? 'accent' : 'normal');
    btn.dataset.state = state;
    if (state === 'accent') btn.classList.add('accent');
    if (state === 'silent') btn.classList.add('silent');
    btn.innerHTML = `<span>${i + 1}</span>`;
    btn.onclick = () => {
      const s = btn.dataset.state;
      btn.dataset.state = s === 'normal' ? 'accent' : s === 'accent' ? 'silent' : 'normal';
      btn.classList.toggle('accent', btn.dataset.state === 'accent');
      btn.classList.toggle('silent', btn.dataset.state === 'silent');
    };
    container.appendChild(btn);
  }
}
// Preset modal control handlers
presetDecreaseBeats?.addEventListener('click', () => {
  const el = document.getElementById('preset-time-sig-numerator');
  let v = parseInt(el.textContent);
  if (v > 1) el.textContent = v - 1;
  renderPresetAccentPattern();
});
presetIncreaseBeats?.addEventListener('click', () => {
  const el = document.getElementById('preset-time-sig-numerator');
  let v = parseInt(el.textContent);
  if (v < 12) el.textContent = v + 1;
  renderPresetAccentPattern();
});
presetDecreaseNoteValue?.addEventListener('click', () => {
  const el = document.getElementById('preset-time-sig-denominator');
  const valid = [1,2,4,8,16,32];
  let v = parseInt(el.textContent);
  const idx = valid.indexOf(v);
  if (idx > 0) el.textContent = valid[idx - 1];
});
presetIncreaseNoteValue?.addEventListener('click', () => {
  const el = document.getElementById('preset-time-sig-denominator');
  const valid = [1,2,4,8,16,32];
  let v = parseInt(el.textContent);
  const idx = valid.indexOf(v);
  if (idx < valid.length - 1) el.textContent = valid[idx + 1];
});
// Close alert & confirm popups
alertConfirm?.addEventListener('click', () => alertModal.classList.remove('visible'));
confirmOk?.addEventListener('click', () => confirmModal.classList.remove('visible'));
confirmCancel?.addEventListener('click', () => confirmModal.classList.remove('visible'));
// Open the preset modal when the Manage Presets button is clicked
savePresetBtn.addEventListener('click', () => {
  presetModal.classList.add('visible');
  // always open Save tab
  presetTabs.forEach(t => t.classList.remove('active'));
  document.querySelector('.preset-tab[data-tab="save"]').classList.add('active');
  presetTabContents.forEach(c => c.id === 'save-tab' ? c.classList.add('active') : c.classList.remove('active'));
  // initialize form defaults
  presetNameInput.value = '';
  presetDescInput.value = '';
  document.getElementById('preset-time-sig-numerator').textContent = beatsPerMeasure;
  document.getElementById('preset-time-sig-denominator').textContent = noteValue;
  presetSoundButtons.forEach(b => b.classList.remove('selected'));
  document.querySelector(`.preset-sound-button[data-sound="${selectedSound}"]`)?.classList.add('selected');
  renderPresetAccentPattern();
});

// --- Preset modal interactivity ---
// Tab switching
presetTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    presetTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    presetTabContents.forEach(c => {
      if (c.id === tab.dataset.tab + '-tab') c.classList.add('active');
      else c.classList.remove('active');
    });
    if (tab.dataset.tab === 'load') loadAndDisplayPresets();
  });
});

// Sound type selection
presetSoundButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    presetSoundButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    presetModalSelectedSound = btn.dataset.sound;
  });
});

// Show/hide each control based on its checkbox
[  {chk: includeTempoCheck, ctrl: document.getElementById('tempo-control')},
   {chk: includeTimeSignatureCheck, ctrl: document.getElementById('time-sig-control')},
   {chk: includeSubdivisionCheck, ctrl: document.getElementById('subdivision-control')},
   {chk: includeAccentPatternCheck, ctrl: document.getElementById('accent-pattern-control')},
   {chk: includeSoundCheck, ctrl: document.getElementById('sound-control')},
   {chk: includeVolumeCheck, ctrl: document.getElementById('volume-control')},
   {chk: includeVoiceSettingsCheck, ctrl: document.getElementById('voice-settings-control')}
].forEach(({chk, ctrl}) => {
  ctrl.style.display = chk.checked ? 'block' : 'none';
  chk.addEventListener('change', () => {
    ctrl.style.display = chk.checked ? 'block' : 'none';
    if (chk === includeAccentPatternCheck) renderPresetAccentPattern();
  });
});

// Modal footer buttons
presetCancelBtn.addEventListener('click', () => presetModal.classList.remove('visible'));
presetCancelEditBtn.addEventListener('click', () => presetModal.classList.remove('visible'));
presetSaveBtn.addEventListener('click', event => {
  const activeTab = Array.from(presetTabs).find(t => t.classList.contains('active')).dataset.tab;
  if (activeTab === 'load') {
    // switch to Save tab
    presetTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'save'));
    presetTabContents.forEach(c => c.id === 'save-tab' ? c.classList.add('active') : c.classList.remove('active'));
    saveTabButtons.style.display = 'flex';
    editTabButtons.style.display = 'none';
    return;
  }
  savePreset();
});

async function loadAndDisplayPagePresets() {
  const presets = await fetchPresets();
  presetsGrid.innerHTML = '';
  if (!presets.length) return;
  presets.forEach(preset => {
    const btn = document.createElement('button');
    btn.className = 'preset-button user-preset';
    btn.innerHTML = `<div class='preset-tempo'>${preset.settings?.tempo || '--'} BPM</div><div class='preset-name'>${preset.name}</div><div class='preset-description'>${preset.description || ''}</div>`;
    btn.addEventListener('click', () => applyPreset(preset));
    presetsGrid.appendChild(btn);
  });
}
// initial page load
loadAndDisplayPagePresets();
} // leave this brace here to match the opening brace at the top