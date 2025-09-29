// --- 1. SETUP AND CONSTANTS (Screen Size and Scoring Implemented) ---

// Screen Dimensions (Using the wider screen from the previous step)
const GAME_WIDTH = 2400; 
const GAME_HEIGHT = 1200; 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

let score = 0; 
let isPaused = false;
let settings = {
    sound: true,
    scanlines: true,
    theme: 'retro',
};
let gameState = 'menu'; 
let menuState = 'main'; 
let selectedLevel = null;
let menuButtons = {}; // Global object to store button coordinates for click detection
let hoveredButtonKey = null; // currently hovered button id
let currentDrawButtonKey = null; // key for the button currently being drawn

// Time Tracking (Fixed Time Step)
let lastTime = 0;
const TARGET_FPS = 60;
const TIME_PER_TICK = 1000 / TARGET_FPS; 
let accruedTime = 0; 
let tick = 0; 
let totalFrames = 0; 

// Input handling variables
let keys = {};
let isFiring = true; 

// Object Arrays
let enemyBullets = [];
let playerBullets = [];
let effects = [];
let pickups = []; 
let laser = null; 
let homingMissiles = [];
let bigOrbs = []; // phase-2 delayed explosive projectiles
let strikeLines = []; // telegraphed sweeping lines (phase 2)
let mines = []; // stationary delayed mines (phase 2)
let laserArms = []; // rotating telegraphed lasers for phase 3

// Player State
let isInvulnerable = false; 
let invulnerabilityTimer = 0; 
const INVULNERABILITY_FRAMES = 90; 

// Player Firing
const PLAYER_FIRE_DELAY = 6; // Faster shooting
let playerFireCounter = 0;

// Cooldowns (in frames)
const LASER_COOLDOWN_FRAMES = 480; 
let laserCooldownCounter = 0; 

const MISSILE_COOLDOWN_FRAMES = 180; 
let missileCooldownCounter = 0; 

// SCALING FACTOR for Illusion of Strength (x10)
const SCALE_FACTOR = 10;

// Boss Phase Constants
const BOSS_MAX_HEALTH = 600 * SCALE_FACTOR; // 600 HP
const PHASE_THREE_HP = 200 * SCALE_FACTOR;  // 200 HP
const PHASE_TWO_HP = 400 * SCALE_FACTOR;   // 400 HP

// Scoring Constants
const BASE_SCORE_BULLET = 10;
const BASE_SCORE_MISSLE = 50;
const BASE_SCORE_LASER = 300;
const SCORE_HIT_PENALTY = -100; 
const SCORE_DEFEAT_BONUS = 1000 * SCALE_FACTOR; 

const TIME_BONUS_START = 5000;
const TIME_BONUS_DECREMENT_PER_SECOND = 17; 

// Drop Rates
const HEALTH_DROP_CHANCE = 0.007; 

// Pickup Properties
const PICKUP_MAX_LIFE = 480; 
const PICKUP_SPEED_PER_TICK = 2.5; 

// Movement Tuning 
const PLAYER_SPEED = 10;      
const PLAYER_BULLET_SPEED = 15; 
const ENEMY_BULLET_SPEED = 9;   
const MISSILE_SPEED = 12;     

const BOSS_FREQUENCY = 0.012; 
const BOSS_AMPLITUDE = 100; 

const MISSILE_EFFECT_RATE = 0.5; 
const MISSILE_TURN_SPEED = 0.08; 

// GAME STATISTICS TRACKER
const Stats = {
    shotsFired: 0,
    missilesFired: 0,
    lasersFired: 0,
    bossHits: { bullet: 0, missile: 0, laser: 0 },
    playerHitsTaken: 0,
    startTime: 0, 
    endTime: 0,
    
    get totalTimeSeconds() {
        if (this.startTime === 0) return 0;
        
        const end = this.endTime === 0 ? Date.now() : this.endTime; 
        
        return (end - this.startTime) / 1000;
    },
    
    reset: function() {
        this.shotsFired = 0;
        this.missilesFired = 0;
        this.lasersFired = 0;
        this.bossHits = { bullet: 0, missile: 0, laser: 0 };
        this.playerHitsTaken = 0;
        this.startTime = Date.now();
        this.endTime = 0;
    },
    
    calculateFinalScore: function() {
        let baseScore = (this.bossHits.bullet * BASE_SCORE_BULLET) + 
                        (this.bossHits.missile * BASE_SCORE_MISSLE) + 
                        (this.bossHits.laser * BASE_SCORE_LASER);
                        
        let penalty = this.playerHitsTaken * Math.abs(SCORE_HIT_PENALTY);
        let finalScore = baseScore - penalty;
        
        if (enemy.health <= 0) {
            const secondsElapsed = Math.floor(this.totalTimeSeconds);
            const bonusLost = secondsElapsed * TIME_BONUS_DECREMENT_PER_SECOND;
            
            const timeBonus = Math.max(0, TIME_BONUS_START - bonusLost);
            
            finalScore = finalScore + timeBonus + SCORE_DEFEAT_BONUS;
        }

        return Math.floor(Math.max(0, finalScore));
    }
};

// --- Utility Functions ---

function distance(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj2.y - obj1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// distance from point (px,py) to segment (x1,y1)-(x2,y2)
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const wx = px - x1;
    const wy = py - y1;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.sqrt((px - x1)*(px - x1) + (py - y1)*(py - y1));
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.sqrt((px - x2)*(px - x2) + (py - y2)*(py - y2));
    const b = c1 / c2;
    const pbx = x1 + b * vx;
    const pby = y1 + b * vy;
    return Math.sqrt((px - pbx)*(px - pbx) + (py - pby)*(py - pby));
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00.00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(2);
    return `${minutes}:${remainingSeconds.padStart(5, '0')}`; 
}

function initializeGame() {
    score = 0; 
    Stats.reset(); 
    
    keys = {};

    player.health = 3;
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT * 0.85;
    
    enemy.health = enemy.maxHealth;
    enemy.currentPhase = 1;
    enemy.applyPhaseDifficulty();
    enemy.x = GAME_WIDTH / 2;
    enemy.y = GAME_HEIGHT * 0.15;
    enemy.waveTime = 0; 
    enemy.patternCounter = 0;

    enemyBullets = [];
    playerBullets = [];
    effects = [];
    homingMissiles = [];
    bigOrbs = [];
    pickups = []; 
    laser = null; 
    strikeLines = [];
    mines = [];
    laserArms = [];
    
    laserCooldownCounter = 0; 
    missileCooldownCounter = 0;
    
    isFiring = true;
    
    isInvulnerable = false;
    invulnerabilityTimer = 0;
    playerFireCounter = 0;
    totalFrames = 0;
}

// --- 2. CLASSES FOR GAME OBJECTS ---

class GameObject {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

class Pickup extends GameObject {
    constructor(x, y, type) {
        super(x, y, 10, type === 'health' ? 'red' : 'cyan');
        this.type = type;
        this.life = PICKUP_MAX_LIFE; 
        this.vy = PICKUP_SPEED_PER_TICK; 
    }

    update() {
        this.life--; 
        this.y += this.vy; 
        if (this.y > GAME_HEIGHT + this.radius) {
            this.life = 0;
        }
    }

    draw() {
        const isBlinking = this.life < 120 && Math.floor(this.life / 10) % 2 === 0;
        const fade = this.life < 60 ? this.life / 60 : 1; 
        
        ctx.globalAlpha = isBlinking ? 0.2 : fade;
        if (this.type === 'health') {
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'red';
            ctx.fillStyle = 'red';
            ctx.font = '24px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('♥', this.x, this.y + 8);
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1.0;
    }
}

class PlayerLaser {
    constructor(x) {
        this.x = x;
        this.y = GAME_HEIGHT; 
        this.width = 15;
        this.height = GAME_HEIGHT;
        this.damage = 20 * SCALE_FACTOR; 
        this.life = 30; 
        this.hasDealtDamage = false; 
        Stats.lasersFired++; 
    }
    
    update() {
        this.life--; 
        this.x = player.x; 
    }
    
    draw() {
        const maxLife = 30;
        const glow = Math.max(0, this.life / maxLife); 
        const laserWidth = this.width * (1 + (1 - glow) * 0.5); 
        const halfWidth = laserWidth / 2;
        const startY = player.y - player.radius;

        ctx.shadowBlur = 60 * glow; 
        ctx.shadowColor = `rgba(0, 255, 255, ${glow})`; 
        
        ctx.fillStyle = `rgba(180, 255, 255, ${glow})`;
        ctx.fillRect(this.x - halfWidth * 0.4, 0, laserWidth * 0.4, startY);

        ctx.beginPath();
        ctx.moveTo(this.x - halfWidth, 0); 
        ctx.lineTo(this.x - halfWidth * 0.8, startY); 
        ctx.lineTo(this.x + halfWidth * 0.8, startY); 
        ctx.lineTo(this.x + halfWidth, 0); 
        ctx.closePath();
        
        ctx.fillStyle = `rgba(0, 255, 255, ${glow * 0.7})`; 
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
}

class Player extends GameObject {
    constructor(x, y) {
        super(x, y, 8, 'lightblue');
        this.speed = PLAYER_SPEED; 
        this.hitboxRadius = 2; // The tiny red circle
        this.health = 3;
        this.hitEffectTimer = 0; // For big glow
    }

