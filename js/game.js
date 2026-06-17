/**
 * Neon Cyberpunk Breaker - Main Game controller
 * Advanced physics, dynamic AI difficulty adjusters, particles, and robust touch/keyboard interfaces.
 */
import { GameAudio } from './audio.js';
import { StorageController } from './storage.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Virtual resolution (Internal grid coords, perfectly scaled to viewport)
    this.virtualWidth = 800;
    this.virtualHeight = 600;
    this.scale = 1;

    // Instantiate systems
    this.audio = new GameAudio();

    // Game States: 'START', 'PLAYING', 'PAUSED', 'GAMEOVER', 'VICTORY'
    this.state = 'START';
    this.score = 0;
    this.highScore = StorageController.getHighScore();
    this.level = 1;
    this.maxLevels = 20;
    this.lives = 3;
    this.maxLives = 5;
    this.combo = 0;
    this.maxCombo = 0;
    this.colorblindMode = 'none';

    // Lists of active entities
    this.balls = [];
    this.bricks = [];
    this.items = [];
    this.particles = [];
    this.lasers = [];

    // Controller Paddle Details
    this.paddle = {
      x: 350,
      y: 550,
      width: 110,
      height: 14,
      targetX: 350, // Interpolation targets
      baseWidth: 110,
      speed: 12,
      lasersActive: false,
      laserTimer: 0,
      shieldActive: false
    };

    // Keyboard status state tracking
    this.keys = {
      left: false,
      right: false,
      space: false
    };

    // Tracking user stats for dynamic difficulty
    this.playerStats = {
      totalPaddleHits: 0,
      totalDrops: 0,
      recentLostLifeTime: 0,
    };

    // Audio volume track
    this.sfxVol = StorageController.getSFXVolume();
    this.bgmVol = StorageController.getBGMVolume();
    this.isMuted = StorageController.getMuteState();

    // Laser firing cooldowns
    this.lastLaserFireTime = 0;

    // Initialize DOM hooks and resize events
    this.initDOM();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Run animation cycle (locked via requestAnimationFrame)
    this.lastTime = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Bind event listeners and sliders
   */
  initDOM() {
    // Buttons
    document.getElementById('btn-start').addEventListener('click', () => this.startGame());
    document.getElementById('btn-settings').addEventListener('click', () => this.showSettings());
    document.getElementById('btn-settings-back').addEventListener('click', () => this.backFromSettings());
    document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());
    document.getElementById('btn-quit').addEventListener('click', () => this.quitToMain());
    document.getElementById('btn-retry').addEventListener('click', () => this.startGame());
    document.getElementById('btn-gameover-main').addEventListener('click', () => this.quitToMain());
    document.getElementById('btn-victory-main').addEventListener('click', () => this.quitToMain());
    document.getElementById('toggle-audio-btn').addEventListener('click', () => this.toggleMute());

    // Sliders & Menus
    const sliderSfx = document.getElementById('slider-sfx');
    const sliderBgm = document.getElementById('slider-bgm');
    const selectColor = document.getElementById('select-colorblind');

    // Preset values
    sliderSfx.value = Math.round(this.sfxVol * 100);
    sliderBgm.value = Math.round(this.bgmVol * 100);
    document.getElementById('sfx-value').innerText = `${sliderSfx.value}%`;
    document.getElementById('bgm-value').innerText = `${sliderBgm.value}%`;

    sliderSfx.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      document.getElementById('sfx-value').innerText = `${val}%`;
      this.sfxVol = val / 100;
      StorageController.saveSFXVolume(this.sfxVol);
      this.audio.setSFXVolume(this.sfxVol);
    });

    sliderBgm.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      document.getElementById('bgm-value').innerText = `${val}%`;
      this.bgmVol = val / 100;
      StorageController.saveBGMVolume(this.bgmVol);
      this.audio.setBGMVolume(this.bgmVol);
    });

    selectColor.value = StorageController.getAccessibilityMode();
    this.applyColorblindClass(selectColor.value);
    selectColor.addEventListener('change', (e) => {
      this.applyColorblindClass(e.target.value);
    });

    // Setup input listeners
    this.setupControls();

    // Setup Audio Icon on startup
    this.updateAudioIcon();
  }

  applyColorblindClass(theme) {
    this.colorblindMode = theme;
    StorageController.saveAccessibilityMode(theme);
    
    // Remove all colorblind css hooks, then append current
    document.body.classList.remove('colorblind-protanopia', 'colorblind-deuteranopia', 'colorblind-tritanopia');
    if (theme !== 'none') {
      document.body.classList.add(`colorblind-${theme}`);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    StorageController.saveMuteState(this.isMuted);
    this.audio.setMute(this.isMuted);
    this.updateAudioIcon();
  }

  updateAudioIcon() {
    const btn = document.getElementById('toggle-audio-btn');
    btn.innerHTML = this.isMuted ? '<span>🔇</span>' : '<span>🔊</span>';
  }

  /**
   * Safe initialization triggers
   */
  startGame() {
    // Initialize Web Audio (requires click input context)
    this.audio.init(this.sfxVol, this.bgmVol, this.isMuted);
    this.audio.resumeContext();
    this.audio.stopBGM();
    this.audio.startBGM();

    // Reset scores & lives
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.combo = 0;
    this.maxCombo = 0;
    this.particles = [];
    this.items = [];
    this.lasers = [];
    
    this.playerStats = {
      totalPaddleHits: 0,
      totalDrops: 0,
      recentLostLifeTime: 0
    };

    this.paddle.width = this.paddle.baseWidth;
    this.paddle.x = (this.virtualWidth - this.paddle.width) / 2;
    this.paddle.targetX = this.paddle.x;
    this.paddle.lasersActive = false;
    this.paddle.shieldActive = false;

    // Load first level
    this.loadLevelBricks();
    this.resetBall();

    this.state = 'PLAYING';
    this.updateUIOverlays();
  }

  showSettings() {
    this.state = 'SETTINGS';
    this.updateUIOverlays();
  }

  backFromSettings() {
    this.state = 'START';
    this.updateUIOverlays();
  }

  resumeGame() {
    this.audio.resumeContext();
    this.audio.startBGM();
    this.state = 'PLAYING';
    this.updateUIOverlays();
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.audio.stopBGM();
    this.updateUIOverlays();
  }

  quitToMain() {
    this.audio.stopBGM();
    this.state = 'START';
    this.updateUIOverlays();
  }

  /**
   * Master responsive sizing calculations
   */
  resizeCanvas() {
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    
    // Scale up canvas depending on device pixel ratios for high definition crispiness
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Save grid ratio
    const widthRatio = rect.width / this.virtualWidth;
    const heightRatio = rect.height / this.virtualHeight;
    this.scale = Math.min(widthRatio, heightRatio);

    // Apply viewport sizing inside CSS to center-fit canvas while keeping aspect ratio
    this.canvas.style.width = `${this.virtualWidth * this.scale}px`;
    this.canvas.style.height = `${this.virtualHeight * this.scale}px`;
    
    this.ctx.scale(dpr * this.scale, dpr * this.scale);
  }

  /**
   * Screen Management Show/Hide Transitions
   */
  updateUIOverlays() {
    const overlays = {
      'START': 'screen-start',
      'SETTINGS': 'screen-settings',
      'PAUSED': 'screen-pause',
      'GAMEOVER': 'screen-gameover',
      'VICTORY': 'screen-victory'
    };

    // Close all, open active
    for (const key in overlays) {
      document.getElementById(overlays[key]).classList.remove('active');
    }

    if (overlays[this.state]) {
      document.getElementById(overlays[this.state]).classList.add('active');
    }

    // Populate game over / victory stats inside DOM
    if (this.state === 'GAMEOVER') {
      document.getElementById('go-score').innerText = this.formatScore(this.score);
      document.getElementById('go-combo').innerText = `${this.maxCombo}x`;
      document.getElementById('go-level').innerText = `Lvl ${this.level}`;
      document.getElementById('go-highscore').innerText = this.formatScore(this.highScore);
    } else if (this.state === 'VICTORY') {
      document.getElementById('vic-score').innerText = this.formatScore(this.score);
      document.getElementById('vic-combo').innerText = `${this.maxCombo}x`;
      document.getElementById('vic-highscore').innerText = this.formatScore(this.highScore);
    }
  }

  formatScore(val) {
    return val.toString().padStart(6, '0');
  }

  /**
   * Interactive Input Controllers setup
   */
  setupControls() {
    // Keyboard key down / up
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.keys.left = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.keys.right = true;
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        this.keys.space = true;
        this.handleSpaceTrigger();
        e.preventDefault();
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.state === 'PLAYING') {
          this.pauseGame();
        } else if (this.state === 'PAUSED') {
          this.resumeGame();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.keys.left = false;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.keys.right = false;
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        this.keys.space = false;
      }
    });

    // Touch support - Swipe or slide across the cabinet surface
    const container = document.getElementById('canvas-container');
    
    container.addEventListener('touchstart', (e) => {
      if (this.state !== 'PLAYING') return;
      this.handleTouchMove(e);
      this.fireBallOnPaddle(); // Touch launches ball if stuck
      e.preventDefault();
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      if (this.state !== 'PLAYING') return;
      this.handleTouchMove(e);
      e.preventDefault();
    }, { passive: false });

    // Handle mouse movement dragging
    container.addEventListener('mousemove', (e) => {
      if (this.state !== 'PLAYING') return;
      
      const bounds = container.getBoundingClientRect();
      const relativeX = (e.clientX - bounds.left) / this.scale;
      
      // Center mouse to paddle center
      this.paddle.targetX = Math.max(0, Math.min(this.virtualWidth - this.paddle.width, relativeX - this.paddle.width / 2));
    });

    container.addEventListener('click', () => {
      if (this.state === 'PLAYING') {
        this.fireBallOnPaddle();
        this.fireLasers();
      }
    });
  }

  handleTouchMove(e) {
    if (!e.touches.length) return;
    const container = document.getElementById('canvas-container');
    const bounds = container.getBoundingClientRect();
    const touchX = (e.touches[0].clientX - bounds.left) / this.scale;
    
    this.paddle.targetX = Math.max(0, Math.min(this.virtualWidth - this.paddle.width, touchX - this.paddle.width / 2));
  }

  handleSpaceTrigger() {
    if (this.state === 'PLAYING') {
      this.fireBallOnPaddle();
      this.fireLasers();
    }
  }

  fireBallOnPaddle() {
    this.balls.forEach(ball => {
      if (!ball.isFired) {
        ball.isFired = true;
        // Launch upwards with a dynamic angled velocity
        const angle = -Math.PI / 2 + (Math.random() * 0.4 - 0.2); // slight random tilt
        ball.vx = ball.configSpeed * Math.cos(angle);
        ball.vy = ball.configSpeed * Math.sin(angle);
      }
    });
  }

  /**
   * Algorithmic 20-Level Matrix Generation
   */
  loadLevelBricks() {
    this.bricks = [];
    const cols = 10;
    const rows = 6 + Math.floor(this.level / 4); // Rows grow with levels
    const spacing = 4;
    const containerPadding = 30;
    const brickWidth = (this.virtualWidth - (containerPadding * 2) - ((cols - 1) * spacing)) / cols;
    const brickHeight = 22;

    this.audio.updateBGMTempoByLevel(this.level);

    // Dynamic pattern generation based on levels (1-20)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let shouldSpawn = true;
        let maxHealth = 1;
        
        const patternIndex = this.level;

        // Custom algorithmic structures per levels
        if (patternIndex === 1) {
          // Simplistic flat block rows
          shouldSpawn = true;
          maxHealth = r < 2 ? 2 : 1;
        } else if (patternIndex === 2) {
          // Column alternates (Stripes)
          shouldSpawn = c % 2 === 0;
          maxHealth = r < 3 ? 2 : 1;
        } else if (patternIndex === 3) {
          // V-Chevron formation
          shouldSpawn = Math.abs(c - cols / 2 + 0.5) <= r + 1;
          maxHealth = (r === 0) ? 3 : (r < 3 ? 2 : 1);
        } else if (patternIndex === 4) {
          // Checkerboard layout
          shouldSpawn = (r + c) % 2 === 0;
          maxHealth = r < 2 ? 3 : 2;
        } else if (patternIndex === 5) {
          // Castle towers
          shouldSpawn = (c <= 1 || c >= 8 || r % 2 === 0);
          maxHealth = (r < 2) ? 3 : 1;
        } else if (patternIndex === 6) {
          // Cross centered shield
          shouldSpawn = (r === 3 || c === 4 || c === 5);
          maxHealth = (r === 3) ? -1 : 2; // -1 represents Indestructible blocks!
        } else if (patternIndex === 7) {
          // Hollow Diamond shape
          const dist = Math.abs(r - 2) + Math.abs(c - 4.5);
          shouldSpawn = dist > 1 && dist < 4.5;
          maxHealth = r < 3 ? 2 : 1;
        } else if (patternIndex === 8) {
          // Divided lanes
          shouldSpawn = (c !== 3 && c !== 6);
          maxHealth = (c === 0 || c === 9) ? -1 : (r % 2 === 0 ? 2 : 1);
        } else if (patternIndex === 9) {
          // Inverted Pyramid
          shouldSpawn = r <= c && c <= cols - 1 - r;
          maxHealth = r === 0 ? 3 : 1;
        } else if (patternIndex === 10) {
          // Standard full screen defense core, very intense block layers
          shouldSpawn = true;
          maxHealth = r === 0 ? 3 : (r <= 2 ? 2 : 1);
        } else {
          // Levels 11 - 20 features complex mathematical procedurals
          shouldSpawn = (r * c + r) % (patternIndex % 5 + 2) !== 0;
          // Spawn indestructible nodes randomly based on level density
          const countMod = (patternIndex * 3 + c * 7 + r * 11) % 17;
          if (countMod === 0 && r > 2) {
            maxHealth = -1; // Heavy metallic indestructible block
          } else {
            maxHealth = (r === 0) ? 3 : (r % 2 === 0 ? 2 : 1);
          }
        }

        if (shouldSpawn) {
          const x = containerPadding + c * (brickWidth + spacing);
          const y = 60 + r * (brickHeight + spacing); // 60px down from HUD top
          
          let color = '';
          if (maxHealth === -1) {
            color = '#7f8c8d'; // Slate gray indestructible
          } else if (maxHealth === 3) {
            color = '#ffaa00'; // Golden high level
          } else if (maxHealth === 2) {
            color = '#ff007f'; // Pink core
          } else {
            color = '#00f3ff'; // Cyber cyan baseline
          }

          this.bricks.push({
            x,
            y,
            width: brickWidth,
            height: brickHeight,
            health: maxHealth,
            maxHealth: maxHealth,
            color: color
          });
        }
      }
    }
  }

  resetBall() {
    // Reset back to single stuck ball on center of paddle
    this.balls = [{
      x: this.paddle.x + this.paddle.width / 2,
      y: this.paddle.y - 8,
      vx: 0,
      vy: 0,
      radius: 8,
      configSpeed: 5.2 + Math.min(2.5, this.level * 0.12), // Increases gradually
      speedMultiplier: 1.0,
      isFired: false,
      trail: []
    }];
    
    this.combo = 0;
    this.keys.space = false; // Reset launches flag
  }

  /**
   * Shoot offensive laser projectile (if powerup is active)
   */
  fireLasers() {
    if (!this.paddle.lasersActive) return;

    const now = Date.now();
    if (now - this.lastLaserFireTime < 400) return; // Cooldown limit 400ms

    this.lastLaserFireTime = now;
    this.audio.playLaserFire();

    // Spawn 2 parallel energetic projectiles from left & right sides of paddle
    this.lasers.push({
      x: this.paddle.x,
      y: this.paddle.y,
      vy: -9,
      width: 4,
      height: 12
    });

    this.lasers.push({
      x: this.paddle.x + this.paddle.width - 4,
      y: this.paddle.y,
      vy: -9,
      width: 4,
      height: 12
    });
  }

  /**
   * Main Core Game Loop Integration
   */
  loop(currentTime) {
    if (!this.lastTime) this.lastTime = currentTime;
    const elapsed = currentTime - this.lastTime;
    
    // Cap physics timestep to avoid extreme glitches if tab loses focus
    const dt = Math.min(33, elapsed);
    this.lastTime = currentTime;

    // 1. Process physics/data transitions
    if (this.state === 'PLAYING') {
      this.update(dt);
    }

    // 2. Clear stage and redraw updated canvases
    this.draw();

    // Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Update Physics Objects & Collisions
   */
  update(dt) {
    // Smooth paddle interpolation movement
    const step = (this.keys.left ? -1 : 0) + (this.keys.right ? 1 : 0);
    if (step !== 0) {
      this.paddle.targetX += step * this.paddle.speed;
      this.paddle.targetX = Math.max(0, Math.min(this.virtualWidth - this.paddle.width, this.paddle.targetX));
    }
    // Interpolate actual X towards target coordinates for super buttery physics
    this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.45;

    // Laser buff timers decrement
    if (this.paddle.lasersActive) {
      this.paddle.laserTimer -= dt;
      if (this.paddle.laserTimer <= 0) {
        this.paddle.lasersActive = false;
      }
    }

    // Manage falling Item capsules updates
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.vy;

      // Check collision with paddle
      if (
        item.x < this.paddle.x + this.paddle.width &&
        item.x + item.width > this.paddle.x &&
        item.y < this.paddle.y + this.paddle.height &&
        item.y + item.height > this.paddle.y
      ) {
        this.applyPowerUp(item.type);
        this.items.splice(i, 1);
        continue;
      }

      // Check boundary falloff
      if (item.y > this.virtualHeight) {
        this.items.splice(i, 1);
      }
    }

    // Manage lasers updates
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const proj = this.lasers[i];
      proj.y += proj.vy;

      // Hit bricks checks
      let hit = false;
      for (let j = this.bricks.length - 1; j >= 0; j--) {
        const bk = this.bricks[j];
        if (
          proj.x < bk.x + bk.width &&
          proj.x + proj.width > bk.x &&
          proj.y < bk.y + bk.height &&
          proj.y + proj.height > bk.y
        ) {
          this.damageBrick(bk, j);
          hit = true;
          break;
        }
      }

      if (hit || proj.y < 0) {
        this.lasers.splice(i, 1);
      }
    }

    // Calculate dynamic difficulty adjustments (AI Brain)
    const difficultyLevel = this.calculateDifficultyMultiplier();

    // Manage Balls physics updates
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];

      // If ball is stuck to paddle, lock positions
      if (!ball.isFired) {
        ball.x = this.paddle.x + this.paddle.width / 2;
        ball.y = this.paddle.y - ball.radius;
        continue;
      }

      // Calculate dynamic ball velocities
      const finalSpeed = ball.configSpeed * ball.speedMultiplier * difficultyLevel.speedScalar;

      // Ensure ball travels at corrected velocity values
      const currentAng = Math.atan2(ball.vy, ball.vx);
      ball.vx = finalSpeed * Math.cos(currentAng);
      ball.vy = finalSpeed * Math.sin(currentAng);

      ball.x += ball.vx;
      ball.y += ball.vy;

      // Manage Trail logging
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 8) {
        ball.trail.shift();
      }

      // Wall side bounces
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = -ball.vx;
        this.audio.playWallHit();
      } else if (ball.x + ball.radius > this.virtualWidth) {
        ball.x = this.virtualWidth - ball.radius;
        ball.vx = -ball.vx;
        this.audio.playWallHit();
      }

      // Roof bounce
      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy = -ball.vy;
        this.audio.playWallHit();
      }

      // Shield rebound bottom protection (If active shield powerup is alive)
      if (this.paddle.shieldActive && ball.y + ball.radius >= 585) {
        ball.vy = -Math.abs(ball.vy);
        this.paddle.shieldActive = false; // Destroy shield upon shield contact
        this.audio.playPaddleHit();
        this.createShieldBurstParticles();
      }

      // Standard Ground Fall Off - Dead zone check
      if (ball.y - ball.radius > this.virtualHeight) {
        this.balls.splice(i, 1);
        this.playerStats.totalDrops++;
        this.combo = 0; // Break combo immediately on drop
        continue;
      }

      // Boundary Collision detection - Paddle rebounding details
      if (
        ball.y + ball.radius >= this.paddle.y &&
        ball.y - ball.radius <= this.paddle.y + this.paddle.height &&
        ball.x + ball.radius >= this.paddle.x &&
        ball.x - ball.radius <= this.paddle.x + this.paddle.width
      ) {
        // Enforce paddle bounce physics
        const hitPoint = (ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
        const bounceAngle = hitPoint * (Math.PI / 3.2); // max 56 degrees deflection

        ball.vx = finalSpeed * Math.sin(bounceAngle);
        ball.vy = -finalSpeed * Math.cos(bounceAngle);
        ball.y = this.paddle.y - ball.radius; // Resolve overlaps
        
        this.audio.playPaddleHit();
        this.playerStats.totalPaddleHits++;
        continue;
      }

      // Ball vs Bricks Collision calculation (AABB physics overlaps)
      for (let j = this.bricks.length - 1; j >= 0; j--) {
        const bk = this.bricks[j];
        
        // Quick outer boundary check before precise calculations
        if (
          ball.x + ball.radius > bk.x &&
          ball.x - ball.radius < bk.x + bk.width &&
          ball.y + ball.radius > bk.y &&
          ball.y - ball.radius < bk.y + bk.height
        ) {
          // Precise overlap side tracking
          const prevBallX = ball.x - ball.vx;
          const prevBallY = ball.y - ball.vy;

          if (prevBallY + ball.radius <= bk.y) {
            // Rebound top side
            ball.vy = -Math.abs(ball.vy);
            ball.y = bk.y - ball.radius;
          } else if (prevBallY - ball.radius >= bk.y + bk.height) {
            // Rebound down side
            ball.vy = Math.abs(ball.vy);
            ball.y = bk.y + bk.height + ball.radius;
          } else if (prevBallX + ball.radius <= bk.x) {
            // Left bounds
            ball.vx = -Math.abs(ball.vx);
            ball.x = bk.x - ball.radius;
          } else if (prevBallX - ball.radius >= bk.x + bk.width) {
            // Right bounds
            ball.vx = Math.abs(ball.vx);
            ball.x = bk.x + bk.width + ball.radius;
          }

          this.damageBrick(bk, j);
          break; // Stop nested brick loops for single ball frame
        }
      }
    }

    // Handlers for falling into standard Gameover (Zero balls remaining)
    if (this.balls.length === 0) {
      this.lives--;
      this.playerStats.recentLostLifeTime = Date.now();
      
      if (this.lives <= 0) {
        this.triggerGameOver();
      } else {
        this.resetBall();
      }
    }

    // Verify victory clears (Checking non-indestructible count)
    const breakablesRemaining = this.bricks.filter(b => b.maxHealth !== -1).length;
    if (breakablesRemaining === 0) {
      this.triggerLevelUp();
    }

    // Manage flying visual Particle updates
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    this.updateHUD();
  }

  /**
   * Action: Brick damage logic
   */
  damageBrick(bk, idx) {
    if (bk.health === -1) {
      // Indestructible block hit, just plays bounce tone
      this.audio.playWallHit();
      this.createCollisionGlowParticles(bk);
      return;
    }

    bk.health--;
    this.combo++;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    this.audio.playBrickDestroy(this.combo);
    this.createBrickBurstParticles(bk);

    if (bk.health <= 0) {
      // Break block completely
      this.bricks.splice(idx, 1);

      // Score computations
      const baseVal = bk.maxHealth * 50;
      const comboBonus = Math.floor((this.combo - 1) * 20);
      this.score += baseVal + comboBonus;

      // Item drop probability triggers
      const shouldDropMultiplier = this.calculateDifficultyMultiplier().itemChanceScalar;
      if (Math.random() < 0.16 * shouldDropMultiplier) {
        this.spawnItem(bk.x + bk.width / 2, bk.y + bk.height / 2);
      }
    } else {
      // Degrade color intensity to represent damage
      if (bk.health === 2) {
        bk.color = '#ff007f'; // degraded to pink
      } else if (bk.health === 1) {
        bk.color = '#00f3ff'; // degraded to cyan
      }
    }
  }

  /**
   * Adaptive Cognitive Engine - Brain calculations
   */
  calculateDifficultyMultiplier() {
    let speedScalar = 1.0;
    let itemChanceScalar = 1.0;
    let assistActive = false;
    let diagnosisMsg = 'DYNAMICS: OPTIMAL FLUX';

    // Core low-health protections
    if (this.lives === 1) {
      speedScalar *= 0.88;       // Retards velocity slightly
      itemChanceScalar *= 1.35;  // Spawns items faster (extra lives, paddles)
      assistActive = true;
      diagnosisMsg = 'DYNAMICS: SAFE_SHIELD_UP';
    }

    // High performance ramping
    if (this.combo > 12) {
      speedScalar *= 1.15;       // Fast motion for pros
      diagnosisMsg = 'DYNAMICS: ACCELERATED_GRID';
    }

    // Dropouts mitigation
    const totalActs = this.playerStats.totalPaddleHits + this.playerStats.totalDrops;
    if (totalActs > 4) {
      const accuracy = this.playerStats.totalPaddleHits / totalActs;
      if (accuracy < 0.38) {
        speedScalar *= 0.90;
        itemChanceScalar *= 1.45;
        assistActive = true;
        diagnosisMsg = 'DYNAMICS: ASSIST_PILOT_ON';
      }
    }

    // Recently lost heart buffers
    const lastLostDelta = Date.now() - this.playerStats.recentLostLifeTime;
    if (lastLostDelta < 4000) {
      assistActive = true;
      diagnosisMsg = 'DYNAMICS: REBOOT_PROTECTION';
    }

    return {
      speedScalar,
      itemChanceScalar,
      assistActive,
      diagnosisMsg
    };
  }

  /**
   * Action: Spawn item dropping
   */
  spawnItem(x, y) {
    const list = [
      'PADDLE_EXPAND', 'PADDLE_SHRINK', 'MULTI_BALL',
      'EXTRA_LIFE', 'SPEED_UP', 'SPEED_DOWN',
      'LASER_CANNON', 'ENERGY_SHIELD'
    ];

    // Weigh probabilities towards useful/safer shields if life is scarce
    let chosen = '';
    if (this.lives === 1 && Math.random() < 0.38) {
      chosen = Math.random() < 0.5 ? 'EXTRA_LIFE' : 'ENERGY_SHIELD';
    } else {
      chosen = list[Math.floor(Math.random() * list.length)];
    }

    // Color definitions
    let color = '#fff';
    let label = '?';
    if (chosen === 'PADDLE_EXPAND') { color = '#00f3ff'; label = '↔'; }
    if (chosen === 'PADDLE_SHRINK') { color = '#ff3333'; label = '→←'; }
    if (chosen === 'MULTI_BALL') { color = '#39ff14'; label = '●●'; }
    if (chosen === 'EXTRA_LIFE') { color = '#bd00ff'; label = '♥'; }
    if (chosen === 'SPEED_UP') { color = '#ffaa00'; label = '▲'; }
    if (chosen === 'SPEED_DOWN') { color = '#0044ff'; label = '▼'; }
    if (chosen === 'LASER_CANNON') { color = '#ffff00'; label = '⚡'; }
    if (chosen === 'ENERGY_SHIELD') { color = '#ae00ff'; label = '☲'; }

    this.items.push({
      x: x - 12,
      y: y,
      width: 24,
      height: 24,
      vy: 2.2,
      type: chosen,
      color: color,
      label: label
    });
  }

  /**
   * Powerup Action Handler inside CPU
   */
  applyPowerUp(type) {
    this.audio.playItemGet();

    if (type === 'PADDLE_EXPAND') {
      this.paddle.width = Math.min(220, this.paddle.width + 40);
    } else if (type === 'PADDLE_SHRINK') {
      this.paddle.width = Math.max(60, this.paddle.width - 30);
    } else if (type === 'MULTI_BALL') {
      const incoming = [];
      this.balls.forEach(ball => {
        if (!ball.isFired) return;
        
        // Clone 2 auxiliary offset balls
        for (let k = 0; k < 2; k++) {
          const angleOffset = (k === 0 ? 0.35 : -0.35);
          const currentAng = Math.atan2(ball.vy, ball.vx);
          const newAng = currentAng + angleOffset;
          const currentSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

          incoming.push({
            x: ball.x,
            y: ball.y,
            vx: currentSpd * Math.cos(newAng),
            vy: currentSpd * Math.sin(newAng),
            radius: ball.radius,
            configSpeed: ball.configSpeed,
            speedMultiplier: ball.speedMultiplier,
            isFired: true,
            trail: []
          });
        }
      });
      this.balls.push(...incoming);
    } else if (type === 'EXTRA_LIFE') {
      this.lives = Math.min(this.maxLives, this.lives + 1);
    } else if (type === 'SPEED_UP') {
      this.balls.forEach(b => b.speedMultiplier *= 1.2);
    } else if (type === 'SPEED_DOWN') {
      this.balls.forEach(b => b.speedMultiplier *= 0.83);
    } else if (type === 'LASER_CANNON') {
      this.paddle.lasersActive = true;
      this.paddle.laserTimer = 9000; // lasts 9 seconds
    } else if (type === 'ENERGY_SHIELD') {
      this.paddle.shieldActive = true;
    }
  }

  /**
   * Level victory triggers
   */
  triggerLevelUp() {
    this.combo += 10; // Level finish points
    this.score += this.level * 1000;
    this.level++;
    
    // Save high scores upon checkpoint hits
    StorageController.saveHighScore(this.score);
    this.highScore = StorageController.getHighScore();

    if (this.level > this.maxLevels) {
      this.state = 'VICTORY';
      this.audio.stopBGM();
      this.audio.playLevelUp();
    } else {
      this.audio.playLevelUp();
      this.paddle.width = this.paddle.baseWidth;
      this.paddle.lasersActive = false;
      this.paddle.shieldActive = false;
      this.lasers = [];
      this.items = [];
      this.loadLevelBricks();
      this.resetBall();
    }
    this.updateUIOverlays();
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    this.audio.playGameOver();
    this.audio.stopBGM();
    
    // Persist scores
    StorageController.saveHighScore(this.score);
    this.highScore = StorageController.getHighScore();

    this.updateUIOverlays();
  }

  /**
   * Sync metrics to HUD labels
   */
  updateHUD() {
    document.getElementById('hud-score').innerText = this.formatScore(this.score);
    document.getElementById('hud-highscore').innerText = this.formatScore(this.highScore);
    document.getElementById('hud-level').innerText = `${this.level.toString().padStart(2, '0')}/20`;
    document.getElementById('hud-combo').innerText = `${this.combo}x`;

    // Render hearts dynamically
    const container = document.getElementById('hud-lives-container');
    container.innerHTML = '';
    for (let h = 0; h < this.maxLives; h++) {
      const heart = document.createElement('span');
      heart.className = `life-heart ${h >= this.lives ? 'lost' : ''}`;
      heart.innerHTML = '♥';
      container.appendChild(heart);
    }

    // Diagnostics updates
    const analytics = this.calculateDifficultyMultiplier();
    const modeEl = document.getElementById('ai-mode');
    modeEl.innerText = analytics.diagnosisMsg;

    const protectionEl = document.getElementById('ai-protection');
    if (analytics.assistActive) {
      protectionEl.innerText = 'ONLINE';
      protectionEl.className = 'pulse-green';
    } else {
      protectionEl.innerText = 'STANDBY';
      protectionEl.className = '';
    }

    // Active power status tags
    const activeBuffsEl = document.getElementById('active-buffs');
    activeBuffsEl.innerHTML = '';

    if (this.paddle.lasersActive) {
      const token = document.createElement('div');
      token.className = 'buff-token buff-token-laser';
      token.innerHTML = `LASER CANNON: <span class="buff-timer">${Math.ceil(this.paddle.laserTimer / 1000)}s</span>`;
      activeBuffsEl.appendChild(token);
    }

    if (this.paddle.shieldActive) {
      const token = document.createElement('div');
      token.className = 'buff-token buff-token-shield';
      token.innerHTML = `DEFENSE GRID BARRIER: ACTIVE`;
      activeBuffsEl.appendChild(token);
    }
  }

  /**
   * Action : Burst animations particle engines
   */
  createBrickBurstParticles(bk) {
    const pCount = 14;
    for (let k = 0; k < pCount; k++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.5;
      this.particles.push({
        x: bk.x + bk.width / 2,
        y: bk.y + bk.height / 2,
        vx: speed * Math.cos(angle),
        vy: speed * Math.sin(angle) - 0.5, // slight upwards bias
        gravity: 0.12,
        friction: 0.98,
        color: bk.color,
        size: 1.5 + Math.random() * 2.5,
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.025
      });
    }
  }

  createCollisionGlowParticles(bk) {
    // Generate sparks when hitting indestructible nodes
    for (let k = 0; k < 6; k++) {
      const angle = -Math.PI / 2 + (Math.random() * 1.2 - 0.6);
      const speed = 2.0 + Math.random() * 3.0;
      this.particles.push({
        x: bk.x + bk.width / 2,
        y: bk.y + bk.height / 2,
        vx: speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
        gravity: 0.05,
        friction: 0.97,
        color: '#ffffff',
        size: 1 + Math.random() * 2,
        alpha: 0.9,
        decay: 0.03 + Math.random() * 0.02
      });
    }
  }

  createShieldBurstParticles() {
    // Bottom grid absorption particle lines
    for (let k = 0; k < 40; k++) {
      this.particles.push({
        x: Math.random() * this.virtualWidth,
        y: 585,
        vx: Math.random() * 4 - 2,
        vy: -Math.random() * 3 - 1,
        gravity: 0.05,
        friction: 0.97,
        color: '#ff007f',
        size: 2 + Math.random() * 2,
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.02
      });
    }
  }

  /**
   * Rendering Canvas Drawing loops
   */
  draw() {
    // 1. Reset stage matrix
    this.ctx.fillStyle = '#030308';
    this.ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

    // 2. Draw moving cyberpunk perspective grid lanes
    this.drawBackgroundCyberGrid();

    // 3. Draw indestructible bottom protection field lines (If powerup is alive)
    if (this.paddle.shieldActive) {
      this.ctx.shadowColor = '#ff007f';
      this.ctx.shadowBlur = 15;
      this.ctx.strokeStyle = '#ff007f';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 585);
      this.ctx.lineTo(this.virtualWidth, 585);
      this.ctx.stroke();
      this.ctx.shadowBlur = 0; // reset shadow buffers
    }

    // 4. Draw bricks
    this.bricks.forEach((bk) => {
      this.ctx.shadowColor = bk.color;
      this.ctx.shadowBlur = bk.maxHealth === -1 ? 4 : 10;
      this.ctx.fillStyle = bk.color;
      
      // Draw smooth micro curved brick rectangles
      this.ctx.beginPath();
      this.ctx.roundRect(bk.x, bk.y, bk.width, bk.height, 3);
      this.ctx.fill();

      // Highlight glass sheen
      if (bk.maxHealth !== -1) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.fillRect(bk.x + 2, bk.y + 2, bk.width - 4, 3);
      } else {
        // Metallic hatch indicator on indestructibles
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(bk.x, bk.y);
        this.ctx.lineTo(bk.x + bk.width, bk.y + bk.height);
        this.ctx.stroke();
      }
    });
    this.ctx.shadowBlur = 0;

    // 5. Draw active powers drop capsules
    this.items.forEach((item) => {
      this.ctx.shadowColor = item.color;
      this.ctx.shadowBlur = 12;

      // Outer capsule silhouette
      this.ctx.strokeStyle = item.color;
      this.ctx.lineWidth = 1.8;
      this.ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
      this.ctx.beginPath();
      this.ctx.roundRect(item.x, item.y, item.width, item.height, 8);
      this.ctx.fill();
      this.ctx.stroke();

      // Inside floating glyphs
      this.ctx.fillStyle = item.color;
      this.ctx.font = 'bold 12px "Orbitron"';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(item.label, item.x + item.width / 2, item.y + item.height / 2 + 1);
    });
    this.ctx.shadowBlur = 0;

    // 6. Draw Lasers projectils
    this.lasers.forEach(proj => {
      this.ctx.shadowColor = '#ffff00';
      this.ctx.shadowBlur = 8;
      this.ctx.fillStyle = '#ffff00';
      this.ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
    });
    this.ctx.shadowBlur = 0;

    // 7. Draw Ball trails & Ball nodes
    this.balls.forEach((ball) => {
      // Trail render
      if (ball.isFired) {
        ball.trail.forEach((tCoords, idx) => {
          const ratio = (idx + 1) / ball.trail.length;
          this.ctx.fillStyle = `rgba(0, 243, 255, ${ratio * 0.16})`;
          this.ctx.beginPath();
          this.ctx.arc(tCoords.x, tCoords.y, ball.radius * (0.4 + ratio * 0.6), 0, Math.PI * 2);
          this.ctx.fill();
        });
      }

      // Ball core
      this.ctx.shadowColor = '#00f3ff';
      this.ctx.shadowBlur = 12;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Glass bezel outline rings
      this.ctx.strokeStyle = '#00f3ff';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    });
    this.ctx.shadowBlur = 0;

    // 8. Draw Player Paddle
    this.ctx.shadowColor = '#00f3ff';
    this.ctx.shadowBlur = 15;
    this.ctx.fillStyle = '#00f3ff';
    this.ctx.beginPath();
    this.ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height, 4);
    this.ctx.fill();

    // Highlights core internal circuitry stripes inside pad
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(this.paddle.x + 8, this.paddle.y + 3, this.paddle.width - 16, 2);

    // Laser cannons attachment caps
    if (this.paddle.lasersActive) {
      this.ctx.fillStyle = '#ffff00';
      this.ctx.fillRect(this.paddle.x - 2, this.paddle.y - 4, 6, 8);
      this.ctx.fillRect(this.paddle.x + this.paddle.width - 4, this.paddle.y - 4, 6, 8);
    }
    this.ctx.shadowBlur = 0;

    // 9. Render aiming guidance predictions (Dynamic Brain protection)
    const analytics = this.calculateDifficultyMultiplier();
    if (analytics.assistActive && this.balls.length > 0) {
      const mainBall = this.balls[0];
      if (!mainBall.isFired) {
        // Show visual dotted arrow indicator pointing straight up
        this.ctx.strokeStyle = 'rgba(255, 0, 127, 0.45)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 6]);
        this.ctx.beginPath();
        this.ctx.moveTo(mainBall.x, mainBall.y - 10);
        this.ctx.lineTo(mainBall.x, mainBall.y - 120);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // reset paths
      } else {
        // Plot predictive visual guides for upcoming 1 second path
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([3, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(mainBall.x, mainBall.y);
        // Direct velocity projections
        this.ctx.lineTo(mainBall.x + mainBall.vx * 15, mainBall.y + mainBall.vy * 15);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    }

    // 10. Draw Particles
    this.particles.forEach((p) => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    this.ctx.globalAlpha = 1.0; // restore default opacity
  }

  /**
   * background neon grid scroll computation grids
   */
  drawBackgroundCyberGrid() {
    this.ctx.strokeStyle = 'rgba(255, 0, 127, 0.05)';
    this.ctx.lineWidth = 1;

    // Horizontal Lines spacing
    const lineSpacing = 35;
    const linesTotal = Math.floor(this.virtualHeight / lineSpacing);
    for (let k = 0; k <= linesTotal; k++) {
      const y = k * lineSpacing;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.virtualWidth, y);
      this.ctx.stroke();
    }

    // Dynamic horizontal sweeps
    for (let k = 0; k <= 16; k++) {
      const x = (this.virtualWidth / 16) * k;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.virtualHeight);
      this.ctx.stroke();
    }
  }
}

// Instantiate game context once page loaded
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
