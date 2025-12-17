// HUD elements (stroke counter, score display)
import * as THREE from 'three';
import { getStrokeCount, getPar, calculateRating, isComplete, getTotalScore, getHoleScores, getHolePosition, incrementStroke } from './game.js';
import { animateElement, Easing, triggerScreenShake, updateScreenShake } from './animations.js';
import { createFireworks, createGoldBurst, createSparkles, createParticleBurst, updateParticles } from './particles.js';
import { resetBall, setBallVelocity } from './ball.js';
import { resetCollisions } from './collisions.js';
import { restoreStartingCameraAngle, isFreeCamActive } from './main.js';
import { getGhostBallStrokes, isGhostBallActive } from './ghost-ball.js';
import { isGhostAIEnabled, getGhostAIState } from './ghost-ai.js';
import { areWASDControlsEnabled } from './controls.js';

// Export triggerRatingEffects so main.js can call it
export function triggerRatingEffects(rating, holePosition) {
    const holePos3D = new THREE.Vector3(holePosition.x, holePosition.y + 1, holePosition.z);
    
    switch (rating) {
        case 'HOLE_IN_ONE':
            // Screen shake + fireworks - 10x more intense
            triggerScreenShake(25, 1200); // Stronger shake, longer duration
            createFireworks(holePos3D, 8); // More bursts
            break;
            
        case 'EAGLE':
            // Gold particle burst - 10x more
            createGoldBurst(holePos3D, 100); // More particles
            break;
            
        case 'BIRDIE':
            // Silver sparkles - 10x more
            createSparkles(holePos3D, 80); // More particles
            break;
            
        case 'PAR':
            // Simple green particles - 10x more
            createParticleBurst(holePos3D, 0x00FF00, 200, 5.0); // 10x more particles and speed
            break;
            
        default:
            // Encouraging particles for over par - 10x more
            createParticleBurst(holePos3D, 0xFFA500, 150, 4.0); // 10x more particles and speed
            break;
    }
}

let strokeDisplay = null;
let parDisplay = null;
let ratingDisplay = null;
// totalScoreDisplay removed
let holeCompleteScreen = null;
let ratingTextDisplay = null; // Large rating text shown during pause
let resetButton = null;
let ghostBallIndicator = null; // Ghost ball status indicator
let cameraControlIndicator = null; // Camera freecam toggle indicator
let controlsDisplay = null; // Controls display panel
let hudVisible = true;

function applyHUDVisibility() {
    const display = hudVisible ? 'block' : 'none';
    if (strokeDisplay) strokeDisplay.style.display = display;
    if (parDisplay) parDisplay.style.display = display;
    // Total score display removed
    if (ghostBallIndicator) ghostBallIndicator.style.display = display;
    if (resetButton) resetButton.style.display = display;
    if (cameraControlIndicator) cameraControlIndicator.style.display = display;
    if (controlsDisplay) controlsDisplay.style.display = display;
}

export function setHUDVisibility(visible) {
    hudVisible = visible;
    applyHUDVisibility();
}

