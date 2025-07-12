document.addEventListener('DOMContentLoaded', () => {
    const difficultySelector = document.getElementById('difficulty');
    const gameBoard = document.getElementById('gameBoard');
    const resetButton = document.getElementById('resetButton');
    const mineCounter = document.getElementById('mineCounter');
    const timer = document.getElementById('timer');
    const messageArea = document.getElementById('messageArea');

    const settings = {
        easy: { rows: 9, cols: 9, mines: 10 },
        medium: { rows: 16, cols: 16, mines: 40 },
        hard: { rows: 16, cols: 30, mines: 99 }
    };

    let currentDifficulty = 'easy';
    let board = [];
    let isGameOver = false;
    let isFirstClick = true;
    let minesPlaced = false;
    let timerInterval = null;
    let time = 0;

    function initializeGame() {
        isGameOver = false;
        isFirstClick = true;
        minesPlaced = false;
        messageArea.textContent = '';
        stopTimer();
        time = 0;
        timer.textContent = 0;
        
        const { rows, cols, mines } = settings[currentDifficulty];
        mineCounter.textContent = mines;

        gameBoard.innerHTML = '';
        gameBoard.style.gridTemplateColumns = `repeat(${cols}, 25px)`;
        gameBoard.style.gridTemplateRows = `repeat(${rows}, 25px)`;

        generateSolvableBoard(); // Generate the board first

        for (let i = 0; i < rows * cols; i++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = i;
            cell.addEventListener('click', handleCellClick);
            cell.addEventListener('contextmenu', handleRightClick);
            gameBoard.appendChild(cell);
        }
    }

    function startTimer() {
        if (timerInterval) return;
        timerInterval = setInterval(() => {
            time++;
            timer.textContent = time;
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function generateSolvableBoard() {
        const { rows, cols, mines } = settings[currentDifficulty];
        const totalCells = rows * cols;

        // Reset board
        board = Array(totalCells).fill(null).map((_, index) => ({
            index,
            isMine: false,
            isOpened: false,
            isFlagged: false,
            adjacentMines: 0
        }));

        let minesPlaced = 0;
        let openCells = Array.from({ length: totalCells }, (_, i) => i);
        let closedCells = [];

        // 1. Place first mine randomly
        const firstMineIndex = Math.floor(Math.random() * totalCells);
        board[firstMineIndex].isMine = true;
        minesPlaced++;
        openCells.splice(openCells.indexOf(firstMineIndex), 1);
        closedCells.push(firstMineIndex);

        // 2. Place subsequent mines adjacent to open cells
        while (minesPlaced < mines) {
            // Find a random open cell that has at least one closed neighbor
            let suitableOpenCells = openCells.filter(cellIndex => {
                const neighbors = getNeighbors(cellIndex);
                return neighbors.some(neighborIndex => !board[neighborIndex].isMine);
            });

            if (suitableOpenCells.length === 0) {
                // This case should be rare, but as a fallback, place randomly
                let availableCells = openCells.filter(index => !board[index].isMine);
                if(availableCells.length === 0) break; // Should not happen
                let newMineIndex = availableCells[Math.floor(Math.random() * availableCells.length)];
                board[newMineIndex].isMine = true;
                minesPlaced++;
                openCells.splice(openCells.indexOf(newMineIndex), 1);
                closedCells.push(newMineIndex);
                continue;
            }

            let openCellIndex = suitableOpenCells[Math.floor(Math.random() * suitableOpenCells.length)];
            
            let neighbors = getNeighbors(openCellIndex);
            let availableNeighbors = neighbors.filter(n => !board[n].isMine && !board[n].isFlagged);

            if (availableNeighbors.length > 0) {
                let newMineIndex = availableNeighbors[Math.floor(Math.random() * availableNeighbors.length)];
                board[newMineIndex].isMine = true;
                minesPlaced++;
                // Move from open to closed, but it was never really "open" in the UI sense
                const openCellIdxInArray = openCells.indexOf(newMineIndex);
                if(openCellIdxInArray > -1) {
                   openCells.splice(openCellIdxInArray, 1);
                }
                closedCells.push(newMineIndex);
            }
        }

        // 3. Calculate adjacent mines for all cells
        for (let i = 0; i < totalCells; i++) {
            if (board[i].isMine) continue;
            const neighbors = getNeighbors(i);
            board[i].adjacentMines = neighbors.filter(n => board[n].isMine).length;
        }
        minesPlaced = true;
    }
    
    function getNeighbors(index) {
        const { rows, cols } = settings[currentDifficulty];
        const neighbors = [];
        const r = Math.floor(index / cols);
        const c = index % cols;

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const newRow = r + i;
                const newCol = c + j;
                if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
                    neighbors.push(newRow * cols + newCol);
                }
            }
        }
        return neighbors;
    }


    function handleCellClick(event) {
        if (isGameOver) return;

        const index = parseInt(event.target.dataset.index);
        
        if (isFirstClick) {
            ensureSafeFirstClick(index);
            isFirstClick = false;
            startTimer();
        }

        const cellData = board[index];
        if (cellData.isFlagged || cellData.isOpened) return;

        if (cellData.isMine) {
            gameOver(false);
            return;
        }

        openCell(index);
        
        checkForWin();
    }

    function ensureSafeFirstClick(clickedIndex) {
        const safeZone = getNeighbors(clickedIndex);
        safeZone.push(clickedIndex);

        const minesToMove = safeZone.filter(index => board[index].isMine);

        if (minesToMove.length > 0) {
            let availableCells = [];
            for (let i = 0; i < board.length; i++) {
                if (!board[i].isMine && !safeZone.includes(i)) {
                    availableCells.push(i);
                }
            }

            minesToMove.forEach(mineIndex => {
                if (availableCells.length > 0) {
                    const newIndex = availableCells.splice(Math.floor(Math.random() * availableCells.length), 1)[0];
                    board[mineIndex].isMine = false;
                    board[newIndex].isMine = true;
                } else {
                    // This should be extremely rare, but handle it.
                    console.error("Could not find a safe place to move the mine.");
                }
            });

            // Recalculate all numbers after moving mines
            for (let i = 0; i < board.length; i++) {
                if (!board[i].isMine) {
                    board[i].adjacentMines = getNeighbors(i).filter(n => board[n].isMine).length;
                }
            }
        }
    }

    function checkForWin() {
        const { mines } = settings[currentDifficulty];
        const openedCells = board.filter(cell => cell.isOpened).length;
        const totalCells = board.length;

        if (totalCells - openedCells === mines) {
            gameOver(true);
        }
    }

    function openCell(index) {
        const cellData = board[index];
        if (cellData.isOpened) return;

        cellData.isOpened = true;
        const cellElement = gameBoard.children[index];
        cellElement.classList.add('opened');

        if (cellData.adjacentMines > 0) {
            cellElement.textContent = cellData.adjacentMines;
            // Optional: Add classes for different numbers for styling
            cellElement.classList.add(`c${cellData.adjacentMines}`); 
        } else {
            // If no adjacent mines, open neighbors
            const neighbors = getNeighbors(index);
            neighbors.forEach(neighborIndex => {
                const neighborData = board[neighborIndex];
                if (!neighborData.isOpened && !neighborData.isFlagged) {
                    openCell(neighborIndex);
                }
            });
        }
    }

    function gameOver(isWin) {
        isGameOver = true;
        stopTimer();
        revealMines();
        messageArea.textContent = isWin ? 'You Win!' : 'Game Over!';
        messageArea.className = isWin ? '' : 'game-over';
    }

    function revealMines() {
        for (let i = 0; i < board.length; i++) {
            if (board[i].isMine) {
                const cellElement = gameBoard.children[i];
                cellElement.classList.add('mine');
                cellElement.textContent = '💣'; // Display a bomb emoji
            }
        }
    }

    function handleRightClick(event) {
        event.preventDefault();
        if (isGameOver) return;

        const index = parseInt(event.target.dataset.index);
        const cellData = board[index];
        const cellElement = gameBoard.children[index];

        if (cellData.isOpened) return;

        // Toggle flag
        cellData.isFlagged = !cellData.isFlagged;

        if (cellData.isFlagged) {
            cellElement.classList.add('flagged');
            cellElement.textContent = '🚩'; // Flag emoji
        } else {
            cellElement.classList.remove('flagged');
            cellElement.textContent = '';
        }

        updateMineCounter();
    }

    function updateMineCounter() {
        const { mines } = settings[currentDifficulty];
        const flaggedCells = board.filter(cell => cell.isFlagged).length;
        mineCounter.textContent = mines - flaggedCells;
    }

    resetButton.addEventListener('click', initializeGame);
    difficultySelector.addEventListener('change', (e) => {
        currentDifficulty = e.target.value;
        initializeGame();
    });

    // Initial game setup
    initializeGame();
});
