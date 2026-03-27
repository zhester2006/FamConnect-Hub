/**
 * Voice Activity Detection (VAD) - detects when user stops speaking
 * Uses Web Audio API to monitor microphone volume levels
 */
export class VoiceActivityDetector {
  constructor(options = {}) {
    this.silenceThreshold = options.silenceThreshold || 0.015;
    this.silenceDuration = options.silenceDuration || 1800; // ms of silence before stopping
    this.minRecordingDuration = options.minRecordingDuration || 800; // min ms before allowing auto-stop
    this.onSilence = options.onSilence || (() => {});
    this.onSpeaking = options.onSpeaking || (() => {});
    
    this.audioContext = null;
    this.analyser = null;
    this.silenceTimer = null;
    this.isSpeaking = false;
    this.hasSpoken = false;
    this.startTime = 0;
    this.rafId = null;
  }

  start(stream) {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.5;

      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);

      this.startTime = Date.now();
      this.hasSpoken = false;
      this.isSpeaking = false;
      this.monitor();
    } catch (e) {
      // Silently fail - auto-stop won't work but manual stop still will
    }
  }

  monitor() {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const elapsed = Date.now() - this.startTime;

    if (rms > this.silenceThreshold) {
      // User is speaking
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.hasSpoken = true;
        this.onSpeaking();
      }
      // Reset silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else if (this.hasSpoken && elapsed > this.minRecordingDuration) {
      // Silence detected after user spoke
      if (!this.silenceTimer) {
        this.isSpeaking = false;
        this.silenceTimer = setTimeout(() => {
          this.onSilence();
        }, this.silenceDuration);
      }
    }

    this.rafId = requestAnimationFrame(() => this.monitor());
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
  }
}
