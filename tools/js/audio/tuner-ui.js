import PitchDetector from './song-creator-pitch.js';
const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NOTE_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const MIDI_MIN = 12; // C0
const MIDI_MAX = 108; // C8
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const centsOf = (ratio) => 1200 * Math.log2(ratio);
function buildTemperament(id) {
    const pcA = 9;
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
/* UI controller */
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
        // Drone mode state
        this.droneState = {
            mode: 'tuner', // 'tuner' or 'drone'
            octave: 4,
            activeDrones: new Map(), // Map<string, {oscillator, gain, frequency, noteLabel}>
            masterGain: null,
            audioContext: null,
            volume: 1.0,
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
        this.setupDroneMode();
        this.buildDroneGauge();
        
        // Load saved settings
        this.loadSettings();
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.stopAllDrones();
            if (this.state.isActive) {
                this.stop();
            }
        });
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
            this.saveSettings();
        };
        // Only clamp when user finishes editing (blur), not during typing
        this.elements.referencePitch.addEventListener('blur', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!Number.isNaN(val)) {
                setRef(val);
            } else {
                // Reset to current value if invalid
                e.target.value = String(this.state.referencePitch);
            }
        });
        // Update display while typing (without clamping)
        this.elements.referencePitch.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!Number.isNaN(val) && val >= 415 && val <= 466) {
                this.elements.referenceDisplay.textContent = `${val} Hz`;
            }
        });
        document.querySelector('[data-action="decrease-pitch"]')?.addEventListener('click', () => setRef(this.state.referencePitch - 1));
        document.querySelector('[data-action="increase-pitch"]')?.addEventListener('click', () => setRef(this.state.referencePitch + 1));
        // Transpose controls (written = concert + transpose)
        const setTranspose = (s) => { 
            this.state.transpose = parseInt(s, 10);
            // Update any active drones to reflect new transpose
            this.updateActiveDronesList();
            this.saveSettings();
        };
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
                    this.buildDroneGauge(); // Rebuild positions and redraw with new notation
                    this.saveSettings();
                }
            });
        });
        // Temperament control
        this.elements.temperament.addEventListener('change', (e) => {
            this.state.temperament = e.target.value;
            this.rebuildTemperament();
            this.saveSettings();
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
            // Store bound handlers for cleanup
            this.pitchHandler = ((e) => {
                this.onPitch(e.detail);
            });
            this.errorHandler = ((e) => {
                console.error('Pitch detection error:', e.detail);
                this.updateStatus('Error: ' + e.detail.message, false);
                this.stop();
            });
            // pitch frames
            this.detector.addEventListener('pitch', this.pitchHandler);
            // errors
            this.detector.addEventListener('error', this.errorHandler);
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
            // Remove event listeners before destroying
            if (this.pitchHandler) {
                this.detector.removeEventListener('pitch', this.pitchHandler);
            }
            if (this.errorHandler) {
                this.detector.removeEventListener('error', this.errorHandler);
            }
            await this.detector.stopMicrophone().catch(() => { });
            await this.detector.stop().catch(() => { });
            this.detector.destroy();
            this.detector = undefined;
            this.pitchHandler = undefined;
            this.errorHandler = undefined;
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
            // Get the locked center frequency to compute true deviation
            const lockedCenterFreq = this.getCenterFreq(this.state.lockedMidi);
            const centsFromLocked = 1200 * Math.log2(frame.frequency / lockedCenterFreq);
            const absFromLocked = Math.abs(centsFromLocked);
            // Switch only if we're decisively far from locked note
            // OR if clarity is high and the new note is closer
            const absToNew = Math.abs(nearest.cents);
            if (absFromLocked > 35 || (frame.clarity >= 0.88 && absToNew < absFromLocked - 10)) {
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
        // Ensure temperament is initialized
        if (!this.temperament || !this.temperament.offsetsA) {
            return fET; // Fallback to equal temperament
        }
        return fET * Math.pow(2, this.temperament.offsetsA[pc] / 1200);
    }
    computeDisplayFromMidi(concertMidi, transpose) {
        // Clamp transpose to reasonable range (-12 to +12 semitones)
        const clampedTranspose = clamp(transpose, -12, 12);
        const writtenMidi = concertMidi + clampedTranspose;
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
    
    /* ========================================
       DRONE MODE METHODS
       ======================================== */
    
    setupDroneMode() {
        // Mode toggle buttons
        const modeButtons = document.querySelectorAll('.mode-toggle-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.switchMode(mode);
            });
        });
        
        // Octave controls
        const octaveInput = document.getElementById('octave-input');
        const octaveDown = document.getElementById('octave-down');
        const octaveUp = document.getElementById('octave-up');
        
        if (octaveInput) {
            octaveInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10);
                this.droneState.octave = clamp(val, 0, 8);
                octaveInput.value = this.droneState.octave;
                this.drawDroneGauge(); // Redraw with new octave
                this.saveSettings();
            });
        }
        
        if (octaveDown) {
            octaveDown.addEventListener('click', () => {
                this.droneState.octave = clamp(this.droneState.octave - 1, 0, 8);
                if (octaveInput) octaveInput.value = this.droneState.octave;
                this.drawDroneGauge();
                this.saveSettings();
            });
        }
        
        if (octaveUp) {
            octaveUp.addEventListener('click', () => {
                this.droneState.octave = clamp(this.droneState.octave + 1, 0, 8);
                if (octaveInput) octaveInput.value = this.droneState.octave;
                this.drawDroneGauge();
                this.saveSettings();
            });
        }
        
        // Canvas click handling
        const droneCanvas = document.getElementById('drone-gauge');
        if (droneCanvas) {
            droneCanvas.addEventListener('click', (e) => this.handleDroneClick(e));
        }
        
        // Volume control
        const volumeSlider = document.getElementById('drone-volume');
        const volumeValue = document.getElementById('volume-value');
        
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                this.droneState.volume = val / 100;
                if (volumeValue) volumeValue.textContent = `${val}%`;
                if (this.droneState.masterGain) {
                    this.droneState.masterGain.gain.value = this.droneState.volume * 0.3;
                }
                this.saveSettings();
            });
        }
    }
    
    buildDroneGauge() {
        const canvas = document.getElementById('drone-gauge');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        this.droneCanvas = canvas;
        this.droneCtx = ctx;
        
        // Store note positions for click detection
        this.notePositions = [];
        const cx = 200, cy = 200, R = 160;
        
        for (let i = 0; i < 12; i++) {
            // Angle for each note (C at top = -90°, going clockwise)
            const angle = (i * 30 - 90) * Math.PI / 180;
            const x = cx + R * Math.cos(angle);
            const y = cy + R * Math.sin(angle);
            
            // Use notation preference for display
            const noteNames = this.state.useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
            this.notePositions.push({
                pc: i,
                note: noteNames[i],
                x,
                y,
                angle,
                isAccidental: noteNames[i].includes('♯') || noteNames[i].includes('♭')
            });
        }
        
        this.drawDroneGauge();
    }
    
    drawDroneGauge() {
        if (!this.droneCtx || !this.droneCanvas) return;
        
        const ctx = this.droneCtx;
        const { width, height } = this.droneCanvas;
        const cx = width / 2, cy = height / 2;
        const R = Math.min(width, height) / 2 - 20;
        
        // Clear
        ctx.clearRect(0, 0, width, height);
        
        // Get colors from CSS
        const styles = getComputedStyle(document.documentElement);
        const bgColor = styles.getPropertyValue('--tuner-gauge-bg').trim();
        const borderColor = styles.getPropertyValue('--tuner-panel-border').trim();
        const textColor = styles.getPropertyValue('--tuner-text').trim();
        const textLight = styles.getPropertyValue('--tuner-text-light').trim();
        const needleColor = styles.getPropertyValue('--tuner-needle').trim();
        const greenColor = styles.getPropertyValue('--tuner-green').trim();
        
        // Draw outer circle
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = bgColor;
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw note markers and labels
        this.notePositions.forEach(pos => {
            const x = cx + R * Math.cos(pos.angle);
            const y = cy + R * Math.sin(pos.angle);
            
            const key = `${pos.note}${this.droneState.octave}`;
            const isActive = this.droneState.activeDrones.has(key);
            
            // Draw marker dot
            ctx.beginPath();
            ctx.arc(x, y, isActive ? 12 : 8, 0, Math.PI * 2);
            ctx.fillStyle = isActive ? greenColor : (pos.isAccidental ? textLight : textColor);
            ctx.fill();
            
            if (isActive) {
                ctx.strokeStyle = greenColor;
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Glow effect
                ctx.shadowBlur = 15;
                ctx.shadowColor = greenColor;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            
            // Draw note label
            const labelR = R - 35;
            const lx = cx + labelR * Math.cos(pos.angle);
            const ly = cy + labelR * Math.sin(pos.angle);
            
            ctx.font = pos.isAccidental ? '600 14px Poppins, sans-serif' : '700 16px Poppins, sans-serif';
            ctx.fillStyle = isActive ? greenColor : (pos.isAccidental ? textLight : textColor);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pos.note, lx, ly);
        });
        
        // Draw center circle
        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.fillStyle = bgColor;
        ctx.fill();
        ctx.strokeStyle = needleColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Center text
        ctx.font = '700 14px Poppins, sans-serif';
        ctx.fillStyle = needleColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DRONE', cx, cy);
    }
    
    handleDroneClick(e) {
        if (!this.droneCanvas) return;
        
        const rect = this.droneCanvas.getBoundingClientRect();
        const scaleX = this.droneCanvas.width / rect.width;
        const scaleY = this.droneCanvas.height / rect.height;
        
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
        
        const cx = this.droneCanvas.width / 2;
        const cy = this.droneCanvas.height / 2;
        
        // Find closest note
        let closestNote = null;
        let minDist = Infinity;
        
        this.notePositions.forEach(pos => {
            const x = cx + 160 * Math.cos(pos.angle);
            const y = cy + 160 * Math.sin(pos.angle);
            const dist = Math.sqrt((clickX - x) ** 2 + (clickY - y) ** 2);
            
            if (dist < 35 && dist < minDist) { // 35px click radius for easier clicking
                minDist = dist;
                closestNote = pos;
            }
        });
        
        if (closestNote) {
            this.toggleDroneByNote(closestNote.note, closestNote.pc);
        }
    }
    
    toggleDroneByNote(note, pc) {
        const key = `${note}${this.droneState.octave}`;
        
        if (this.droneState.activeDrones.has(key)) {
            this.stopDroneByKey(key, note, pc);
        } else {
            this.startDrone(note, pc, null);
        }
    }
    
    stopDroneByKey(key, note, pc) {
        const drone = this.droneState.activeDrones.get(key);
        
        if (!drone || !this.droneState.audioContext) return;
        
        const ctx = this.droneState.audioContext;
        const now = ctx.currentTime;
        
        // Release (fade out over 150ms)
        drone.envelope.gain.cancelScheduledValues(now);
        drone.envelope.gain.setValueAtTime(drone.envelope.gain.value, now);
        drone.envelope.gain.linearRampToValueAtTime(0, now + 0.15);
        
        // Stop oscillators after release
        drone.oscillators.forEach(osc => {
            osc.stop(now + 0.15);
        });
        
        // Clean up
        this.droneState.activeDrones.delete(key);
        
        // Update UI
        this.drawDroneGauge();
        this.updateActiveDronesList();
    }
    
    switchMode(mode) {
        this.droneState.mode = mode;
        
        // Update toggle buttons
        document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.saveSettings();
        
        // Show/hide sections
        const tunerSection = document.querySelector('.tuner-display-section');
        const droneSection = document.querySelector('.drone-mode-section');
        
        if (mode === 'drone') {
            if (tunerSection) tunerSection.style.display = 'none';
            if (droneSection) droneSection.style.display = 'block';
            
            // Stop tuner if active
            if (this.state.isActive) {
                this.stop();
            }
            
            // Initialize audio context for drones
            this.initDroneAudio();
        } else {
            if (tunerSection) tunerSection.style.display = 'flex';
            if (droneSection) droneSection.style.display = 'none';
            
            // Stop all drones
            this.stopAllDrones();
        }
    }
    
    initDroneAudio() {
        if (!this.droneState.audioContext) {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.droneState.audioContext = new AC();
            
            // Create master gain node (volume * 0.3 for comfortable listening level)
            this.droneState.masterGain = this.droneState.audioContext.createGain();
            this.droneState.masterGain.gain.value = this.droneState.volume * 0.3;
            this.droneState.masterGain.connect(this.droneState.audioContext.destination);
        }
    }
    
    toggleDrone(note, pc, button) {
        const key = `${note}${this.droneState.octave}`;
        
        if (this.droneState.activeDrones.has(key)) {
            this.stopDrone(note, pc, button);
        } else {
            this.startDrone(note, pc, button);
        }
    }
    
    startDrone(note, pc, _element) {
        const key = `${note}${this.droneState.octave}`;
        
        // Don't start if already active
        if (this.droneState.activeDrones.has(key)) return;
        
        // Ensure audio context
        this.initDroneAudio();
        const ctx = this.droneState.audioContext;
        
        // Resume context if suspended (user gesture requirement)
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        // Calculate exact frequency using current temperament
        // MIDI note number: octave * 12 + pitch class, where C-1 = 0, C0 = 12, C1 = 24, etc.
        // Octave 4 starts at C4 = MIDI 60, so C4 = (4 * 12) + 12 + 0 = 60
        // Apply transpose: drone shows written pitch, plays concert pitch
        const writtenMidi = this.droneState.octave * 12 + 12 + pc;
        const concertMidi = writtenMidi - this.state.transpose; // written = concert + transpose, so concert = written - transpose
        const frequency = this.getCenterFreq(concertMidi);
        
        // Create oscillator with rich timbre
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        
        // Main tone (pure sine for maximum accuracy)
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(frequency, ctx.currentTime);
        
        // Octave below (sine for pure depth)
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(frequency / 2, ctx.currentTime);
        
        // Perfect fifth above (sine for harmonic richness)
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(frequency * 1.5, ctx.currentTime);
        
        // Individual gains for mixing
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        const gain3 = ctx.createGain();
        
        gain1.gain.value = 0.6;  // Main tone
        gain2.gain.value = 0.15; // Octave below
        gain3.gain.value = 0.1;  // Fifth above
        
        // Envelope gain for smooth attack/release
        const envelope = ctx.createGain();
        envelope.gain.value = 0;
        
        // Connect graph
        osc1.connect(gain1).connect(envelope);
        osc2.connect(gain2).connect(envelope);
        osc3.connect(gain3).connect(envelope);
        envelope.connect(this.droneState.masterGain);
        
        // Attack (fade in over 100ms)
        const now = ctx.currentTime;
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(1, now + 0.1);
        
        // Start oscillators
        osc1.start(now);
        osc2.start(now);
        osc3.start(now);
        
        // Store drone info
        this.droneState.activeDrones.set(key, {
            oscillators: [osc1, osc2, osc3],
            gains: [gain1, gain2, gain3],
            envelope,
            frequency,
            noteLabel: `${note}${this.droneState.octave}`,
            pc,
        });
        
        // Update UI
        this.drawDroneGauge();
        this.updateActiveDronesList();
    }
    
    stopDrone(note, pc, _button) {
        const key = `${note}${this.droneState.octave}`;
        const drone = this.droneState.activeDrones.get(key);
        
        if (!drone) return;
        
        const ctx = this.droneState.audioContext;
        const now = ctx.currentTime;
        
        // Release (fade out over 150ms)
        drone.envelope.gain.cancelScheduledValues(now);
        drone.envelope.gain.setValueAtTime(drone.envelope.gain.value, now);
        drone.envelope.gain.linearRampToValueAtTime(0, now + 0.15);
        
        // Stop oscillators after release
        drone.oscillators.forEach(osc => {
            osc.stop(now + 0.15);
        });
        
        // Clean up
        this.droneState.activeDrones.delete(key);
        
        // Update UI
        this.drawDroneGauge();
        this.updateActiveDronesList();
    }
    
    stopAllDrones() {
        // Stop all active drones
        if (!this.droneState.audioContext || this.droneState.activeDrones.size === 0) {
            this.droneState.activeDrones.clear();
            return;
        }
        
        const ctx = this.droneState.audioContext;
        const now = ctx.currentTime;
        
        for (const [key, drone] of this.droneState.activeDrones.entries()) {
            try {
                // Release (fade out over 150ms)
                drone.envelope.gain.cancelScheduledValues(now);
                drone.envelope.gain.setValueAtTime(drone.envelope.gain.value, now);
                drone.envelope.gain.linearRampToValueAtTime(0, now + 0.15);
                
                // Stop oscillators after release
                drone.oscillators.forEach(osc => {
                    osc.stop(now + 0.15);
                });
            } catch (err) {
                console.warn('Error stopping drone:', key, err);
            }
        }
        
        // Clear map
        this.droneState.activeDrones.clear();
        this.drawDroneGauge();
        this.updateActiveDronesList();
    }
    
    updateActiveDronesList() {
        const container = document.getElementById('active-drones-list');
        if (!container) return;
        
        if (this.droneState.activeDrones.size === 0) {
            container.innerHTML = '<p class="no-drones">Click notes above to start drones</p>';
            return;
        }
        
        // Create chips for each active drone
        const chips = Array.from(this.droneState.activeDrones.entries()).map(([key, drone]) => {
            const freqStr = drone.frequency.toFixed(2);
            return `
                <div class="drone-chip">
                    <span class="drone-note">${drone.noteLabel}</span>
                    <span class="drone-freq">${freqStr} Hz</span>
                    <button class="remove-drone" data-key="${key}" aria-label="Remove ${drone.noteLabel}">×</button>
                </div>
            `;
        }).join('');
        
        container.innerHTML = chips;
        
        // Add click handlers to remove buttons
        container.querySelectorAll('.remove-drone').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                const droneEntry = Array.from(this.droneState.activeDrones.entries())
                    .find(([k]) => k === key);
                
                if (droneEntry) {
                    const [droneKey, drone] = droneEntry;
                    // Stop drone directly using the key
                    this.stopDroneByKey(droneKey, drone.noteLabel.slice(0, -1), drone.pc);
                }
            });
        });
    }
    
    saveSettings() {
        try {
            const settings = {
                mode: this.droneState.mode,
                referencePitch: this.state.referencePitch,
                transpose: this.state.transpose,
                useFlats: this.state.useFlats,
                temperament: this.state.temperament,
                octave: this.droneState.octave,
                volume: this.droneState.volume,
            };
            sessionStorage.setItem('tunerSettings', JSON.stringify(settings));
        } catch (err) {
            console.warn('Failed to save tuner settings:', err);
        }
    }
    
    loadSettings() {
        try {
            const saved = sessionStorage.getItem('tunerSettings');
            if (!saved) return;
            
            const settings = JSON.parse(saved);
            
            // Restore reference pitch
            if (settings.referencePitch) {
                this.state.referencePitch = settings.referencePitch;
                this.elements.referencePitch.value = String(settings.referencePitch);
                this.elements.referenceDisplay.textContent = `${settings.referencePitch} Hz`;
            }
            
            // Restore transpose
            if (settings.transpose !== undefined) {
                this.state.transpose = settings.transpose;
                const option = Array.from(this.elements.transpose.options)
                    .find(opt => parseInt(opt.value, 10) === settings.transpose);
                if (option) {
                    this.elements.transpose.value = option.value;
                }
            }
            
            // Restore notation preference
            if (settings.useFlats !== undefined) {
                this.state.useFlats = settings.useFlats;
                document.querySelectorAll('.notation-option').forEach(btn => {
                    const notation = btn.dataset.notation;
                    if ((notation === 'flats' && settings.useFlats) || 
                        (notation === 'sharps' && !settings.useFlats)) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
            
            // Restore temperament
            if (settings.temperament) {
                this.state.temperament = settings.temperament;
                this.elements.temperament.value = settings.temperament;
            }
            
            // Rebuild temperament with restored settings
            this.rebuildTemperament();
            
            // Restore drone octave
            if (settings.octave !== undefined) {
                this.droneState.octave = clamp(settings.octave, 0, 8);
                const octaveInput = document.getElementById('octave-input');
                if (octaveInput) octaveInput.value = this.droneState.octave;
            }
            
            // Restore volume
            if (settings.volume !== undefined) {
                this.droneState.volume = settings.volume;
                const volumeSlider = document.getElementById('drone-volume');
                const volumeValue = document.getElementById('volume-value');
                if (volumeSlider) volumeSlider.value = String(Math.round(settings.volume * 100));
                if (volumeValue) volumeValue.textContent = `${Math.round(settings.volume * 100)}%`;
            }
            
            // Restore mode (do this last so UI is ready)
            if (settings.mode && settings.mode !== 'tuner') {
                this.switchMode(settings.mode);
            }
            
            // Rebuild and redraw drone gauge with restored notation
            this.buildDroneGauge();
            
        } catch (err) {
            console.warn('Failed to load tuner settings:', err);
        }
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