    update() {
        let dx = 0;
        let dy = 0;
        if (keys['w']) dy -= 1;
        if (keys['s']) dy += 1;
        if (keys['a']) dx -= 1;
        if (keys['d']) dx += 1;
        
        if (dx !== 0 || dy !== 0) {
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            dx = (dx / magnitude);
            dy = (dy / magnitude);
        }

        this.x += dx * this.speed;
        this.y += dy * this.speed;

        this.x = Math.max(this.radius, Math.min(this.x, GAME_WIDTH - this.radius));
        this.y = Math.max(this.radius, Math.min(this.y, GAME_HEIGHT - this.radius));
        
        if (isInvulnerable) {
            invulnerabilityTimer--;
            this.hitEffectTimer = Math.max(this.hitEffectTimer - 1, 0);
            if (invulnerabilityTimer <= 0) {
                isInvulnerable = false;
            }
        }
    }
    
    draw() {
        ctx.save();
        // Big pulsing glow when hit
        if (isInvulnerable && this.hitEffectTimer > 0) {
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80);
            ctx.shadowBlur = 40 + 40 * pulse;
            ctx.shadowColor = `rgba(255, 50, 50, ${0.7 * pulse})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 30 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 50, 50, ${0.15 * pulse})`;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        // Hit flash: player flashes white when invulnerable
        if (isInvulnerable && Math.floor(invulnerabilityTimer / 5) % 2 === 0) {
            ctx.shadowBlur = 16;
            ctx.shadowColor = '#FFF';
        } else {
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'lightblue';
        }
        super.draw();
        ctx.shadowBlur = 0;

        // CRITICAL: Draw the tiny red hitbox circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.hitboxRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    }
}

class PlayerBullet extends GameObject {
    constructor(x, y, vx = 0, vy = -PLAYER_BULLET_SPEED) {
        super(x, y, 3, 'lime');
        this.speed = PLAYER_BULLET_SPEED;
        this.damage = 1 * SCALE_FACTOR;
        this.vx = vx;
        this.vy = vy;
        Stats.shotsFired++;
    }
    draw() {
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'lime';
        super.draw();
        ctx.shadowBlur = 0;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
}

class Enemy extends GameObject {
    constructor(x, y) {
        super(x, y, 15, 'darkred');
        this.maxHealth = BOSS_MAX_HEALTH; 
        this.health = this.maxHealth;
        this.currentPhase = 1;
        this.baseFireRate = 30; 
        this.baseBulletSpeed = ENEMY_BULLET_SPEED;
        this.amplitude = BOSS_AMPLITUDE;
        this.frequency = BOSS_FREQUENCY;
        this.initialX = x;
        this.waveTime = 0;
        this.fireRate = this.baseFireRate;
        this.bulletSpeed = this.baseBulletSpeed;
        this.frameCounter = 0;
        this.pattern = 1; 
        this.patternCounter = 0;
        this.patternSwitchDelay = 120; 
        // For dynamic movement
        this.targetY = y;
        this.verticalMoveTimer = 0;
        this.lastPhase = 1;
    }
    
    update() {
        let newPhase = this.currentPhase;
        if (this.health <= PHASE_THREE_HP) {
            newPhase = 3;
        } else if (this.health <= PHASE_TWO_HP) {
            newPhase = 2;
        }
        // Phase change detection and particle effect
        if (newPhase !== this.currentPhase) {
            const currentX = this.x; 
            this.currentPhase = newPhase;
            this.applyPhaseDifficulty();
            this.initialX = currentX;
            this.waveTime = 0; 
            // Particle effect for phase change
            if (newPhase === 2) {
                for (let i = 0; i < 30; i++) {
                    const angle = (i / 30) * Math.PI * 2;
                    const speed = 12 + Math.random() * 8;
                    effects.push(new Effect(
                        this.x + Math.cos(angle) * 20,
                        this.y + Math.sin(angle) * 20,
                        'orange',
                        'spark',
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        30 + Math.random() * 20
                    ));
                }
            } else if (newPhase === 3) {
                for (let i = 0; i < 60; i++) {
                    const angle = (i / 60) * Math.PI * 2;
                    const speed = 18 + Math.random() * 12;
                    effects.push(new Effect(
                        this.x + Math.cos(angle) * 30,
                        this.y + Math.sin(angle) * 30,
                        'magenta',
                        'spark',
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        40 + Math.random() * 30
                    ));
                }
            }
        }

        this.waveTime++;
        // Dynamic movement for phase 2 and 3
        if (this.currentPhase === 1) {
            // Simple left-right
            const currentAmplitude = this.amplitude;
            const currentFrequency = this.frequency;
            this.x = this.initialX + Math.sin(this.waveTime * currentFrequency) * currentAmplitude;
            this.y = GAME_HEIGHT * 0.15;
        } else if (this.currentPhase === 2) {
            // More dynamic horizontal movement
            const hAmp = this.amplitude * 1.7;
            const hFreq = this.frequency * 1.6;
            this.x = this.initialX + Math.sin(this.waveTime * hFreq) * hAmp + Math.sin(this.waveTime * 0.07) * 60;
            // Random vertical movement (stay in top 35% of screen)
            if (this.verticalMoveTimer <= 0) {
                const minY = GAME_HEIGHT * 0.08;
                const maxY = GAME_HEIGHT * 0.35;
                this.targetY = minY + Math.random() * (maxY - minY);
                this.verticalMoveTimer = 60 + Math.random() * 60;
            } else {
                this.verticalMoveTimer--;
            }
            this.y += (this.targetY - this.y) * 0.08;
        } else {
            // Phase 3: unpredictable, wide movement but smooth
            const hAmp = GAME_WIDTH * 0.45;
            const hFreq = this.frequency * 1.5; // Lower frequency for smoother movement
            // Reduce chaos and interpolate x for smoothness
            const chaos = Math.sin(this.waveTime * 0.13) * 60 + Math.sin(this.waveTime * 0.23) * 40;
            const targetX = GAME_WIDTH / 2 + Math.sin(this.waveTime * hFreq) * hAmp + chaos;
            this.x += (targetX - this.x) * 0.08; // Smoothly move toward targetX
            // Random vertical movement (stay in top 35% of screen)
            if (this.verticalMoveTimer <= 0) {
                const minY = GAME_HEIGHT * 0.08;
                const maxY = GAME_HEIGHT * 0.35;
                this.targetY = minY + Math.random() * (maxY - minY);
                this.verticalMoveTimer = 40 + Math.random() * 40;
            } else {
                this.verticalMoveTimer--;
            }
            this.y += (this.targetY - this.y) * 0.13;
        }

        this.patternCounter++; 
        if (this.patternCounter > this.patternSwitchDelay) {
            this.pattern = (this.pattern % 3) + 1; 
            this.patternCounter = 0;
            
            this.fireRate = this.baseFireRate / this.currentPhase; 
            if (this.pattern === 2) this.fireRate *= 1.5;
            if (this.pattern === 3) this.fireRate *= 0.8;
        }

        this.frameCounter++; 
        if (this.frameCounter >= this.fireRate) {
            if (this.pattern === 1) {
                this.fireCircularPattern();
            } else if (this.pattern === 2) {
                this.fireTargetedShot();
            } else if (this.pattern === 3) {
                this.fireFanShot();
            }
            this.frameCounter = 0;
        }

        // Phase-specific extra behaviors
        // Phase 2: occasional strike lines and mines + limit bigOrbs
        if (this.currentPhase === 2) {
            // spawn strike line occasionally
            if (Math.random() < 0.008 && strikeLines.length < 2) {
                // choose random vertical or horizontal line across player area
                if (Math.random() < 0.5) {
                    const y = GAME_HEIGHT * (0.12 + Math.random() * 0.2);
                    strikeLines.push(new StrikeLine(50, y, GAME_WIDTH-50, y, TARGET_FPS*1.0, TARGET_FPS*0.35));
                } else {
                    const x = GAME_WIDTH * (0.15 + Math.random() * 0.7);
                    // extend vertical strikes to reach near the bottom of the play area
                    const strikeBottom = GAME_HEIGHT - 40; // leave small margin for UI
                    strikeLines.push(new StrikeLine(x, 50, x, strikeBottom, TARGET_FPS*1.0, TARGET_FPS*0.35));
                }
            }
            // spawn mines occasionally
            if (Math.random() < 0.006 && mines.length < 3) {
                const mx = 50 + Math.random() * (GAME_WIDTH - 100);
                const my = GAME_HEIGHT * (0.45 + Math.random()*0.45);
                mines.push(new Mine(mx, my, TARGET_FPS * (3 + Math.random()*2)));
            }
            // slightly random chance to fire an extra big orb but cap them
            if (Math.random() < 0.007 && bigOrbs.length < 3) {
                this.fireBigOrb();
            }
        }

        // Phase 3: combos and burst patterns (rotating laser arm attack removed)
        if (this.currentPhase === 3) {
            // small chance to start a short combo (fan then circular)
            if (!this.combo && Math.random() < 0.004) {
                this.combo = { steps: ['fan','burst'], idx: 0, timer: 0 };
            }
            if (this.combo) {
                this.combo.timer++;
                if (this.combo.timer > 14) {
                    const step = this.combo.steps[this.combo.idx];
                    if (step === 'fan') this.fireFanShot();
                    if (step === 'burst') this.fireCircularPattern();
                    this.combo.idx++;
                    this.combo.timer = 0;
                    if (this.combo.idx >= this.combo.steps.length) this.combo = null;
                }
            }
        }
    }
    
