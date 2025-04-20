document.addEventListener('DOMContentLoaded', () => { initializeMetronomeUI(); });
function initializeMetronomeUI(){
const tempoSlider=document.getElementById('tempo-slider'),tempoDisplay=document.getElementById('tempo-display'),tempoDecreaseBtn=document.getElementById('tempo-decrease'),tempoIncreaseBtn=document.getElementById('tempo-increase'),tempoPlayBtn=document.getElementById('tempo-play'),decreaseBeatsBtn=document.querySelector('[data-action="decrease-beats"]'),increaseBeatsBtn=document.querySelector('[data-action="increase-beats"]'),decreaseNoteValueBtn=document.querySelector('[data-action="decrease-note-value"]'),increaseNoteValueBtn=document.querySelector('[data-action="increase-note-value"]'),timeSignatureNumerator=document.getElementById('time-sig-numerator'),timeSignatureDenominator=document.getElementById('time-sig-denominator'),accentPattern=document.getElementById('accent-pattern'),soundButtons=document.querySelectorAll('.sound-button'),volumeSlider=document.getElementById('volume-slider'),pendulum=document.querySelector('.tempo-pendulum'),subdivisionSelector=document.getElementById('subdivision-selector'),tapButton=document.getElementById('tap-tempo-button'),tapDisplay=document.getElementById('tap-tempo-display'),useVoiceCountingCheckbox=document.getElementById('use-voice-counting'),voiceOptionsPanel=document.querySelector('.voice-options-panel'),useClickSubdivisionCheckbox=document.getElementById('use-click-subdivision'),voiceVolumeSlider=document.getElementById('voice-volume-slider'),presetModal=document.getElementById('preset-modal'),presetTabs=document.querySelectorAll('.preset-tab'),presetTabContents=document.querySelectorAll('.preset-tab-content'),presetNameInput=document.getElementById('preset-name'),presetDescInput=document.getElementById('preset-description'),presetSaveBtn=document.getElementById('preset-save'),presetCancelBtn=document.getElementById('preset-cancel'),presetCloseBtn=document.getElementById('preset-close'),presetUpdateBtn=document.getElementById('preset-update'),presetCancelEditBtn=document.getElementById('preset-cancel-edit'),presetList=document.getElementById('preset-list'),emptyPresets=document.getElementById('empty-presets'),saveTabButtons=document.getElementById('save-tab-buttons'),editTabButtons=document.getElementById('edit-tab-buttons'),presetsGrid=document.getElementById('presets-grid'),presetForm=document.getElementById('preset-form'),includeTempoCheck=document.getElementById('include-tempo'),includeTimeSignatureCheck=document.getElementById('include-time-signature'),includeSubdivisionCheck=document.getElementById('include-subdivision'),includeAccentPatternCheck=document.getElementById('include-accent-pattern'),includeSoundCheck=document.getElementById('include-sound'),includeVolumeCheck=document.getElementById('include-volume'),includeVoiceSettingsCheck=document.getElementById('include-voice-settings'),presetDecreaseBeats=document.getElementById('preset-decrease-beats'),presetIncreaseBeats=document.getElementById('preset-increase-beats'),presetDecreaseNoteValue=document.getElementById('preset-decrease-note-value'),presetIncreaseNoteValue=document.getElementById('preset-increase-note-value'),presetSoundButtons=document.querySelectorAll('.preset-sound-button'),presetVolumeSlider=document.getElementById('preset-volume-slider'),presetVoiceVolumeSlider=document.getElementById('preset-voice-volume-slider'),alertModal=document.getElementById('alert-modal'),alertMessage=document.getElementById('alert-message'),alertConfirm=document.getElementById('alert-confirm'),confirmModal=document.getElementById('confirm-modal'),confirmMessage=document.getElementById('confirm-message'),confirmOk=document.getElementById('confirm-ok'),confirmCancel=document.getElementById('confirm-cancel');
soundButtons.forEach(b=>{if(b.tagName==='BUTTON'){b.type='button';b.onclick=e=>{e.preventDefault();e.stopPropagation();soundButtons.forEach(x=>x.classList.remove('selected'));b.classList.add('selected');selectedSound=b.dataset.sound}}});
presetSoundButtons.forEach(b=>{if(b.tagName==='BUTTON')b.type='button'});
let isPlaying=false,currentTempo=parseInt(tempoDisplay.value),beatsPerMeasure=parseInt(timeSignatureNumerator.textContent),noteValue=parseInt(timeSignatureDenominator.textContent),subdivision=parseInt(subdivisionSelector.value),currentBeat=0,pendulumAngle=0,selectedSound='click',volume=parseFloat(volumeSlider.value)/100*1.5,audioContext=null,audioWorkletNode=null,metronomeProcessor=null,tempoDebounceTimeout=null,sounds={click:{hi:null,lo:null},glassTick:{hi:null,lo:null},bell:{hi:null,lo:null}},useVoiceCounting=false,selectedVoice='male',useClickSubdivision=false,voiceVolume=parseFloat(voiceVolumeSlider.value)/100*1.5,voiceSounds={male:{numbers:{},subdivisions:{}}},pendulumRaf=null,metronomeStartTime=0,constValid=[1,2,4,8,16,32],tapTimes=[],tapTimeout=null,currentEditingPresetId=null,presetModalSelectedSound=selectedSound,overlayPointerDown=false,wakeLock=null,audioContextStartTime=0,beatLookAhead=0.2,lateNoteScheduleThreshold=0.01,scheduledBeats=new Map(),droppedNoteCount=0,perfectNoteCount=0,schedulerId=null,lookaheadMs=25,nextNoteTime=0,currentSub=0,scheduleAheadTime=0.1,scheduledVisuals=[],lastVisualCheck=0;
function createSimpleLoggingContainer(){const container=document.createElement('div');container.id='metronome-log-container';container.style.cssText='margin-top:50px;padding:20px;border-top:2px solid #444;background-color:#f5f5f5;';const heading=document.createElement('h3');heading.textContent='Metronome Timing Log';heading.style.cssText='margin:0 0 10px 0;';const toggleBtn=document.createElement('button');toggleBtn.id='log-toggle-btn';toggleBtn.textContent='Start Logging';toggleBtn.style.cssText='margin-bottom:10px;padding:5px 10px;';toggleBtn.onclick=toggleDesyncLogging;const logContent=document.createElement('div');logContent.id='metronome-log-content';container.appendChild(heading);container.appendChild(toggleBtn);container.appendChild(logContent);document.body.appendChild(container);return container}
const logContainer=createSimpleLoggingContainer();
const desyncLogging={enabled:false,beatInterval:0,expectedBeats:[],actualBeats:[],desyncs:[],maxDesync:0,totalDesync:0,beatCount:0,logFrequency:10,startTime:null,subdivisionDesync:false,jitterValues:[],audioLatency:0,initialize(interval){this.beatInterval=interval;this.expectedBeats=[];this.actualBeats=[];this.desyncs=[];this.maxDesync=0;this.totalDesync=0;this.beatCount=0;this.startTime=null;this.log(`Metronome logging initialized: ${currentTempo} BPM, ${beatsPerMeasure}/${noteValue}, subdivision: ${subdivision}`,'heading')},log(message,type='normal'){const logContent=document.getElementById('metronome-log-content');if(!logContent)return;const entry=document.createElement('p');entry.textContent=message;entry.style.margin='3px 0';switch(type){case'heading':entry.style.fontWeight='bold';entry.style.color='#4CAF50';entry.style.fontSize='16px';break;case'error':entry.style.fontWeight='bold';entry.style.color='#F44336';break;case'stat':entry.style.color='#2196F3';entry.style.marginLeft='20px';break;case'warning':entry.style.color='#FF9800';break;default:entry.style.color='#333'}logContent.appendChild(entry);window.scrollTo(0,document.body.scrollHeight)},logBeat(isSubdivision=false){if(!this.enabled)return;if(isSubdivision&&!this.subdivisionDesync)return;if(!audioContext) return;const now = audioContext.currentTime * 1000;let expectedTime;if(this.expectedBeats.length===0){this.startTime=now;expectedTime=this.startTime}else expectedTime=this.startTime+this.beatCount*this.beatInterval;const desync=Math.round(now-expectedTime);this.expectedBeats.push(expectedTime);this.actualBeats.push(now);this.desyncs.push(desync);this.totalDesync+=Math.abs(desync);this.maxDesync=Math.max(this.maxDesync,Math.abs(desync));this.beatCount++;const desyncColor=Math.abs(desync)>5?'warning':'normal';this.log(`Beat ${this.beatCount}: desync = ${desync}ms ${isSubdivision?'(subdivision)':''}`,desyncColor);if(this.beatCount%this.logFrequency===0)this.logStats()},logStats(){if(!this.enabled||this.beatCount===0)return;const avgDesync=Math.round(this.totalDesync/this.beatCount);this.log('Metronome Timing Stats:','heading');this.log(`Beats tracked: ${this.beatCount}`,'stat');this.log(`Average desync: ${avgDesync}ms`,'stat');this.log(`Max desync: ${this.maxDesync}ms`,'stat');if(this.desyncs.length>1){const jitter=this.calculateJitter();this.log(`Timing jitter: ${Math.round(jitter)}ms`,'stat')}if(audioContext&&this.beatCount>10){if(audioContext.outputLatency){this.audioLatency=audioContext.outputLatency;this.log(`Audio output latency: ${(this.audioLatency*1000).toFixed(2)}ms`,'stat')}this.log(`Audio hardware: ${audioContext.sampleRate}Hz`,'stat');if(metronomeProcessor){this.log('Using AudioWorklet for high precision timing','stat')}else{this.log('Using setInterval fallback (less precise)','warning')}}},calculateJitter(){const mean=this.totalDesync/this.desyncs.length;const squareDiffs=this.desyncs.map(desync=>{const diff=Math.abs(desync)-mean;return diff*diff});const variance=squareDiffs.reduce((sum,squareDiff)=>sum+squareDiff,0)/this.desyncs.length;return Math.sqrt(variance)},reset(){if(this.beatCount>0){this.logStats();this.log('Metronome logging reset','heading')}document.getElementById('metronome-log-content').innerHTML='';this.initialize(this.beatInterval)},startLogging(){document.getElementById('log-toggle-btn').textContent='Stop Logging';document.getElementById('log-toggle-btn').style.backgroundColor='#F44336';document.getElementById('log-toggle-btn').style.color='white'},stopLogging(){document.getElementById('log-toggle-btn').textContent='Start Logging';document.getElementById('log-toggle-btn').style.backgroundColor='';document.getElementById('log-toggle-btn').style.color=''}};
const PRESET_CACHE_MS=2e4;
async function requestWakeLock(){try{if('wakeLock'in navigator){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{if(isPlaying)requestWakeLock()})}}catch(e){}}
function releaseWakeLock(){if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null}}
async function initAudio(){try{audioContext=new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive',sampleRate:48000});await loadSounds();await loadVoiceSounds();await initAudioWorklet()}catch(e){console.error('Audio initialization error:',e);showAlert('Error initializing audio system. Some features may not work correctly.')}}
async function initAudioWorklet(){if(!audioContext)return;try{if(!audioContext.audioWorklet){console.warn('AudioWorklet not supported in this browser');return}await audioContext.audioWorklet.addModule('/tools/js/metronome-processor.js');metronomeProcessor=new AudioWorkletNode(audioContext,'metronome-processor',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1],processorOptions:{beatsPerMeasure:beatsPerMeasure,subdivision:subdivision}});metronomeProcessor.port.onmessage=handleWorkletMessage;metronomeProcessor.connect(audioContext.destination);console.log('AudioWorklet initialized successfully')}catch(e){console.error('AudioWorklet initialization failed:',e);console.warn('Falling back to setInterval-based scheduling')}}
function handleWorkletMessage(event){
  if(!isPlaying)return;
  const data=event.data;
  if(data.type==='batch'){
    data.events.forEach(event=>{
      // Use raw AudioWorklet time with no latency adjustment
      const scheduledTime = event.time;
      const now = audioContext.currentTime;
      
      if(scheduledTime < now + lateNoteScheduleThreshold) {
        droppedNoteCount++;
        playTickSound(event); // Immediate playback
      } else {
        perfectNoteCount++;
        playTickSound(event, scheduledTime); // Use precise scheduled time
      }
      
      // Schedule visuals based on audio time
      scheduleVisual(() => {
        if(event.isMainBeat){
          updateVisualBeat(event.beatInMeasure);
          desyncLogging.logBeat(false);
        }else if(event.subBeat>0){
          desyncLogging.logBeat(true);
        }
      }, scheduledTime);
    });
  }
}
const scheduledSources=new Map();
function playSound(accent,atTime=null){if(!audioContext||!sounds[selectedSound])return;const buffer=accent?sounds[selectedSound].hi:sounds[selectedSound].lo;const source=audioContext.createBufferSource();const gainNode=audioContext.createGain();source.buffer=buffer;gainNode.gain.value=volume;source.connect(gainNode);gainNode.connect(audioContext.destination);const minTime = atTime !== null ? Math.max(atTime, audioContext.currentTime) : audioContext.currentTime;source.start(minTime);scheduledSources.set(minTime,{source,gainNode});setTimeout(()=>{scheduledSources.delete(minTime)},(minTime-audioContext.currentTime)*1000+1000)}
function playVoiceSound(n,atTime=null){
  if(!audioContext||!voiceSounds[selectedVoice].numbers[n])return;
  const s=audioContext.createBufferSource(),g=audioContext.createGain();
  s.buffer=voiceSounds[selectedVoice].numbers[n];
  g.gain.value=voiceVolume*(n==='2'?0.9:1);
  s.connect(g);
  g.connect(audioContext.destination);
  // No artificial padding - use scheduled time directly
  const minTime = atTime !== null ? Math.max(atTime, audioContext.currentTime) : audioContext.currentTime;
  s.start(minTime);
}
function playVoiceSubdivision(t,atTime=null){
  if(!audioContext||!voiceSounds[selectedVoice].subdivisions[t])return;
  const s=audioContext.createBufferSource(),g=audioContext.createGain();
  g.gain.value=voiceVolume*(t==='and'?0.64:0.8);
  s.buffer=voiceSounds[selectedVoice].subdivisions[t];
  s.connect(g);
  g.connect(audioContext.destination);
  // No artificial padding - use scheduled time directly
  const minTime = atTime !== null ? Math.max(atTime, audioContext.currentTime) : audioContext.currentTime;
  s.start(minTime);
}
function playSubdivisionSound(p,atTime=null){if(useVoiceCounting&&!useClickSubdivision){let s=null;if(subdivision===2)s='and';else if(subdivision===3){if(p===1)s='trip';else if(p===2)s='let'}else if(subdivision===4){if(p===1)s='e';else if(p===2)s='and';else if(p===3)s='a'}if(s){playVoiceSubdivision(s,atTime);return}}if(!audioContext||!sounds[selectedSound])return;const b=audioContext.createBufferSource(),g=audioContext.createGain();b.buffer=sounds[selectedSound].lo;if(!b.buffer)return;g.gain.value=volume*0.6;b.connect(g);g.connect(audioContext.destination);b.start(atTime??0)}
function checkScheduledVisuals(){const now=audioContext?.currentTime||performance.now()/1000;for(let i=scheduledVisuals.length-1;i>=0;i--){if(now>=scheduledVisuals[i].time){scheduledVisuals[i].callback();scheduledVisuals.splice(i,1)}}requestAnimationFrame(checkScheduledVisuals)}
function scheduleVisual(cb,time){const visualTime = time; // Use audio context timing directly
  scheduledVisuals.push({time:visualTime,callback:cb})}
