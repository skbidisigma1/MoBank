document.addEventListener('DOMContentLoaded', () => {
    const voiceIndicator = document.getElementById('voice-indicator');
    const voiceStatusText = document.getElementById('voice-status-text');

    const WAKE_WORD = "hey metronome";
    const WAKE_WORD_CONFIDENCE_THRESHOLD = 0.8;
    const COMMAND_TIMEOUT_MS = 7000;

    if (!voiceIndicator || !voiceStatusText) {
        console.warn('Voice UI elements not found. Voice control disabled.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceStatusText.textContent = 'Speech recognition not supported.';
        voiceIndicator.style.display = 'none';
        console.warn('Speech Recognition API not supported in this browser.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';
    let isListening = false;
    let micPermissionDenied = false;
    let isAwake = false;
    let wakeWordTimer = null;

    function fuzzyMatch(text, pattern) {
        const d = levenshteinDistance(text.toLowerCase(), pattern.toLowerCase());
        const maxLength = Math.max(text.length, pattern.length);
        if (maxLength === 0) return 1.0;
        return 1.0 - d / maxLength;
    }

    function levenshteinDistance(a, b) {
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
        for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;
        for (let j = 1; j <= b.length; j += 1) {
            for (let i = 1; i <= a.length; i += 1) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + cost
                );
            }
        }
        return matrix[b.length][a.length];
    }

    function startWakeWordTimer() {
        clearTimeout(wakeWordTimer);
        wakeWordTimer = setTimeout(() => {
            console.log('Wake word timed out.');
            isAwake = false;
            voiceIndicator.classList.remove('awake');
            if (isListening) {
                voiceIndicator.classList.add('listening');
                voiceStatusText.textContent = 'Waiting for command...';
            } else {
                 voiceIndicator.classList.remove('listening');
            }
        }, COMMAND_TIMEOUT_MS);
        console.log(`Wake word timer started (${COMMAND_TIMEOUT_MS}ms)`);
    }

    function executeCommand(commandData) {
        const { command, params } = commandData;
        console.log(`Executing command: ${command} with params:`, params);
        voiceStatusText.textContent = `Processing: ${command}...`;
        voiceIndicator.classList.add('active');
        voiceIndicator.classList.remove('listening', 'detecting', 'awake');

        let success = true;
        let feedback = `Command: ${command}`;

        if (typeof window.MetronomeAPI === 'undefined') {
            console.error("MetronomeAPI not found on window object. Ensure metronome-ui.js is loaded first and exposes MetronomeAPI.");
            feedback = "Error: Metronome UI functions not available.";
            success = false;
        } else {
            try {
                switch (command) {
                    case 'start':
                        if (!window.MetronomeAPI.isPlaying) {
                            window.MetronomeAPI.start();
                            feedback = 'Metronome started.';
                        } else {
                            feedback = 'Metronome already playing.';
                        }
                        break;
                    case 'stop':
                        if (window.MetronomeAPI.isPlaying) {
                            window.MetronomeAPI.stop();
                            feedback = 'Metronome stopped.';
                        } else {
                            feedback = 'Metronome already stopped.';
                        }
                        break;
                    case 'set_tempo':
                        if (params && params.tempo !== undefined) {
                            const tempo = parseInt(params.tempo, 10);
                            if (!isNaN(tempo)) {
                                window.MetronomeAPI.setTempo(tempo);
                                feedback = `Tempo set to ${tempo} BPM`;
                            } else {
                                success = false;
                                feedback = 'Invalid tempo value.';
                            }
                        } else {
                            success = false;
                            feedback = 'Could not set tempo. Please specify a number.';
                        }
                        break;
                    case 'increase_tempo':
                        {
                            const current = window.MetronomeAPI.currentTempo;
                            const newTempo = Math.min(1000, current + (params?.amount || 5));
                            window.MetronomeAPI.setTempo(newTempo);
                            feedback = `Tempo increased to ${newTempo} BPM`;
                        }
                        break;
                    case 'decrease_tempo':
                        {
                            const current = window.MetronomeAPI.currentTempo;
                            const newTempo = Math.max(10, current - (params?.amount || 5));
                            window.MetronomeAPI.setTempo(newTempo);
                            feedback = `Tempo decreased to ${newTempo} BPM`;
                        }
                        break;
                    case 'set_time_signature':
                        if (params && params.numerator !== undefined && params.denominator !== undefined) {
                            const num = parseInt(params.numerator, 10);
                            const den = parseInt(params.denominator, 10);
                            if (!isNaN(num) && !isNaN(den)) {
                                window.MetronomeAPI.setBeatsPerMeasure(num);
                                window.MetronomeAPI.setNoteValue(den);
                                feedback = `Time signature set to ${num}/${den}`;
                            } else {
                                success = false;
                                feedback = 'Invalid time signature values.';
                            }
                        } else {
                            success = false;
                            feedback = 'Invalid time signature format. Try "set time signature to 4 over 4".';
                        }
                        break;
                    default:
                        success = false;
                        feedback = 'Unknown command received from server.';
                        console.warn("Unknown command:", command);
                }
            } catch (error) {
                console.error("Error executing command via MetronomeAPI:", error);
                success = false;
                feedback = "Error processing command.";
            }
        }

        setTimeout(() => {
            voiceStatusText.textContent = success ? feedback : `Failed: ${feedback}`;
            voiceIndicator.classList.remove('active');
            if (isAwake && isListening) {
                 voiceIndicator.classList.add('awake');
                 voiceStatusText.textContent = 'Awake. Waiting for command...';
                 startWakeWordTimer();
            } else if (isListening) {
                 voiceIndicator.classList.add('listening');
                 voiceStatusText.textContent = 'Waiting for command...';
            }
        }, success ? 1500 : 3000);
    }

    recognition.onstart = () => {
        isListening = true;
        isAwake = false;
        micPermissionDenied = false;
        voiceIndicator.classList.add('listening');
        voiceIndicator.classList.remove('detecting', 'active', 'awake');
        voiceStatusText.textContent = 'Waiting for command...';
        console.log('Voice recognition started.');
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcriptPart;
            } else {
                interimTranscript += transcriptPart;
            }
        }

        const currentTranscript = (finalTranscript || interimTranscript).trim();

        if (interimTranscript && !finalTranscript) {
             if (isAwake) {
                 voiceStatusText.textContent = `Command: ${interimTranscript}`;
             } else {
             }
        }

        if (!isAwake) {
            const matchScore = fuzzyMatch(currentTranscript, WAKE_WORD);
            if (matchScore >= WAKE_WORD_CONFIDENCE_THRESHOLD) {
                console.log(`Wake word detected! (Score: ${matchScore.toFixed(2)})`);
                isAwake = true;
                voiceIndicator.classList.add('awake');
                voiceIndicator.classList.remove('listening', 'detecting');
                voiceStatusText.textContent = 'Awake! Listening for command...';
                startWakeWordTimer();
                finalTranscript = '';
            }
        }

        if (isAwake && finalTranscript) {
            clearTimeout(wakeWordTimer);
            console.log('Final Transcript (Raw): ', finalTranscript);

            let commandText = finalTranscript;
            if (commandText.toLowerCase().startsWith(WAKE_WORD.toLowerCase())) {
                 commandText = commandText.substring(WAKE_WORD.length).trim();
            }

            if (!commandText) {
                console.log("Empty command after wake word, restarting timer.");
                voiceStatusText.textContent = 'Yes? Waiting for command...';
                startWakeWordTimer();
                return;
            }

            console.log('Final Transcript (Command): ', commandText);
            voiceStatusText.textContent = 'Processing command...';
            voiceIndicator.classList.add('active');
            voiceIndicator.classList.remove('awake', 'listening', 'detecting');

            fetch('/api/parseMetronomeCommand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: commandText }),
            })
            .then(response => {
                 if (!response.ok) {
                    return response.json().then(errData => {
                        throw new Error(`Server error ${response.status}: ${errData.error || response.statusText}`);
                    }).catch(() => {
                        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data && data.command) {
                    executeCommand(data);
                } else {
                    console.warn('Server did not return a valid command structure:', data);
                    throw new Error('Command not recognized by server.');
                }
            })
            .catch(error => {
                console.error('Error calling/processing command API:', error);
                voiceStatusText.textContent = `Error: ${error.message || 'Could not process command.'}`;
                setTimeout(() => {
                    voiceIndicator.classList.remove('active');
                    if (isAwake && isListening) {
                        voiceIndicator.classList.add('awake');
                        voiceStatusText.textContent = 'Awake. Waiting for command...';
                        startWakeWordTimer();
                    } else if (isListening) {
                        voiceIndicator.classList.add('listening');
                         voiceStatusText.textContent = 'Waiting for command...';
                    }
                }, 3000);
            });
        } else if (finalTranscript && !isAwake) {
             console.log("Final transcript received, but not awake:", finalTranscript);
             if (voiceStatusText.textContent !== 'Waiting for command...') {
                 voiceStatusText.textContent = 'Waiting for command...';
             }
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error, event.message);
        let errorMsg = `Error: ${event.error}`; 
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            errorMsg = 'Mic permission denied.';
            micPermissionDenied = true;
            isAwake = false;
            recognition.stop();
        } else if (event.error === 'no-speech') {
            errorMsg = 'Listening...';
             if (isAwake) {
                 errorMsg = 'Did not hear command...';
                 startWakeWordTimer();
             }
        } else if (event.error === 'network') {
            errorMsg = 'Network error. Check connection.';
            isAwake = false;
        } else if (event.error === 'aborted') {
            errorMsg = 'Listening stopped.';
            isAwake = false;
        } else {
             errorMsg = `Error: ${event.error}`;
             isAwake = false;
        }

        voiceStatusText.textContent = errorMsg;
        voiceIndicator.classList.remove('detecting', 'active', 'awake');
        clearTimeout(wakeWordTimer);
    };

    recognition.onend = () => {
        isListening = false;
        clearTimeout(wakeWordTimer);
        voiceIndicator.classList.remove('listening', 'detecting', 'active');
        if (!isAwake) {
             voiceIndicator.classList.remove('awake');
        }
        console.log('Voice recognition ended.');

        if (!micPermissionDenied) {
            setTimeout(() => {
                try {
                    if (!isListening) {
                        console.log('Attempting to restart voice recognition...');
                        recognition.start();
                    }
                } catch (e) {
                    if (e.name !== 'InvalidStateError') {
                        console.error('Error restarting recognition:', e);
                        voiceStatusText.textContent = 'Restart failed.';
                        micPermissionDenied = true;
                    }
                }
            }, 250);
        } else {
            voiceStatusText.textContent = 'Mic permission needed to use voice control.';
            voiceIndicator.style.display = 'none';
        }
    };

    recognition.onaudiostart = () => {
        if (!isAwake && !voiceIndicator.classList.contains('active')) {
             voiceIndicator.classList.add('detecting');
             voiceIndicator.classList.remove('listening');
        }
    };

    recognition.onaudioend = () => {
        voiceIndicator.classList.remove('detecting');
        if (isListening && !voiceIndicator.classList.contains('active')) {
             if (isAwake) {
                 voiceIndicator.classList.add('awake');
             } else {
                 voiceIndicator.classList.add('listening');
             }
        }
    };

    try {
        console.log("Attempting initial voice recognition start...");
        recognition.start();
    } catch (e) {
        console.error('Could not start voice recognition initially:', e);
        voiceStatusText.textContent = 'Could not start listening.';
        if (e.name === 'NotAllowedError') {
            micPermissionDenied = true;
            voiceStatusText.textContent = 'Mic permission denied.';
            voiceIndicator.style.display = 'none';
        }
    }

});
