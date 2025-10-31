// ---------------------------
// Configuración del juego
// ---------------------------
const BOARD_SIZE = 8;
const CANDY_TYPES = ['🍭','🍬','🍫','🍩','🍪','🧁'];
const INITIAL_MOVES = 30;
const TARGET_SCORE = 2000; // objetivo simple para “ganar”

// ---------------------------
// Estado
// ---------------------------
let board = [];
let score = 0;
let moves = INITIAL_MOVES;
let selectedCandy = null;
let isProcessing = false;
let highScore = Number(localStorage.getItem('cc_highscore') || 0);

// Gestos
let dragStart = null;

// ---------------------------
// DOM
// ---------------------------
const boardElement   = document.getElementById('board');
const scoreElement   = document.getElementById('score');
const movesElement   = document.getElementById('moves');
const resetBtn       = document.getElementById('resetBtn');
const hintBtn        = document.getElementById('hintBtn');
const shuffleBtn     = document.getElementById('shuffleBtn');
const gameOverEl     = document.getElementById('gameOver');
const finalScoreEl   = document.getElementById('finalScore');
const gameOverTitle  = document.getElementById('gameOverTitle');
const highScoreEl    = document.getElementById('highScore');
const targetEl       = document.getElementById('target');

// ---------------------------
// Inicializar
// ---------------------------
function initGame() {
  board = [];
  score = 0;
  moves = INITIAL_MOVES;
  selectedCandy = null;
  isProcessing = false;

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

      // Clic selección / swap
      el.addEventListener('click', () => handleClick(row, col));

      // Drag & drop / swipe
      el.addEventListener('pointerdown', (e) => onPointerDown(e, row, col));
      el.addEventListener('pointerup',   (e) => onPointerUp(e, row, col));

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
// Input: Gestos (pointer)
// ---------------------------
function onPointerDown(e, row, col) {
  if (isProcessing || moves <= 0) return;
  dragStart = { row, col, x: e.clientX, y: e.clientY };
}

function onPointerUp(e, row, col) {
  if (!dragStart) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;

  const absX = Math.abs(dx), absY = Math.abs(dy);
  if (Math.max(absX, absY) < 12) { // tap corto → tratar como clic
    handleClick(row, col);
  } else {
    // determinar dirección mayoritaria
    let target = { row: dragStart.row, col: dragStart.col };
    if (absX > absY) {
      target.col += dx > 0 ? 1 : -1;
    } else {
      target.row += dy > 0 ? 1 : -1;
    }
    // validación de límites
    if (
      target.row >= 0 && target.row < BOARD_SIZE &&
      target.col >= 0 && target.col < BOARD_SIZE
    ) {
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
    updateMoves();
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
  // reconstituye grupos contiguos (simple: devolver celdas marcadas como lista única)
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
    // animar
    for (const { row, col } of matches[0]) {
      getCandyEl(row, col)?.classList.add('matched');
    }
    // score con multiplicador por cascada
    score += matches[0].length * 10 * cascade;
    updateScore();
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
  // evitar matches “gratis” tras mezclar
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

  hintTimeout = setTimeout(clearHint, 1500);
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
function updateScore() {
  scoreElement.textContent = score;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('cc_highscore', String(highScore));
    updateHighScore();
  }
}

function updateHighScore() {
  highScoreEl.textContent = highScore;
}

function updateMoves() {
  movesElement.textContent = moves;
}

function endGame(won) {
  finalScoreEl.textContent = score;
  gameOverTitle.textContent = won ? '¡Nivel Superado! 🎉' : '¡Juego Terminado!';
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
  if (!isProcessing) {
    shuffleBoard();
    clearHint();
  }
});

document.getElementById('playAgainBtn').addEventListener('click', () => {
  gameOverEl.classList.add('hidden');
  initGame();
});

// start
initGame();
