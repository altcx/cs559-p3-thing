// Collision detection and response
import * as THREE from 'three';
import { getBallPosition, getBallVelocity, setBallVelocity, setBallPosition, resetBall } from './ball.js';
import { getCourseBounds } from './course.js';
import { PHYSICS_CONSTANTS } from './physics.js';
import { incrementStroke } from './game.js';

const BALL_RADIUS = 0.5;
let isOutOfBounds = false;

export function checkWallCollisions() {
    const ballPos = getBallPosition();
    const ballVel = getBallVelocity();
    const bounds = getCourseBounds();
    const OUT_OF_BOUNDS_MARGIN = 2.0;
    
    // Check if completely out of bounds
    if (ballPos.x < bounds.minX - OUT_OF_BOUNDS_MARGIN || 
        ballPos.x > bounds.maxX + OUT_OF_BOUNDS_MARGIN ||
        ballPos.z < bounds.minZ - OUT_OF_BOUNDS_MARGIN || 
        ballPos.z > bounds.maxZ + OUT_OF_BOUNDS_MARGIN) {
        if (!isOutOfBounds) {
            handleOutOfBounds();
        }
        return true;
    }
    
    // Normal wall collision
    let collisionOccurred = false;
    let collisionNormal = new THREE.Vector3();
    const correctedPos = ballPos.clone();
    
    // North wall (negative Z)
    if (ballPos.z - BALL_RADIUS < bounds.minZ) {
        correctedPos.z = bounds.minZ + BALL_RADIUS;
        collisionNormal.set(0, 0, 1);
        collisionOccurred = true;
    }
    
    // South wall (positive Z)
    if (ballPos.z + BALL_RADIUS > bounds.maxZ) {
        correctedPos.z = bounds.maxZ - BALL_RADIUS;
        collisionNormal.set(0, 0, -1);
        collisionOccurred = true;
    }
    
    // East wall (positive X)
    if (ballPos.x + BALL_RADIUS > bounds.maxX) {
        correctedPos.x = bounds.maxX - BALL_RADIUS;
        collisionNormal.set(-1, 0, 0);
        collisionOccurred = true;
    }
    
    // West wall (negative X)
    if (ballPos.x - BALL_RADIUS < bounds.minX) {
        correctedPos.x = bounds.minX + BALL_RADIUS;
        collisionNormal.set(1, 0, 0);
        collisionOccurred = true;
    }
    
    if (collisionOccurred) {
        setBallPosition(correctedPos);
    }
    
    if (collisionOccurred && ballVel.length() > 0.01) {
        const reflectedVel = ballVel.clone();
        reflectedVel.reflect(collisionNormal);
        reflectedVel.multiplyScalar(PHYSICS_CONSTANTS.BOUNCE_DAMPING);
        setBallVelocity(reflectedVel);
    }
    
    return collisionOccurred;
}

function handleOutOfBounds() {
    isOutOfBounds = true;
    setBallVelocity(new THREE.Vector3(0, 0, 0));
    
    // +2 stroke penalty
    incrementStroke();
    incrementStroke();
    
    showOutOfBoundsMessage();
    
    setTimeout(() => {
        resetBall();
        hideOutOfBoundsMessage();
        isOutOfBounds = false;
    }, 2000);
}

function showOutOfBoundsMessage() {
    let oobMessage = document.getElementById('oob-message');
    if (!oobMessage) {
        oobMessage = document.createElement('div');
        oobMessage.id = 'oob-message';
        oobMessage.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            font-size: 72px;
            font-weight: bold;
            color: #FF0000;
            text-shadow: 4px 4px 8px rgba(0, 0, 0, 0.9);
            z-index: 500;
            animation: oobPulse 0.5s ease-out forwards;
        `;
        oobMessage.textContent = 'OUT OF BOUNDS! +2';
        document.body.appendChild(oobMessage);
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes oobPulse {
                0% { transform: translate(-50%, -50%) scale(0); }
                50% { transform: translate(-50%, -50%) scale(1.2); }
                100% { transform: translate(-50%, -50%) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
    oobMessage.style.display = 'block';
}

function hideOutOfBoundsMessage() {
    const oobMessage = document.getElementById('oob-message');
    if (oobMessage) {
        oobMessage.style.display = 'none';
    }
}
