// ---------------------------
// Configuración del juego
// ---------------------------
const BOARD_SIZE = 8;
const CANDY_TYPES = ['🍭','🍬','🍫','🍩','🍪','🧁'];
const INITIAL_MOVES = 30;
const TARGET_SCORE = 2000;

// Mensajes de combo
const COMBO_MESSAGES = ['¡Bien!', '¡Genial!', '¡Increíble!', '¡Brutal!', '¡Espectacular!', '🔥 ¡COMBO! 🔥'];

// ---------------------------
// Estado
// ---------------------------
let board = [];
let score = 0;
let moves = INITIAL_MOVES;
let selectedCandy = null;
let isProcessing = false;
let highScore = 0;
let comboCount = 0;

// Gestos mejorados
let dragStart = null;
const SWIPE_THRESHOLD = 30;

// ---------------------------
// DOM
// ---------------------------
const boardElement = document.getElementById('board');
const scoreElement = document.getElementById('score');
const movesElement = document.getElementById('moves');
const scoreItem = document.getElementById('scoreItem');
const movesItem = document.getElementById('movesItem');
const resetBtn = document.getElementById('resetBtn');
const hintBtn = document.getElementById('hintBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const gameOverTitle = document.getElementById('gameOverTitle');
const highScoreEl = document.getElementById('highScore');
const targetEl = document.getElementById('target');

// ---------------------------
// Inicializar
// ---------------------------
function initGame() {
  board = [];
  score = 0;
  moves = INITIAL_MOVES;
  selectedCandy = null;
  isProcessing = false;
  comboCount = 0;

  targetEl.textContent = TARGET_SCORE;
  updateScore();
  updateMoves();
  updateHighScore();

  createBoardNoInitialMatches();
  ensurePlayableOrShuffle();
  renderBoard();
}

function createBoardNoInitialMatches() {
  do {
    createBoard();
  } while (findMatches().length > 0);
}

function createBoard() {
  board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => getRandomCandy())
  );
}

function getRandomCandy() {
  return CANDY_TYPES[Math.floor(Math.random() * CANDY_TYPES.length)];
}

// ---------------------------
// Render
// ---------------------------
function renderBoard() {
  boardElement.innerHTML = '';

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const el = document.createElement('div');
      el.className = 'candy';
      el.role = 'gridcell';
      el.dataset.row = row;
      el.dataset.col = col;
      el.textContent = board[row][col];

      // Eventos
      el.addEventListener('click', () => handleClick(row, col));
      el.addEventListener('pointerdown', (e) => onPointerDown(e, row, col));
      el.addEventListener('pointermove', (e) => onPointerMove(e));
      el.addEventListener('pointerup', (e) => onPointerUp(e, row, col));
      el.addEventListener('pointercancel', () => dragStart = null);

      boardElement.appendChild(el);
    }
  }
}

function indexToChild(row, col) {
  return row * BOARD_SIZE + col;
}

function getCandyEl(row, col) {
  return boardElement.children[indexToChild(row, col)];
}

// ---------------------------
// Input: Clic
// ---------------------------
function handleClick(row, col) {
  if (isProcessing || moves <= 0) return;

  const clicked = { row, col };

  if (!selectedCandy) {
    selectedCandy = clicked;
    highlightCandy(clicked, true);
  } else {
    if (isAdjacent(selectedCandy, clicked)) {
      highlightCandy(selectedCandy, false);
      swapCandies(selectedCandy, clicked);
      selectedCandy = null;
    } else {
      highlightCandy(selectedCandy, false);
      selectedCandy = clicked;
      highlightCandy(clicked, true);
    }
  }
}

function highlightCandy({row, col}, on) {
  const el = getCandyEl(row, col);
  if (!el) return;
  el.classList.toggle('selected', !!on);
}

function isAdjacent(a, b) {
  const rd = Math.abs(a.row - b.row);
  const cd = Math.abs(a.col - b.col);
  return (rd === 1 && cd === 0) || (rd === 0 && cd === 1);
}

// ---------------------------
// Input: Gestos mejorados
// ---------------------------
function onPointerDown(e, row, col) {
  if (isProcessing || moves <= 0) return;
  e.preventDefault();
  dragStart = { 
    row, col, 
    x: e.clientX, 
    y: e.clientY,
    hasMoved: false
  };
}

function onPointerMove(e) {
  if (!dragStart) return;
  const dx = Math.abs(e.clientX - dragStart.x);
  const dy = Math.abs(e.clientY - dragStart.y);
  if (dx > 5 || dy > 5) {
    dragStart.hasMoved = true;
  }
}

