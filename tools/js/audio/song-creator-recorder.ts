export type NoteEvent = {
  note: string;
  octave: number;
  frequency: number;
  cents: number;
  clarity: number;  // median clarity across the note
  velocity: number; // 0..1 derived from RMS (approx)
  startMs: number;
  durationMs: number;
};

export type RecorderOptions = {
  centsTolerance?: number;     // ± cents considered "same" note
  minNoteMs?: number;          // drop/treat as noise below this
  minChangeMs?: number;        // required stability before pitch change
  minSilenceMs?: number;       // gap to split repeated notes
  silenceDb?: number;          // dBFS silence threshold
  attackRatio?: number;        // sudden RMS gain → new articulation
  latencyMs?: number;          // compensate input path
  tempo?: number;              // BPM
  grid?: number;               // ticks per beat (e.g., 16 = 16ths)
  swing?: number;              // 0..0.6 swing amount for 8ths
  scale?: number[] | null;     // optional MIDI scale degrees (0..11) to snap
};

const R = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

export class SongRecorder {
  private opts: Required<RecorderOptions>;
  private startT = 0;
  private isRec = false;

  private frames: { tMs: number; midi: number; note: string; octave: number; freq: number; cents: number; rmsDb: number; clarity: number; }[] = [];
  private smoothedRms = -120;
  private lastArticMs = 0;

  recorded: NoteEvent[] = [];
  quantized: NoteEvent[] = [];

  constructor(options: RecorderOptions = {}) {
    this.opts = {
      centsTolerance: options.centsTolerance ?? 20,
      minNoteMs: options.minNoteMs ?? 90,
      minChangeMs: options.minChangeMs ?? 110,
      minSilenceMs: options.minSilenceMs ?? 80,
      silenceDb: options.silenceDb ?? -55,
      attackRatio: options.attackRatio ?? 1.8,
      latencyMs: options.latencyMs ?? 0,
      tempo: options.tempo ?? 120,
      grid: options.grid ?? 16,
      swing: options.swing ?? 0,
      scale: options.scale ?? null,
    };
  }

  get isRecording() { return this.isRec; }
  setTempo(bpm: number) { this.opts.tempo = R(40, Math.round(bpm), 240); }
  setGrid(grid: number) { this.opts.grid = grid; }
  setSwing(amount: number) { this.opts.swing = R(0, amount, 0.6); }

  start(t0Seconds: number) {
    this.isRec = true;
    this.frames = [];
    this.recorded = [];
    this.quantized = [];
    this.startT = t0Seconds * 1000;
    this.smoothedRms = -120;
    this.lastArticMs = 0;
  }

  stop(nowSeconds: number) {
    if (!this.isRec) return;
    this.isRec = false;
    // Build notes from frames
    this.segment();
    // Multi-pass smoothing
    this.smooth();
    // Quantize
    this.quantize();
    // Ensure final durations closed
    const endMs = (nowSeconds * 1000) - this.startT - this.opts.latencyMs;
    if (this.recorded.length) {
      const last = this.recorded[this.recorded.length - 1];
      last.durationMs = Math.max(last.durationMs, endMs - last.startMs);
    }
  }

  /** Feed frames from PitchDetector (audio clock seconds) */
  pushFrame(frame: { t: number; frequency: number; note: string; octave: number; cents: number; rmsDb: number; clarity: number; }) {
    if (!this.isRec) return;
    // Smooth RMS (simple low-pass in dB domain)
    const alpha = 0.1;
    this.smoothedRms = alpha * frame.rmsDb + (1 - alpha) * this.smoothedRms;

    const tMs = frame.t * 1000 - this.startT - this.opts.latencyMs;
    if (tMs < 0) return;

    // Map to MIDI for robust comparisons
    const midi = this.freqToMidi(frame.frequency);
    this.frames.push({
      tMs,
      midi,
      note: frame.note,
      octave: frame.octave,
      freq: frame.frequency,
      cents: frame.cents,
      rmsDb: this.smoothedRms,
      clarity: frame.clarity,
    });
  }

