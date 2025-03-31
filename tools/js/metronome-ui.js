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
    const signaturePresets = document.querySelectorAll('.signature-preset');
    const subdivisionSelector = document.getElementById('subdivision-selector');
    const accentPattern = document.getElementById('accent-pattern');
    const soundButtons = document.querySelectorAll('.sound-button');
    const volumeSlider = document.getElementById('volume-slider');
    const visualizationButtons = document.querySelectorAll('.toggle-button[data-visual]');
    const presetButtons = document.querySelectorAll('.preset-button');
    const savePresetBtn = document.getElementById('save-preset');
    const savePresetModal = document.getElementById('save-preset-modal');
    const presetForm = document.getElementById('preset-form');
    const cancelSavePresetBtn = document.getElementById('cancel-save-preset');
    const pendulum = document.querySelector('.tempo-pendulum');
    const beatLights = document.querySelectorAll('.beat-light');
    
    let isPlaying = false;
    let currentTempo = parseInt(tempoDisplay.value);
    let beatsPerMeasure = parseInt(timeSignatureNumerator.textContent);
    let noteValue = parseInt(timeSignatureDenominator.textContent);
    let subdivision = parseInt(subdivisionSelector.value);
    let currentBeat = 0;
    let pendulumDirection = 1;
    let pendulumAngle = 0;
    let selectedSound = 'glassTick';
    let volume = parseFloat(volumeSlider.value) / 100 * 1.5;
    let visualization = 'pendulum';
    let metronomeInterval = null;
    let audioContext = null;
    let sounds = {
        glassTick: { hi: null, lo: null },
        tongue: { hi: null, lo: null },
        bell: { hi: null, lo: null }
    };
    let pendulumRaf = null;
    let lastPendulumTime = 0;

    const validNoteValues = [1, 2, 4, 8, 16, 32];

    async function initAudio() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await loadSounds();
        } catch (error) {
            console.error('Error initializing audio:', error);
        }
    }

    async function loadSounds() {
        try {
            const soundFiles = [
                { name: 'glassTick', file: 'Perc_Glass_hi.wav', type: 'hi' },
                { name: 'glassTick', file: 'Perc_Glass_lo.wav', type: 'lo' },
                { name: 'tongue', file: 'Perc_Tongue_hi.wav', type: 'hi' },
                { name: 'tongue', file: 'Perc_Tongue_lo.wav', type: 'lo' },
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

    function playSound(isAccent) {
        if (!audioContext || !sounds[selectedSound]) return;
        
        const soundBuffer = isAccent ? 
            sounds[selectedSound].hi : 
            sounds[selectedSound].lo;
            
        if (!soundBuffer) return;
        
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = soundBuffer;
        
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        source.start(0);
    }

    function updateTempo(value) {
        currentTempo = Math.min(Math.max(value, 30), 360);
        tempoDisplay.value = currentTempo;
        tempoSlider.value = Math.min(Math.max(currentTempo, 30), 360);
        
        if (isPlaying) {
            restartMetronome();
        }
    }

    function updateBeatsPerMeasure(value) {
        beatsPerMeasure = Math.min(Math.max(value, 1), 12);
        timeSignatureNumerator.textContent = beatsPerMeasure;
        updateAccentPattern();
        updateBeatLights();
        
        if (isPlaying) {
            restartMetronome();
        }
    }
    
    function updateAccentPattern() {
        accentPattern.innerHTML = '';
        
        for (let i = 0; i < beatsPerMeasure; i++) {
            const beatBtn = document.createElement('button');
            beatBtn.className = i === 0 ? 'accent-button accent' : 'accent-button';
            beatBtn.dataset.beat = i + 1;
            beatBtn.innerHTML = `<span>${i + 1}</span>`;
            
            beatBtn.addEventListener('click', () => {
                beatBtn.classList.toggle('accent');
            });
            
            accentPattern.appendChild(beatBtn);
        }
    }
    
    function updateBeatLights() {
        const beatLightsContainer = document.querySelector('.beat-lights');
        beatLightsContainer.innerHTML = '';
        
        for (let i = 0; i < beatsPerMeasure; i++) {
            const beatLight = document.createElement('div');
            beatLight.className = i === 0 ? 'beat-light accent' : 'beat-light';
            beatLight.dataset.beat = i + 1;
            beatLightsContainer.appendChild(beatLight);
        }
    }
    
    function startMetronome() {
        if (audioContext === null) {
            initAudio();
        } else if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        isPlaying = true;
        currentBeat = 0;
        let subBeat = 0; // Track position within subdivisions
        
        tempoPlayBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/>
            </svg>
        `;
        
        // Calculate intervals
        const beatInterval = (60 / currentTempo) * 1000;
        
        // Different interval based on subdivision
        const playbackInterval = subdivision > 1 ? beatInterval / subdivision : beatInterval;
        
        if (visualization === 'pendulum') {
            lastPendulumTime = performance.now();
            if (pendulumRaf) cancelAnimationFrame(pendulumRaf);
            animatePendulum();
        }
        
        metronomeInterval = setInterval(() => {
            // Calculate whether we're on a main beat or a subdivision
            const isMainBeat = subBeat % subdivision === 0;
            const mainBeatIndex = Math.floor(subBeat / subdivision);
            const beatInMeasure = mainBeatIndex % beatsPerMeasure;
            
            if (isMainBeat) {
                // This is a main beat, check for accent
                const accentButton = document.querySelector(`.accent-button[data-beat="${beatInMeasure + 1}"]`);
                const isAccent = accentButton && accentButton.classList.contains('accent');
                
                // Play main beat sound (accented or not)
                playSound(isAccent);
                
                // Update visual beat indicator
                updateVisualBeat(beatInMeasure);
            } else {
                // This is a subdivision beat, play a softer sound
                playSubdivisionSound();
            }
            
            // Move to next sub-beat
            subBeat = (subBeat + 1) % (beatsPerMeasure * subdivision);
            
        }, playbackInterval);
    }
    
    // Play a softer sound for subdivisions
    function playSubdivisionSound() {
        if (!audioContext || !sounds[selectedSound]) return;
        
        const soundBuffer = sounds[selectedSound].lo;
        if (!soundBuffer) return;
        
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = soundBuffer;
        
        // Use a lower volume for subdivision beats (60% of main beat volume)
        gainNode.gain.value = volume * 0.6;
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        source.start(0);
    }
    
    function stopMetronome() {
        isPlaying = false;
        clearInterval(metronomeInterval);
        
        if (pendulumRaf) {
            cancelAnimationFrame(pendulumRaf);
            pendulumRaf = null;
        }
        
        tempoPlayBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
            </svg>
        `;
        
        document.querySelectorAll('.beat-light').forEach(light => {
            light.classList.remove('active');
        });
    }
    
    function restartMetronome() {
        if (isPlaying) {
            stopMetronome();
            startMetronome();
        }
    }
    
    function updateVisualBeat(beatIndex) {
        document.querySelectorAll('.beat-light').forEach(light => {
            light.classList.remove('active');
        });
        
        const currentBeatLight = document.querySelector(`.beat-light[data-beat="${beatIndex + 1}"]`);
        if (currentBeatLight) {
            currentBeatLight.classList.add('active');
        }
    }
    
    function animatePendulum() {
        const now = performance.now();
        const elapsed = now - lastPendulumTime;
        lastPendulumTime = now;
        
        const beatInterval = (60 / currentTempo) * 1000;
        
        const phase = (now / beatInterval) * Math.PI;
        
        pendulumAngle = Math.sin(phase) * (Math.PI / 8);
        
        pendulum.style.transition = 'none';
        pendulum.style.transform = `rotate(${pendulumAngle}rad)`;
        
        pendulumRaf = requestAnimationFrame(animatePendulum);
    }
    
    tempoSlider.addEventListener('input', () => {
        updateTempo(parseInt(tempoSlider.value));
    });
    
    tempoDisplay.addEventListener('change', () => {
        updateTempo(parseInt(tempoDisplay.value));
    });
    
    tempoDecreaseBtn.addEventListener('click', () => {
        updateTempo(currentTempo - 1);
    });
    
    tempoIncreaseBtn.addEventListener('click', () => {
        updateTempo(currentTempo + 1);
    });
    
    tempoPlayBtn.addEventListener('click', () => {
        if (isPlaying) {
            stopMetronome();
        } else {
            startMetronome();
        }
    });
    
    decreaseBeatsBtn.addEventListener('click', () => {
        updateBeatsPerMeasure(beatsPerMeasure - 1);
    });
    
    increaseBeatsBtn.addEventListener('click', () => {
        updateBeatsPerMeasure(beatsPerMeasure + 1);
    });
    
    // Update note value (denominator of time signature)
    function updateNoteValue(value) {
        const validValues = [1, 2, 4, 8, 16, 32];
        if (validValues.includes(value)) {
            noteValue = value;
            timeSignatureDenominator.textContent = noteValue;
            
            if (isPlaying) {
                restartMetronome();
            }
        }
    }
    
    decreaseNoteValueBtn.addEventListener('click', () => {
        const currentIndex = validNoteValues.indexOf(noteValue);
        if (currentIndex > 0) {
            updateNoteValue(validNoteValues[currentIndex - 1]);
        }
    });
    
    increaseNoteValueBtn.addEventListener('click', () => {
        const currentIndex = validNoteValues.indexOf(noteValue);
        if (currentIndex < validNoteValues.length - 1) {
            updateNoteValue(validNoteValues[currentIndex + 1]);
        }
    });
    
    signaturePresets.forEach(btn => {
        btn.addEventListener('click', () => {
            const top = parseInt(btn.dataset.top);
            const bottom = parseInt(btn.dataset.bottom);
            
            updateBeatsPerMeasure(top);
            updateNoteValue(bottom);
            
            signaturePresets.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            if (isPlaying) {
                restartMetronome();
            }
        });
    });
    
    subdivisionSelector.addEventListener('change', () => {
        subdivision = parseInt(subdivisionSelector.value);
        
        if (isPlaying) {
            restartMetronome();
        }
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
    
    visualizationButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            visualizationButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            visualization = btn.dataset.visual;
            
            if (isPlaying && visualization === 'pendulum') {
                lastPendulumTime = performance.now();
                if (pendulumRaf) cancelAnimationFrame(pendulumRaf);
                animatePendulum();
            }
        });
    });
    
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tempo = parseInt(btn.dataset.tempo);
            updateTempo(tempo);
            
            beatsPerMeasure = 4;
            timeSignatureNumerator.textContent = 4;
            updateNoteValue(4);
            updateAccentPattern();
            updateBeatLights();
            
            if (isPlaying) {
                restartMetronome();
            }
        });
    });
    
    savePresetBtn.addEventListener('click', () => {
        savePresetModal.style.display = 'flex';
    });
    
    cancelSavePresetBtn.addEventListener('click', () => {
        savePresetModal.style.display = 'none';
    });
    
    presetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        savePresetModal.style.display = 'none';
    });
    
    updateAccentPattern();
    updateBeatLights();
    
    document.documentElement.style.setProperty('--metronome-accent-color', 
        getComputedStyle(document.documentElement).getPropertyValue('--metronome-accent'));
    
    window.addEventListener('click', (e) => {
        if (e.target === savePresetModal) {
            savePresetModal.style.display = 'none';
        }
    });
    
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            if (isPlaying) {
                stopMetronome();
            } else {
                startMetronome();
            }
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
}