    applyPhaseDifficulty() {
        this.bulletSpeed = this.baseBulletSpeed * (1 + (this.currentPhase - 1) * 0.4); 
        this.color = (this.currentPhase === 3) ? 'purple' : 
                     (this.currentPhase === 2) ? 'darkorange' : 
                     'darkred';
    }

    fireCircularPattern() {
        const numBullets = 15 + this.currentPhase * 5; 
        for (let i = 0; i < numBullets; i++) {
            const angle = (i / numBullets) * Math.PI * 2; 
            const speed = this.bulletSpeed;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            enemyBullets.push(new EnemyBullet(this.x, this.y, vx, vy));
        }
    }

    fireTargetedShot() {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);
        
        const speed = this.bulletSpeed * 1.2; 
        const vx = Math.cos(angle) * speed; 
        const vy = Math.sin(angle) * speed; 
        
        enemyBullets.push(new EnemyBullet(this.x, this.y, vx, vy));
        // In phase 2, also fire a delayed explosive orb toward the player
        if (this.currentPhase === 2) {
            // limit active orbs to avoid spam
            if (bigOrbs.length < 2) this.fireBigOrb();
        }
    }

    fireBigOrb() {
        // Aim generally toward the player but add a small random spread
        const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const angle = baseAngle + (Math.random() * 0.6 - 0.3);
        const speed = 1.6; // slow orb
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        // Lifetime: ~5 seconds
        const lifetime = Math.floor(TARGET_FPS * 5);
        bigOrbs.push(new BigOrb(this.x, this.y, vx, vy, lifetime));
    }
    
    fireFanShot() {
        const spreadAngle = Math.PI / 3; 
        const centerAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const bulletsPerShot = 7; 
        
        for (let i = 0; i < bulletsPerShot; i++) {
            const offsetAngle = (i - Math.floor(bulletsPerShot / 2)) * (spreadAngle / (bulletsPerShot - 1));
            const finalAngle = centerAngle + offsetAngle;
            
            const speed = this.bulletSpeed * 1.5;
            const vx = Math.cos(finalAngle) * speed;
            const vy = Math.sin(finalAngle) * speed; 
            
            enemyBullets.push(new EnemyBullet(this.x, this.y, vx, vy));
        }
    }
    
    draw() {
        // Improved boss rendering for clarity in bullet-hell gameplay
        ctx.save();

        const cx = this.x;
        const cy = this.y;
        const r = this.radius;

        // Core gradient (bright center -> darker edge)
        const coreGrad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
        // color choices based on phase for quick readability
        const phaseColors = {1: ['#FF6666', '#880000'], 2: ['#FFAA33', '#663300'], 3: ['#D288FF', '#3b1a4d']};
        const colors = phaseColors[this.currentPhase] || ['#FF6666', '#880000'];
        coreGrad.addColorStop(0, colors[0]);
        coreGrad.addColorStop(1, colors[1]);

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // Solid dark outline for contrast against background/bullets
        ctx.lineWidth = Math.max(3, r * 0.08);
        ctx.strokeStyle = 'rgba(10,10,10,0.9)';
        ctx.stroke();

        // Soft outer glow colored by phase but kept low-alpha to avoid distraction
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = 0.12 + 0.02 * this.currentPhase;
        ctx.lineWidth = Math.max(8, r * 0.12);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Health arc: clear, high-contrast indicator around the boss
        const healthPct = Math.max(0, Math.min(1, this.health / this.maxHealth));
        const arcRadius = r * 1.45;
        const arcStart = -Math.PI / 2; // start at top
        const arcEnd = arcStart + healthPct * Math.PI * 2;

        ctx.beginPath();
        ctx.lineWidth = Math.max(6, r * 0.12);
        // Background arc (empty portion)
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.arc(cx, cy, arcRadius, arcEnd, arcStart + Math.PI * 2);
        ctx.stroke();

        // Filled arc representing current health
        ctx.beginPath();
        const healthColor = this.currentPhase === 3 ? '#DDA0FF' : (this.currentPhase === 2 ? '#FFD07A' : '#FF9B9B');
        ctx.strokeStyle = healthColor;
        ctx.arc(cx, cy, arcRadius, arcStart, arcEnd);
        ctx.stroke();

        // Subtle rotating ring (thin) to give orientation cue but not distract
        const rot = (Date.now() / 1200) % (Math.PI * 2);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.globalAlpha = 0.14;
        ctx.lineWidth = Math.max(2, r * 0.05);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.1, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.1, Math.PI - 0.6, Math.PI + 0.6);
        ctx.stroke();
        ctx.restore();