  /** Segmentation: robust state machine for note on/off & changes */
  private segment() {
    if (this.frames.length === 0) return;
    let current: NoteEvent | null = null;
    const tolMidi = this.opts.centsTolerance / 100; // in semitones

    const sustained = (from: number, pitch: number) => {
      // Require stability (minChangeMs) around this pitch
      const to = from + this.opts.minChangeMs;
      const p0 = pitch;
      for (let i = from; i < this.frames.length && this.frames[i].tMs <= to; i++) {
        const dt = Math.abs(this.frames[i].midi - p0);
        if (dt > tolMidi) return false;
      }
      return true;
    };

    for (let i = 0; i < this.frames.length; i++) {
      const f = this.frames[i];
      const voiced = f.rmsDb > this.opts.silenceDb && f.clarity >= 0.20 && f.freq > 0;

      // Attack detection (articulation)
      const prevRms = i > 0 ? this.frames[i - 1].rmsDb : -120;
      const attack = (f.rmsDb - prevRms) > (10 * Math.log10(this.opts.attackRatio));

      if (!voiced) {
        // Silence—maybe close current note if enough gap
        if (current) {
          const gapStart = f.tMs;
          // look ahead until voice resumes to finalize duration
          current.durationMs = Math.max(current.durationMs, f.tMs - current.startMs);
        }
        continue;
      }

      // Choose candidate MIDI; snap to scale if configured
      let midi = f.midi;
      if (this.opts.scale) midi = this.snapToScale(midi, this.opts.scale);

      if (!current) {
        // Start first note
        current = this.makeNoteFromFrame(f, midi);
        this.recorded.push(current);
        this.lastArticMs = f.tMs;
        continue;
      }

      const samePitch = Math.abs(this.freqToMidi(current.frequency) - midi) <= tolMidi;
      const timeSinceOn = f.tMs - current.startMs;
      const sepBySilence = (f.tMs - this.lastArticMs) >= this.opts.minSilenceMs;

      if (samePitch) {
        // Extend current note
        current.durationMs = Math.max(current.durationMs, f.tMs - current.startMs);
        // Re-articulation on strong attack (creates new same-pitch note)
        if (attack && timeSinceOn > this.opts.minNoteMs && sepBySilence) {
          current = this.makeNoteFromFrame(f, midi);
          this.recorded.push(current);
          this.lastArticMs = f.tMs;
        } else {
          // accumulate clarity/velocity
          current.clarity = 0.9 * current.clarity + 0.1 * f.clarity;
          current.velocity = Math.max(current.velocity, this.dbToVel(f.rmsDb));
        }
      } else {
        // Potential pitch change—require stability
        if (sustained(i, midi) && timeSinceOn >= this.opts.minChangeMs) {
          // close previous
          current.durationMs = Math.max(current.durationMs, f.tMs - current.startMs);
          // new
          current = this.makeNoteFromFrame(f, midi);
          this.recorded.push(current);
          this.lastArticMs = f.tMs;
        } else {
          // jitter—ignore
          current.durationMs = Math.max(current.durationMs, f.tMs - current.startMs);
        }
      }
    }
  }

  private smooth() {
    let notes = this.recorded.slice();
    if (!notes.length) return;

    // 1) Drop too-short notes
    notes = notes.filter(n => n.durationMs >= this.opts.minNoteMs);

    // 2) Merge identical neighbors separated by tiny gaps
    const merged: NoteEvent[] = [];
    for (const n of notes) {
      const prev = merged[merged.length - 1];
      if (prev && prev.note === n.note && prev.octave === n.octave &&
          Math.abs(prev.frequency - n.frequency) < 0.5 &&
          n.startMs <= prev.startMs + prev.durationMs + this.opts.minSilenceMs) {
        // merge
        prev.durationMs = Math.max(prev.durationMs, (n.startMs + n.durationMs) - prev.startMs);
        prev.velocity = Math.max(prev.velocity, n.velocity);
        prev.clarity = Math.max(prev.clarity, n.clarity);
      } else {
        merged.push({ ...n });
      }
    }

    // 3) Remove A–B–A flickers where B is very short and deviates
    const cleaned: NoteEvent[] = [];
    for (let i = 0; i < merged.length; i++) {
      const a = merged[i - 1], b = merged[i], c = merged[i + 1];
      if (a && c && b &&
          a.note === c.note && a.octave === c.octave &&
          b.durationMs < Math.max(this.opts.minNoteMs, 120)) {
        // extend A through B and C
        a.durationMs = (c.startMs + c.durationMs) - a.startMs;
        i++; // skip C
      } else {
        cleaned.push(merged[i]);
      }
    }

    // 4) Recompute simple legato: ensure contiguous starts (no tiny holes)
    for (let i = 0; i < cleaned.length - 1; i++) {
      const cur = cleaned[i], nxt = cleaned[i + 1];
      const end = cur.startMs + cur.durationMs;
      if (nxt.startMs - end < 20 && nxt.startMs >= end - 80) {
        cur.durationMs = Math.max(cur.durationMs, nxt.startMs - cur.startMs);
      }
    }

    this.recorded = cleaned;
  }

