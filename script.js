const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiOverlay = document.getElementById('gameUI');
const uiTitle = document.getElementById('uiTitle');
const gameOverImg = document.getElementById('gameOverImg');
const uiScore = document.getElementById('uiScore');
const scoreVal = document.getElementById('scoreVal');
const startBtn = document.querySelector('.btn');

// --- Game Settings & Assets ---
const dinoImg = new Image();
dinoImg.src = 'dino.png';

const groundObsImg = new Image();
groundObsImg.src = 'prof_ground.png';

const airObsImg = new Image();
airObsImg.src = 'prof_air.png';

const groundAudio = new Audio('hi.mp3');
const airAudio = new Audio('dekh_lo.mp3');
const ouchAudio = new Audio('ouch.mp3');
groundAudio.loop = true;
airAudio.loop = true;

// Logical dimensions
const LOGICAL_WIDTH = 1000; // Wider logical width
const LOGICAL_HEIGHT = 400; // Taller for better scale
const ASPECT_RATIO = LOGICAL_WIDTH / LOGICAL_HEIGHT;

let score = 0;
let gameSpeed = 6;
let isPlaying = false;
let isGameOver = false;
let animationFrameId;
let obstacleSpawnInterval;
let lastSpeedIncrease = 0;

// --- Objects ---
// Scaled up Dino
const dino = {
    x: 80,
    y: 300, // Ground level - height
    width: 80, // Bigger size
    height: 80,
    dy: 0,
    jumpForce: 15,
    gravity: 0.8,
    grounded: false,
    groundY: 300
};

let obstacles = [];

// --- Resizing Logic ---
function resize() {
    const isMobile = window.innerWidth <= 600;
    const isLandscape = window.innerHeight < window.innerWidth && window.innerHeight < 500;
    
    // Get the game wrapper element
    const gameWrapper = document.querySelector('.game-wrapper');
    let displayWidth;
    let displayHeight;
    
    if (isMobile) {
        // Mobile-first approach: calculate based on available space
        const padding = 16;
        const availableWidth = window.innerWidth - padding;
        
        if (isLandscape) {
            // Landscape: use most of the height
            const titleSpace = 40;
            const availableHeight = window.innerHeight - titleSpace;
            displayHeight = Math.min(availableHeight, availableWidth / ASPECT_RATIO);
            displayWidth = displayHeight * ASPECT_RATIO;
        } else {
            // Portrait: balance width and height
            const titleSpace = 100; // Title + info + margins
            const availableHeight = window.innerHeight - titleSpace;
            
            // Try to use full width first
            const heightFromWidth = availableWidth / ASPECT_RATIO;
            
            if (heightFromWidth <= availableHeight) {
                // Full width fits
                displayWidth = availableWidth;
                displayHeight = heightFromWidth;
            } else {
                // Constrain by height
                displayHeight = availableHeight;
                displayWidth = displayHeight * ASPECT_RATIO;
            }
        }
        
        // Clamp to available width
        displayWidth = Math.min(displayWidth, availableWidth);
        displayWidth = Math.max(displayWidth, 280); // Minimum width
    } else {
        // Desktop: maintain aspect ratio with padding
        displayWidth = Math.min(window.innerWidth - 40, 1000);
        displayHeight = displayWidth / ASPECT_RATIO;
    }

    // Set canvas logical size (always the same for game logic)
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;

    // Set display size (scaled for screen)
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    // Ensure game wrapper doesn't overflow
    if (gameWrapper) {
        gameWrapper.style.maxHeight = isMobile && !isLandscape 
            ? `${displayHeight + 2}px` 
            : 'none';
    }
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
    // Delay resize slightly to ensure correct dimensions after orientation change
    setTimeout(() => {
        resize();
        // Force a repaint
        if (isPlaying) {
            ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        }
    }, 150);
});

// Initial resize
resize();

// Also resize after a short delay to handle mobile browser bars
setTimeout(resize, 100);

// --- Game Logic ---
function startGame() {
    // Clean up any existing game loops
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    if (obstacleSpawnInterval) {
        clearInterval(obstacleSpawnInterval);
    }

    // Stop all audio
    groundAudio.pause();
    airAudio.pause();
    groundAudio.currentTime = 0;
    airAudio.currentTime = 0;

    // Reset state
    score = 0;
    gameSpeed = 6;
    lastSpeedIncrease = 0;
    isGameOver = false;
    isPlaying = true;
    canJump = true;
    obstacles = [];
    dino.y = dino.groundY;
    dino.dy = 0;
    dino.grounded = true;
    scoreVal.innerText = '0';

    // Hide UI
    uiOverlay.classList.add('hidden');
    gameOverImg.style.display = 'none';
    uiTitle.style.display = 'block';
    uiTitle.innerText = "Ready?";
    uiScore.style.display = 'none';
    startBtn.innerText = "Start Run";

    // Start game loop
    update();

    // Start obstacle spawner
    obstacleSpawnInterval = setInterval(() => {
        if (isPlaying) spawnObstacle();
    }, 1500);
}

