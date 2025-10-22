export class PitchDetector extends EventTarget {
    constructor(cfg) {
        super();
        this.isRunning = false;
        this.config = cfg;
    }
    get audioContext() { return this.ctx; }
    async init() {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        try {
            await this.ctx.audioWorklet.addModule(this.config.workletUrl);
        }
        catch (err) {
            this.dispatchError(new Error(`Failed to load worklet: ${String(err)}`));
            throw err;
        }
        this.node = new AudioWorkletNode(this.ctx, 'pitch-worklet', {
            processorOptions: {
                bufferSize: this.config.bufferSize ?? 2048,
                hopSize: this.config.hopSize ?? 256,
                minFreq: this.config.minFreq ?? 80,
                maxFreq: this.config.maxFreq ?? 1000,
                yinThreshold: this.config.yinThreshold ?? 0.12,
                rmsFloorDb: this.config.rmsFloorDb ?? -60,
                clarityFloor: this.config.clarityFloor ?? 0.12,
                hangMs: this.config.hangMs ?? 60,
                dcBlock: this.config.dcBlock ?? true,
            },
        });
        this.node.port.onmessage = (ev) => {
            const d = ev.data;
            if (d?.type === 'pitch') {
                const { t, freq, clarity, rmsDb } = d;
                const mapped = this.mapFrequency(freq);
                const frame = {
                    t, frequency: freq, clarity, rmsDb,
                    note: mapped.note, octave: mapped.octave, cents: mapped.cents,
                };
                this.dispatchEvent(new CustomEvent('pitch', { detail: frame }));
            }
            else if (d?.type === 'level') {
                // Optional: emit levels if you want metering
            }
        };
        // keep worklet alive in the graph (silent)
        this.zeroGain = this.ctx.createGain();
        this.zeroGain.gain.value = 0;
        this.node.connect(this.zeroGain).connect(this.ctx.destination);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRunning)
                this.ctx.suspend();
            else if (!document.hidden && this.isRunning)
                this.ctx.resume();
        });
    }
    async startMicrophone() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 1,
                },
            });
            this.stream = stream;
            this.input = this.ctx.createMediaStreamSource(stream);
            if (!this.node)
                throw new Error('Worklet node not ready');
            this.input.connect(this.node);
        }
        catch (err) {
            this.dispatchError(err);
            throw err;
        }
    }
    async start() {
        if (this.isRunning)
            return;
        if (this.ctx.state === 'suspended')
            await this.ctx.resume();
        this.isRunning = true;
    }
    async stop() {
        this.isRunning = false;
        await this.ctx.suspend();
    }
    async stopMicrophone() {
        try {
            this.input?.disconnect();
            this.input = undefined;
            this.stream?.getTracks().forEach(t => t.stop());
            this.stream = undefined;
        }
        catch { }
    }
    destroy() {
        this.stopMicrophone();
        try {
            this.node?.disconnect();
        }
        catch { }
        try {
            this.zeroGain?.disconnect();
        }
        catch { }
        this.ctx?.close();
    }
    updateWorkletConfig(partial) {
        this.config = { ...this.config, ...partial };
        this.node?.port.postMessage({ type: 'config', value: partial });
    }
    mapFrequency(freq) {
        if (freq <= 0 || !isFinite(freq))
            return { note: '--', octave: -1, cents: 0 };
        const A4 = 440;
        const n = 12 * Math.log2(freq / A4);
        const midi = Math.round(n) + 69;
        const cents = Math.round((n - Math.round(n)) * 100); // -50..+50
        const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
        const noteIndex = midi % 12; // MIDI 0 = C, 1 = C♯, ... 9 = A, 11 = B
        const octave = Math.floor(midi / 12) - 1;
        return { note: noteNames[noteIndex], octave, cents };
    }
    dispatchError(err) {
        const e = err instanceof Error ? err : new Error(String(err));
        this.dispatchEvent(new CustomEvent('error', { detail: e }));
    }
}
export default PitchDetector;
