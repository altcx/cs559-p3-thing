// Main menu system
let menuScreen = null;
let isMenuVisible = true;

export function initMenu() {
    // Create menu screen overlay
    menuScreen = document.createElement('div');
    menuScreen.id = 'main-menu';
    menuScreen.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
    `;
    
    menuScreen.innerHTML = `
        <h1 style="font-size: 64px; margin-bottom: 40px; text-shadow: 4px 4px 8px rgba(0, 0, 0, 0.9);">Mini Golf</h1>
        <div style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
            <button id="play-9-holes-btn" style="
                padding: 20px 40px;
                font-size: 28px;
                font-weight: bold;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                min-width: 300px;
                transition: all 0.3s;
            " onmouseover="this.style.background='#45a049'; this.style.transform='scale(1.05)'" 
               onmouseout="this.style.background='#4CAF50'; this.style.transform='scale(1)'">
                Play 9 Holes
            </button>
            <button id="select-hole-btn" style="
                padding: 20px 40px;
                font-size: 28px;
                font-weight: bold;
                background: #2196F3;
                color: white;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                min-width: 300px;
                transition: all 0.3s;
            " onmouseover="this.style.background='#1976D2'; this.style.transform='scale(1.05)'" 
               onmouseout="this.style.background='#2196F3'; this.style.transform='scale(1)'">
                Select Hole
            </button>
        </div>
    `;
    
    document.body.appendChild(menuScreen);
    
    // Add event listeners
    document.getElementById('play-9-holes-btn').addEventListener('click', () => {
        hideMenu();
        window.dispatchEvent(new CustomEvent('startGame', { detail: { mode: '9holes', startHole: 0 } }));
    });
    
    document.getElementById('select-hole-btn').addEventListener('click', () => {
        showHoleSelection();
    });
}

export function showMenu() {
    if (menuScreen) {
        menuScreen.style.display = 'flex';
        isMenuVisible = true;
    }
}

export function hideMenu() {
    if (menuScreen) {
        menuScreen.style.display = 'none';
        isMenuVisible = false;
    }
}

export function showHoleSelection() {
    if (!menuScreen) return;
    
    menuScreen.innerHTML = `
        <h1 style="font-size: 48px; margin-bottom: 30px; text-shadow: 4px 4px 8px rgba(0, 0, 0, 0.9);">Select Hole</h1>
        <div id="hole-grid" style="
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            max-width: 800px;
            margin-bottom: 30px;
        "></div>
        <button id="back-to-menu-btn" style="
            padding: 15px 30px;
            font-size: 20px;
            background: #666;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        " onmouseover="this.style.background='#555'" onmouseout="this.style.background='#666'">
            Back to Menu
        </button>
    `;
    
    const holeGrid = document.getElementById('hole-grid');
    
    // Create buttons for each hole (1-9)
    for (let i = 1; i <= 9; i++) {
        const holeBtn = document.createElement('button');
        holeBtn.textContent = `Hole ${i}`;
        holeBtn.style.cssText = `
            padding: 30px;
            font-size: 24px;
            font-weight: bold;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s;
        `;
        holeBtn.onmouseover = () => {
            holeBtn.style.background = '#1976D2';
            holeBtn.style.transform = 'scale(1.05)';
        };
        holeBtn.onmouseout = () => {
            holeBtn.style.background = '#2196F3';
            holeBtn.style.transform = 'scale(1)';
        };
        holeBtn.addEventListener('click', () => {
            hideMenu();
            window.dispatchEvent(new CustomEvent('startGame', { detail: { mode: 'single', startHole: i - 1 } }));
        });
        holeGrid.appendChild(holeBtn);
    }
    
    document.getElementById('back-to-menu-btn').addEventListener('click', () => {
        initMenu(); // Recreate main menu
    });
}

export function getMenuVisible() {
    return isMenuVisible;
}