function spawnObstacle() {
    if (!isPlaying) return;
    
    // Prevent spawning if there are too many obstacles or one is too close
    const minDistance = 200;
    const hasCloseObstacle = obstacles.some(o => o.x > LOGICAL_WIDTH - minDistance);
    if (hasCloseObstacle || obstacles.length > 3) return;
    
    const type = Math.random() > 0.6 ? 'ground' : 'air';

    // Scaled obstacles
    const obsWidth = 50;
    const obsHeight = 50;

    // Align ground obstacle with the floor (dino.groundY + dino.height = floor)
    const groundOffset = dino.height - obsHeight;
    const yPos = type === 'ground' ? dino.groundY + groundOffset : dino.groundY - 90;

    obstacles.push({
        x: LOGICAL_WIDTH,
        y: yPos,
        width: obsWidth,
        height: obsHeight,
        type: type
    });
}

function update() {
    if (!isPlaying) return;

    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    drawEnvironment();

    // 1. Dino Physics
    if (!dino.grounded) {
        dino.dy += dino.gravity;
        dino.y += dino.dy;
    }

    if (dino.y > dino.groundY) {
        dino.y = dino.groundY;
        dino.dy = 0;
        dino.grounded = true;
    }

    // Draw Dino (with shadow)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(dino.x + dino.width / 2, dino.y + dino.height + 5, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw dino image if loaded, otherwise fallback
    if (dinoImg.complete && dinoImg.naturalWidth > 0) {
        ctx.drawImage(dinoImg, dino.x, dino.y, dino.width, dino.height);
    } else {
        // Fallback: draw colored rectangle
        ctx.fillStyle = '#6C63FF';
        ctx.fillRect(dino.x, dino.y, dino.width, dino.height);
    }

    // 2. Obstacle Logic
    let groundActive = false;
    let airActive = false;

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let o = obstacles[i];
        o.x -= gameSpeed;

        // Draw Obstacles (only if images are loaded)
        const obsImg = o.type === 'ground' ? groundObsImg : airObsImg;
        if (obsImg.complete && obsImg.naturalWidth > 0) {
            ctx.drawImage(obsImg, o.x, o.y, o.width, o.height);
        } else {
            // Fallback: draw colored rectangle if image not loaded
            ctx.fillStyle = o.type === 'ground' ? '#FF6584' : '#6C63FF';
            ctx.fillRect(o.x, o.y, o.width, o.height);
        }

        // Check if obstacle is visible on screen
        if (o.x + o.width > 0 && o.x < LOGICAL_WIDTH) {
            if (o.type === 'ground') groundActive = true;
            if (o.type === 'air') airActive = true;
        }

        // Collision Detection (Hitbox slightly smaller than visual for fairness)
        const hitboxPadding = 10;
        if (!isGameOver &&
            dino.x + hitboxPadding < o.x + o.width &&
            dino.x + dino.width - hitboxPadding > o.x &&
            dino.y + hitboxPadding < o.y + o.height &&
            dino.y + dino.height - hitboxPadding > o.y) {
            gameOver();
            break; // Exit loop once collision detected
        }

        if (o.x + o.width < 0) {
            obstacles.splice(i, 1);
            score++;
            scoreVal.innerText = score;
            // Increase speed slightly every 5 points (only once per milestone)
            if (score % 5 === 0 && score !== lastSpeedIncrease) {
                gameSpeed += 0.5;
                lastSpeedIncrease = score;
            }
        }
    }

    // 3. Audio
    if (isPlaying) {
        handleAudio(groundActive, groundAudio);
        handleAudio(airActive, airAudio);
    }

    // 4. Ground Line
    ctx.fillStyle = '#535353';
    ctx.beginPath();
    ctx.moveTo(0, dino.groundY + dino.height);
    ctx.lineTo(LOGICAL_WIDTH, dino.groundY + dino.height);
    ctx.stroke();

    animationFrameId = requestAnimationFrame(update);
}

