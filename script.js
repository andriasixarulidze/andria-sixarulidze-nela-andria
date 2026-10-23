const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Auto resize canvas to fill full screen
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// UI Elements
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const hud = document.getElementById('hud');
const scoreText = document.getElementById('scoreText');
const finalScoreText = document.getElementById('finalScoreText');
const abilityFill = document.getElementById('abilityFill');
const charAbilityText = document.getElementById('charAbilityText');

// Game Variables
let gameRunning = false;
let score = 0;
let gameSpeed = 7;
let gravity = 0.65;
let frameCount = 0;

// Selected Character Info
let selectedCharKey = 'ioane';
const characters = {
  ioane: { name: 'იოანე', color: '#ef4444', ability: 'ორმაგი ნახტომი', maxJumps: 2 },
  andria: { name: 'ანდრია', color: '#3b82f6', ability: 'ფარი', maxJumps: 1 },
  ilia: { name: 'ილია', color: '#10b981', ability: 'სპრინტი', maxJumps: 1 },
  gabriel: { name: 'გაბრიელი', color: '#f59e0b', ability: 'ნელა ზვიადი', maxJumps: 1 }
};

// Player Object
const player = {
  x: 120,
  y: 0,
  width: 55,
  height: 65,
  vy: 0,
  jumpForce: -15,
  isGrounded: false,
  jumpsLeft: 1,
  shieldActive: false,
  sprintActive: false,
  slowMoActive: false,
  abilityCooldown: 0,
  maxCooldown: 300,
  abilityTimer: 0
};

// Obstacles & Background Objects
let obstacles = [];
let clouds = [];

// Sound Generator (Web Audio API)
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'jump') {
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'ability') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) {}
}

// Character Selection
function selectCharacter(key) {
  selectedCharKey = key;
  document.querySelectorAll('.char-card').forEach(card => card.classList.remove('selected'));
  document.getElementById(`card-${key}`).classList.add('selected');
}

// Jump Handler
function triggerJump() {
  if (!gameRunning) return;
  if (player.isGrounded) {
    player.vy = player.jumpForce;
    player.isGrounded = false;
    player.jumpsLeft = characters[selectedCharKey].maxJumps - 1;
    playSound('jump');
  } else if (selectedCharKey === 'ioane' && player.jumpsLeft > 0) {
    player.vy = player.jumpForce * 0.9;
    player.jumpsLeft--;
    playSound('jump');
  }
}

// Controls (Keyboard & Touch)
window.addEventListener('keydown', (e) => {
  if (!gameRunning) return;

  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
    e.preventDefault();
    triggerJump();
  }

  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') && player.abilityCooldown <= 0) {
    useAbility();
  }
});

// Click or Touch on screen to jump
window.addEventListener('pointerdown', (e) => {
  if (gameRunning && e.target.tagName !== 'BUTTON' && e.target.className !== 'char-card') {
    triggerJump();
  }
});

function useAbility() {
  player.abilityCooldown = player.maxCooldown;
  playSound('ability');

  if (selectedCharKey === 'andria') {
    player.shieldActive = true;
    player.abilityTimer = 180;
  } else if (selectedCharKey === 'ilia') {
    player.sprintActive = true;
    player.abilityTimer = 150;
  } else if (selectedCharKey === 'gabriel') {
    player.slowMoActive = true;
    player.abilityTimer = 200;
  }
}

// Start Game
function startGame() {
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  hud.classList.remove('hidden');

  const char = characters[selectedCharKey];
  charAbilityText.innerText = `${char.ability} (Shift/E)`;

  score = 0;
  gameSpeed = 7;
  frameCount = 0;
  obstacles = [];
  clouds = [];

  // Init Clouds
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: Math.random() * (canvas.height * 0.4) + 20,
      speed: Math.random() * 0.5 + 0.5,
      size: Math.random() * 30 + 30
    });
  }

  // Reset Player Position based on ground height
  const groundY = canvas.height - 110;
  player.y = groundY - player.height;
  player.vy = 0;
  player.isGrounded = true;
  player.abilityCooldown = 0;
  player.shieldActive = false;
  player.sprintActive = false;
  player.slowMoActive = false;

  gameRunning = true;
  requestAnimationFrame(gameLoop);
}

