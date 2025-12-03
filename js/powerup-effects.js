// Power-up effects and activation
import { getBallVelocity, setBallVelocity } from './ball.js';

let activePowerUps = new Map(); // Map of active power-up effects

export function activateSpeedBoost() {
    // Speed Boost: Increases ball launch velocity by 3.0x (doubled from 1.5x)
    // This will be applied when the ball is launched
    const effectId = 'speed_boost_' + Date.now();
    
    activePowerUps.set(effectId, {
        type: 'SPEED_BOOST',
        multiplier: 3.0, // Doubled from 1.5x
        duration: 1, // Lasts for 1 shot
        createdAt: Date.now()
    });
    
    // Visual effect - could add particle burst here
    console.log('Speed Boost activated! (3.0x multiplier)');
    
    return effectId;
}

export function getSpeedBoostMultiplier() {
    // Check if speed boost is active
    for (const [id, effect] of activePowerUps.entries()) {
        if (effect.type === 'SPEED_BOOST') {
            return effect.multiplier;
        }
    }
    return 1.0; // No speed boost
}

export function consumeSpeedBoost() {
    // Remove speed boost after use (one shot only)
    for (const [id, effect] of activePowerUps.entries()) {
        if (effect.type === 'SPEED_BOOST') {
            activePowerUps.delete(id);
            break;
        }
    }
}

export function activateSharpshooter() {
    // Sharpshooter: Stops arrow wobble when aiming
    const effectId = 'sharpshooter_' + Date.now();
    
    activePowerUps.set(effectId, {
        type: 'SHARPSHOOTER',
        duration: 1, // Lasts for 1 shot
        createdAt: Date.now()
    });
    
    console.log('Sharpshooter activated! Arrow wobble disabled for next shot.');
    
    return effectId;
}

export function isSharpshooterActive() {
    // Check if sharpshooter is active
    for (const [id, effect] of activePowerUps.entries()) {
        if (effect.type === 'SHARPSHOOTER') {
            return true;
        }
    }
    return false;
}

export function consumeSharpshooter() {
    // Remove sharpshooter after use (one shot only)
    for (const [id, effect] of activePowerUps.entries()) {
        if (effect.type === 'SHARPSHOOTER') {
            activePowerUps.delete(id);
            break;
        }
    }
}

export function activateMagneticPull() {
    // Magnetic Pull: Ball is attracted to hole when within range
    // Lasts until hole is completed
    const effectId = 'magnetic_pull_' + Date.now();
    
    activePowerUps.set(effectId, {
        type: 'MAGNETIC_PULL',
        strength: 0.5, // Pull force strength
        range: 8.0, // Range in units where pull is active (reduced from 15.0)
        createdAt: Date.now()
    });
    
    console.log('Magnetic Pull activated! Ball will be attracted to hole.');
    
    return effectId;
}

export function isMagneticPullActive() {
    // Check if magnetic pull is active
    for (const [id, effect] of activePowerUps.entries()) {
        if (effect.type === 'MAGNETIC_PULL') {
            return true;
        }
    }
    return false;
}

export function getMagneticPullEffect() {
    // Get the magnetic pull effect data
    for (const [id, effect] of activePowerUps.entries()) {
        if (effect.type === 'MAGNETIC_PULL') {
            return effect;
        }
    }
    return null;
}

export function clearAllPowerUps() {
    activePowerUps.clear();
}

export function clearMagneticPull() {
    // Clear only Magnetic Pull power-up (called when hole is completed)
    for (const [id, effect] of activePowerUps.entries()) {
        if (effect.type === 'MAGNETIC_PULL') {
            activePowerUps.delete(id);
            console.log('Magnetic Pull cleared - hole completed');
        }
    }
}

export function activateRewind() {
    // Rewind: Undo the last shot (reset ball position/velocity, decrement stroke)
    const effectId = 'rewind_' + Date.now();
    
    activePowerUps.set(effectId, {
        type: 'REWIND',
        createdAt: Date.now()
    });
    
    console.log('Rewind activated! Undoing last shot.');
    
    return effectId;
}

