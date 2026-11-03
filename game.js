// COLUMNS 1997 - Main Game Engine

// Game States
const STATES = {
    TITLE_SCREEN: 'TITLE_SCREEN',
    START_SCREEN: 'START_SCREEN',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    MATCHING: 'MATCHING',
    GRAVITY: 'GRAVITY',
    GAME_OVER: 'GAME_OVER'
};

// Config Constants
const COLS = 6;
const ROWS = 13;
const CELL_SIZE = 50;
const BOARD_WIDTH = COLS * CELL_SIZE;   // 300px
const BOARD_HEIGHT = ROWS * CELL_SIZE; // 650px

// Color schemes matching gem types (1-6)
const GEM_COLORS = {
    1: '#ff0044', // 1: Red Ruby (Circle)
    2: '#ff6600', // 2: Orange Amber (Hexagon)
    3: '#ffcc00', // 3: Yellow Topaz (Triangle Up)
    4: '#00cc44', // 4: Green Emerald (Square)
    5: '#0066ff', // 5: Blue Sapphire (Diamond)
    6: '#aa00ff'  // 6: Purple Amethyst (Triangle Down)
};

const GEM_GLOWS = {
    1: 'rgba(255, 0, 68, 0.8)',
    2: 'rgba(255, 102, 0, 0.8)',
    3: 'rgba(255, 204, 0, 0.8)',
    4: 'rgba(0, 204, 68, 0.8)',
    5: 'rgba(0, 102, 255, 0.8)',
    6: 'rgba(170, 0, 255, 0.8)'
};

// Game Variables
let canvas, ctx;
let nextCanvas, nextCtx;
let particleSystem;

let grid = [];
let gameState = STATES.TITLE_SCREEN;
let score = 0;
let highScore = 0;
let level = 1;
let clears = 0;
let comboCount = 0;

let activeCol = 2;
let activeRow = 0.0;
let activeGems = [1, 2, 3];
let isMagicColumn = false;

let nextGems = [4, 5, 6];
let nextIsMagic = false;

let fallSpeed = 1.0; // grid cells per second
let lastTime = 0;
let lockTimer = 0;
const LOCK_DELAY = 500; // ms
let lockResets = 0;
const MAX_LOCK_RESETS = 3;

// Animations & Timing
let matchedCells = []; // Array of {r, c, type}
let matchFlashTimer = 0;
const MATCH_FLASH_DURATION = 400; // ms
let gravityCollapseTimer = 0;
const GRAVITY_COLLAPSE_DURATION = 250; // ms
let magicFlashTimer = 0; // screen white flash when magic column lands

// Magic flashing color cycle (for rendering magic gem type 7)
let magicCycleColor = 1;

// Retro checkered square backgrounds
const RETRO_BACKGROUNDS = [
    { name: 'Classic Blue/Teal', color1: '#0a2550', color2: '#053b3d' },  // Level 1
    { name: 'Sunset Wine/Pink', color1: '#3d0a25', color2: '#5c0f3a' },   // Level 2
    { name: 'Forest Olive', color1: '#1a330e', color2: '#2c5417' },       // Level 3
    { name: 'Bronze Chocolate', color1: '#3c240a', color2: '#5e380f' },   // Level 4
    { name: 'Royal Indigo/Purple', color1: '#250a50', color2: '#3b107e' },// Level 5
    { name: 'Deep Aqua/Cyan', color1: '#0d373a', color2: '#16575c' },     // Level 6
    { name: 'Crimson Rust', color1: '#3a0d0d', color2: '#5c1616' },       // Level 7
    { name: 'Charcoal Noir', color1: '#111111', color2: '#222222' }       // Level 8+
];

function updateBackgroundColors() {
    const bg = RETRO_BACKGROUNDS[(level - 1) % RETRO_BACKGROUNDS.length];
    document.body.style.setProperty('--tile-color-1', bg.color1);
    document.body.style.setProperty('--tile-color-2', bg.color2);
}

// Programmatic Magic-Wand Transparency Keyer
function keyOutBackgroundFloodFill(imgUrl, targetColor = [255, 255, 255], tolerance = 20) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            const width = canvas.width;
            const height = canvas.height;
            
            const visited = new Uint8Array(width * height);
            const queue = [];
            
            const addPoint = (x, y) => {
                if (x < 0 || x >= width || y < 0 || y >= height) return;
                const idx = y * width + x;
                if (!visited[idx]) {
                    visited[idx] = 1;
                    const pIdx = idx * 4;
                    const r = data[pIdx];
                    const g = data[pIdx+1];
                    const b = data[pIdx+2];
                    
                    if (Math.abs(r - targetColor[0]) <= tolerance &&
                        Math.abs(g - targetColor[1]) <= tolerance &&
                        Math.abs(b - targetColor[2]) <= tolerance) {
                        data[pIdx+3] = 0; // Transparent
                        queue.push(x, y);
                    }
                }
            };
            
            // Seed borders
            for (let x = 0; x < width; x++) {
                addPoint(x, 0);
                addPoint(x, height - 1);
            }
            for (let y = 0; y < height; y++) {
                addPoint(0, y);
                addPoint(width - 1, y);
            }
            
            let head = 0;
            while (head < queue.length) {
                const cx = queue[head++];
                const cy = queue[head++];
                
                addPoint(cx + 1, cy);
                addPoint(cx - 1, cy);
                addPoint(cx, cy + 1);
                addPoint(cx, cy - 1);
            }
            
            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL());
        };
        img.src = imgUrl;
    });
}

// Mobile touch swipe and tap control handler
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;
const SWIPE_THRESHOLD = 30; // pixels to trigger left/right move
const SWIPE_DOWN_THRESHOLD = 50; // pixels to trigger hard drop

function setupTouchControls() {
    const boardScreen = document.querySelector('.board-screen');
    if (!boardScreen) return;

    boardScreen.addEventListener('touchstart', (e) => {
        if (gameState !== STATES.PLAYING) return;
        
        // Let overlay buttons function normally
        if (e.target.tagName === 'BUTTON') return;
        
        e.preventDefault(); 
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchMoved = false;
    }, { passive: false });

    boardScreen.addEventListener('touchmove', (e) => {
        if (gameState !== STATES.PLAYING) return;
        e.preventDefault();

        const touch = e.touches[0];
        const diffX = touch.clientX - touchStartX;
        const diffY = touch.clientY - touchStartY;

        // Swipe Left / Right to Move
        if (Math.abs(diffX) > SWIPE_THRESHOLD) {
            touchMoved = true;
            if (diffX > 0) {
                moveRight();
            } else {
                moveLeft();
            }
            touchStartX = touch.clientX; // reset to allow continuous dragging
        }

        // Swipe Down to Drop
        if (diffY > SWIPE_DOWN_THRESHOLD) {
            touchMoved = true;
            hardDrop();
            touchStartY = touch.clientY; // reset
        }
    }, { passive: false });

    boardScreen.addEventListener('touchend', (e) => {
        if (gameState !== STATES.PLAYING) return;
        e.preventDefault();

        if (!touchMoved) {
            // Simple tap -> Cycle gems
            cycleGems();
        }
    }, { passive: false });
}

