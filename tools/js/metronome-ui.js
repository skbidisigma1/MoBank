document.addEventListener('DOMContentLoaded', () => {
    initializeMetronomeUI();
});

function initializeMetronomeUI() {
    const tempoSlider = document.getElementById('tempo-slider');
    const tempoDisplay = document.getElementById('tempo-display');
    const tempoDecreaseBtn = document.getElementById('tempo-decrease');
    const tempoIncreaseBtn = document.getElementById('tempo-increase');
    const tempoPlayBtn = document.getElementById('tempo-play');
    const beatsPerMeasureInput = document.getElementById('beats-per-measure');
    const decreaseBeatsBtn = document.querySelector('[data-action="decrease-beats"]');
    const increaseBeatsBtn = document.querySelector('[data-action="increase-beats"]');
    const noteValueButtons = document.querySelectorAll('.note-value-button');
    const subdivisionSelector = document.getElementById('subdivision-selector');
    const accentPattern = document.getElementById('accent-pattern');
    const soundButtons = document.querySelectorAll('.sound-button');
    const volumeSlider = document.getElementById('volume-slider');
    const visualizationButtons = document.querySelectorAll('.toggle-button[data-visual]');
    const colorButtons = document.querySelectorAll('.color-button');
    const presetButtons = document.querySelectorAll('.preset-button');
    const savePresetBtn = document.getElementById('save-preset');
    const savePresetModal = document.getElementById('save-preset-modal');
    const presetForm = document.getElementById('preset-form');
    const cancelSavePresetBtn = document.getElementById('cancel-save-preset');
    const pendulum = document.querySelector('.tempo-pendulum');
    const beatLights = document.querySelectorAll('.beat-light');
    
    let isPlaying = false;
    let currentTempo = parseInt(tempoDisplay.value);
    let beatValue = 4;
    let beatsPerMeasure = parseInt(beatsPerMeasureInput.value);
    let subdivision = parseInt(subdivisionSelector.value);
    let currentBeat = 0;
    let pendulumDirection = 1;
    let pendulumAngle = 0;
    let selectedSound = 'glassTick';
    let volume = parseFloat(volumeSlider.value) / 100;
    let visualization = 'pendulum';
    let selectedColor = 'default';
    let metronomeInterval = null;
    let audioContext = null;
    let sounds = {
        glassTick: { hi: null, lo: null },
        tongue: { hi: null, lo: null },
        bell: { hi: null, lo: null }
    };
    let pendulumRaf = null;
    let lastPendulumTime = 0;

    // Initialize Web Audio API
    async function initAudio() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await loadSounds();
        } catch (error) {
            console.error('Error initializing audio:', error);
        }
    }

    // Load sound samples
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

            // Set default sound button as selected
            const defaultSoundButton = document.querySelector(`.sound-button[data-sound="${selectedSound}"]`);
            if (defaultSoundButton) {
                defaultSoundButton.classList.add('selected');
            }
        } catch (error) {
            console.error('Error loading sounds:', error);
        }
    }

    // Play a sound with specified parameters
    function playSound(isAccent) {
        if (!audioContext || !sounds[selectedSound]) return;
        
        const soundBuffer = isAccent ? 
            sounds[selectedSound].hi : 
            sounds[selectedSound].lo;
            
        if (!soundBuffer) return;
        
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = soundBuffer;
        
        // Set volume
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        source.start(0);
    }

    // Update the tempo
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
        beatsPerMeasureInput.value = beatsPerMeasure;
        updateAccentPattern();
        updateBeatLights();
        
        if (isPlaying) {
            restartMetronome();
        }
    }
    
    // Update the accent pattern display
    function updateAccentPattern() {
        accentPattern.innerHTML = '';
        
        for (let i = 0; i < beatsPerMeasure; i++) {
            const beatBtn = document.createElement('button');
            beatBtn.className = i === 0 ? 'accent-button accent' : 'accent-button';
            beatBtn.dataset.beat = i + 1;
            beatBtn.innerHTML = `<span>${i + 1}</span>`;
            
            beatBtn.addEventListener('click', () => {
                // Toggle accent state for beats other than the first
                if (i !== 0) {
                    beatBtn.classList.toggle('accent');
                }
            });
            
            accentPattern.appendChild(beatBtn);
        }
    }
    
    // Update beat lights to match beats per measure
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
    
    // Start the metronome
    function startMetronome() {
        if (audioContext === null) {
            initAudio();
        } else if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        isPlaying = true;
        currentBeat = 0;
        
        // Update UI
        tempoPlayBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/>
            </svg>
        `;
        
        // Calculate interval based on tempo and beat value
        const beatInterval = (60 / currentTempo) * 1000;
        
        // Start pendulum animation
        if (visualization === 'pendulum') {
            lastPendulumTime = performance.now();
            if (pendulumRaf) cancelAnimationFrame(pendulumRaf);
            animatePendulum();
        }
        
        // Start the metronome
        metronomeInterval = setInterval(() => {
            const beatInMeasure = currentBeat % beatsPerMeasure;
            
            // Determine if this beat should be accented (first beat in measure)
            const isAccent = beatInMeasure === 0;
            
            // Play the appropriate sound
            playSound(isAccent);
            
            // Update visual beat indicator
            updateVisualBeat(beatInMeasure);
            
            // Move to next beat
            currentBeat = (currentBeat + 1) % (beatsPerMeasure);
        }, beatInterval);
    }
    
    // Stop the metronome
    function stopMetronome() {
        isPlaying = false;
        clearInterval(metronomeInterval);
        
        // Stop pendulum animation
        if (pendulumRaf) {
            cancelAnimationFrame(pendulumRaf);
            pendulumRaf = null;
        }
        
        // Reset UI
        tempoPlayBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
            </svg>
        `;
        
        // Reset beat lights
        document.querySelectorAll('.beat-light').forEach(light => {
            light.classList.remove('active');
        });
    }
    
    // Restart the metronome (used when settings change)
    function restartMetronome() {
        if (isPlaying) {
            stopMetronome();
            startMetronome();
        }
    }
    
    // Update the visual beat indicator
    function updateVisualBeat(beatIndex) {
        // Clear all active beat lights
        document.querySelectorAll('.beat-light').forEach(light => {
            light.classList.remove('active');
        });
        
        // Activate the current beat light
        const currentBeatLight = document.querySelector(`.beat-light[data-beat="${beatIndex + 1}"]`);
        if (currentBeatLight) {
            currentBeatLight.classList.add('active');
        }
    }
    
    // Animate the pendulum
    function animatePendulum() {
        const now = performance.now();
        const elapsed = now - lastPendulumTime;
        lastPendulumTime = now;
        
        // Calculate pendulum movement based on tempo
        const beatInterval = (60 / currentTempo) * 1000;
        const swingSpeed = (elapsed / beatInterval) * Math.PI;
        
        pendulumAngle += swingSpeed * pendulumDirection;
        
        // Reverse direction when pendulum reaches max angle
        if (Math.abs(pendulumAngle) > Math.PI / 4) {
            pendulumDirection *= -1;
            pendulumAngle = pendulumDirection * Math.PI / 4;
        }
        
        // Apply rotation to pendulum element
        pendulum.style.transform = `rotate(${pendulumAngle}rad)`;
        
        // Continue animation loop
        pendulumRaf = requestAnimationFrame(animatePendulum);
    }
    
    // Event listeners
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
    
    beatsPerMeasureInput.addEventListener('change', () => {
        updateBeatsPerMeasure(parseInt(beatsPerMeasureInput.value));
    });
    
    noteValueButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            noteValueButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            beatValue = parseInt(btn.dataset.value);
            
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
        volume = parseFloat(volumeSlider.value) / 100;
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
    
    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            colorButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedColor = btn.dataset.color;
            
            document.documentElement.style.setProperty('--metronome-accent-color', btn.style.getPropertyValue('--color'));
        });
    });
    
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tempo = parseInt(btn.dataset.tempo);
            updateTempo(tempo);
            
            // Reset other settings to default
            beatsPerMeasure = 4;
            beatsPerMeasureInput.value = 4;
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
        
        // Here you would save the preset to localStorage or a database
        // For now, we'll just close the modal
        savePresetModal.style.display = 'none';
    });
    
    // Initialize accent pattern
    updateAccentPattern();
    updateBeatLights();
    
    // Set default color
    document.documentElement.style.setProperty('--metronome-accent-color', 
        getComputedStyle(document.documentElement).getPropertyValue('--metronome-accent'));
    
    // Close modal if clicked outside
    window.addEventListener('click', (e) => {
        if (e.target === savePresetModal) {
            savePresetModal.style.display = 'none';
        }
    });
    
    // Initialize keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        // Space bar to toggle play/stop
        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            if (isPlaying) {
                stopMetronome();
            } else {
                startMetronome();
            }
        }
        
        // Arrow up/down to adjust tempo
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