        // If recently hit, show a minimal hit flash ring for feedback
        if (this._hitFlash && this._hitFlash > 0) {
            const alpha = Math.min(0.9, 0.6 * (this._hitFlash / 8));
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,255,150,${alpha})`;
            ctx.lineWidth = Math.max(2, r * 0.09);
            ctx.stroke();
            this._hitFlash--;
        }

        ctx.restore();
    }
    // Call this when enemy is hit
    hitFlash() {
        this._hitFlash = 8;
    }
}

class EnemyBullet extends GameObject {
    constructor(x, y, vx, vy) { 
        super(x, y, 4, 'yellow');
        this.vx = vx;
        this.vy = vy;
    }
    
    draw() {
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'yellow';
        super.draw();
        ctx.shadowBlur = 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
}

class HomingMissile extends GameObject {
    constructor(x, y, target) {
        super(x, y, 6, 'orange');
        this.target = target;
        this.speed = MISSILE_SPEED; 
        this.turnSpeed = MISSILE_TURN_SPEED; 
        this.damage = 1 * SCALE_FACTOR; 
        this.vx = 0;
        this.vy = -this.speed; 
    }
    
    update() {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const desiredAngle = Math.atan2(dy, dx);
        
        let currentAngle = Math.atan2(this.vy, this.vx);
        
        let angleDiff = desiredAngle - currentAngle;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const maxTurn = this.turnSpeed;
        if (Math.abs(angleDiff) > maxTurn) {
            currentAngle += Math.sign(angleDiff) * maxTurn;
        } else {
            currentAngle = desiredAngle;
        }

        this.vx = Math.cos(currentAngle) * this.speed;
        this.vy = Math.sin(currentAngle) * this.speed;

        this.x += this.vx;
        this.y += this.vy;
        
        if (Math.random() < MISSILE_EFFECT_RATE) {
            const tailX = this.x - this.vx * 0.5 + (Math.random() * 6 - 3); 
            const tailY = this.y - this.vy * 0.5 + (Math.random() * 6 - 3); 
            
            effects.push(new Effect(
                tailX, tailY, 
                `rgba(255, ${Math.floor(Math.random() * 100 + 155)}, 0, 0.9)`, 
                'spark',
                (Math.random() * 2 - 1) * 2, 
                (Math.random() * 2 - 1) * 2  
            ));
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        const rotation = Math.atan2(this.vy, this.vx) + Math.PI / 2;
        ctx.rotate(rotation);
        
        ctx.shadowBlur = 15; 
        ctx.shadowColor = 'orange';

        ctx.beginPath();
        ctx.moveTo(0, -this.radius * 2); 
        ctx.lineTo(-this.radius, this.radius * 2); 
        ctx.lineTo(this.radius, this.radius * 2); 
        ctx.closePath();
        
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
        
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
}

// Big delayed orb that moves slowly toward a direction then explodes into fast small bullets
class BigOrb extends GameObject {
    constructor(x, y, vx, vy, life) {
        super(x, y, 26, 'magenta');
        this.vx = vx;
        this.vy = vy;
        this.life = life; // ticks until explosion
        this.maxLife = life;
        this.exploded = false;
        this.damage = 1 * SCALE_FACTOR;
    }

    update() {
        // Slow drift
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        // Slight homing toward player's last known position to make them more threatening
        if (!this.exploded && Math.random() < 0.02) {
            const ax = player.x - this.x;
            const ay = player.y - this.y;
            this.vx += ax * 0.002;
            this.vy += ay * 0.002;
            const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
            const max = 3.2;
            if (speed > max) {
                this.vx = this.vx / speed * max;
                this.vy = this.vy / speed * max;
            }
        }
        // Flash/pulse when close to exploding
        if (this.life < 30) this.radius = 26 + (30 - this.life) * 0.6;
        // small pulsing effect could be added via radius adjustment when drawing
    }

    draw() {
        // Draw glowing orb
        ctx.save();
        const pulse = 0.9 + 0.1 * Math.sin(Date.now() / 120);
        ctx.shadowBlur = 30 * (this.life / this.maxLife + 0.2);
        ctx.shadowColor = 'magenta';
        ctx.fillStyle = `rgba(255, 0, 255, ${0.6 + 0.4 * (this.life / this.maxLife)})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    explode() {
        if (this.exploded) return;
        this.exploded = true;
        const pieces = 30; // number of small fast projectiles
        for (let i = 0; i < pieces; i++) {
            const angle = (i / pieces) * Math.PI * 2 + (Math.random() * 0.2 - 0.1);
            const speed = 8 + Math.random() * 6; // fast
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const b = new EnemyBullet(this.x, this.y, vx, vy);
            b.radius = 4;
            enemyBullets.push(b);
        }
        // explosion effect
        for (let i = 0; i < 40; i++) {
            effects.push(new Effect(this.x + (Math.random()*20-10), this.y + (Math.random()*20-10), 'magenta', 'spark', (Math.random()*6-3), (Math.random()*6-3), 20 + Math.random()*20));
        }
    }
}

// Telegraphed sweeping line that deals damage when it activates
class StrikeLine {
    constructor(x1, y1, x2, y2, telegraphFrames = 60, activeFrames = 18) {
        this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
        this.telegraph = telegraphFrames; this.active = activeFrames;
        this.maxTele = telegraphFrames;
        this.damage = 1 * SCALE_FACTOR;
        this.activeNow = false;
    }
    update() {
        if (this.telegraph > 0) {
            this.telegraph--;
            if (this.telegraph <= 0) this.activeNow = true;
        } else if (this.active > 0) {
            this.active--;
        }
    }
    draw() {
        // Telegraph line (pulsing)
        if (this.telegraph > 0) {
            const alpha = 0.15 + 0.85 * (1 - this.telegraph / this.maxTele);
            ctx.save();
            ctx.strokeStyle = `rgba(255,80,20,${alpha})`;
            ctx.lineWidth = 6;
            ctx.setLineDash([6, 8]);
            ctx.beginPath();
            ctx.moveTo(this.x1, this.y1);
            ctx.lineTo(this.x2, this.y2);
            ctx.stroke();
            ctx.restore();
        } else if (this.activeNow && this.active > 0) {
            ctx.save();
            ctx.strokeStyle = `rgba(255,40,0,0.95)`;
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.moveTo(this.x1, this.y1);
            ctx.lineTo(this.x2, this.y2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

// Mine: stationary object that after a delay explodes into bullets
class Mine extends GameObject {
    constructor(x, y, life = TARGET_FPS * 3.5) {
        super(x, y, 10, 'orange');
        this.life = life;
        this.maxLife = life;
        this.exploded = false;
    }
    update() {
        this.life--;
        // small hover animation
        this.y += Math.sin(Date.now()/200 + this.x) * 0.02;
    }
    draw() {
        ctx.save();
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 160);
        ctx.shadowBlur = 20 * (this.life / this.maxLife + 0.2);
        ctx.shadowColor = 'orange';
        ctx.fillStyle = `rgba(255,165,0,${0.6 + 0.4*(this.life/this.maxLife)})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
    explode() {
        if (this.exploded) return;
        this.exploded = true;
        const count = 18;
        for (let i=0;i<count;i++){
            const ang = (i/count)*Math.PI*2 + (Math.random()*0.4-0.2);
            const s = 6 + Math.random()*4;
            enemyBullets.push(new EnemyBullet(this.x, this.y, Math.cos(ang)*s, Math.sin(ang)*s));
        }
        for (let i=0;i<20;i++) effects.push(new Effect(this.x + Math.random()*20-10, this.y + Math.random()*20-10, 'orange','spark',(Math.random()*4-2),(Math.random()*4-2),20+Math.random()*20));
    }
}

// LaserArm: telegraphed rotating laser sweep centered on boss
class LaserArm {
    constructor(x, y, startAngle = 0, arcSize = Math.PI / 3, angularSpeed = 0.02, telegraph = TARGET_FPS * 0.9, life = TARGET_FPS * 1.6) {
        this.x = x; this.y = y;
        this.angle = startAngle; // center angle of the arm
        this.arc = arcSize; // half width each side
        this.angularSpeed = angularSpeed; // radians per tick while sweeping
        this.telegraph = telegraph; // frames before active
        this.life = life; // active frames
        this.maxTele = telegraph;
        this.maxLife = life;
        this.activeNow = false;
        this.length = Math.max(GAME_WIDTH, GAME_HEIGHT) * 0.9;
    }
    update() {
        if (this.telegraph > 0) {
            this.telegraph--;
            if (this.telegraph <= 0) this.activeNow = true;
        } else if (this.life > 0) {
            this.life--;
            // sweep
            this.angle += this.angularSpeed;
        }
    }
    draw() {
        if (this.telegraph > 0) {
            // telegraph ring and faint arc
            ctx.save();
            const alpha = 0.2 + 0.6 * (1 - this.telegraph / this.maxTele);
            ctx.strokeStyle = `rgba(200,150,255,${alpha})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.length * 0.5, this.angle - this.arc, this.angle + this.arc);
            ctx.stroke();
            ctx.restore();
        } else if (this.activeNow && this.life > 0) {
            // draw solid sweeping arc
            ctx.save();
            ctx.strokeStyle = 'rgba(180,100,255,0.95)';
            ctx.lineWidth = 18;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.length * 0.5, this.angle - this.arc, this.angle + this.arc);
            ctx.stroke();
            ctx.restore();
        }
    }
    // returns true if a point (px,py) is hit by the active arm
    hitsPoint(px, py) {
        if (!this.activeNow || this.life <= 0) return false;
        const dx = px - this.x; const dy = py - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > this.length * 0.5) return false;
        const ang = Math.atan2(dy, dx);
        let diff = ang - this.angle;
        while (diff > Math.PI) diff -= Math.PI*2;
        while (diff < -Math.PI) diff += Math.PI*2;
        return Math.abs(diff) <= this.arc;
    }
}

class Effect extends GameObject {
    constructor(x, y, color, type = 'spark', initialVx = (Math.random() * 2 - 1), initialVy = (Math.random() * 2 - 1), life = 15) {
        super(x, y, 8, color); 
        this.life = life;
        this.maxLife = life;
        this.type = type;
        this.rotation = Math.random() * Math.PI * 2;
        this.vx = initialVx; 
        this.vy = initialVy; 
        this.text = ''; 
        if (type === 'text') {
             this.text = color; 
             this.color = 'lime'; 
             this.life = 60; 
             this.maxLife = 60;
             this.vx = 0;
             this.vy = -1; 
        }
    }

    update() {
        this.life--; 
        this.radius = 8 * (this.life / this.maxLife); 
        this.x += this.vx;
        this.y += this.vy;
    }
    
