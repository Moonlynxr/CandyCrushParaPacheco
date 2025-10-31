// Configuración del juego
const BOARD_SIZE = 8;
const CANDY_TYPES = ['🍭', '🍬', '🍫', '🍩', '🍪', '🧁'];
const INITIAL_MOVES = 30;

// Estado del juego
let board = [];
let score = 0;
let moves = INITIAL_MOVES;
let selectedCandy = null;
let isProcessing = false;

// Elementos DOM
const boardElement = document.getElementById('board');
const scoreElement = document.getElementById('score');
const movesElement = document.getElementById('moves');
const resetBtn = document.getElementById('resetBtn');
const gameOverElement = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const playAgainBtn = document.getElementById('playAgainBtn');

// Inicializar juego
function initGame() {
    board = [];
    score = 0;
    moves = INITIAL_MOVES;
    selectedCandy = null;
    isProcessing = false;
    
    updateScore();
    updateMoves();
    createBoard();
    renderBoard();
    
    // Asegurar que no haya matches iniciales
    while (findMatches().length > 0) {
        createBoard();
    }
    renderBoard();
}

// Crear tablero
function createBoard() {
    board = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col] = getRandomCandy();
        }
    }
}

// Obtener dulce aleatorio
function getRandomCandy() {
    return CANDY_TYPES[Math.floor(Math.random() * CANDY_TYPES.length)];
}

// Renderizar tablero
function renderBoard() {
    boardElement.innerHTML = '';
    
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const candy = document.createElement('div');
            candy.className = 'candy';
            candy.textContent = board[row][col];
            candy.dataset.row = row;
            candy.dataset.col = col;
            candy.addEventListener('click', () => handleCandyClick(row, col));
            boardElement.appendChild(candy);
        }
    }
}

// Manejar click en dulce
function handleCandyClick(row, col) {
    if (isProcessing || moves <= 0) return;
    
    const clickedCandy = { row, col };
    
    if (!selectedCandy) {
        // Seleccionar primer dulce
        selectedCandy = clickedCandy;
        highlightCandy(row, col, true);
    } else {
        // Verificar si es adyacente
        if (isAdjacent(selectedCandy, clickedCandy)) {
            highlightCandy(selectedCandy.row, selectedCandy.col, false);
            swapCandies(selectedCandy, clickedCandy);
            selectedCandy = null;
        } else {
            // Cambiar selección
            highlightCandy(selectedCandy.row, selectedCandy.col, false);
            selectedCandy = clickedCandy;
            highlightCandy(row, col, true);
        }
    }
}

// Resaltar dulce
function highlightCandy(row, col, highlight) {
    const index = row * BOARD_SIZE + col;
    const candyElement = boardElement.children[index];
    if (highlight) {
        candyElement.classList.add('selected');
    } else {
        candyElement.classList.remove('selected');
    }
}

// Verificar si son adyacentes
function isAdjacent(candy1, candy2) {
    const rowDiff = Math.abs(candy1.row - candy2.row);
    const colDiff = Math.abs(candy1.col - candy2.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

// Intercambiar dulces
async function swapCandies(candy1, candy2) {
    isProcessing = true;
    
    // Intercambiar en el array
    const temp = board[candy1.row][candy1.col];
    board[candy1.row][candy1.col] = board[candy2.row][candy2.col];
    board[candy2.row][candy2.col] = temp;
    
    renderBoard();
    await sleep(300);
    
    // Verificar matches
    const matches = findMatches();
    
    if (matches.length > 0) {
        moves--;
        updateMoves();
        await processMatches();
        
        if (moves <= 0) {
            endGame();
        }
    } else {
        // Revertir intercambio si no hay matches
        board[candy2.row][candy2.col] = board[candy1.row][candy1.col];
        board[candy1.row][candy1.col] = temp;
        renderBoard();
    }
    
    isProcessing = false;
}

// Encontrar matches
function findMatches() {
    const matches = [];
    
    // Buscar matches horizontales
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE - 2; col++) {
            const candy = board[row][col];
            if (candy === board[row][col + 1] && candy === board[row][col + 2]) {
                const match = [{ row, col }];
                let c = col + 1;
                while (c < BOARD_SIZE && board[row][c] === candy) {
                    match.push({ row, col: c });
                    c++;
                }
                matches.push(match);
                col = c - 1;
            }
        }
    }
    
    // Buscar matches verticales
    for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE - 2; row++) {
            const candy = board[row][col];
            if (candy === board[row + 1][col] && candy === board[row + 2][col]) {
                const match = [{ row, col }];
                let r = row + 1;
                while (r < BOARD_SIZE && board[r][col] === candy) {
                    match.push({ row: r, col });
                    r++;
                }
                matches.push(match);
                row = r - 1;
            }
        }
    }
    
    return matches;
}

// Procesar matches
async function processMatches() {
    let matches = findMatches();
    
    while (matches.length > 0) {
        // Animar y eliminar matches
        for (const match of matches) {
            for (const { row, col } of match) {
                const index = row * BOARD_SIZE + col;
                boardElement.children[index].classList.add('matched');
            }
            score += match.length * 10;
        }
        
        updateScore();
        await sleep(500);
        
        // Eliminar dulces
        for (const match of matches) {
            for (const { row, col } of match) {
                board[row][col] = null;
            }
        }
        
        // Hacer caer dulces
        fallCandies();
        fillEmptySpaces();
        renderBoard();
        await sleep(300);
        
        matches = findMatches();
    }
}

// Hacer caer dulces
function fallCandies() {
    for (let col = 0; col < BOARD_SIZE; col++) {
        let emptyRow = BOARD_SIZE - 1;
        for (let row = BOARD_SIZE - 1; row >= 0; row--) {
            if (board[row][col] !== null) {
                if (row !== emptyRow) {
                    board[emptyRow][col] = board[row][col];
                    board[row][col] = null;
                }
                emptyRow--;
            }
        }
    }
}

// Llenar espacios vacíos
function fillEmptySpaces() {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] === null) {
                board[row][col] = getRandomCandy();
            }
        }
    }
}

// Actualizar puntuación
function updateScore() {
    scoreElement.textContent = score;
}

// Actualizar movimientos
function updateMoves() {
    movesElement.textContent = moves;
}

// Terminar juego
function endGame() {
    finalScoreElement.textContent = score;
    gameOverElement.classList.remove('hidden');
}

// Función de espera
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Event listeners
resetBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', () => {
    gameOverElement.classList.add('hidden');
    initGame();
});

// Iniciar juego al cargar
initGame();