function detectMobile() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 850;
    if (isMobile) {
        // Change the controls guide text to show touch commands
        const guide = document.querySelector('.controls-guide');
        if (guide) {
            guide.innerHTML = `
                <h3>TOUCH CONTROLS</h3>
                <ul>
                    <li><span>Swipe ◄ ►</span> Move</li>
                    <li><span>Tap Screen</span> Cycle</li>
                    <li><span>Swipe ▼</span> Drop</li>
                </ul>
            `;
        }
        
        // Update overlay descriptions to mention touch
        const startDesc = document.querySelector('#start-screen .desc');
        if (startDesc) {
            startDesc.innerText = "Swipe left/right to move, tap screen to cycle gem order, and swipe down to drop.";
        }
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    nextCanvas = document.getElementById('next-canvas');
    nextCtx = nextCanvas.getContext('2d');

    // Load High Score
    const savedHighScore = localStorage.getItem('columns_high_score');
    if (savedHighScore) {
        highScore = parseInt(savedHighScore, 10);
        updateDisplay();
    }

    // Particle System
    particleSystem = new window.ParticleSystem();

    // Event Listeners
    setupInput();
    setupUI();

    // Key out the background of columns_angel_sprite.png programmatically
    keyOutBackgroundFloodFill('columns_angel_sprite.png').then((transparentDataUrl) => {
        const leftAngel = document.getElementById('title-angel-left');
        const rightAngel = document.getElementById('title-angel-right');
        if (leftAngel) {
            leftAngel.src = transparentDataUrl;
            leftAngel.classList.add('loaded');
        }
        if (rightAngel) {
            rightAngel.src = transparentDataUrl;
            rightAngel.classList.add('loaded');
        }
    });

    // Detect mobile and configure touch
    detectMobile();
    setupTouchControls();

    // Register Service Worker for offline play with update detection
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js?v=1997')
            .then((registration) => {
                console.log('Service Worker Registered');
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                console.log('New Service Worker activated, reloading page...');
                                window.location.reload();
                            }
                        });
                    }
                });
            })
            .catch((err) => console.log('Service Worker Registration Failed', err));

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('Service Worker controller changed, reloading page...');
            window.location.reload();
        });
    }

    // Disable double-tap to zoom and pinch-to-zoom on iOS Safari
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    // Reset grid
    resetGrid();

    // Start Game Loop
    requestAnimationFrame(gameLoop);
});

function resetGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
        grid.push(new Array(COLS).fill(0));
    }
}

function startGame() {
    resetGrid();
    score = 0;
    level = 1;
    clears = 0;
    comboCount = 0;
    activeCol = 2;
    activeRow = 0.0;
    
    // Seed gems
    nextIsMagic = false;
    nextGems = getRandomColumn();
    spawnColumn();

    // Reset speed
    updateSpeed();
    
    // Reset background to level 1
    updateBackgroundColors();
    
    gameState = STATES.PLAYING;
    updateDisplay();
    
    // Hide screens
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-over-screen').classList.remove('active');
    document.getElementById('pause-screen').classList.remove('active');

    // Play move sound as start indicator
    window.gameAudio.playMove();
}

function getRandomColumn() {
    return [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
    ];
}

function spawnColumn() {
    activeCol = 2;
    activeRow = 0.0;
    lockTimer = 0;
    lockResets = 0;
    
    activeGems = [...nextGems];
    isMagicColumn = nextIsMagic;

    // Determine if next column is a Magic Column (3% chance)
    nextIsMagic = Math.random() < 0.035;
    if (nextIsMagic) {
        nextGems = [7, 7, 7]; // 7 represents magic flashing gem
    } else {
        nextGems = getRandomColumn();
    }

    drawNextPreview();

    // If spawned on top of an existing block, immediate game over!
    if (grid[0][activeCol] !== 0) {
        triggerGameOver();
    }
}

function updateSpeed() {
    // Mimics Sega Genesis: speed increases as level increases
    fallSpeed = 1.0 + (level - 1) * 0.35;
}

function triggerGameOver() {
    gameState = STATES.GAME_OVER;
    window.gameAudio.playGameOver();
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('columns_high_score', highScore);
    }

    document.getElementById('final-score-display').innerText = padZero(score, 6);
    document.getElementById('game-over-screen').classList.add('active');
    updateDisplay();
}

// Input Handling
function setupInput() {
    window.addEventListener('keydown', (e) => {
        // Prevent default keyboard scrolling for game keys
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'Shift'].includes(e.key)) {
            e.preventDefault();
        }

        if (gameState !== STATES.PLAYING) {
            // Handle starting game on Enter from Title or Start overlays
            if (e.key === 'Enter') {
                if (gameState === STATES.TITLE_SCREEN) startFromTitleScreen();
                else if (gameState === STATES.START_SCREEN) startGame();
                else if (gameState === STATES.GAME_OVER) startGame();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                moveLeft();
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                moveRight();
                break;
            case 'ArrowUp':
            case 'w':
            case 'W':
            case ' ':
                cycleGems();
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                // Soft Drop is handled by accelerating activeRow in loop
                break;
            case 'Enter':
            case 'Shift':
                hardDrop();
                break;
            case 'p':
            case 'P':
                togglePause();
                break;
        }
    });
}

function setupUI() {
    // Title Overlay Start Handlers (touch/click)
    const titleOverlay = document.getElementById('title-screen-overlay');
    if (titleOverlay) {
        const handleTitleStart = (e) => {
            if (gameState === STATES.TITLE_SCREEN) {
                e.preventDefault();
                startFromTitleScreen();
            }
        };
        titleOverlay.addEventListener('click', handleTitleStart);
        titleOverlay.addEventListener('touchstart', handleTitleStart, { passive: false });
    }

    // Buttons
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    document.getElementById('resume-btn').addEventListener('click', togglePause);

    const sidebarPauseBtn = document.getElementById('pause-btn-sidebar');
    if (sidebarPauseBtn) {
        sidebarPauseBtn.addEventListener('click', togglePause);
    }

    // Audio Toggles
    const musicBtn = document.getElementById('music-btn');
    const sfxBtn = document.getElementById('sfx-btn');

    musicBtn.addEventListener('click', () => {
        const isPlaying = window.gameAudio.toggleMusic();
        if (isPlaying) {
            musicBtn.classList.remove('muted');
            document.getElementById('music-status').innerText = 'ON';
        } else {
            musicBtn.classList.add('muted');
            document.getElementById('music-status').innerText = 'OFF';
        }
    });

    sfxBtn.addEventListener('click', () => {
        const isMuted = window.gameAudio.toggleMute();
        if (isMuted) {
            sfxBtn.classList.add('muted');
            document.getElementById('sfx-status').innerText = 'OFF';
        } else {
            sfxBtn.classList.remove('muted');
            document.getElementById('sfx-status').innerText = 'ON';
        }
    });

    // Mobile controls with robust touch and mouse support
    const setupVirtualBtn = (id, action) => {
        const btn = document.getElementById(id);
        if (btn) {
            const handler = (e) => {
                e.preventDefault();
                if (gameState === STATES.PLAYING) action();
            };
            // Listen to both touch and mouse click starts
            btn.addEventListener('touchstart', handler, { passive: false });
            btn.addEventListener('mousedown', handler);
            // Explicitly block release events to stop browser zoom/magnification gestures
            btn.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
            btn.addEventListener('mouseup', (e) => e.preventDefault());
        }
    };

    setupVirtualBtn('btn-left', moveLeft);
    setupVirtualBtn('btn-right', moveRight);
    setupVirtualBtn('btn-cycle', cycleGems);
    setupVirtualBtn('btn-down', hardDrop);
}

