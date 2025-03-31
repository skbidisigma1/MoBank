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
    const soundButtons = document.querySelectorAll('.sound-button:not(.disabled)');
    const volumeSlider = document.getElementById('volume-slider');
    const visualizationButtons = document.querySelectorAll('.toggle-button[data-visual]');
    const colorButtons = document.querySelectorAll('.color-button');
    const presetButtons = document.querySelectorAll('.preset-button');
    const savePresetBtn = document.getElementById('save-preset');
    const savePresetModal = document.getElementById('save-preset-modal');
    const presetForm = document.getElementById('preset-form');
    const cancelSavePresetBtn = document.getElementById('cancel-save-preset');
    const pendulum = document.querySelector('.tempo-pendulum');
    
    let isPlaying = false;
    let currentTempo = parseInt(tempoDisplay.value);
    let beatValue = 4;
    let beatsPerMeasure = parseInt(beatsPerMeasureInput.value);
    let subdivision = parseInt(subdivisionSelector.value);
    let currentBeat = 0;
    let pendulumDirection = 1;
    let pendulumAngle = 0;
    let selectedSound = 'click';
    let volume = parseFloat(volumeSlider.value) / 100;
    let visualization = 'pendulum';
    let selectedColor = 'default';
    let metronomeInterval = null;
    let audioContext = null;
    let clickBuffer = null;

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
            // Simple click sound
            const clickResponse = await fetch('/tools/sounds/click.mp3');
            const clickArrayBuffer = await clickResponse.arrayBuffer();
            clickBuffer = await audioContext.decodeAudioData(clickArrayBuffer);
        } catch (error) {
            console.error('Error loading sounds:', error);
            // Create a fallback click sound if loading fails
            clickBuffer = createClickSound();
        }
    }

    // Create a synthesized click sound if the sample fails to load
    function createClickSound() {
        const sampleRate = audioContext.sampleRate;
        const buffer = audioContext.createBuffer(1, sampleRate * 0.1, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Create a quick decay click
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            if (t < 0.001) {
                data[i] = 0.8;
            } else {
                data[i] = 0.8 * Math.exp(-30 * t);
            }
        }
        
        return buffer;
    }

    // Play a sound with specified parameters
    function playSound(buffer, time, isAccent) {
        if (!audioContext || !buffer) return;
        
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = buffer;
        
        // Set volume with accent boost if needed
        gainNode.gain.value = volume * (isAccent ? 1.5 : 1);
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        source.start(time);
    }

    // Update the tempo
    function updateTempo(value) {
        currentTempo = Math.min(Math.max(value, 30), 240);
        tempoDisplay.value = currentTempo;
        tempoSlider.value = Math.min(Math.max(currentTempo, 40), 240); // Slider has a min of 40
        updatePendulumSpeed();
        
        if (isPlaying) {
            restartMetronome();
        }
    }

    function updateBeatsPerMeasure(value) {
        beatsPerMeasure = Math.min(Math.max(value, 1), 12);
        beatsPerMeasureInput.value = beatsPerMeasure;
        updateAccentPattern();
        
        if (isPlaying) {
            currentBeat = 0;
        }
    }

    function updateAccentPattern() {
        accentPattern.innerHTML = '';
        for (let i = 1; i <= beatsPerMeasure; i++) {
            const button = document.createElement('button');
            button.className = 'accent-button';
            button.dataset.position = i;
            button.textContent = i;
            
            if (i === 1) {
                button.classList.add('accent-primary');
            } else if (i % 4 === 1) {
                button.classList.add('accent-secondary');
            }
            
            button.addEventListener('click', () => {
                if (button.classList.contains('accent-primary')) {
                    button.classList.remove('accent-primary');
                    button.classList.add('accent-secondary');
                } else if (button.classList.contains('accent-secondary')) {
                    button.classList.remove('accent-secondary');
                } else {
                    button.classList.add('accent-primary');
                }
            });
            
            accentPattern.appendChild(button);
        }
        
        updateBeatLights();
    }

    function updateBeatLights() {
        const beatLightsContainer = document.querySelector('.beat-lights');
        beatLightsContainer.innerHTML = '';
        
        for (let i = 1; i <= beatsPerMeasure; i++) {
            const beatLight = document.createElement('div');
            beatLight.className = 'beat-light';
            beatLight.dataset.beat = i;
            
            if (i === 1) {
                beatLight.classList.add('accent');
            }
            
            beatLightsContainer.appendChild(beatLight);
        }
    }

    function updatePendulumSpeed() {
        const pendulumTransition = `transform ${60 / currentTempo / 2}s ease-in-out`;
        pendulum.style.transition = pendulumTransition;
    }

    function animatePendulum() {
        if (!isPlaying) return;
        
        pendulumAngle = pendulumDirection * 30;
        pendulum.style.transform = `rotate(${pendulumAngle}deg)`;
        pendulumDirection *= -1;
    }

    function highlightBeat(beatIndex) {
        const beatLights = document.querySelectorAll('.beat-light');
        beatLights.forEach(light => light.classList.remove('active'));
        
        if (beatLights[beatIndex]) {
            beatLights[beatIndex].classList.add('active');
        }
    }

    function playMetronomeBeat() {
        if (!isPlaying) return;
        
        // Ensure audio context is running
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        const beatIndex = currentBeat % beatsPerMeasure;
        const accentButtons = document.querySelectorAll('.accent-button');
        const isAccent = accentButtons[beatIndex] && 
                      (accentButtons[beatIndex].classList.contains('accent-primary') || 
                       accentButtons[beatIndex].classList.contains('accent-secondary'));
        
        // Play sound
        playSound(clickBuffer, 0, isAccent);
        
        // Visual feedback
        highlightBeat(beatIndex);
        
        if (visualization === 'pendulum' || visualization === 'both') {
            animatePendulum();
        }
        
        if (visualization === 'flash' || visualization === 'both') {
            document.body.classList.add('beat-flash');
            setTimeout(() => {
                document.body.classList.remove('beat-flash');
            }, 50);
        }
        
        currentBeat = (currentBeat + 1) % beatsPerMeasure;
    }

    function startMetronome() {
        if (isPlaying) return;
        
        if (!audioContext) {
            initAudio();
        }
        
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        isPlaying = true;
        currentBeat = 0;
        
        const interval = 60000 / currentTempo;
        metronomeInterval = setInterval(playMetronomeBeat, interval);
        
        // Update UI
        tempoPlayBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6h4v12H6V6zm8 0h4v12h-4V6z" fill="currentColor"/>
            </svg>
        `;
    }

    function stopMetronome() {
        if (!isPlaying) return;
        
        isPlaying = false;
        clearInterval(metronomeInterval);
        metronomeInterval = null;
        
        // Reset UI
        pendulum.style.transform = 'rotate(0deg)';
        document.querySelectorAll('.beat-light').forEach(light => {
            light.classList.remove('active');
        });
        
        tempoPlayBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
            </svg>
        `;
    }

    function restartMetronome() {
        if (isPlaying) {
            stopMetronome();
            startMetronome();
        }
    }

    function togglePlayState() {
        if (isPlaying) {
            stopMetronome();
        } else {
            startMetronome();
        }
    }

    function selectPreset(tempo, name) {
        updateTempo(tempo);
    }

    // Event listeners
    tempoSlider.addEventListener('input', () => {
        updateTempo(parseInt(tempoSlider.value));
    });

    tempoDisplay.addEventListener('change', () => {
        updateTempo(parseInt(tempoDisplay.value));
    });

    tempoDisplay.addEventListener('blur', () => {
        // Ensure value is within range when focus is lost
        updateTempo(parseInt(tempoDisplay.value));
    });

    tempoDisplay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            updateTempo(parseInt(tempoDisplay.value));
            tempoDisplay.blur();
        }
    });

    tempoDecreaseBtn.addEventListener('click', () => {
        updateTempo(currentTempo - 1);
    });

    tempoIncreaseBtn.addEventListener('click', () => {
        updateTempo(currentTempo + 1);
    });

    tempoPlayBtn.addEventListener('click', togglePlayState);

    beatsPerMeasureInput.addEventListener('change', () => {
        updateBeatsPerMeasure(parseInt(beatsPerMeasureInput.value));
    });

    decreaseBeatsBtn.addEventListener('click', () => {
        updateBeatsPerMeasure(beatsPerMeasure - 1);
    });

    increaseBeatsBtn.addEventListener('click', () => {
        updateBeatsPerMeasure(beatsPerMeasure + 1);
    });

    noteValueButtons.forEach(button => {
        button.addEventListener('click', () => {
            noteValueButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            beatValue = parseInt(button.dataset.value);
        });
    });

    subdivisionSelector.addEventListener('change', () => {
        subdivision = parseInt(subdivisionSelector.value);
    });

    soundButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (button.classList.contains('disabled')) return;
            
            soundButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            selectedSound = button.dataset.sound;
        });
    });

    volumeSlider.addEventListener('input', () => {
        volume = parseFloat(volumeSlider.value) / 100;
    });

    visualizationButtons.forEach(button => {
        button.addEventListener('click', () => {
            visualizationButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            visualization = button.dataset.visual;
        });
    });

    colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            colorButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            selectedColor = button.dataset.color;
            
            let accentColor = '';
            switch (selectedColor) {
                case 'red': accentColor = '#E74C3C'; break;
                case 'blue': accentColor = '#3498DB'; break;
                case 'green': accentColor = '#2ECC71'; break;
                case 'orange': accentColor = '#F39C12'; break;
                case 'purple': accentColor = '#9B59B6'; break;
                default: accentColor = 'var(--metronome-accent)';
            }
            
            document.documentElement.style.setProperty('--metronome-accent', accentColor);
        });
    });

    presetButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tempo = parseInt(button.dataset.tempo);
            const name = button.dataset.name;
            selectPreset(tempo, name);
        });
    });

    savePresetBtn.addEventListener('click', () => {
        savePresetModal.classList.add('visible');
        document.getElementById('preset-name').focus();
    });

    cancelSavePresetBtn.addEventListener('click', () => {
        savePresetModal.classList.remove('visible');
    });

    presetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const presetName = document.getElementById('preset-name').value;
        const presetDescription = document.getElementById('preset-description').value;
        
        const newPresetButton = document.createElement('button');
        newPresetButton.className = 'preset-button';
        newPresetButton.dataset.tempo = currentTempo;
        newPresetButton.dataset.name = presetName;
        
        newPresetButton.innerHTML = `
            <span class="preset-tempo">${currentTempo}</span>
            <span class="preset-name">${presetName}</span>
        `;
        
        newPresetButton.addEventListener('click', () => {
            selectPreset(currentTempo, presetName);
        });
        
        document.querySelector('.presets-grid').appendChild(newPresetButton);
        
        savePresetModal.classList.remove('visible');
        presetForm.reset();
    });

    window.addEventListener('click', (e) => {
        if (e.target === savePresetModal) {
            savePresetModal.classList.remove('visible');
        }
    });

    // Create a flash effect style for beats
    const style = document.createElement('style');
    style.textContent = `
        @keyframes beat-flash {
            0% { background-color: transparent; }
            50% { background-color: rgba(var(--metronome-accent-rgb), 0.1); }
            100% { background-color: transparent; }
        }
        .beat-flash {
            animation: beat-flash 0.1s ease-out;
        }
    `;
    document.head.appendChild(style);

    // Initialize metronome
    updatePendulumSpeed();
    updateAccentPattern();
    
    // Create directory for sound files if they don't exist
    initAudio();
}