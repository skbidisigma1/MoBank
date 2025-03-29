/**
 * MoTools Tuner Tool
 * Implements an audio tuner using the Pitchy library for pitch detection
 */

document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const startButton = document.getElementById('start-tuner');
    const stopButton = document.getElementById('stop-tuner');
    const noteDisplay = document.querySelector('.note-display');
    const frequencyDisplay = document.querySelector('.frequency-display');
    const centsDisplay = document.querySelector('.cents-display');
    const tuningIndicator = document.querySelector('.tuning-indicator');
    const referenceFrequencySelect = document.getElementById('reference-frequency');
    const pianoKeys = document.querySelectorAll('.white-key, .black-key');
    
    // Add detection quality indicator
    const tunerDisplay = document.querySelector('.tuner-display');
    const qualityIndicator = document.createElement('div');
    qualityIndicator.className = 'detection-quality';
    tunerDisplay.appendChild(qualityIndicator);
    
    // Audio context and analyzer setup
    let audioContext;
    let analyzer;
    let microphone;
    let scriptProcessor;
    let isListening = false;
    let animationFrameId = null;
    
    // Reference frequencies (A4) options
    const referenceFrequency = {
        value: 440,
        update: function() {
            this.value = parseFloat(referenceFrequencySelect.value);
            console.log(`Reference A4 set to: ${this.value}Hz`);
            updatePianoKeyboard();
        }
    };
    
    // Update reference frequency when select changes
    referenceFrequencySelect.addEventListener('change', function() {
        referenceFrequency.update();
    });
    
    // Note frequency calculation based on reference A4
    function getNoteFrequency(note, octave) {
        const A4 = referenceFrequency.value;
        const A4_INDEX = 9 + (4 * 12); // A is the 10th note (0-indexed) in C-based octave 4
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Calculate note index based on C0 as 0
        const noteIndex = notes.indexOf(note);
        const absoluteIndex = noteIndex + (octave * 12);
        
        // A4 frequency * 2^(semitones from A4 / 12)
        const semitoneDistance = absoluteIndex - A4_INDEX;
        return A4 * Math.pow(2, semitoneDistance / 12);
    }
    
    // Map of frequencies to notes
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
    
    // Calculate note from frequency
    function getNote(frequency) {
        // A4 = 440Hz (or reference frequency)
        const A4 = referenceFrequency.value;
        
        // Calculate how many semitones away from A4
        const semitoneDistance = 12 * Math.log2(frequency / A4);
        
        // A4 is note 'A' in octave 4, so note index 9 (0-indexed) in octave 4
        const A4_INDEX = 9;
        const A4_OCTAVE = 4;
        
        // Calculate the absolute index from C0
        const absoluteIndex = Math.round(semitoneDistance) + A4_INDEX + (A4_OCTAVE * 12);
        
        // Determine octave and note
        const octave = Math.floor(absoluteIndex / 12);
        const noteIndex = absoluteIndex % 12;
        
        // Map index back to note name
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteName = notes[noteIndex];
        
        // Calculate the exact frequency for this note at this octave
        const exactFrequency = A4 * Math.pow(2, (absoluteIndex - (A4_INDEX + (A4_OCTAVE * 12))) / 12);
        
        // Calculate cents deviation
        const centsDeviation = 1200 * Math.log2(frequency / exactFrequency);
        
        return {
            name: noteName,
            octave: octave,
            frequency: frequency,
            exactFrequency: exactFrequency,
            cents: centsDeviation
        };
    }
    
    // Update piano keyboard visualization
    function updatePianoKeyboard(noteName = null, octave = null) {
        // Reset all keys
        pianoKeys.forEach(key => {
            key.classList.remove('key-active');
        });
        
        // If no note is being played, just reset the keyboard
        if (!noteName) return;
        
        // Find the key corresponding to the current note and highlight it
        const noteKey = `${noteName}${octave}`;
        const keyElement = document.querySelector(`[data-note="${noteKey}"]`);
        
        if (keyElement) {
            keyElement.classList.add('key-active');
        }
    }
    
    // Start tuner button click handler
    startButton.addEventListener('click', async function() {
        if (isListening) return;
        
        try {
            // Initialize Web Audio API
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false
                } 
            });
            
            // Create analyzer node
            analyzer = Pitchy.PitchAnalyzer.forAudioContext(audioContext);
            
            // Connect microphone to analyzer
            microphone = audioContext.createMediaStreamSource(stream);
            scriptProcessor = analyzer.inputNode;
            
            // Connect the processor node to the destination to make it work
            microphone.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);
            
            // UI updates
            startButton.style.display = 'none';
            stopButton.style.display = 'inline-block';
            noteDisplay.textContent = '...';
            frequencyDisplay.textContent = 'Listening...';
            centsDisplay.textContent = '0¢';
            isListening = true;
            
            // Start pitch detection
            detectPitch();
            
        } catch (error) {
            console.error('Error initializing tuner:', error);
            alert('Unable to access microphone. Please check permissions and try again.');
            resetTuner();
        }
    });
    
    // Stop tuner button click handler
    stopButton.addEventListener('click', function() {
        if (!isListening) return;
        
        resetTuner();
    });
    
    // Reset the tuner state
    function resetTuner() {
        // Stop pitch detection
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        // Close audio connections
        if (scriptProcessor) {
            scriptProcessor.disconnect();
        }
        
        if (microphone) {
            microphone.disconnect();
        }
        
        if (audioContext) {
            audioContext.close().catch(err => console.log('Error closing audio context:', err));
        }
        
        // Reset UI
        startButton.style.display = 'inline-block';
        stopButton.style.display = 'none';
        noteDisplay.textContent = '--';
        frequencyDisplay.textContent = '0 Hz';
        centsDisplay.textContent = '0¢';
        tuningIndicator.style.left = '50%';
        tuningIndicator.className = 'tuning-indicator';
        qualityIndicator.className = 'detection-quality';
        
        // Reset piano keyboard
        updatePianoKeyboard();
        
        // Reset variables
        audioContext = null;
        analyzer = null;
        microphone = null;
        scriptProcessor = null;
        isListening = false;
    }
    
    // Detect pitch using Pitchy
    function detectPitch() {
        try {
            if (!analyzer || !isListening) return;
            
            const buffer = analyzer.getFloatTimeDomainData();
            const [pitch, clarity] = Pitchy.PitchDetector.findPitch(buffer, audioContext.sampleRate);
            
            updateTunerDisplay(pitch, clarity);
            
            // Continue detecting in the next animation frame
            animationFrameId = requestAnimationFrame(detectPitch);
        } catch (error) {
            console.error('Error in pitch detection:', error);
            resetTuner();
        }
    }
    
    // Update tuner display with current pitch data
    function updateTunerDisplay(pitch, clarity) {
        // Only update display if clarity is above threshold and pitch is in a reasonable range
        // Typical audible frequency range is 20Hz - 20kHz
        if (clarity >= 0.65 && pitch > 20 && pitch < 5000) {
            qualityIndicator.className = 'detection-quality good';
            
            // Calculate note information
            const note = getNote(pitch);
            
            // Update displays
            noteDisplay.textContent = `${note.name}${note.octave}`;
            frequencyDisplay.textContent = `${pitch.toFixed(1)} Hz`;
            
            // Format and display cents
            const centsValue = Math.round(note.cents);
            const centsPrefix = centsValue > 0 ? '+' : '';
            centsDisplay.textContent = `${centsPrefix}${centsValue}¢`;
            
            // Update indicator position (map from -50 to +50 cents to 0% to 100% position)
            const indicatorPosition = ((note.cents + 50) / 100) * 100;
            tuningIndicator.style.left = `${Math.max(0, Math.min(100, indicatorPosition))}%`;
            
            // Update indicator color based on cents deviation
            const deviation = Math.abs(note.cents);
            if (deviation <= 5) {
                tuningIndicator.className = 'tuning-indicator in-tune';
            } else if (deviation <= 15) {
                tuningIndicator.className = 'tuning-indicator slightly-off';
            } else {
                tuningIndicator.className = 'tuning-indicator off';
            }
            
            // Update piano keyboard
            updatePianoKeyboard(note.name, note.octave);
            
        } else if (clarity >= 0.4) {
            // Medium clarity - show as "trying to detect"
            qualityIndicator.className = 'detection-quality average';
        } else {
            // Low clarity - no reliable pitch detected
            qualityIndicator.className = 'detection-quality poor';
            noteDisplay.textContent = '--';
            frequencyDisplay.textContent = 'Listening...';
            updatePianoKeyboard();
        }
    }
    
    // Initialize piano keyboard position correctly
    function initializePianoKeyboard() {
        const whiteKeys = document.querySelectorAll('.white-key');
        const keyWidth = 100 / whiteKeys.length;
        
        // Position white keys evenly
        whiteKeys.forEach((key, index) => {
            key.style.left = `${index * keyWidth}%`;
            key.style.width = `${keyWidth}%`;
        });
        
        // Position black keys between white keys
        const blackKeys = document.querySelectorAll('.black-key');
        blackKeys.forEach((key, index) => {
            // Adjust for piano keyboard layout (no black key between E-F and B-C)
            let offset;
            if (index < 2) {
                // First two black keys (C# and D#)
                offset = (index + 1) * keyWidth - (keyWidth / 2);
            } else if (index < 5) {
                // Last three black keys (F#, G#, A#) - skip one position for the E-F gap
                offset = (index + 2) * keyWidth - (keyWidth / 2);
            }
            key.style.left = `${offset}%`;
        });
    }
    
    // Initialize the tuner
    function initializeTuner() {
        referenceFrequency.update();
        initializePianoKeyboard();
        
        // Add piano key click handlers for testing notes
        pianoKeys.forEach(key => {
            key.addEventListener('click', () => {
                const noteName = key.getAttribute('data-note');
                if (noteName) {
                    playReferenceNote(noteName);
                }
            });
        });
    }
    
    // Play a reference note when piano key is clicked
    function playReferenceNote(noteString) {
        const noteName = noteString.slice(0, -1); // Remove octave number
        const octave = parseInt(noteString.slice(-1)); // Get octave as number
        
        // Create a temporary audio context if needed
        const tempAudioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        
        const oscillator = tempAudioContext.createOscillator();
        const gainNode = tempAudioContext.createGain();
        
        // Calculate frequency for this note
        const frequency = getNoteFrequency(noteName, octave);
        
        // Set oscillator properties
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, tempAudioContext.currentTime);
        
        // Set envelope
        gainNode.gain.setValueAtTime(0, tempAudioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, tempAudioContext.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, tempAudioContext.currentTime + 1.5);
        
        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(tempAudioContext.destination);
        
        // Play note
        oscillator.start();
        oscillator.stop(tempAudioContext.currentTime + 1.5);
        
        // Visual feedback
        pianoKeys.forEach(key => key.classList.remove('key-active'));
        const keyElement = document.querySelector(`[data-note="${noteString}"]`);
        if (keyElement) {
            keyElement.classList.add('key-active');
            setTimeout(() => {
                keyElement.classList.remove('key-active');
                // Close the temp audio context if we created it just for this note
                if (!audioContext && tempAudioContext) {
                    setTimeout(() => {
                        tempAudioContext.close().catch(err => console.log('Error closing temporary audio context:', err));
                    }, 500);
                }
            }, 1500);
        }
    }
    
    // Initialize the tuner on page load
    initializeTuner();
});