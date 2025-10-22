import PitchDetector from './song-creator-pitch.js';
const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NOTE_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const MIDI_MIN = 12; // C0
const MIDI_MAX = 108; // C8 (safe for most instruments)
/** Utility: clamp */
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
/** Exact cents from ratio */
const centsOf = (ratio) => 1200 * Math.log2(ratio);
/** Build temperament tables (anchored to A) */
function buildTemperament(id) {
    // Compute offsets so that A (pc=9) offset is exactly 0¢.
    const pcA = 9;
    // helper: shift all offsets so offsets[pcA] == 0
    const anchorA = (arr) => {
        const shift = arr[pcA];
        return arr.map(v => v - shift);
    };
    if (id === 'equal') {
        return { id, name: 'Equal Temperament', offsetsA: new Array(12).fill(0) };
    }
    if (id === 'pythagorean') {
        // map pitch-class -> k fifth steps relative to A via circle of fifths
        const kByPc = {
            9: 0, // A
            4: 1, // E
            11: 2, // B
            6: 3, // F#
            1: 4, // C#
            8: 5, // G#
            3: 6, // D#
            10: 7, // A# (wolf side)
            2: -1, // D
            7: -2, // G
            0: -3, // C
            5: -4, // F
        };
        const off = new Array(12).fill(0);
        const log2_3_2 = Math.log2(3 / 2);
        for (let pc = 0; pc < 12; pc++) {
            const k = kByPc[pc];
            const s = ((pc - pcA + 6) % 12) - 6; // ET semitone distance from A in [-6..+5]
            const x = k * log2_3_2 - s / 12; // raw difference in octaves
            const n = -Math.floor(x + 0.5); // choose octave to keep near 0
            off[pc] = 1200 * (x + n);
        }
        return { id, name: 'Pythagorean', offsetsA: anchorA(off) };
    }
    if (id === 'meantone') {
        // Quarter-comma meantone: each fifth narrowed by 1/4 syntonic comma
        const rfifth = (3 / 2) * Math.pow(81 / 80, -0.25);
        const log2_rfifth = Math.log2(rfifth);
        const kByPc = {
            9: 0, 4: 1, 11: 2, 6: 3, 1: 4, 8: 5, 3: 6, 10: 7,
            2: -1, 7: -2, 0: -3, 5: -4,
        };
        const off = new Array(12).fill(0);
        for (let pc = 0; pc < 12; pc++) {
            const k = kByPc[pc];
            const s = ((pc - pcA + 6) % 12) - 6;
            const x = k * log2_rfifth - s / 12;
            const n = -Math.floor(x + 0.5);
            off[pc] = 1200 * (x + n);
        }
        return { id, name: '¼‑Comma Meantone', offsetsA: anchorA(off) };
    }
    // 'just' (C-major, 5-limit set collapsed to 12 pitch-classes)
    // Ratios relative to C for chromatic set:
    // [C, C#/Db, D, Eb, E, F, F#, G, Ab, A, Bb, B]
    const JI_ratios = [
        1 / 1, // C
        16 / 15, // Db (used for C# class)
        9 / 8, // D
        6 / 5, // Eb
        5 / 4, // E
        4 / 3, // F
        45 / 32, // F#
        3 / 2, // G
        8 / 5, // Ab
        5 / 3, // A
        9 / 5, // Bb
        15 / 8, // B
    ];
    const offC = JI_ratios.map((r, pc) => centsOf(r) - pc * 100); // offsets vs ET if C is the anchor
    // Shift so A’s offset = 0
    const off = offC.map(v => v - offC[pcA]);
    return { id, name: 'Just Intonation (C major)', offsetsA: off };
}
/** Pitch centers cache for current temperament + A4 */
class PitchCenters {
    constructor() {
        this.centers = new Map(); // midi -> freq
        this.refA4 = 440;
        this.offsetsA = new Array(12).fill(0);
    }
    configure(refA4, offsetsA) {
        this.refA4 = refA4;
        this.offsetsA = offsetsA.slice();
        this.rebuild();
    }
    rebuild() {
        this.centers.clear();
        for (let m = MIDI_MIN; m <= MIDI_MAX; m++) {
            const pc = ((m % 12) + 12) % 12;
            const fET = this.refA4 * Math.pow(2, (m - 69) / 12);
            const f = fET * Math.pow(2, this.offsetsA[pc] / 1200); // exact center
            this.centers.set(m, f);
        }
    }
    /** Find nearest MIDI note center to frequency `f` */
    nearest(f) {
        if (!(f > 0 && isFinite(f)))
            return null;
        // Start search near ET guess to avoid scanning all MIDI
        const n = 12 * Math.log2(f / this.refA4) + 69;
        const guess = Math.round(n);
        let bestMidi = guess;
        let bestFreq = this.centers.get(clamp(guess, MIDI_MIN, MIDI_MAX));
        let bestCents = Math.abs(1200 * Math.log2(f / bestFreq));
        // Search within ±3 semitones to handle non-ET spacing & wolves
        for (let m = guess - 3; m <= guess + 3; m++) {
            if (m < MIDI_MIN || m > MIDI_MAX)
                continue;
            const f0 = this.centers.get(m);
            const cents = 1200 * Math.log2(f / f0);
            const ac = Math.abs(cents);
            if (ac < bestCents) {
                bestCents = ac;
                bestMidi = m;
                bestFreq = f0;
            }
        }
        // Clamp cents to display range; nearest center ensures it's already sensible
        const centsSigned = clamp(1200 * Math.log2(f / bestFreq), -120, 120);
        return { midi: bestMidi, freq: bestFreq, cents: centsSigned };
    }
}
/**
 * -------------------------------------------------------
 * UI Controller
 * -------------------------------------------------------
 */