export function initHUD() {
    // Create stroke counter display
    strokeDisplay = document.createElement('div');
    strokeDisplay.id = 'stroke-display';
    strokeDisplay.style.cssText = `
        position: absolute;
        bottom: 80px;
        left: 20px;
        font-family: 'BM SPACE', monospace;
        color: #00ff00;
        font-size: 24px;
        background: rgba(0, 0, 0, 0.8);
        padding: 10px 15px;
        border: 2px solid #00ff00;
        z-index: 100;
        box-shadow: 4px 4px 0px #005500;
        text-transform: uppercase;
    `;
    document.body.appendChild(strokeDisplay);
    
    // Create par display
    parDisplay = document.createElement('div');
    parDisplay.id = 'par-display';
    parDisplay.style.cssText = `
        position: absolute;
        bottom: 80px;
        left: 280px;
        font-family: 'BM SPACE', monospace;
        color: #00ffff;
        font-size: 24px;
        background: rgba(0, 0, 0, 0.8);
        padding: 10px 15px;
        border: 2px solid #00ffff;
        z-index: 100;
        box-shadow: 4px 4px 0px #005555;
        text-transform: uppercase;
    `;
    document.body.appendChild(parDisplay);
    
    // Total score display removed to avoid blocking Full/Prototype button
    
    // Create camera control indicator
    cameraControlIndicator = document.createElement('div');
    cameraControlIndicator.id = 'camera-control-indicator';
    cameraControlIndicator.style.cssText = `
        position: absolute;
        bottom: 140px;
        left: 280px;
        font-family: 'BM SPACE', monospace;
        color: #88DDFF;
        font-size: 14px;
        background: rgba(0, 0, 0, 0.8);
        padding: 8px 12px;
        border: 2px solid #88DDFF;
        z-index: 100;
        line-height: 1.4;
        box-shadow: 4px 4px 0px #004466;
    `;
    cameraControlIndicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 18px; height: 18px; border: 1px solid #88DDFF; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">C</span>
            <span>FREECAM</span>
        </div>
    `;
    document.body.appendChild(cameraControlIndicator);
    
    // Create reset button - 3x bigger
    resetButton = document.createElement('button');
    resetButton.id = 'reset-level-btn';
    resetButton.textContent = '[R] RESET (+1)';
    resetButton.style.cssText = `
        position: absolute;
        top: 80px;
        left: 20px;
        font-family: 'BM SPACE', monospace;
        padding: 12px 18px;
        font-size: 18px;
        color: #ff0000;
        background: #000;
        border: 2px solid #ff0000;
        cursor: pointer;
        z-index: 100;
        box-shadow: 4px 4px 0px #550000;
        transition: transform 0.1s ease;
        text-transform: uppercase;
    `;
    resetButton.onmouseover = () => {
        resetButton.style.transform = 'translate(-2px, -2px)';
        resetButton.style.boxShadow = '6px 6px 0px #550000';
    };
    resetButton.onmouseout = () => {
        resetButton.style.transform = 'translate(0, 0)';
        resetButton.style.boxShadow = '4px 4px 0px #550000';
    };
    resetButton.onclick = () => {
        resetLevel();
    };
    document.body.appendChild(resetButton);

    // Create ghost ball status indicator
    ghostBallIndicator = document.createElement('div');
    ghostBallIndicator.id = 'ghost-ball-indicator';
    ghostBallIndicator.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 20px;
        font-family: 'BM SPACE', monospace;
        color: #88CCFF;
        font-size: 14px;
        background: rgba(0, 0, 0, 0.8);
        padding: 8px 12px;
        border: 2px solid #88CCFF;
        z-index: 100;
        line-height: 1.4;
        box-shadow: 4px 4px 0px #004466;
    `;
    ghostBallIndicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="width: 10px; height: 10px; background: #88CCFF; opacity: 1;"></span>
            <span style="font-weight: 600;">GHOST BALL</span>
        </div>
        <div style="font-size: 11px; color: #888;">
            [G] TOGGLE · [1/2/3] DIFF
        </div>
    `;
    document.body.appendChild(ghostBallIndicator);

    // Create controls display panel
    controlsDisplay = document.createElement('div');
    controlsDisplay.id = 'controls-display';
    controlsDisplay.style.cssText = `
        position: absolute;
        top: 80px;
        right: 20px;
        font-family: 'BM SPACE', monospace;
        color: #ffffff;
        font-size: 12px;
        background: rgba(0, 0, 0, 0.85);
        padding: 12px 16px;
        border: 2px solid #ffffff;
        z-index: 100;
        line-height: 1.6;
        box-shadow: 4px 4px 0px #555555;
        min-width: 200px;
        max-width: 280px;
    `;
        controlsDisplay.innerHTML = `
        <div style="font-weight: 700; font-size: 14px; color: #ffff00; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1px solid #555; padding-bottom: 4px;">
            CONTROLS
        </div>
        <div style="margin-bottom: 6px;">
            <span style="color: #00ff00; font-weight: 600;">AIM & SHOOT:</span>
        </div>
        <div style="margin-bottom: 8px; margin-left: 8px; font-size: 11px; color: #ccc; line-height: 1.5;">
            Click ball, drag back,<br>release to shoot
        </div>
        <div style="margin-bottom: 6px;">
            <span style="color: #ff0000; font-weight: 600;">[R]:</span>
            <span style="color: #ccc;"> Reset level (+1)</span>
        </div>
        <div style="margin-bottom: 6px;">
            <span style="color: #88DDFF; font-weight: 600;">[C]:</span>
            <span style="color: #ccc;"> Toggle freecam</span>
        </div>
    `;
    document.body.appendChild(controlsDisplay);

    applyHUDVisibility();

    // Create rating display (hidden initially)
    ratingDisplay = document.createElement('div');
    ratingDisplay.id = 'rating-display';
    ratingDisplay.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 64px;
        font-weight: bold;
        text-shadow: 4px 4px 8px rgba(0, 0, 0, 0.9);
        background: rgba(0, 0, 0, 0.8);
        padding: 30px 60px;
        border-radius: 10px;
        z-index: 200;
        display: none;
        text-align: center;
    `;
    document.body.appendChild(ratingDisplay);
    
    // Create large rating text display (shown during pause before menu)
    ratingTextDisplay = document.createElement('div');
    ratingTextDisplay.id = 'rating-text-display';
    ratingTextDisplay.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'BM SPACE', monospace;
        color: #FFD700;
        font-size: 120px;
        font-weight: bold;
        text-shadow: 8px 8px 0px #000;
        z-index: 250;
        display: none;
        text-align: center;
        pointer-events: none;
        opacity: 0;
    `;
    document.body.appendChild(ratingTextDisplay);
    
    // Create hole complete screen (hidden initially)
    holeCompleteScreen = document.createElement('div');
    holeCompleteScreen.id = 'hole-complete-screen';
    holeCompleteScreen.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'BM SPACE', monospace;
        color: #f7f7f7;
        font-size: 24px;
        background: rgba(0, 0, 0, 0.9);
        padding: 40px;
        border: 4px solid #fff;
        z-index: 300;
        display: none;
        text-align: left;
        min-width: 600px;
        box-shadow: 12px 12px 0px #555;
    `;
    document.body.appendChild(holeCompleteScreen);
}

