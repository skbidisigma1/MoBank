document.addEventListener('DOMContentLoaded', () => {
    initializeMetronomeUI();
  });
  
  function initializeMetronomeUI() {
    const tempoSlider = document.getElementById('tempo-slider');
    const tempoDisplay = document.getElementById('tempo-display');
    const tempoDecreaseBtn = document.getElementById('tempo-decrease');
    const tempoIncreaseBtn = document.getElementById('tempo-increase');
    const tempoPlayBtn = document.getElementById('tempo-play');
    const decreaseBeatsBtn = document.querySelector('[data-action="decrease-beats"]');
    const increaseBeatsBtn = document.querySelector('[data-action="increase-beats"]');
    const decreaseNoteValueBtn = document.querySelector('[data-action="decrease-note-value"]');
    const increaseNoteValueBtn = document.querySelector('[data-action="increase-note-value"]');
    const timeSignatureNumerator = document.getElementById('time-sig-numerator');
    const timeSignatureDenominator = document.getElementById('time-sig-denominator');
    const accentPattern = document.getElementById('accent-pattern');
    const soundButtons = document.querySelectorAll('.sound-button');
    const volumeSlider = document.getElementById('volume-slider');
    const presetButtons = document.querySelectorAll('.preset-button');
    const savePresetBtn = document.getElementById('save-preset');
    const savePresetModal = document.getElementById('save-preset-modal');
    const presetForm = document.getElementById('preset-form');
    const cancelSavePresetBtn = document.getElementById('cancel-save-preset');
    const pendulum = document.querySelector('.tempo-pendulum');
    const subdivisionSelector = document.getElementById('subdivision-selector');
    const tapButton = document.getElementById('tap-tempo-button');
    const tapDisplay = document.getElementById('tap-tempo-display');
    
    // Voice counting elements
    const useVoiceCountingCheckbox = document.getElementById('use-voice-counting');
    const voiceOptionsPanel = document.querySelector('.voice-options-panel');
    const voiceSelector = document.getElementById('voice-selector');
    const useClickSubdivisionCheckbox = document.getElementById('use-click-subdivision');
    const enableCountInCheckbox = document.getElementById('enable-count-in');
    const voiceVolumeSlider = document.getElementById('voice-volume-slider');
    
    let isPlaying = false;
    let currentTempo = parseInt(tempoDisplay.value);
    let beatsPerMeasure = parseInt(timeSignatureNumerator.textContent);
    let noteValue = parseInt(timeSignatureDenominator.textContent);
    let subdivision = parseInt(subdivisionSelector.value);
    let currentBeat = 0;
    let pendulumAngle = 0;
    let selectedSound = 'click';
    let volume = parseFloat(volumeSlider.value) / 100 * 1.5;
    let metronomeInterval = null;
    let audioContext = null;
    let tempoDebounceTimeout = null;
    let sounds = {
      click: { hi: null, lo: null },
      glassTick: { hi: null, lo: null },
      bell: { hi: null, lo: null }
    };
    
    // Voice counting options
    let useVoiceCounting = false;
    let selectedVoice = 'male';
    let useClickSubdivision = true;
    let enableCountIn = false;
    let voiceVolume = parseFloat(voiceVolumeSlider.value) / 100 * 1.5;
    let voiceSounds = {
      male: {
        numbers: {}, // Will hold number sounds 1-12
        subdivisions: {} // Will hold subdivision sounds (e, and, a, trip, let)
      }
    };
    let countInActive = false;
    let countInMeasure = 0;
    let pendulumRaf = null;
    let metronomeStartTime = 0;
    const validNoteValues = [1, 2, 4, 8, 16, 32];
    let tapTimes = [];
    let tapTimeout = null;
  
    async function initAudio() {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await loadSounds();
        await loadVoiceSounds();
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    }
  
    async function loadSounds() {
      try {
        const soundFiles = [
          { name: 'glassTick', file: 'Perc_Glass_hi.wav', type: 'hi' },
          { name: 'glassTick', file: 'Perc_Glass_lo.wav', type: 'lo' },
          { name: 'click', file: 'Perc_Tongue_hi.wav', type: 'hi' },
          { name: 'click', file: 'Perc_Tongue_lo.wav', type: 'lo' },
          { name: 'bell', file: 'Synth_Bell_A_hi.wav', type: 'hi' },
          { name: 'bell', file: 'Synth_Bell_A_lo.wav', type: 'lo' }
        ];
        const loadPromises = soundFiles.map(async (sound) => {
          try {
            const response = await fetch(`/tools/sounds/metronome/${sound.file}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            sounds[sound.name][sound.type] = audioBuffer;
          } catch (err) {
            console.error(`Error loading sound ${sound.file}:`, err);
          }
        });
        await Promise.all(loadPromises);
        const defaultSoundButton = document.querySelector(`.sound-button[data-sound="${selectedSound}"]`);
        if (defaultSoundButton) {
          defaultSoundButton.classList.add('selected');
        }
      } catch (error) {
        console.error('Error loading sounds:', error);
      }
    }
  
    async function loadVoiceSounds() {
      try {
        // Load number sounds 1-12
        const numberPromises = [];
        for (let i = 1; i <= 12; i++) {
          numberPromises.push(loadVoiceSound('male', 'numbers', i.toString(), `${i}.wav`));
        }
        
        // Load subdivision sounds
        const subdivisionFiles = [
          { name: 'e', file: 'e.wav' },
          { name: 'and', file: 'and.wav' },
          { name: 'a', file: 'a.wav' },
          { name: 'trip', file: 'trip.wav' },
          { name: 'let', file: 'let.wav' }
        ];
        
        const subdivisionPromises = subdivisionFiles.map(sound => 
          loadVoiceSound('male', 'subdivisions', sound.name, sound.file)
        );
        
        await Promise.all([...numberPromises, ...subdivisionPromises]);
      } catch (error) {
        console.error('Error loading voice sounds:', error);
      }
    }
    
    async function loadVoiceSound(voice, category, name, filename) {
      try {
        const response = await fetch(`/tools/sounds/metronome/voice/${voice}/${filename}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        if (!voiceSounds[voice][category]) {
          voiceSounds[voice][category] = {};
        }
        
        voiceSounds[voice][category][name] = audioBuffer;
      } catch (err) {
        console.error(`Error loading voice sound ${filename}:`, err);
      }
    }
    
    function playVoiceSound(number) {
      if (!audioContext || !voiceSounds[selectedVoice].numbers[number]) return;
      
      const soundBuffer = voiceSounds[selectedVoice].numbers[number];
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      
      source.buffer = soundBuffer;
      gainNode.gain.value = voiceVolume;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start(0);
    }
    
    function playVoiceSubdivision(type) {
      if (!audioContext || !voiceSounds[selectedVoice].subdivisions[type]) return;
      
      const soundBuffer = voiceSounds[selectedVoice].subdivisions[type];
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      
      source.buffer = soundBuffer;
      gainNode.gain.value = voiceVolume * 0.8; // Slightly quieter than the main beat
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start(0);
    }
  
    function playSound(isAccent) {
      if (!audioContext || !sounds[selectedSound]) return;
      const soundBuffer = isAccent ? sounds[selectedSound].hi : sounds[selectedSound].lo;
      if (!soundBuffer) return;
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      source.buffer = soundBuffer;
      gainNode.gain.value = volume;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start(0);
    }
  
    function tempoToSliderPosition(tempo) {
      const minTempo = 10;
      const maxTempo = 1000;
      const logMin = Math.log(minTempo);
      const logMax = Math.log(maxTempo);
      const scale = 100 / (logMax - logMin);
      return scale * (Math.log(tempo) - logMin);
    }
      
    function sliderPositionToTempo(position) {
      const minTempo = 10;
      const maxTempo = 1000;
      const logMin = Math.log(minTempo);
      const logMax = Math.log(maxTempo);
      return Math.round(Math.exp(logMin + position * (logMax - logMin) / 100));
    }
  
    function updateTempo(value) {
      currentTempo = Math.min(Math.max(value, 10), 1000);
      tempoDisplay.value = currentTempo;
      tempoSlider.value = tempoToSliderPosition(currentTempo);
      if (isPlaying) {
        clearTimeout(tempoDebounceTimeout);
        tempoDebounceTimeout = setTimeout(() => {
          restartMetronome();
        }, 150);
      }
    }
  
    function updateBeatsPerMeasure(value) {
      beatsPerMeasure = Math.min(Math.max(value, 1), 12);
      timeSignatureNumerator.textContent = beatsPerMeasure;
      updateAccentPattern();
      updateBeatLights();
      if (isPlaying) restartMetronome();
    }
      
    function updateAccentPattern() {
      accentPattern.innerHTML = '';
      for (let i = 0; i < beatsPerMeasure; i++) {
        let initialState = 'normal';
        if (noteValue === 8 && (beatsPerMeasure === 6 || beatsPerMeasure === 9 || beatsPerMeasure === 12)) {
          if (i % 3 === 0) {
            initialState = 'accent';
          }
        } else {
          if (i === 0) {
            initialState = 'accent';
          }
        }
        const beatBtn = document.createElement('button');
        beatBtn.className = 'accent-button';
        beatBtn.dataset.beat = i + 1;
        beatBtn.dataset.state = initialState;
        if (initialState === 'accent') {
          beatBtn.classList.add('accent');
        } else if (initialState === 'silent') {
          beatBtn.classList.add('silent');
        }
        beatBtn.innerHTML = `<span>${i + 1}</span>`;
        beatBtn.addEventListener('click', () => {
          const current = beatBtn.dataset.state;
          let next;
          if (current === 'normal') {
            next = 'accent';
          } else if (current === 'accent') {
            next = 'silent';
          } else {
            next = 'normal';
          }
          beatBtn.dataset.state = next;
          beatBtn.classList.remove('accent', 'silent');
          if (next === 'accent') {
            beatBtn.classList.add('accent');
          } else if (next === 'silent') {
            beatBtn.classList.add('silent');
          }
          updateBeatLights();
        });
        accentPattern.appendChild(beatBtn);
      }
    }
      
    function updateBeatLights() {
      const beatLightsContainer = document.querySelector('.beat-lights');
      beatLightsContainer.innerHTML = '';
      for (let i = 0; i < beatsPerMeasure; i++) {
        const accentButton = document.querySelector(`.accent-button[data-beat="${i + 1}"]`);
        let state = 'normal';
        if (accentButton) state = accentButton.dataset.state;
        const beatLight = document.createElement('div');
        beatLight.className = 'beat-light';
        if (state === 'accent') {
          beatLight.classList.add('accent');
        } else if (state === 'silent') {
          beatLight.classList.add('silent');
        }
        beatLight.dataset.beat = i + 1;
        beatLightsContainer.appendChild(beatLight);
      }
    }
      
    function updateNoteValue(value) {
      if (validNoteValues.includes(value)) {
        noteValue = value;
        timeSignatureDenominator.textContent = noteValue;
        updateAccentPattern();
        updateBeatLights();
        if (isPlaying) restartMetronome();
      }
    }
  
    subdivisionSelector.addEventListener('change', () => {
      subdivision = parseInt(subdivisionSelector.value);
      if (isPlaying) restartMetronome();
    });
  
    async function startMetronome() {
      if (audioContext === null) {
        await initAudio();
      } else if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      isPlaying = true;
      currentBeat = 0;
      let subBeat = 0;
      pendulumAngle = 0;
      pendulum.style.transform = `rotate(${pendulumAngle}rad)`;
      metronomeStartTime = performance.now();
      
      tempoPlayBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/>
        </svg>
      `;
      
      const baseInterval = (60 / currentTempo) * 1000 * (4 / noteValue);
      const playbackInterval = subdivision > 1 ? baseInterval / subdivision : baseInterval;
      
      countInActive = enableCountIn && useVoiceCounting;
      countInMeasure = 0;
      
      if (!countInActive) {
        const firstButton = document.querySelector('.accent-button[data-beat="1"]');
        const firstState = firstButton ? firstButton.dataset.state : 'normal';
        
        if (firstState !== 'silent') {
          if (useVoiceCounting) {
            playVoiceSound('1');
          } else {
            if (firstState === 'accent') {
              playSound(true);
            } else {
              playSound(false);
            }
          }
        }
      } else {
        playVoiceSound('1');
      }
      
      updateVisualBeat(0);
      subBeat = 1;
      
      if (pendulumRaf) cancelAnimationFrame(pendulumRaf);
      animatePendulum(baseInterval, playbackInterval);
      
      metronomeInterval = setInterval(() => {
        const isMainBeat = subBeat % subdivision === 0;
        const mainBeatIndex = Math.floor(subBeat / subdivision);
        const beatInMeasure = mainBeatIndex % beatsPerMeasure;
        
        if (countInActive) {
          if (isMainBeat) {
            const beatNumber = mainBeatIndex % beatsPerMeasure + 1;
            
            if (beatNumber === 1) {
              countInMeasure++;
              if (countInMeasure > 1) {
                countInActive = false;
              }
            }
            
            if (beatNumber <= 12) {
              playVoiceSound(beatNumber.toString());
            }
            
            updateVisualBeat(beatInMeasure);
          }
        } else if (isMainBeat) {
          const button = document.querySelector(`.accent-button[data-beat="${beatInMeasure + 1}"]`);
          const state = button ? button.dataset.state : 'normal';
          
          if (state !== 'silent') {
            if (useVoiceCounting) {
              const beatNumber = beatInMeasure + 1;
              if (beatNumber <= 12) {
                playVoiceSound(beatNumber.toString());
              }
            } else {
              if (state === 'accent') {
                playSound(true);
              } else {
                playSound(false);
              }
            }
          }
          
          updateVisualBeat(beatInMeasure);
        } else {
          playSubdivisionSound(subBeat % subdivision);
        }
        
        subBeat = (subBeat + 1) % (beatsPerMeasure * subdivision);
      }, playbackInterval);
    }
  
    function playSubdivisionSound(subdivisionPosition) {
      // If voice counting is disabled or user has selected to use click for subdivisions
      if (!useVoiceCounting || useClickSubdivision) {
        if (!audioContext || !sounds[selectedSound]) return;
        const soundBuffer = sounds[selectedSound].lo;
        if (!soundBuffer) return;
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        source.buffer = soundBuffer;
        gainNode.gain.value = volume * 0.6; // Slightly quieter for subdivisions
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start(0);
        return;
      }
      
      // Use voice subdivisions
      if (!audioContext) return;
      
      // Choose the right verbal subdivision based on the subdivision type and position
      let subdivisionSound;
      
      if (subdivision === 2) {
        // For duplets, use "&" (and)
        subdivisionSound = 'and';
      } else if (subdivision === 3) {
        // For triplets, use "trip" and "let"
        if (subdivisionPosition === 1) {
          subdivisionSound = 'trip';
        } else if (subdivisionPosition === 2) {
          subdivisionSound = 'let';
        }
      } else if (subdivision === 4) {
        // For 16ths, use "e", "&", "a"
        if (subdivisionPosition === 1) {
          subdivisionSound = 'e';
        } else if (subdivisionPosition === 2) {
          subdivisionSound = 'and';
        } else if (subdivisionPosition === 3) {
          subdivisionSound = 'a';
        }
      }
      
      if (subdivisionSound) {
        playVoiceSubdivision(subdivisionSound);
      }
    }
      
    function stopMetronome() {
      isPlaying = false;
      clearInterval(metronomeInterval);
      if (pendulumRaf) {
        cancelAnimationFrame(pendulumRaf);
        pendulumRaf = null;
      }
      pendulumAngle = 0;
      pendulum.style.transition = 'transform 0.5s ease-out';
      pendulum.style.transform = `rotate(${pendulumAngle}rad)`;
      tempoPlayBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
        </svg>
      `;
      document.querySelectorAll('.beat-light').forEach(light => light.classList.remove('active'));
    }
      
    function restartMetronome() {
      if (isPlaying) {
        stopMetronome();
        startMetronome();
      }
    }
      
    function updateVisualBeat(beatIndex) {
      document.querySelectorAll('.beat-light').forEach(light => light.classList.remove('active'));
      const currentBeatLight = document.querySelector(`.beat-light[data-beat="${beatIndex + 1}"]`);
      if (currentBeatLight) currentBeatLight.classList.add('active');
    }
      
    function animatePendulum(baseInterval, playbackInterval) {
      const period = baseInterval;
      const now = performance.now();
      const elapsed = now - metronomeStartTime;
      const progress = (elapsed % period) / period;
      const beatIndex = Math.floor(elapsed / period);
      const direction = beatIndex % 2 === 0 ? 1 : -1;
      pendulumAngle = Math.sin(progress * Math.PI) * (Math.PI / 8) * direction;
      pendulum.style.transition = 'none';
      pendulum.style.transform = `rotate(${pendulumAngle}rad)`;
      pendulumRaf = requestAnimationFrame(() => animatePendulum(baseInterval, playbackInterval));
    }
  
    tempoSlider.value = tempoToSliderPosition(currentTempo);
    tempoSlider.addEventListener('input', () => {
      updateTempo(sliderPositionToTempo(parseFloat(tempoSlider.value)));
    });
    tempoDisplay.addEventListener('change', () => updateTempo(parseInt(tempoDisplay.value)));
    tempoDecreaseBtn.addEventListener('click', () => updateTempo(currentTempo - 1));
    tempoIncreaseBtn.addEventListener('click', () => updateTempo(currentTempo + 1));
    tempoPlayBtn.addEventListener('click', () => isPlaying ? stopMetronome() : startMetronome());
    decreaseBeatsBtn.addEventListener('click', () => updateBeatsPerMeasure(beatsPerMeasure - 1));
    increaseBeatsBtn.addEventListener('click', () => updateBeatsPerMeasure(beatsPerMeasure + 1));
    decreaseNoteValueBtn.addEventListener('click', () => {
      const currentIndex = validNoteValues.indexOf(noteValue);
      if (currentIndex > 0) updateNoteValue(validNoteValues[currentIndex - 1]);
    });
    increaseNoteValueBtn.addEventListener('click', () => {
      const currentIndex = validNoteValues.indexOf(noteValue);
      if (currentIndex < validNoteValues.length - 1) updateNoteValue(validNoteValues[currentIndex + 1]);
    });
    soundButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        soundButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedSound = btn.dataset.sound;
      });
    });
    volumeSlider.addEventListener('input', () => {
      volume = parseFloat(volumeSlider.value) / 100 * 1.5;
    });
    savePresetBtn.addEventListener('click', () => savePresetModal.style.display = 'flex');
    cancelSavePresetBtn.addEventListener('click', () => savePresetModal.style.display = 'none');
    presetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      savePresetModal.style.display = 'none';
    });
    tapButton.addEventListener('click', () => {
      const now = Date.now();
      if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) {
        tapTimes = [];
      }
      tapTimes.push(now);
      if (tapTimeout) clearTimeout(tapTimeout);
      tapTimeout = setTimeout(() => {
        tapTimes = [];
        tapDisplay.textContent = "-- BPM";
      }, 2000);
      if (tapTimes.length >= 2) {
        let intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
          intervals.push(tapTimes[i] - tapTimes[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const bpm = Math.round(60000 / avgInterval);
        tapDisplay.textContent = bpm + " BPM";
        updateTempo(bpm);
      }
    });
    updateAccentPattern();
    updateBeatLights();
    document.documentElement.style.setProperty('--metronome-accent-color', getComputedStyle(document.documentElement).getPropertyValue('--metronome-accent'));
    window.addEventListener('click', (e) => {
      if (e.target === savePresetModal) savePresetModal.style.display = 'none';
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        isPlaying ? stopMetronome() : startMetronome();
      }
      if (e.code === 'ArrowUp' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        updateTempo(currentTempo + 1);
      }
      if (e.code === 'ArrowDown' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        updateTempo(currentTempo - 1);
      }
    });

    // Add voice counting UI interactions
    useVoiceCountingCheckbox.addEventListener('change', () => {
      useVoiceCounting = useVoiceCountingCheckbox.checked;
      
      if (useVoiceCounting) {
        voiceOptionsPanel.classList.add('visible');
        // Disable the regular sound buttons when voice counting is enabled
        document.querySelector('.sound-selector').classList.add('disabled-sound');
      } else {
        voiceOptionsPanel.classList.remove('visible');
        document.querySelector('.sound-selector').classList.remove('disabled-sound');
      }
      
      if (isPlaying) restartMetronome();
    });
    
    voiceSelector.addEventListener('change', () => {
      selectedVoice = voiceSelector.value;
      if (isPlaying) restartMetronome();
    });
    
    useClickSubdivisionCheckbox.addEventListener('change', () => {
      useClickSubdivision = useClickSubdivisionCheckbox.checked;
      if (isPlaying) restartMetronome();
    });
    
    enableCountInCheckbox.addEventListener('change', () => {
      enableCountIn = enableCountInCheckbox.checked;
    });
    
    voiceVolumeSlider.addEventListener('input', () => {
      voiceVolume = parseFloat(voiceVolumeSlider.value) / 100 * 1.5;
    });
    
    // Presets
    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tempo = parseInt(btn.dataset.tempo);
        updateTempo(tempo);
      });
    });
  }
