"use strict";
// Compile this to: public/js/pitch-worklet.js
// Must be an ES module for audioWorklet.addModule()
const DEFAULTS = {
    bufferSize: 2048,
    hopSize: 256,
    minFreq: 80,
    maxFreq: 1000,
    yinThreshold: 0.12,
    rmsFloorDb: -60,
    clarityFloor: 0.12,
    hangMs: 60,
    dcBlock: true,
};
class PitchProcessor extends AudioWorkletProcessor {
    constructor(opts) {
        super();
        this.rHead = 0;
        this.have = 0;
        this.samplesProcessed = 0;
        this.lastVoicedUntil = 0; // seconds
        this.prevX = 0; // for DC block
        this.prevY = 0;
        this.cfg = { ...DEFAULTS, ...(opts?.processorOptions ?? {}) };
        const cap = Math.max(this.cfg.bufferSize * 2, 8192);
        this.ring = new Float32Array(cap);
        this.port.onmessage = (ev) => {
            if (ev.data?.type === "config") {
                this.cfg = { ...this.cfg, ...(ev.data.value || {}) };
            }
        };
    }
    static get parameterDescriptors() { return []; }
    process(inputs) {
        const input = inputs[0];
        if (!input || input.length === 0)
            return true;
        const ch = input[0];
        if (!ch)
            return true;
        // Mono mix if multiple channels
        const n = ch.length;
        for (let i = 0; i < n; i++) {
            let x = 0;
            for (let c = 0; c < input.length; c++)
                x += (input[c]?.[i] ?? 0);
            x /= input.length || 1;
            if (this.cfg.dcBlock) {
                // Simple DC blocker: y[n] = x[n] - x[n-1] + R*y[n-1], R ~= 0.995
                const y = x - this.prevX + 0.995 * this.prevY;
                this.prevX = x;
                this.prevY = y;
                this.push(y);
            }
            else {
                this.push(x);
            }
        }
        // Try analysis by hop
        const sr = sampleRate;
        while (this.have >= this.cfg.bufferSize) {
            const frame = this.readWindow(this.cfg.bufferSize);
            const res = this.analyzeFrame(frame, sr);
            this.samplesProcessed += this.cfg.hopSize;
            const t = this.samplesProcessed / sr;
            const voicedNow = res.rmsDb > this.cfg.rmsFloorDb && res.clarity >= this.cfg.clarityFloor && res.freq > 0;
            if (voicedNow)
                this.lastVoicedUntil = t + this.cfg.hangMs / 1000;
            if (voicedNow || t < this.lastVoicedUntil) {
                this.port.postMessage({ type: "pitch", t, ...res });
            }
            else {
                // still emit RMS (unvoiced) if needed upstream?
                this.port.postMessage({ type: "level", t, rmsDb: res.rmsDb });
            }
        }
        return true;
    }
    push(v) {
        this.ring[this.rHead] = v;
        this.rHead = (this.rHead + 1) % this.ring.length;
        this.have = Math.min(this.have + 1, this.ring.length);
    }
    readWindow(size) {
        // Read trailing `size` samples, then consume hopSize
        const out = new Float32Array(size);
        const start = (this.rHead - this.have + this.ring.length) % this.ring.length;
        // Copy last `size` from available
        let idx = (start + (this.have - size + this.ring.length)) % this.ring.length;
        for (let i = 0; i < size; i++) {
            out[i] = this.ring[idx];
            idx = (idx + 1) % this.ring.length;
        }
        // Consume hop
        this.have = Math.max(0, this.have - this.cfg.hopSize);
        return out;
    }
    analyzeFrame(buf, sr) {
        const N = buf.length;
        // RMS
        let s = 0, peak = 0;
        for (let i = 0; i < N; i++) {
            const v = buf[i];
            s += v * v;
            peak = Math.max(peak, Math.abs(v));
        }
        const rms = Math.sqrt(s / N);
        const rmsDb = 20 * Math.log10(rms + 1e-12);
        // YIN
        const tauMin = Math.max(2, Math.floor(sr / this.cfg.maxFreq));
        const tauMax = Math.min(N - 2, Math.floor(sr / this.cfg.minFreq));
        const cmndf = this.yin(buf, tauMin, tauMax);
        const { tau, clarity } = this.yinPickTau(cmndf, tauMin, tauMax, this.cfg.yinThreshold);
        const freq = tau > 0 ? sr / tau : 0;
        return { freq, clarity, rmsDb, peak };
    }
    yin(x, tauMin, tauMax) {
        const N = x.length;
        const d = new Float32Array(tauMax + 1);
        // Difference function
        for (let tau = 1; tau <= tauMax; tau++) {
            let sum = 0;
            const limit = N - tau;
            for (let i = 0; i < limit; i++) {
                const diff = x[i] - x[i + tau];
                sum += diff * diff;
            }
            d[tau] = sum;
        }
        // Cumulative mean normalized difference (CMNDF)
        const cmndf = new Float32Array(tauMax + 1);
        cmndf[0] = 1;
        let cumulative = 0;
        for (let tau = 1; tau <= tauMax; tau++) {
            cumulative += d[tau];
            cmndf[tau] = (d[tau] * tau) / (cumulative || 1e-12);
        }
        return cmndf;
    }
    yinPickTau(cmndf, tauMin, tauMax, threshold) {
        let tau = 0;
        // First minimum below threshold
        for (let t = tauMin; t < tauMax; t++) {
            if (cmndf[t] < threshold) {
                // local minimum refinement
                while (t + 1 < tauMax && cmndf[t + 1] < cmndf[t])
                    t++;
                tau = t;
                break;
            }
        }
        if (tau === 0) {
            // Fallback: global minimum
            let minVal = Infinity;
            for (let t = tauMin; t < tauMax; t++) {
                if (cmndf[t] < minVal) {
                    minVal = cmndf[t];
                    tau = t;
                }
            }
            if (!isFinite(minVal))
                return { tau: 0, clarity: 0 };
        }
        // Parabolic interpolation
        const x0 = cmndf[tau - 1] ?? cmndf[tau];
        const x1 = cmndf[tau];
        const x2 = cmndf[tau + 1] ?? cmndf[tau];
        const denom = 2 * (2 * x1 - x2 - x0) || 1e-12;
        const delta = (x2 - x0) / denom;
        const refined = tau + delta;
        const clarity = 1 - x1; // higher is better
        return { tau: refined > 0 ? refined : tau, clarity: Math.max(0, Math.min(1, clarity)) };
    }
}
registerProcessor('pitch-worklet', PitchProcessor);
