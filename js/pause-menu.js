// Pause menu system
let pauseMenu = null;
let isPaused = false;

export function initPauseMenu() {
    // Create pause menu overlay
    pauseMenu = document.createElement('div');
    pauseMenu.id = 'pause-menu';
    pauseMenu.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 2000;
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
    `;
    
    pauseMenu.innerHTML = `
        <h1 style="font-size: 64px; margin-bottom: 40px; text-shadow: 4px 4px 8px rgba(0, 0, 0, 0.9);">Paused</h1>
        <div style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
            <button id="resume-btn" style="
                padding: 20px 40px;
                font-size: 28px;
                font-weight: bold;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            ">Resume</button>
            <button id="exit-to-menu-btn" style="
                padding: 20px 40px;
                font-size: 28px;
                font-weight: bold;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            ">Exit to Menu</button>
        </div>
    `;
    
    document.body.appendChild(pauseMenu);
    
    // Button hover effects
    const resumeBtn = document.getElementById('resume-btn');
    const exitBtn = document.getElementById('exit-to-menu-btn');
    
    resumeBtn.onmouseenter = () => {
        resumeBtn.style.transform = 'scale(1.05)';
        resumeBtn.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
    };
    resumeBtn.onmouseleave = () => {
        resumeBtn.style.transform = 'scale(1)';
        resumeBtn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
    };
    
    exitBtn.onmouseenter = () => {
        exitBtn.style.transform = 'scale(1.05)';
        exitBtn.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
    };
    exitBtn.onmouseleave = () => {
        exitBtn.style.transform = 'scale(1)';
        exitBtn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
    };
    
    // Resume button
    resumeBtn.addEventListener('click', () => {
        hidePauseMenu();
    });
    
    // Exit to menu button
    exitBtn.addEventListener('click', () => {
        hidePauseMenu();
        // Dispatch event to return to main menu
        window.dispatchEvent(new CustomEvent('exitToMenu'));
    });
    
    // ESC key to toggle pause
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // Don't pause if main menu is visible
            const mainMenu = document.getElementById('main-menu');
            if (mainMenu && window.getComputedStyle(mainMenu).display !== 'none') {
                return;
            }
            
            // Don't pause if hole complete screen is visible
            const holeCompleteScreen = document.getElementById('hole-complete-screen');
            if (holeCompleteScreen && window.getComputedStyle(holeCompleteScreen).display !== 'none') {
                return;
            }
            
            togglePauseMenu();
        }
    });
}

export function showPauseMenu() {
    if (pauseMenu) {
        pauseMenu.style.display = 'flex';
        isPaused = true;
    }
}

export function hidePauseMenu() {
    if (pauseMenu) {
        pauseMenu.style.display = 'none';
        isPaused = false;
    }
}

export function togglePauseMenu() {
    if (isPaused) {
        hidePauseMenu();
    } else {
        showPauseMenu();
    }
}

export function getIsPaused() {
    return isPaused;
}

