/**
 * Song Creator - Pitch Detection Core Module
 * Handles Web Audio API setup, microphone access, and Pitchy integration
 * for real-time pitch detection.
 */

import { PitchDetector as PitchyDetector } from 'https://esm.sh/pitchy@4.1.0';

class PitchDetector {
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
    this.smoothing = 0.3; // 0-1, affects analyzer smoothing
    this.clarityThreshold = 0.9; // 0-1, minimum clarity to report pitch
    
    // Callback for pitch detection results
    this.onPitchDetected = null;
    this.onError = null;
  }

  /**
   * Initialize audio context and setup analyzer
   */
  async init() {
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // Create analyzer node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.bufferSize * 2;
      this.analyser.smoothingTimeConstant = this.smoothing;
      
      // Initialize Pitchy detector
      this.pitchyDetector = PitchyDetector.forFloat32Array(this.bufferSize);
      
      console.log('Audio context initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      if (this.onError) this.onError(error);
      return false;
    }
  }

  /**
   * Request microphone access and connect to analyzer
   */
  async startMicrophone() {
    try {
      // Request microphone access with minimal constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      console.log('Stream obtained:', stream.getAudioTracks()[0].getSettings());

      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      
      console.log('Microphone connected', {
        analyserFftSize: this.analyser.fftSize,
        contextSampleRate: this.audioContext.sampleRate,
        contextState: this.audioContext.state
      });
      
      return true;
    } catch (error) {
      console.error('Microphone access denied:', error);
      if (this.onError) this.onError(error);
      return false;
    }
  }

  /**
   * Start pitch detection loop
   */
  async start() {
    if (this.isRunning) return;
    
    // Ensure audio context is running
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('Audio context resumed');
    }
    
    this.isRunning = true;
    this.detectPitch();
    console.log('Pitch detection started, context state:', this.audioContext.state);
  }

  /**
   * Stop pitch detection loop
   */
  stop() {
    this.isRunning = false;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    console.log('Pitch detection stopped');
  }

  /**
   * Stop microphone and cleanup
   */
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
   * Main pitch detection loop using Pitchy
   */
  detectPitch() {
    if (!this.isRunning) return;

    // Get audio data from analyzer
    this.analyser.getFloatTimeDomainData(this.audioBuffer);
    
    // Check if we're getting audio signal
    let rms = 0;
    let min = 1, max = -1;
    for (let i = 0; i < this.audioBuffer.length; i++) {
      const val = this.audioBuffer[i];
      rms += val * val;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    rms = Math.sqrt(rms / this.audioBuffer.length);
    
    // Use Pitchy to detect pitch - returns [frequency, clarity]
    const [frequency, clarity] = this.pitchyDetector.findPitch(
      this.audioBuffer,
      this.audioContext.sampleRate
    );
    
    // Log detection results every 60 frames (~1 second)
    if (Math.random() < 0.016) {
      console.log('Pitch Detection:', {
        rms: rms.toFixed(4),
        min: min.toFixed(4),
        max: max.toFixed(4),
        range: (max - min).toFixed(4),
        frequency: frequency?.toFixed(2) || '0.00',
        clarity: clarity?.toFixed(3) || '0.000',
        threshold: this.clarityThreshold,
        sampleRate: this.audioContext.sampleRate,
        bufferLength: this.audioBuffer.length
      });
    }
    
    // Check if we have a valid pitch with sufficient clarity
    if (frequency > 0 && clarity >= this.clarityThreshold) {
      const noteInfo = this.frequencyToNote(frequency);
      
      console.log('Pitch detected!', {
        frequency: frequency.toFixed(2),
        note: noteInfo.note,
        octave: noteInfo.octave,
        cents: noteInfo.cents,
        clarity: clarity.toFixed(3)
      });
      
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
    const C0 = A4 * Math.pow(2, -4.75); // C0 frequency
    
    const halfSteps = 12 * Math.log2(frequency / C0);
    const octave = Math.floor(halfSteps / 12);
    const noteInOctave = halfSteps - (octave * 12);
    const noteIndex = Math.round(noteInOctave) % 12;
    const cents = Math.round((noteInOctave - Math.round(noteInOctave)) * 100);
    
    return {
      note: noteNames[noteIndex],
      octave: octave,
      cents: cents
    };
  }

  /**
   * Update detection settings
   */
  updateSettings({ smoothing, clarityThreshold }) {
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

  /**
   * Get current audio buffer for visualization
   */
  getAudioBuffer() {
    return this.audioBuffer;
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.stop();
    this.stopMicrophone();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export for use in UI module
export default PitchDetector;