    draw() {
        if (this.type === 'text') {
            ctx.globalAlpha = this.life / this.maxLife;
            ctx.font = '30px Arial';
            ctx.fillStyle = this.color; 
            ctx.textAlign = 'center';
            ctx.fillText(this.text, this.x, this.y); 
            ctx.globalAlpha = 1.0;
        } else if (this.type === 'ripple') {
            ctx.save();
            ctx.globalAlpha = this.life / this.maxLife * 0.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 4;
            ctx.shadowBlur = 16;
            ctx.shadowColor = this.color;
            ctx.stroke();
            ctx.restore();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        } else {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            const size = this.radius * 2;
            ctx.shadowBlur = 10; 
            ctx.shadowColor = this.color;
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.life / this.maxLife;
            ctx.fillRect(-size/4, -size/4, size/2, size/2); 
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-size/4, -size/4, size/2, size/2); 
            ctx.restore();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }
    }
}

// --- 3. GAME LOGIC ---
const player = new Player(GAME_WIDTH / 2, GAME_HEIGHT * 0.85);
const enemy = new Enemy(GAME_WIDTH / 2, GAME_HEIGHT * 0.15);
enemy.applyPhaseDifficulty();

function handlePlayerFire() {
    playerFireCounter++;
    if (isFiring && playerFireCounter >= PLAYER_FIRE_DELAY) {
        // Fan-shaped 5-bullet shot
        const angles = [0, -0.18, 0.18, -0.35, 0.35]; // radians: center, slight left/right, more left/right
        for (let i = 0; i < 5; i++) {
            const angle = angles[i];
            const speed = PLAYER_BULLET_SPEED;
            const vx = Math.sin(angle) * speed;
            const vy = -Math.cos(angle) * speed;
            playerBullets.push(new PlayerBullet(player.x, player.y - player.radius, vx, vy));
        }
        playerFireCounter = 0;
    }
    
    if (laserCooldownCounter > 0) {
        laserCooldownCounter--;
    }
    if (missileCooldownCounter > 0) {
        missileCooldownCounter--;
    }
}

function handleEnemyDrop() {
    if (Math.random() < HEALTH_DROP_CHANCE) {
        pickups.push(new Pickup(enemy.x, enemy.y, 'health'));
    }
}

function checkCollisions() {
    // 1. Enemy Bullet -> Player Collision
    enemyBullets = enemyBullets.filter(eBullet => {
        // Player hitbox is at the center of the player object
        if (distance(eBullet, player) < eBullet.radius + player.hitboxRadius) { 
            if (!isInvulnerable) { 
                player.health -= 1;
                isInvulnerable = true;
                invulnerabilityTimer = INVULNERABILITY_FRAMES; 
                player.hitEffectTimer = 30; // Show big glow for 30 frames

                Stats.playerHitsTaken++;
                // Particle burst
                for (let i = 0; i < 18; i++) {
                    const angle = (i / 18) * Math.PI * 2;
                    const speed = 8 + Math.random() * 6;
                    effects.push(new Effect(
                        player.x + Math.cos(angle) * 8,
                        player.y + Math.sin(angle) * 8,
                        'rgba(255, 50, 50, 1)',
                        'spark',
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        20 + Math.random() * 10
                    ));
                }
                if (player.health <= 0) {
                    Stats.endTime = Date.now(); 
                    score = Stats.calculateFinalScore(); 
                    gameState = 'gameOver';
                }
            }
            return false;
        }
        return true; 
    });

    // BigOrbs -> Player collision and explosion when reaching player or life end
    bigOrbs = bigOrbs.filter(orb => {
        // If orb touches player tiny hitbox, explode immediately
        if (distance(orb, player) < orb.radius + player.hitboxRadius) {
            orb.explode();
            return false;
        }
        if (orb.life <= 0) {
            orb.explode();
            return false;
        }
        return true;
    });

    // StrikeLines -> Player collision (only when active)
    strikeLines = strikeLines.filter(s => {
        if (s.activeNow && s.active > 0) {
            // check distance from player to line segment
            const d = pointToSegmentDistance(player.x, player.y, s.x1, s.y1, s.x2, s.y2);
            if (d < player.hitboxRadius + 8) {
                if (!isInvulnerable) {
                    player.health -= 1;
                    isInvulnerable = true;
                    invulnerabilityTimer = INVULNERABILITY_FRAMES;
                    player.hitEffectTimer = 30;
                    Stats.playerHitsTaken++;
                }
            }
        }
        // Keep if still telegraphing or active
        return (s.telegraph > 0) || (s.active > 0);
    });

    // Mines -> explode when life <= 0 or touched by player
    mines = mines.filter(m => {
        if (distance(m, player) < m.radius + player.hitboxRadius) {
            m.explode();
            return false;
        }
        if (m.life <= 0) {
            m.explode();
            return false;
        }
        return !m.exploded;
    });

    // LaserArms -> check if active arm hits player
    laserArms = laserArms.filter(la => {
        if (la.activeNow && la.life > 0) {
            if (la.hitsPoint(player.x, player.y)) {
                if (!isInvulnerable) {
                    player.health -= 1;
                    isInvulnerable = true;
                    invulnerabilityTimer = INVULNERABILITY_FRAMES;
                    player.hitEffectTimer = 30;
                    Stats.playerHitsTaken++;
                }
            }
        }
        // Keep if telegraphing or active
        return (la.telegraph > 0) || (la.life > 0);
    });

    // 2. Player Bullet -> Enemy Collision
    playerBullets = playerBullets.filter(pBullet => {
        if (distance(pBullet, enemy) < pBullet.radius + enemy.radius) {
            Stats.bossHits.bullet++; 
            
            enemy.health -= pBullet.damage;
            if (typeof enemy.hitFlash === 'function') enemy.hitFlash();
            handleEnemyDrop(); 
            
            for (let i = 0; i < 3; i++) {
                effects.push(new Effect(pBullet.x, pBullet.y, 'rgba(255, 255, 100, 1)')); 
            }

            if (enemy.health <= 0) {
                Stats.endTime = Date.now(); 
                score = Stats.calculateFinalScore(); 
                gameState = 'win'; 
            }

            return false; 
        }
        return true; 
    });
    
    // 3. Laser -> Enemy Collision
    if (laser && laser.life > 0) {
        if (!laser.hasDealtDamage && 
            enemy.x + enemy.radius > laser.x - laser.width / 2 &&
            enemy.x - enemy.radius < laser.x + laser.width / 2 &&
            enemy.y < player.y) 
        {
            enemy.health -= laser.damage;
            if (typeof enemy.hitFlash === 'function') enemy.hitFlash();
            laser.hasDealtDamage = true; 
            Stats.bossHits.laser++; 
            
            handleEnemyDrop(); 
            
            // Electric shockwaves
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const speed = 12 + Math.random() * 8;
                effects.push(new Effect(
                    enemy.x + Math.cos(angle) * enemy.radius,
                    enemy.y + Math.sin(angle) * enemy.radius,
                    'rgba(0,255,255,0.8)',
                    'spark',
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    24 + Math.random() * 8
                ));
            }
            // Energy ripple
            effects.push(new Effect(
                enemy.x,
                enemy.y,
                'rgba(0,255,255,0.3)',
                'ripple',
                0, 0, 32
            ));

            if (enemy.health <= 0) {
                Stats.endTime = Date.now(); 
                score = Stats.calculateFinalScore(); 
                gameState = 'win';
            }
        }
    }
    
    // 4. Homing Missile -> Enemy Collision
    homingMissiles = homingMissiles.filter(missile => {
        if (distance(missile, enemy) < missile.radius + enemy.radius) {
            enemy.health -= missile.damage;
            if (typeof enemy.hitFlash === 'function') enemy.hitFlash();
            Stats.bossHits.missile++; 
            
            handleEnemyDrop();

            for (let i = 0; i < 15; i++) {
                effects.push(new Effect(missile.x, missile.y, 'rgba(255, 100, 0, 1)'));
            }

            if (enemy.health <= 0) {
                Stats.endTime = Date.now(); 
                score = Stats.calculateFinalScore(); 
                gameState = 'win';
            }
            return false; 
        }
        return true;
    });
    
    // 5. Pickup -> Player Collision
    pickups = pickups.filter(pickup => {
        if (distance(pickup, player) < pickup.radius + player.radius) {
            
            if (pickup.type === 'health') {
                player.health += 1;
                effects.push(new Effect(player.x, player.y - 30, '+1 HP', 'text'));
            } 
            return false; 
        }
        return pickup.life > 0;
    });
}

function cleanupObjects() {
    enemyBullets = enemyBullets.filter(b => 
        b.x > -50 && b.x < GAME_WIDTH + 50 &&
        b.y > -50 && b.y < GAME_HEIGHT + 50
    );
    playerBullets = playerBullets.filter(b => b.y > -b.radius);
    homingMissiles = homingMissiles.filter(m => m.y > -m.radius);
    effects = effects.filter(e => e.life > 0); 

    if (laser && laser.life <= 0) {
        laser = null;
    }
    pickups = pickups.filter(p => p.life > 0 && p.y < GAME_HEIGHT + p.radius); 
    // Cleanup custom arrays
    strikeLines = strikeLines.filter(s => (s.telegraph > 0) || (s.active > 0));
    mines = mines.filter(m => !m.exploded && m.life > -10);
    // LaserArms cleanup and caps
    laserArms = laserArms.filter(l => (l.telegraph > 0) || (l.life > 0));
    // Keep arrays capped
    if (strikeLines.length > 6) strikeLines.splice(0, strikeLines.length - 6);
    if (mines.length > 6) mines.splice(0, mines.length - 6);
    if (laserArms.length > 4) laserArms.splice(0, laserArms.length - 4);
}


// --- 4. DYNAMIC BACKGROUND & AESTHETIC UI ---

let backgroundHue = 0;
function drawBackground() {
    // Subtle in-game retro background optimized for visibility
    backgroundHue = (backgroundHue + 0.03) % 360;

    // Low-contrast vertical gradient (dark -> slightly less dark)
    const g = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    g.addColorStop(0, '#090912');
    g.addColorStop(1, '#0f0f14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Soft nebula / color wash using very low alpha radial gradients to add depth
    if (Math.abs(settings.theme === 'retro')) {
        // subtle cyan-magenta wash near top center
        const neb = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT*0.18, 50, GAME_WIDTH/2, GAME_HEIGHT*0.18, GAME_WIDTH*0.9);
        neb.addColorStop(0, 'rgba(0,200,255,0.04)');
        neb.addColorStop(0.4, 'rgba(200,0,255,0.02)');
        neb.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = neb;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Parallax stars (small, low alpha and limited to background so they don't distract)
    const starLayers = [ {count: 40, speed: 0.02, alpha: 0.12, size:1}, {count: 20, speed: 0.06, alpha:0.08, size:1.6} ];
    const time = Date.now();
    for (let layer of starLayers) {
        ctx.fillStyle = `rgba(255,255,255,${layer.alpha})`;
        for (let i = 0; i < layer.count; i++) {
            const x = (i * (137 + layer.count) + time * layer.speed) % GAME_WIDTH;
            const y = (i * (71 + layer.count) + (time * layer.speed * 0.6)) % GAME_HEIGHT;
            ctx.beginPath();
            ctx.arc(x, y, layer.size, 0, Math.PI*2);
            ctx.fill();
        }
    }

    // (Removed) in-game bottom grid to avoid visual clutter during gameplay

    // Optional subtle scanlines only if enabled in settings but with very low alpha for gameplay
    if (settings.scanlines) {
        ctx.save();
        ctx.globalAlpha = 0.02;
        ctx.fillStyle = '#000';
        for (let y = 0; y < GAME_HEIGHT; y += 4) {
            ctx.fillRect(0, y, GAME_WIDTH, 1);
        }
        ctx.restore();
    }

    // No phase tinting — keep the base retro background (phase 1 look) for all phases to maximize visibility
}

// NEW: Rich retro background for menus / end screens
function drawRetroMenuBackground() {
    // Base gradient
    const g = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    g.addColorStop(0, '#0b1020');
    g.addColorStop(0.35, '#101426');
    g.addColorStop(1, '#0b0712');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Large radial glow in the center-top to highlight title
    const rg = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT*0.22, 50, GAME_WIDTH/2, GAME_HEIGHT*0.22, GAME_WIDTH*0.9);
    rg.addColorStop(0, 'rgba(0,255,200,0.06)');
    rg.addColorStop(0.2, 'rgba(0,200,255,0.03)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Neon grid (horizontal + vertical) with perspective fade
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#00ffd6';
    ctx.lineWidth = 1;
    const gridSpacing = 48;
    for (let x = -GAME_WIDTH; x < GAME_WIDTH*2; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, GAME_HEIGHT*0.55);
        ctx.lineTo(x + GAME_WIDTH*0.2, GAME_HEIGHT);
        ctx.stroke();
    }
    for (let y = GAME_HEIGHT*0.55; y < GAME_HEIGHT; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_WIDTH, y + (y - GAME_HEIGHT*0.55)*0.2);
        ctx.stroke();
    }
    ctx.restore();

    // Subtle stars behind the grid
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 120; i++) {
        const x = (i * 199 + Date.now() / 150) % GAME_WIDTH;
        const y = (i * 113 + Date.now() / 220) % Math.floor(GAME_HEIGHT*0.6);
        ctx.beginPath();
        ctx.arc(x, y, Math.random() < 0.9 ? 1 : 2, 0, Math.PI*2);
        ctx.fill();
    }

