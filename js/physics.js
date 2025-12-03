// Custom physics system initialization and update
import { updateBallPhysics } from './ball.js';
import { checkWallCollisions } from './collisions.js';

export function initPhysics() {
    console.log('Physics system initialized');
}

// Physics constants
export const PHYSICS_CONSTANTS = {
    FRICTION: 0.97,           // Per frame friction coefficient
    BOUNCE_DAMPING: 0.75,      // Energy loss on collision
    MIN_VELOCITY: 0.01,        // Stop threshold
    GRAVITY: -15.0             // Gravity (increased for more noticeable falling)
};

// Main physics update function
export function updatePhysics(deltaTime) {
    // Update ball physics
    updateBallPhysics(deltaTime);

    // Check for wall collisions
    checkWallCollisions();
}

