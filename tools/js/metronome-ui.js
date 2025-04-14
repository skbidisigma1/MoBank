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
  const presetButtons=document.querySelectorAll('.preset-button')
  const savePresetBtn=document.getElementById('save-preset')
  const savePresetModal=document.getElementById('save-preset-modal')
  const presetForm=document.getElementById('preset-form')
  const cancelSavePresetBtn=document.getElementById('cancel-save-preset')
  const pendulum=document.querySelector('.tempo-pendulum')
  const subdivisionSelector=document.getElementById('subdivision-selector')
  const tapButton=document.getElementById('tap-tempo-button')
  const tapDisplay=document.getElementById('tap-tempo-display')
  const useVoiceCountingCheckbox=document.getElementById('use-voice-counting')
  const voiceOptionsPanel=document.querySelector('.voice-options-panel')
  const useClickSubdivisionCheckbox=document.getElementById('use-click-subdivision')
  const voiceVolumeSlider=document.getElementById('voice-volume-slider')
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
  async function initAudio(){
    try{
      audioContext=new(window.AudioContext||window.webkitAudioContext)()
      await loadSounds()
      await loadVoiceSounds()
    }catch(error){
      console.error('Error initializing audio:',error)
    }
  }
  async function loadSounds(){
    try{
      const soundFiles=[{name:'glassTick',file:'Perc_Glass_hi.wav',type:'hi'},{name:'glassTick',file:'Perc_Glass_lo.wav',type:'lo'},{name:'click',file:'Perc_Tongue_hi.wav',type:'hi'},{name:'click',file:'Perc_Tongue_lo.wav',type:'lo'},{name:'bell',file:'Synth_Bell_A_hi.wav',type:'hi'},{name:'bell',file:'Synth_Bell_A_lo.wav',type:'lo'}]
      const loadPromises=soundFiles.map(async(sound)=>{
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
      for(let i=1;i<=12;i++){
        numberPromises.push(loadVoiceSound('male','numbers',i.toString(),`${i}.wav`))
      }
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
    const volumeMultiplier=number==='2'?0.9:1.0
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
  function updateAccentPattern(){
    accentPattern.innerHTML=''
    for(let i=0;i<beatsPerMeasure;i++){
      let initialState='normal'
      if(noteValue===8&&(beatsPerMeasure===6||beatsPerMeasure===9||beatsPerMeasure===12)){
        if(i%3===0){initialState='accent'}
      }else{
        if(i===0){initialState='accent'}
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
    if(pendulumRaf){
      cancelAnimationFrame(pendulumRaf)
      pendulumRaf=null
    }
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
          }else{
            if(state==='accent'){playSound(true)}else{playSound(false)}
          }
        }
        updateVisualBeat(beatInMeasure)
      }else if(subdivision>1){playSubdivisionSound(subBeat%subdivision)}
      subBeat=(subBeat+1)%(beatsPerMeasure*subdivision)
    },playbackInterval)
  }
  subdivisionSelector.addEventListener('change',()=>{
    subdivision=parseInt(subdivisionSelector.value)
    if(isPlaying)restartMetronome()
  })
  tempoSlider.value=tempoToSliderPosition(currentTempo)
  tempoSlider.addEventListener('input',()=>{updateTempo(sliderPositionToTempo(parseFloat(tempoSlider.value)))})
  tempoDisplay.addEventListener('change',()=>updateTempo(tempoDisplay.value))
  tempoDisplay.addEventListener('blur',()=>updateTempo(tempoDisplay.value))
  tempoDecreaseBtn.addEventListener('click',()=>updateTempo(currentTempo-1))
  tempoIncreaseBtn.addEventListener('click',()=>updateTempo(currentTempo+1))
  tempoPlayBtn.addEventListener('click',()=>isPlaying?stopMetronome():startMetronome())
  decreaseBeatsBtn.addEventListener('click',()=>updateBeatsPerMeasure(beatsPerMeasure-1))
  increaseBeatsBtn.addEventListener('click',()=>updateBeatsPerMeasure(beatsPerMeasure+1))
  decreaseNoteValueBtn.addEventListener('click',()=>{
    const currentIndex=validNoteValues.indexOf(noteValue)
    if(currentIndex>0)updateNoteValue(validNoteValues[currentIndex-1])
  })
  increaseNoteValueBtn.addEventListener('click',()=>{
    const currentIndex=validNoteValues.indexOf(noteValue)
    if(currentIndex<validNoteValues.length-1)updateNoteValue(validNoteValues[currentIndex+1])
  })
  soundButtons.forEach(btn=>{
    btn.addEventListener('click',()=>{
      soundButtons.forEach(b=>b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedSound=btn.dataset.sound
    })
  })
  volumeSlider.addEventListener('input',()=>{volume=parseFloat(volumeSlider.value)/100*1.5})
  savePresetBtn.addEventListener('click',()=>{
    presetModal.classList.add('visible')
    presetTabs.forEach(t=>t.classList.remove('active'))
    presetTabContents.forEach(c=>c.classList.remove('active'))
    document.querySelector('.preset-tab[data-tab="save"]').classList.add('active')
    document.getElementById('save-tab').classList.add('active')
    resetPresetForm()
  })
  tapButton.addEventListener('click',()=>{
    const now=Date.now()
    tapButton.classList.add('tapped')
    setTimeout(()=>tapButton.classList.remove('tapped'),200)
    if(tapTimes.length>0&&now-tapTimes[tapTimes.length-1]>2000){tapTimes=[]}
    tapTimes.push(now)
    if(tapTimeout)clearTimeout(tapTimeout)
    tapTimeout=setTimeout(()=>{
      tapTimes=[]
      tapDisplay.textContent="-- BPM"
    },2000)
    if(tapTimes.length>=2){
      let intervals=[]
      for(let i=1;i<tapTimes.length;i++){
        intervals.push(tapTimes[i]-tapTimes[i-1])
      }
      const avgInterval=intervals.reduce((a,b)=>a+b,0)/intervals.length
      const bpm=Math.round(60000/avgInterval)
      tapDisplay.textContent=bpm+" BPM"
      updateTempo(bpm)
    }
  })
  useVoiceCountingCheckbox.addEventListener('change',()=>{
    useVoiceCounting=useVoiceCountingCheckbox.checked
    voiceOptionsPanel.style.display=useVoiceCounting?'block':'none'
    if(isPlaying)restartMetronome()
  })
  useClickSubdivisionCheckbox.addEventListener('change',()=>{
    useClickSubdivision=useClickSubdivisionCheckbox.checked
    if(isPlaying)restartMetronome()
  })
  voiceVolumeSlider.addEventListener('input',()=>{voiceVolume=parseFloat(voiceVolumeSlider.value)/100*1.5})
  presetButtons.forEach(btn=>{
    btn.addEventListener('click',()=>{
      const tempo=parseInt(btn.dataset.tempo)
      const beatsValue=btn.dataset.beats?parseInt(btn.dataset.beats):null
      const noteVal=btn.dataset.noteValue?parseInt(btn.dataset.noteValue):null
      updateTempo(tempo)
      if(beatsValue){updateBeatsPerMeasure(beatsValue)}
      if(noteVal){updateNoteValue(noteVal)}
      if(isPlaying){restartMetronome()}
    })
  })
  updateAccentPattern()
  updateBeatLights()
  document.documentElement.style.setProperty('--metronome-accent-color',getComputedStyle(document.documentElement).getPropertyValue('--metronome-accent'))
  window.addEventListener('click',(e)=>{
    if(e.target===savePresetModal) presetModal.classList.remove('visible')
  })
  window.addEventListener('keydown',(e)=>{
    const activeElement=document.activeElement
    const isInputFocused=activeElement.tagName==='INPUT'||activeElement.tagName==='TEXTAREA'||activeElement.tagName==='SELECT'
    const isTempoInputFocused=activeElement===tempoDisplay
    if(e.code==='Space'){
      e.preventDefault()
      isPlaying?stopMetronome():startMetronome()
      return
    }
    if(e.code==='Enter'){
      if(isTempoInputFocused){tempoDisplay.blur();e.preventDefault()}
      else if(!isInputFocused){tempoDisplay.focus();tempoDisplay.select();e.preventDefault()}
      return
    }
    if(!isInputFocused){
      let step=1
      if(e.shiftKey&&e.ctrlKey){step=20}else if(e.ctrlKey){step=10}else if(e.shiftKey){step=5}
      if(e.code==='ArrowUp'||e.code==='ArrowRight'){e.preventDefault();updateTempo(currentTempo+step)}
      if(e.code==='ArrowDown'||e.code==='ArrowLeft'){e.preventDefault();updateTempo(currentTempo-step)}
    }
  })
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
  const includeTempoCheck=document.getElementById('include-tempo')
  const includeTimeSignatureCheck=document.getElementById('include-time-signature')
  const includeSubdivisionCheck=document.getElementById('include-subdivision')
  const includeAccentPatternCheck=document.getElementById('include-accent-pattern')
  const includeSoundCheck=document.getElementById('include-sound')
  const includeVolumeCheck=document.getElementById('include-volume')
  const includeVoiceSettingsCheck=document.getElementById('include-voice-settings')
  let currentEditingPresetId=null
  function initializePresets(){renderUserPresets();loadUserPresetsToGrid()}
  presetTabs.forEach(tab=>{
    tab.addEventListener('click',()=>{
      presetTabs.forEach(t=>t.classList.remove('active'))
      presetTabContents.forEach(c=>c.classList.remove('active'))
      tab.classList.add('active')
      const tabId=tab.dataset.tab
      document.getElementById(`${tabId}-tab`).classList.add('active')
      if(tabId==='save'){resetPresetForm()}
    })
  })
  savePresetBtn.addEventListener('click',()=>{
    presetModal.classList.add('visible')
    presetTabs.forEach(t=>t.classList.remove('active'))
    presetTabContents.forEach(c=>c.classList.remove('active'))
    document.querySelector('.preset-tab[data-tab="save"]').classList.add('active')
    document.getElementById('save-tab').classList.add('active')
    resetPresetForm()
  })
  presetCloseBtn.addEventListener('click',()=>{presetModal.classList.remove('visible');resetPresetForm()})
  presetCancelBtn.addEventListener('click',()=>{presetModal.classList.remove('visible');resetPresetForm()})
  presetCancelEditBtn.addEventListener('click',()=>{resetPresetForm()})
  presetModal.addEventListener('click',(e)=>{
    if(e.target===presetModal){presetModal.classList.remove('visible');resetPresetForm()}
  })
  presetSaveBtn.addEventListener('click',()=>{
    const name=presetNameInput.value.trim()
    if(!name){showAlert('Please enter a name for the preset');return}
    if(!includeTempoCheck.checked&&!includeTimeSignatureCheck.checked&&!includeSubdivisionCheck.checked&&!includeAccentPatternCheck.checked&&!includeSoundCheck.checked&&!includeVolumeCheck.checked&&!includeVoiceSettingsCheck.checked){
      showAlert('Please select at least one setting to include in the preset');return
    }
    const preset={
      id:Date.now().toString(),
      name:name,
      description:presetDescInput.value.trim(),
      createdAt:new Date().toISOString(),
      settings:{}
    }
    if(includeTempoCheck.checked){preset.settings.tempo=parseInt(document.getElementById('preset-tempo-value').value)}
    if(includeTimeSignatureCheck.checked){
      preset.settings.beatsPerMeasure=parseInt(document.getElementById('preset-time-sig-numerator').textContent)
      preset.settings.noteValue=parseInt(document.getElementById('preset-time-sig-denominator').textContent)
    }
    if(includeSubdivisionCheck.checked){preset.settings.subdivision=parseInt(document.getElementById('preset-subdivision-selector').value)}
    if(includeAccentPatternCheck.checked){
      const presetAccentButtons=document.querySelectorAll('.preset-accent-button')
      preset.settings.accentPattern=[]
      presetAccentButtons.forEach(btn=>{preset.settings.accentPattern.push(btn.dataset.state)})
    }
    if(includeSoundCheck.checked){preset.settings.sound=selectedSound}
    if(includeVolumeCheck.checked){preset.settings.volume=Math.round((volume/1.5)*100)}
    if(includeVoiceSettingsCheck.checked){
      preset.settings.useVoiceCounting=document.getElementById('preset-use-voice-counting').checked
      preset.settings.useClickSubdivision=document.getElementById('preset-use-click-subdivision').checked
      preset.settings.voiceVolume=parseInt(document.getElementById('preset-voice-volume-slider').value)
    }
    savePresetToStorage(preset)
    resetPresetForm()
    presetModal.classList.remove('visible')
    renderUserPresets()
    loadUserPresetsToGrid()
  })
  presetUpdateBtn.addEventListener('click',()=>{
    if(!currentEditingPresetId)return
    const name=presetNameInput.value.trim()
    if(!name){showAlert('Please enter a name for the preset');return}
    if(!includeTempoCheck.checked&&!includeTimeSignatureCheck.checked&&!includeSubdivisionCheck.checked&&!includeAccentPatternCheck.checked&&!includeSoundCheck.checked&&!includeVolumeCheck.checked&&!includeVoiceSettingsCheck.checked){
      showAlert('Please select at least one setting to include in the preset');return
    }
    const presets=getUserPresets()
    const presetIndex=presets.findIndex(p=>p.id===currentEditingPresetId)
    if(presetIndex===-1)return
    const updatedPreset={
      id:currentEditingPresetId,
      name:name,
      description:presetDescInput.value.trim(),
      createdAt:presets[presetIndex].createdAt,
      updatedAt:new Date().toISOString(),
      settings:{}
    }
    if(includeTempoCheck.checked){updatedPreset.settings.tempo=parseInt(document.getElementById('preset-tempo-value').value)}
    if(includeTimeSignatureCheck.checked){
      updatedPreset.settings.beatsPerMeasure=parseInt(document.getElementById('preset-time-sig-numerator').textContent)
      updatedPreset.settings.noteValue=parseInt(document.getElementById('preset-time-sig-denominator').textContent)
    }
    if(includeSubdivisionCheck.checked){updatedPreset.settings.subdivision=parseInt(document.getElementById('preset-subdivision-selector').value)}
    if(includeAccentPatternCheck.checked){
      const presetAccentButtons=document.querySelectorAll('.preset-accent-button')
      updatedPreset.settings.accentPattern=[]
      presetAccentButtons.forEach(btn=>{updatedPreset.settings.accentPattern.push(btn.dataset.state)})
    }
    if(includeSoundCheck.checked){updatedPreset.settings.sound=selectedSound}
    if(includeVolumeCheck.checked){updatedPreset.settings.volume=Math.round((volume/1.5)*100)}
    if(includeVoiceSettingsCheck.checked){
      updatedPreset.settings.useVoiceCounting=document.getElementById('preset-use-voice-counting').checked
      updatedPreset.settings.useClickSubdivision=document.getElementById('preset-use-click-subdivision').checked
      updatedPreset.settings.voiceVolume=parseInt(document.getElementById('preset-voice-volume-slider').value)
    }
    presets[presetIndex]=updatedPreset
    localStorage.setItem('metronomePresets',JSON.stringify(presets))
    resetPresetForm()
    presetModal.classList.remove('visible')
    renderUserPresets()
    loadUserPresetsToGrid()
  })
  function resetPresetForm(){
    presetForm.reset()
    currentEditingPresetId=null
    presetNameInput.value=''
    presetDescInput.value=''
    includeTempoCheck.checked=true
    includeTimeSignatureCheck.checked=false
    includeSubdivisionCheck.checked=false
    includeAccentPatternCheck.checked=false
    includeSoundCheck.checked=false
    includeVolumeCheck.checked=false
    includeVoiceSettingsCheck.checked=false
    saveTabButtons.style.display='flex'
    editTabButtons.style.display='none'
  }
  function savePresetToStorage(preset){
    const presets=getUserPresets()
    presets.push(preset)
    localStorage.setItem('metronomePresets',JSON.stringify(presets))
    renderUserPresets()
    loadUserPresetsToGrid()
  }
  function getUserPresets(){
    const presets=localStorage.getItem('metronomePresets')
    return presets?JSON.parse(presets):[]
  }
  function renderUserPresets(){
    const presets=getUserPresets()
    Array.from(presetList.children).forEach(child=>{
      if(child!==emptyPresets){child.remove()}
    })
    if(presets.length===0){emptyPresets.style.display='block';return}
    else{emptyPresets.style.display='none'}
    presets.forEach(preset=>{
      const presetItem=document.createElement('div')
      presetItem.className='preset-item'
      presetItem.dataset.id=preset.id
      const includesString=getIncludedSettingsString(preset)
      presetItem.innerHTML=`
        <h3 class="preset-item-title">${preset.name}</h3>
        ${preset.description?`<p class="preset-item-description">${preset.description}</p>`:''}
        ${preset.settings.tempo?`<div class="preset-item-tempo">${preset.settings.tempo} BPM</div>`:''}
        <div class="preset-item-includes">${includesString}</div>
        <div class="preset-item-actions">
          <button class="preset-action-btn edit" aria-label="Edit preset">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </button>
          <button class="preset-action-btn delete" aria-label="Delete preset">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `
      presetItem.addEventListener('click',(e)=>{
        if(!e.target.closest('.preset-action-btn')){
          applyPreset(preset)
          presetModal.classList.remove('visible')
        }
      })
      const editBtn=presetItem.querySelector('.edit')
      if(editBtn){editBtn.addEventListener('click',(e)=>{e.stopPropagation();enterEditMode(preset)})}
      const deleteBtn=presetItem.querySelector('.delete')
      if(deleteBtn){deleteBtn.addEventListener('click',(e)=>{e.stopPropagation();deletePreset(preset.id)})}
      presetList.appendChild(presetItem)
    })
  }
  function getIncludedSettingsString(preset){
    const settings=[]
    if(preset.settings.tempo) settings.push('Tempo')
    if(preset.settings.beatsPerMeasure) settings.push('Time Signature')
    if(preset.settings.subdivision) settings.push('Subdivision')
    if(preset.settings.accentPattern) settings.push('Accent Pattern')
    if(preset.settings.sound) settings.push('Sound')
    if(preset.settings.volume) settings.push('Volume')
    if(preset.settings.useVoiceCounting!==undefined) settings.push('Voice Settings')
    if(settings.length===0)return''
    return `<span class="preset-included-settings">Includes: ${settings.join(', ')}</span>`
  }
  function enterEditMode(preset){
    currentEditingPresetId=preset.id
    presetTabs.forEach(t=>t.classList.remove('active'))
    presetTabContents.forEach(c=>c.classList.remove('active'))
    document.querySelector('.preset-tab[data-tab="save"]').classList.add('active')
    document.getElementById('save-tab').classList.add('active')
    presetNameInput.value=preset.name||''
    presetDescInput.value=preset.description||''
    includeTempoCheck.checked=!!preset.settings.tempo
    includeTimeSignatureCheck.checked=!!preset.settings.beatsPerMeasure
    includeSubdivisionCheck.checked=!!preset.settings.subdivision
    includeAccentPatternCheck.checked=!!preset.settings.accentPattern
    includeSoundCheck.checked=!!preset.settings.sound
    includeVolumeCheck.checked=!!preset.settings.volume
    includeVoiceSettingsCheck.checked=preset.settings.useVoiceCounting!==undefined
    saveTabButtons.style.display='none'
    editTabButtons.style.display='flex'
  }
  function deletePreset(presetId){
    showConfirm('Are you sure you want to delete this preset?',()=>{
      const presets=getUserPresets()
      const updatedPresets=presets.filter(p=>p.id!==presetId)
      localStorage.setItem('metronomePresets',JSON.stringify(updatedPresets))
      renderUserPresets()
      loadUserPresetsToGrid()
    })
  }
  function applyPreset(preset){
    const settings=preset.settings
    if(settings.tempo){updateTempo(settings.tempo)}
    if(settings.beatsPerMeasure&&settings.noteValue){
      updateBeatsPerMeasure(settings.beatsPerMeasure)
      updateNoteValue(settings.noteValue)
    }
    if(settings.subdivision){subdivision=settings.subdivision;subdivisionSelector.value=settings.subdivision}
    if(settings.accentPattern){
      const accentButtons=document.querySelectorAll('.accent-button')
      settings.accentPattern.forEach((state,index)=>{
        if(index<accentButtons.length){
          const btn=accentButtons[index]
          btn.dataset.state=state
          btn.classList.remove('accent','silent')
          if(state==='accent'){btn.classList.add('accent')}
          else if(state==='silent'){btn.classList.add('silent')}
        }
      })
      updateBeatLights()
    }
    if(settings.sound){
      selectedSound=settings.sound
      soundButtons.forEach(btn=>{
        btn.classList.remove('selected')
        if(btn.dataset.sound===settings.sound){btn.classList.add('selected')}
      })
    }
    if(settings.volume!==undefined){
      volume=(settings.volume/100)*1.5
      volumeSlider.value=settings.volume
    }
    if(settings.useVoiceCounting!==undefined){
      useVoiceCounting=settings.useVoiceCounting
      useVoiceCountingCheckbox.checked=settings.useVoiceCounting
      voiceOptionsPanel.style.display=settings.useVoiceCounting?'block':'none'
      if(settings.useClickSubdivision!==undefined){
        useClickSubdivision=settings.useClickSubdivision
        useClickSubdivisionCheckbox.checked=settings.useClickSubdivision
      }
      if(settings.voiceVolume!==undefined){
        voiceVolume=(settings.voiceVolume/100)*1.5
        voiceVolumeSlider.value=settings.voiceVolume
      }
    }
    if(isPlaying){restartMetronome()}
  }
  function loadUserPresetsToGrid(){
    const presets=getUserPresets()
    const defaultPresetCount=7
    const children=Array.from(presetsGrid.children)
    for(let i=defaultPresetCount;i<children.length;i++){
      children[i].remove()
    }
    presets.forEach(preset=>{
      if(preset.settings.tempo){
        const presetButton=document.createElement('button')
        presetButton.className='preset-button user-preset'
        presetButton.dataset.id=preset.id
        presetButton.innerHTML=`
          <span class="preset-tempo">${preset.settings.tempo}</span>
          <span class="preset-name">${preset.name}</span>
        `
        presetButton.addEventListener('click',()=>{applyPreset(preset)})
        presetsGrid.appendChild(presetButton)
      }
    })
  }
  function showAlert(message,callback){
    alertMessage.textContent=message
    alertModal.classList.add('visible')
    alertConfirm.onclick=()=>{
      alertModal.classList.remove('visible')
      if(callback) callback()
    }
  }
  function showConfirm(message,onConfirm){
    confirmMessage.textContent=message
    confirmModal.classList.add('visible')
    confirmCallback=onConfirm
    confirmOk.onclick=()=>{
      confirmModal.classList.remove('visible')
      if(confirmCallback) confirmCallback()
    }
    confirmCancel.onclick=()=>{
      confirmModal.classList.remove('visible')
    }
  }
  function initializePresetControls(){
    document.getElementById('preset-tempo-value').value=currentTempo
    document.getElementById('preset-time-sig-numerator').textContent=beatsPerMeasure
    document.getElementById('preset-time-sig-denominator').textContent=noteValue
    document.getElementById('preset-subdivision-selector').value=subdivision
    presetSoundButtons.forEach(btn=>{
      btn.classList.remove('selected')
      if(btn.dataset.sound===selectedSound){
        btn.classList.add('selected')
      }
      btn.addEventListener('click',()=>{
        presetSoundButtons.forEach(b=>b.classList.remove('selected'))
        btn.classList.add('selected')
        selectedSound=btn.dataset.sound
      })
    })
    presetVolumeSlider.value=Math.round((volume/1.5)*100)
    presetVoiceVolumeSlider.value=Math.round((voiceVolume/1.5)*100)
    document.getElementById('preset-use-voice-counting').checked=useVoiceCounting
    document.getElementById('preset-use-click-subdivision').checked=useClickSubdivision
    presetDecreaseBeats.addEventListener('click',()=>{
      const currentValue=parseInt(document.getElementById('preset-time-sig-numerator').textContent)
      if(currentValue>1){document.getElementById('preset-time-sig-numerator').textContent=currentValue-1}
    })
    presetIncreaseBeats.addEventListener('click',()=>{
      const currentValue=parseInt(document.getElementById('preset-time-sig-numerator').textContent)
      if(currentValue<12){document.getElementById('preset-time-sig-numerator').textContent=currentValue+1}
    })
    presetDecreaseNoteValue.addEventListener('click',()=>{
      const currentIndex=validNoteValues.indexOf(parseInt(document.getElementById('preset-time-sig-denominator').textContent))
      if(currentIndex>0){document.getElementById('preset-time-sig-denominator').textContent=validNoteValues[currentIndex-1]}
    })
    presetIncreaseNoteValue.addEventListener('click',()=>{
      const currentIndex=validNoteValues.indexOf(parseInt(document.getElementById('preset-time-sig-denominator').textContent))
      if(currentIndex<validNoteValues.length-1){document.getElementById('preset-time-sig-denominator').textContent=validNoteValues[currentIndex+1]}
    })
  }
  function updatePresetAccentPattern(){
    const presetAccentPattern=document.getElementById('preset-accent-pattern')
    if(!presetAccentPattern)return
    presetAccentPattern.innerHTML=''
    const beats=parseInt(document.getElementById('preset-time-sig-numerator').textContent)
    for(let i=0;i<beats;i++){
      const mainAccentButton=document.querySelector(`.accent-button[data-beat="${i+1}"]`)
      let initialState='normal'
      if(mainAccentButton){initialState=mainAccentButton.dataset.state}
      else{
        const noteVal=parseInt(document.getElementById('preset-time-sig-denominator').textContent)
        if(noteVal===8&&(beats===6||beats===9||beats===12)){
          if(i%3===0){initialState='accent'}
        }else{
          if(i===0){initialState='accent'}
        }
      }
      const beatBtn=document.createElement('button')
      beatBtn.className='preset-accent-button'
      beatBtn.dataset.beat=i+1
      beatBtn.dataset.state=initialState
      beatBtn.type="button"
      if(initialState==='accent'){beatBtn.classList.add('accent')}
      else if(initialState==='silent'){beatBtn.classList.add('silent')}
      beatBtn.innerHTML=`<span>${i+1}</span>`
      beatBtn.onclick=function(){
        const current=this.dataset.state
        let next
        if(current==='normal'){next='accent'}
        else if(current==='accent'){next='silent'}
        else{next='normal'}
        this.dataset.state=next
        this.classList.remove('accent','silent')
        if(next==='accent'){this.classList.add('accent')}
        else if(next==='silent'){this.classList.add('silent')}
        return false
      }
      presetAccentPattern.appendChild(beatBtn)
    }
  }
  includeAccentPatternCheck.addEventListener('change',()=>{
    if(includeAccentPatternCheck.checked){updatePresetAccentPattern()}
  })
  presetDecreaseBeats.addEventListener('click',updatePresetAccentPattern)
  presetIncreaseBeats.addEventListener('click',updatePresetAccentPattern)
  presetModal.addEventListener('transitionend',()=>{
    if(presetModal.classList.contains('visible')){
      if(includeAccentPatternCheck.checked){updatePresetAccentPattern()}
    }
  })
  initializePresetControls()
  initAudio()
}