export function updateHUD() {
    if (strokeDisplay) {
        strokeDisplay.textContent = `Strokes: ${getStrokeCount()}`;
    }
    
    if (parDisplay) {
        parDisplay.textContent = `Par: ${getPar()}`;
    }
    
    // Total score display removed
    
    // Update ghost ball indicator
    if (ghostBallIndicator && isGhostAIEnabled()) {
        const ghostState = getGhostAIState();
        const difficultyText = ghostState.config.difficulty;

        let statusText;
        let statusColor = '#88CCFF';

        if (ghostState.status === 'finished') {
            statusText = `Done: ${ghostState.ballState.strokes} strokes`;
        } else if (!ghostState.hasStarted) {
            // Show countdown during initial delay
            const remainingMs = ghostState.config.startDelayMs - (performance.now() - (ghostState.lastShotTimeMs || 0));
            const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
            statusText = `Starting in ${remainingSeconds}s`;
            statusColor = '#FFD700'; // Gold during countdown
        } else {
            statusText = `${ghostState.ballState.strokes} strokes`;
        }

        ghostBallIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="width: 10px; height: 10px; background: ${statusColor}; border-radius: 50%; opacity: 0.8;"></span>
                <span style="font-weight: 600;">Ghost: ${statusText}</span>
            </div>
            <div style="font-size: 11px; color: #888;">
                ${difficultyText} · [G] Toggle · [1/2/3] Difficulty
            </div>
        `;
        ghostBallIndicator.style.borderColor = 'rgba(136, 204, 255, 0.3)';
    } else if (ghostBallIndicator) {
        ghostBallIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="width: 10px; height: 10px; background: #555; border-radius: 50%; opacity: 0.5;"></span>
                <span style="font-weight: 600; color: #666;">Ghost: OFF</span>
            </div>
            <div style="font-size: 11px; color: #555;">
                [G] Toggle · [1/2/3] Difficulty
            </div>
        `;
        ghostBallIndicator.style.borderColor = 'rgba(85, 85, 85, 0.3)';
    }

    // Update camera control indicator
    if (cameraControlIndicator) {
        const freecamActive = isFreeCamActive();
        if (freecamActive) {
            cameraControlIndicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 18px; height: 18px; background: rgba(88, 221, 255, 0.4); border: 1px solid rgba(88, 221, 255, 0.8); border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff;">C</span>
                    <span style="color: #88DDFF; font-weight: 600;">Freecam ON</span>
                </div>
            `;
            cameraControlIndicator.style.borderColor = 'rgba(136, 221, 255, 0.6)';
            cameraControlIndicator.style.background = 'rgba(20, 40, 60, 0.85)';
        } else {
            cameraControlIndicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 18px; height: 18px; background: rgba(136, 221, 255, 0.2); border: 1px solid rgba(136, 221, 255, 0.5); border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">C</span>
                    <span>Freecam</span>
                </div>
            `;
            cameraControlIndicator.style.borderColor = 'rgba(136, 221, 255, 0.3)';
            cameraControlIndicator.style.background = 'rgba(20, 20, 20, 0.75)';
        }
    }

    // Update controls display
    if (controlsDisplay) {
        const arrowKeysEnabled = areWASDControlsEnabled();
        const arrowKeysSection = arrowKeysEnabled 
            ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #555;">
                <div style="margin-bottom: 6px;">
                    <span style="color: #00ffff; font-weight: 600;">[↑↓←→]:</span>
                    <span style="color: #ccc;"> Move ball</span>
                </div>
                <div style="margin-bottom: 6px;">
                    <span style="color: #ff0000; font-weight: 600;">[ESC]:</span>
                    <span style="color: #ccc;"> Disable arrows</span>
                </div>
            </div>`
            : '';

        controlsDisplay.innerHTML = `
            <div style="font-weight: 700; font-size: 14px; color: #ffff00; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1px solid #555; padding-bottom: 4px;">
                CONTROLS
            </div>
            <div style="margin-bottom: 6px;">
                <span style="color: #00ff00; font-weight: 600;">AIM & SHOOT:</span>
            </div>
            <div style="margin-bottom: 8px; margin-left: 8px; font-size: 11px; color: #ccc; line-height: 1.5;">
                Click ball, drag back,<br>release to shoot
            </div>
            <div style="margin-bottom: 6px;">
                <span style="color: #ff0000; font-weight: 600;">[R]:</span>
                <span style="color: #ccc;"> Reset level (+1)</span>
            </div>
            <div style="margin-bottom: 6px;">
                <span style="color: #88DDFF; font-weight: 600;">[C]:</span>
                <span style="color: #ccc;"> Toggle freecam</span>
            </div>
            ${arrowKeysSection}
        `;
    }
}

export function showRating() {
    if (ratingDisplay) {
        const rating = calculateRating();
        const ratingText = rating.replace(/_/g, ' ');
        ratingDisplay.textContent = ratingText;
        ratingDisplay.style.display = 'block';
        
        // Hide after 3 seconds
        setTimeout(() => {
            if (ratingDisplay) {
                ratingDisplay.style.display = 'none';
            }
        }, 3000);
    }
}

export function showRatingText(rating) {
    if (ratingTextDisplay) {
        const ratingText = rating.replace(/_/g, ' ');
        
        // Color based on rating
        let color = '#FFD700'; // Default gold
        if (rating === 'HOLE_IN_ONE') {
            color = '#FF0000'; // Red for hole-in-one
        } else if (rating === 'EAGLE') {
            color = '#FFD700'; // Gold for eagle
        } else if (rating === 'BIRDIE') {
            color = '#90EE90'; // Green for birdie
        }
        
        ratingTextDisplay.textContent = ratingText;
        ratingTextDisplay.style.color = color;
        ratingTextDisplay.style.textShadow = `6px 6px 12px rgba(0, 0, 0, 0.9), 0 0 30px ${color}80`;
        ratingTextDisplay.style.display = 'block';
        
        // Animate in
        animateElement(ratingTextDisplay, 'opacity', 0, 1, 500, Easing.easeOutCubic);
        animateElement(ratingTextDisplay, 'transform', 'scale(0.3)', 'scale(1)', 600, Easing.elastic);
    }
}

export function hideRatingText() {
    if (ratingTextDisplay) {
        // Animate out
        animateElement(ratingTextDisplay, 'opacity', 1, 0, 300, Easing.easeInQuad, () => {
            ratingTextDisplay.style.display = 'none';
        });
    }
}

// "You Died" display for Dark Souls cutscene effect
let youDiedDisplay = null;

export function showYouDiedScreen() {
    if (!youDiedDisplay) {
        // Create You Died display if it doesn't exist
        youDiedDisplay = document.createElement('div');
        youDiedDisplay.id = 'you-died-display';
        youDiedDisplay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            background: rgba(0, 0, 0, 0.7);
            z-index: 500;
            pointer-events: none;
            opacity: 0;
        `;
        
        // Create image element
        const youDiedImg = document.createElement('img');
        youDiedImg.src = 'imgs/youdiedds.png';
        youDiedImg.alt = 'YOU DIED';
        youDiedImg.style.cssText = `
            width: 107%;
            height: 107%;
            object-fit: contain;
            filter: drop-shadow(0 0 50px rgba(139, 0, 0, 0.9)) drop-shadow(0 0 100px rgba(139, 0, 0, 0.7));
            transform: scale(1.07);
        `;
        youDiedImg.id = 'you-died-image';
        
        youDiedDisplay.appendChild(youDiedImg);
        document.body.appendChild(youDiedDisplay);
    }
    
    youDiedDisplay.style.display = 'flex';
    
    // Animate fade-in with Dark Souls style
    animateElement(youDiedDisplay, 'opacity', 0, 1, 1500, Easing.easeOutQuad);
    
    // Animate the image scale - scale from 1.07 to 1.34
    const img = document.getElementById('you-died-image');
    if (img) {
        animateElement(img, 'transform', 'scale(1.07)', 'scale(1.34)', 2000, Easing.easeOutCubic);
    }
    
    console.log('YOU DIED screen displayed');
}

