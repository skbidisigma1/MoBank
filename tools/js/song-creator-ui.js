/**
 * Song Creator - UI Controller Module
 * Manages UI updates, displays pitch/frequency data, and handles user interactions
 */

import PitchDetector from './song-creator-pitch.js';

class SongCreatorUI {
  constructor() {
    this.pitchDetector = null;
    this.isActive = false;
    
    // UI Elements
    this.elements = {
      startBtn: null,
      stopBtn: null,
      pitchNote: null,
      pitchOctave: null,
      frequencyValue: null,
      centsBar: null,
      centsValue: null,
      statusIndicator: null,
      statusText: null,
      canvas: null,
      
      // Settings
      smoothingSlider: null,
      claritySlider: null,
      smoothingValue: null,
      clarityValue: null,
      
      // Display toggles
      showFrequency: null,
      showCents: null,
      showWaveform: null
    };
    
    // Visualization
    this.canvasContext = null;
    this.animationId = null;
    
    // Display settings
    this.displaySettings = {
      showFrequency: true,
      showCents: true,
      showWaveform: true
    };
  }

  /**
   * Initialize the UI and pitch detector
   */
  async init() {
    this.cacheDOMElements();
    this.setupEventListeners();
    this.setupCanvas();
    
    // Initialize pitch detector
    this.pitchDetector = new PitchDetector();
    
    // Set up callbacks
    this.pitchDetector.onPitchDetected = (data) => this.handlePitchData(data);
    this.pitchDetector.onError = (error) => this.handleError(error);
    
    // Initialize audio context
    await this.pitchDetector.init();
    
    console.log('Song Creator UI initialized');
  }