    // Scanlines option (thin horizontal lines) to strengthen retro feel
    if (settings.scanlines) {
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#000';
        for (let y = 0; y < GAME_HEIGHT; y += 3) {
            ctx.fillRect(0, y, GAME_WIDTH, 1);
        }
        ctx.restore();
    }

    // Subtle vignette
    ctx.save();
    const vg = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH*0.1, GAME_WIDTH/2, GAME_HEIGHT/2, Math.max(GAME_WIDTH, GAME_HEIGHT));
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.6, 'rgba(0,0,0,0.12)');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.restore();

    // Faint film grain / noise (low cost dots)
    ctx.save();
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 400; i++) {
        const x = Math.random() * GAME_WIDTH;
        const y = Math.random() * GAME_HEIGHT;
        ctx.fillStyle = Math.random() > 0.5 ? 'white' : 'black';
        ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
}

function drawPlayerHealth() {
    const startX = 10;
    const startY = GAME_HEIGHT - 35; 
    const heartSize = 30;
    const heartSpacing = 35;
    
    ctx.font = `${heartSize}px "Press Start 2P", monospace`;
    ctx.textAlign = 'left';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'red';
    ctx.fillStyle = 'red';

    for (let i = 0; i < player.health; i++) {
        ctx.fillText('♥', startX + i * heartSpacing, startY);
    }
    ctx.shadowBlur = 0;
}

function drawHUD() {
    // Score (Top Left)
    ctx.fillStyle = 'gold'; // <--- MODIFIED: Changed color to 'gold'
    ctx.font = '32px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${Math.floor(score)}`, 10, 35); 
    
    // Time (Top Center, prominent yellow)
    if (gameState === 'playing') {
        const currentTime = Stats.totalTimeSeconds;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'yellow';
        ctx.fillStyle = 'yellow';
        ctx.fillText(`TIME: ${formatTime(currentTime)}`, GAME_WIDTH / 2, 35);
        ctx.shadowBlur = 0;
    }

    // Phase (Top Right)
    if (gameState === 'playing') {
        ctx.textAlign = 'right';
    ctx.font = '32px "Press Start 2P", monospace';
        ctx.fillStyle = enemy.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = enemy.color;
        ctx.fillText(`PHASE ${enemy.currentPhase}`, GAME_WIDTH - 10, 35);
        ctx.shadowBlur = 0;
    }

    drawPlayerHealth();
    
    // Cooldowns (Bottom Right)
    ctx.textAlign = 'right';
    
    // Fire Status 
    const fireStatusY = GAME_HEIGHT - 90; 
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = isFiring ? 'lime' : 'grey';
    ctx.shadowBlur = isFiring ? 8 : 0;
    ctx.shadowColor = 'lime';
    ctx.fillText(`FIRE: ${isFiring ? 'AUTO' : 'OFF'} [Y]`, GAME_WIDTH - 10, fireStatusY); 
    ctx.shadowBlur = 0;
    
    const laserStatusY = GAME_HEIGHT - 60;
    const cdTimeL = Math.max(0, laserCooldownCounter / TARGET_FPS).toFixed(1);
    const laserReady = laserCooldownCounter <= 0;
    
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = laserReady ? 'cyan' : 'rgba(0, 150, 150, 0.5)';
    ctx.shadowBlur = laserReady ? 10 : 0;
    ctx.shadowColor = 'cyan';
    ctx.fillText(laserReady ? 'LASER READY [I]' : `LASER CD: ${cdTimeL}s`, GAME_WIDTH - 10, laserStatusY);
    ctx.shadowBlur = 0;
    
    const missileStatusY = GAME_HEIGHT - 30;
    const cdTimeM = Math.max(0, missileCooldownCounter / TARGET_FPS).toFixed(1);
    const missileReady = missileCooldownCounter <= 0;

    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = missileReady ? 'orange' : 'rgba(255, 165, 0, 0.5)';
    ctx.shadowBlur = missileReady ? 10 : 0;
    ctx.shadowColor = 'orange';
    ctx.fillText(missileReady ? 'MISSILE READY [U]' : `MISL CD: ${cdTimeM}s`, GAME_WIDTH - 10, missileStatusY);
    ctx.shadowBlur = 0;
}

