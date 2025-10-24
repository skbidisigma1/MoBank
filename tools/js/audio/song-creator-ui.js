import PitchDetector from './song-creator-pitch.js';
import SongRecorder from './song-creator-recorder.js';
class SongCreatorUI {
    constructor() {
        this.els = {
            startMic: document.getElementById('start-mic'),
            stopMic: document.getElementById('stop-mic'),
            startRec: document.getElementById('start-recording'),
            stopRec: document.getElementById('stop-recording'),
            play: document.getElementById('play-recording'),
            clear: document.getElementById('clear-recording'),
            note: document.getElementById('pitch-note'),
            oct: document.getElementById('pitch-octave'),
            freq: document.getElementById('frequency-value'),
            cents: document.getElementById('cents-value'),
            centsBar: document.getElementById('cents-bar'),
            status: document.getElementById('status-text'),
            timeline: document.getElementById('notes-timeline'),
            stats: document.getElementById('notes-stats'),
            recordingControls: document.getElementById('recording-controls'),
            notesDisplay: document.getElementById('notes-display'),
            // Settings sliders
            tempoSlider: document.getElementById('tempo-slider'),
            tempoValue: document.getElementById('tempo-value'),
            toleranceSlider: document.getElementById('tolerance-slider'),
            toleranceValue: document.getElementById('tolerance-value'),
            minDurationSlider: document.getElementById('min-duration-slider'),
            minDurationValue: document.getElementById('min-duration-value'),
            smoothRecording: document.getElementById('smooth-recording'),
            fluctuationSlider: document.getElementById('fluctuation-threshold'),
            fluctuationValue: document.getElementById('fluctuation-value'),
            silenceDurationSlider: document.getElementById('silence-duration'),
            silenceDurationValue: document.getElementById('silence-value'),
            silenceThresholdSlider: document.getElementById('silence-threshold'),
            silenceThresholdValue: document.getElementById('silence-threshold-value'),
            attackThresholdSlider: document.getElementById('attack-threshold'),
            attackValue: document.getElementById('attack-value'),
            claritySlider: document.getElementById('clarity-threshold'),
            clarityValue: document.getElementById('clarity-value'),
        };
    }
    async init() {
        // Validate required elements exist
        if (!this.els.startMic || !this.els.note || !this.els.status) {
            console.error('Required DOM elements missing');
            return;
        }
        
        // Audio + pitch
        this.pitch = new PitchDetector({
            workletUrl: '/tools/js/audio/pitch-worklet.js',
            minFreq: 100, // Avoid low-frequency noise (was 80)
            maxFreq: 1000,
            rmsFloorDb: -50, // Stricter noise gate (was -60)
            clarityFloor: 0.25, // Higher clarity requirement (was 0.12)
            yinThreshold: 0.15, // More conservative pitch detection (was 0.12)
        });
        await this.pitch.init();
        this.ctx = this.pitch.audioContext;
        // Recorder
        this.rec = new SongRecorder({
            tempo: 120,
            grid: 16,
            minNoteMs: 200, // Minimum note duration 200ms (was 90)
            minChangeMs: 180, // Require 180ms stability before pitch change (was 110)
            minSilenceMs: 120, // Silence gap to separate repeated notes (was 80)
            silenceDb: -48, // Silence threshold stricter (was -55)
            centsTolerance: 35, // Allow more pitch variation within same note (was 20)
            attackRatio: 2, // Attack required for rearticulation
        });
        // Store handlers for cleanup
        this.pitchHandler = (e) => this.onPitch(e.detail);
        this.errorHandler = (e) => this.onError(e.detail);
        this.pitch.addEventListener('pitch', this.pitchHandler);
        this.pitch.addEventListener('error', this.errorHandler);
        // UI events
        this.els.startMic.onclick = () => this.startMic();
        this.els.stopMic.onclick = () => this.stopMic();
        this.els.startRec.onclick = () => this.startRec();
        this.els.stopRec.onclick = () => this.stopRec();
        this.els.play.onclick = () => this.play();
        this.els.clear.onclick = () => this.clear();
        
        // Settings sliders
        this.setupSettingsControls();
        this.initializeSliderValues();
        this.setStatus('Ready');
    }
    async startMic() {
        await this.ctx.resume(); // user gesture
        await this.pitch.startMicrophone();
        await this.pitch.start();
        this.setStatus('Listening…');
        this.els.startMic.disabled = true;
        this.els.stopMic.disabled = false;
        this.els.stopMic.style.display = '';
        this.els.recordingControls.style.display = '';
    }
    async stopMic() {
        // Remove event listeners before cleanup
        if (this.pitchHandler) {
            this.pitch.removeEventListener('pitch', this.pitchHandler);
        }
        if (this.errorHandler) {
            this.pitch.removeEventListener('error', this.errorHandler);
        }
        await this.pitch.stop();
        await this.pitch.stopMicrophone();
        this.setStatus('Microphone inactive');
        this.els.startMic.disabled = false;
        this.els.stopMic.disabled = true;
        this.els.stopMic.style.display = 'none';
        this.els.recordingControls.style.display = 'none';
    }
    startRec() {
        this.rec.start(this.ctx.currentTime);
        this.setStatus('Recording…');
        this.els.startRec.disabled = true;
        this.els.stopRec.disabled = false;
        this.els.stopRec.style.display = '';
        this.els.play.disabled = true;
        this.els.clear.disabled = true;
    }
    stopRec() {
        this.rec.stop(this.ctx.currentTime);
        this.setStatus('Captured');
        this.els.startRec.disabled = false;
        this.els.stopRec.disabled = true;
        this.els.stopRec.style.display = 'none';
        this.els.play.disabled = (this.rec.recorded.length === 0);
        this.els.clear.disabled = (this.rec.recorded.length === 0);
        this.els.notesDisplay.style.display = '';
        this.renderNotes();
    }
    play() {
        const notes = this.rec.quantized.length ? this.rec.quantized : this.rec.recorded;
        if (!notes.length) {
            this.setStatus('No notes to play');
            return;
        }
        this.rec.play(this.ctx);
        this.setStatus('Playing...');
        // Reset status after playback
        const lastNote = notes[notes.length - 1];
        const duration = lastNote.startMs + lastNote.durationMs;
        setTimeout(() => {
            if (this.els.status.textContent === 'Playing...') {
                this.setStatus('Captured');
            }
        }, duration + 100);
    }
    clear() {
        this.rec.clear();
        this.renderNotes();
        this.els.play.disabled = true;
        this.els.clear.disabled = true;
    }
    
