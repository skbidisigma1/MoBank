document.addEventListener('DOMContentLoaded', () => {
    const voiceIndicator = document.getElementById('voice-indicator');
    const voiceStatusText = document.getElementById('voice-status-text');

    // --- Configuration ---
    const WAKE_WORD = "hey metronome"; // Or an array: ["hey metronome", "okay metronome"]
    const WAKE_WORD_CONFIDENCE_THRESHOLD = 0.8; // Adjust as needed (0 to 1)
    const COMMAND_TIMEOUT_MS = 7000; // Time after wake word to listen for command

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
    let isAwake = false; // <-- New state: Track if wake word was detected
    let wakeWordTimer = null; // <-- New state: Timer for command timeout

    // --- Simple Fuzzy Match (Levenshtein Distance based similarity) ---
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
                    matrix[j][i - 1] + 1,      // Deletion
                    matrix[j - 1][i] + 1,      // Insertion
                    matrix[j - 1][i - 1] + cost // Substitution
                );
            }
        }
        return matrix[b.length][a.length];
    }

    // --- Wake Word Timer ---
    function startWakeWordTimer() {
        clearTimeout(wakeWordTimer); // Clear existing timer
        wakeWordTimer = setTimeout(() => {
            console.log('Wake word timed out.');
            isAwake = false;
            voiceIndicator.classList.remove('awake'); // Use a new class for awake state
            if (isListening) {
                voiceIndicator.classList.add('listening');
                voiceStatusText.textContent = 'Waiting for command...';
            } else {
                 voiceIndicator.classList.remove('listening');
            }
        }, COMMAND_TIMEOUT_MS);
        console.log(`Wake word timer started (${COMMAND_TIMEOUT_MS}ms)`);
    }

    // --- Helper Functions (Client-side execution using MetronomeAPI) ---
    function executeCommand(commandData) {
        const { command, params } = commandData;
        console.log(`Executing command: ${command} with params:`, params);
        voiceStatusText.textContent = `Processing: ${command}...`;
        voiceIndicator.classList.add('active');
        voiceIndicator.classList.remove('listening', 'detecting', 'awake');

        let success = true;
        let feedback = `Command: ${command}`; // Default feedback

        // Check if the MetronomeAPI is available
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
                            const newTempo = Math.min(1000, current + (params?.amount || 5)); // Default increase by 5
                            window.MetronomeAPI.setTempo(newTempo);
                            feedback = `Tempo increased to ${newTempo} BPM`;
                        }
                        break;
                    case 'decrease_tempo':
                        {
                            const current = window.MetronomeAPI.currentTempo;
                            const newTempo = Math.max(10, current - (params?.amount || 5)); // Default decrease by 5
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
                    // Add cases for other commands (subdivision, sound, volume, etc.) if needed
                    // Example:
                    // case 'set_subdivision':
                    //     if (params && params.value !== undefined) {
                    //         window.MetronomeAPI.setSubdivision(params.value);
                    //         feedback = `Subdivision set.`;
                    //     } else {
                    //         success = false; feedback = 'Invalid subdivision value.';
                    //     }
                    //     break;
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
        } // End of MetronomeAPI check

        // Provide feedback and reset indicator after a short delay
        setTimeout(() => {
            voiceStatusText.textContent = success ? feedback : `Failed: ${feedback}`;
            voiceIndicator.classList.remove('active');
            // If wake word was active, go back to awake state, otherwise back to listening
            if (isAwake && isListening) {
                 voiceIndicator.classList.add('awake');
                 voiceStatusText.textContent = 'Awake. Waiting for command...';
                 startWakeWordTimer(); // Restart timer after successful command execution
            } else if (isListening) {
                 voiceIndicator.classList.add('listening');
                 voiceStatusText.textContent = 'Waiting for command...';
            }
        }, success ? 1500 : 3000);
    }


    // --- Speech Recognition Event Handlers ---
    recognition.onstart = () => {
        isListening = true;
        isAwake = false; // Reset awake state on start
        micPermissionDenied = false; // Assume permission is granted until an error says otherwise
        voiceIndicator.classList.add('listening');
        voiceIndicator.classList.remove('detecting', 'active', 'awake');
        voiceStatusText.textContent = 'Waiting for command...';
        console.log('Voice recognition started.');
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        finalTranscript = ''; // Reset final transcript for this batch

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcriptPart;
            } else {
                interimTranscript += transcriptPart;
            }
        }

        const currentTranscript = (finalTranscript || interimTranscript).trim();
        // console.log(`Transcript: "${currentTranscript}" (Final: ${!!finalTranscript}, Interim: ${!!interimTranscript}, Awake: ${isAwake})`); // Debug log

        // Update interim display
        if (interimTranscript && !finalTranscript) {
             if (isAwake) {
                 voiceStatusText.textContent = `Command: ${interimTranscript}`; // Show command being heard
             } else {
                 // Don't show interim results before wake word to avoid clutter
                 // voiceStatusText.textContent = interimTranscript;
             }
        }

        // 1. Check for Wake Word if not already awake
        if (!isAwake) {
            const matchScore = fuzzyMatch(currentTranscript, WAKE_WORD);
            if (matchScore >= WAKE_WORD_CONFIDENCE_THRESHOLD) {
                console.log(`Wake word detected! (Score: ${matchScore.toFixed(2)})`);
                isAwake = true;
                voiceIndicator.classList.add('awake'); // Add 'awake' class for styling
                voiceIndicator.classList.remove('listening', 'detecting');
                voiceStatusText.textContent = 'Awake! Listening for command...';
                startWakeWordTimer(); // Start timer to listen for command
                // Don't process this transcript as a command, wait for the next one
                finalTranscript = ''; // Clear final transcript so it's not processed below
            }
        }

        // 2. Process Final Transcript if Awake
        if (isAwake && finalTranscript) {
            clearTimeout(wakeWordTimer); // Stop the timeout timer
            console.log('Final Transcript (Raw): ', finalTranscript);

            // Extract command text (remove wake word)
            let commandText = finalTranscript;
            if (commandText.toLowerCase().startsWith(WAKE_WORD.toLowerCase())) {
                 commandText = commandText.substring(WAKE_WORD.length).trim();
            }

            if (!commandText) {
                console.log("Empty command after wake word, restarting timer.");
                voiceStatusText.textContent = 'Yes? Waiting for command...';
                startWakeWordTimer(); // Restart timer if only wake word was said
                return; // Don't send empty command
            }

            console.log('Final Transcript (Command): ', commandText);
            voiceStatusText.textContent = 'Processing command...';
            voiceIndicator.classList.add('active');
            voiceIndicator.classList.remove('awake', 'listening', 'detecting');

            // Send ONLY the command part to the serverless function
            fetch('/api/parseMetronomeCommand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: commandText }), // Send extracted command
            })
            .then(response => {
                 if (!response.ok) {
                    // Try to parse error json, otherwise use status text
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
                    executeCommand(data); // Execute based on server response
                } else {
                    console.warn('Server did not return a valid command structure:', data);
                    throw new Error('Command not recognized by server.');
                }
            })
            .catch(error => {
                console.error('Error calling/processing command API:', error);
                voiceStatusText.textContent = `Error: ${error.message || 'Could not process command.'}`;
                // Reset UI after error display
                setTimeout(() => {
                    voiceIndicator.classList.remove('active');
                    if (isAwake && isListening) { // If still awake, go back to awake state
                        voiceIndicator.classList.add('awake');
                        voiceStatusText.textContent = 'Awake. Waiting for command...';
                        startWakeWordTimer(); // Restart timer on error
                    } else if (isListening) {
                        voiceIndicator.classList.add('listening');
                         voiceStatusText.textContent = 'Waiting for command...';
                    }
                }, 3000);
            });
        } else if (finalTranscript && !isAwake) {
             // Optional: Handle final transcripts when not awake (e.g., ignore, log)
             console.log("Final transcript received, but not awake:", finalTranscript);
             // Reset text if it showed interim results
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
            isAwake = false; // Cannot be awake without mic
            recognition.stop(); // Stop explicitly if permission denied
        } else if (event.error === 'no-speech') {
            errorMsg = 'Listening...'; // Less alarming for no-speech
             // If awake when no-speech occurs, restart timer and give feedback
             if (isAwake) {
                 errorMsg = 'Did not hear command...';
                 startWakeWordTimer();
             }
        } else if (event.error === 'network') {
            errorMsg = 'Network error. Check connection.';
            isAwake = false;
        } else if (event.error === 'aborted') {
            errorMsg = 'Listening stopped.'; // Often happens during restart
            isAwake = false;
        } else {
             errorMsg = `Error: ${event.error}`; // Generic error
             isAwake = false; // Reset awake on other errors
        }

        voiceStatusText.textContent = errorMsg;
        voiceIndicator.classList.remove('detecting', 'active', 'awake');
        // Don't immediately set to 'listening' here, let onend handle restart logic
        // isListening = false; // Recognition technically stops before onend
        clearTimeout(wakeWordTimer); // Clear timer on error
    };

    recognition.onend = () => {
        isListening = false;
        // Don't reset isAwake here, it might end briefly between commands
        // isAwake = false;
        clearTimeout(wakeWordTimer); // Ensure timer is cleared
        voiceIndicator.classList.remove('listening', 'detecting', 'active');
        // Keep 'awake' class if the state is still true
        if (!isAwake) {
             voiceIndicator.classList.remove('awake');
        }
        console.log('Voice recognition ended.');

        // Attempt to restart unless permission was explicitly denied
        if (!micPermissionDenied) {
            // Add a small delay before restarting to prevent rapid cycles on some errors
            setTimeout(() => {
                try {
                    if (!isListening) { // Check again in case it was restarted elsewhere
                        console.log('Attempting to restart voice recognition...');
                        recognition.start(); // onstart will reset UI to 'listening' if not awake
                    }
                } catch (e) {
                    // Avoid logging errors if it's just because it's already started
                    if (e.name !== 'InvalidStateError') {
                        console.error('Error restarting recognition:', e);
                        voiceStatusText.textContent = 'Restart failed.';
                        micPermissionDenied = true; // Assume critical failure
                    }
                }
            }, 250); // 250ms delay
        } else {
            voiceStatusText.textContent = 'Mic permission needed to use voice control.';
            voiceIndicator.style.display = 'none'; // Hide indicator if unusable
        }
    };

    // Handle audio detection for visual feedback
    recognition.onaudiostart = () => {
        // console.log('Audio capturing started'); // Can be noisy
        if (!isAwake && !voiceIndicator.classList.contains('active')) { // Don't show detecting if awake or active
             voiceIndicator.classList.add('detecting');
             voiceIndicator.classList.remove('listening');
        }
    };

    recognition.onaudioend = () => {
        // console.log('Audio capturing ended'); // Can be noisy
        voiceIndicator.classList.remove('detecting');
        // Revert to listening/awake state if recognition is still supposed to be active
        if (isListening && !voiceIndicator.classList.contains('active')) {
             if (isAwake) {
                 voiceIndicator.classList.add('awake');
             } else {
                 voiceIndicator.classList.add('listening');
             }
        }
    };

    // Initial Start
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

    // Add CSS for the .awake state in your metronome.css or similar:
    /*
    .voice-indicator.awake {
        background-color: #2ecc71; // Example: Green when awake
        box-shadow: 0 0 15px 5px rgba(46, 204, 113, 0.7);
    }
    .voice-indicator.awake .voice-dot {
        background-color: #ffffff;
    }
    */
});
