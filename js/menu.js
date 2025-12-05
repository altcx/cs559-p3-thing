import { 
    getAvailableCosmetics, getSelectedCosmeticId, setSelectedCosmetic,
    getAvailableSkins, getSelectedSkinId, setSelectedSkin,
    createCosmeticPreview 
} from './cosmetics.js';

// Main menu system
let menuScreen = null;
let menuContent = null;
let isMenuVisible = true;

function createMainMenuHTML() {
    return `
        <div style="text-align: center; margin-bottom: 60px; z-index: 10;">
            <h1 style="
                font-family: 'BM SPACE', monospace;
                font-size: 100px; 
                margin-bottom: 20px; 
                color: #fff;
                text-shadow: 4px 4px 0px #ff00ff, -4px -4px 0px #00ffff;
                text-transform: uppercase;
                letter-spacing: 8px;
                animation: glitch 2s infinite;
            ">Mini Golf</h1>
        </div>
        <div style="display: flex; flex-direction: column; gap: 30px; align-items: center; z-index: 10;">
            <button id="play-5-holes-btn" style="
                font-family: 'BM SPACE', monospace;
                padding: 20px 40px;
                font-size: 28px;
                background: rgba(0, 0, 0, 0.8);
                color: #00ff00;
                border: 4px solid #00ff00;
                cursor: pointer;
                min-width: 400px;
                box-shadow: 8px 8px 0px #005500;
                transition: all 0.1s;
                text-transform: uppercase;
                position: relative;
            ">
                Play 5 Holes
            </button>
            <button id="select-level-btn" style="
                font-family: 'BM SPACE', monospace;
                padding: 20px 40px;
                font-size: 28px;
                background: rgba(0, 0, 0, 0.8);
                color: #00ffff;
                border: 4px solid #00ffff;
                cursor: pointer;
                min-width: 400px;
                box-shadow: 8px 8px 0px #005555;
                transition: all 0.1s;
                text-transform: uppercase;
                position: relative;
            ">
                Select Level
            </button>
            <button id="cosmetics-btn" style="
                font-family: 'BM SPACE', monospace;
                padding: 20px 40px;
                font-size: 28px;
                background: rgba(0, 0, 0, 0.8);
                color: #ff00ff;
                border: 4px solid #ff00ff;
                cursor: pointer;
                min-width: 400px;
                box-shadow: 8px 8px 0px #550055;
                transition: all 0.1s;
                text-transform: uppercase;
                position: relative;
            ">
                Customize Ball
            </button>
        </div>
        <style>
            @keyframes glitch {
                0% { transform: translate(0) }
                20% { transform: translate(-2px, 2px) }
                40% { transform: translate(-2px, -2px) }
                60% { transform: translate(2px, 2px) }
                80% { transform: translate(2px, -2px) }
                100% { transform: translate(0) }
            }
        </style>
    `;
}

function attachMainMenuListeners() {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
        const playBtn = document.getElementById('play-5-holes-btn');
        const selectLevelBtn = document.getElementById('select-level-btn');
        const cosmeticsBtn = document.getElementById('cosmetics-btn');
        
        if (!playBtn) {
            console.error('Menu button not found:', { playBtn: !!playBtn });
            return;
        }
        
        // Helper for pixel button hover effect
        const addPixelHover = (btn, color, shadowColor) => {
            btn.onmouseover = () => {
                btn.style.transform = 'translate(-4px, -4px)';
                btn.style.boxShadow = `12px 12px 0px ${shadowColor}`;
                btn.style.background = 'rgba(0, 0, 0, 1)';
            };
            btn.onmouseout = () => {
                btn.style.transform = 'translate(0, 0)';
                btn.style.boxShadow = `8px 8px 0px ${shadowColor}`;
                btn.style.background = 'rgba(0, 0, 0, 0.8)';
            };
            btn.onmousedown = () => {
                btn.style.transform = 'translate(0, 0)';
                btn.style.boxShadow = `4px 4px 0px ${shadowColor}`;
            };
            btn.onmouseup = () => {
                btn.style.transform = 'translate(-4px, -4px)';
                btn.style.boxShadow = `12px 12px 0px ${shadowColor}`;
            };
        };

        addPixelHover(playBtn, '#00ff00', '#005500');
        
        playBtn.onclick = () => {
            hideMenu();
            window.dispatchEvent(new CustomEvent('startGame', { detail: { mode: '5holes', startHole: 0 } }));
        };
        
        if (selectLevelBtn) {
            addPixelHover(selectLevelBtn, '#00ffff', '#005555');
            selectLevelBtn.onclick = () => {
                showHoleSelection();
            };
        }
        
        if (cosmeticsBtn) {
            addPixelHover(cosmeticsBtn, '#ff00ff', '#550055');
            cosmeticsBtn.onclick = () => {
                showCosmeticsMenu();
            };
        }
    }, 0);
}

