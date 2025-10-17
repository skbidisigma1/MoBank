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
        };
    }
    async init() {
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
        this.pitch.addEventListener('pitch', (e) => this.onPitch(e.detail));
        this.pitch.addEventListener('error', (e) => this.onError(e.detail));
        // UI events
        this.els.startMic.onclick = () => this.startMic();
        this.els.stopMic.onclick = () => this.stopMic();
        this.els.startRec.onclick = () => this.startRec();
        this.els.stopRec.onclick = () => this.stopRec();
        this.els.play.onclick = () => this.play();
        this.els.clear.onclick = () => this.clear();
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
        this.rec.play(this.ctx);
    }
    clear() {
        this.rec.clear();
        this.renderNotes();
        this.els.play.disabled = true;
        this.els.clear.disabled = true;
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
        this.setStatus(err.message || 'Audio error');
        alert(this.els.status.textContent);
    }
}
document.addEventListener('DOMContentLoaded', async () => {
    const ui = new SongCreatorUI();
    await ui.init();
    window.songCreatorUI = ui;
});
export default SongCreatorUI;