function startFromTitleScreen() {
    // 1. Play startup chime sound
    window.gameAudio.playStartChime();
    
    // 2. Animate title screen fade out
    const titleOverlay = document.getElementById('title-screen-overlay');
    if (titleOverlay) {
        titleOverlay.style.pointerEvents = 'none';
        titleOverlay.classList.remove('active');
    }
    
    // 3. Auto-play background music
    if (!window.gameAudio.musicPlaying) {
        window.gameAudio.startMusic();
        const musicBtn = document.getElementById('music-btn');
        if (musicBtn) {
            musicBtn.classList.remove('muted');
            const status = document.getElementById('music-status');
            if (status) status.innerText = 'ON';
        }
    }
    
    // 4. Start the actual gameplay
    startGame();
}

function togglePause() {
    if (gameState === STATES.PLAYING) {
        gameState = STATES.PAUSED;
        document.getElementById('pause-screen').classList.add('active');
        window.gameAudio.stopMusic();
    } else if (gameState === STATES.PAUSED) {
        gameState = STATES.PLAYING;
        document.getElementById('pause-screen').classList.remove('active');
        // Resume music if enabled
        const musicBtn = document.getElementById('music-btn');
        if (!musicBtn.classList.contains('muted')) {
            window.gameAudio.startMusic();
        }
    }
}

// Movements
function moveLeft() {
    if (canMoveTo(activeCol - 1, activeRow)) {
        activeCol--;
        window.gameAudio.playMove();
        resetLockDelay();
    }
}

function moveRight() {
    if (canMoveTo(activeCol + 1, activeRow)) {
        activeCol++;
        window.gameAudio.playMove();
        resetLockDelay();
    }
}

function cycleGems() {
    // Cycle gems order: bottom becomes middle, middle becomes top, top becomes bottom
    // e.g. [A, B, C] -> [C, A, B]
    const temp = activeGems[2];
    activeGems[2] = activeGems[1];
    activeGems[1] = activeGems[0];
    activeGems[0] = temp;
    window.gameAudio.playCycle();
    resetLockDelay();
}

function hardDrop() {
    // Drop instantly to lowest row
    let targetRow = activeRow;
    while (canMoveTo(activeCol, targetRow + 0.1)) {
        targetRow += 0.1;
    }
    activeRow = Math.floor(targetRow);
    window.gameAudio.playDrop();
    lockActiveColumn();
}

function resetLockDelay() {
    if (isCollidingBelow(activeCol, activeRow)) {
        if (lockResets < MAX_LOCK_RESETS) {
            lockTimer = 0;
            lockResets++;
        }
    }
}

function canMoveTo(col, row) {
    if (col < 0 || col >= COLS) return false;
    
    const baseRow = Math.floor(row);
    // The active column occupies (baseRow), (baseRow - 1), (baseRow - 2)
    // Check bottom gem collision
    if (baseRow >= ROWS) return false;
    if (baseRow >= 0 && grid[baseRow][col] !== 0) return false;

    // Check middle gem collision
    if (baseRow - 1 >= ROWS) return false;
    if (baseRow - 1 >= 0 && grid[baseRow - 1][col] !== 0) return false;

    // Check top gem collision
    if (baseRow - 2 >= ROWS) return false;
    if (baseRow - 2 >= 0 && grid[baseRow - 2][col] !== 0) return false;

    return true;
}

function isCollidingBelow(col, row) {
    const nextGridRow = Math.floor(row) + 1;
    if (nextGridRow >= ROWS) return true;
    if (grid[nextGridRow][col] !== 0) return true;
    return false;
}

// Lock gems into grid
function lockActiveColumn() {
    const targetRow = Math.floor(activeRow);

    if (isMagicColumn) {
        // Magic Column clears all gems of the color it touches!
        // Find the color below, or the flashing color if landing on floor
        let targetColor = 0;
        if (targetRow + 1 < ROWS && grid[targetRow + 1][activeCol] > 0) {
            targetColor = grid[targetRow + 1][activeCol];
        } else {
            // Floor landing uses the active flashing color
            targetColor = magicCycleColor;
        }

        triggerMagicFlash(targetColor);
        return;
    }

    const rBottom = targetRow;
    const rMiddle = targetRow - 1;
    const rTop = targetRow - 2;

    // Bake into grid
    let placedAny = false;
    if (rBottom >= 0 && rBottom < ROWS) { grid[rBottom][activeCol] = activeGems[2]; placedAny = true; }
    if (rMiddle >= 0 && rMiddle < ROWS) { grid[rMiddle][activeCol] = activeGems[1]; placedAny = true; }
    if (rTop >= 0 && rTop < ROWS) { grid[rTop][activeCol] = activeGems[0]; placedAny = true; }

    // If we locked gems above the grid, game over!
    if (rTop < 0 || rMiddle < 0 && activeGems[1] > 0) {
        triggerGameOver();
        return;
    }

    comboCount = 0;
    // Enter matching state
    checkForMatches();
}

function triggerMagicFlash(colorToClear) {
    magicFlashTimer = 350; // ms
    window.gameAudio.playMatch(4); // extra rich arpeggio sound

    // Scan grid and clear all matching colors
    matchedCells = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === colorToClear) {
                matchedCells.push({ r, c, type: colorToClear });
            }
        }
    }

    if (matchedCells.length > 0) {
        // Spawn particle bursts
        matchedCells.forEach(cell => {
            const px = cell.c * CELL_SIZE + CELL_SIZE / 2;
            const py = cell.r * CELL_SIZE + CELL_SIZE / 2;
            particleSystem.spawn(px, py, GEM_COLORS[cell.type], 25);
        });

        // Award score: 150 points per magic-cleared gem
        const points = matchedCells.length * 150 * level;
        score += points;
        clears += matchedCells.length;
        
        // Transition to MATCHING to flash them, then clear
        gameState = STATES.MATCHING;
        matchFlashTimer = MATCH_FLASH_DURATION;
    } else {
        // Magic hit nothing, spawn next
        spawnColumn();
        gameState = STATES.PLAYING;
    }
    updateDisplay();
}

