/**
 * Storage Controller - LocalStorage Wrapper
 */
export const StorageController = {
  // Key names
  PREFIX: 'NEON_BREAKER_',
  KEYS: {
    HIGH_SCORE: 'high_score',
    SFX_VOL: 'sfx_volume',
    BGM_VOL: 'bgm_volume',
    ACCESSIBILITY: 'accessibility_mode',
    MUTE_STATE: 'audio_mute'
  },

  /**
   * Complete setting retrieval with default fallbacks
   */
  getHighScore() {
    const rawVal = localStorage.getItem(this.PREFIX + this.KEYS.HIGH_SCORE);
    if (rawVal) {
      const parsed = parseInt(rawVal, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  },

  saveHighScore(score) {
    if (typeof score !== 'number' || isNaN(score)) return;
    const currentHigh = this.getHighScore();
    if (score > currentHigh) {
      localStorage.setItem(this.PREFIX + this.KEYS.HIGH_SCORE, score.toString());
      return true; // Successfully updated high score
    }
    return false;
  },

  getSFXVolume() {
    const rawVal = localStorage.getItem(this.PREFIX + this.KEYS.SFX_VOL);
    if (rawVal !== null) {
      const parsed = parseFloat(rawVal);
      return isNaN(parsed) ? 0.7 : parsed;
    }
    return 0.7; // Default 70% SFX
  },

  saveSFXVolume(val) {
    const bounded = Math.max(0, Math.min(1, val));
    localStorage.setItem(this.PREFIX + this.KEYS.SFX_VOL, bounded.toString());
  },

  getBGMVolume() {
    const rawVal = localStorage.getItem(this.PREFIX + this.KEYS.BGM_VOL);
    if (rawVal !== null) {
      const parsed = parseFloat(rawVal);
      return isNaN(parsed) ? 0.5 : parsed;
    }
    return 0.5; // Default 50% BGM
  },

  saveBGMVolume(val) {
    const bounded = Math.max(0, Math.min(1, val));
    localStorage.setItem(this.PREFIX + this.KEYS.BGM_VOL, bounded.toString());
  },

  getAccessibilityMode() {
    const rawVal = localStorage.getItem(this.PREFIX + this.KEYS.ACCESSIBILITY);
    return rawVal || 'none'; // Default 'none' colorblind
  },

  saveAccessibilityMode(theme) {
    localStorage.setItem(this.PREFIX + this.KEYS.ACCESSIBILITY, theme);
  },

  getMuteState() {
    return localStorage.getItem(this.PREFIX + this.KEYS.MUTE_STATE) === 'true';
  },

  saveMuteState(muted) {
    localStorage.setItem(this.PREFIX + this.KEYS.MUTE_STATE, muted ? 'true' : 'false');
  }
};