function onPointerUp(e, row, col) {
  if (!dragStart) return;
  
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (!dragStart.hasMoved || Math.max(absX, absY) < SWIPE_THRESHOLD) {
    handleClick(dragStart.row, dragStart.col);
  } else {
    let target = { row: dragStart.row, col: dragStart.col };
    if (absX > absY) {
      target.col += dx > 0 ? 1 : -1;
    } else {
      target.row += dy > 0 ? 1 : -1;
    }
    
    if (target.row >= 0 && target.row < BOARD_SIZE &&
        target.col >= 0 && target.col < BOARD_SIZE) {
      if (selectedCandy) {
        highlightCandy(selectedCandy, false);
        selectedCandy = null;
      }
      swapCandies({ row: dragStart.row, col: dragStart.col }, target);
    }
  }
  dragStart = null;
}

// ---------------------------
// Lógica de juego
// ---------------------------
async function swapCandies(a, b) {
  if (isProcessing) return;
  isProcessing = true;

  // swap en memoria
  const tmp = board[a.row][a.col];
  board[a.row][a.col] = board[b.row][b.col];
  board[b.row][b.col] = tmp;

  renderBoard();
  await sleep(120);

  let matches = findMatches();
  if (matches.length > 0) {
    moves--;
    updateMoves(true);
    comboCount = 0;
    await resolveMatchesWithCascades(matches);

    // ganar / perder
    if (score >= TARGET_SCORE) {
      endGame(true);
      isProcessing = false;
      return;
    }
    if (moves <= 0) {
      endGame(false);
      isProcessing = false;
      return;
    }

    // si no hay movimientos, barajar
    ensurePlayableOrShuffle();
  } else {
    // revertir si no genera match
    const t = board[b.row][b.col];
    board[b.row][b.col] = board[a.row][a.col];
    board[a.row][a.col] = t;
    renderBoard();
  }

  isProcessing = false;
}

function findMatches() {
  const matches = [];

  // horizontales
  for (let r = 0; r < BOARD_SIZE; r++) {
    let c = 0;
    while (c < BOARD_SIZE - 2) {
      const candy = board[r][c];
      let run = 1;
      while (c + run < BOARD_SIZE && board[r][c + run] === candy) run++;
      if (run >= 3) {
        const group = [];
        for (let k = 0; k < run; k++) group.push({ row: r, col: c + k });
        matches.push(group);
        c += run;
      } else {
        c++;
      }
    }
  }

  // verticales
  for (let c = 0; c < BOARD_SIZE; c++) {
    let r = 0;
    while (r < BOARD_SIZE - 2) {
      const candy = board[r][c];
      let run = 1;
      while (r + run < BOARD_SIZE && board[r + run][c] === candy) run++;
      if (run >= 3) {
        const group = [];
        for (let k = 0; k < run; k++) group.push({ row: r + k, col: c });
        matches.push(group);
        r += run;
      } else {
        r++;
      }
    }
  }

  return dedupeMatches(matches);
}

function dedupeMatches(matches) {
  // aplana y marca
  const marks = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => false)
  );
  for (const group of matches) {
    for (const { row, col } of group) marks[row][col] = true;
  }
  // reconstituye grupos contiguos
  const flat = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (marks[r][c]) flat.push({ row: r, col: c });
    }
  }
  return flat.length ? [flat] : [];
}

async function resolveMatchesWithCascades(initialMatches) {
  let cascade = 1;
  let matches = initialMatches;

  while (matches.length > 0) {
    comboCount++;
    
    // Animación y partículas
    for (const { row, col } of matches[0]) {
      const el = getCandyEl(row, col);
      if (el) {
        el.classList.add('matched');
        createParticles(el, board[row][col]);
      }
    }

    // Score con multiplicador por cascada
    const points = matches[0].length * 10 * cascade;
    score += points;
    updateScore(true);

    // Mensaje de combo
    if (comboCount > 1 || matches[0].length >= 4) {
      showComboMessage(comboCount);
    }

    await sleep(280);

    // eliminar
    for (const { row, col } of matches[0]) {
      board[row][col] = null;
    }

    // caer y rellenar
    dropCandies();
    fillEmpty();
    renderBoard();
    await sleep(150);

    // siguiente cascada
    matches = findMatches();
    cascade++;
  }
}

// ---------------------------
// Efectos visuales
// ---------------------------
function createParticles(element, emoji) {
  const rect = element.getBoundingClientRect();
  const boardRect = boardElement.getBoundingClientRect();
  const particleCount = 6;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.textContent = emoji;
    
    const angle = (Math.PI * 2 * i) / particleCount;
    const distance = 40 + Math.random() * 30;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    
    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);
    particle.style.left = `${rect.left - boardRect.left + rect.width/2}px`;
    particle.style.top = `${rect.top - boardRect.top + rect.height/2}px`;
    
    boardElement.appendChild(particle);
    
    setTimeout(() => particle.remove(), 800);
  }
}

