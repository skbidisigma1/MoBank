document.addEventListener('DOMContentLoaded',()=>{initializeMetronomeUI()})
function initializeMetronomeUI(){
const tempoSlider=document.getElementById('tempo-slider')
const tempoDisplay=document.getElementById('tempo-display')
const tempoDecreaseBtn=document.getElementById('tempo-decrease')
const tempoIncreaseBtn=document.getElementById('tempo-increase')
const tempoPlayBtn=document.getElementById('tempo-play')
const decreaseBeatsBtn=document.querySelector('[data-action="decrease-beats"]')
const increaseBeatsBtn=document.querySelector('[data-action="increase-beats"]')
const decreaseNoteValueBtn=document.querySelector('[data-action="decrease-note-value"]')
const increaseNoteValueBtn=document.querySelector('[data-action="increase-note-value"]')
const timeSignatureNumerator=document.getElementById('time-sig-numerator')
const timeSignatureDenominator=document.getElementById('time-sig-denominator')
const accentPattern=document.getElementById('accent-pattern')
const soundButtons=document.querySelectorAll('.sound-button')
const volumeSlider=document.getElementById('volume-slider')
const savePresetBtn=document.getElementById('save-preset')
const pendulum=document.querySelector('.tempo-pendulum')
const subdivisionSelector=document.getElementById('subdivision-selector')
const tapButton=document.getElementById('tap-tempo-button')
const tapDisplay=document.getElementById('tap-tempo-display')
const useVoiceCountingCheckbox=document.getElementById('use-voice-counting')
const voiceOptionsPanel=document.querySelector('.voice-options-panel')
const useClickSubdivisionCheckbox=document.getElementById('use-click-subdivision')
const voiceVolumeSlider=document.getElementById('voice-volume-slider')
const presetModal=document.getElementById('preset-modal')
const presetTabs=document.querySelectorAll('.preset-tab')
const presetTabContents=document.querySelectorAll('.preset-tab-content')
const presetNameInput=document.getElementById('preset-name')
const presetDescInput=document.getElementById('preset-description')
const presetSaveBtn=document.getElementById('preset-save')
const presetCancelBtn=document.getElementById('preset-cancel')
const presetCloseBtn=document.getElementById('preset-close')
const presetUpdateBtn=document.getElementById('preset-update')
const presetCancelEditBtn=document.getElementById('preset-cancel-edit')
const presetList=document.getElementById('preset-list')
const emptyPresets=document.getElementById('empty-presets')
const saveTabButtons=document.getElementById('save-tab-buttons')
const editTabButtons=document.getElementById('edit-tab-buttons')
const presetsGrid=document.getElementById('presets-grid')
const presetForm=document.getElementById('preset-form')
const includeTempoCheck=document.getElementById('include-tempo')
const includeTimeSignatureCheck=document.getElementById('include-time-signature')
const includeSubdivisionCheck=document.getElementById('include-subdivision')
const includeAccentPatternCheck=document.getElementById('include-accent-pattern')
const includeSoundCheck=document.getElementById('include-sound')
const includeVolumeCheck=document.getElementById('include-volume')
const includeVoiceSettingsCheck=document.getElementById('include-voice-settings')
const presetDecreaseBeats=document.getElementById('preset-decrease-beats')
const presetIncreaseBeats=document.getElementById('preset-increase-beats')
const presetDecreaseNoteValue=document.getElementById('preset-decrease-note-value')
const presetIncreaseNoteValue=document.getElementById('preset-increase-note-value')
const presetSoundButtons=document.querySelectorAll('.preset-sound-button')
const presetVolumeSlider=document.getElementById('preset-volume-slider')
const presetVoiceVolumeSlider=document.getElementById('preset-voice-volume-slider')
const alertModal=document.getElementById('alert-modal')
const alertMessage=document.getElementById('alert-message')
const alertConfirm=document.getElementById('alert-confirm')
const confirmModal=document.getElementById('confirm-modal')
const confirmMessage=document.getElementById('confirm-message')
const confirmOk=document.getElementById('confirm-ok')
const confirmCancel=document.getElementById('confirm-cancel')
let isPlaying=false
let currentTempo=parseInt(tempoDisplay.value)
let beatsPerMeasure=parseInt(timeSignatureNumerator.textContent)
let noteValue=parseInt(timeSignatureDenominator.textContent)
let subdivision=parseInt(subdivisionSelector.value)
let currentBeat=0
let pendulumAngle=0
let selectedSound='click'
let volume=parseFloat(volumeSlider.value)/100*1.5
let metronomeInterval=null
let audioContext=null
let tempoDebounceTimeout=null
let sounds={click:{hi:null,lo:null},glassTick:{hi:null,lo:null},bell:{hi:null,lo:null}}
let useVoiceCounting=false
let selectedVoice='male'
let useClickSubdivision=false
let voiceVolume=parseFloat(voiceVolumeSlider.value)/100*1.5
let voiceSounds={male:{numbers:{},subdivisions:{}}}
let pendulumRaf=null
let metronomeStartTime=0
const validNoteValues=[1,2,4,8,16,32]
let tapTimes=[]
let tapTimeout=null
let currentEditingPresetId=null
let presetModalSelectedSound=selectedSound
async function initAudio(){
try{
audioContext=new(window.AudioContext||window.webkitAudioContext)()
await loadSounds()
await loadVoiceSounds()
}catch(error){console.error('Error initializing audio:',error)}
}
async function loadSounds(){
try{
const soundFiles=[{name:'glassTick',file:'Perc_Glass_hi.wav',type:'hi'},{name:'glassTick',file:'Perc_Glass_lo.wav',type:'lo'},{name:'click',file:'Perc_Tongue_hi.wav',type:'hi'},{name:'click',file:'Perc_Tongue_lo.wav',type:'lo'},{name:'bell',file:'Synth_Bell_A_hi.wav',type:'hi'},{name:'bell',file:'Synth_Bell_A_lo.wav',type:'lo'}]
const loadPromises=soundFiles.map(async sound=>{
try{
const response=await fetch(`/tools/sounds/metronome/${sound.file}`)
const arrayBuffer=await response.arrayBuffer()
const audioBuffer=await audioContext.decodeAudioData(arrayBuffer)
sounds[sound.name][sound.type]=audioBuffer
}catch(err){console.error(`Error loading sound ${sound.file}:`,err)}
})
await Promise.all(loadPromises)
const defaultSoundButton=document.querySelector(`.sound-button[data-sound="${selectedSound}"]`)
if(defaultSoundButton){defaultSoundButton.classList.add('selected')}
}catch(error){console.error('Error loading sounds:',error)}
}
async function loadVoiceSounds(){
try{
const numberPromises=[]
for(let i=1;i<=12;i++){numberPromises.push(loadVoiceSound('male','numbers',i.toString(),`${i}.wav`))}
const subdivisionFiles=[{name:'e',file:'e.wav'},{name:'and',file:'and.wav'},{name:'a',file:'a.wav'},{name:'trip',file:'trip.wav'},{name:'let',file:'let.wav'}]
const subdivisionPromises=subdivisionFiles.map(sound=>loadVoiceSound('male','subdivisions',sound.name,sound.file))
await Promise.all([...numberPromises,...subdivisionPromises])
}catch(error){console.error('Error loading voice sounds:',error)}
}
async function loadVoiceSound(voice,category,name,filename){
try{
const response=await fetch(`/tools/sounds/metronome/voice/${voice}/${filename}`)
const arrayBuffer=await response.arrayBuffer()
const audioBuffer=await audioContext.decodeAudioData(arrayBuffer)
if(!voiceSounds[voice][category]){voiceSounds[voice][category]={}}
voiceSounds[voice][category][name]=audioBuffer
}catch(err){console.error(`Error loading voice sound ${filename}:`,err)}
}
function playVoiceSound(number){
if(!audioContext||!voiceSounds[selectedVoice].numbers[number])return
const soundBuffer=voiceSounds[selectedVoice].numbers[number]
const source=audioContext.createBufferSource()
const gainNode=audioContext.createGain()
const volumeMultiplier=number==='2'?0.9:1
source.buffer=soundBuffer
gainNode.gain.value=voiceVolume*volumeMultiplier
source.connect(gainNode)
gainNode.connect(audioContext.destination)
source.start(0)
}
function playVoiceSubdivision(type){
if(!audioContext||!voiceSounds[selectedVoice].subdivisions[type])return
const soundBuffer=voiceSounds[selectedVoice].subdivisions[type]
const source=audioContext.createBufferSource()
const gainNode=audioContext.createGain()
let volumeMultiplier=0.8
if(type==='and'){volumeMultiplier*=0.8}
source.buffer=soundBuffer
gainNode.gain.value=voiceVolume*volumeMultiplier
source.connect(gainNode)
gainNode.connect(audioContext.destination)
source.start(0)
}
function playSound(isAccent){
if(!audioContext||!sounds[selectedSound])return
const soundBuffer=isAccent?sounds[selectedSound].hi:sounds[selectedSound].lo
if(!soundBuffer)return
const source=audioContext.createBufferSource()
const gainNode=audioContext.createGain()
source.buffer=soundBuffer
gainNode.gain.value=volume
source.connect(gainNode)
gainNode.connect(audioContext.destination)
source.start(0)
}
function playSubdivisionSound(subdivisionPosition){
if(useVoiceCounting&&!useClickSubdivision){
if(!audioContext)return
let subdivisionSound
if(subdivision===2){subdivisionSound='and'}
else if(subdivision===3){
if(subdivisionPosition===1){subdivisionSound='trip'}
else if(subdivisionPosition===2){subdivisionSound='let'}
}else if(subdivision===4){
if(subdivisionPosition===1){subdivisionSound='e'}
else if(subdivisionPosition===2){subdivisionSound='and'}
else if(subdivisionPosition===3){subdivisionSound='a'}
}
if(subdivisionSound){playVoiceSubdivision(subdivisionSound)}
return
}
if(!audioContext||!sounds[selectedSound])return
const soundBuffer=sounds[selectedSound].lo
if(!soundBuffer)return
const source=audioContext.createBufferSource()
const gainNode=audioContext.createGain()
source.buffer=soundBuffer
gainNode.gain.value=volume*0.6
source.connect(gainNode)
gainNode.connect(audioContext.destination)
source.start(0)
}
function tempoToSliderPosition(tempo){
const minTempo=10
const maxTempo=1000
const logMin=Math.log(minTempo)
const logMax=Math.log(maxTempo)
const scale=100/(logMax-logMin)
return scale*(Math.log(tempo)-logMin)
}
function sliderPositionToTempo(position){
const minTempo=10
const maxTempo=1000
const logMin=Math.log(minTempo)
const logMax=Math.log(maxTempo)
return Math.round(Math.exp(logMin+position*(logMax-logMin)/100))
}
function updateTempo(value){
let newTempo=parseInt(value)
if(isNaN(newTempo)||newTempo<=0){newTempo=10}
currentTempo=Math.min(Math.max(newTempo,10),1000)
tempoDisplay.value=currentTempo
tempoSlider.value=tempoToSliderPosition(currentTempo)
if(isPlaying){
clearTimeout(tempoDebounceTimeout)
tempoDebounceTimeout=setTimeout(()=>{restartMetronome()},150)
}
}
function updateBeatsPerMeasure(value){
beatsPerMeasure=Math.min(Math.max(value,1),12)
timeSignatureNumerator.textContent=beatsPerMeasure
updateAccentPattern()
updateBeatLights()
if(isPlaying)restartMetronome()
}
function updateAccentPattern(pattern=null){
accentPattern.innerHTML=''
for(let i=0;i<beatsPerMeasure;i++){
let initialState='normal'
if(pattern&&i<pattern.length){initialState=pattern[i]}
else{
if(noteValue===8&&(beatsPerMeasure===6||beatsPerMeasure===9||beatsPerMeasure===12)){if(i%3===0){initialState='accent'}}
else{if(i===0){initialState='accent'}}
}
const beatBtn=document.createElement('button')
beatBtn.className='accent-button'
beatBtn.dataset.beat=i+1
beatBtn.dataset.state=initialState
if(initialState==='accent'){beatBtn.classList.add('accent')}
else if(initialState==='silent'){beatBtn.classList.add('silent')}
beatBtn.innerHTML=`<span>${i+1}</span>`
beatBtn.addEventListener('click',()=>{
const current=beatBtn.dataset.state
let next
if(current==='normal'){next='accent'}
else if(current==='accent'){next='silent'}
else{next='normal'}
beatBtn.dataset.state=next
beatBtn.classList.remove('accent','silent')
if(next==='accent'){beatBtn.classList.add('accent')}
else if(next==='silent'){beatBtn.classList.add('silent')}
updateBeatLights()
})
accentPattern.appendChild(beatBtn)
}
}
function updateBeatLights(){
const beatLightsContainer=document.querySelector('.beat-lights')
beatLightsContainer.innerHTML=''
for(let i=0;i<beatsPerMeasure;i++){
const accentButton=document.querySelector(`.accent-button[data-beat="${i+1}"]`)
let state='normal'
if(accentButton)state=accentButton.dataset.state
const beatLight=document.createElement('div')
beatLight.className='beat-light'
if(state==='accent'){beatLight.classList.add('accent')}
else if(state==='silent'){beatLight.classList.add('silent')}
beatLight.dataset.beat=i+1
beatLightsContainer.appendChild(beatLight)
}
}
function updateNoteValue(value){
if(validNoteValues.includes(value)){
noteValue=value
timeSignatureDenominator.textContent=noteValue
updateAccentPattern()
updateBeatLights()
if(isPlaying)restartMetronome()
}
}
function playFirstBeat(){
const firstButton=document.querySelector('.accent-button[data-beat="1"]')
const firstState=firstButton?firstButton.dataset.state:'normal'
if(firstState!=='silent'){
if(useVoiceCounting){playVoiceSound('1')}
else{
if(firstState==='accent'){playSound(true)}
else{playSound(false)}
}
}
}
function stopMetronome(){
isPlaying=false
clearInterval(metronomeInterval)
if(pendulumRaf){cancelAnimationFrame(pendulumRaf);pendulumRaf=null}
pendulumAngle=0
pendulum.style.transition='transform 0.5s ease-out'
pendulum.style.transform=`rotate(${pendulumAngle}rad)`
tempoPlayBtn.innerHTML=`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="currentColor"/></svg>`
document.querySelectorAll('.beat-light').forEach(light=>light.classList.remove('active'))
}
function restartMetronome(){if(isPlaying){stopMetronome();startMetronome()}}
function updateVisualBeat(beatIndex){
document.querySelectorAll('.beat-light').forEach(light=>light.classList.remove('active'))
const beatLights=document.querySelectorAll('.beat-light')
if(beatLights.length!==beatsPerMeasure){updateBeatLights()}
if(beatIndex>=0&&beatIndex<beatsPerMeasure){
const currentBeatLight=document.querySelector(`.beat-light[data-beat="${beatIndex+1}"]`)
if(currentBeatLight){currentBeatLight.classList.add('active')}
else{updateBeatLights();const refreshedBeatLight=document.querySelector(`.beat-light[data-beat="${beatIndex+1}"]`);if(refreshedBeatLight){refreshedBeatLight.classList.add('active')}}
}
}
function animatePendulum(baseInterval,playbackInterval){
const period=baseInterval
const now=performance.now()
const elapsed=now-metronomeStartTime
const progress=(elapsed%period)/period
const beatIndex=Math.floor(elapsed/period)
const direction=beatIndex%2===0?1:-1
pendulumAngle=Math.sin(progress*Math.PI)*(Math.PI/8)*direction
pendulum.style.transition='none'
pendulum.style.transform=`rotate(${pendulumAngle}rad)`
pendulumRaf=requestAnimationFrame(()=>animatePendulum(baseInterval,playbackInterval))
}
async function startMetronome(){
if(isPlaying)return
isPlaying=true
if(audioContext===null){await initAudio()}else if(audioContext.state==='suspended'){await audioContext.resume()}
currentBeat=0
let subBeat=0
pendulumAngle=0
pendulum.style.transform=`rotate(${pendulumAngle}rad)`
metronomeStartTime=performance.now()
tempoPlayBtn.innerHTML=`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>`
const baseInterval=(60/currentTempo)*1000*(4/noteValue)
const playbackInterval=subdivision>1?baseInterval/subdivision:baseInterval
playFirstBeat()
updateVisualBeat(0)
subBeat=1
if(pendulumRaf)cancelAnimationFrame(pendulumRaf)
animatePendulum(baseInterval,playbackInterval)
metronomeInterval=setInterval(()=>{
const isMainBeat=(subBeat%subdivision===0)
const mainBeatIndex=Math.floor(subBeat/subdivision)
const beatInMeasure=mainBeatIndex%beatsPerMeasure
if(isMainBeat){
const button=document.querySelector(`.accent-button[data-beat="${beatInMeasure+1}"]`)
const state=button?button.dataset.state:'normal'
if(state!=='silent'){
if(useVoiceCounting){
const beatNumber=beatInMeasure+1
if(beatNumber<=12){playVoiceSound(beatNumber.toString())}
}else{if(state==='accent'){playSound(true)}else{playSound(false)}}
}
updateVisualBeat(beatInMeasure)
}else if(subdivision>1){playSubdivisionSound(subBeat%subdivision)}
subBeat=(subBeat+1)%(beatsPerMeasure*subdivision)
},playbackInterval)
}
function handlePresetSoundButtonClick(){
presetModalSelectedSound=this.dataset.sound
document.querySelectorAll('.preset-sound-button').forEach(b=>{b.classList.remove('selected')})
this.classList.add('selected')
}
function handlePresetDecreaseBeats(){
const numElement=document.getElementById('preset-time-sig-numerator')
if(!numElement)return
const currentValue=parseInt(numElement.textContent)
if(currentValue>1){
numElement.textContent=currentValue-1
if(includeAccentPatternCheck&&includeAccentPatternCheck.checked)updatePresetAccentPattern()
}
}
function handlePresetIncreaseBeats(){
const numElement=document.getElementById('preset-time-sig-numerator')
if(!numElement)return
const currentValue=parseInt(numElement.textContent)
if(currentValue<12){
numElement.textContent=currentValue+1
if(includeAccentPatternCheck&&includeAccentPatternCheck.checked)updatePresetAccentPattern()
}
}
function handlePresetDecreaseNoteValue(){
const denElement=document.getElementById('preset-time-sig-denominator')
if(!denElement)return
const currentIndex=validNoteValues.indexOf(parseInt(denElement.textContent))
if(currentIndex>0){
denElement.textContent=validNoteValues[currentIndex-1]
if(includeAccentPatternCheck&&includeAccentPatternCheck.checked)updatePresetAccentPattern()
}
}
function handlePresetIncreaseNoteValue(){
const denElement=document.getElementById('preset-time-sig-denominator')
if(!denElement)return
const currentIndex=validNoteValues.indexOf(parseInt(denElement.textContent))
if(currentIndex<validNoteValues.length-1){
denElement.textContent=validNoteValues[currentIndex+1]
if(includeAccentPatternCheck&&includeAccentPatternCheck.checked)updatePresetAccentPattern()
}
}
if(subdivisionSelector){subdivisionSelector.addEventListener('change',()=>{subdivision=parseInt(subdivisionSelector.value);if(isPlaying)restartMetronome()})}
if(tempoSlider){
tempoSlider.value=tempoToSliderPosition(currentTempo)
tempoSlider.addEventListener('input',()=>{updateTempo(sliderPositionToTempo(parseFloat(tempoSlider.value)))})
}
if(tempoDisplay){
tempoDisplay.addEventListener('change',()=>updateTempo(tempoDisplay.value))
tempoDisplay.addEventListener('blur',()=>updateTempo(tempoDisplay.value))
}
if(tempoDecreaseBtn)tempoDecreaseBtn.addEventListener('click',()=>updateTempo(currentTempo-1))
if(tempoIncreaseBtn)tempoIncreaseBtn.addEventListener('click',()=>updateTempo(currentTempo+1))
if(tempoPlayBtn)tempoPlayBtn.addEventListener('click',()=>isPlaying?stopMetronome():startMetronome())
if(decreaseBeatsBtn)decreaseBeatsBtn.addEventListener('click',()=>updateBeatsPerMeasure(beatsPerMeasure-1))
if(increaseBeatsBtn)increaseBeatsBtn.addEventListener('click',()=>updateBeatsPerMeasure(beatsPerMeasure+1))
if(decreaseNoteValueBtn){decreaseNoteValueBtn.addEventListener('click',()=>{const currentIndex=validNoteValues.indexOf(noteValue);if(currentIndex>0)updateNoteValue(validNoteValues[currentIndex-1])})}
if(increaseNoteValueBtn){increaseNoteValueBtn.addEventListener('click',()=>{const currentIndex=validNoteValues.indexOf(noteValue);if(currentIndex<validNoteValues.length-1)updateNoteValue(validNoteValues[currentIndex+1])})}
if(soundButtons){soundButtons.forEach(btn=>{btn.addEventListener('click',()=>{soundButtons.forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');selectedSound=btn.dataset.sound})})}
if(volumeSlider)volumeSlider.addEventListener('input',()=>{volume=parseFloat(volumeSlider.value)/100*1.5})
const mainSavePresetBtn=document.getElementById('save-preset')
if(mainSavePresetBtn){mainSavePresetBtn.addEventListener('click',()=>{
const saveTab=document.querySelector('.preset-tab[data-tab="save"]')
const saveTabContent=document.getElementById('save-tab')
const myPresetsTab=document.querySelector('.preset-tab[data-tab="my-presets"]')
if(presetModal&&presetModal.classList.contains('visible')&&myPresetsTab&&myPresetsTab.classList.contains('active')){
if(presetTabs)presetTabs.forEach(t=>t.classList.remove('active'))
if(presetTabContents)presetTabContents.forEach(c=>c.classList.remove('active'))
if(saveTab)saveTab.classList.add('active')
if(saveTabContent)saveTabContent.classList.add('active')
initializePresetControls()
if(includeAccentPatternCheck&&includeAccentPatternCheck.checked){updatePresetAccentPattern()}
}else if(presetModal){
presetModal.classList.add('visible')
if(presetTabs)presetTabs.forEach(t=>t.classList.remove('active'))
if(presetTabContents)presetTabContents.forEach(c=>c.classList.remove('active'))
if(saveTab)saveTab.classList.add('active')
if(saveTabContent)saveTabContent.classList.add('active')
resetPresetForm()
initializePresetControls()
if(includeAccentPatternCheck&&includeAccentPatternCheck.checked){updatePresetAccentPattern()}
}
})}
if(tapButton){tapButton.addEventListener('click',()=>{
const now=Date.now()
tapButton.classList.add('tapped')
setTimeout(()=>tapButton.classList.remove('tapped'),200)
if(tapTimes.length>0&&now-tapTimes[tapTimes.length-1]>2000){tapTimes=[]}
tapTimes.push(now)
if(tapTimeout)clearTimeout(tapTimeout)
tapTimeout=setTimeout(()=>{tapTimes=[];if(tapDisplay)tapDisplay.textContent="-- BPM"},2000)
if(tapTimes.length>=2){
let intervals=[]
for(let i=1;i<tapTimes.length;i++){intervals.push(tapTimes[i]-tapTimes[i-1])}
const avgInterval=intervals.reduce((a,b)=>a+b,0)/intervals.length
const bpm=Math.round(60000/avgInterval)
if(tapDisplay)tapDisplay.textContent=bpm+" BPM"
updateTempo(bpm)
}
})}
if(useVoiceCountingCheckbox){useVoiceCountingCheckbox.addEventListener('change',()=>{useVoiceCounting=useVoiceCountingCheckbox.checked;if(voiceOptionsPanel)voiceOptionsPanel.style.display=useVoiceCounting?'block':'none';if(isPlaying)restartMetronome()})}
if(useClickSubdivisionCheckbox){useClickSubdivisionCheckbox.addEventListener('change',()=>{useClickSubdivision=useClickSubdivisionCheckbox.checked;if(isPlaying)restartMetronome()})}
if(voiceVolumeSlider)voiceVolumeSlider.addEventListener('input',()=>{voiceVolume=parseFloat(voiceVolumeSlider.value)/100*1.5})
const defaultPresetButtons=document.querySelectorAll('.preset-button:not(.user-preset)')
if(defaultPresetButtons){defaultPresetButtons.forEach(btn=>{btn.addEventListener('click',()=>{
const tempo=parseInt(btn.dataset.tempo)
const beatsValue=btn.dataset.beats?parseInt(btn.dataset.beats):null
const noteVal=btn.dataset.noteValue?parseInt(btn.dataset.noteValue):null
if(!isNaN(tempo))updateTempo(tempo)
if(beatsValue)updateBeatsPerMeasure(beatsValue)
if(noteVal)updateNoteValue(noteVal)
if(isPlaying)restartMetronome()
})})}
updateAccentPattern()
updateBeatLights()
window.addEventListener('click',e=>{if(presetModal&&e.target===presetModal){presetModal.classList.remove('visible');resetPresetForm()}})
window.addEventListener('keydown',e=>{
const activeElement=document.activeElement
const isInputFocused=activeElement&&(activeElement.tagName==='INPUT'||activeElement.tagName==='TEXTAREA'||activeElement.tagName==='SELECT')
const isTempoInputFocused=activeElement===tempoDisplay
if(e.code==='Space'&&!isInputFocused){e.preventDefault();isPlaying?stopMetronome():startMetronome();return}
if(e.code==='Enter'){
if(isTempoInputFocused){if(tempoDisplay)tempoDisplay.blur();e.preventDefault()}
else if(!isInputFocused&&tempoDisplay){tempoDisplay.focus();tempoDisplay.select();e.preventDefault()}
return
}
if(!isInputFocused){
let step=1
if(e.shiftKey&&e.ctrlKey){step=20}
else if(e.ctrlKey){step=10}
else if(e.shiftKey){step=5}
if(e.code==='ArrowUp'||e.code==='ArrowRight'){e.preventDefault();updateTempo(currentTempo+step)}
if(e.code==='ArrowDown'||e.code==='ArrowLeft'){e.preventDefault();updateTempo(currentTempo-step)}
}
})
function applyPreset(preset){
if(!preset||!preset.settings)return
if(preset.settings.tempo!==undefined)updateTempo(preset.settings.tempo)
if(preset.settings.beatsPerMeasure!==undefined)updateBeatsPerMeasure(preset.settings.beatsPerMeasure)
if(preset.settings.noteValue!==undefined)updateNoteValue(preset.settings.noteValue)
if(preset.settings.subdivision!==undefined&&subdivisionSelector){subdivision=preset.settings.subdivision;subdivisionSelector.value=subdivision}
if(preset.settings.sound!==undefined){
selectedSound=preset.settings.sound
document.querySelectorAll('.sound-button').forEach(btn=>{btn.classList.toggle('selected',btn.dataset.sound===selectedSound)})
}
if(preset.settings.volume!==undefined&&volumeSlider){volume=preset.settings.volume/100*1.5;volumeSlider.value=preset.settings.volume}
if(preset.settings.accentPattern!==undefined)updateAccentPattern(preset.settings.accentPattern)
if(preset.settings.useVoiceCounting!==undefined&&useVoiceCountingCheckbox){useVoiceCountingCheckbox.checked=preset.settings.useVoiceCounting;useVoiceCounting=preset.settings.useVoiceCounting;if(voiceOptionsPanel)voiceOptionsPanel.style.display=useVoiceCounting?'block':'none'}
if(preset.settings.useClickSubdivision!==undefined&&useClickSubdivisionCheckbox){useClickSubdivisionCheckbox.checked=preset.settings.useClickSubdivision;useClickSubdivision=preset.settings.useClickSubdivision}
if(preset.settings.voiceVolume!==undefined&&voiceVolumeSlider){voiceVolume=preset.settings.voiceVolume/100*1.5;voiceVolumeSlider.value=preset.settings.voiceVolume}
if(isPlaying)restartMetronome()
}
function initializePresets(){renderUserPresets();loadUserPresetsToGrid()}
if(presetTabs){presetTabs.forEach(tab=>{tab.addEventListener('click',()=>{
const tabId=tab.dataset.tab
if(!tabId)return
presetTabs.forEach(t=>t.classList.remove('active'))
if(presetTabContents)presetTabContents.forEach(c=>c.classList.remove('active'))
tab.classList.add('active')
const targetContent=document.getElementById(`${tabId}-tab`)
if(targetContent)targetContent.classList.add('active')
if(tabId==='save'&&editTabButtons&&editTabButtons.style.display==='none'){resetPresetForm();initializePresetControls();if(includeAccentPatternCheck&&includeAccentPatternCheck.checked){updatePresetAccentPattern()}}
else if(tabId==='my-presets'){renderUserPresets()}
})})}
if(presetCloseBtn)presetCloseBtn.addEventListener('click',()=>{if(presetModal)presetModal.classList.remove('visible');resetPresetForm()})
if(presetCancelBtn)presetCancelBtn.addEventListener('click',()=>{if(presetModal)presetModal.classList.remove('visible');resetPresetForm()})
if(presetCancelEditBtn)presetCancelEditBtn.addEventListener('click',()=>{resetPresetForm()})
const modalSaveButton=document.getElementById('preset-save')
if(modalSaveButton&&modalSaveButton.tagName==='BUTTON'){
modalSaveButton.addEventListener('click',async()=>{
const name=presetNameInput?presetNameInput.value.trim():''
if(!name){showAlert('Please enter a name for the preset');return}
const checks=[includeTempoCheck,includeTimeSignatureCheck,includeSubdivisionCheck,includeAccentPatternCheck,includeSoundCheck,includeVolumeCheck,includeVoiceSettingsCheck]
if(checks.every(chk=>!chk||!chk.checked)){showAlert('Please select at least one setting to include in the preset');return}
const preset={id:Date.now().toString(),name:name,description:presetDescInput?presetDescInput.value.trim():'',createdAt:new Date().toISOString(),settings:{}}
const presetTempoValueEl=document.getElementById('preset-tempo-value')
if(includeTempoCheck&&includeTempoCheck.checked&&presetTempoValueEl){preset.settings.tempo=parseInt(presetTempoValueEl.value)}
const presetNumEl=document.getElementById('preset-time-sig-numerator')
const presetDenEl=document.getElementById('preset-time-sig-denominator')
if(includeTimeSignatureCheck&&includeTimeSignatureCheck.checked&&presetNumEl&&presetDenEl){preset.settings.beatsPerMeasure=parseInt(presetNumEl.textContent);preset.settings.noteValue=parseInt(presetDenEl.textContent)}
const presetSubdivisionSelectorEl=document.getElementById('preset-subdivision-selector')
if(includeSubdivisionCheck&&includeSubdivisionCheck.checked&&presetSubdivisionSelectorEl){preset.settings.subdivision=parseInt(presetSubdivisionSelectorEl.value)}
if(includeAccentPatternCheck&&includeAccentPatternCheck.checked){
const presetAccentButtons=document.querySelectorAll('.preset-accent-button')
preset.settings.accentPattern=[]
presetAccentButtons.forEach(btn=>{preset.settings.accentPattern.push(btn.dataset.state)})
}
if(includeSoundCheck&&includeSoundCheck.checked){preset.settings.sound=presetModalSelectedSound}
const presetVolumeSliderEl=document.getElementById('preset-volume-slider')
if(includeVolumeCheck&&includeVolumeCheck.checked&&presetVolumeSliderEl){preset.settings.volume=parseInt(presetVolumeSliderEl.value)}
const presetUseVoiceEl=document.getElementById('preset-use-voice-counting')
const presetUseClickSubEl=document.getElementById('preset-use-click-subdivision')
const presetVoiceVolEl=document.getElementById('preset-voice-volume-slider')
if(includeVoiceSettingsCheck&&includeVoiceSettingsCheck.checked&&presetUseVoiceEl&&presetUseClickSubEl&&presetVoiceVolEl){
preset.settings.useVoiceCounting=presetUseVoiceEl.checked
preset.settings.useClickSubdivision=presetUseClickSubEl.checked
preset.settings.voiceVolume=parseInt(presetVoiceVolEl.value)
}
await savePresetToStorage(preset)
resetPresetForm()
if(presetModal)presetModal.classList.remove('visible')
renderUserPresets()
loadUserPresetsToGrid()
})
}
if(presetUpdateBtn){presetUpdateBtn.addEventListener('click',async()=>{
if(!currentEditingPresetId)return
const name=presetNameInput?presetNameInput.value.trim():''
if(!name){showAlert('Please enter a name for the preset');return}
const checks=[includeTempoCheck,includeTimeSignatureCheck,includeSubdivisionCheck,includeAccentPatternCheck,includeSoundCheck,includeVolumeCheck,includeVoiceSettingsCheck]
if(checks.every(chk=>!chk||!chk.checked)){showAlert('Please select at least one setting to include in the preset');return}
const presets=getUserPresets()
const presetIndex=presets.findIndex(p=>p.id===currentEditingPresetId)
if(presetIndex===-1)return
const updatedPreset={id:currentEditingPresetId,name:name,description:presetDescInput?presetDescInput.value.trim():'',createdAt:presets[presetIndex].createdAt,updatedAt:new Date().toISOString(),settings:{}}
const presetTempoValueEl=document.getElementById('preset-tempo-value')
if(includeTempoCheck&&includeTempoCheck.checked&&presetTempoValueEl){updatedPreset.settings.tempo=parseInt(presetTempoValueEl.value)}
const presetNumEl=document.getElementById('preset-time-sig-numerator')
const presetDenEl=document.getElementById('preset-time-sig-denominator')
if(includeTimeSignatureCheck&&includeTimeSignatureCheck.checked&&presetNumEl&&presetDenEl){updatedPreset.settings.beatsPerMeasure=parseInt(presetNumEl.textContent);updatedPreset.settings.noteValue=parseInt(presetDenEl.textContent)}
const presetSubdivisionSelectorEl=document.getElementById('preset-subdivision-selector')
if(includeSubdivisionCheck&&includeSubdivisionCheck.checked&&presetSubdivisionSelectorEl){updatedPreset.settings.subdivision=parseInt(presetSubdivisionSelectorEl.value)}
if(includeAccentPatternCheck&&includeAccentPatternCheck.checked){
const presetAccentButtons=document.querySelectorAll('.preset-accent-button')
updatedPreset.settings.accentPattern=[]
presetAccentButtons.forEach(btn=>{updatedPreset.settings.accentPattern.push(btn.dataset.state)})
}
if(includeSoundCheck&&includeSoundCheck.checked){updatedPreset.settings.sound=presetModalSelectedSound}
const presetVolumeSliderEl=document.getElementById('preset-volume-slider')
if(includeVolumeCheck&&includeVolumeCheck.checked&&presetVolumeSliderEl){updatedPreset.settings.volume=parseInt(presetVolumeSliderEl.value)}
const presetUseVoiceEl=document.getElementById('preset-use-voice-counting')
const presetUseClickSubEl=document.getElementById('preset-use-click-subdivision')
const presetVoiceVolEl=document.getElementById('preset-voice-volume-slider')
if(includeVoiceSettingsCheck&&includeVoiceSettingsCheck.checked&&presetUseVoiceEl&&presetUseClickSubEl&&presetVoiceVolEl){
updatedPreset.settings.useVoiceCounting=presetUseVoiceEl.checked
updatedPreset.settings.useClickSubdivision=presetUseClickSubEl.checked
updatedPreset.settings.voiceVolume=parseInt(presetVoiceVolEl.value)
}
await updatePresetInStorage(updatedPreset)
resetPresetForm()
if(presetModal)presetModal.classList.remove('visible')
renderUserPresets()
loadUserPresetsToGrid()
})}
function resetPresetForm(){
if(presetForm)presetForm.reset()
currentEditingPresetId=null
if(presetNameInput)presetNameInput.value=''
if(presetDescInput)presetDescInput.value=''
if(includeTempoCheck)includeTempoCheck.checked=true
if(includeTimeSignatureCheck)includeTimeSignatureCheck.checked=false
if(includeSubdivisionCheck)includeSubdivisionCheck.checked=false
if(includeAccentPatternCheck)includeAccentPatternCheck.checked=false
if(includeSoundCheck)includeSoundCheck.checked=false
if(includeVolumeCheck)includeVolumeCheck.checked=false
if(includeVoiceSettingsCheck)includeVoiceSettingsCheck.checked=false
if(saveTabButtons)saveTabButtons.style.display='flex'
if(editTabButtons)editTabButtons.style.display='none'
presetModalSelectedSound=selectedSound
initializePresetControls()
const container=document.getElementById('preset-accent-pattern-container')
if(container&&includeAccentPatternCheck&&!includeAccentPatternCheck.checked){container.style.display='none'}
}
async function savePresetToStorage(preset){try{await savePresetToBackend(preset);await renderUserPresets();loadUserPresetsToGrid()}catch(e){showAlert(e.message)}}
async function updatePresetInStorage(preset){try{await updatePresetInBackend(preset);await renderUserPresets();loadUserPresetsToGrid()}catch(e){showAlert(e.message)}}
async function deletePreset(presetId){showConfirm('Are you sure you want to delete this preset?',async()=>{try{await deletePresetFromBackend(presetId);await renderUserPresets();loadUserPresetsToGrid()}catch(e){showAlert(e.message)}})}
let backendPresetsCache=[]
async function refreshBackendPresets(){backendPresetsCache=await fetchUserPresets()}
function getUserPresets(){return backendPresetsCache}
async function renderUserPresets(){await refreshBackendPresets();const presets=getUserPresets();if(!presetList||!emptyPresets)return;Array.from(presetList.children).forEach(child=>{if(child!==emptyPresets){child.remove()}});if(presets.length===0){emptyPresets.style.display='block';return}else{emptyPresets.style.display='none'};presets.forEach(preset=>{const presetItem=document.createElement('div');presetItem.className='preset-item';presetItem.dataset.id=preset.id;const includesString=getIncludedSettingsString(preset);presetItem.innerHTML=`<h3 class="preset-item-title">${preset.name||'Unnamed Preset'}</h3>${preset.description?`<p class="preset-item-description">${preset.description}</p>`:''}${preset.settings?.tempo!==undefined?`<div class="preset-item-tempo">${preset.settings.tempo} BPM</div>`:''}<div class="preset-item-includes">${includesString}</div><div class="preset-item-actions"><button class="preset-action-btn edit" aria-label="Edit preset"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button><button class="preset-action-btn delete" aria-label="Delete preset"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>`;presetItem.addEventListener('click',e=>{if(!e.target.closest('.preset-action-btn')){applyPreset(preset);if(presetModal)presetModal.classList.remove('visible')}});const editBtn=presetItem.querySelector('.edit');if(editBtn){editBtn.addEventListener('click',e=>{e.stopPropagation();enterEditMode(preset)})};const deleteBtn=presetItem.querySelector('.delete');if(deleteBtn){deleteBtn.addEventListener('click',async e=>{e.stopPropagation();await deletePreset(preset.id)})};presetList.appendChild(presetItem)})}
async function loadUserPresetsToGrid(){await refreshBackendPresets();const presets=getUserPresets();if(!presetsGrid)return;const existingUserPresets=presetsGrid.querySelectorAll('.user-preset');existingUserPresets.forEach(btn=>btn.remove());presets.forEach(preset=>{if(preset.name&&preset.settings&&preset.settings.tempo!==undefined){const presetButton=document.createElement('button');presetButton.className='preset-button user-preset';presetButton.dataset.id=preset.id;presetButton.innerHTML=`<span class="preset-tempo">${preset.settings.tempo}</span><span class="preset-name">${preset.name}</span>${preset.description?`<span class="preset-description">${preset.description}</span>`:''}`;presetButton.addEventListener('click',()=>{applyPreset(preset)});presetsGrid.appendChild(presetButton)}})}
function showAlert(message,callback){if(!alertModal||!alertMessage||!alertConfirm){console.warn('Alert modal elements not found. Alert:',message);if(callback)callback();return}alertMessage.textContent=message;alertModal.classList.add('visible');alertConfirm.onclick=()=>{alertModal.classList.remove('visible');if(callback)callback()}}
function showConfirm(message,onConfirm){if(!confirmModal||!confirmMessage||!confirmOk||!confirmCancel){console.warn('Confirm modal elements not found. Confirm:',message);return}confirmMessage.textContent=message;confirmModal.classList.add('visible');confirmOk.onclick=()=>{confirmModal.classList.remove('visible');if(onConfirm)onConfirm()};confirmCancel.onclick=()=>{confirmModal.classList.remove('visible')}}
function initializePresetControls(preset=null){
const sourceTempo=preset?.settings?.tempo??currentTempo
const sourceBeats=preset?.settings?.beatsPerMeasure??beatsPerMeasure
const sourceNoteValue=preset?.settings?.noteValue??noteValue
const sourceSubdivision=preset?.settings?.subdivision??subdivision
const sourceSound=preset?.settings?.sound??selectedSound
const sourceVolume=preset?.settings?.volume??Math.round(volume/1.5*100)
const sourceVoiceVolume=preset?.settings?.voiceVolume??Math.round(voiceVolume/1.5*100)
const sourceUseVoice=preset?.settings?.useVoiceCounting??useVoiceCounting
const sourceUseClickSub=preset?.settings?.useClickSubdivision??useClickSubdivision
const presetTempoValueEl=document.getElementById('preset-tempo-value')
if(presetTempoValueEl)presetTempoValueEl.value=sourceTempo
const presetNumEl=document.getElementById('preset-time-sig-numerator')
const presetDenEl=document.getElementById('preset-time-sig-denominator')
if(presetNumEl)presetNumEl.textContent=sourceBeats
if(presetDenEl)presetDenEl.textContent=sourceNoteValue
const presetSubdivisionSelectorEl=document.getElementById('preset-subdivision-selector')
if(presetSubdivisionSelectorEl)presetSubdivisionSelectorEl.value=sourceSubdivision
presetModalSelectedSound=sourceSound
const presetSoundButtonsNodeList=document.querySelectorAll('.preset-sound-button')
if(presetSoundButtonsNodeList){presetSoundButtonsNodeList.forEach(btn=>{if(!btn)return;btn.classList.remove('selected');if(btn.dataset.sound===sourceSound){btn.classList.add('selected')}btn.removeEventListener('click',handlePresetSoundButtonClick);btn.addEventListener('click',handlePresetSoundButtonClick)})}
if(presetVolumeSlider)presetVolumeSlider.value=sourceVolume
if(presetVoiceVolumeSlider)presetVoiceVolumeSlider.value=sourceVoiceVolume
const presetUseVoiceEl=document.getElementById('preset-use-voice-counting')
const presetUseClickSubEl=document.getElementById('preset-use-click-subdivision')
if(presetUseVoiceEl)presetUseVoiceEl.checked=sourceUseVoice
if(presetUseClickSubEl)presetUseClickSubEl.checked=sourceUseClickSub
if(presetDecreaseBeats){presetDecreaseBeats.removeEventListener('click',handlePresetDecreaseBeats);presetDecreaseBeats.addEventListener('click',handlePresetDecreaseBeats)}
if(presetIncreaseBeats){presetIncreaseBeats.removeEventListener('click',handlePresetIncreaseBeats);presetIncreaseBeats.addEventListener('click',handlePresetIncreaseBeats)}
if(presetDecreaseNoteValue){presetDecreaseNoteValue.removeEventListener('click',handlePresetDecreaseNoteValue);presetDecreaseNoteValue.addEventListener('click',handlePresetDecreaseNoteValue)}
if(presetIncreaseNoteValue){presetIncreaseNoteValue.removeEventListener('click',handlePresetIncreaseNoteValue);presetIncreaseNoteValue.addEventListener('click',handlePresetIncreaseNoteValue)}
}
function updatePresetAccentPattern(patternArray=null){
const presetAccentPattern=document.getElementById('preset-accent-pattern')
if(!presetAccentPattern)return
presetAccentPattern.innerHTML=''
const presetNumEl=document.getElementById('preset-time-sig-numerator')
const presetDenEl=document.getElementById('preset-time-sig-denominator')
const beats=presetNumEl?parseInt(presetNumEl.textContent):beatsPerMeasure
const noteVal=presetDenEl?parseInt(presetDenEl.textContent):noteValue
for(let i=0;i<beats;i++){
let initialState='normal'
if(patternArray&&i<patternArray.length){initialState=patternArray[i]}
else{
const mainAccentButton=document.querySelector(`.accent-button[data-beat="${i+1}"]`)
if(mainAccentButton){initialState=mainAccentButton.dataset.state}
else{
if(noteVal===8&&(beats===6||beats===9||beats===12)){if(i%3===0){initialState='accent'}}
else{if(i===0){initialState='accent'}}
}
}
const beatBtn=document.createElement('button')
beatBtn.className='preset-accent-button'
beatBtn.dataset.beat=i+1
beatBtn.dataset.state=initialState
beatBtn.type='button'
if(initialState==='accent'){beatBtn.classList.add('accent')}
else if(initialState==='silent'){beatBtn.classList.add('silent')}
beatBtn.innerHTML=`<span>${i+1}</span>`
beatBtn.onclick=handlePresetAccentClick
presetAccentPattern.appendChild(beatBtn)
}
}
function handlePresetAccentClick(){
const current=this.dataset.state
let next
if(current==='normal'){next='accent'}
else if(current==='accent'){next='silent'}
else{next='normal'}
this.dataset.state=next
this.classList.remove('accent','silent')
if(next==='accent'){this.classList.add('accent')}
else if(next==='silent'){this.classList.add('silent')}
}
if(includeAccentPatternCheck){includeAccentPatternCheck.addEventListener('change',()=>{
const container=document.getElementById('preset-accent-pattern-container')
if(container){container.style.display=includeAccentPatternCheck.checked?'block':'none'}
if(includeAccentPatternCheck.checked){updatePresetAccentPattern()}
})}
document.querySelectorAll('.preset-sound-button').forEach(btn=>{if(btn.tagName==='BUTTON')btn.type='button'})
initializePresets()
initializePresetControls()
initAudio()
}
async function getAuthToken(){
if(window.auth0Client&&typeof window.auth0Client.getTokenSilently==='function'){return await window.auth0Client.getTokenSilently()}
if(window.getToken){return await window.getToken()}
return null
}
async function fetchUserPresets(){
const token=await getAuthToken()
if(!token)return[]
const res=await fetch('/api/metronomePresets',{headers:{Authorization:`Bearer ${token}`}})
if(!res.ok)return[]
return await res.json()
}
async function savePresetToBackend(preset){
const token=await getAuthToken()
if(!token)throw new Error('Not authenticated')
const res=await fetch('/api/metronomePresets',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({name:preset.name,description:preset.description,settings:preset.settings})})
if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.message||'Failed to save preset')}
return await res.json()
}
async function updatePresetInBackend(preset){
const token=await getAuthToken()
if(!token)throw new Error('Not authenticated')
const res=await fetch('/api/metronomePresets',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({presetId:preset.id,name:preset.name,description:preset.description,settings:preset.settings})})
if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.message||'Failed to update preset')}
return await res.json()
}
async function deletePresetFromBackend(presetId){
const token=await getAuthToken()
if(!token)throw new Error('Not authenticated')
const res=await fetch('/api/metronomePresets',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({presetId})})
if(!res.ok&&res.status!==204){const data=await res.json().catch(()=>({}));throw new Error(data.message||'Failed to delete preset')}
}
function getIncludedSettingsString(preset){
const settings=[]
if(!preset||!preset.settings)return''
if(preset.settings.tempo!==undefined)settings.push('Tempo')
if(preset.settings.beatsPerMeasure!==undefined)settings.push('Time Sig')
if(preset.settings.subdivision!==undefined)settings.push('Subdivision')
if(preset.settings.accentPattern!==undefined)settings.push('Accents')
if(preset.settings.sound!==undefined)settings.push('Sound')
if(preset.settings.volume!==undefined)settings.push('Volume')
if(preset.settings.useVoiceCounting!==undefined)settings.push('Voice')
if(settings.length===0)return''
return`<span class="preset-included-settings">Includes: ${settings.join(', ')}</span>`
}
function enterEditMode(preset){
if(!preset)return
currentEditingPresetId=preset.id
if(presetTabs)presetTabs.forEach(t=>t.classList.remove('active'))
if(presetTabContents)presetTabContents.forEach(c=>c.classList.remove('active'))
const saveTab=document.querySelector('.preset-tab[data-tab="save"]')
const saveTabContent=document.getElementById('save-tab')
if(saveTab)saveTab.classList.add('active')
if(saveTabContent)saveTabContent.classList.add('active')
if(saveTabButtons)saveTabButtons.style.display='none'
if(editTabButtons)editTabButtons.style.display='flex'
if(presetNameInput)presetNameInput.value=preset.name
if(presetDescInput)presetDescInput.value=preset.description||''
initializePresetControls(preset)
if(includeAccentPatternCheck&&includeAccentPatternCheck.checked){updatePresetAccentPattern(preset.settings.accentPattern)}
if(presetModal)presetModal.classList.add('visible')
}