class TunerUI {
    constructor() {
        this.centers = new PitchCenters();
        this.temperament = buildTemperament('equal');
        this.state = {
            isActive: false,
            referencePitch: 440,
            transpose: 0,
            useFlats: false,
            temperament: 'equal',
            smoothedCents: 0,
            smoothedFreq: 0,
            lastTimeMs: performance.now(),
            lockedMidi: null,
        };
        // UI elements
        this.elements = {
            startBtn: document.getElementById('start-tuner'),
            stopBtn: document.getElementById('stop-tuner'),
            noteName: document.getElementById('note-name'),
            noteOctave: document.getElementById('note-octave'),
            centsDisplay: document.getElementById('cents-display'),
            frequencyReadout: document.getElementById('frequency-readout'),
            clarityReadout: document.getElementById('clarity-readout'),
            centsBarIndicator: document.getElementById('cents-bar-indicator'),
            statusText: document.getElementById('status-text'),
            statusDot: document.querySelector('.status-dot'),
            referencePitch: document.getElementById('reference-pitch'),
            referenceDisplay: document.getElementById('reference-display'),
            transpose: document.getElementById('transpose'),
            temperament: document.getElementById('temperament'),
        };
        // smoothing / display cadence
        this.MIN_CLARITY_FOR_LOCK = 0.75;
        this.TEXT_UPDATE_MS = 40; // 25 Hz for text is enough
        this.lastTextUpdate = 0;
        // short history to reject outliers
        this.centsHistory = [];
        this.animate = () => {
            if (!this.state.isActive)
                return;
            this.drawGauge(this.state.smoothedCents);
            this.animationFrame = requestAnimationFrame(this.animate);
        };
        this.canvas = document.getElementById('tuner-gauge');
        const ctx = this.canvas.getContext('2d');
        if (!ctx)
            throw new Error('Canvas context not available');
        this.ctx = ctx;
        // initial tables and graphics
        this.rebuildTemperament();
        this.buildGaugeBackground();
        this.drawGauge(0);
        this.setupEventListeners();
    }
    setupEventListeners() {
        // Start/Stop buttons
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.stopBtn.addEventListener('click', () => this.stop());
        // Reference pitch controls
        const setRef = (val) => {
            const v = Math.round(clamp(val, 415, 466));
            this.state.referencePitch = v;
            this.elements.referencePitch.value = String(v);
            this.elements.referenceDisplay.textContent = `${v} Hz`;
            this.rebuildTemperament();
        };
        this.elements.referencePitch.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!Number.isNaN(val))
                setRef(val);
        });
        document.querySelector('[data-action="decrease-pitch"]')?.addEventListener('click', () => setRef(this.state.referencePitch - 1));
        document.querySelector('[data-action="increase-pitch"]')?.addEventListener('click', () => setRef(this.state.referencePitch + 1));
        // Transpose controls (written = concert + transpose)
        const setTranspose = (s) => { this.state.transpose = parseInt(s, 10); };
        this.elements.transpose.addEventListener('change', (e) => setTranspose(e.target.value));
        document.querySelector('[data-action="decrease-transpose"]')?.addEventListener('click', () => {
            const select = this.elements.transpose;
            if (select.selectedIndex > 0) {
                select.selectedIndex -= 1;
                setTranspose(select.value);
            }
        });
        document.querySelector('[data-action="increase-transpose"]')?.addEventListener('click', () => {
            const select = this.elements.transpose;
            if (select.selectedIndex < select.options.length - 1) {
                select.selectedIndex += 1;
                setTranspose(select.value);
            }
        });
        // Notation toggle
        document.querySelectorAll('.notation-option').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const target = e.target;
                const notation = target.dataset.notation;
                if (notation) {
                    this.state.useFlats = notation === 'flats';
                    document.querySelectorAll('.notation-option').forEach((b) => b.classList.remove('active'));
                    target.classList.add('active');
                }
            });
        });
        // Temperament control
        this.elements.temperament.addEventListener('change', (e) => {
            this.state.temperament = e.target.value;
            this.rebuildTemperament();
        });
    }
    rebuildTemperament() {
        this.temperament = buildTemperament(this.state.temperament);
        this.centers.configure(this.state.referencePitch, this.temperament.offsetsA);
    }
    buildGaugeBackground() {
        const { width, height } = this.canvas;
        const bg = document.createElement('canvas');
        bg.width = width;
        bg.height = height;
        const g = bg.getContext('2d');
        const cx = width / 2, cy = height / 2;
        const R = Math.min(width, height) / 2 - 20;
        const drawArc = (startCents, endCents, color, alpha) => {
            const startAngle = this.centsToAngle(startCents);
            const endAngle = this.centsToAngle(endCents);
            g.beginPath();
            g.arc(cx, cy, R, startAngle, endAngle);
            g.strokeStyle = color;
            g.globalAlpha = alpha;
            g.lineWidth = 30;
            g.stroke();
            g.globalAlpha = 1;
        };
        // zones
        drawArc(-50, -12, '#e74c3c', 0.15);
        drawArc(-12, -3, '#f39c12', 0.22);
        drawArc(-3, 3, '#50E3C2', 0.32);
        drawArc(3, 12, '#f39c12', 0.22);
        drawArc(12, 50, '#e74c3c', 0.15);
        // ticks
        const cents = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
        cents.forEach((c) => {
            const ang = this.centsToAngle(c);
            const r1 = R - 35;
            const r2 = c % 20 === 0 ? R - 25 : R - 30;
            const x1 = cx + r1 * Math.cos(ang), y1 = cy + r1 * Math.sin(ang);
            const x2 = cx + r2 * Math.cos(ang), y2 = cy + r2 * Math.sin(ang);
            g.beginPath();
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--tuner-text-light').trim();
            g.lineWidth = c === 0 ? 3 : 1.5;
            g.stroke();
        });
        // center cap
        g.beginPath();
        g.arc(cx, cy, 8, 0, Math.PI * 2);
        g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tuner-needle').trim();
        g.fill();
        this.gaugeBG = bg;
    }
    async start() {
        try {
            this.updateStatus('Requesting microphone access...', false);
            this.detector = new PitchDetector({
                workletUrl: '/tools/js/audio/pitch-worklet.js',
                bufferSize: 4096,
                hopSize: 512,
                minFreq: 55, // extend a touch lower
                maxFreq: 2000,
                yinThreshold: 0.10,
                rmsFloorDb: -55,
                clarityFloor: 0.70,
                hangMs: 90,
                dcBlock: true,
            });
            await this.detector.init();
            await this.detector.startMicrophone();
            await this.detector.start();
            // pitch frames
            this.detector.addEventListener('pitch', ((e) => {
                this.onPitch(e.detail);
            }));
            // errors
            this.detector.addEventListener('error', ((e) => {
                console.error('Pitch detection error:', e.detail);
                this.updateStatus('Error: ' + e.detail.message, false);
                this.stop();
            }));
            this.state.isActive = true;
            this.elements.startBtn.style.display = 'none';
            this.elements.stopBtn.style.display = 'flex';
            this.updateStatus('Listening...', true);
            // Start animation loop
            this.animate();
        }
        catch (err) {
            console.error('Failed to start tuner:', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.updateStatus('Error: ' + message, false);
        }
    }
    async stop() {
        this.state.isActive = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = undefined;
        }
        if (this.detector) {
            await this.detector.stopMicrophone().catch(() => { });
            await this.detector.stop().catch(() => { });
            this.detector.destroy();
            this.detector = undefined;
        }
        this.elements.startBtn.style.display = 'flex';
        this.elements.stopBtn.style.display = 'none';
        this.updateStatus('Ready to tune', false);
        // Reset display
        this.elements.noteName.textContent = '--';
        this.elements.noteOctave.textContent = '-';
        this.elements.centsDisplay.textContent = '0¢';
        this.elements.frequencyReadout.textContent = '--- Hz';
        this.elements.clarityReadout.textContent = '--';
        this.elements.noteName.className = 'note-name';
        this.elements.centsBarIndicator.className = 'cents-bar-indicator';
        this.state.smoothedCents = 0;
        this.state.smoothedFreq = 0;
        this.state.lockedMidi = null;
        this.drawGauge(0);
    }
    onPitch(frame) {
        if (!this.state.isActive)
            return;
        const now = performance.now();
        const dt = Math.max(1, now - this.state.lastTimeMs); // ms
        this.state.lastTimeMs = now;
        const nearest = this.centers.nearest(frame.frequency);
        if (!nearest)
            return;
        // Hysteresis: keep the locked MIDI unless the new one is decisively closer
        if (this.state.lockedMidi === null) {
            this.state.lockedMidi = nearest.midi;
        }
        else if (nearest.midi !== this.state.lockedMidi) {
            // compare cents distance to both centers
            const lockedFreq = this.centers['nearest'](this.centers['nearest'](frame.frequency).freq); // residue but we need locked freq
            // We'll compute locked center directly:
            const lockedCenter = this.centers['nearest'](this.centers['nearest'](frame.frequency).freq);
            // Simpler/robust: switch if |cents| > 35 OR clarity high and |cents| > 25
            const absC = Math.abs(nearest.cents);
            if (absC > 35 || (frame.clarity >= 0.88 && absC > 25)) {
                this.state.lockedMidi = nearest.midi;
            }
        }
        // Re-evaluate cents against the **locked** center, not the nearest (for stability)
        const lockedMidi = this.state.lockedMidi;
        const lockedCenterFreq = this.getCenterFreq(lockedMidi);
        let cents = 1200 * Math.log2(frame.frequency / lockedCenterFreq);
        // Median-outlier rejection over the last few cents samples
        this.centsHistory.push(cents);
        if (this.centsHistory.length > 5)
            this.centsHistory.shift();
        const sorted = this.centsHistory.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        cents = median;
        // Exponential smoothing in cents-space (clarity-weighted, time-constant aware)
        // alpha ~ 1 - exp(-dt/tau); tau shorter if clarity high
        const tauMs = clamp(160 - 80 * frame.clarity, 60, 160); // 60–160 ms
        const alpha = 1 - Math.exp(-dt / tauMs);
        this.state.smoothedCents = (1 - alpha) * this.state.smoothedCents + alpha * cents;
        // Smooth frequency (display only)
        const tauF = clamp(220 - 120 * frame.clarity, 80, 220);
        const aF = 1 - Math.exp(-dt / tauF);
        this.state.smoothedFreq = (1 - aF) * this.state.smoothedFreq + aF * frame.frequency;
        // Color & text updates throttled ~25Hz
        if (now - this.lastTextUpdate >= this.TEXT_UPDATE_MS) {
            const display = this.computeDisplayFromMidi(lockedMidi, this.state.transpose);
            this.updateNoteDisplay(display.note, display.octave, this.state.smoothedCents, frame.clarity);
            this.lastTextUpdate = now;
        }
    }
    getCenterFreq(midi) {
        // Using the same formula as in the centers cache
        const pc = ((midi % 12) + 12) % 12;
        const fET = this.state.referencePitch * Math.pow(2, (midi - 69) / 12);
        return fET * Math.pow(2, this.temperament.offsetsA[pc] / 1200);
    }
    computeDisplayFromMidi(concertMidi, transpose) {
        const writtenMidi = concertMidi + transpose;
        const pc = ((writtenMidi % 12) + 12) % 12;
        const octave = Math.floor(writtenMidi / 12) - 1;
        const name = this.state.useFlats ? NOTE_NAMES_FLAT[pc] : NOTE_NAMES_SHARP[pc];
        return { note: name, octave };
    }
    updateNoteDisplay(note, octave, cents, clarity) {
        // Text
        this.elements.noteName.textContent = note;
        this.elements.noteOctave.textContent = octave >= 0 ? String(octave) : '-';
        const centsRounded = Math.round(cents);
        const centsDisplay = `${centsRounded >= 0 ? '+' : ''}${centsRounded}¢`;
        this.elements.centsDisplay.textContent = centsDisplay;
        const freqText = this.state.smoothedFreq > 0 ? `${this.state.smoothedFreq.toFixed(1)} Hz` : '--- Hz';
        this.elements.frequencyReadout.textContent = freqText;
        this.elements.clarityReadout.textContent = `${Math.round(clarity * 100)}%`;
        // Colors
        const absC = Math.abs(cents);
        let colorClass = 'out-of-tune';
        if (absC <= 3)
            colorClass = 'in-tune';
        else if (absC <= 12)
            colorClass = 'close';
        this.elements.noteName.className = `note-name ${colorClass}`;
        this.elements.centsBarIndicator.className = `cents-bar-indicator ${colorClass}`;
        // Linear bar: map [-50..+50] -> [0..100]%
        const clamped = clamp(cents, -50, 50);
        const pos = ((clamped + 50) / 100) * 100;
        this.elements.centsBarIndicator.style.left = `${pos}%`;
    }
    /** Gauge drawing */
    drawGauge(cents) {
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);
        if (this.gaugeBG)
            this.ctx.drawImage(this.gaugeBG, 0, 0);
        const cx = width / 2, cy = height / 2;
        const R = Math.min(width, height) / 2 - 20;
        // Needle
        const angle = this.centsToAngle(clamp(cents, -50, 50));
        const endX = cx + (R - 15) * Math.cos(angle);
        const endY = cy + (R - 15) * Math.sin(angle);
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(endX, endY);
        this.ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--tuner-needle').trim();
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(endX, endY, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tuner-needle').trim();
        this.ctx.fill();
    }
    centsToAngle(cents) {
        // Map -50..+50 cents to -135°..+135°, 0¢ at top
        const normalized = cents / 50; // -1..+1
        const degrees = normalized * 135 - 90; // rotate to top
        return degrees * (Math.PI / 180);
    }
    updateStatus(text, active) {
        this.elements.statusText.textContent = text;
        if (active)
            this.elements.statusDot.classList.add('active');
        else
            this.elements.statusDot.classList.remove('active');
    }
}
// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new TunerUI());
}
else {
    new TunerUI();
}
export default TunerUI;
