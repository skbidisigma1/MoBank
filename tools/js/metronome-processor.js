// MetronomeProcessor - A precise audio-thread based timing system
class MetronomeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.nextTickTime = 0;
    this.isRunning = false;
    this.currentBeat = 0;
    this.currentSub = 0;
    this.beatsPerMeasure = 4;
    this.subdivision = 1;
    this.interval = 0.5;  // Default 120 BPM
    this.beatPatterns = [];
    
    // Process messages from the main thread
    this.port.onmessage = (event) => {
      const data = event.data;
      
      if (data.type === 'start') {
        this.isRunning = true;
        this.interval = data.interval;
        this.nextTickTime = currentTime + 0.05; // Small offset to avoid immediate tick
        this.beatsPerMeasure = data.beatsPerMeasure;
        this.subdivision = data.subdivision;
        this.beatPatterns = data.beatPatterns || [];
        this.currentBeat = 0;
        this.currentSub = 0;
      } 
      else if (data.type === 'stop') {
        this.isRunning = false;
      } 
      else if (data.type === 'update') {
        // Update parameters without resetting beat counter
        this.interval = data.interval;
        if (data.beatsPerMeasure) this.beatsPerMeasure = data.beatsPerMeasure;
        if (data.subdivision) this.subdivision = data.subdivision;
        if (data.beatPatterns) this.beatPatterns = data.beatPatterns;
      }
    };
  }

  process(inputs, outputs, parameters) {
    // Check if it's time to schedule the next tick
    if (this.isRunning) {
      const now = currentTime;
      
      // Schedule multiple ticks ahead in one process cycle for efficiency
      while (this.nextTickTime < now + 0.1) {
        const mainBeat = Math.floor(this.currentSub / this.subdivision);
        const beatInMeasure = mainBeat % this.beatsPerMeasure;
        const subBeat = this.currentSub % this.subdivision;
        const isMainBeat = subBeat === 0;
        
        // Determine if this is an accent based on beat patterns
        let accent = false;
        let silent = false;
        
        if (isMainBeat && this.beatPatterns.length > beatInMeasure) {
          const pattern = this.beatPatterns[beatInMeasure];
          accent = pattern === 'accent';
          silent = pattern === 'silent';
        }
        
        // Send precise timing information to main thread
        this.port.postMessage({
          type: 'tick',
          time: this.nextTickTime,
          beatInMeasure: beatInMeasure,
          subBeat: subBeat,
          isMainBeat: isMainBeat,
          accent: accent,
          silent: silent,
          measureStart: beatInMeasure === 0 && subBeat === 0
        });
        
        // Advance to next subdivision
        this.currentSub = (this.currentSub + 1) % (this.beatsPerMeasure * this.subdivision);
        this.nextTickTime += this.interval;
      }
    }
    
    // AudioWorkletProcessors must return true to keep processing
    return true;
  }
}

registerProcessor('metronome-processor', MetronomeProcessor);