export function hideYouDiedScreen() {
    if (youDiedDisplay) {
        // Animate fade-out
        animateElement(youDiedDisplay, 'opacity', 1, 0, 500, Easing.easeInQuad, () => {
            youDiedDisplay.style.display = 'none';
        });
    }
}

// Show stroke penalty text (e.g., "+67")
let strokePenaltyDisplay = null;

export function showStrokePenaltyText(penalty) {
    if (!strokePenaltyDisplay) {
        // Create stroke penalty display if it doesn't exist
        strokePenaltyDisplay = document.createElement('div');
        strokePenaltyDisplay.id = 'stroke-penalty-display';
        strokePenaltyDisplay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #FF0000;
            font-size: 200px;
            font-weight: bold;
            text-shadow: 8px 8px 16px rgba(0, 0, 0, 0.9), 0 0 40px rgba(255, 0, 0, 0.8);
            z-index: 300;
            display: none;
            text-align: center;
            pointer-events: none;
            opacity: 0;
        `;
        document.body.appendChild(strokePenaltyDisplay);
    }
    
    strokePenaltyDisplay.textContent = `+${penalty}`;
    strokePenaltyDisplay.style.display = 'block';
    
    // Animate in
    animateElement(strokePenaltyDisplay, 'opacity', 0, 1, 500, Easing.easeOutCubic);
    animateElement(strokePenaltyDisplay, 'transform', 'scale(0.3)', 'scale(1)', 600, Easing.elastic);
    
    // Hide after 3 seconds
    setTimeout(() => {
        hideStrokePenaltyText();
    }, 3000);
}

export function hideStrokePenaltyText() {
    if (strokePenaltyDisplay) {
        // Animate out
        animateElement(strokePenaltyDisplay, 'opacity', 1, 0, 500, Easing.easeInQuad, () => {
            strokePenaltyDisplay.style.display = 'none';
        });
    }
}

export async function showHoleCompleteScreen(holeStrokes, totalScore, currentCourse, totalCourses) {
    console.log('showHoleCompleteScreen called with:', { holeStrokes, totalScore, currentCourse, totalCourses });
    
    if (!holeCompleteScreen) {
        console.error('holeCompleteScreen element not found!');
        return;
    }
    
    setHUDVisibility(false);

    const rating = calculateRating();
    const ratingText = rating.replace(/_/g, ' ');
    const holeScores = getHoleScores();
    const currentPar = getPar();
    const relativeScore = holeStrokes - currentPar;
    
    // Format relative score (golf style)
    let scoreDisplay = '';
    if (relativeScore === 0) {
        scoreDisplay = 'Par';
    } else if (relativeScore === -1) {
        scoreDisplay = 'Birdie (-1)';
    } else if (relativeScore === -2) {
        scoreDisplay = 'Eagle (-2)';
    } else if (relativeScore <= -3) {
        scoreDisplay = `${Math.abs(relativeScore)} Under Par (${relativeScore})`;
    } else if (relativeScore === 1) {
        scoreDisplay = 'Bogey (+1)';
    } else {
        scoreDisplay = `${relativeScore} Over Par (+${relativeScore})`;
    }
    
    // Create score table
    let scoreTableHTML = '';
    if (holeScores.length > 0) {
        scoreTableHTML = `
            <div style="margin-top: 20px; font-size: 16px;">
                <table style="width: 100%; border-collapse: collapse; margin: 10px 0; background: #000; border: 2px solid #fff;">
                    <thead>
                        <tr style="background: #fff; color: #000;">
                            <th style="padding: 10px; text-align:left; border-bottom: 2px solid #000; font-family: 'BM SPACE', monospace;">HOLE</th>
                            <th style="padding: 10px; text-align:left; border-bottom: 2px solid #000; font-family: 'BM SPACE', monospace;">PAR</th>
                            <th style="padding: 10px; text-align:left; border-bottom: 2px solid #000; font-family: 'BM SPACE', monospace;">STROKES</th>
                            <th style="padding: 10px; text-align:left; border-bottom: 2px solid #000; font-family: 'BM SPACE', monospace;">SCORE</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        holeScores.forEach((score, index) => {
            let scoreText = '';
            let scoreColor = '#fff';
            if (score.relativeScore === 0) {
                scoreText = 'PAR';
                scoreColor = '#fff';
            } else if (score.relativeScore === -1) {
                scoreText = 'BIRDIE';
                scoreColor = '#00ff00';
            } else if (score.relativeScore === -2) {
                scoreText = 'EAGLE';
                scoreColor = '#ffff00';
            } else if (score.relativeScore <= -3) {
                scoreText = `${Math.abs(score.relativeScore)} UNDER`;
                scoreColor = '#ffff00';
            } else if (score.relativeScore === 1) {
                scoreText = 'BOGEY';
                scoreColor = '#ff8800';
            } else {
                scoreText = `+${score.relativeScore}`;
                scoreColor = '#ff0000';
            }
            
            scoreTableHTML += `
                <tr style="color:#fff; background: ${index === holeScores.length - 1 ? '#222' : '#000'}; border-bottom: 1px solid #333;">
                    <td style="padding: 10px; font-family: 'BM SPACE', monospace;">${score.hole + 1}</td>
                    <td style="padding: 10px; font-family: 'BM SPACE', monospace;">${score.par}</td>
                    <td style="padding: 10px; font-family: 'BM SPACE', monospace;">${score.strokes}</td>
                    <td style="padding: 10px; color: ${scoreColor}; font-family: 'BM SPACE', monospace;">${scoreText}</td>
                </tr>
            `;
        });
        
        scoreTableHTML += `
                    </tbody>
                    <tfoot>
                        <tr style="background: #000; color: #fff; border-top: 2px solid #fff;">
                            <td colspan="3" style="padding: 10px; text-align: right; font-family: 'BM SPACE', monospace;">TOTAL:</td>
                            <td style="padding: 10px; text-align: left; color: ${totalScore === 0 ? '#fff' : totalScore < 0 ? '#00ff00' : '#ff0000'}; font-family: 'BM SPACE', monospace;">
                                ${totalScore === 0 ? 'EVEN' : totalScore > 0 ? `+${totalScore}` : totalScore}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
    
    let nextButtonHTML = '';
    // Check if player selected a single level from menu (should go back to menu after)
    let isSingleLevelMode = false;
    try {
        const mainModule = await import('./main.js');
        isSingleLevelMode = mainModule.getIsSingleLevelMode();
    } catch (e) {
        console.warn('Could not check single level mode:', e);
    }
    
    // Check if there are more holes (either in 5-hole mode or single mode)
    const is5HoleMode = currentCourse < 4; // 0-4 for holes 1-5
    const hasMoreHoles = currentCourse + 1 < totalCourses;
    
    if (isSingleLevelMode) {
        // Single level mode - back to menu only
        nextButtonHTML = `
            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top: 16px;">
                <button id="back-to-menu-btn" style="
                    font-family: 'BM SPACE', monospace;
                    padding: 10px 16px;
                    font-size: 16px;
                    color: #fff;
                    background: #000;
                    border: 2px solid #fff;
                    cursor: pointer;
                    box-shadow: 4px 4px 0px #555;
                    text-transform: uppercase;
                ">BACK TO MENU</button>
            </div>
        `;
    } else if (is5HoleMode || hasMoreHoles) {
        const buttonText = is5HoleMode ? `NEXT HOLE (${currentCourse + 2}/5)` : 'NEXT COURSE';
        nextButtonHTML = `
            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top: 16px;">
                <button id="back-to-menu-btn" style="
                    font-family: 'BM SPACE', monospace;
                    padding: 10px 16px;
                    font-size: 16px;
                    color: #fff;
                    background: #000;
                    border: 2px solid #fff;
                    cursor: pointer;
                    box-shadow: 4px 4px 0px #555;
                    text-transform: uppercase;
                ">BACK TO MENU</button>
                <button id="next-course-btn" style="
                    font-family: 'BM SPACE', monospace;
                    padding: 10px 16px;
                    font-size: 16px;
                    color: #000;
                    background: #00ff00;
                    border: 2px solid #005500;
                    cursor: pointer;
                    box-shadow: 4px 4px 0px #005500;
                    text-transform: uppercase;
                ">${buttonText}</button>
            </div>
        `;
    } else {
        nextButtonHTML = `
            <div style="margin-top: 16px; font-size: 16px; color: #00ff00; font-family: 'BM SPACE', monospace;">ALL HOLES COMPLETE!</div>
            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top: 12px;">
                <button id="back-to-menu-btn" style="
                    font-family: 'BM SPACE', monospace;
                    padding: 10px 16px;
                    font-size: 16px;
                    color: #fff;
                    background: #000;
                    border: 2px solid #fff;
                    cursor: pointer;
                    box-shadow: 4px 4px 0px #555;
                    text-transform: uppercase;
                ">BACK TO MENU</button>
            </div>
        `;
    }
    
    holeCompleteScreen.innerHTML = `
        <div style="margin-bottom: 6px; font-size: 20px; color: #aaa; font-family: 'BM SPACE', monospace; text-transform: uppercase;">HOLE ${currentCourse + 1}</div>
        <div id="rating-text" style="margin-bottom: 10px; font-size: 28px; color: #fff; opacity: 0; transform: scale(0.5); font-family: 'BM SPACE', monospace; text-transform: uppercase; text-shadow: 4px 4px 0px #000;">${ratingText}</div>
        <div style="margin-bottom: 14px; font-size: 16px; color: #ccc; font-family: 'BM SPACE', monospace; text-transform: uppercase;">STROKES: ${holeStrokes} · ${scoreDisplay.toUpperCase()} · TOTAL: ${totalScore >= 0 ? '+' + totalScore : totalScore}</div>
        ${getGhostBallComparisonHTML(holeStrokes)}
        ${scoreTableHTML}
        ${nextButtonHTML}
    `;
    holeCompleteScreen.style.display = 'block';
    
    // Animate rating text entrance
    const ratingTextElement = document.getElementById('rating-text');
    if (ratingTextElement) {
        animateElement(ratingTextElement, 'opacity', 0, 1, 500, Easing.easeOutCubic);
        animateElement(ratingTextElement, 'transform', 'scale(0.5)', 'scale(1)', 600, Easing.elastic);
    }
    
    // Animate screen fade-in
    animateElement(holeCompleteScreen, 'opacity', 0, 1, 300, Easing.easeOutQuad);
    
    console.log('Completion screen displayed');
    
    // Remove old event listeners and add new one
    const oldBtn = document.getElementById('next-course-btn');
    if (oldBtn) {
        oldBtn.removeEventListener('click', handleNextCourse);
    }
    
    // Add event listener for next course button
    setTimeout(() => {
        const nextBtn = document.getElementById('next-course-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', handleNextCourse);
            console.log('Next course button event listener added');
        } else {
            console.warn('Next course button not found after timeout');
        }
        
        // Add back to menu button listener if it exists
        const backBtn = document.getElementById('back-to-menu-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                import('./menu.js').then(menuModule => {
                    menuModule.showMenu();
                });
            });
        }
    }, 100);
}

function handleNextCourse() {
    window.dispatchEvent(new CustomEvent('nextCourse'));
}

// Generate HTML for ghost ball comparison
function getGhostBallComparisonHTML(playerStrokes) {
    if (!isGhostAIEnabled()) {
        return ''; // Ghost AI not enabled
    }
    
    const ghostState = getGhostAIState();
    const ghostStrokes = ghostState.ballState.strokes;
    const ghostFinished = ghostState.ballState.finished;
    
    let comparisonText = '';
    let comparisonColor = '#88CCFF'; // Ghost ball color
    let resultText = '';
    
    if (!ghostFinished) {
        // Ghost ball hasn't finished yet
        resultText = `Ghost Ball: Still playing (${ghostStrokes} strokes so far)`;
        comparisonColor = '#888888';
    } else if (playerStrokes < ghostStrokes) {
        // Player won
        resultText = `You beat the Ghost! (Ghost: ${ghostStrokes} strokes)`;
        comparisonColor = '#8cd68c'; // Green
        comparisonText = `🏆 You won by ${ghostStrokes - playerStrokes} stroke${ghostStrokes - playerStrokes > 1 ? 's' : ''}!`;
    } else if (playerStrokes > ghostStrokes) {
        // Ghost won
        resultText = `Ghost wins! (Ghost: ${ghostStrokes} strokes)`;
        comparisonColor = '#ff7b7b'; // Red
        comparisonText = `👻 Ghost beat you by ${playerStrokes - ghostStrokes} stroke${playerStrokes - ghostStrokes > 1 ? 's' : ''}!`;
    } else {
        // Tie
        resultText = `Tie with Ghost! (Both: ${ghostStrokes} strokes)`;
        comparisonColor = '#ffd666'; // Yellow
        comparisonText = '🤝 It\'s a tie!';
    }
    
    return `
        <div style="
            margin: 12px 0;
            padding: 12px 16px;
            background: linear-gradient(135deg, rgba(136,204,255,0.15) 0%, rgba(136,204,255,0.05) 100%);
            border: 1px solid rgba(136,204,255,0.3);
            border-radius: 8px;
        ">
            <div style="
                font-size: 14px;
                color: ${comparisonColor};
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <span style="
                    width: 12px;
                    height: 12px;
                    background: #88CCFF;
                    border-radius: 50%;
                    display: inline-block;
                    opacity: 0.8;
                "></span>
                ${resultText}
            </div>
            ${comparisonText ? `<div style="font-size: 16px; color: ${comparisonColor}; margin-top: 6px; font-weight: 700;">${comparisonText}</div>` : ''}
        </div>
    `;
}

export function hideHoleCompleteScreen() {
    if (holeCompleteScreen) {
        holeCompleteScreen.style.display = 'none';
    }
    setHUDVisibility(true);
}

// Reset level function - resets ball and adds +1 stroke penalty
export function resetLevel() {
    // Don't allow reset if hole is complete
    if (isComplete()) {
        return;
    }
    
    // Reset ball to start position
    resetBall();
    
    // Reset ball velocity
    setBallVelocity(new THREE.Vector3(0, 0, 0));
    
    // Reset collisions
    resetCollisions();
    
    // Restore camera to starting angle
    restoreStartingCameraAngle();
    
    // Add +1 stroke penalty
    incrementStroke();
    
    console.log('Level reset - stroke count increased by 1');
}