function showComboMessage(combo) {
  const msg = document.createElement('div');
  msg.className = 'combo-message';
  const msgIndex = Math.min(combo - 1, COMBO_MESSAGES.length - 1);
  msg.textContent = COMBO_MESSAGES[msgIndex];
  
  const container = document.querySelector('.game-container');
  container.appendChild(msg);
  
  setTimeout(() => msg.remove(), 1200);
}

function dropCandies() {
  for (let c = 0; c < BOARD_SIZE; c++) {
    let write = BOARD_SIZE - 1;
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (board[r][c] !== null) {
        board[write][c] = board[r][c];
        if (write !== r) board[r][c] = null;
        write--;
      }
    }
  }
}

function fillEmpty() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === null) board[r][c] = getRandomCandy();
    }
  }
}

// ---------------------------
// Utilidades de jugabilidad
// ---------------------------
function getAllPlayableSwaps() {
  const plays = [];
  const trySwap = (a, b) => {
    // swap temporal
    const t = board[a.row][a.col];
    board[a.row][a.col] = board[b.row][b.col];
    board[b.row][b.col] = t;
    const ok = findMatches().length > 0;
    // revertir
    board[b.row][b.col] = board[a.row][a.col];
    board[a.row][a.col] = t;
    if (ok) plays.push([a, b]);
  };

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (c + 1 < BOARD_SIZE) trySwap({ row: r, col: c }, { row: r, col: c + 1 });
      if (r + 1 < BOARD_SIZE) trySwap({ row: r, col: c }, { row: r + 1, col: c });
    }
  }
  return plays;
}

function ensurePlayableOrShuffle() {
  let tries = 0;
  while (getAllPlayableSwaps().length === 0 && tries < 50) {
    shuffleBoard();
    tries++;
  }
}

function shuffleBoard() {
  const flat = board.flat();
  // Fisher–Yates
  for (let i = flat.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flat[i], flat[j]] = [flat[j], flat[i]];
  }
  // rearmar
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      board[r][c] = flat[r * BOARD_SIZE + c];
    }
  }
  // evitar matches "gratis" tras mezclar
  if (findMatches().length > 0) shuffleBoard();
  renderBoard();
}

let hintTimeout = null;
function showHint() {
  if (isProcessing) return;
  clearHint();

  const plays = getAllPlayableSwaps();
  if (plays.length === 0) {
    // sin jugadas → mezclar
    shuffleBoard();
    return;
  }

  const [a, b] = plays[Math.floor(Math.random() * plays.length)];
  getCandyEl(a.row, a.col)?.classList.add('hint');
  getCandyEl(b.row, b.col)?.classList.add('hint');

  hintTimeout = setTimeout(clearHint, 2000);
}

function clearHint() {
  if (hintTimeout) {
    clearTimeout(hintTimeout);
    hintTimeout = null;
  }
  [...boardElement.children].forEach(el => el.classList.remove('hint'));
}

// ---------------------------
// UI / Estado
// ---------------------------
function updateScore(animate = false) {
  scoreElement.textContent = score;
  if (animate) {
    scoreItem.classList.remove('pulse');
    void scoreItem.offsetWidth; // trigger reflow
    scoreItem.classList.add('pulse');
  }
  if (score > highScore) {
    highScore = score;
    updateHighScore();
  }
}

function updateHighScore() {
  highScoreEl.textContent = highScore;
}

function updateMoves(animate = false) {
  movesElement.textContent = moves;
  if (animate) {
    movesItem.classList.remove('pulse');
    void movesItem.offsetWidth; // trigger reflow
    movesItem.classList.add('pulse');
  }
}

function endGame(won) {
  finalScoreEl.textContent = score;
  gameOverTitle.textContent = won ? '🎉 ¡Nivel Superado! 🎉' : '😢 ¡Juego Terminado!';
  gameOverEl.classList.remove('hidden');
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// ---------------------------
// Eventos
// ---------------------------
resetBtn.addEventListener('click', () => {
  gameOverEl.classList.add('hidden');
  initGame();
});

hintBtn.addEventListener('click', showHint);

shuffleBtn.addEventListener('click', () => {
  if (!isProcessing && moves > 0) {
    shuffleBoard();
    clearHint();
  }
});

document.getElementById('playAgainBtn').addEventListener('click', () => {
  gameOverEl.classList.add('hidden');
  initGame();
});

// Prevenir zoom en doble tap en móviles
document.addEventListener('dblclick', (e) => {
  e.preventDefault();
}, { passive: false });

// ---------------------------
// Iniciar juego
// ---------------------------
initGame();
