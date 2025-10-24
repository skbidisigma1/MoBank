export type PitchFrame = {
  t: number;           // seconds (audio clock)
  frequency: number;   // Hz
  clarity: number;     // 0..1
  rmsDb: number;       // dBFS
  note: string;
  octave: number;
  cents: number;       // -50..+50
};

export type PitchConfig = {
  workletUrl: string;      // '/js/pitch-worklet.js'
  // Worklet options
  bufferSize?: number;
  hopSize?: number;
  minFreq?: number;
  maxFreq?: number;
  yinThreshold?: number;
  rmsFloorDb?: number;
  clarityFloor?: number;
  hangMs?: number;
  dcBlock?: boolean;
};

export class PitchDetector extends EventTarget {
  private ctx!: AudioContext;
  private node?: AudioWorkletNode;
  private input?: MediaStreamAudioSourceNode;
  private zeroGain?: GainNode;
  private stream?: MediaStream;
  private isRunning = false;
  private config: PitchConfig;

  constructor(cfg: PitchConfig) {
    super();
    this.config = cfg;
  }

  get audioContext() { return this.ctx; }

  async init(): Promise<void> {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    try {
      await this.ctx.audioWorklet.addModule(this.config.workletUrl);
    } catch (err) {
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
        const frame: PitchFrame = {
          t, frequency: freq, clarity, rmsDb,
          note: mapped.note, octave: mapped.octave, cents: mapped.cents,
        };
        this.dispatchEvent(new CustomEvent<PitchFrame>('pitch', { detail: frame }));
      } else if (d?.type === 'level') {
        // Optional: emit levels if you want metering
      }
    };

    // keep worklet alive in the graph (silent)
    this.zeroGain = this.ctx.createGain();
    this.zeroGain.gain.value = 0;
    this.node.connect(this.zeroGain).connect(this.ctx.destination);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isRunning) this.ctx.suspend();
      else if (!document.hidden && this.isRunning) this.ctx.resume();
    });
  }

  async startMicrophone(): Promise<void> {
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
      if (!this.node) throw new Error('Worklet node not ready');
      this.input.connect(this.node);
    } catch (err: any) {
      this.dispatchError(err);
      throw err;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.ctx.suspend();
  }

  async stopMicrophone(): Promise<void> {
    try {
      this.input?.disconnect();
      this.input = undefined;
      this.stream?.getTracks().forEach(t => t.stop());
      this.stream = undefined;
    } catch (err) {
      // Swallow errors during cleanup
      console.warn('Error stopping microphone:', err);
    }
  }

  destroy() {
    this.isRunning = false;
    this.stopMicrophone();
    try { this.node?.disconnect(); } catch {}
    try { this.zeroGain?.disconnect(); } catch {}
    try { this.ctx?.close(); } catch {}
    // Clear references
    this.node = undefined;
    this.zeroGain = undefined;
  }

  updateWorkletConfig(partial: Partial<PitchConfig>) {
    this.config = { ...this.config, ...partial };
    this.node?.port.postMessage({ type: 'config', value: partial });
  }

  private mapFrequency(freq: number) {
    if (freq <= 0 || !isFinite(freq)) return { note: '--', octave: -1, cents: 0 };
    const A4 = 440;
    const n = 12 * Math.log2(freq / A4);
    const midi = Math.round(n) + 69;
    const cents = Math.round((n - Math.round(n)) * 100); // -50..+50
    const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    const noteIndex = midi % 12; // MIDI 0 = C, 1 = C♯, ... 9 = A, 11 = B
    const octave = Math.floor(midi / 12) - 1;
    return { note: noteNames[noteIndex], octave, cents };
  }

  private dispatchError(err: any) {
    const e = err instanceof Error ? err : new Error(String(err));
    this.dispatchEvent(new CustomEvent('error', { detail: e }));
  }
}

export default PitchDetector;