checkScheduledVisuals();
function tempoToSliderPosition(t){const m=10,x=1000,l=Math.log(m),M=Math.log(x);return 100/(M-l)*(Math.log(t)-l)}
function sliderPositionToTempo(p){const m=10,x=1000,l=Math.log(m),M=Math.log(x);return Math.round(Math.exp(l+p*(M-l)/100))}
function updateTempo(v){let n=parseInt(v);if(isNaN(n)||n<=0)n=10;currentTempo=Math.min(Math.max(n,10),1000);tempoDisplay.value=currentTempo;tempoSlider.value=tempoToSliderPosition(currentTempo);if(isPlaying){clearTimeout(tempoDebounceTimeout);if(metronomeProcessor){tempoDebounceTimeout=setTimeout(()=>{const beatIntervalSec=(60/currentTempo)*(4/noteValue);const subIntervalSec=subdivision>1?beatIntervalSec/subdivision:beatIntervalSec;metronomeProcessor.port.postMessage({type:'update',interval:subIntervalSec,tempo:currentTempo})},150)}else{tempoDebounceTimeout=setTimeout(restartMetronome,150)}}}
function updateBeatsPerMeasure(v){beatsPerMeasure=Math.min(Math.max(v,1),12);timeSignatureNumerator.textContent=beatsPerMeasure;updateAccentPattern();updateBeatLights();if(isPlaying)restartMetronome()}
function updateAccentPattern(p=null){accentPattern.innerHTML='';for(let i=0;i<beatsPerMeasure;i++){let s='normal';if(p&&i<p.length)s=p[i];else if(noteValue===8&&(beatsPerMeasure===6||beatsPerMeasure===9||beatsPerMeasure===12)?i%3===0:i===0)s='accent';const b=document.createElement('button');b.className='accent-button';b.dataset.beat=i+1;b.dataset.state=s;b.type='button';if(s==='accent')b.classList.add('accent');else if(s==='silent')b.classList.add('silent');b.innerHTML=`<span>${i+1}</span>`;b.onclick=()=>{const c=b.dataset.state;b.dataset.state=c==='normal'?'accent':c==='accent'?'silent':'normal';b.classList.toggle('accent',b.dataset.state==='accent');b.classList.toggle('silent',b.dataset.state==='silent');updateBeatLights()};accentPattern.appendChild(b)}updateBeatLights()}
function updateBeatLights(){const c=document.querySelector('.beat-lights');c.innerHTML='';for(let i=0;i<beatsPerMeasure;i++){const a=document.querySelector(`.accent-button[data-beat="${i+1}"]`),s=document.createElement('div');s.className='beat-light';const st=a?a.dataset.state:'normal';if(st==='accent')s.classList.add('accent');else if(st==='silent')s.classList.add('silent');s.dataset.beat=i+1;c.appendChild(s)}}
function updateNoteValue(v){if(constValid.includes(v)){noteValue=v;timeSignatureDenominator.textContent=noteValue;updateAccentPattern();updateBeatLights();if(isPlaying)restartMetronome()}}
function updateVisualBeat(i){document.querySelectorAll('.beat-light').forEach(l=>l.classList.remove('active'));const b=document.querySelector(`.beat-light[data-beat="${i+1}"]`);if(b)b.classList.add('active')}
function animatePendulum(intervalMs){if(!audioContext)return;const intervalSec=intervalMs/1000;const audioTime=audioContext.currentTime-audioContextStartTime;const progress=(audioTime%intervalSec)/intervalSec;const direction=Math.floor(audioTime/intervalSec)%2===0?1:-1;pendulumAngle=Math.sin(progress*Math.PI)*0.392699*direction;pendulum.style.transform=`rotate(${pendulumAngle}rad) translate3d(0,0,0)`;pendulumRaf=requestAnimationFrame(()=>animatePendulum(intervalMs))}
async function startMetronome(){
  if(isPlaying)return;
  isPlaying=true;
  if(audioContext===null)await initAudio();
  else if(audioContext.state==='suspended')await audioContext.resume();
  await requestWakeLock();
  currentBeat=0;
  pendulum.style.transform='rotate(0rad)';
  // Use audio context time exclusively for audio timing
  audioContextStartTime=audioContext.currentTime;
  metronomeStartTime=audioContextStartTime * 1000; // Convert to ms for legacy code
  tempoPlayBtn.innerHTML='<svg width="24" height="24"><path d="M6 19h4V5H6zm8-14v14h4V5z" fill="currentColor"/></svg>';
  
  const beatIntervalSec=(60/currentTempo)*(4/noteValue);
  const subIntervalSec=subdivision>1?beatIntervalSec/subdivision:beatIntervalSec;
  const beatIntervalMs=beatIntervalSec*1000;
  
  // Initialize logging with precise interval
  desyncLogging.initialize(subIntervalSec*1000);
  
  // Set next note time with a small delay for initialization
  nextNoteTime=audioContext.currentTime+0.05;
  currentSub=0;
  
  // ...existing code...
  if(pendulumRaf)cancelAnimationFrame(pendulumRaf);animatePendulum(beatIntervalMs);const accentPatterns=[];document.querySelectorAll('.accent-button').forEach(btn=>{accentPatterns.push(btn.dataset.state||'normal')});if(metronomeProcessor){metronomeProcessor.port.postMessage({type:'start',interval:subIntervalSec,tempo:currentTempo,beatsPerMeasure:beatsPerMeasure,subdivision:subdivision,beatPatterns:accentPatterns})}else{nextNoteTime=audioContext.currentTime+0.05;currentSub=0;schedulerId=setInterval(()=>scheduler(subIntervalSec),lookaheadMs)}droppedNoteCount=0;perfectNoteCount=0;console.log(`Metronome started: ${currentTempo} BPM, ${beatsPerMeasure}/${noteValue}, subdivision: ${subdivision}`);console.log(`Audio context: sampleRate=${audioContext.sampleRate}, baseLatency=${audioContext.baseLatency||'unknown'}, outputLatency=${audioContext.outputLatency||'unknown'}`)}
