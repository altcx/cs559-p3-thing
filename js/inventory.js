// Power-up inventory system
import { POWERUP_TYPES } from './powerups.js';

let inventory = [];
const MAX_INVENTORY_SIZE = 3;

export function addToInventory(powerUpType) {
    if (inventory.length < MAX_INVENTORY_SIZE) {
        inventory.push({
            type: powerUpType,
            id: Date.now() + Math.random() // Unique ID
        });
        updateInventoryUI();
        return true;
    }
    return false; // Inventory full
}

export function removeFromInventory(index) {
    if (index >= 0 && index < inventory.length) {
        const powerUp = inventory.splice(index, 1)[0];
        updateInventoryUI();
        return powerUp;
    }
    return null;
}

export function getInventory() {
    return [...inventory]; // Return copy
}

export function clearInventory() {
    inventory = [];
    updateInventoryUI();
}

function updateInventoryUI() {
    const inventoryContainer = document.getElementById('powerup-inventory');
    if (!inventoryContainer) return;
    
    inventoryContainer.innerHTML = '';
    
    inventory.forEach((powerUp, index) => {
        const slot = document.createElement('div');
        slot.className = 'powerup-slot';
        slot.style.cssText = `
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.5);
            border-radius: 10px;
            margin: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            position: relative;
        `;
        
        // Power-up icon/indicator
        const icon = document.createElement('div');
        icon.textContent = getPowerUpIcon(powerUp.type);
        icon.style.cssText = `
            font-size: 24px;
            color: white;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        `;
        
        // Hotkey indicator
        const hotkey = document.createElement('div');
        hotkey.textContent = (index + 1).toString();
        hotkey.style.cssText = `
            position: absolute;
            bottom: 2px;
            right: 4px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            font-weight: bold;
        `;
        
        // Tooltip - position it on the left side
        const tooltip = document.createElement('div');
        tooltip.textContent = getPowerUpTooltip(powerUp.type);
        tooltip.className = 'powerup-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            right: calc(100% + 8px);
            top: 50%;
            transform: translateY(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 1000;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
            max-width: 200px;
        `;
        
        // Arrow pointing right (toward the slot)
        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: absolute;
            left: 100%;
            top: 50%;
            transform: translateY(-50%);
            width: 0;
            height: 0;
            border-top: 6px solid transparent;
            border-bottom: 6px solid transparent;
            border-left: 6px solid rgba(0, 0, 0, 0.9);
        `;
        tooltip.appendChild(arrow);
        
        // Function to adjust tooltip position to stay on screen
        const adjustTooltipPosition = () => {
            const rect = slot.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            
            // Reset to left side
            tooltip.style.right = 'calc(100% + 8px)';
            tooltip.style.left = 'auto';
            tooltip.style.transform = 'translateY(-50%)';
            
            // Check if tooltip goes off left edge - if so, show on right side instead
            if (rect.left - tooltipRect.width - 8 < 10) {
                tooltip.style.right = 'auto';
                tooltip.style.left = 'calc(100% + 8px)';
                // Flip arrow to point left
                arrow.style.left = 'auto';
                arrow.style.right = '100%';
                arrow.style.borderLeft = 'none';
                arrow.style.borderRight = '6px solid rgba(0, 0, 0, 0.9)';
            }
        };
        
        slot.appendChild(icon);
        slot.appendChild(hotkey);
        slot.appendChild(tooltip);
        
        // Show tooltip on hover
        slot.onmouseenter = () => {
            slot.style.background = 'rgba(255, 255, 255, 0.3)';
            slot.style.transform = 'scale(1.1)';
            // Adjust position before showing
            adjustTooltipPosition();
            tooltip.style.opacity = '1';
        };
        slot.onmouseleave = () => {
            slot.style.background = 'rgba(255, 255, 255, 0.2)';
            slot.style.transform = 'scale(1)';
            tooltip.style.opacity = '0';
        };
        
        // Click to activate
        slot.addEventListener('click', () => {
            activatePowerUp(index);
        });
        
        inventoryContainer.appendChild(slot);
    });
}

function getPowerUpIcon(type) {
    switch (type) {
        case POWERUP_TYPES.SPEED_BOOST:
            return '⚡';
        case POWERUP_TYPES.SHARPSHOOTER:
            return '🎯';
        case POWERUP_TYPES.MAGNETIC_PULL:
            return '🧲';
        case POWERUP_TYPES.REWIND:
            return '↶';
        default:
            return '?';
    }
}

function getPowerUpTooltip(type) {
    switch (type) {
        case POWERUP_TYPES.SPEED_BOOST:
            return 'Speed Boost: 3x launch velocity';
        case POWERUP_TYPES.SHARPSHOOTER:
            return 'Sharpshooter: No arrow wobble';
        case POWERUP_TYPES.MAGNETIC_PULL:
            return 'Magnetic Pull: Attracted to hole';
        case POWERUP_TYPES.REWIND:
            return 'Rewind: Undo last shot';
        default:
            return 'Unknown power-up';
    }
}

function activatePowerUp(index) {
    // Check if hole complete screen is visible - don't allow activation
    const holeCompleteScreen = document.getElementById('hole-complete-screen');
    if (holeCompleteScreen) {
        const computedStyle = window.getComputedStyle(holeCompleteScreen);
        if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
            return; // Don't activate if score menu is showing
        }
    }
    
    // Check if main menu is visible
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) {
        const computedStyle = window.getComputedStyle(mainMenu);
        if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
            return; // Don't activate if main menu is showing
        }
    }
    
    const powerUp = removeFromInventory(index);
    if (powerUp) {
        // Dispatch event for power-up activation
        window.dispatchEvent(new CustomEvent('powerUpActivated', { detail: powerUp }));
    }
}

// Initialize inventory UI
export function initInventory() {
    // Create inventory container if it doesn't exist
    let inventoryContainer = document.getElementById('powerup-inventory');
    if (!inventoryContainer) {
        inventoryContainer = document.createElement('div');
        inventoryContainer.id = 'powerup-inventory';
        inventoryContainer.style.cssText = `
            position: absolute;
            bottom: 80px;
            right: 20px;
            display: flex;
            flex-direction: column;
            z-index: 100;
        `;
        document.body.appendChild(inventoryContainer);
    }
    
    updateInventoryUI();
}

// Keyboard shortcuts (1, 2, 3 to activate power-ups)
document.addEventListener('keydown', (event) => {
    const key = event.key;
    if (key >= '1' && key <= '3') {
        const index = parseInt(key) - 1;
        activatePowerUp(index);
    }
});