export function initMenu() {
    // If menuScreen already exists, just restore its content instead of creating a new one
    if (menuScreen && document.body.contains(menuScreen)) {
        if (menuContent) {
            menuContent.innerHTML = createMainMenuHTML();
            attachMainMenuListeners();
        }
        menuScreen.style.display = 'flex';
        isMenuVisible = true;
        
        // Ensure video is playing
        const video = menuScreen.querySelector('video');
        if (video && video.paused) {
            video.play().catch(e => console.log("Video resume failed:", e));
        }
        return;
    }
    
    // Create menu screen overlay only if it doesn't exist
    menuScreen = document.createElement('div');
    menuScreen.id = 'main-menu';
    menuScreen.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000; /* Solid black background for 100% opacity */
        z-index: 1000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        overflow: hidden;
    `;
    
    // Add video background (Persistent)
    const videoBg = document.createElement('video');
    videoBg.src = 'mp4s/pinkaurora.mp4';
    videoBg.autoplay = true;
    videoBg.loop = true;
    videoBg.muted = true;
    videoBg.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 0;
        filter: brightness(0.6);
    `;
    menuScreen.appendChild(videoBg);
    
    // Ensure video plays
    videoBg.play().catch(e => console.log("Video autoplay failed:", e));
    
    // Create content container
    menuContent = document.createElement('div');
    menuContent.id = 'menu-content';
    menuContent.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    `;
    menuScreen.appendChild(menuContent);
    
    // Set initial content
    menuContent.innerHTML = createMainMenuHTML();
    
    document.body.appendChild(menuScreen);
    
    // Add event listeners
    attachMainMenuListeners();
}

export function showMenu() {
    // Hide in-game HUD when menu is visible
    import('./hud.js').then(hud => hud.setHUDVisibility(false)).catch(() => {});
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
    import('./hud.js').then(hud => hud.setHUDVisibility(true)).catch(() => {});
}

export function showHoleSelection() {
    if (!menuContent) {
        console.error('menuContent is null, cannot show hole selection');
        return;
    }
    
    // Clear any existing content
    menuContent.innerHTML = '';
    
    // Create title with better styling
    const title = document.createElement('h1');
    title.textContent = 'Select Hole';
    title.style.cssText = `
        font-family: 'BM SPACE', monospace;
        font-size: 60px; 
        margin-bottom: 40px; 
        color: #fff;
        text-shadow: 4px 4px 0px #00ffff;
        text-transform: uppercase;
        letter-spacing: 4px;
    `;
    menuContent.appendChild(title);
    
    // Create hole grid
    const holeGrid = document.createElement('div');
    holeGrid.id = 'hole-grid';
    holeGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        max-width: 800px;
        margin-bottom: 30px;
    `;
    menuContent.appendChild(holeGrid);
    
    // Create buttons for each hole (1-5) with better styling
    const colors = [
        '#00ff00', // Green
        '#ff00ff', // Magenta
        '#00ffff', // Cyan
        '#ffff00', // Yellow
        '#ff0000'  // Red
    ];
    
    for (let i = 1; i <= 5; i++) {
        const holeBtn = document.createElement('button');
        holeBtn.textContent = `Hole ${i}`;
        const color = colors[i - 1];
        holeBtn.style.cssText = `
            font-family: 'BM SPACE', monospace;
            padding: 20px;
            font-size: 24px;
            background: rgba(0,0,0,0.8);
            color: ${color};
            border: 4px solid ${color};
            cursor: pointer;
            transition: all 0.1s;
            box-shadow: 8px 8px 0px rgba(255,255,255,0.2);
            min-width: 150px;
            text-transform: uppercase;
        `;
        
        holeBtn.onmouseover = () => {
            holeBtn.style.transform = 'translate(-4px, -4px)';
            holeBtn.style.boxShadow = `12px 12px 0px ${color}`;
            holeBtn.style.background = 'rgba(0,0,0,1)';
        };
        holeBtn.onmouseout = () => {
            holeBtn.style.transform = 'translate(0, 0)';
            holeBtn.style.boxShadow = '8px 8px 0px rgba(255,255,255,0.2)';
            holeBtn.style.background = 'rgba(0,0,0,0.8)';
        };
        
        holeBtn.addEventListener('click', () => {
            hideMenu();
            window.dispatchEvent(new CustomEvent('startGame', { detail: { mode: 'single', startHole: i - 1 } }));
        });
        holeGrid.appendChild(holeBtn);
    }
    
    // Create back button with better styling
    const backBtn = document.createElement('button');
    backBtn.id = 'back-to-menu-btn';
    backBtn.textContent = '< BACK';
    backBtn.style.cssText = `
        font-family: 'BM SPACE', monospace;
        padding: 15px 30px;
        font-size: 24px;
        background: #000;
        color: #fff;
        border: 4px solid #fff;
        cursor: pointer;
        transition: all 0.1s;
        box-shadow: 6px 6px 0px #555;
        text-transform: uppercase;
    `;
    backBtn.onmouseover = () => {
        backBtn.style.transform = 'translate(-2px, -2px)';
        backBtn.style.boxShadow = '8px 8px 0px #fff';
    };
    backBtn.onmouseout = () => {
        backBtn.style.transform = 'translate(0, 0)';
        backBtn.style.boxShadow = '6px 6px 0px #555';
    };
    backBtn.addEventListener('click', () => {
        // Restore main menu HTML
        menuContent.innerHTML = createMainMenuHTML();
        // Use setTimeout to ensure DOM is ready before attaching listeners
        setTimeout(() => {
            attachMainMenuListeners();
        }, 0);
    });
    menuContent.appendChild(backBtn);
}