  /**
   * Cache all DOM elements
   */
  cacheDOMElements() {
    this.elements.startBtn = document.getElementById('start-mic');
    this.elements.stopBtn = document.getElementById('stop-mic');
    this.elements.pitchNote = document.getElementById('pitch-note');
    this.elements.pitchOctave = document.getElementById('pitch-octave');
    this.elements.frequencyValue = document.getElementById('frequency-value');
    this.elements.centsBar = document.getElementById('cents-bar');
    this.elements.centsValue = document.getElementById('cents-value');
    this.elements.statusIndicator = document.getElementById('status-indicator');
    this.elements.statusText = document.getElementById('status-text');
    this.elements.canvas = document.getElementById('pitch-canvas');
    
    // Settings
    this.elements.smoothingSlider = document.getElementById('smoothing-slider');
    this.elements.claritySlider = document.getElementById('clarity-threshold');
    this.elements.smoothingValue = document.getElementById('smoothing-value');
    this.elements.clarityValue = document.getElementById('clarity-value');
    
    // Display toggles
    this.elements.showFrequency = document.getElementById('show-frequency');
    this.elements.showCents = document.getElementById('show-cents');
    this.elements.showWaveform = document.getElementById('show-waveform');
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Microphone controls
    this.elements.startBtn.addEventListener('click', () => this.startListening());
    this.elements.stopBtn.addEventListener('click', () => this.stopListening());
    
    // Settings sliders
    this.elements.smoothingSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      this.elements.smoothingValue.textContent = `${value}%`;
      this.pitchDetector.updateSettings({ smoothing: value / 100 });
    });
    
    this.elements.claritySlider.addEventListener('input', (e) => {
      const value = e.target.value;
      this.elements.clarityValue.textContent = `${value}%`;
      this.pitchDetector.updateSettings({ clarityThreshold: value / 100 });
    });
    
    // Display toggles
    this.elements.showFrequency.addEventListener('change', (e) => {
      this.displaySettings.showFrequency = e.target.checked;
      this.updateDisplayVisibility();
    });
    
    this.elements.showCents.addEventListener('change', (e) => {
      this.displaySettings.showCents = e.target.checked;
      this.updateDisplayVisibility();
    });
    
    this.elements.showWaveform.addEventListener('change', (e) => {
      this.displaySettings.showWaveform = e.target.checked;
      if (e.target.checked && this.isActive) {
        this.startVisualization();
      } else {
        this.stopVisualization();
      }
    });
  }

  /**
   * Setup canvas for waveform visualization
   */
  setupCanvas() {
    this.canvasContext = this.elements.canvas.getContext('2d');
    this.clearCanvas();
  }

  /**
   * Start listening to microphone
   */
  async startListening() {
    try {
      const success = await this.pitchDetector.startMicrophone();
      
      if (success) {
        this.isActive = true;
        await this.pitchDetector.start();
        
        // Update UI
        this.elements.startBtn.style.display = 'none';
        this.elements.stopBtn.style.display = 'flex';
        this.elements.statusIndicator.classList.add('active');
        this.elements.statusText.textContent = 'Listening...';
        
        // Start visualization if enabled
        if (this.displaySettings.showWaveform) {
          this.startVisualization();
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Stop listening to microphone
   */
  async stopListening() {
    this.isActive = false;
    this.pitchDetector.stop();
    await this.pitchDetector.stopMicrophone();
    
    // Update UI
    this.elements.startBtn.style.display = 'flex';
    this.elements.stopBtn.style.display = 'none';
    this.elements.statusIndicator.classList.remove('active');
    this.elements.statusText.textContent = 'Microphone inactive';
    
    // Reset display
    this.resetDisplay();
    this.stopVisualization();
  }

  /**
   * Handle incoming pitch data
   */
  handlePitchData(data) {
    if (!this.isActive) return;
    
    console.log('UI received pitch data:', data);
    
    // Update note display
    this.elements.pitchNote.textContent = data.note;
    this.elements.pitchOctave.textContent = data.octave;
    
    // Update frequency display
    if (this.displaySettings.showFrequency) {
      this.elements.frequencyValue.textContent = `${data.frequency.toFixed(2)} Hz`;
    }
    
    // Update cents indicator
    if (this.displaySettings.showCents) {
      const centsPercent = (data.cents / 50) * 50; // Map -50 to +50 cents to -50% to +50%
      this.elements.centsBar.style.left = `${50 + centsPercent}%`;
      this.elements.centsValue.textContent = `${data.cents > 0 ? '+' : ''}${data.cents}¢`;
      
      // Color code based on accuracy
      if (Math.abs(data.cents) <= 5) {
        this.elements.centsBar.style.background = '#10b981'; // Green - very accurate
      } else if (Math.abs(data.cents) <= 15) {
        this.elements.centsBar.style.background = '#f59e0b'; // Orange - somewhat accurate
      } else {
        this.elements.centsBar.style.background = '#ef4444'; // Red - off pitch
      }
    }
  }

  /**
   * Start waveform visualization
   */
  startVisualization() {
    if (this.animationId) return;
    
    const draw = () => {
      if (!this.isActive || !this.displaySettings.showWaveform) {
        return;
      }
      
      const buffer = this.pitchDetector.getAudioBuffer();
      this.drawWaveform(buffer);
      
      this.animationId = requestAnimationFrame(draw);
    };
    
    draw();
  }

  /**
   * Stop waveform visualization
   */
  stopVisualization() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.clearCanvas();
  }

  /**
   * Draw waveform on canvas
   */
  drawWaveform(buffer) {
    const ctx = this.canvasContext;
    const canvas = this.elements.canvas;
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-primary') || '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw waveform
    ctx.lineWidth = 2;
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary-color') || '#3b82f6';
    ctx.beginPath();
    
    const sliceWidth = width / buffer.length;
    let x = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      const v = buffer[i];
      const y = (v + 1) / 2 * height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.stroke();
    
    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  /**
   * Clear canvas
   */
  clearCanvas() {
    const ctx = this.canvasContext;
    const canvas = this.elements.canvas;
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-primary') || '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Reset display to default state
   */
  resetDisplay() {
    this.elements.pitchNote.textContent = '--';
    this.elements.pitchOctave.textContent = '-';
    this.elements.frequencyValue.textContent = '--- Hz';
    this.elements.centsBar.style.left = '50%';
    this.elements.centsValue.textContent = '0¢';
    this.elements.centsBar.style.background = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary-color') || '#3b82f6';
    this.clearCanvas();
  }

  /**
   * Update display element visibility based on settings
   */
  updateDisplayVisibility() {
    const freqDisplay = this.elements.frequencyValue.parentElement;
    const centsDisplay = this.elements.centsValue.parentElement;
    
    if (freqDisplay) {
      freqDisplay.style.display = this.displaySettings.showFrequency ? 'flex' : 'none';
    }
    
    if (centsDisplay) {
      centsDisplay.style.display = this.displaySettings.showCents ? 'flex' : 'none';
    }
  }

  /**
   * Handle errors
   */
  handleError(error) {
    console.error('Song Creator Error:', error);
    
    let message = 'An error occurred';
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      message = 'Microphone access denied. Please allow microphone access and try again.';
    } else if (error.name === 'NotFoundError') {
      message = 'No microphone found. Please connect a microphone and try again.';
    } else if (error.message) {
      message = error.message;
    }
    
    this.elements.statusText.textContent = message;
    this.elements.statusIndicator.classList.remove('active');
    
    // Show toast if available
    if (window.showToast) {
      window.showToast(message, 'error');
    } else {
      alert(message);
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.stopListening();
    this.stopVisualization();
    
    if (this.pitchDetector) {
      this.pitchDetector.destroy();
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const ui = new SongCreatorUI();
  await ui.init();
  
  // Store globally for debugging
  window.songCreatorUI = ui;
});

export default SongCreatorUI;
