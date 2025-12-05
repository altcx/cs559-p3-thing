// Custom physics system initialization and update
import { updateBallPhysics, getBallPosition, getBallVelocity, setBallVelocity, setBallPosition } from './ball.js';
import { checkWallCollisions } from './collisions.js';
import { updateFans, checkFanPush, checkFanBladeCollisions } from './fans.js';
import { applyWindForce } from './wind-zones.js';

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

// Sub-stepping constants for collision prevention
const BALL_RADIUS = 0.5;
const MAX_STEP_DISTANCE = BALL_RADIUS * 0.25; // Ball should never move more than quarter its radius per step
const MAX_SUB_STEPS = 40; // Maximum sub-steps per frame to prevent infinite loops

// Main physics update function with sub-stepping for fast-moving balls
export function updatePhysics(deltaTime) {
    // Update fans (rotation) - this happens once per frame regardless of sub-steps
    updateFans(deltaTime);
    
    // Calculate how fast the ball is moving
    const ballVel = getBallVelocity();
    const speed = ballVel.length();
    const expectedDistance = speed * deltaTime;
    
    // Determine number of sub-steps needed
    // If the ball would move more than MAX_STEP_DISTANCE, break into smaller steps
    let numSubSteps = 1;
    if (expectedDistance > MAX_STEP_DISTANCE && speed > 0.01) {
        numSubSteps = Math.min(Math.ceil(expectedDistance / MAX_STEP_DISTANCE), MAX_SUB_STEPS);
    }
    
    const subDeltaTime = deltaTime / numSubSteps;
    
    // Perform sub-stepped physics updates
    for (let step = 0; step < numSubSteps; step++) {
        // Apply fan push forces to ball before physics update
        const ballPos = getBallPosition();
        const pushForces = checkFanPush(ballPos, BALL_RADIUS);
        if (pushForces.length > 0) {
            const currentVel = getBallVelocity();
            pushForces.forEach(({ force }) => {
                currentVel.add(force.clone().multiplyScalar(subDeltaTime));
            });
            setBallVelocity(currentVel);
        }
        
        // Apply wind zone forces to ball
        const windBallVel = getBallVelocity();
        const inWindZone = applyWindForce(ballPos, windBallVel, subDeltaTime);
        if (inWindZone) {
            setBallVelocity(windBallVel);
        }
        
        // Update ball physics for this sub-step
        updateBallPhysics(subDeltaTime);

        // Check for fan blade collisions (windmill blades)
        const fanCollision = checkFanBladeCollisions(getBallPosition(), BALL_RADIUS);
        if (fanCollision.collided) {
            // Move ball out of blade
            setBallPosition(fanCollision.correctedPos);
            
            // Get current velocity
            const currentVel = getBallVelocity();
            
            // Reflect velocity off the blade surface
            const dot = currentVel.dot(fanCollision.normal);
            const reflectedVel = currentVel.clone().sub(
                fanCollision.normal.clone().multiplyScalar(2 * dot)
            );
            
            // Add a small portion of blade's velocity (gentle nudge, not a launch)
            reflectedVel.add(fanCollision.bladeVelocity.clone().multiplyScalar(0.3));
            
            // Apply stronger bounce damping to prevent launching
            reflectedVel.multiplyScalar(0.5);
            
            setBallVelocity(reflectedVel);
        }

        // Check for wall collisions after each sub-step
        // This is the key to preventing phasing - check collisions frequently
        const collisionOccurred = checkWallCollisions();
        
        // If ball has essentially stopped, no need to continue sub-stepping
        const newVel = getBallVelocity();
        if (newVel.lengthSq() < 0.0001) {
            break;
        }
    }
}