    exportNotes() {
        const notes = this.rec.quantized.length ? this.rec.quantized : this.rec.recorded;
        if (!notes.length) return;
        
        // Export as JSON
        const data = {
            tempo: this.getTempo(),
            notes: notes.map(n => ({
                note: n.note,
                octave: n.octave,
                frequency: n.frequency,
                startMs: n.startMs,
                durationMs: n.durationMs,
                velocity: n.velocity,
                clarity: n.clarity
            }))
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `melody-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    setupSettingsControls() {
        // Tempo
        if (this.els.tempoSlider) {
            this.els.tempoSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                this.rec.setTempo(val);
                if (this.els.tempoValue) this.els.tempoValue.textContent = `${val} BPM`;
            };
        }
        
        // Note tolerance (cents)
        if (this.els.toleranceSlider) {
            this.els.toleranceSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                this.rec.opts.centsTolerance = val;
                if (this.els.toleranceValue) this.els.toleranceValue.textContent = `±${val}¢`;
            };
        }
        
        // Min note duration
        if (this.els.minDurationSlider) {
            this.els.minDurationSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                this.rec.opts.minNoteMs = val;
                if (this.els.minDurationValue) this.els.minDurationValue.textContent = `${val}ms`;
            };
        }
        
        // Fluctuation threshold (for smoothing)
        if (this.els.fluctuationSlider) {
            this.els.fluctuationSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                this.rec.opts.minChangeMs = val;
                if (this.els.fluctuationValue) this.els.fluctuationValue.textContent = `${val}ms`;
            };
        }
        
        // Silence gap duration
        if (this.els.silenceDurationSlider) {
            this.els.silenceDurationSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                this.rec.opts.minSilenceMs = val;
                if (this.els.silenceDurationValue) this.els.silenceDurationValue.textContent = `${val}ms`;
            };
        }
        
        // Silence threshold (dB)
        if (this.els.silenceThresholdSlider) {
            this.els.silenceThresholdSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                // Map 1-20 to -60 to -40 dB (logarithmic feel)
                const db = -60 + (val - 1) * (20 / 19);
                this.rec.opts.silenceDb = db;
                if (this.els.silenceThresholdValue) {
                    this.els.silenceThresholdValue.textContent = (val / 1000).toFixed(3);
                }
            };
        }
        
        // Attack threshold (articulation sensitivity)
        if (this.els.attackThresholdSlider) {
            this.els.attackThresholdSlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                // Map 10-50 to 1.5-3.0 ratio
                const ratio = 1.5 + (val - 10) * (1.5 / 40);
                this.rec.opts.attackRatio = ratio;
                if (this.els.attackValue) this.els.attackValue.textContent = `${ratio.toFixed(1)}x`;
            };
        }
        
        // Clarity threshold
        if (this.els.claritySlider) {
            this.els.claritySlider.oninput = (e) => {
                const val = parseInt(e.target.value);
                const clarity = val / 100;
                this.rec.opts.clarityFloor = clarity;
                // Also update pitch detector if possible
                if (this.pitch && this.pitch.updateWorkletConfig) {
                    this.pitch.updateWorkletConfig({ clarityFloor: clarity });
                }
                if (this.els.clarityValue) this.els.clarityValue.textContent = `${val}%`;
            };
        }
    }
    
    initializeSliderValues() {
        // Set initial display values to match recorder defaults
        if (this.els.tempoValue) this.els.tempoValue.textContent = '120 BPM';
        if (this.els.toleranceValue) this.els.toleranceValue.textContent = '±35¢';
        if (this.els.minDurationValue) this.els.minDurationValue.textContent = '200ms';
        if (this.els.fluctuationValue) this.els.fluctuationValue.textContent = '180ms';
        if (this.els.silenceDurationValue) this.els.silenceDurationValue.textContent = '120ms';
        if (this.els.clarityValue) this.els.clarityValue.textContent = '90%';
        if (this.els.attackValue) this.els.attackValue.textContent = '2.0x';
    }
    
    onPitch(p) {
        // Feed recorder live
        this.rec.pushFrame({ ...p, rmsDb: p.rmsDb, clarity: p.clarity });
        // UI
        this.els.note.textContent = p.note;
        this.els.oct.textContent = String(p.octave);
        this.els.freq.textContent = `${p.frequency.toFixed(2)} Hz`;
        this.els.cents.textContent = `${p.cents >= 0 ? '+' : ''}${p.cents}¢`;
        const x = 50 + (p.cents / 50) * 50;
        this.els.centsBar.style.left = `${x}%`;
    }
    renderNotes() {
        const arr = this.rec.quantized.length ? this.rec.quantized : this.rec.recorded;
        if (!arr.length) {
            this.els.stats.textContent = '0 notes';
            this.els.timeline.innerHTML = '<div class="notes-empty">No notes</div>';
            return;
        }
        const end = arr[arr.length - 1].startMs + arr[arr.length - 1].durationMs;
        this.els.stats.textContent = `${arr.length} notes • ${(end / 1000).toFixed(1)}s • ${this.getTempo()} BPM`;
        const html = arr.map(n => {
            const left = (n.startMs / end) * 100;
            const width = (n.durationMs / end) * 100;
            return `<div class="note-item" style="left:${left}%;width:${width}%"><span class="note-label">${n.note}${n.octave}</span></div>`;
        }).join('');
        this.els.timeline.innerHTML = html;
    }
    getTempo() { return this.rec?.['opts']?.tempo ?? 120; }
    setStatus(msg) { this.els.status.textContent = msg; }
    onError(err) {
        console.error(err);
        const message = err.message || err.toString() || 'Audio error';
        this.setStatus(message);
        
        // Only alert for critical errors, not minor warnings
        if (message.includes('permission') || message.includes('microphone') || message.includes('getUserMedia')) {
            alert('Microphone access required: ' + message);
        }
    }
}
document.addEventListener('DOMContentLoaded', async () => {
    const ui = new SongCreatorUI();
    await ui.init();
    window.songCreatorUI = ui;
});
export default SongCreatorUI;
