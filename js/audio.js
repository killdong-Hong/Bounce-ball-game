/**
 * Game Audio System using Web Audio API
 * Implements full procedural synthesis for BGM soundscape and interactive Sound Effects
 */
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.sfxVolumeNode = null;
    this.bgmVolumeNode = null;
    this.masterMuteNode = null;
    
    // Volume levels (0.0 to 1.0)
    this.sfxVal = 0.7;
    this.bgmVal = 0.5;
    this.isMuted = false;
    
    // BGM State
    this.isPlayingBGM = false;
    this.bgmInterval = null;
    this.bgmStep = 0;
    
    // Cyberpunk synth arpeggio patterns
    this.tempo = 120; // BPM
    // D Minor synthwave scale: D2, F2, G2, A2, C3, D3, F3, G3, A3
    this.notes = [73.42, 87.31, 98.00, 110.00, 130.81, 146.83, 174.61, 196.00, 220.00];
  }

  /**
   * Safe AudioContext initializer (triggered by User Interaction)
   */
  init(sfxVal, bgmVal, isMuted) {
    if (this.ctx) return; // Already initialized

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Configure Volumes and Master Routing
      this.masterMuteNode = this.ctx.createGain();
      this.masterMuteNode.connect(this.ctx.destination);
      
      this.sfxVolumeNode = this.ctx.createGain();
      this.sfxVolumeNode.connect(this.masterMuteNode);
      
      this.bgmVolumeNode = this.ctx.createGain();
      this.bgmVolumeNode.connect(this.masterMuteNode);

      // Save baseline levels passed from storage
      this.setSFXVolume(sfxVal);
      this.setBGMVolume(bgmVal);
      this.setMute(isMuted);
    } catch (e) {
      console.warn("Web Audio API not supported on this platform: ", e);
    }
  }

  /**
   * Ensure AudioContext is active (handles play/resume restrictions)
   */
  async resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  setSFXVolume(val) {
    this.sfxVal = Math.max(0, Math.min(1, val));
    if (this.sfxVolumeNode) {
      this.sfxVolumeNode.gain.setValueAtTime(this.sfxVal, this.ctx.currentTime);
    }
  }

  setBGMVolume(val) {
    this.bgmVal = Math.max(0, Math.min(1, val));
    if (this.bgmVolumeNode) {
      // Reduce baseline slightly to prevent BGM from overpowering SFX
      this.bgmVolumeNode.gain.setValueAtTime(this.bgmVal * 0.45, this.ctx.currentTime);
    }
  }

  setMute(muted) {
    this.isMuted = muted;
    if (this.masterMuteNode) {
      this.masterMuteNode.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }
  }

  /**
   * SYNTHESIZED SFX: Ball hitting normal boundary walls
   */
  playWallHit() {
    if (!this.ctx) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * SYNTHESIZED SFX: Ball rebounding off the controller paddle
   */
  playPaddleHit() {
    if (!this.ctx) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.18);

    // Apply an bandpass filter to give a retro sci-fi bounce
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.Q.setValueAtTime(10, t);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  /**
   * SYNTHESIZED SFX: Brick destruction particle burst
   * Pitch elevates dynamicly with current multiplier combo
   */
  playBrickDestroy(combo = 1) {
    if (!this.ctx) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Frequency adjusts based on combo multiplier
    const baseFreq = 440 + Math.min(2000, (combo - 1) * 60);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, t + 0.15);

    // Highpass noise blend to simulate small digital explosion
    const noise = this.createNoiseBuffer();
    let noiseSource = null;
    let noiseGain = null;

    if (noise) {
      noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noise;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1200, t);

      noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.005, t + 0.15);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxVolumeNode);
    }

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc.start(t);
    osc.stop(t + 0.15);

    if (noiseSource) {
      noiseSource.start(t);
      noiseSource.stop(t + 0.15);
    }
  }

  /**
   * SYNTHESIZED SFX: Player capturing a dropped tech pill
   */
  playItemGet() {
    if (!this.ctx) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    
    // Play sweet arpeggiated dual tone
    const playTone = (freq, delay, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + delay);
      
      gain.gain.setValueAtTime(0.0, t + delay);
      gain.gain.linearRampToValueAtTime(0.3, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + delay + duration);

      osc.connect(gain);
      gain.connect(this.sfxVolumeNode);

      osc.start(t + delay);
      osc.stop(t + delay + duration);
    };

    playTone(523.25, 0.0, 0.15);   // C5
    playTone(659.25, 0.06, 0.15);  // E5
    playTone(783.99, 0.12, 0.25);  // G5
  }

  /**
   * SYNTHESIZED SFX: Laser fired from weapon buff
   */
  playLaserFire() {
    if (!this.ctx) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.14);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  /**
   * SYNTHESIZED SFX: Level cleared celebration sequence
   */
  playLevelUp() {
    if (!this.ctx) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const chord = [329.63, 392.00, 493.88, 587.33, 659.25]; // E minor pentatonic chords

    // Play quick ascending laser wave
    chord.forEach((freq, idx) => {
      const delay = idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);
      osc.frequency.linearRampToValueAtTime(freq * 1.5, t + delay + 0.2);

      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.25, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxVolumeNode);

      osc.start(t + delay);
      osc.stop(t + delay + 0.35);
    });
  }

  /**
   * SYNTHESIZED SFX: Game Over tragic descent
   */
  playGameOver() {
    if (!this.ctx) return;
    this.resumeContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(45, t + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + 1.2);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc.start(t);
    osc.stop(t + 1.2);
  }

  /**
   * Helper: Prepare white noise buffer internally
   */
  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 0.2; // 0.2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * SYNTHESIZER BACKGROUND MUSIC ENGINE
   * Continuously cycles a progressive arpeggiator in D minor scale on background thread
   */
  startBGM() {
    if (!this.ctx || this.isPlayingBGM) return;
    this.resumeContext();
    
    this.isPlayingBGM = true;
    this.bgmStep = 0;

    const stepDuration = 60 / this.tempo / 2; // Eighth notes arpeggiator
    
    // Setup interval to synth notes scheduling slightly ahead
    const intervalMs = stepDuration * 1000;
    
    const scheduleNextNote = () => {
      if (!this.isPlayingBGM || !this.ctx) return;
      
      const t = this.ctx.currentTime;
      
      // Infinite Cyber Synthwave pattern
      // 8-step bass/lead progression:
      const pattern = [0, 4, 2, 5, 3, 7, 4, 1];
      const octOffset = (this.bgmStep % 16 < 8) ? 0 : 1; // Alternating octaves for groove
      
      const noteIndex = pattern[this.bgmStep % 8];
      const frequency = this.notes[Math.min(this.notes.length - 1, noteIndex + octOffset * 2)];

      // 1. Mono Base wave (Sub synth)
      const osc1 = this.ctx.createOscillator();
      const oscGain1 = this.ctx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(frequency * 0.5, t); // Sub octave

      // Cut filter to keep it deep and moody
      const lpFilter = this.ctx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.setValueAtTime(280, t);

      oscGain1.gain.setValueAtTime(0.3, t);
      oscGain1.gain.exponentialRampToValueAtTime(0.01, t + stepDuration * 0.95);

      osc1.connect(lpFilter);
      lpFilter.connect(oscGain1);
      oscGain1.connect(this.bgmVolumeNode);
      
      osc1.start(t);
      osc1.stop(t + stepDuration * 0.95);

      // 2. High Pluck Synth accents on even beats
      if (this.bgmStep % 2 === 0) {
        const osc2 = this.ctx.createOscillator();
        const oscGain2 = this.ctx.createGain();

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(frequency * 2.0, t); // Up high

        oscGain2.gain.setValueAtTime(0.18, t);
        oscGain2.gain.exponentialRampToValueAtTime(0.005, t + stepDuration * 0.6);

        osc2.connect(oscGain2);
        oscGain2.connect(this.bgmVolumeNode);

        osc2.start(t);
        osc2.stop(t + stepDuration * 0.61);
      }

      this.bgmStep++;
      this.bgmInterval = setTimeout(scheduleNextNote, intervalMs);
    };

    scheduleNextNote();
  }

  stopBGM() {
    this.isPlayingBGM = false;
    if (this.bgmInterval) {
      clearTimeout(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  updateBGMTempoByLevel(level) {
    // Elevate game tempo as player reaches higher level layers (max level 20)
    this.tempo = 120 + Math.min(60, (level - 1) * 3);
  }
}