function stopMetronome(){isPlaying=false;releaseWakeLock();if(metronomeProcessor){metronomeProcessor.port.postMessage({type:'stop'})}if(schedulerId){clearInterval(schedulerId);schedulerId=null}if(pendulumRaf){cancelAnimationFrame(pendulumRaf);pendulumRaf=null}pendulumAngle=0;pendulum.style.transition='transform 0.5s ease-out';pendulum.style.transform='rotate(0rad)';tempoPlayBtn.innerHTML='<svg width="24" height="24"><path d="M8 5V19L19 12Z" fill="currentColor"/></svg>';document.querySelectorAll('.beat-light').forEach(l=>l.classList.remove('active'));if(desyncLogging.enabled&&desyncLogging.beatCount>0){desyncLogging.log('Metronome Stopped - Final Stats:','error');desyncLogging.logStats();if(metronomeProcessor){const totalBeats=perfectNoteCount+droppedNoteCount;if(totalBeats>0){const percentPerfect=(perfectNoteCount/totalBeats*100).toFixed(2);desyncLogging.log('AudioWorklet timing stats:','heading');desyncLogging.log(`Perfect timing: ${perfectNoteCount} beats (${percentPerfect}%)`,'stat');desyncLogging.log(`Late scheduling: ${droppedNoteCount} beats (${(100-percentPerfect).toFixed(2)}%)`,'stat')}}}scheduledBeats.clear();}
function restartMetronome(){if(isPlaying){stopMetronome();startMetronome()}}
if(subdivisionSelector)subdivisionSelector.onchange=()=>{subdivision=parseInt(subdivisionSelector.value);if(isPlaying)restartMetronome()}
tempoSlider.value=tempoToSliderPosition(currentTempo);tempoSlider.oninput=()=>updateTempo(sliderPositionToTempo(parseFloat(tempoSlider.value)));
tempoDisplay.onchange=tempoDisplay.onblur=()=>updateTempo(tempoDisplay.value)
tempoDecreaseBtn.onclick=()=>updateTempo(currentTempo-1);tempoIncreaseBtn.onclick=()=>updateTempo(currentTempo+1);tempoPlayBtn.onclick=()=>isPlaying?stopMetronome():startMetronome()
decreaseBeatsBtn.onclick=()=>updateBeatsPerMeasure(beatsPerMeasure-1);increaseBeatsBtn.onclick=()=>updateBeatsPerMeasure(beatsPerMeasure+1)
decreaseNoteValueBtn.onclick=()=>{const i=constValid.indexOf(noteValue);if(i>0)updateNoteValue(constValid[i-1])}
increaseNoteValueBtn.onclick=()=>{const i=constValid.indexOf(noteValue);if(i<constValid.length-1)updateNoteValue(constValid[i+1])}
volumeSlider.oninput=()=>{volume=parseFloat(volumeSlider.value)/100*1.5}
const mainSavePresetBtn=document.getElementById('save-preset');if(mainSavePresetBtn)mainSavePresetBtn.onclick=()=>{const s=document.querySelector('.preset-tab[data-tab="save"]'),c=document.getElementById('save-tab');presetModal.classList.add('visible');presetTabs.forEach(t=>t.classList.remove('active'));presetTabContents.forEach(t=>t.classList.remove('active'));s.classList.add('active');c.classList.add('active');resetPresetForm();initializePresetControls();if(includeAccentPatternCheck.checked)updatePresetAccentPattern()}
if(tapButton)tapButton.onclick=()=>{const n=Date.now();tapButton.classList.add('tapped');setTimeout(()=>tapButton.classList.remove('tapped'),200);if(tapTimes.length&&n-tapTimes[tapTimes.length-1]>2000)tapTimes=[];tapTimes.push(n);clearTimeout(tapTimeout);tapTimeout=setTimeout(()=>{tapTimes=[];tapDisplay.textContent='-- BPM'},2000);if(tapTimes.length>=2){const a=tapTimes.slice(1).map((t,i)=>t-tapTimes[i]),b=Math.round(60000/(a.reduce((p,c)=>p+c,0)/a.length));tapDisplay.textContent=b+' BPM';updateTempo(b)}}
useVoiceCountingCheckbox.onchange=()=>{useVoiceCounting=useVoiceCountingCheckbox.checked;if(voiceOptionsPanel)voiceOptionsPanel.style.display=useVoiceCounting?'block':'none';if(isPlaying)restartMetronome()}
useClickSubdivisionCheckbox.onchange=()=>{useClickSubdivision=useClickSubdivisionCheckbox.checked;if(isPlaying)restartMetronome()}
voiceVolumeSlider.oninput=()=>{voiceVolume=parseFloat(voiceVolumeSlider.value)/100*1.5}
document.querySelectorAll('.preset-button:not(.user-preset)').forEach(b=>{if(b.tagName==='BUTTON')b.type='button';b.onclick=()=>{const t=parseInt(b.dataset.tempo);if(!isNaN(t))updateTempo(t);if(b.dataset.beats)updateBeatsPerMeasure(parseInt(b.dataset.beats));if(b.dataset.noteValue)updateNoteValue(parseInt(b.dataset.noteValue));if(isPlaying)restartMetronome()}})
updateAccentPattern();updateBeatLights()
window.addEventListener('pointerdown',e=>{overlayPointerDown=e.target===presetModal})
window.addEventListener('click',e=>{if(e.target===presetModal&&overlayPointerDown){presetModal.classList.remove('visible');resetPresetForm()}overlayPointerDown=false})
window.onkeydown=e=>{const a=document.activeElement,f=a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT');if(e.code==='Space'&&!f){e.preventDefault();isPlaying?stopMetronome():startMetronome()}if(e.code==='Enter'){if(a===tempoDisplay){tempoDisplay.blur();e.preventDefault()}else if(!f){tempoDisplay.focus();tempoDisplay.select();e.preventDefault()}}if(!f){let s=e.shiftKey&&e.ctrlKey?20:e.ctrlKey?10:e.shiftKey?5:1;if(e.code==='ArrowUp'||e.code==='ArrowRight'){e.preventDefault();updateTempo(currentTempo+s)}if(e.code==='ArrowDown'||e.code==='ArrowLeft'){e.preventDefault();updateTempo(currentTempo-s)}if(e.ctrlKey&&e.altKey&&e.code==='KeyL'){e.preventDefault();toggleDesyncLogging()}if(e.ctrlKey&&e.altKey&&e.code==='KeyS'){e.preventDefault();desyncLogging.subdivisionDesync=!desyncLogging.subdivisionDesync;desyncLogging.log(`Subdivision desync logging ${desyncLogging.subdivisionDesync?'enabled':'disabled'}`,desyncLogging.subdivisionDesync?'heading':'error')}}}
function toggleDesyncLogging(){desyncLogging.enabled=!desyncLogging.enabled;if(desyncLogging.enabled){desyncLogging.startLogging();desyncLogging.log('Metronome timing logging enabled','heading');desyncLogging.log(`Current settings: ${currentTempo} BPM, ${beatsPerMeasure}/${noteValue}, subdivision: ${subdivision}`,'stat');if(isPlaying)desyncLogging.reset()}else{desyncLogging.log('Metronome timing logging disabled','error');desyncLogging.stopLogging()}}
function showAlert(message,duration=5000){if(!alertModal||!alertMessage)return;alertMessage.textContent=message;alertModal.classList.add('visible');setTimeout(()=>{alertModal.classList.remove('visible')},duration)}
async function renderUserPresets(){try{const presets=await fetchUserPresets();if(!presetList)return;presetList.innerHTML='';if(presets.length===0){if(emptyPresets)emptyPresets.style.display='block';return}if(emptyPresets)emptyPresets.style.display='none';presets.forEach(preset=>{const item=document.createElement('div');item.className='preset-item';item.dataset.id=preset.id;const name=document.createElement('h4');name.textContent=preset.name;const desc=document.createElement('p');desc.textContent=preset.description||'No description';const actions=document.createElement('div');actions.className='preset-actions';const loadBtn=document.createElement('button');loadBtn.textContent='Load';loadBtn.type='button';loadBtn.onclick=()=>loadPreset(preset);const editBtn=document.createElement('button');editBtn.textContent='Edit';editBtn.type='button';editBtn.onclick=()=>editPreset(preset);const deleteBtn=document.createElement('button');deleteBtn.textContent='Delete';deleteBtn.type='button';deleteBtn.onclick=()=>confirmDeletePreset(preset.id);actions.appendChild(loadBtn);actions.appendChild(editBtn);actions.appendChild(deleteBtn);item.appendChild(name);item.appendChild(desc);item.appendChild(actions);presetList.appendChild(item)})}catch(error){console.error('Failed to render presets:',error);showAlert('Failed to load your presets. Please try again later.')}}
async function loadUserPresetsToGrid(){if(!presetsGrid)return;try{const presets=await fetchUserPresets();const existingPresets=presetsGrid.querySelectorAll('.user-preset');existingPresets.forEach(preset=>preset.remove());if(presets.length===0)return;presets.forEach(preset=>{const btn=document.createElement('button');btn.className='preset-button user-preset';btn.textContent=preset.name;btn.type='button';btn.dataset.id=preset.id;if(preset.settings){if(preset.settings.tempo)btn.dataset.tempo=preset.settings.tempo;if(preset.settings.beatsPerMeasure)btn.dataset.beats=preset.settings.beatsPerMeasure;if(preset.settings.noteValue)btn.dataset.noteValue=preset.settings.noteValue}btn.onclick=()=>loadPreset(preset);presetsGrid.appendChild(btn)})}catch(error){console.error('Failed to load presets to grid:',error)}}
function loadPreset(preset){if(!preset.settings)return;const s=preset.settings;if(s.tempo)updateTempo(parseInt(s.tempo));if(s.beatsPerMeasure)updateBeatsPerMeasure(parseInt(s.beatsPerMeasure));if(s.noteValue)updateNoteValue(parseInt(s.noteValue));if(s.subdivision&&subdivisionSelector){subdivisionSelector.value=s.subdivision;subdivision=parseInt(s.subdivision)}if(s.accentPattern)updateAccentPattern(s.accentPattern);if(s.sound){selectedSound=s.sound;soundButtons.forEach(btn=>{btn.classList.toggle('selected',btn.dataset.sound===s.sound)})}if(s.volume!==undefined){volume=parseFloat(s.volume);if(volumeSlider)volumeSlider.value=Math.round(volume/1.5*100)}if(s.voiceSettings){if(s.voiceSettings.useVoice!==undefined&&useVoiceCountingCheckbox){useVoiceCountingCheckbox.checked=s.voiceSettings.useVoice;useVoiceCounting=s.voiceSettings.useVoice;if(voiceOptionsPanel){voiceOptionsPanel.style.display=useVoiceCounting?'block':'none'}}if(s.voiceSettings.useClickSubdivision!==undefined&&useClickSubdivisionCheckbox){useClickSubdivisionCheckbox.checked=s.voiceSettings.useClickSubdivision;useClickSubdivision=s.voiceSettings.useClickSubdivision}if(s.voiceSettings.voiceVolume!==undefined&&voiceVolumeSlider){voiceVolume=parseFloat(s.voiceSettings.voiceVolume);voiceVolumeSlider.value=Math.round(voiceVolume/1.5*100)}}if(isPlaying)restartMetronome();showAlert(`Preset "${preset.name}" loaded successfully.`)}
function editPreset(preset){if(!presetModal)return;currentEditingPresetId=preset.id;const saveTab=document.querySelector('.preset-tab[data-tab="save"]');const saveTabContent=document.getElementById('save-tab');if(saveTab)saveTab.classList.add('active');if(saveTabContent)saveTabContent.classList.add('active');if(saveTabButtons)saveTabButtons.style.display='none';if(editTabButtons)editTabButtons.style.display='flex';if(presetNameInput)presetNameInput.value=preset.name;if(presetDescInput)presetDescInput.value=preset.description||'';initializePresetControls(preset.settings);presetModal.classList.add('visible')}
function confirmDeletePreset(id){if(!confirmModal||!confirmMessage||!confirmOk||!confirmCancel)return;confirmMessage.textContent='Are you sure you want to delete this preset? This action cannot be undone.';confirmModal.classList.add('visible');const handleConfirm=async()=>{try{await deletePresetFromBackend(id);showAlert('Preset deleted successfully.');renderUserPresets();loadUserPresetsToGrid()}catch(error){console.error('Failed to delete preset:',error);showAlert('Failed to delete preset. Please try again later.')}finally{confirmModal.classList.remove('visible');confirmOk.removeEventListener('click',handleConfirm);confirmCancel.removeEventListener('click',handleCancel)}};const handleCancel=()=>{confirmModal.classList.remove('visible');confirmOk.removeEventListener('click',handleConfirm);confirmCancel.removeEventListener('click',handleCancel)};confirmOk.addEventListener('click',handleConfirm);confirmCancel.addEventListener('click',handleCancel)}
function initializePresetControls(settings=null){if(presetDecreaseBeats&&presetIncreaseBeats){let beats=beatsPerMeasure;if(settings&&settings.beatsPerMeasure)beats=settings.beatsPerMeasure;document.getElementById('preset-time-sig-numerator').textContent=beats;presetDecreaseBeats.onclick=()=>{beats=Math.max(1,beats-1);document.getElementById('preset-time-sig-numerator').textContent=beats;updatePresetAccentPattern()};presetIncreaseBeats.onclick=()=>{beats=Math.min(12,beats+1);document.getElementById('preset-time-sig-numerator').textContent=beats;updatePresetAccentPattern()}}if(presetDecreaseNoteValue&&presetIncreaseNoteValue){let noteVal=noteValue;if(settings&&settings.noteValue)noteVal=settings.noteValue;document.getElementById('preset-time-sig-denominator').textContent=noteVal;presetDecreaseNoteValue.onclick=()=>{const idx=constValid.indexOf(noteVal);if(idx>0){noteVal=constValid[idx-1];document.getElementById('preset-time-sig-denominator').textContent=noteVal}};presetIncreaseNoteValue.onclick=()=>{const idx=constValid.indexOf(noteVal);if(idx<constValid.length-1){noteVal=constValid[idx+1];document.getElementById('preset-time-sig-denominator').textContent=noteVal}}}presetSoundButtons.forEach(btn=>{if(btn.tagName==='BUTTON'){btn.onclick=e=>{e.preventDefault();e.stopPropagation();presetSoundButtons.forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');presetModalSelectedSound=btn.dataset.sound};if(settings&&settings.sound&&btn.dataset.sound===settings.sound){btn.classList.add('selected');presetModalSelectedSound=settings.sound}}});if(presetVolumeSlider&&settings&&settings.volume!==undefined){presetVolumeSlider.value=Math.round(settings.volume/1.5*100)}if(presetVoiceVolumeSlider&&settings&&settings.voiceSettings&&settings.voiceSettings.voiceVolume!==undefined){presetVoiceVolumeSlider.value=Math.round(settings.voiceSettings.voiceVolume/1.5*100)}updatePresetAccentPattern()}
function updatePresetAccentPattern(){const presetAccentPattern=document.getElementById('preset-accent-pattern');if(!presetAccentPattern)return;const beats=parseInt(document.getElementById('preset-time-sig-numerator').textContent);const noteVal=parseInt(document.getElementById('preset-time-sig-denominator').textContent);presetAccentPattern.innerHTML='';for(let i=0;i<beats;i++){let state='normal';if(noteVal===8&&(beats===6||beats===9||beats===12)?i%3===0:i===0){state='accent'}const btn=document.createElement('button');btn.className='accent-button';btn.dataset.beat=i+1;btn.dataset.state=state;btn.type='button';if(state==='accent')btn.classList.add('accent');else if(state==='silent')btn.classList.add('silent');btn.innerHTML=`<span>${i+1}</span>`;btn.onclick=()=>{const currentState=btn.dataset.state;btn.dataset.state=currentState==='normal'?'accent':currentState==='accent'?'silent':'normal';btn.classList.toggle('accent',btn.dataset.state==='accent');btn.classList.toggle('silent',btn.dataset.state==='silent')};presetAccentPattern.appendChild(btn)}}
async function getAuthToken(){if(window.auth0Client&&window.auth0Client.getTokenSilently)return await window.auth0Client.getTokenSilently();if(window.getToken)return await window.getToken();return null}
async function fetchUserPresets(){const t=await getAuthToken();if(!t)return[];const r=await fetch('/api/metronomePresets',{headers:{Authorization:`Bearer ${t}`}});return r.ok?await r.json():[]}
async function savePresetToBackend(p){const t=await getAuthToken();if(!t)throw new Error('Not authenticated');const r=await fetch('/api/metronomePresets',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({name:p.name,description:p.description,settings:p.settings})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.message||'Failed to save preset')}return await r.json()}
async function updatePresetInBackend(p){const t=await getAuthToken();if(!t)throw new Error('Not authenticated');const r=await fetch('/api/metronomePresets',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({presetId:p.id,name:p.name,description:p.description,settings:p.settings})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.message||'Failed to update preset')}return await r.json()}
async function deletePresetFromBackend(id){const t=await getAuthToken();if(!t)throw new Error('Not authenticated');const r=await fetch('/api/metronomePresets',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({presetId:id})});if(!r.ok&&r.status!==204){const d=await r.json().catch(()=>({}));throw new Error(d.message||'Failed to delete preset')}}
function initializePresets(){renderUserPresets();loadUserPresetsToGrid()}
initializePresets();initializePresetControls();initAudio()

async function loadSounds(){
  try{
    const files=[
      {name:'click',file:'Perc_Tongue_hi.wav',type:'hi'},
      {name:'click',file:'Perc_Tongue_lo.wav',type:'lo'},
      {name:'glassTick',file:'Perc_Glass_hi.wav',type:'hi'},
      {name:'glassTick',file:'Perc_Glass_lo.wav',type:'lo'},
      {name:'bell',file:'Synth_Bell_A_hi.wav',type:'hi'},
      {name:'bell',file:'Synth_Bell_A_lo.wav',type:'lo'}
    ];
    
    await Promise.all(files.map(async sound=>{
      try{
        const response=await fetch(`/tools/sounds/metronome/${sound.file}`);
        if(!response.ok) throw new Error(`Failed to load sound: ${sound.file}`);
        const audioBuffer=await response.arrayBuffer();
        sounds[sound.name][sound.type]=await audioContext.decodeAudioData(audioBuffer);
      }catch(error){
        console.error(`Error loading sound ${sound.file}:`,error);
      }
    }));
    
    const selectedButton=document.querySelector(`.sound-button[data-sound="${selectedSound}"]`);
    if(selectedButton) selectedButton.classList.add('selected');
    
  }catch(error){
    console.error('Error in loadSounds:',error);
  }
}

async function loadVoiceSounds(){
  try{
    const numberPromises=[];
    for(let i=1;i<=12;i++){
      numberPromises.push(loadVoiceSound('numbers',i.toString(),`${i}.wav`));
    }
    
    const subdivisionSounds=[
      {name:'e',file:'e.wav'},
      {name:'and',file:'and.wav'},
      {name:'a',file:'a.wav'},
      {name:'trip',file:'trip.wav'},
      {name:'let',file:'let.wav'}
    ];
    
    const subdivisionPromises=subdivisionSounds.map(sound=>
      loadVoiceSound('subdivisions',sound.name,sound.file)
    );
    
    await Promise.all([...numberPromises,...subdivisionPromises]);
    
  }catch(error){
    console.error('Error in loadVoiceSounds:',error);
  }
}

async function loadVoiceSound(category,name,filename){
  try{
    const response=await fetch(`/tools/sounds/metronome/voice/male/${filename}`);
    if(!response.ok) throw new Error(`Failed to load voice sound: ${filename}`);
    const audioBuffer=await response.arrayBuffer();
    voiceSounds.male[category][name]=await audioContext.decodeAudioData(audioBuffer);
  }catch(error){
    console.error(`Error loading voice sound ${filename}:`,error);
  }
}

function playTickSound(data,atTime=null){
  if(data.silent) return;
  
  if(data.isMainBeat){
    if(useVoiceCounting){
      playVoiceSound((data.beatInMeasure+1).toString(),atTime);
    }else{
      playSound(data.accent,atTime);
    }
  }else if(subdivision>1){
    playSubdivisionSound(data.subBeat,atTime);
  }}}