document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('start-tuner');
    const stopButton = document.getElementById('stop-tuner');
    const noteDisplay = document.querySelector('.note-display');
    const frequencyDisplay = document.querySelector('.frequency-display');
    const centsDisplay = document.querySelector('.cents-display');
    const tuningIndicator = document.querySelector('.tuning-indicator');
    const referenceFrequencySelect = document.getElementById('reference-frequency');
    const pianoKeys = document.querySelectorAll('.white-key, .black-key');
    
    const tunerDisplay = document.querySelector('.tuner-display');
    const qualityIndicator = document.createElement('div');
    qualityIndicator.className = 'detection-quality';
    tunerDisplay.appendChild(qualityIndicator);
    
    let audioContext;
    let analyzer;
    let microphone;
    let isListening = false;
    let animationFrameId = null;
    
    const referenceFrequency = {
        value: 440,
        update: function() {
            this.value = parseFloat(referenceFrequencySelect.value);
            console.log(`Reference A4 set to: ${this.value}Hz`);
            updatePianoKeyboard();
        }
    };
    
    referenceFrequencySelect.addEventListener('change', function() {
        referenceFrequency.update();
    });
    
    function getNoteFrequency(note, octave) {
        const A4 = referenceFrequency.value;
        const A4_INDEX = 9 + (4 * 12);
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        const noteIndex = notes.indexOf(note);
        const absoluteIndex = noteIndex + (octave * 12);
        
        const semitoneDistance = absoluteIndex - A4_INDEX;
        return A4 * Math.pow(2, semitoneDistance / 12);
    }
    
    const NOTES_MAPPING = {
        'C': 0,
        'C#': 1,
        'D': 2,
        'D#': 3,
        'E': 4,
        'F': 5,
        'F#': 6,
        'G': 7,
        'G#': 8,
        'A': 9,
        'A#': 10,
        'B': 11
    };
    
    function getNote(frequency) {
        const A4 = referenceFrequency.value;
        
        const semitoneDistance = 12 * Math.log2(frequency / A4);
        
        const A4_INDEX = 9;
        const A4_OCTAVE = 4;
        
        const absoluteIndex = Math.round(semitoneDistance) + A4_INDEX + (A4_OCTAVE * 12);
        
        const octave = Math.floor(absoluteIndex / 12);
        const noteIndex = absoluteIndex % 12;
        
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteName = notes[noteIndex];
        
        const exactFrequency = A4 * Math.pow(2, (absoluteIndex - (A4_INDEX + (A4_OCTAVE * 12))) / 12);
        
        const centsDeviation = 1200 * Math.log2(frequency / exactFrequency);
        
        return {
            name: noteName,
            octave: octave,
            frequency: frequency,
            exactFrequency: exactFrequency,
            cents: centsDeviation
        };
    }
    
    function updatePianoKeyboard(noteName = null, octave = null) {
        pianoKeys.forEach(key => {
            key.classList.remove('key-active');
        });
        
        if (!noteName) return;
        
        const noteKey = `${noteName}${octave}`;
        const keyElement = document.querySelector(`[data-note="${noteKey}"]`);
        
        if (keyElement) {
            keyElement.classList.add('key-active');
        }
    }
    
    startButton.addEventListener('click', async function() {
        if (isListening) return;
        
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            analyzer = Pitchy.PitchAnalyzer.forAudioContext(audioContext);
            
            microphone = audioContext.createMediaStreamSource(stream);
            const scriptNode = analyzer.inputNode;
            microphone.connect(scriptNode);
            scriptNode.connect(audioContext.destination);
            
            startButton.style.display = 'none';
            stopButton.style.display = 'inline-block';
            noteDisplay.textContent = '...';
            frequencyDisplay.textContent = 'Listening...';
            centsDisplay.textContent = '0¢';
            isListening = true;
            
            detectPitch();
            
        } catch (error) {
            console.error('Error initializing tuner:', error);
            alert('Unable to access microphone. Please check permissions and try again.');
            resetTuner();
        }
    });
    
    stopButton.addEventListener('click', function() {
        if (!isListening) return;
        
        resetTuner();
    });
    
    function resetTuner() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        if (microphone) {
            microphone.disconnect();
        }
        
        if (audioContext) {
            audioContext.close();
        }
        
        startButton.style.display = 'inline-block';
        stopButton.style.display = 'none';
        noteDisplay.textContent = '--';
        frequencyDisplay.textContent = '0 Hz';
        centsDisplay.textContent = '0¢';
        tuningIndicator.style.left = '50%';
        tuningIndicator.className = 'tuning-indicator';
        qualityIndicator.className = 'detection-quality';
        
        updatePianoKeyboard();
        
        isListening = false;
    }
    
    function detectPitch() {
        const buffer = analyzer.getFloatTimeDomainData();
        const [pitch, clarity] = Pitchy.PitchDetector.findPitch(buffer, audioContext.sampleRate);
        
        updateTunerDisplay(pitch, clarity);
        
        animationFrameId = requestAnimationFrame(detectPitch);
    }
    
    function updateTunerDisplay(pitch, clarity) {
        if (clarity >= 0.80) {
            qualityIndicator.className = 'detection-quality good';
            
            const note = getNote(pitch);
            
            noteDisplay.textContent = `${note.name}${note.octave}`;
            frequencyDisplay.textContent = `${pitch.toFixed(1)} Hz`;
            
            const centsValue = Math.round(note.cents);
            const centsPrefix = centsValue > 0 ? '+' : '';
            centsDisplay.textContent = `${centsPrefix}${centsValue}¢`;
            
            const indicatorPosition = ((note.cents + 50) / 100) * 100;
            tuningIndicator.style.left = `${Math.max(0, Math.min(100, indicatorPosition))}%`;
            
            const deviation = Math.abs(note.cents);
            if (deviation <= 5) {
                tuningIndicator.className = 'tuning-indicator in-tune';
            } else if (deviation <= 15) {
                tuningIndicator.className = 'tuning-indicator slightly-off';
            } else {
                tuningIndicator.className = 'tuning-indicator off';
            }
            
            updatePianoKeyboard(note.name, note.octave);
            
        } else if (clarity >= 0.5) {
            qualityIndicator.className = 'detection-quality average';
        } else {
            qualityIndicator.className = 'detection-quality poor';
            noteDisplay.textContent = '--';
            frequencyDisplay.textContent = 'Listening...';
            updatePianoKeyboard();
        }
    }
    
    function initializePianoKeyboard() {
        const whiteKeys = document.querySelectorAll('.white-key');
        const keyWidth = 100 / whiteKeys.length;
        
        whiteKeys.forEach((key, index) => {
            key.style.left = `${index * keyWidth}%`;
            key.style.width = `${keyWidth}%`;
        });
        
        const blackKeys = document.querySelectorAll('.black-key');
        blackKeys.forEach((key, index) => {
            let offset;
            if (index < 2) {
                offset = (index + 1) * keyWidth - (keyWidth / 2);
            } else if (index < 5) {
                offset = (index + 2) * keyWidth - (keyWidth / 2);
            }
            key.style.left = `${offset}%`;
        });
    }
    
    function initializeTuner() {
        referenceFrequency.update();
        initializePianoKeyboard();
        
        pianoKeys.forEach(key => {
            key.addEventListener('click', () => {
                const noteName = key.getAttribute('data-note');
                if (noteName) {
                    playReferenceNote(noteName);
                }
            });
        });
    }
    
    function playReferenceNote(noteString) {
        const noteName = noteString.slice(0, -1);
        const octave = parseInt(noteString.slice(-1));
        
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        const frequency = getNoteFrequency(noteName, octave);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 1.5);
        
        pianoKeys.forEach(key => key.classList.remove('key-active'));
        const keyElement = document.querySelector(`[data-note="${noteString}"]`);
        if (keyElement) {
            keyElement.classList.add('key-active');
            setTimeout(() => {
                keyElement.classList.remove('key-active');
            }, 1500);
        }
    }
    
    initializeTuner();
});