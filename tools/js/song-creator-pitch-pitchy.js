/**
 * Song Creator - Pitchy Library Integration (Alternative Implementation)
 * 
 * This file shows how to integrate the actual Pitchy v4.1.0 library
 * instead of the custom autocorrelation algorithm.
 * 
 * To use this instead of song-creator-pitch.js:
 * 1. Replace the import in song-creator.html
 * 2. Ensure Pitchy is loaded (either via CDN or bundler)
 */

import { PitchDetector as PitchyDetector } from 'pitchy';

class PitchDetectorWithPitchy {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.pitchyDetector = null;
    this.rafId = null;
    this.isRunning = false;
    
    // Audio processing settings
    this.bufferSize = 2048;
    this.audioBuffer = new Float32Array(this.bufferSize);
    
    // Detection settings (tunable)
    this.sensitivity = 0.5;
    this.smoothing = 0.3;
    this.clarityThreshold = 0.9;
    
    // Callbacks
    this.onPitchDetected = null;
    this.onError = null;
  }

  async init() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.bufferSize * 2;
      this.analyser.smoothingTimeConstant = this.smoothing;
      
      // Initialize Pitchy detector
      this.pitchyDetector = PitchyDetector.forFloat32Array(this.bufferSize);
      
      console.log('Audio context and Pitchy initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize:', error);
      if (this.onError) this.onError(error);
      return false;
    }
  }

  async startMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0
        }
      });

      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      
      console.log('Microphone connected');
      return true;
    } catch (error) {
      console.error('Microphone access denied:', error);
      if (this.onError) this.onError(error);
      return false;
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.detectPitch();
    console.log('Pitch detection started');
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    console.log('Pitch detection stopped');
  }

  async stopMicrophone() {
    this.stop();
    if (this.microphone && this.microphone.mediaStream) {
      this.microphone.mediaStream.getTracks().forEach(track => track.stop());
      this.microphone.disconnect();
      this.microphone = null;
    }
    console.log('Microphone disconnected');
  }

  /**
   * Main pitch detection loop using actual Pitchy library
   */
  detectPitch() {
    if (!this.isRunning) return;

    // Get audio data
    this.analyser.getFloatTimeDomainData(this.audioBuffer);
    
    // Use Pitchy to detect pitch
    // Returns [frequency, clarity] tuple
    const [frequency, clarity] = this.pitchyDetector.findPitch(
      this.audioBuffer,
      this.audioContext.sampleRate
    );
    
    // Check if we have a valid pitch with sufficient clarity
    if (frequency > 0 && clarity >= this.clarityThreshold) {
      const noteInfo = this.frequencyToNote(frequency);
      
      if (this.onPitchDetected) {
        this.onPitchDetected({
          frequency: frequency,
          note: noteInfo.note,
          octave: noteInfo.octave,
          cents: noteInfo.cents,
          clarity: clarity
        });
      }
    }

    // Continue detection loop
    this.rafId = requestAnimationFrame(() => this.detectPitch());
  }

  /**
   * Convert frequency to musical note information
   */
  frequencyToNote(frequency) {
    const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    
    const halfSteps = 12 * Math.log2(frequency / C0);
    const octave = Math.floor(halfSteps / 12);
    const noteIndex = Math.round(halfSteps % 12);
    const cents = Math.round((halfSteps % 1) * 100);
    
    return {
      note: noteNames[noteIndex],
      octave: octave,
      cents: cents > 50 ? cents - 100 : cents
    };
  }

  updateSettings({ sensitivity, smoothing, clarityThreshold }) {
    if (sensitivity !== undefined) {
      this.sensitivity = sensitivity;
    }
    if (smoothing !== undefined) {
      this.smoothing = smoothing;
      if (this.analyser) {
        this.analyser.smoothingTimeConstant = smoothing;
      }
    }
    if (clarityThreshold !== undefined) {
      this.clarityThreshold = clarityThreshold;
    }
  }

  getAudioBuffer() {
    return this.audioBuffer;
  }

  destroy() {
    this.stop();
    this.stopMicrophone();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export default PitchDetectorWithPitchy;

/**
 * USAGE NOTES:
 * 
 * 1. To use this with CDN:
 *    Add to song-creator.html:
 *    <script type="module">
 *      import { PitchDetector } from 'https://cdn.jsdelivr.net/npm/pitchy@4.1.0/+esm';
 *      window.PitchDetector = PitchDetector;
 *    </script>
 * 
 * 2. To use with bundler (webpack/vite):
 *    Just import normally - the package is already in package.json
 * 
 * 3. Pitchy advantages:
 *    - More accurate pitch detection
 *    - Better handling of complex waveforms
 *    - Optimized performance
 *    - Active maintenance
 * 
 * 4. Custom algorithm advantages:
 *    - No external dependencies
 *    - Full control over algorithm
 *    - No bundler needed
 *    - Easier to understand and modify
 */
