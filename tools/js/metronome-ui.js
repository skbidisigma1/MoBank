document.addEventListener('DOMContentLoaded',()=>{initializeMetronomeUI()})
function initializeMetronomeUI(){
const tempoSlider=document.getElementById('tempo-slider'),tempoDisplay=document.getElementById('tempo-display'),tempoDecreaseBtn=document.getElementById('tempo-decrease'),tempoIncreaseBtn=document.getElementById('tempo-increase'),tempoPlayBtn=document.getElementById('tempo-play'),decreaseBeatsBtn=document.querySelector('[data-action="decrease-beats"]'),increaseBeatsBtn=document.querySelector('[data-action="increase-beats"]'),decreaseNoteValueBtn=document.querySelector('[data-action="decrease-note-value"]'),increaseNoteValueBtn=document.querySelector('[data-action="increase-note-value"]'),timeSignatureNumerator=document.getElementById('time-sig-numerator'),timeSignatureDenominator=document.getElementById('time-sig-denominator'),accentPattern=document.getElementById('accent-pattern'),soundButtons=document.querySelectorAll('.sound-button'),volumeSlider=document.getElementById('volume-slider'),pendulum=document.querySelector('.tempo-pendulum'),subdivisionSelector=document.getElementById('subdivision-selector'),tapButton=document.getElementById('tap-tempo-button'),tapDisplay=document.getElementById('tap-tempo-display'),useVoiceCountingCheckbox=document.getElementById('use-voice-counting'),voiceOptionsPanel=document.querySelector('.voice-options-panel'),useClickSubdivisionCheckbox=document.getElementById('use-click-subdivision'),voiceVolumeSlider=document.getElementById('voice-volume-slider'),presetModal=document.getElementById('preset-modal'),presetTabs=document.querySelectorAll('.preset-tab'),presetTabContents=document.querySelectorAll('.preset-tab-content'),presetNameInput=document.getElementById('preset-name'),presetDescInput=document.getElementById('preset-description'),presetSaveBtn=document.getElementById('preset-save'),presetCancelBtn=document.getElementById('preset-cancel'),presetCloseBtn=document.getElementById('preset-close'),presetUpdateBtn=document.getElementById('preset-update'),presetCancelEditBtn=document.getElementById('preset-cancel-edit'),presetList=document.getElementById('preset-list'),emptyPresets=document.getElementById('empty-presets'),saveTabButtons=document.getElementById('save-tab-buttons'),editTabButtons=document.getElementById('edit-tab-buttons'),presetsGrid=document.getElementById('presets-grid'),presetForm=document.getElementById('preset-form'),includeTempoCheck=document.getElementById('include-tempo'),includeTimeSignatureCheck=document.getElementById('include-time-signature'),includeSubdivisionCheck=document.getElementById('include-subdivision'),includeAccentPatternCheck=document.getElementById('include-accent-pattern'),includeSoundCheck=document.getElementById('include-sound'),includeVolumeCheck=document.getElementById('include-volume'),includeVoiceSettingsCheck=document.getElementById('include-voice-settings'),presetDecreaseBeats=document.getElementById('preset-decrease-beats'),presetIncreaseBeats=document.getElementById('preset-increase-beats'),presetDecreaseNoteValue=document.getElementById('preset-decrease-note-value'),presetIncreaseNoteValue=document.getElementById('preset-increase-note-value'),presetSoundButtons=document.querySelectorAll('.preset-sound-button'),presetVolumeSlider=document.getElementById('preset-volume-slider'),presetVoiceVolumeSlider=document.getElementById('preset-voice-volume-slider'),alertModal=document.getElementById('alert-modal'),alertMessage=document.getElementById('alert-message'),alertConfirm=document.getElementById('alert-confirm'),confirmModal=document.getElementById('confirm-modal'),confirmMessage=document.getElementById('confirm-message'),confirmOk=document.getElementById('confirm-ok'),confirmCancel=document.getElementById('confirm-cancel')
soundButtons.forEach(b=>{if(b.tagName==='BUTTON'){b.type='button';b.onclick=e=>{e.preventDefault();e.stopPropagation();soundButtons.forEach(x=>x.classList.remove('selected'));b.classList.add('selected');selectedSound=b.dataset.sound}}})
presetSoundButtons.forEach(b=>{if(b.tagName==='BUTTON')b.type='button'})
let isPlaying=false,currentTempo=parseInt(tempoDisplay.value),beatsPerMeasure=parseInt(timeSignatureNumerator.textContent),noteValue=parseInt(timeSignatureDenominator.textContent),subdivision=parseInt(subdivisionSelector.value),currentBeat=0,pendulumAngle=0,selectedSound='click',volume=parseFloat(volumeSlider.value)/100*1.5,metronomeInterval=null,audioContext=null,tempoDebounceTimeout=null,sounds={click:{hi:null,lo:null},glassTick:{hi:null,lo:null},bell:{hi:null,lo:null}},useVoiceCounting=false,selectedVoice='male',useClickSubdivision=false,voiceVolume=parseFloat(voiceVolumeSlider.value)/100*1.5,voiceSounds={male:{numbers:{},subdivisions:{}}},pendulumRaf=null,metronomeStartTime=0,constValid=[1,2,4,8,16,32],tapTimes=[],tapTimeout=null,currentEditingPresetId=null,presetModalSelectedSound=selectedSound
const PRESET_CACHE_MS=2e4
async function initAudio(){try{audioContext=new(window.AudioContext||window.webkitAudioContext)();await loadSounds();await loadVoiceSounds()}catch(e){console.error(e)}}
async function loadSounds(){try{const f=[{n:'glassTick',f:'Perc_Glass_hi.wav',t:'hi'},{n:'glassTick',f:'Perc_Glass_lo.wav',t:'lo'},{n:'click',f:'Perc_Tongue_hi.wav',t:'hi'},{n:'click',f:'Perc_Tongue_lo.wav',t:'lo'},{n:'bell',f:'Synth_Bell_A_hi.wav',t:'hi'},{n:'bell',f:'Synth_Bell_A_lo.wav',t:'lo'}];await Promise.all(f.map(async s=>{try{const r=await fetch(`/tools/sounds/metronome/${s.f}`);const a=await r.arrayBuffer();sounds[s.n][s.t]=await audioContext.decodeAudioData(a)}catch(e){console.error(e)}}));const b=document.querySelector(`.sound-button[data-sound="${selectedSound}"]`);if(b)b.classList.add('selected')}catch(e){console.error(e)}}
async function loadVoiceSounds(){try{const p=[];for(let i=1;i<=12;i++)p.push(loadVoiceSound('male','numbers',i.toString(),`${i}.wav`));const s=[{n:'e',f:'e.wav'},{n:'and',f:'and.wav'},{n:'a',f:'a.wav'},{n:'trip',f:'trip.wav'},{n:'let',f:'let.wav'}];await Promise.all([...p,...s.map(s=>loadVoiceSound('male','subdivisions',s.n,s.f))])}catch(e){console.error(e)}}
async function loadVoiceSound(v,c,n,f){try{const r=await fetch(`/tools/sounds/metronome/voice/${v}/${f}`);const a=await r.arrayBuffer();voiceSounds[v][c][n]=await audioContext.decodeAudioData(a)}catch(e){console.error(e)}}
function playVoiceSound(n){if(!audioContext||!voiceSounds[selectedVoice].numbers[n])return;const s=audioContext.createBufferSource(),g=audioContext.createGain();s.buffer=voiceSounds[selectedVoice].numbers[n];g.gain.value=voiceVolume*(n==='2'?0.9:1);s.connect(g);g.connect(audioContext.destination);s.start(0)}
function playVoiceSubdivision(t){if(!audioContext||!voiceSounds[selectedVoice].subdivisions[t])return;const s=audioContext.createBufferSource(),g=audioContext.createGain();g.gain.value=voiceVolume*(t==='and'?0.64:0.8);s.buffer=voiceSounds[selectedVoice].subdivisions[t];s.connect(g);g.connect(audioContext.destination);s.start(0)}
function playSound(a){if(!audioContext||!sounds[selectedSound])return;const s=audioContext.createBufferSource(),g=audioContext.createGain();s.buffer=a?sounds[selectedSound].hi:sounds[selectedSound].lo;if(!s.buffer)return;g.gain.value=volume;s.connect(g);g.connect(audioContext.destination);s.start(0)}
function playSubdivisionSound(p){if(useVoiceCounting&&!useClickSubdivision){let s=null;if(subdivision===2)s='and';else if(subdivision===3){if(p===1)s='trip';else if(p===2)s='let'}else if(subdivision===4){if(p===1)s='e';else if(p===2)s='and';else if(p===3)s='a'}if(s)playVoiceSubdivision(s);return}if(!audioContext||!sounds[selectedSound])return;const b=audioContext.createBufferSource(),g=audioContext.createGain();b.buffer=sounds[selectedSound].lo;if(!b.buffer)return;g.gain.value=volume*0.6;b.connect(g);g.connect(audioContext.destination);b.start(0)}
function tempoToSliderPosition(t){const m=10,x=1000,l=Math.log(m),M=Math.log(x);return 100/(M-l)*(Math.log(t)-l)}
function sliderPositionToTempo(p){const m=10,x=1000,l=Math.log(m),M=Math.log(x);return Math.round(Math.exp(l+p*(M-l)/100))}
function updateTempo(v){let n=parseInt(v);if(isNaN(n)||n<=0)n=10;currentTempo=Math.min(Math.max(n,10),1000);tempoDisplay.value=currentTempo;tempoSlider.value=tempoToSliderPosition(currentTempo);if(isPlaying){clearTimeout(tempoDebounceTimeout);tempoDebounceTimeout=setTimeout(restartMetronome,150)}}
function updateBeatsPerMeasure(v){beatsPerMeasure=Math.min(Math.max(v,1),12);timeSignatureNumerator.textContent=beatsPerMeasure;updateAccentPattern();updateBeatLights();if(isPlaying)restartMetronome()}
function updateAccentPattern(p=null){accentPattern.innerHTML='';for(let i=0;i<beatsPerMeasure;i++){let s='normal';if(p&&i<p.length)s=p[i];else if(noteValue===8&&(beatsPerMeasure===6||beatsPerMeasure===9||beatsPerMeasure===12)?i%3===0:i===0)s='accent';const b=document.createElement('button');b.className='accent-button';b.dataset.beat=i+1;b.dataset.state=s;if(b.tagName==='BUTTON')b.type='button';if(s==='accent')b.classList.add('accent');else if(s==='silent')b.classList.add('silent');b.innerHTML=`<span>${i+1}</span>`;b.onclick=()=>{const c=b.dataset.state;b.dataset.state=c==='normal'?'accent':c==='accent'?'silent':'normal';b.classList.toggle('accent',b.dataset.state==='accent');b.classList.toggle('silent',b.dataset.state==='silent');updateBeatLights()};accentPattern.appendChild(b)}}
function updateBeatLights(){const c=document.querySelector('.beat-lights');c.innerHTML='';for(let i=0;i<beatsPerMeasure;i++){const a=document.querySelector(`.accent-button[data-beat="${i+1}"]`),s=document.createElement('div');s.className='beat-light';const st=a?a.dataset.state:'normal';if(st==='accent')s.classList.add('accent');else if(st==='silent')s.classList.add('silent');s.dataset.beat=i+1;c.appendChild(s)}}
function updateNoteValue(v){if(constValid.includes(v)){noteValue=v;timeSignatureDenominator.textContent=noteValue;updateAccentPattern();updateBeatLights();if(isPlaying)restartMetronome()}}
function playFirstBeat(){const b=document.querySelector('.accent-button[data-beat="1"]'),st=b?b.dataset.state:'normal';if(st!=='silent'){useVoiceCounting?playVoiceSound('1'):playSound(st==='accent')}}
function stopMetronome(){isPlaying=false;clearInterval(metronomeInterval);if(pendulumRaf){cancelAnimationFrame(pendulumRaf);pendulumRaf=null}pendulumAngle=0;pendulum.style.transition='transform 0.5s ease-out';pendulum.style.transform='rotate(0rad)';tempoPlayBtn.innerHTML='<svg width="24" height="24"><path d="M8 5V19L19 12Z" fill="currentColor"/></svg>';document.querySelectorAll('.beat-light').forEach(l=>l.classList.remove('active'))}
function restartMetronome(){if(isPlaying){stopMetronome();startMetronome()}}
function updateVisualBeat(i){document.querySelectorAll('.beat-light').forEach(l=>l.classList.remove('active'));const b=document.querySelector(`.beat-light[data-beat="${i+1}"]`);if(b)b.classList.add('active')}
function animatePendulum(i){const p=i,n=performance.now(),e=n-metronomeStartTime,prog=(e%p)/p,dir=Math.floor(e/p)%2===0?1:-1;pendulumAngle=Math.sin(prog*Math.PI)*0.392699*dir;pendulum.style.transition='none';pendulum.style.transform=`rotate(${pendulumAngle}rad)`;pendulumRaf=requestAnimationFrame(()=>animatePendulum(i))}
async function startMetronome(){if(isPlaying)return;isPlaying=true;if(audioContext===null)await initAudio();else if(audioContext.state==='suspended')await audioContext.resume();currentBeat=0;pendulum.style.transform='rotate(0rad)';metronomeStartTime=performance.now();tempoPlayBtn.innerHTML='<svg width="24" height="24"><path d="M6 19h4V5H6zm8-14v14h4V5z" fill="currentColor"/></svg>';const base=(60/currentTempo)*1000*(4/noteValue),inter=subdivision>1?base/subdivision:base;playFirstBeat();updateVisualBeat(0);let sub=1;if(pendulumRaf)cancelAnimationFrame(pendulumRaf);animatePendulum(base);metronomeInterval=setInterval(()=>{const main=sub%subdivision===0,mainIdx=Math.floor(sub/subdivision),beatIn=mainIdx%beatsPerMeasure,button=document.querySelector(`.accent-button[data-beat="${beatIn+1}"]`),state=button?button.dataset.state:'normal';if(main){if(state!=='silent'){useVoiceCounting?playVoiceSound((beatIn+1).toString()):playSound(state==='accent')}updateVisualBeat(beatIn)}else if(subdivision>1&&state!=='silent'){playSubdivisionSound(sub%subdivision)}sub=(sub+1)%(beatsPerMeasure*subdivision)},inter)}
function handlePresetSoundButtonClick(e){e.preventDefault();e.stopPropagation();presetModalSelectedSound=this.dataset.sound;presetSoundButtons.forEach(b=>b.classList.toggle('selected',b===this))}
function handlePresetDecreaseBeats(){const n=document.getElementById('preset-time-sig-numerator');if(!n)return;const v=parseInt(n.textContent);if(v>1){n.textContent=v-1;if(includeAccentPatternCheck.checked)updatePresetAccentPattern()}}
function handlePresetIncreaseBeats(){const n=document.getElementById('preset-time-sig-numerator');if(!n)return;const v=parseInt(n.textContent);if(v<12){n.textContent=v+1;if(includeAccentPatternCheck.checked)updatePresetAccentPattern()}}
function handlePresetDecreaseNoteValue(){const d=document.getElementById('preset-time-sig-denominator');if(!d)return;const i=constValid.indexOf(parseInt(d.textContent));if(i>0){d.textContent=constValid[i-1];if(includeAccentPatternCheck.checked)updatePresetAccentPattern()}}
function handlePresetIncreaseNoteValue(){const d=document.getElementById('preset-time-sig-denominator');if(!d)return;const i=constValid.indexOf(parseInt(d.textContent));if(i<constValid.length-1){d.textContent=constValid[i+1];if(includeAccentPatternCheck.checked)updatePresetAccentPattern()}}
if(subdivisionSelector)subdivisionSelector.onchange=()=>{subdivision=parseInt(subdivisionSelector.value);if(isPlaying)restartMetronome()}
tempoSlider.value=tempoToSliderPosition(currentTempo);tempoSlider.oninput=()=>updateTempo(sliderPositionToTempo(parseFloat(tempoSlider.value)))
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
window.onclick=e=>{if(e.target===presetModal){presetModal.classList.remove('visible');resetPresetForm()}}
window.onkeydown=e=>{const a=document.activeElement,f=a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT');if(e.code==='Space'&&!f){e.preventDefault();isPlaying?stopMetronome():startMetronome()}if(e.code==='Enter'){if(a===tempoDisplay){tempoDisplay.blur();e.preventDefault()}else if(!f){tempoDisplay.focus();tempoDisplay.select();e.preventDefault()}}if(!f){let s=e.shiftKey&&e.ctrlKey?20:e.ctrlKey?10:e.shiftKey?5:1;if(e.code==='ArrowUp'||e.code==='ArrowRight'){e.preventDefault();updateTempo(currentTempo+s)}if(e.code==='ArrowDown'||e.code==='ArrowLeft'){e.preventDefault();updateTempo(currentTempo-s)}}}
function applyPreset(p){if(!p||!p.settings)return;if(p.settings.tempo!==undefined)updateTempo(p.settings.tempo);if(p.settings.beatsPerMeasure!==undefined)updateBeatsPerMeasure(p.settings.beatsPerMeasure);if(p.settings.noteValue!==undefined)updateNoteValue(p.settings.noteValue);if(p.settings.subdivision!==undefined){subdivision=p.settings.subdivision;subdivisionSelector.value=subdivision}if(p.settings.sound!==undefined){selectedSound=p.settings.sound;document.querySelectorAll('.sound-button').forEach(b=>b.classList.toggle('selected',b.dataset.sound===selectedSound))}if(p.settings.volume!==undefined){volume=p.settings.volume/100*1.5;volumeSlider.value=p.settings.volume}if(p.settings.accentPattern!==undefined)updateAccentPattern(p.settings.accentPattern);if(p.settings.useVoiceCounting!==undefined){useVoiceCountingCheckbox.checked=p.settings.useVoiceCounting;useVoiceCounting=p.settings.useVoiceCounting;if(voiceOptionsPanel)voiceOptionsPanel.style.display=useVoiceCounting?'block':'none'}if(p.settings.useClickSubdivision!==undefined){useClickSubdivisionCheckbox.checked=p.settings.useClickSubdivision;useClickSubdivision=p.settings.useClickSubdivision}if(p.settings.voiceVolume!==undefined){voiceVolume=p.settings.voiceVolume/100*1.5;voiceVolumeSlider.value=p.settings.voiceVolume}if(isPlaying)restartMetronome()}
function initializePresets(){renderUserPresets();loadUserPresetsToGrid()}
if(presetTabs)presetTabs.forEach(t=>t.onclick=()=>{const id=t.dataset.tab;presetTabs.forEach(x=>x.classList.remove('active'));presetTabContents.forEach(x=>x.classList.remove('active'));t.classList.add('active');document.getElementById(id+'-tab').classList.add('active');if(id==='save'&&(!editTabButtons||editTabButtons.style.display==='none')){resetPresetForm();initializePresetControls();if(includeAccentPatternCheck.checked)updatePresetAccentPattern()}if(id==='my-presets')renderUserPresets()})
if(presetCloseBtn)presetCloseBtn.onclick=()=>{presetModal.classList.remove('visible');resetPresetForm()}
if(presetCancelBtn)presetCancelBtn.onclick=()=>{presetModal.classList.remove('visible');resetPresetForm()}
if(presetCancelEditBtn)presetCancelEditBtn.onclick=resetPresetForm
presetSaveBtn.onclick=async()=>{const n=presetNameInput.value.trim();if(!n){showAlert('Please enter a name for the preset');return}const selects=[includeTempoCheck,includeTimeSignatureCheck,includeSubdivisionCheck,includeAccentPatternCheck,includeSoundCheck,includeVolumeCheck,includeVoiceSettingsCheck];if(selects.every(c=>!c.checked)){showAlert('Please select at least one setting');return}const pr={id:Date.now().toString(),name=n,description:presetDescInput.value.trim(),createdAt:new Date().toISOString(),settings:{}},tv=document.getElementById('preset-tempo-value'),num=document.getElementById('preset-time-sig-numerator'),den=document.getElementById('preset-time-sig-denominator'),subSel=document.getElementById('preset-subdivision-selector'),vol=document.getElementById('preset-volume-slider'),vo=document.getElementById('preset-voice-volume-slider'),vc=document.getElementById('preset-use-voice-counting'),cs=document.getElementById('preset-use-click-subdivision')
if(includeTempoCheck.checked)pr.settings.tempo=parseInt(tv.value)
if(includeTimeSignatureCheck.checked){pr.settings.beatsPerMeasure=parseInt(num.textContent);pr.settings.noteValue=parseInt(den.textContent)}
if(includeSubdivisionCheck.checked)pr.settings.subdivision=parseInt(subSel.value)
if(includeAccentPatternCheck.checked)pr.settings.accentPattern=[...document.querySelectorAll('.preset-accent-button')].map(b=>b.dataset.state)
if(includeSoundCheck.checked)pr.settings.sound=presetModalSelectedSound
if(includeVolumeCheck.checked)pr.settings.volume=parseInt(vol.value)
if(includeVoiceSettingsCheck.checked){pr.settings.voiceVolume=parseInt(vo.value);pr.settings.useVoiceCounting=vc.checked;pr.settings.useClickSubdivision=cs.checked}
await savePresetToStorage(pr);resetPresetForm();presetModal.classList.remove('visible');renderUserPresets();loadUserPresetsToGrid()}
presetUpdateBtn.onclick=async()=>{if(!currentEditingPresetId)return;const n=presetNameInput.value.trim();if(!n){showAlert('Please enter a name for the preset');return}const selects=[includeTempoCheck,includeTimeSignatureCheck,includeSubdivisionCheck,includeAccentPatternCheck,includeSoundCheck,includeVolumeCheck,includeVoiceSettingsCheck];if(selects.every(c=>!c.checked)){showAlert('Please select at least one setting');return}const presets=getUserPresets(),idx=presets.findIndex(p=>p.id===currentEditingPresetId);if(idx===-1)return;const up={id:currentEditingPresetId,name=n,description:presetDescInput.value.trim(),createdAt:presets[idx].createdAt,updatedAt:new Date().toISOString(),settings:{}},tv=document.getElementById('preset-tempo-value'),num=document.getElementById('preset-time-sig-numerator'),den=document.getElementById('preset-time-sig-denominator'),subSel=document.getElementById('preset-subdivision-selector'),vol=document.getElementById('preset-volume-slider'),vo=document.getElementById('preset-voice-volume-slider'),vc=document.getElementById('preset-use-voice-counting'),cs=document.getElementById('preset-use-click-subdivision')
if(includeTempoCheck.checked)up.settings.tempo=parseInt(tv.value)
if(includeTimeSignatureCheck.checked){up.settings.beatsPerMeasure=parseInt(num.textContent);up.settings.noteValue=parseInt(den.textContent)}
if(includeSubdivisionCheck.checked)up.settings.subdivision=parseInt(subSel.value)
if(includeAccentPatternCheck.checked)up.settings.accentPattern=[...document.querySelectorAll('.preset-accent-button')].map(b=>b.dataset.state)
if(includeSoundCheck.checked)up.settings.sound=presetModalSelectedSound
if(includeVolumeCheck.checked)up.settings.volume=parseInt(vol.value)
if(includeVoiceSettingsCheck.checked){up.settings.voiceVolume=parseInt(vo.value);up.settings.useVoiceCounting=vc.checked;up.settings.useClickSubdivision=cs.checked}
await updatePresetInStorage(up);resetPresetForm();presetModal.classList.remove('visible');renderUserPresets();loadUserPresetsToGrid()}
function resetPresetForm(){if(presetForm)presetForm.reset();currentEditingPresetId=null;presetNameInput.value='';presetDescInput.value='';includeTempoCheck.checked=true;includeTimeSignatureCheck.checked=false;includeSubdivisionCheck.checked=false;includeAccentPatternCheck.checked=false;includeSoundCheck.checked=false;includeVolumeCheck.checked=false;includeVoiceSettingsCheck.checked=false;if(saveTabButtons)saveTabButtons.style.display='flex';if(editTabButtons)editTabButtons.style.display='none';presetModalSelectedSound=selectedSound;initializePresetControls();const cont=document.getElementById('preset-accent-pattern-container');if(cont)cont.style.display=includeAccentPatternCheck.checked?'block':'none'}
async function savePresetToStorage(p){try{await savePresetToBackend(p);updatePresetCacheAfterMutation()}catch(e){showAlert(e.message)}}
async function updatePresetInStorage(p){try{await updatePresetInBackend(p);updatePresetCacheAfterMutation()}catch(e){showAlert(e.message)}}
async function deletePreset(id){showConfirm('Are you sure you want to delete this preset?',async()=>{try{await deletePresetFromBackend(id);updatePresetCacheAfterMutation()}catch(e){showAlert(e.message)}})}
function updatePresetCacheAfterMutation(){setCachedPresets([]);refreshBackendPresets(true).then(()=>{renderUserPresets();loadUserPresetsToGrid()})}
let backendPresetsCache=[]
async function refreshBackendPresets(force=false){const cached=getCachedPresets();if(cached&&!force){backendPresetsCache=cached;return}backendPresetsCache=await fetchUserPresets();setCachedPresets(backendPresetsCache)}
function getUserPresets(){return backendPresetsCache}
function getCachedPresets(){const raw=localStorage.getItem('metronomePresets');if(!raw)return null;const p=JSON.parse(raw);return Date.now()-p.ts<PRESET_CACHE_MS?p.data:null}
function setCachedPresets(arr){localStorage.setItem('metronomePresets',JSON.stringify({data:arr,ts:Date.now()}))}
async function renderUserPresets(){await refreshBackendPresets();const p=[...new Map(getUserPresets().map(o=>[o.id,o])).values()];[...presetList.children].forEach(c=>{if(c!==emptyPresets)c.remove()});if(!p.length){emptyPresets.style.display='block';return}emptyPresets.style.display='none';p.forEach(pr=>{const i=document.createElement('div');i.className='preset-item';i.dataset.id=pr.id;i.innerHTML=`<h3 class="preset-item-title">${pr.name}</h3>${pr.description?`<p class="preset-item-description">${pr.description}</p>`:''}${pr.settings.tempo!==undefined?`<div class="preset-item-tempo">${pr.settings.tempo} BPM</div>`:''}<div class="preset-item-includes">${getIncludedSettingsString(pr)}</div><div class="preset-item-actions"><button class="preset-action-btn edit" type="button"><svg width="18" height="18"><path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5z" stroke="currentColor" stroke-width="2" fill="none"/></svg></button><button class="preset-action-btn delete" type="button"><svg width="18" height="18"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2" fill="none"/></svg></button></div>`;i.onclick=e=>{if(!e.target.closest('.preset-action-btn')){applyPreset(pr);presetModal.classList.remove('visible')}};i.querySelector('.edit').onclick=e=>{e.stopPropagation();enterEditMode(pr)};i.querySelector('.delete').onclick=e=>{e.stopPropagation();deletePreset(pr.id)};presetList.appendChild(i)})}
async function loadUserPresetsToGrid(){await refreshBackendPresets();const p=[...new Map(getUserPresets().map(o=>[o.id,o])).values()];presetsGrid.querySelectorAll('.user-preset').forEach(b=>b.remove());p.forEach(pr=>{if(pr.name&&pr.settings.tempo!==undefined){const b=document.createElement('button');b.className='preset-button user-preset';b.type='button';b.dataset.id=pr.id;b.innerHTML=`<span class="preset-tempo">${pr.settings.tempo}</span><span class="preset-name">${pr.name}</span>`;b.onclick=()=>applyPreset(pr);presetsGrid.appendChild(b)}})}
function showAlert(m){if(!alertModal)return;alertMessage.textContent=m;alertModal.classList.add('visible');alertConfirm.onclick=()=>alertModal.classList.remove('visible')}
function showConfirm(m,c){if(!confirmModal)return;confirmMessage.textContent=m;confirmModal.classList.add('visible');confirmOk.onclick=()=>{confirmModal.classList.remove('visible');c&&c()};confirmCancel.onclick=()=>confirmModal.classList.remove('visible')}
function initializePresetControls(p=null){const t=p?.settings.tempo??currentTempo,b=p?.settings.beatsPerMeasure??beatsPerMeasure,d=p?.settings.noteValue??noteValue,s=p?.settings.subdivision??subdivision,so=p?.settings.sound??selectedSound,v=p?.settings.volume??Math.round(volume/1.5*100),vv=p?.settings.voiceVolume??Math.round(voiceVolume/1.5*100),uv=p?.settings.useVoiceCounting??useVoiceCounting,uc=p?.settings.useClickSubdivision??useClickSubdivision;document.getElementById('preset-tempo-value').value=t;document.getElementById('preset-time-sig-numerator').textContent=b;document.getElementById('preset-time-sig-denominator').textContent=d;document.getElementById('preset-subdivision-selector').value=s;presetModalSelectedSound=so;presetSoundButtons.forEach(btn=>{btn.classList.toggle('selected',btn.dataset.sound===so);btn.onclick=handlePresetSoundButtonClick});presetVolumeSlider.value=v;presetVoiceVolumeSlider.value=vv;document.getElementById('preset-use-voice-counting').checked=uv;document.getElementById('preset-use-click-subdivision').checked=uc;presetDecreaseBeats.onclick=handlePresetDecreaseBeats;presetIncreaseBeats.onclick=handlePresetIncreaseBeats;presetDecreaseNoteValue.onclick=handlePresetDecreaseNoteValue;presetIncreaseNoteValue.onclick=handlePresetIncreaseNoteValue}
function updatePresetAccentPattern(a=null){const c=document.getElementById('preset-accent-pattern');c.innerHTML='';const n=parseInt(document.getElementById('preset-time-sig-numerator').textContent),d=parseInt(document.getElementById('preset-time-sig-denominator').textContent);for(let i=0;i<n;i++){let st='normal';if(a&&i<a.length)st=a[i];else if(d===8&&(n===6||n===9||n===12)?i%3===0:i===0)st='accent';const b=document.createElement('button');b.className='preset-accent-button';b.dataset.beat=i+1;b.dataset.state=st;b.type='button';b.classList.toggle('accent',st==='accent');b.classList.toggle('silent',st==='silent');b.innerHTML=`<span>${i+1}</span>`;b.onclick=handlePresetAccentClick;c.appendChild(b)}}
function handlePresetAccentClick(){this.dataset.state=this.dataset.state==='normal'?'accent':this.dataset.state==='accent'?'silent':'normal';this.classList.toggle('accent',this.dataset.state==='accent');this.classList.toggle('silent',this.dataset.state==='silent')}
if(includeAccentPatternCheck)includeAccentPatternCheck.onchange=()=>{const cont=document.getElementById('preset-accent-pattern-container');if(cont)cont.style.display=includeAccentPatternCheck.checked?'block':'none';if(includeAccentPatternCheck.checked)updatePresetAccentPattern()}
function getIncludedSettingsString(p){const s=[];if(p.settings.tempo!==undefined)s.push('Tempo');if(p.settings.beatsPerMeasure!==undefined)s.push('Time Sig');if(p.settings.subdivision!==undefined)s.push('Subdivision');if(p.settings.accentPattern!==undefined)s.push('Accents');if(p.settings.sound!==undefined)s.push('Sound');if(p.settings.volume!==undefined)s.push('Volume');if(p.settings.useVoiceCounting!==undefined)s.push('Voice');return s.length?`<span class="preset-included-settings">Includes: ${s.join(', ')}</span>`:''}
function enterEditMode(pr){currentEditingPresetId=pr.id;presetTabs.forEach(t=>t.classList.remove('active'));presetTabContents.forEach(c=>c.classList.remove('active'));const s=document.querySelector('.preset-tab[data-tab="save"]'),c=document.getElementById('save-tab');s.classList.add('active');c.classList.add('active');if(saveTabButtons)saveTabButtons.style.display='none';if(editTabButtons)editTabButtons.style.display='flex';presetNameInput.value=pr.name;presetDescInput.value=pr.description||'';initializePresetControls(pr);if(includeAccentPatternCheck.checked)updatePresetAccentPattern(pr.settings.accentPattern);presetModal.classList.add('visible')}
initializePresets();initializePresetControls();initAudio()}
async function getAuthToken(){if(window.auth0Client&&window.auth0Client.getTokenSilently)return await window.auth0Client.getTokenSilently();if(window.getToken)return await window.getToken();return null}
async function fetchUserPresets(){const t=await getAuthToken();if(!t)return[];const r=await fetch('/api/metronomePresets',{headers:{Authorization:`Bearer ${t}`}});return r.ok?await r.json():[]}
async function savePresetToBackend(p){const t=await getAuthToken();if(!t)throw new Error('Not authenticated');const r=await fetch('/api/metronomePresets',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({name:p.name,description:p.description,settings:p.settings})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.message||'Failed to save preset')}return await r.json()}
async function updatePresetInBackend(p){const t=await getAuthToken();if(!t)throw new Error('Not authenticated');const r=await fetch('/api/metronomePresets',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({presetId:p.id,name:p.name,description:p.description,settings:p.settings})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.message||'Failed to update preset')}return await r.json()}
async function deletePresetFromBackend(id){const t=await getAuthToken();if(!t)throw new Error('Not authenticated');const r=await fetch('/api/metronomePresets',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({presetId:id})});if(!r.ok&&r.status!==204){const d=await r.json().catch(()=>({}));throw new Error(d.message||'Failed to delete preset')}}