// Match detection (horizontal, vertical, diagonals)
function checkForMatches() {
    let toClear = [];
    for (let r = 0; r < ROWS; r++) {
        toClear.push(new Array(COLS).fill(false));
    }

    let foundMatch = false;

    // Scan horizontal lines (len >= 3)
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c <= COLS - 3; c++) {
            const t = grid[r][c];
            if (t > 0 && grid[r][c+1] === t && grid[r][c+2] === t) {
                toClear[r][c] = true;
                toClear[r][c+1] = true;
                toClear[r][c+2] = true;
                foundMatch = true;
            }
        }
    }

    // Scan vertical lines (len >= 3)
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r <= ROWS - 3; r++) {
            const t = grid[r][c];
            if (t > 0 && grid[r+1][c] === t && grid[r+2][c] === t) {
                toClear[r][c] = true;
                toClear[r+1][c] = true;
                toClear[r+2][c] = true;
                foundMatch = true;
            }
        }
    }

    // Scan diagonal down-right (len >= 3)
    for (let r = 0; r <= ROWS - 3; r++) {
        for (let c = 0; c <= COLS - 3; c++) {
            const t = grid[r][c];
            if (t > 0 && grid[r+1][c+1] === t && grid[r+2][c+2] === t) {
                toClear[r][c] = true;
                toClear[r+1][c+1] = true;
                toClear[r+2][c+2] = true;
                foundMatch = true;
            }
        }
    }

    // Scan diagonal down-left (len >= 3)
    for (let r = 0; r <= ROWS - 3; r++) {
        for (let c = 2; c < COLS; c++) {
            const t = grid[r][c];
            if (t > 0 && grid[r+1][c-1] === t && grid[r+2][c-2] === t) {
                toClear[r][c] = true;
                toClear[r+1][c-1] = true;
                toClear[r+2][c-2] = true;
                foundMatch = true;
            }
        }
    }

    if (foundMatch) {
        comboCount++;
        matchedCells = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (toClear[r][c]) {
                    matchedCells.push({ r, c, type: grid[r][c] });
                }
            }
        }

        // Play matching sound (higher arpeggio chord for combos)
        window.gameAudio.playMatch(comboCount);

        // Spawn particles
        matchedCells.forEach(cell => {
            const px = cell.c * CELL_SIZE + CELL_SIZE / 2;
            const py = cell.r * CELL_SIZE + CELL_SIZE / 2;
            particleSystem.spawn(px, py, GEM_COLORS[cell.type], 15);
        });

        // Scoring: 50 per gem for base, scaling with levels and combo depth
        const points = matchedCells.length * 50 * level * comboCount;
        score += points;
        clears += matchedCells.length;

        // Check for level up (every 30 gems cleared)
        const oldLevel = level;
        level = Math.floor(clears / 30) + 1;
        if (level !== oldLevel) {
            updateSpeed();
            updateBackgroundColors();
        }

        // Show Combo Popup
        if (comboCount > 1) {
            showComboPopup(comboCount);
        }

        gameState = STATES.MATCHING;
        matchFlashTimer = MATCH_FLASH_DURATION;
    } else {
        // No matches found, spawn next column
        comboCount = 0;
        spawnColumn();
        gameState = STATES.PLAYING;
    }

    updateDisplay();
}

function showComboPopup(combo) {
    const popup = document.getElementById('combo-popup');
    popup.querySelector('.combo-count').innerText = `${combo}x`;
    popup.classList.add('show');
    setTimeout(() => {
        popup.classList.remove('show');
    }, 1200);
}

// Apply Gravity Collapse (sweeping columns down)
function applyGravityCollapse() {
    let moved = false;
    for (let c = 0; c < COLS; c++) {
        let writeRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (grid[r][c] !== 0) {
                if (r !== writeRow) {
                    grid[writeRow][c] = grid[r][c];
                    grid[r][c] = 0;
                    moved = true;
                }
                writeRow--;
            }
        }
    }
    return moved;
}

// Display Updates
function updateDisplay() {
    document.getElementById('score-display').innerText = padZero(score, 6);
    document.getElementById('high-score-display').innerText = padZero(highScore, 6);
    document.getElementById('level-display').innerText = level;
    document.getElementById('clears-display').innerText = clears;
}