  private quantize() {
    const ticksPerBeat = this.opts.grid;
    const msPerBeat = 60000 / this.opts.tempo;
    const tick = msPerBeat / ticksPerBeat;

    const swingMask = (tMs: number) => {
      // Simple 8th-note swing on odd 8th ticks
      if (this.opts.swing <= 0) return 0;
      const eighth = msPerBeat / 2;
      const which = Math.round(tMs / eighth);
      return (which % 2 === 1) ? this.opts.swing * (eighth / 3) : 0;
    };

    const out: NoteEvent[] = [];
    for (let i = 0; i < this.recorded.length; i++) {
      const n = this.recorded[i];
      const startQ = Math.round(n.startMs / tick) * tick + swingMask(n.startMs);
      const endQ = Math.round((n.startMs + n.durationMs) / tick) * tick + swingMask(n.startMs + n.durationMs);
      const durQ = Math.max(tick, endQ - startQ);
      out.push({ ...n, startMs: startQ, durationMs: durQ });
    }

    // Enforce non-overlap and minimal duration
    out.sort((a, b) => a.startMs - b.startMs);
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i], b = out[i + 1];
      a.durationMs = Math.min(a.durationMs, Math.max(tick, b.startMs - a.startMs));
    }
    this.quantized = out;
  }

  /** Schedule playback precisely using AudioContext clock */
  play(ctx: AudioContext, when = ctx.currentTime + 0.05) {
    const notes = this.quantized.length ? this.quantized : this.recorded;
    if (!notes.length) return;

    for (const n of notes) {
      const t = when + n.startMs / 1000;
      const dur = Math.max(0.04, n.durationMs / 1000);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.frequency, t);

      const peak = 0.28 + 0.35 * n.velocity; // 0.28..0.63
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.01);
      g.gain.linearRampToValueAtTime(peak * 0.8, t + Math.max(0.03, dur - 0.02));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);

      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    }
  }

  clear() {
    this.frames = [];
    this.recorded = [];
    this.quantized = [];
    this.isRec = false;
  }

  // --- helpers ---
  private freqToMidi(freq: number) {
    return 69 + 12 * Math.log2(Math.max(freq, 1e-6) / 440);
  }
  private dbToVel(db: number) {
    // map -60..0 dB to 0..1
    return R(0, (db + 60) / 60, 1);
  }
  private makeNoteFromFrame(f: any, midi: number): NoteEvent {
    const { note, octave, freq, cents, clarity, rmsDb, tMs } = f;
    return {
      note, octave,
      frequency: freq,
      cents,
      clarity,
      velocity: this.dbToVel(rmsDb),
      startMs: tMs,
      durationMs: 0,
    };
  }
  private snapToScale(midi: number, scale: number[]) {
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    if (scale.includes(pc)) return Math.round(midi);
    // nearest pitch class in scale
    let best = pc, delta = 12;
    for (const s of scale) {
      const d = Math.min((pc - s + 12) % 12, (s - pc + 12) % 12);
      if (d < delta) { delta = d; best = s; }
    }
    const rounded = Math.round(midi);
    return rounded + ((best - pc + 12) % 12) - (pc > best ? 12 : 0);
  }
}

export default SongRecorder;