function showCosmeticsMenu() {
    if (!menuContent) {
        console.error('menuContent is null, cannot show cosmetics menu');
        return;
    }
    
    // Get all cosmetics data
    const availableHats = getAvailableCosmetics();
    const availableSkins = getAvailableSkins();
    
    let selectedHatId = getSelectedCosmeticId();
    let selectedSkinId = getSelectedSkinId();
    
    let currentTab = 'hats';
    let previewHandle = null;
    
    menuContent.innerHTML = '';
    
    // Main container with horizontal layout
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        flex-direction: row;
        align-items: stretch;
        width: 100%;
        height: 100%;
        padding: 30px;
        box-sizing: border-box;
        gap: 30px;
    `;
    menuContent.appendChild(container);
    
    // LEFT SIDE - Preview area
    const previewColumn = document.createElement('div');
    previewColumn.style.cssText = `
        flex: 0 0 45%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 20px;
        padding: 30px;
    `;
    container.appendChild(previewColumn);
    
    const previewWrapper = document.createElement('div');
    previewWrapper.style.cssText = `
        width: 100%;
        aspect-ratio: 1;
        max-width: 450px;
        border-radius: 15px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.5);
        overflow: hidden;
    `;
    previewColumn.appendChild(previewWrapper);
    
    // Create the 3D preview
    previewHandle = createCosmeticPreview(previewWrapper);
    previewHandle.setCosmetic(selectedHatId);
    previewHandle.setSkin(selectedSkinId);
    
    // RIGHT SIDE - Selection area
    const selectionColumn = document.createElement('div');
    selectionColumn.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 15px;
        overflow: hidden;
    `;
    container.appendChild(selectionColumn);
    
    // Title
    const title = document.createElement('h1');
    title.textContent = 'Customize Ball';
    title.style.cssText = `
        font-family: 'BM SPACE', monospace;
        font-size: 40px;
        margin: 0;
        color: #fff;
        text-shadow: 4px 4px 0px #ff00ff;
        text-transform: uppercase;
    `;
    selectionColumn.appendChild(title);
    
    // Tab buttons
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
        display: flex;
        gap: 10px;
    `;
    selectionColumn.appendChild(tabContainer);
    
    const tabs = [
        { id: 'hats', label: 'HATS' },
        { id: 'skins', label: 'SKINS' }
    ];
    
    const tabButtons = {};
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding-right: 10px;
    `;
    
    const updateTabStyles = () => {
        tabs.forEach(tab => {
            const btn = tabButtons[tab.id];
            if (tab.id === currentTab) {
                btn.style.background = '#ff00ff';
                btn.style.color = '#000';
                btn.style.boxShadow = '4px 4px 0px #fff';
            } else {
                btn.style.background = '#000';
                btn.style.color = '#fff';
                btn.style.boxShadow = 'none';
            }
        });
    };
    
    const renderContent = () => {
        contentArea.innerHTML = '';
        
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        `;
        contentArea.appendChild(grid);
        
        let items, selectedId, onSelect;
        
        if (currentTab === 'hats') {
            items = availableHats;
            selectedId = selectedHatId;
            onSelect = (id) => {
                setSelectedCosmetic(id);
                selectedHatId = id;
                previewHandle.setCosmetic(id);
            };
        } else if (currentTab === 'skins') {
            items = availableSkins;
            selectedId = selectedSkinId;
            onSelect = (id) => {
                setSelectedSkin(id);
                selectedSkinId = id;
                previewHandle.setSkin(id);
            };
        }
        
        items.forEach(item => {
            const card = document.createElement('button');
            const isSelected = item.id === selectedId;
            card.style.cssText = `
                font-family: 'BM SPACE', monospace;
                background: ${isSelected ? 'rgba(255, 0, 255, 0.2)' : 'rgba(0, 0, 0, 0.5)'};
                border-radius: 0;
                padding: 15px;
                border: 2px solid ${isSelected ? '#ff00ff' : '#555'};
                cursor: pointer;
                transition: all 0.1s ease;
                display: flex;
                flex-direction: column;
                gap: 5px;
                text-align: left;
                color: #fff;
                ${isSelected ? 'box-shadow: 4px 4px 0px #ff00ff;' : ''}
            `;
            
            card.onmouseover = () => {
                if (item.id !== selectedId) {
                    card.style.border = '2px solid #fff';
                    card.style.transform = 'translate(-2px, -2px)';
                    card.style.boxShadow = '4px 4px 0px #fff';
                }
            };
            card.onmouseout = () => {
                if (item.id !== selectedId) {
                    card.style.border = '2px solid #555';
                    card.style.transform = 'translate(0, 0)';
                    card.style.boxShadow = 'none';
                }
            };
            
            // Color preview for skins
            if (currentTab === 'skins' && item.color) {
                const colorPreview = document.createElement('div');
                colorPreview.style.cssText = `
                    width: 30px;
                    height: 30px;
                    background: #${item.color.toString(16).padStart(6, '0')};
                    border: 2px solid #fff;
                    margin-bottom: 5px;
                `;
                card.appendChild(colorPreview);
            } else if (currentTab === 'skins' && item.isAnimated) {
                const colorPreview = document.createElement('div');
                let bg = 'linear-gradient(135deg, red, orange, yellow, green, blue, purple)';
                if (item.id === 'pulse') bg = 'linear-gradient(135deg, #0000ff, #ff0000)';
                
                colorPreview.style.cssText = `
                    width: 30px;
                    height: 30px;
                    background: ${bg};
                    border: 2px solid #fff;
                    margin-bottom: 5px;
                `;
                card.appendChild(colorPreview);
            }
            
            const nameEl = document.createElement('h3');
            nameEl.textContent = item.name;
            nameEl.style.cssText = `
                font-size: 14px;
                margin: 0;
                color: ${isSelected ? '#ff00ff' : '#fff'};
                font-weight: normal;
                text-transform: uppercase;
            `;
            card.appendChild(nameEl);
            
            card.addEventListener('click', () => {
                onSelect(item.id);
                renderContent(); // Re-render to update selection styles
            });
            
            grid.appendChild(card);
        });
    };
    
    tabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.textContent = tab.label;
        btn.style.cssText = `
            font-family: 'BM SPACE', monospace;
            padding: 10px 20px;
            font-size: 16px;
            border: 2px solid #fff;
            cursor: pointer;
            transition: all 0.1s ease;
            text-transform: uppercase;
        `;
        btn.addEventListener('click', () => {
            currentTab = tab.id;
            updateTabStyles();
            renderContent();
        });
        tabContainer.appendChild(btn);
        tabButtons[tab.id] = btn;
    });
    
    selectionColumn.appendChild(contentArea);
    
    // Initialize
    updateTabStyles();
    renderContent();
    
    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = '< BACK';
    backBtn.style.cssText = `
        font-family: 'BM SPACE', monospace;
        padding: 12px 25px;
        font-size: 18px;
        background: #000;
        color: #fff;
        border: 2px solid #fff;
        cursor: pointer;
        transition: all 0.1s ease;
        box-shadow: 4px 4px 0px #555;
        align-self: flex-start;
        margin-top: 10px;
    `;
    backBtn.onmouseover = () => {
        backBtn.style.transform = 'translate(-2px, -2px)';
        backBtn.style.boxShadow = '6px 6px 0px #fff';
    };
    backBtn.onmouseout = () => {
        backBtn.style.transform = 'translate(0, 0)';
        backBtn.style.boxShadow = '4px 4px 0px #555';
    };
    backBtn.addEventListener('click', () => {
        if (previewHandle) previewHandle.dispose();
        menuContent.innerHTML = createMainMenuHTML();
        setTimeout(() => attachMainMenuListeners(), 0);
    });
    selectionColumn.appendChild(backBtn);
}

export function getMenuVisible() {
    return isMenuVisible;
}