function drawEnvironment() {
    // Sky Gradient
    const grd = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grd.addColorStop(0, "#e0f7fa");
    grd.addColorStop(1, "#fff");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Simple decorative floor
    ctx.fillStyle = "#dfe6e9";
    ctx.fillRect(0, dino.groundY + dino.height - 5, LOGICAL_WIDTH, 100);
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke === 'undefined') { stroke = true; }
    if (typeof radius === 'undefined') { radius = 5; }
    if (typeof radius === 'number') { radius = { tl: radius, tr: radius, br: radius, bl: radius }; } else { var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 }; for (var side in defaultRadius) { radius[side] = radius[side] || defaultRadius[side]; } }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) { ctx.fill(); }
    if (stroke) { ctx.stroke(); }
}

function handleAudio(active, audio) {
    if (active) {
        if (audio.paused) audio.play().catch(() => { });
    } else {
        audio.pause();
        audio.currentTime = 0;
    }
}

function gameOver() {
    if (isGameOver) return; // Prevent multiple calls
    
    isPlaying = false;
    isGameOver = true;
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    if (obstacleSpawnInterval) {
        clearInterval(obstacleSpawnInterval);
    }

    groundAudio.pause();
    airAudio.pause();
    groundAudio.currentTime = 0;
    airAudio.currentTime = 0;

    ouchAudio.play().catch(() => { });

    uiTitle.style.display = 'none'; // Hide text title
    gameOverImg.style.display = 'block'; // Show image

    uiScore.innerText = `Score: ${score}`;
    uiScore.style.display = 'block';
    startBtn.innerText = "Try Again";

    uiOverlay.classList.remove('hidden');
}

// --- Controls ---
let canJump = true; // Prevent rapid jumping

const jump = () => {
    if (dino.grounded && isPlaying && canJump) {
        dino.dy = -dino.jumpForce;
        dino.grounded = false;
        canJump = false;
        // Small delay to prevent double jumps
        setTimeout(() => {
            canJump = true;
        }, 100);
    }
};

// Keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault(); // Prevent space bar from scrolling
        jump();
    }
});

// Touch controls - improved for mobile
const handleTouchStart = (e) => {
    // Don't prevent default if clicking on button or UI overlay when visible
    const target = e.target;
    if (target && (target.closest('.btn') || target.closest('.ui-overlay:not(.hidden)'))) {
        return; // Let button/overlay handle its own interaction
    }
    
    e.preventDefault(); // Prevent scrolling
    e.stopPropagation();
    
    // Always try to jump - jump() function will check if game is playing
    jump();
};

const handleTouchMove = (e) => {
    // Don't prevent if it's a button interaction
    if (e.target && e.target.closest('.btn')) {
        return;
    }
    
    e.preventDefault(); // Always prevent scrolling during game
};

const handleTouchEnd = (e) => {
    // Don't prevent if it's a button interaction
    if (e.target && e.target.closest('.btn')) {
        return;
    }
    
    e.preventDefault(); // Always prevent default touch behavior
};

// Initialize touch controls after DOM is ready
function initTouchControls() {
    const gameWrapper = document.querySelector('.game-wrapper');
    
    // Simple direct touch handler for the entire document
    document.addEventListener('touchstart', (e) => {
        // Skip if touching button or visible overlay
        if (e.target && (e.target.closest('.btn') || (!uiOverlay.classList.contains('hidden') && e.target.closest('.ui-overlay')))) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        jump();
    }, { passive: false, capture: true });
    
    document.addEventListener('touchmove', (e) => {
        if (e.target && e.target.closest('.btn')) {
            return;
        }
        e.preventDefault();
    }, { passive: false, capture: true });
    
    document.addEventListener('touchend', (e) => {
        if (e.target && e.target.closest('.btn')) {
            return;
        }
        e.preventDefault();
    }, { passive: false, capture: true });

    // Add touch listeners to specific elements as well
    const elements = [canvas, gameWrapper].filter(el => el !== null);
    
    elements.forEach(element => {
        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: false });
    });

    // Also add click handler as fallback for mobile
    canvas.addEventListener('click', (e) => {
        if (isPlaying) {
            e.preventDefault();
            jump();
        }
    });
    
    if (gameWrapper) {
        gameWrapper.addEventListener('click', (e) => {
            // Don't jump if clicking on UI overlay button
            if (e.target && e.target.closest('.btn')) {
                return;
            }
            if (isPlaying) {
                e.preventDefault();
                jump();
            }
        });
    }
}

// Initialize controls when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTouchControls);
} else {
    // Use setTimeout to ensure all elements are ready
    setTimeout(initTouchControls, 100);
}
