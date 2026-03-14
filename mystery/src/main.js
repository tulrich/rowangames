import { generateMystery, movePlayer, checkFoundItem } from './logic.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = null;
const keys = {};

function init() {
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const ui = document.getElementById('ui');
  ui.addEventListener('click', () => {
    ui.style.display = 'none';
    startGame();
  });

  document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('winModal').style.display = 'none';
    startGame();
  });

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
}

function startGame() {
  gameState = generateMystery();
  document.getElementById('hud').style.display = 'block';
  document.getElementById('instructionText').innerText = `Mystery: Find the lost ${gameState.targetItem.toUpperCase()} in the ${gameState.targetBuildingName.toUpperCase()}!`;
  requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if(gameState) draw();
}

function draw() {
  if (!ctx || !gameState) return;
  
  // Clear background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw floor
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, 1200, 900); // hardcoded map bounds for now

  // Draw buildings
  gameState.buildings.forEach(b => {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.width, b.height);
    
    // Label building
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(b.name, b.x + 5, b.y + 20);
  });

  // Draw items
  gameState.items.forEach(i => {
    ctx.fillStyle = i.isTarget ? '#ffaa00' : '#888'; 
    ctx.fillRect(i.x, i.y, i.width, i.height);
    
    // Tiny label for item
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText(i.name, i.x - 5, i.y - 5);
  });

  // Draw player
  const p = gameState.player;
  ctx.fillStyle = '#00aaff';
  ctx.beginPath();
  ctx.arc(p.x + p.width / 2, p.y + p.height / 2, p.width / 2, 0, Math.PI * 2);
  ctx.fill();
}

function gameLoop() {
  if (gameState.gameOver) {
    document.getElementById('winModal').style.display = 'flex';
    return;
  }

  movePlayer(gameState, keys);
  checkFoundItem(gameState);
  draw();

  requestAnimationFrame(gameLoop);
}

init();
