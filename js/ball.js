// Ball mesh and physics state
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';
import { PHYSICS_CONSTANTS } from './physics.js';
import { getHolePosition } from './game.js';
import { getTerrainHeight } from './course.js';

const BALL_RADIUS = 0.5;
const COURSE_HEIGHT = 50; // Will match course.js (updated to square)
let BALL_START_POSITION = new THREE.Vector3(0, BALL_RADIUS, -COURSE_HEIGHT / 2 + 5); // Near top of course

export function setBallStartPosition(position) {
    BALL_START_POSITION.copy(position);
}

let ballMesh = null;
let ballVelocity = new THREE.Vector3(0, 0, 0);
let ballPosition = BALL_START_POSITION.clone();

export function createBall() {
    // Remove any existing ball mesh first
    if (ballMesh) {
        scene.remove(ballMesh);
        ballMesh.geometry.dispose();
        ballMesh.material.dispose();
    }
    
    const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    
    // Material based on mode
    const ballMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({ color: 0xFFFFFF }) // White for full mode (will add texture later)
        : new THREE.MeshStandardMaterial({ color: 0xFFFFFF }); // White for prototype
    
    ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    ballMesh.position.copy(ballPosition);
    ballMesh.castShadow = false; // Disable shadow to avoid looking like a platform
    ballMesh.receiveShadow = false;
    scene.add(ballMesh);
    
    return ballMesh;
}

export function updateBallPhysics(deltaTime) {
    // Check if ball is over hole (only within hole radius)
    const distanceToHole = getDistanceToHole();
    const HOLE_RADIUS = 2.0; // Match game.js
    const isOverHole = distanceToHole < HOLE_RADIUS;
    
    // Calculate max speed (from controls.js: MAX_PULL_DISTANCE * POWER_SCALE)
    const MAX_PULL_DISTANCE = 1.67;
    const POWER_SCALE = 80;
    const MAX_SPEED = MAX_PULL_DISTANCE * POWER_SCALE; // ~133.6 units/sec
    const SPEED_THRESHOLD = MAX_SPEED * 0.75; // 75% of max speed (~100 units/sec)
    
    // Get current horizontal speed
    let horizontalVel = new THREE.Vector3(ballVelocity.x, 0, ballVelocity.z);
    let currentSpeed = horizontalVel.length();
    
    // Check if ball is deep in hole (below ground)
    const isDeepInHole = ballPosition.y < -0.5 && isOverHole;
    
    // Apply strong downward force when over hole and going slow enough
    if (isOverHole && currentSpeed < SPEED_THRESHOLD) {
        // Very strong downward force to guarantee falling in (doubled from -50.0)
        const DOWNWARD_FORCE = -100.0; // Doubled downward acceleration
        ballVelocity.y += DOWNWARD_FORCE * deltaTime;
        
        // Also reduce horizontal velocity to help pull ball into hole
        ballVelocity.x *= 0.9;
        ballVelocity.z *= 0.9;
    } else if (isOverHole && currentSpeed >= SPEED_THRESHOLD) {
        // Still apply some gravity even when going fast, but less
        ballVelocity.y += -9.8 * deltaTime;
    }
    
    // Add damping when deep in hole to slow down for win condition
    if (isDeepInHole) {
        // Strong damping to slow the ball down
        ballVelocity.multiplyScalar(0.95); // Reduce velocity by 5% per frame
    }
    
    // Apply velocity to position
    const movement = ballVelocity.clone().multiplyScalar(deltaTime);
    ballPosition.add(movement);
    
    // Recalculate horizontal velocity after potential modifications
    horizontalVel.set(ballVelocity.x, 0, ballVelocity.z);
    currentSpeed = horizontalVel.length();
    
    if (currentSpeed > 0.01) {
        // Base friction for high speeds (allows long travel)
        let friction = 0.98; // Slightly less friction for longer travel
        
        // Increase friction as speed decreases, but less aggressively (takes longer to stop)
        // When speed is high (>5), use low friction. When speed is low (<1), use higher friction
        if (currentSpeed < 1.0) {
            // Moderate friction when slow - stops a bit slower
            friction = 0.92; // Less aggressive friction (was 0.90)
        } else if (currentSpeed < 3.0) {
            // Medium friction for medium speeds
            const t = (currentSpeed - 1.0) / 2.0; // 0 to 1 as speed goes from 1 to 3
            friction = 0.92 + (0.06 * t); // Interpolate from 0.92 to 0.98
        }
        // For speeds > 3, use base friction of 0.98
        
        // Apply friction only to horizontal velocity
        ballVelocity.x *= friction;
        ballVelocity.z *= friction;
    }
    
    // Stop horizontal velocity if too small
    if (horizontalVel.length() < PHYSICS_CONSTANTS.MIN_VELOCITY) {
        ballVelocity.x = 0;
        ballVelocity.z = 0;
    }
    
    // Handle terrain collision (ground and hump)
    if (!isOverHole) {
        // Get terrain height at current position
        const terrainY = getTerrainHeight(ballPosition.x, ballPosition.z);
        const targetY = terrainY + BALL_RADIUS;
        
        // If ball is below terrain, push it up
        if (ballPosition.y < targetY) {
            ballPosition.y = targetY;
            // Stop falling if hitting terrain
            if (ballVelocity.y < 0) {
                ballVelocity.y = 0;
            }
        } else if (ballPosition.y > targetY + 0.1) {
            // If ball is significantly above terrain, apply gravity
            ballVelocity.y += PHYSICS_CONSTANTS.GRAVITY * deltaTime;
        }
    }
    // If over hole, allow ball to fall freely (no terrain collision)
    
    // Update mesh position
    if (ballMesh) {
        ballMesh.position.copy(ballPosition);
        
        // Rotate ball based on movement (rolling effect)
        if (horizontalVel.length() > 0.01) {
            const rotationAxis = new THREE.Vector3(-ballVelocity.z, 0, ballVelocity.x).normalize();
            const rotationAmount = horizontalVel.length() * deltaTime / BALL_RADIUS;
            ballMesh.rotateOnAxis(rotationAxis, rotationAmount);
        }
    }
}

function getDistanceToHole() {
    // Get hole position from game.js
    const holePos = getHolePosition();
    const horizontalDistance = Math.sqrt(
        Math.pow(ballPosition.x - holePos.x, 2) +
        Math.pow(ballPosition.z - holePos.z, 2)
    );
    return horizontalDistance;
}

// Export HOLE_POSITION for use in game.js
export const HOLE_POSITION_FOR_BALL = new THREE.Vector3(0, 0, 20);

export function setBallVelocity(velocity) {
    ballVelocity.copy(velocity);
}

export function getBallVelocity() {
    return ballVelocity.clone();
}

export function getBallPosition() {
    return ballPosition.clone();
}

export function setBallPosition(position) {
    ballPosition.copy(position);
    if (ballMesh) {
        ballMesh.position.copy(ballPosition);
    }
}

export function getBallMesh() {
    return ballMesh;
}

export function hideBall() {
    if (ballMesh) {
        ballMesh.visible = false;
    }
}

export function showBall() {
    if (ballMesh) {
        ballMesh.visible = true;
    }
}

export function resetBall() {
    ballPosition.copy(BALL_START_POSITION);
    ballVelocity.set(0, 0, 0);
    if (ballMesh) {
        ballMesh.position.copy(ballPosition);
        ballMesh.rotation.set(0, 0, 0);
    }
}