function drawBossHealthBar() {
    const barWidth = GAME_WIDTH * 0.8; 
    const barHeight = 20;
    const barX = (GAME_WIDTH - barWidth) / 2;
    const barY = 60;

    const healthPercentage = enemy.health / enemy.maxHealth;
    const currentWidth = barWidth * healthPercentage;

    ctx.fillStyle = 'rgba(50, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    ctx.fillStyle = enemy.color; 
    ctx.fillRect(barX, barY, currentWidth, barHeight);

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    const phase2_pos = barX + barWidth * (1 - PHASE_TWO_HP / BOSS_MAX_HEALTH);
    const phase3_pos = barX + barWidth * (1 - PHASE_THREE_HP / BOSS_MAX_HEALTH);
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.moveTo(phase2_pos, barY);
    ctx.lineTo(phase2_pos, barY + barHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(phase3_pos, barY);
    ctx.lineTo(phase3_pos, barY + barHeight);
    ctx.stroke();

    // Draw the label and HP text INSIDE the health bar, centered vertically
    const innerText = `SPHERE ${Math.floor(enemy.health / SCALE_FACTOR)} / ${enemy.maxHealth / SCALE_FACTOR}`;
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textX = GAME_WIDTH / 2;
    const textY = barY + barHeight / 2;
    // Draw outlined text so it remains visible regardless of bar fill color
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.fillStyle = 'white';
    ctx.strokeText(innerText, textX, textY);
    ctx.fillText(innerText, textX, textY);
    ctx.restore();
}

function drawStatsGraph(result) {
    const boxW = 800;
    const boxH = 500;
    const boxX = GAME_WIDTH / 2 - boxW / 2; 
    const boxY = GAME_HEIGHT / 2 - 150; // Shifted up to make room for the new button
    
    const borderColor = result === 'WIN' ? 'lime' : 'red';

    ctx.fillStyle = 'rgba(5, 5, 20, 0.95)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 5;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    
    let currentY = boxY + 50;
    const indent = boxX + 40;
    const valueIndent = boxX + 500;

    // Title
    ctx.font = '42px "Press Start 2P", monospace';
    ctx.fillStyle = borderColor;
    ctx.textAlign = 'left';
    ctx.fillText(` MISSION REPORT [${result}] `, indent, currentY);
    currentY += 70;

    ctx.font = '20px "Press Start 2P", monospace';
    
    // Time Taken
    ctx.fillStyle = 'white';
    ctx.fillText(`TIME ELAPSED:`, indent, currentY);
    ctx.fillStyle = 'yellow';
    ctx.fillText(`${formatTime(Stats.totalTimeSeconds)}`, valueIndent, currentY);
    currentY += 40;
    
    // Hits Taken and Penalty
    const hitPenalty = Stats.playerHitsTaken * SCORE_HIT_PENALTY;
    ctx.fillStyle = 'white';
    ctx.fillText(`PLAYER HITS:`, indent, currentY);
    ctx.fillStyle = Stats.playerHitsTaken > 0 ? 'red' : 'lime';
    ctx.fillText(`${Stats.playerHitsTaken} HIT(S) | (${hitPenalty})`, valueIndent, currentY); 
    currentY += 40;

    // Boss Hits Breakdown
    const bulletScore = Stats.bossHits.bullet * BASE_SCORE_BULLET;
    const missileScore = Stats.bossHits.missile * BASE_SCORE_MISSLE;
    const laserScore = Stats.bossHits.laser * BASE_SCORE_LASER;

    // Bullet Hits
    ctx.fillStyle = 'cyan';
    ctx.fillText(`BULLET HITS:`, indent, currentY);
    ctx.fillStyle = 'white';
    ctx.fillText(`${Stats.bossHits.bullet} HIT(S) | +${bulletScore}`, valueIndent, currentY); 
    currentY += 35;
    
    // Missile Hits
    ctx.fillStyle = 'orange';
    ctx.fillText(`MISSILE HITS:`, indent, currentY);
    ctx.fillStyle = 'white';
    ctx.fillText(`${Stats.bossHits.missile} HIT(S) | +${missileScore}`, valueIndent, currentY); 
    currentY += 35;
    
    // Laser Hits
    ctx.fillStyle = 'magenta';
    ctx.fillText(`LASER HITS:`, indent, currentY);
    ctx.fillStyle = 'white';
    ctx.fillText(`${Stats.bossHits.laser} HIT(S) | +${laserScore}`, valueIndent, currentY); 
    currentY += 50;
    
    // Time Bonus Display Logic (Only for Win Screen)
    if (result === 'WIN') {
        const secondsElapsed = Math.floor(Stats.totalTimeSeconds);
        const bonusLost = secondsElapsed * TIME_BONUS_DECREMENT_PER_SECOND;
        const timeBonus = Math.max(0, TIME_BONUS_START - bonusLost);
        const defeatBonus = SCORE_DEFEAT_BONUS;

    ctx.font = '32px "Press Start 2P", monospace';
        ctx.fillStyle = 'gold';
        ctx.fillText(`TIME BONUS:`, indent, currentY);
        ctx.fillText(`+ ${timeBonus}`, valueIndent, currentY);
        currentY += 40;

        ctx.fillStyle = 'lime';
        ctx.fillText(`BOSS DEFEAT BONUS:`, indent, currentY);
        ctx.fillText(`+ ${defeatBonus}`, valueIndent, currentY);
        currentY += 60;
    }


    // FINAL SCORE 
    ctx.font = '50px "Press Start 2P", monospace';
    ctx.fillStyle = 'lime';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'lime';
    ctx.fillText(`TOTAL SCORE: ${Math.floor(score)}`, GAME_WIDTH / 2, boxY + boxH - 20);
    ctx.shadowBlur = 0;
}

// NEW: Helper function to draw a standardized retro button
function drawRetroButton(text, x, y, width, height, color, glow) {
    // Determine hover state by comparing the global keys set by the draw caller and by mousemove
    const isHovered = (currentDrawButtonKey && hoveredButtonKey && currentDrawButtonKey === hoveredButtonKey);

    // Apply a stronger glow and border when hovered
    const appliedGlow = isHovered ? Math.max(glow * 1.6, glow + 10) : glow;
    const strokeW = isHovered ? 6 : 4;
    const scale = isHovered ? 1.03 : 1.0; // slight scale up when hovered

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const drawW = width * scale;
    const drawH = height * scale;
    const drawX = centerX - drawW / 2;
    const drawY = centerY - drawH / 2;

    // Outer shadow/glow
    ctx.shadowBlur = appliedGlow;
    ctx.shadowColor = color;

    // Button border
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeW;
    ctx.strokeRect(drawX, drawY, drawW, drawH);

    // Button fill (dark, semi-transparent). If hovered, tint the fill slightly lighter
    if (isHovered) {
        ctx.fillStyle = `rgba(10, 10, 10, 0.65)`;
    } else {
        ctx.fillStyle = `rgba(0, 0, 0, 0.5)`;
    }
    ctx.fillRect(drawX, drawY, drawW, drawH);

    // Button text
    ctx.fillStyle = color;
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    // Center text vertically in button
    ctx.textBaseline = 'middle';
    ctx.fillText(text, drawX + drawW / 2, drawY + drawH / 2);

    ctx.shadowBlur = 0; // Reset shadow for other drawings
}

// REPLACED: Updated drawMenu to handle main/howToPlay states
function drawMenu() {
    // Use the retro-styled background for the menu
    drawRetroMenuBackground();

    // CHANGE 1: Title: VECTOR BULLET PROJECT
    ctx.font = '72px "Press Start 2P", monospace';
    ctx.fillStyle = 'cyan';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'cyan';
    ctx.fillText('VECTOR BULLET PROJECT', GAME_WIDTH / 2, GAME_HEIGHT / 4 - 30);
    ctx.fillText('V.01', GAME_WIDTH / 2, GAME_HEIGHT / 4 + 50);
    ctx.shadowBlur = 0;
    
    if (menuState === 'main') {
        const buttonW = 400;
        const buttonH = 80;
        const startY = GAME_HEIGHT / 2 + 50;
        const centerX = GAME_WIDTH / 2 - buttonW / 2;

    // START GAME Button
    const startX = centerX;
    const startY_btn = startY;
    currentDrawButtonKey = 'start';
    drawRetroButton('START GAME', startX, startY_btn, buttonW, buttonH, 'lime', 20);
    currentDrawButtonKey = null;

    // HOW TO PLAY Button
    const controlsY_btn = startY_btn + buttonH + 40;
    currentDrawButtonKey = 'howToPlay';
    drawRetroButton('HOW TO PLAY', startX, controlsY_btn, buttonW, buttonH, 'yellow', 20);
    currentDrawButtonKey = null;

        // Save button coordinates for click detection
        menuButtons = {
            'start': { x: startX, y: startY_btn, w: buttonW, h: buttonH },
            'howToPlay': { x: startX, y: controlsY_btn, w: buttonW, h: buttonH }
        };

    } else if (menuState === 'levelSelect') {
        // Level Select Menu (no 'SELECT LEVEL' text)
        const buttonW = 400;
        const buttonH = 80;
        const levelY = GAME_HEIGHT / 2;
        const levelX = GAME_WIDTH / 2 - buttonW / 2;
    currentDrawButtonKey = 'level1';
    drawRetroButton('LEVEL 1: THE SPHERE', levelX, levelY, buttonW, buttonH, 'cyan', 20);
    currentDrawButtonKey = null;
        menuButtons = {
            'level1': { x: levelX, y: levelY, w: buttonW, h: buttonH }
        };

        // Back button
        const backW = 200;
        const backH = 50;
        const backX = GAME_WIDTH / 2 - backW / 2;
        const backY = levelY + buttonH + 40;
    currentDrawButtonKey = 'back';
    drawRetroButton('BACK', backX, backY, backW, backH, 'red', 15);
    currentDrawButtonKey = null;
        menuButtons.back = { x: backX, y: backY, w: backW, h: backH };

    } else if (menuState === 'howToPlay') {
        const infoW = 1200;
        const infoH = 800;
        const infoX = GAME_WIDTH / 2 - infoW / 2;
        const infoY = GAME_HEIGHT / 2 - 300;
        const padding = 50;
        let textY = infoY + 50;

        // Draw Info Box
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'magenta';
        ctx.strokeStyle = 'magenta';
        ctx.lineWidth = 5;
        ctx.strokeRect(infoX, infoY, infoW, infoH);
        ctx.fillStyle = 'rgba(20, 0, 20, 0.8)';
        ctx.fillRect(infoX, infoY, infoW, infoH);
        ctx.shadowBlur = 0;
        
        ctx.textAlign = 'left';
        
    ctx.font = '32px "Press Start 2P", monospace';
        ctx.fillStyle = 'magenta';
        ctx.fillText('// OBJECTIVE: ELIMINATE THE CORE //', infoX + padding, textY);
        textY += 60;
        
    ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillStyle = 'white';
        ctx.fillText('The boss has 3 phases of increasing difficulty (300 HP total).', infoX + padding, textY);
        textY += 60;

    ctx.font = '32px "Press Start 2P", monospace';
        ctx.fillStyle = 'cyan';
        ctx.fillText('// CONTROLS //', infoX + padding, textY);
        textY += 50;

    ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = 'yellow';
        ctx.fillText('> WASD: Movement (Dodge bullets, collect hearts)', infoX + padding, textY);
        textY += 35;
        ctx.fillStyle = 'white';
        ctx.fillText('> Y: Toggle Auto-Fire (Your standard weapon)', infoX + padding, textY);
        textY += 35;
        ctx.fillStyle = 'cyan';
        ctx.fillText('> I: LASER BEAM (High damage, long cooldown)', infoX + padding, textY);
        textY += 35;
        ctx.fillStyle = 'orange';
        ctx.fillText('> U: HOMING MISSILES (Homing burst, medium cooldown)', infoX + padding, textY);
        textY += 35;
        ctx.fillStyle = 'lime';
        ctx.fillText('> P: Pause/Resume', infoX + padding, textY);
        textY += 25;

        // Draw BACK button
        const buttonW = 200;
        const buttonH = 50;
        const backX = GAME_WIDTH / 2 - buttonW / 2;
        const backY = infoY + infoH + 50;
    currentDrawButtonKey = 'back';
    drawRetroButton('BACK', backX, backY, buttonW, buttonH, 'red', 15);
    currentDrawButtonKey = null;
        // Store button for click detection
        menuButtons.back = { x: backX, y: backY, w: buttonW, h: buttonH };
    }
    // ...existing code...
}


function drawGameOver() {
    // Rich retro background on game over screen
    drawRetroMenuBackground();

    // Large Pulsing "Terminated" Text
    const redPulse = 0.5 + 0.5 * Math.sin(Date.now() / 150); 
    ctx.font = '80px "Press Start 2P", monospace';
    ctx.fillStyle = `rgba(255, 0, 0, ${redPulse})`;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'red';
    ctx.fillText('TERMINATED', GAME_WIDTH / 2, GAME_HEIGHT / 4 - 30);
    ctx.shadowBlur = 0;

    drawStatsGraph('LOSS');

    // <--- MODIFIED: Added RETRY button and changed button layout --->
    const buttonW = 250;
    const buttonH = 60;
    const spacing = 40;
    const totalWidth = (buttonW * 2) + spacing;
    const startX = GAME_WIDTH / 2 - totalWidth / 2;
    const buttonY = GAME_HEIGHT - 100;
    
    // RETRY Button (Cyan color)
    const retryX = startX;
    currentDrawButtonKey = 'retry';
    drawRetroButton('RETRY [SPACE]', retryX, buttonY, buttonW, buttonH, 'cyan', 15);
    currentDrawButtonKey = null;
    menuButtons.retry = { x: retryX, y: buttonY, w: buttonW, h: buttonH, action: 'retry' };

    // Back to Menu Button (Red color)
    const menuX = startX + buttonW + spacing;
    // Make BACK TO MENU wider to fit text
    const menuButtonW = 320;
    currentDrawButtonKey = 'menu';
    drawRetroButton('BACK TO MENU', menuX, buttonY, menuButtonW, buttonH, 'red', 15);
    currentDrawButtonKey = null;
    menuButtons.menu = { x: menuX, y: buttonY, w: menuButtonW, h: buttonH, action: 'menu' };
}

function drawWinScreen() {
    // Rich retro background on victory screen
    drawRetroMenuBackground();

    // Large Gold "Boss Defeated" Text
    ctx.font = '72px "Press Start 2P", monospace';
    ctx.fillStyle = 'gold';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 35;
    ctx.shadowColor = 'gold';
    ctx.fillText('BOSS DEFEATED!', GAME_WIDTH / 2, GAME_HEIGHT / 4 - 30);
    ctx.shadowBlur = 0;

    drawStatsGraph('WIN');

    // <--- MODIFIED: Added RETRY button and changed button layout --->
    const buttonW = 250;
    const buttonH = 60;
    const spacing = 40;
    const totalWidth = (buttonW * 2) + spacing;
    const startX = GAME_WIDTH / 2 - totalWidth / 2;
    const buttonY = GAME_HEIGHT - 100;
    
    // RETRY Button (Cyan color)
    const retryX = startX;
    currentDrawButtonKey = 'retry';
    drawRetroButton('RETRY [SPACE]', retryX, buttonY, buttonW, buttonH, 'cyan', 15);
    currentDrawButtonKey = null;
    menuButtons.retry = { x: retryX, y: buttonY, w: buttonW, h: buttonH, action: 'retry' };

    // Back to Menu Button (Lime color)
    const menuX = startX + buttonW + spacing;
    // Make BACK TO MENU wider to fit text
    const menuButtonW = 320;
    currentDrawButtonKey = 'menu';
    drawRetroButton('BACK TO MENU', menuX, buttonY, menuButtonW, buttonH, 'lime', 15);
    currentDrawButtonKey = null;
    menuButtons.menu = { x: menuX, y: buttonY, w: menuButtonW, h: buttonH, action: 'menu' };
}

// NEW: Overlay for pause menu
function drawPauseMenu() {
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#222';
    ctx.fillRect(GAME_WIDTH/2-400, GAME_HEIGHT/2-200, 800, 400);
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 8;
    ctx.strokeRect(GAME_WIDTH/2-400, GAME_HEIGHT/2-200, 800, 400);
    ctx.font = '64px "Press Start 2P", monospace';
    ctx.fillStyle = 'cyan';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', GAME_WIDTH/2, GAME_HEIGHT/2-40);
    ctx.font = '32px "Press Start 2P", monospace';
    ctx.fillStyle = 'yellow';
    ctx.fillText('Press P or ESC to resume', GAME_WIDTH/2, GAME_HEIGHT/2+80);
    // Draw BACK TO MENU button
    const buttonW = 320;
    const buttonH = 70;
    const buttonX = GAME_WIDTH/2 - buttonW/2;
    const buttonY = GAME_HEIGHT/2 + 120;
    currentDrawButtonKey = 'pauseBack';
    drawRetroButton('BACK TO MENU', buttonX, buttonY, buttonW, buttonH, 'red', 15);
    currentDrawButtonKey = null;
    // Store button for click detection
    menuButtons.pauseBack = { x: buttonX, y: buttonY, w: buttonW, h: buttonH };
    ctx.restore();
}

// --- 5. MAIN GAME LOOP ---
function gameLoop(currentTime) {
    if (!lastTime) {
        lastTime = currentTime;
    }
    accruedTime += currentTime - lastTime;
    lastTime = currentTime;
    if (accruedTime > 1000) {
        accruedTime = TIME_PER_TICK;
    }
    tick = 0;
    if (!isPaused) {
        while (accruedTime >= TIME_PER_TICK) {
            if (gameState === 'playing') {
                totalFrames++;
                player.update();
                enemy.update();
                handlePlayerFire();
                enemyBullets.forEach(b => b.update());
                playerBullets.forEach(b => b.update());
                strikeLines.forEach(s => s.update());
                mines.forEach(m => m.update());
                laserArms.forEach(l => l.update());
                homingMissiles.forEach(m => m.update());
                pickups.forEach(p => p.update());
                effects.forEach(e => e.update());
                if (laser) laser.update();
                checkCollisions();
                cleanupObjects();
            }
            accruedTime -= TIME_PER_TICK;
            tick++;
            if (tick > 5) break;
        }
        // Update score live during gameplay
        if (gameState === 'playing') {
            score = Stats.calculateFinalScore();
        }
    }
    // --- Drawing Logic ---
    drawBackground();
        if (gameState === 'menu') {
        drawMenu();
    } else if (gameState === 'playing') {
        if (laser) laser.draw();
        player.draw();
        enemy.draw();
            strikeLines.forEach(s => s.draw());
            mines.forEach(m => m.draw());
            laserArms.forEach(l => l.draw());
        enemyBullets.forEach(b => b.draw());
        playerBullets.forEach(b => b.draw());
        homingMissiles.forEach(m => m.draw());
        pickups.forEach(p => p.draw());
        effects.forEach(e => e.draw());
        drawBossHealthBar();
        drawHUD();
        if (isPaused) drawPauseMenu();
    } else if (gameState === 'gameOver') {
        drawGameOver();
    } else if (gameState === 'win') {
        drawWinScreen();
    }
    requestAnimationFrame(gameLoop);
}

// --- 6. INPUT EVENT LISTENERS ---
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'p') {
        isPaused = !isPaused;
    }
    // ...existing code...
});
// Add Escape key to toggle pause as well
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
        isPaused = !isPaused;
        // Prevent default behavior when in a page
        e.preventDefault();
    }
});
document.addEventListener('keydown', (e) => {
    if (isPaused) return;
    const key = e.key.toLowerCase();
    if (key === 's') settings.sound = !settings.sound;
    if (key === 'l') settings.scanlines = !settings.scanlines;
    if (key === 't') settings.theme = (settings.theme === 'retro' ? 'dark' : 'retro');
});

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    const key = e.key.toLowerCase();
    
    // NEW: Spacebar to retry from game over/win screen
    if ((gameState === 'gameOver' || gameState === 'win') && key === ' ') {
        e.preventDefault(); // Prevent space from scrolling the page
        initializeGame();
        gameState = 'playing';
    }
    
    if (gameState !== 'playing') return;

    if (key === 'y') {
        isFiring = !isFiring;
    }
    
    if (key === 'i' && laserCooldownCounter <= 0 && !laser) {
        laser = new PlayerLaser(player.x);
        laserCooldownCounter = LASER_COOLDOWN_FRAMES; 
    }
    
    if (key === 'u' && missileCooldownCounter <= 0) {
        const numMissiles = 6;
        const totalSpread = 40; 
        const startX = player.x - totalSpread / 2;
        const spacing = totalSpread / (numMissiles - 1); 
        const launchY = player.y - 10;
        
        for (let i = 0; i < numMissiles; i++) {
            homingMissiles.push(new HomingMissile(startX + i * spacing, launchY, enemy));
        }
        
        missileCooldownCounter = MISSILE_COOLDOWN_FRAMES; 
        Stats.missilesFired += numMissiles; 
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// MODIFIED: Updated click handler to detect all menu buttons
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    // Calculate click coordinates relative to the canvas
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Helper function to check if click is within a button area
    const isClicked = (button) => {
        return (clickX > button.x && clickX < button.x + button.w &&
                clickY > button.y && clickY < button.y + button.h);
    };

    if (gameState === 'menu') {
        if (menuState === 'main') {
            if (isClicked(menuButtons.start)) {
                // Go to level select menu
                menuState = 'levelSelect';
            } else if (isClicked(menuButtons.howToPlay)) {
                // HOW TO PLAY clicked
                menuState = 'howToPlay';
            }
        } else if (menuState === 'levelSelect') {
            if (isClicked(menuButtons.level1)) {
                // Start Level 1 (Boss 1)
                selectedLevel = 1;
                initializeGame();
                gameState = 'playing';
            } else if (isClicked(menuButtons.back)) {
                menuState = 'main';
            }
        } else if (menuState === 'howToPlay') {
            if (isClicked(menuButtons.back)) {
                menuState = 'main';
            }
        }
    } else if (gameState === 'gameOver' || gameState === 'win') {
        // Handle BACK TO MENU button on end screens
        if (isClicked(menuButtons.menu)) {
            gameState = 'menu';
            menuState = 'main';
        }
        // Handle RETRY button on end screens <--- MODIFIED
        if (isClicked(menuButtons.retry)) {
            initializeGame(); 
            gameState = 'playing';
        }
    } else if (gameState === 'playing' && isPaused) {
        if (isClicked(menuButtons.pauseBack)) {
            isPaused = false;
            gameState = 'menu';
            menuState = 'main';
        }
    }
});

// Mousemove handler to set hovered button key for hover effects
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let found = null;
    for (const key in menuButtons) {
        const b = menuButtons[key];
        if (!b) continue;
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
            found = key;
            break;
        }
    }
    hoveredButtonKey = found;
});

canvas.addEventListener('mouseleave', () => {
    hoveredButtonKey = null;
});

// Start the game by passing the first timestamp
gameLoop(0);