function padZero(num, size) {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

// Main Loops
function gameLoop(time) {
    const dt = time - lastTime;
    lastTime = time;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // Handle screen flash fading
    if (magicFlashTimer > 0) {
        magicFlashTimer = Math.max(0, magicFlashTimer - dt);
    }

    // Update magic cycle color
    magicCycleColor = Math.floor(Date.now() / 80) % 6 + 1;

    // Update particles
    particleSystem.update();

    if (gameState === STATES.PLAYING) {
        // Drop speed modifier (checks if user is holding Down arrow or 's')
        const softDropModifier = (keysPressed['ArrowDown'] || keysPressed['s'] || keysPressed['S']) ? 6.5 : 1.0;
        
        activeRow += (fallSpeed * softDropModifier) * (dt / 1000);

        if (isCollidingBelow(activeCol, activeRow)) {
            // Lock activeRow to grid row
            activeRow = Math.floor(activeRow);
            
            // Increment lock timer
            lockTimer += dt;
            if (lockTimer >= LOCK_DELAY || softDropModifier > 1.0) {
                lockActiveColumn();
            }
        } else {
            lockTimer = 0;
        }
    } else if (gameState === STATES.MATCHING) {
        matchFlashTimer -= dt;
        if (matchFlashTimer <= 0) {
            // Remove matched cells from the board
            matchedCells.forEach(cell => {
                grid[cell.r][cell.c] = 0;
            });
            matchedCells = [];

            // Apply gravity collapse
            const itemsMoved = applyGravityCollapse();
            
            if (itemsMoved) {
                gameState = STATES.GRAVITY;
                gravityCollapseTimer = GRAVITY_COLLAPSE_DURATION;
            } else {
                // Settle immediately if nothing moved
                checkForMatches();
            }
        }
    } else if (gameState === STATES.GRAVITY) {
        gravityCollapseTimer -= dt;
        if (gravityCollapseTimer <= 0) {
            // Run check for match on settled board
            checkForMatches();
        }
    }
}

// Input Helpers
const keysPressed = {};
window.addEventListener('keydown', (e) => { keysPressed[e.key] = true; });
window.addEventListener('keyup', (e) => { keysPressed[e.key] = false; });

// Canvas Drawing
function draw() {
    // Clear main canvas
    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // Draw solid black background like the Sega Mega Drive playfield
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // Recreate the turquoise grid lines from the reference image
    ctx.strokeStyle = 'rgba(0, 163, 163, 0.35)';
    ctx.lineWidth = 1.0;
    for (let c = 1; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * CELL_SIZE, 0);
        ctx.lineTo(c * CELL_SIZE, BOARD_HEIGHT);
        ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL_SIZE);
        ctx.lineTo(BOARD_WIDTH, r * CELL_SIZE);
        ctx.stroke();
    }

    // Draw static grid cells
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const type = grid[r][c];
            if (type > 0) {
                // If it is matching, flash it
                const isMatching = matchedCells.some(cell => cell.r === r && cell.c === c);
                const flashRatio = isMatching ? (matchFlashTimer % 120 > 60 ? 1 : 0) : 0;
                drawGem(ctx, c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, type, isMatching, flashRatio);
            }
        }
    }

    // Draw active column and its framing rectangle
    if (gameState === STATES.PLAYING) {
        const ax = activeCol * CELL_SIZE;

        const rBottom = activeRow;
        const rMiddle = activeRow - 1.0;
        const rTop = activeRow - 2.0;

        // 1. Draw the gems inside the column
        if (isMagicColumn) {
            // Draw 3 magic flashing gems
            drawGem(ctx, ax, rBottom * CELL_SIZE, CELL_SIZE, magicCycleColor, true, (Date.now() % 160 > 80 ? 1 : 0));
            drawGem(ctx, ax, rMiddle * CELL_SIZE, CELL_SIZE, magicCycleColor, true, (Date.now() % 160 > 80 ? 1 : 0));
            drawGem(ctx, ax, rTop * CELL_SIZE, CELL_SIZE, magicCycleColor, true, (Date.now() % 160 > 80 ? 1 : 0));
        } else {
            // Draw normal falling gems
            if (rBottom >= 0) drawGem(ctx, ax, rBottom * CELL_SIZE, CELL_SIZE, activeGems[2]);
            if (rMiddle >= 0) drawGem(ctx, ax, rMiddle * CELL_SIZE, CELL_SIZE, activeGems[1]);
            if (rTop >= 0) drawGem(ctx, ax, rTop * CELL_SIZE, CELL_SIZE, activeGems[0]);
        }

        // 2. Draw the thin white active column border (that rectangle outline)
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        // Subtle white glow around the active outline
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.strokeRect(ax + 1, rTop * CELL_SIZE + 1, CELL_SIZE - 2, 3 * CELL_SIZE - 2);
        ctx.restore();
    }

    // Draw particle bursts
    particleSystem.draw(ctx);

    // Screen Magic Flash overlay
    if (magicFlashTimer > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${magicFlashTimer / 350})`;
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    }
}

// Modern 3D Faceted Vector-based Gem Renderers

// Draw Ruby (Faceted Red Circular Brilliant Cut)
function drawRuby(ctx, x, y, size, isFlashing, flashRatio) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2 - 2;
    const ir = r * 0.45; // Table facet radius

    ctx.save();
    
    // Ambient Occlusion backing shadow
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Table facet (Center)
    ctx.beginPath();
    ctx.arc(cx, cy, ir, 0, Math.PI * 2);
    const gradTable = ctx.createRadialGradient(cx - ir*0.3, cy - ir*0.3, 0, cx, cy, ir);
    gradTable.addColorStop(0, '#ff6688');
    gradTable.addColorStop(0.7, '#ff0033');
    gradTable.addColorStop(1, '#80001a');
    ctx.fillStyle = gradTable;
    ctx.fill();

    // Outer facets (8 segments)
    const angles = [];
    for (let i = 0; i <= 8; i++) {
        angles.push(i * Math.PI / 4);
    }

    for (let i = 0; i < 8; i++) {
        const a1 = angles[i];
        const a2 = angles[i+1];

        // Draw quad/triangle facet
        ctx.beginPath();
        ctx.moveTo(cx + ir * Math.cos(a1), cy + ir * Math.sin(a1));
        ctx.lineTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
        ctx.lineTo(cx + r * Math.cos(a2), cy + r * Math.sin(a2));
        ctx.lineTo(cx + ir * Math.cos(a2), cy + ir * Math.sin(a2));
        ctx.closePath();

        // Shading depending on direction (light comes from top-left)
        const cosAngle = Math.cos((a1 + a2)/2 - Math.PI*0.75); // alignment with light
        const shadeVal = (cosAngle + 1) / 2; // [0, 1]

        const gradFacet = ctx.createLinearGradient(
            cx + ir * Math.cos(a1), cy + ir * Math.sin(a1),
            cx + r * Math.cos(a2), cy + r * Math.sin(a2)
        );
        if (shadeVal > 0.75) {
            gradFacet.addColorStop(0, '#ff4d6a');
            gradFacet.addColorStop(1, '#cc0029');
        } else if (shadeVal > 0.4) {
            gradFacet.addColorStop(0, '#d9002b');
            gradFacet.addColorStop(1, '#80001a');
        } else {
            gradFacet.addColorStop(0, '#80001a');
            gradFacet.addColorStop(1, '#4d0010');
        }
        ctx.fillStyle = gradFacet;
        ctx.fill();

        // Draw facet separation lines
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    // Outer black border
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Specular Highlight Glint
    ctx.beginPath();
    ctx.ellipse(cx - r*0.35, cy - r*0.35, r*0.25, r*0.12, -Math.PI/4, 0, Math.PI*2);
    const gradGlint = ctx.createLinearGradient(cx - r*0.5, cy - r*0.5, cx - r*0.2, cy - r*0.2);
    gradGlint.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    gradGlint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradGlint;
    ctx.fill();

    ctx.restore();
}

// Draw Amber (Glossy 3D Orange Hexagonal Gem)
function drawAmber(ctx, x, y, size, isFlashing, flashRatio) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2 - 2;
    const ir = r * 0.45; // table hex scale

    ctx.save();
    
    // Background shadow
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Hexagon corners helper function
    const getHexPoints = (radius) => {
        const pts = [];
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3 - Math.PI / 6; // start angled for horizontal flats
            pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
        }
        return pts;
    };

    const outerHex = getHexPoints(r);
    const innerHex = getHexPoints(ir);

    // Table facet
    ctx.beginPath();
    ctx.moveTo(innerHex[0].x, innerHex[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(innerHex[i].x, innerHex[i].y);
    ctx.closePath();
    const gradTable = ctx.createRadialGradient(cx - ir*0.3, cy - ir*0.3, 0, cx, cy, ir);
    gradTable.addColorStop(0, '#ff9933');
    gradTable.addColorStop(0.7, '#e65c00');
    gradTable.addColorStop(1, '#993d00');
    ctx.fillStyle = gradTable;
    ctx.fill();

    // Crown facets (6 trapezoids)
    for (let i = 0; i < 6; i++) {
        const next = (i + 1) % 6;
        ctx.beginPath();
        ctx.moveTo(innerHex[i].x, innerHex[i].y);
        ctx.lineTo(outerHex[i].x, outerHex[i].y);
        ctx.lineTo(outerHex[next].x, outerHex[next].y);
        ctx.lineTo(innerHex[next].x, innerHex[next].y);
        ctx.closePath();

        // Shading relative to light source
        const midA = i * Math.PI / 3;
        const cosAngle = Math.cos(midA - Math.PI*0.7);
        const shadeVal = (cosAngle + 1) / 2; // [0, 1]

        const gradFacet = ctx.createLinearGradient(innerHex[i].x, innerHex[i].y, outerHex[next].x, outerHex[next].y);
        if (shadeVal > 0.75) {
            gradFacet.addColorStop(0, '#ffb84d');
            gradFacet.addColorStop(1, '#cc5200');
        } else if (shadeVal > 0.4) {
            gradFacet.addColorStop(0, '#cc5200');
            gradFacet.addColorStop(1, '#993d00');
        } else {
            gradFacet.addColorStop(0, '#993d00');
            gradFacet.addColorStop(1, '#662900');
        }
        ctx.fillStyle = gradFacet;
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    // Outer outline
    ctx.beginPath();
    ctx.moveTo(outerHex[0].x, outerHex[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(outerHex[i].x, outerHex[i].y);
    ctx.closePath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top-left glint
    ctx.beginPath();
    ctx.moveTo(outerHex[4].x, outerHex[4].y);
    ctx.lineTo(outerHex[5].x, outerHex[5].y);
    ctx.lineTo(innerHex[5].x, innerHex[5].y);
    ctx.lineTo(innerHex[4].x, innerHex[4].y);
    ctx.closePath();
    const gradGlint = ctx.createLinearGradient(outerHex[4].x, outerHex[4].y, innerHex[5].x, innerHex[5].y);
    gradGlint.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    gradGlint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradGlint;
    ctx.fill();

    ctx.restore();
}

// Draw Topaz (Golden Faceted Triangle Cushion Cut)
function drawTopaz(ctx, x, y, size, isFlashing, flashRatio) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2 - 2;
    const ir = r * 0.45; // inner table scale

    ctx.save();
    
    // Background shadow
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Outer points (pointing up)
    const p1 = { x: cx, y: cy - r }; // top
    const p2 = { x: cx + r * 0.866, y: cy + r * 0.5 }; // bottom-right
    const p3 = { x: cx - r * 0.866, y: cy + r * 0.5 }; // bottom-left

    // Inner points (table)
    const ip1 = { x: cx, y: cy - ir };
    const ip2 = { x: cx + ir * 0.866, y: cy + ir * 0.5 };
    const ip3 = { x: cx - ir * 0.866, y: cy + ir * 0.5 };

    // Table facet
    ctx.beginPath();
    ctx.moveTo(ip1.x, ip1.y);
    ctx.lineTo(ip2.x, ip2.y);
    ctx.lineTo(ip3.x, ip3.y);
    ctx.closePath();
    const gradTable = ctx.createRadialGradient(cx - ir*0.3, cy - ir*0.3, 0, cx, cy, ir);
    gradTable.addColorStop(0, '#fff066');
    gradTable.addColorStop(0.7, '#ffcc00');
    gradTable.addColorStop(1, '#b38f00');
    ctx.fillStyle = gradTable;
    ctx.fill();

    // 3 Crown facets (Trapezoids connecting outer triangle to table)
    const facets = [
        { outerA: p1, outerB: p2, innerB: ip2, innerA: ip1, shade: 0.8 }, // top-right (light side)
        { outerA: p2, outerB: p3, innerB: ip3, innerA: ip2, shade: 0.4 }, // bottom (shadow side)
        { outerA: p3, outerB: p1, innerB: ip1, innerA: ip3, shade: 0.9 }  // top-left (highlight side)
    ];

    facets.forEach(f => {
        ctx.beginPath();
        ctx.moveTo(f.innerA.x, f.innerA.y);
        ctx.lineTo(f.outerA.x, f.outerA.y);
        ctx.lineTo(f.outerB.x, f.outerB.y);
        ctx.lineTo(f.innerB.x, f.innerB.y);
        ctx.closePath();

        const gradFacet = ctx.createLinearGradient(f.innerA.x, f.innerA.y, f.outerB.x, f.outerB.y);
        if (f.shade > 0.8) {
            gradFacet.addColorStop(0, '#ffe580');
            gradFacet.addColorStop(1, '#d9b300');
        } else if (f.shade > 0.5) {
            gradFacet.addColorStop(0, '#e6c31a');
            gradFacet.addColorStop(1, '#b38f00');
        } else {
            gradFacet.addColorStop(0, '#b38f00');
            gradFacet.addColorStop(1, '#665200');
        }
        ctx.fillStyle = gradFacet;
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    });

    // Outer outline
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top-left glint
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(ip1.x, ip1.y);
    ctx.lineTo(ip3.x, ip3.y);
    ctx.closePath();
    const gradGlint = ctx.createLinearGradient(p3.x, p3.y, ip1.x, ip1.y);
    gradGlint.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    gradGlint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradGlint;
    ctx.fill();

    ctx.restore();
}

// Draw Emerald (Glossy Green Octagonal Step Cut)
function drawEmerald(ctx, x, y, size, isFlashing, flashRatio) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const h = size / 2 - 2;
    const ih = h * 0.52; // Inner table size scale

    ctx.save();
    
    // Shadow
    ctx.beginPath();
    ctx.arc(cx, cy, h + 1, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Corner bevel offset
    const cut = h * 0.25;
    const icut = ih * 0.25;

    // Draw central table (Octagonal shape)
    ctx.beginPath();
    ctx.moveTo(cx - ih + icut, cy - ih);
    ctx.lineTo(cx + ih - icut, cy - ih);
    ctx.lineTo(cx + ih, cy - ih + icut);
    ctx.lineTo(cx + ih, cy + ih - icut);
    ctx.lineTo(cx + ih - icut, cy + ih);
    ctx.lineTo(cx - ih + icut, cy + ih);
    ctx.lineTo(cx - ih, cy + ih - icut);
    ctx.lineTo(cx - ih, cy - ih + icut);
    ctx.closePath();
    const gradTable = ctx.createRadialGradient(cx - ih*0.3, cy - ih*0.3, 0, cx, cy, ih);
    gradTable.addColorStop(0, '#52ff8f');
    gradTable.addColorStop(0.7, '#00cc44');
    gradTable.addColorStop(1, '#006622');
    ctx.fillStyle = gradTable;
    ctx.fill();

    // Helper to draw crown trapezoids
    const drawCrown = (x1, y1, x2, y2, x3, y3, x4, y4, shade) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.closePath();

        const grad = ctx.createLinearGradient(x1, y1, x3, y3);
        if (shade > 0.8) {
            grad.addColorStop(0, '#66ff99');
            grad.addColorStop(1, '#009933');
        } else if (shade > 0.5) {
            grad.addColorStop(0, '#00cc44');
            grad.addColorStop(1, '#006622');
        } else {
            grad.addColorStop(0, '#006622');
            grad.addColorStop(1, '#003311');
        }
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    };

    // Outer octagon vertices
    const op1 = { x: cx - h + cut, y: cy - h };
    const op2 = { x: cx + h - cut, y: cy - h };
    const op3 = { x: cx + h, y: cy - h + cut };
    const op4 = { x: cx + h, y: cy + h - cut };
    const op5 = { x: cx + h - cut, y: cy + h };
    const op6 = { x: cx - h + cut, y: cy + h };
    const op7 = { x: cx - h, y: cy + h - cut };
    const op8 = { x: cx - h, y: cy - h + cut };

    // Inner octagon vertices
    const ip1 = { x: cx - ih + icut, y: cy - ih };
    const ip2 = { x: cx + ih - icut, y: cy - ih };
    const ip3 = { x: cx + ih, y: cy - ih + icut };
    const ip4 = { x: cx + ih, y: cy + ih - icut };
    const ip5 = { x: cx + ih - icut, y: cy + ih };
    const ip6 = { x: cx - ih + icut, y: cy + ih };
    const ip7 = { x: cx - ih, y: cy + ih - icut };
    const ip8 = { x: cx - ih, y: cy - ih + icut };

    // Top trapezoid
    drawCrown(ip1.x, ip1.y, op1.x, op1.y, op2.x, op2.y, ip2.x, ip2.y, 0.95);
    // Right trapezoid
    drawCrown(ip3.x, ip3.y, op3.x, op3.y, op4.x, op4.y, ip4.x, ip4.y, 0.5);
    // Bottom trapezoid
    drawCrown(ip5.x, ip5.y, op5.x, op5.y, op6.x, op6.y, ip6.x, ip6.y, 0.35);
    // Left trapezoid
    drawCrown(ip7.x, ip7.y, op7.x, op7.y, op8.x, op8.y, ip8.x, ip8.y, 0.7);

    // Corner triangles
    const drawCorner = (ix1, iy1, ox1, oy1, ox2, oy2, shade) => {
        ctx.beginPath();
        ctx.moveTo(ix1, iy1);
        ctx.lineTo(ox1, oy1);
        ctx.lineTo(ox2, oy2);
        ctx.closePath();
        ctx.fillStyle = shade > 0.7 ? '#52ff8f' : shade > 0.4 ? '#009933' : '#003311';
        ctx.fill();
        ctx.stroke();
    };

    // Draw 4 corners
    drawCorner(ip1.x, ip1.y, op1.x, op1.y, op8.x, op8.y, 0.9); // Top-left
    drawCorner(ip2.x, ip2.y, op2.x, op2.y, op3.x, op3.y, 0.65); // Top-right
    drawCorner(ip4.x, ip4.y, op4.x, op4.y, op5.x, op5.y, 0.4); // Bottom-right
    drawCorner(ip6.x, ip6.y, op6.x, op6.y, op7.x, op7.y, 0.5); // Bottom-left

    // Outer outline
    ctx.beginPath();
    ctx.moveTo(op1.x, op1.y);
    ctx.lineTo(op2.x, op2.y);
    ctx.lineTo(op3.x, op3.y);
    ctx.lineTo(op4.x, op4.y);
    ctx.lineTo(op5.x, op5.y);
    ctx.lineTo(op6.x, op6.y);
    ctx.lineTo(op7.x, op7.y);
    ctx.lineTo(op8.x, op8.y);
    ctx.closePath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Specs glint top left
    ctx.beginPath();
    ctx.moveTo(op8.x, op8.y);
    ctx.lineTo(op1.x, op1.y);
    ctx.lineTo(ip1.x, ip1.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    ctx.restore();
}

// Draw Sapphire (Glossy Blue Diamond brilliant cut)
function drawSapphire(ctx, x, y, size, isFlashing, flashRatio) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2 - 2;
    const ir = r * 0.45; // Table scale

    ctx.save();
    
    // Background shadow
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Outer rhombus points
    const p1 = { x: cx, y: cy - r };      // Top
    const p2 = { x: cx + r, y: cy };      // Right
    const p3 = { x: cx, y: cy + r };      // Bottom
    const p4 = { x: cx - r, y: cy };      // Left

    // Inner table rhombus points
    const ip1 = { x: cx, y: cy - ir };
    const ip2 = { x: cx + ir, y: cy };
    const ip3 = { x: cx, y: cy + ir };
    const ip4 = { x: cx - ir, y: cy };

    // Table facet
    ctx.beginPath();
    ctx.moveTo(ip1.x, ip1.y);
    ctx.lineTo(ip2.x, ip2.y);
    ctx.lineTo(ip3.x, ip3.y);
    ctx.lineTo(ip4.x, ip4.y);
    ctx.closePath();
    const gradTable = ctx.createRadialGradient(cx - ir*0.3, cy - ir*0.3, 0, cx, cy, ir);
    gradTable.addColorStop(0, '#80d4ff');
    gradTable.addColorStop(0.7, '#0066ff');
    gradTable.addColorStop(1, '#002280');
    ctx.fillStyle = gradTable;
    ctx.fill();

    // 4 crown facets (triangles/trapezoids connecting corners)
    const drawCrownFacet = (ia, oa, ob, ib, shade) => {
        ctx.beginPath();
        ctx.moveTo(ia.x, ia.y);
        ctx.lineTo(oa.x, oa.y);
        ctx.lineTo(ob.x, ob.y);
        ctx.lineTo(ib.x, ib.y);
        ctx.closePath();

        const grad = ctx.createLinearGradient(ia.x, ia.y, ob.x, ob.y);
        if (shade > 0.8) {
            grad.addColorStop(0, '#4da6ff');
            grad.addColorStop(1, '#0052cc');
        } else if (shade > 0.5) {
            grad.addColorStop(0, '#0066ff');
            grad.addColorStop(1, '#002980');
        } else {
            grad.addColorStop(0, '#002980');
            grad.addColorStop(1, '#00144d');
        }
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    };

    drawCrownFacet(ip1, p1, p2, ip2, 0.9); // Top-right
    drawCrownFacet(ip2, p2, p3, ip3, 0.55); // Bottom-right
    drawCrownFacet(ip3, p3, p4, ip4, 0.35); // Bottom-left
    drawCrownFacet(ip4, p4, p1, ip1, 0.75); // Top-left

    // Outer rhombus border
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top-left shiny highlight
    ctx.beginPath();
    ctx.moveTo(p4.x, p4.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(ip1.x, ip1.y);
    ctx.lineTo(ip4.x, ip4.y);
    ctx.closePath();
    const gradGlint = ctx.createLinearGradient(p4.x, p4.y, ip1.x, ip1.y);
    gradGlint.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    gradGlint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradGlint;
    ctx.fill();

    ctx.restore();
}

// Draw Amethyst (Royal Purple Faceted Inverted Triangle)
function drawAmethyst(ctx, x, y, size, isFlashing, flashRatio) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2 - 2;
    const ir = r * 0.45; // table scale

    ctx.save();
    
    // Shadow
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Outer points (pointing down)
    const p1 = { x: cx, y: cy + r }; // bottom
    const p2 = { x: cx + r * 0.866, y: cy - r * 0.5 }; // top-right
    const p3 = { x: cx - r * 0.866, y: cy - r * 0.5 }; // top-left

    // Inner points (table)
    const ip1 = { x: cx, y: cy + ir };
    const ip2 = { x: cx + ir * 0.866, y: cy - ir * 0.5 };
    const ip3 = { x: cx - ir * 0.866, y: cy - ir * 0.5 };

    // Table facet
    ctx.beginPath();
    ctx.moveTo(ip1.x, ip1.y);
    ctx.lineTo(ip2.x, ip2.y);
    ctx.lineTo(ip3.x, ip3.y);
    ctx.closePath();
    const gradTable = ctx.createRadialGradient(cx - ir*0.3, cy - ir*0.3, 0, cx, cy, ir);
    gradTable.addColorStop(0, '#e680ff');
    gradTable.addColorStop(0.7, '#aa00ff');
    gradTable.addColorStop(1, '#550080');
    ctx.fillStyle = gradTable;
    ctx.fill();

    // 3 Crown facets
    const facets = [
        { outerA: p3, outerB: p2, innerB: ip2, innerA: ip3, shade: 0.9 }, // top (light source)
        { outerA: p2, outerB: p1, innerB: ip1, innerA: ip2, shade: 0.5 }, // bottom-right
        { outerA: p1, outerB: p3, innerB: ip3, innerA: ip1, shade: 0.35 } // bottom-left (shadow)
    ];

    facets.forEach(f => {
        ctx.beginPath();
        ctx.moveTo(f.innerA.x, f.innerA.y);
        ctx.lineTo(f.outerA.x, f.outerA.y);
        ctx.lineTo(f.outerB.x, f.outerB.y);
        ctx.lineTo(f.innerB.x, f.innerB.y);
        ctx.closePath();

        const gradFacet = ctx.createLinearGradient(f.innerA.x, f.innerA.y, f.outerB.x, f.outerB.y);
        if (f.shade > 0.8) {
            gradFacet.addColorStop(0, '#f2b3ff');
            gradFacet.addColorStop(1, '#aa00ff');
        } else if (f.shade > 0.5) {
            gradFacet.addColorStop(0, '#aa00ff');
            gradFacet.addColorStop(1, '#550080');
        } else {
            gradFacet.addColorStop(0, '#550080');
            gradFacet.addColorStop(1, '#33004d');
        }
        ctx.fillStyle = gradFacet;
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    });

    // Outer outline
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top-left glint
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(ip3.x, ip3.y);
    ctx.lineTo(ip1.x, ip1.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.closePath();
    const gradGlint = ctx.createLinearGradient(p3.x, p3.y, p1.x, p1.y);
    gradGlint.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    gradGlint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradGlint;
    ctx.fill();

    ctx.restore();
}

// Draw Magic Column Rainbow Crystal
function drawMagicGem(ctx, x, y, size) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2 - 2;
    
    ctx.save();
    
    // Slow rotation over time
    const angle = (Date.now() / 400) % (Math.PI * 2);
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    
    // Inner table glow
    const rainbowHue = (Date.now() / 15) % 360;
    
    // Draw 3D octahedron crystal faces
    const drawFacet = (x1, y1, x2, y2, x3, y3, color1, color2) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        const grad = ctx.createLinearGradient(x1, y1, x3, y3);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    };

    // Draw rotating double pyramid
    const top = { x: 0, y: -r };
    const bottom = { x: 0, y: r };
    const right = { x: r*0.7, y: 0 };
    const left = { x: -r*0.7, y: 0 };

    // Rainbow colors shifting dynamically
    const c1 = `hsl(${rainbowHue}, 100%, 75%)`;
    const c2 = `hsl(${(rainbowHue + 60) % 360}, 100%, 55%)`;
    const c3 = `hsl(${(rainbowHue + 120) % 360}, 100%, 45%)`;
    const c4 = `hsl(${(rainbowHue + 180) % 360}, 100%, 35%)`;

    drawFacet(0, 0, top.x, top.y, right.x, right.y, c1, c2);
    drawFacet(0, 0, top.x, top.y, left.x, left.y, c2, c3);
    drawFacet(0, 0, bottom.x, bottom.y, right.x, right.y, c3, c4);
    drawFacet(0, 0, bottom.x, bottom.y, left.x, left.y, c4, c1);

    ctx.restore();

    // Outer glowing halo (not rotated)
    ctx.save();
    const gradGlow = ctx.createRadialGradient(cx, cy, r*0.4, cx, cy, r*1.3);
    gradGlow.addColorStop(0, `hsla(${rainbowHue}, 100%, 70%, 0.35)`);
    gradGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, r*1.3, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
}

function drawGem(ctx, x, y, size, type, isFlashing = false, flashRatio = 0) {
    if (type <= 0) return;

    let gemType = type === 7 ? magicCycleColor : type;

    // Flash matching gems with solid white and neon glow
    if (isFlashing && flashRatio > 0.5) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        return;
    }

    switch (gemType) {
        case 1:
            drawRuby(ctx, x, y, size, isFlashing, flashRatio);
            break;
        case 2:
            drawAmber(ctx, x, y, size, isFlashing, flashRatio);
            break;
        case 3:
            drawTopaz(ctx, x, y, size, isFlashing, flashRatio);
            break;
        case 4:
            drawEmerald(ctx, x, y, size, isFlashing, flashRatio);
            break;
        case 5:
            drawSapphire(ctx, x, y, size, isFlashing, flashRatio);
            break;
        case 6:
            drawAmethyst(ctx, x, y, size, isFlashing, flashRatio);
            break;
        case 7:
            drawMagicGem(ctx, x, y, size);
            break;
    }
}

// Side Panel Preview Canvas
function drawNextPreview() {
    nextCtx.clearRect(0, 0, 60, 150);
    nextCtx.fillStyle = '#05020c';
    nextCtx.fillRect(0, 0, 60, 150);

    // Next preview gems layout: vertical columns of 3, size 40px
    const previewSize = 40;
    const x = 30 - previewSize / 2; // centered horizontally
    
    // Draw top, middle, bottom gems
    const yTop = 15;
    const yMiddle = 55;
    const yBottom = 95;

    if (nextIsMagic) {
        drawGem(nextCtx, x, yTop, previewSize, 7, true, (Date.now() % 160 > 80 ? 1 : 0));
        drawGem(nextCtx, x, yMiddle, previewSize, 7, true, (Date.now() % 160 > 80 ? 1 : 0));
        drawGem(nextCtx, x, yBottom, previewSize, 7, true, (Date.now() % 160 > 80 ? 1 : 0));
    } else {
        drawGem(nextCtx, x, yTop, previewSize, nextGems[0]);
        drawGem(nextCtx, x, yMiddle, previewSize, nextGems[1]);
        drawGem(nextCtx, x, yBottom, previewSize, nextGems[2]);
    }
}
