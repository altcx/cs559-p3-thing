// HUD elements (stroke counter, score display)
import * as THREE from 'three';
import { getStrokeCount, getPar, calculateRating, isComplete, getTotalScore, getHoleScores, getHolePosition } from './game.js';
import { animateElement, Easing, triggerScreenShake, updateScreenShake } from './animations.js';
import { createFireworks, createGoldBurst, createSparkles, createParticleBurst, updateParticles } from './particles.js';

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
let totalScoreDisplay = null;
let holeCompleteScreen = null;
let ratingTextDisplay = null; // Large rating text shown during pause

export function initHUD() {
    // Create stroke counter display
    strokeDisplay = document.createElement('div');
    strokeDisplay.id = 'stroke-display';
    strokeDisplay.style.cssText = `
        position: absolute;
        bottom: 80px;
        left: 20px;
        color: white;
        font-size: 32px;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        background: rgba(0, 0, 0, 0.5);
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 100;
    `;
    document.body.appendChild(strokeDisplay);
    
    // Create par display
    parDisplay = document.createElement('div');
    parDisplay.id = 'par-display';
    parDisplay.style.cssText = `
        position: absolute;
        bottom: 80px;
        left: 200px;
        color: white;
        font-size: 24px;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        background: rgba(0, 0, 0, 0.5);
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 100;
    `;
    document.body.appendChild(parDisplay);
    
    // Create total score display
    totalScoreDisplay = document.createElement('div');
    totalScoreDisplay.id = 'total-score-display';
    totalScoreDisplay.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        color: white;
        font-size: 24px;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        background: rgba(0, 0, 0, 0.5);
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 100;
    `;
    document.body.appendChild(totalScoreDisplay);
    
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
        color: #FFD700;
        font-size: 120px;
        font-weight: bold;
        text-shadow: 6px 6px 12px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 215, 0, 0.5);
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
        color: white;
        font-size: 48px;
        font-weight: bold;
        text-shadow: 4px 4px 8px rgba(0, 0, 0, 0.9);
        background: rgba(0, 0, 0, 0.9);
        padding: 40px 80px;
        border-radius: 15px;
        z-index: 300;
        display: none;
        text-align: center;
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
    
    if (totalScoreDisplay) {
        const total = getTotalScore();
        // Display golf-style total score
        let scoreText = '';
        if (total === 0) {
            scoreText = 'Even';
        } else if (total > 0) {
            scoreText = `+${total}`;
        } else {
            scoreText = `${total}`; // Negative numbers already have minus sign
        }
        totalScoreDisplay.textContent = `Total: ${scoreText}`;
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

export function showHoleCompleteScreen(holeStrokes, totalScore, currentCourse, totalCourses) {
    console.log('showHoleCompleteScreen called with:', { holeStrokes, totalScore, currentCourse, totalCourses });
    
    if (!holeCompleteScreen) {
        console.error('holeCompleteScreen element not found!');
        return;
    }
    
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
            <div style="margin-top: 20px; font-size: 18px;">
                <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                    <thead>
                        <tr style="background: rgba(255, 255, 255, 0.1);">
                            <th style="padding: 8px; border: 1px solid rgba(255, 255, 255, 0.3);">Hole</th>
                            <th style="padding: 8px; border: 1px solid rgba(255, 255, 255, 0.3);">Par</th>
                            <th style="padding: 8px; border: 1px solid rgba(255, 255, 255, 0.3);">Strokes</th>
                            <th style="padding: 8px; border: 1px solid rgba(255, 255, 255, 0.3);">Score</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        holeScores.forEach((score, index) => {
            let scoreText = '';
            let scoreColor = '#ffffff';
            if (score.relativeScore === 0) {
                scoreText = 'Par';
                scoreColor = '#ffffff';
            } else if (score.relativeScore === -1) {
                scoreText = 'Birdie';
                scoreColor = '#90EE90';
            } else if (score.relativeScore === -2) {
                scoreText = 'Eagle';
                scoreColor = '#FFD700';
            } else if (score.relativeScore <= -3) {
                scoreText = `${Math.abs(score.relativeScore)} Under`;
                scoreColor = '#FFD700';
            } else if (score.relativeScore === 1) {
                scoreText = 'Bogey';
                scoreColor = '#FFA500';
            } else {
                scoreText = `+${score.relativeScore}`;
                scoreColor = '#FF6347';
            }
            
            scoreTableHTML += `
                <tr style="background: ${index === holeScores.length - 1 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)'};">
                    <td style="padding: 8px; border: 1px solid rgba(255, 255, 255, 0.3); text-align: center;">${score.hole + 1}</td>
                    <td style="padding: 8px; border: 1px solid rgba(255, 255, 255, 0.3); text-align: center;">${score.par}</td>
                    <td style="padding: 8px; border: 1px solid rgba(255, 255, 255, 0.3); text-align: center;">${score.strokes}</td>
                    <td style="padding: 8px; border: 1px solid rgba(255, 255, 255, 0.3); text-align: center; color: ${scoreColor}; font-weight: bold;">${scoreText}</td>
                </tr>
            `;
        });
        
        scoreTableHTML += `
                    </tbody>
                    <tfoot>
                        <tr style="background: rgba(255, 255, 255, 0.2); font-weight: bold;">
                            <td colspan="3" style="padding: 8px; border: 1px solid rgba(255, 255, 255, 0.3); text-align: right;">Total Score:</td>
                            <td style="padding: 8px; border: 1px solid rgba(255, 255, 255, 0.3); text-align: center; color: ${totalScore === 0 ? '#ffffff' : totalScore < 0 ? '#90EE90' : '#FF6347'};">
                                ${totalScore === 0 ? 'Even' : totalScore > 0 ? `+${totalScore}` : totalScore}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
    
    let nextButtonHTML = '';
    // Check if there are more holes (either in 9-hole mode or single mode)
    const is9HoleMode = currentCourse < 8; // 0-8 for holes 1-9
    const hasMoreHoles = currentCourse + 1 < totalCourses;
    
    if (is9HoleMode || hasMoreHoles) {
        const buttonText = is9HoleMode ? `Next Hole (${currentCourse + 2}/9)` : 'Next Course';
        nextButtonHTML = `
            <button id="next-course-btn" style="
                margin-top: 20px;
                padding: 15px 30px;
                font-size: 24px;
                font-weight: bold;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: background 0.3s;
            " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4CAF50'">${buttonText}</button>
        `;
    } else {
        nextButtonHTML = `
            <div style="margin-top: 20px; font-size: 20px;">All Holes Complete!</div>
            <button id="back-to-menu-btn" style="
                margin-top: 15px;
                padding: 15px 30px;
                font-size: 20px;
                background: #666;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            " onmouseover="this.style.background='#555'" onmouseout="this.style.background='#666'">Back to Menu</button>
        `;
    }
    
    holeCompleteScreen.innerHTML = `
        <div id="rating-text" style="margin-bottom: 20px; font-size: 48px; color: #FFD700; opacity: 0; transform: scale(0.5);">${ratingText}</div>
        <div style="font-size: 28px; margin-bottom: 10px;">Hole ${currentCourse + 1}: ${holeStrokes} strokes (Par ${currentPar})</div>
        <div style="font-size: 24px; margin-bottom: 20px; color: #90EE90;">${scoreDisplay}</div>
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

export function hideHoleCompleteScreen() {
    if (holeCompleteScreen) {
        holeCompleteScreen.style.display = 'none';
    }
}