function restartGame() {
  startGame();
}

function triggerGameOver() {
  gameRunning = false;
  playSound('hit');
  finalScoreText.innerText = `შენი ქულა: ${Math.floor(score)}`;
  hud.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
}

// Game Loop
function gameLoop() {
  if (!gameRunning) return;

  update();
  draw();

  requestAnimationFrame(gameLoop);
}

function update() {
  frameCount++;
  score += 0.1;
  scoreText.innerText = Math.floor(score);

  let currentSpeed = gameSpeed;
  if (player.sprintActive) currentSpeed *= 1.8;
  if (player.slowMoActive) currentSpeed *= 0.4;

  gameSpeed += 0.0008;

  if (player.abilityCooldown > 0) {
    player.abilityCooldown--;
  }
  abilityFill.style.width = `${((player.maxCooldown - player.abilityCooldown) / player.maxCooldown) * 100}%`;

  if (player.abilityTimer > 0) {
    player.abilityTimer--;
    if (player.abilityTimer <= 0) {
      player.shieldActive = false;
      player.sprintActive = false;
      player.slowMoActive = false;
    }
  }

  // Player Physics
  player.vy += gravity;
  player.y += player.vy;

  const groundY = canvas.height - 110;
  if (player.y + player.height >= groundY) {
    player.y = groundY - player.height;
    player.vy = 0;
    player.isGrounded = true;
    player.jumpsLeft = characters[selectedCharKey].maxJumps;
  }

  // Update Clouds
  clouds.forEach(c => {
    c.x -= c.speed;
    if (c.x < -100) c.x = canvas.width + 50;
  });

  // Spawn Obstacles
  if (frameCount % Math.max(70, Math.floor(130 - gameSpeed * 4)) === 0) {
    const type = Math.random() > 0.3 ? 'ground' : 'flying';
    obstacles.push({
      x: canvas.width,
      y: type === 'ground' ? groundY - 55 : groundY - 140,
      width: type === 'ground' ? 35 : 40,
      height: type === 'ground' ? 55 : 35,
      type: type
    });
  }

  // Update Obstacles & Collision
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= currentSpeed;

    if (
      player.x < obs.x + obs.width &&
      player.x + player.width > obs.x &&
      player.y < obs.y + obs.height &&
      player.y + player.height > obs.y
    ) {
      if (player.shieldActive) {
        obstacles.splice(i, 1);
        player.shieldActive = false;
        playSound('hit');
        continue;
      } else {
        triggerGameOver();
        return;
      }
    }

    if (obs.x + obs.width < 0) {
      obstacles.splice(i, 1);
    }
  }
}

function draw() {
  ctx.fillStyle = player.slowMoActive ? '#1e1b4b' : '#87CEEB';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  clouds.forEach(c => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
    ctx.arc(c.x + c.size * 0.5, c.y - c.size * 0.2, c.size * 0.7, 0, Math.PI * 2);
    ctx.arc(c.x + c.size, c.y, c.size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Ground
  const groundY = canvas.height - 110;
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(0, groundY, canvas.width, 110);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, groundY + 15, canvas.width, 95);

  // Obstacles
  obstacles.forEach(obs => {
    if (obs.type === 'ground') {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y + obs.height);
      ctx.lineTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
      ctx.fill();
    } else {
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(obs.x - 5, obs.y + 12, obs.width + 10, 6);
    }
  });

  // Player
  const char = characters[selectedCharKey];

  if (player.shieldActive) {
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = char.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  ctx.fillStyle = '#fff';
  ctx.fillRect(player.x + 32, player.y + 12, 12, 12);
  ctx.fillStyle = '#000';
  ctx.fillRect(player.x + 38, player.y + 15, 5, 5);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(char.name[0], player.x + 18, player.y + 42);

  if (player.sprintActive) {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.fillRect(player.x - 25, player.y, player.width, player.height);
    ctx.fillRect(player.x - 50, player.y, player.width, player.height);
  }
}