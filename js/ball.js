// Ball mesh and physics state
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';
import { registerBallForCosmetics } from './cosmetics.js';
import { PHYSICS_CONSTANTS } from './physics.js';
import { getHolePosition } from './game.js';
import { getTerrainHeight, getRectangularHoles } from './course.js';
import { isMagneticPullActive, getMagneticPullEffect } from './powerup-effects.js';
import { checkMagneticFieldPull } from './magnetic-fields.js';
import { handleRectangularHoleOutOfBounds, resetCollisions } from './collisions.js';
import { checkTeleporterCollision } from './teleporters.js';
import { showNecoArcModel } from './course.js';

// Calculate terrain slope gradient for realistic ball rolling
function calculateSlopeGradient(x, z, direction) {
    const sampleDistance = 0.5; // Distance to sample terrain height
    const currentHeight = getTerrainHeight(x, z);

    let adjacentHeight;
    if (direction === 'x') {
        // Calculate gradient in X direction
        adjacentHeight = getTerrainHeight(x + sampleDistance, z);
    } else if (direction === 'z') {
        // Calculate gradient in Z direction
        adjacentHeight = getTerrainHeight(x, z + sampleDistance);
    } else {
        return 0;
    }

    // Return the slope (rise over run)
    return (adjacentHeight - currentHeight) / sampleDistance;
}

const BALL_RADIUS = 0.5;

// Ball start position - set per level via setBallStartPosition()
let BALL_START_POSITION = new THREE.Vector3(0, BALL_RADIUS, 0);

// Track if ball has already triggered rectangular hole out of bounds
let hasTriggeredRectangularHoleOOB = false;

// Set the ball's start position for the current level
export function setBallStartPosition(position) {
    if (!position) {
        console.error('setBallStartPosition called with null/undefined position!');
        return;
    }
    
    console.log(`Ball: setBallStartPosition called with (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    BALL_START_POSITION.set(position.x, position.y, position.z);
    ballPosition.set(position.x, position.y, position.z);
    ballVelocity.set(0, 0, 0);
    if (ballMesh) {
        ballMesh.position.set(position.x, position.y, position.z);
    }
    console.log(`  BALL_START_POSITION now: (${BALL_START_POSITION.x.toFixed(2)}, ${BALL_START_POSITION.y.toFixed(2)}, ${BALL_START_POSITION.z.toFixed(2)})`);
    console.log(`  ballPosition now: (${ballPosition.x.toFixed(2)}, ${ballPosition.y.toFixed(2)}, ${ballPosition.z.toFixed(2)})`);
}

let ballMesh = null;
let coordinateDisplay = null; // Sprite showing ball coordinates
let ballVelocity = new THREE.Vector3(0, 0, 0);
// ballPosition will be initialized from BALL_START_POSITION when setBallStartPosition is called
let ballPosition = new THREE.Vector3(0, 0.5, 0); // Temporary default, will be updated
let justTeleported = false; // Flag to skip collision detection for one frame after teleporting

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
    ballMesh.userData.isBall = true; // Mark as ball for cutscene system
    scene.add(ballMesh);
    registerBallForCosmetics(ballMesh, scene, BALL_RADIUS);
    
    // Coordinate display removed - no longer needed
    
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
    const ABSOLUTE_MAX_SPEED = 200.0; // Hard cap to prevent phasing through walls
    
    // Get current horizontal speed
    let horizontalVel = new THREE.Vector3(ballVelocity.x, 0, ballVelocity.z);
    let currentSpeed = horizontalVel.length();
    
    // Cap maximum velocity to prevent wall phasing
    if (currentSpeed > ABSOLUTE_MAX_SPEED) {
        const scaleFactor = ABSOLUTE_MAX_SPEED / currentSpeed;
        ballVelocity.x *= scaleFactor;
        ballVelocity.z *= scaleFactor;
        horizontalVel.multiplyScalar(scaleFactor);
        currentSpeed = ABSOLUTE_MAX_SPEED;
    }
    
    // Check if ball is over any rectangular hole (hazard)
    const rectangularHoles = getRectangularHoles();
    let isOverRectangularHole = false;
    for (const rectHole of rectangularHoles) {
        const halfWidth = rectHole.width / 2;
        const halfLength = rectHole.length / 2;
        const distX = Math.abs(ballPosition.x - rectHole.x);
        const distZ = Math.abs(ballPosition.z - rectHole.z);
        if (distX < halfWidth && distZ < halfLength) {
            isOverRectangularHole = true;
            break;
        }
    }
    
    // Check if ball is deep in hole (below ground)
    const isDeepInHole = ballPosition.y < -0.5 && isOverHole;
    
    // Apply EXTREMELY strong downward force when over hole - MUCH easier to fall in
    if (isOverHole) {
        // Always apply very strong downward force regardless of speed
        const BASE_DOWNWARD_FORCE = -200.0; // Much stronger force (doubled from -100.0)
        
        // Even stronger force when going slower, but still strong when fast
        const speedFactor = Math.min(currentSpeed / MAX_SPEED, 1.0); // 0 to 1
        const DOWNWARD_FORCE = BASE_DOWNWARD_FORCE * (1.0 - speedFactor * 0.3); // At max speed, still 70% of force
        
        ballVelocity.y += DOWNWARD_FORCE * deltaTime;
        
        // Aggressively reduce horizontal velocity to pull ball into hole
        const reductionFactor = 0.85 - (speedFactor * 0.1); // 0.85 to 0.75 (more aggressive)
        ballVelocity.x *= reductionFactor;
        ballVelocity.z *= reductionFactor;
    }
    
    // Apply gravity when over rectangular holes (hazards)
    if (isOverRectangularHole) {
        // Apply strong downward force to make ball fall into rectangular holes
        const DOWNWARD_FORCE = -150.0; // Strong gravity for hazards
        ballVelocity.y += DOWNWARD_FORCE * deltaTime;
        
        // Check if ball has fallen deep into rectangular hole (out of bounds)
        if (ballPosition.y < -3.0 && !hasTriggeredRectangularHoleOOB) {
            // Ball has fallen deep into hazard - trigger out of bounds immediately (no pause)
            hasTriggeredRectangularHoleOOB = true;
            handleRectangularHoleOutOfBounds();
        }
    } else {
        // Reset flag when ball is no longer over rectangular hole
        hasTriggeredRectangularHoleOOB = false;
    }
    
    // Add damping when deep in hole to slow down for win condition
    if (isDeepInHole) {
        // Strong damping to slow the ball down
        ballVelocity.multiplyScalar(0.95); // Reduce velocity by 5% per frame
    }
    
    // Apply magnetic pull force if active (power-up)
    if (isMagneticPullActive()) {
        const magneticEffect = getMagneticPullEffect();
        if (magneticEffect) {
            const holePos = getHolePosition();
            const directionToHole = new THREE.Vector3(
                holePos.x - ballPosition.x,
                0, // Only horizontal pull
                holePos.z - ballPosition.z
            );
            const distanceToHole = directionToHole.length();
            
            // Apply pull if within range
            if (distanceToHole > 0 && distanceToHole < magneticEffect.range) {
                // Normalize direction
                directionToHole.normalize();
                
                // Calculate pull strength (stronger when closer, inverse square law)
                const normalizedDistance = distanceToHole / magneticEffect.range; // 0 to 1
                const pullStrength = magneticEffect.strength * (1.0 - normalizedDistance * 0.5); // Stronger when closer
                
                // Apply pull force to velocity
                const pullForce = directionToHole.multiplyScalar(pullStrength * deltaTime * 60); // Scale by deltaTime and 60 for consistent force
                ballVelocity.add(pullForce);
            }
        }
    }
    
    // Apply static magnetic field forces
    const magneticFieldPull = checkMagneticFieldPull(ballPosition, deltaTime);
    if (magneticFieldPull.lengthSq() > 0) {
        ballVelocity.add(magneticFieldPull);
    }

    // Apply velocity to position
    const movement = ballVelocity.clone().multiplyScalar(deltaTime);
    ballPosition.add(movement);
    
    // Check for teleporter collision BEFORE other collision checks (allows passing through walls)
    const teleporterResult = checkTeleporterCollision(ballPosition, BALL_RADIUS);
    if (teleporterResult.teleported) {
        // Respawn the ball at the destination square
        respawnBallAtPosition(teleporterResult.destination, teleporterResult.isYellowPortal);
        // Skip rest of physics update since ball is being respawned
        return;
    }
    
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
    
    // Handle terrain collision (ground, slopes, and humps)
    // Skip terrain collision if over the main hole OR over a rectangular hole
    if (!isOverHole && !isOverRectangularHole) {
        // Get terrain height at current position
        const terrainY = getTerrainHeight(ballPosition.x, ballPosition.z);
        const targetY = terrainY + BALL_RADIUS;

        // Calculate slope gradient for realistic rolling physics
        const slopeGradientX = calculateSlopeGradient(ballPosition.x, ballPosition.z, 'x');
        const slopeGradientZ = calculateSlopeGradient(ballPosition.x, ballPosition.z, 'z');

        // Apply slope-based gravity (ball rolls downhill)
        const slopeGravityStrength = 15.0; // How strongly the ball is pulled by slopes
        ballVelocity.x += slopeGradientX * slopeGravityStrength * deltaTime;
        ballVelocity.z += slopeGradientZ * slopeGravityStrength * deltaTime;

        // Handle vertical collision with terrain
        if (ballPosition.y < targetY) {
            ballPosition.y = targetY;
            // Stop falling if hitting terrain
            if (ballVelocity.y < 0) {
                ballVelocity.y = 0;
            }
            // Add some friction when rolling on slopes
            const friction = 0.95;
            ballVelocity.x *= friction;
            ballVelocity.z *= friction;
        } else if (ballPosition.y > targetY + 0.1) {
            // If ball is significantly above terrain, apply gravity
            ballVelocity.y += PHYSICS_CONSTANTS.GRAVITY * deltaTime;
        }
    }
    // If over hole or rectangular hole, allow ball to fall freely (no terrain collision)
    
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
    
    // Coordinate display removed - no longer needed
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

export function getBallJustTeleported() {
    return justTeleported;
}

export function clearBallJustTeleported() {
    justTeleported = false;
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

// Respawn ball at current position (used for teleportation)
export function respawnBallAtPosition(position, isYellowPortal = false) {
    // Set new position
    ballPosition.copy(position);
    ballPosition.y = BALL_RADIUS; // Ensure ball is on the ground
    ballVelocity.set(0, 0, 0); // Stop the ball completely
    justTeleported = true; // Skip wall collisions next frame
    
    // Reset collision tracking to prevent sweep collision from old position
    resetCollisions();

    if (ballMesh) {
        ballMesh.position.copy(ballPosition);
        ballMesh.rotation.set(0, 0, 0);
        // Make sure ball is visible
        ballMesh.visible = true;
    }

    // Only show neco-arc model and trigger cutscene for yellow portal
    if (isYellowPortal) {
        // Show neco-arc model when teleporting (with fade-in and particles)
        showNecoArcModel();

        // Trigger special yellow portal cutscene - pass destination position
        if (position) {
            import('./main.js').then(mainModule => {
                if (mainModule.onYellowPortalTeleportation) {
                    mainModule.onYellowPortalTeleportation(position.clone());
                }
            });
        } else {
            console.error('Yellow portal teleportation triggered but position is null!');
        }
    }

    // Coordinate display removed - no longer needed
    console.log('Ball teleported to:', ballPosition, isYellowPortal ? '(Yellow Portal - Cutscene Triggered!)' : '');
}

export function resetBall() {
    console.log(`Ball: resetBall() called`);
    console.log(`  BALL_START_POSITION: (${BALL_START_POSITION.x.toFixed(2)}, ${BALL_START_POSITION.y.toFixed(2)}, ${BALL_START_POSITION.z.toFixed(2)})`);
    ballPosition.copy(BALL_START_POSITION);
    ballVelocity.set(0, 0, 0);
    // Reset rectangular hole OOB tracking
    hasTriggeredRectangularHoleOOB = false;
    if (ballMesh) {
        ballMesh.position.copy(ballPosition);
        ballMesh.rotation.set(0, 0, 0);
    }
    console.log(`  Ball reset to: (${ballPosition.x.toFixed(2)}, ${ballPosition.y.toFixed(2)}, ${ballPosition.z.toFixed(2)})`);
    // Coordinate display removed - no longer needed
}

function createCoordinateDisplay() {
    // Remove existing display if any
    if (coordinateDisplay) {
        scene.remove(coordinateDisplay);
        coordinateDisplay.material.map?.dispose();
        coordinateDisplay.material.dispose();
    }
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        alphaTest: 0.1
    });
    
    coordinateDisplay = new THREE.Sprite(spriteMaterial);
    coordinateDisplay.scale.set(4, 2, 1);
    coordinateDisplay.position.set(ballPosition.x, ballPosition.y + 1.5, ballPosition.z);
    coordinateDisplay.userData.canvas = canvas;
    coordinateDisplay.userData.context = context;
    coordinateDisplay.userData.texture = texture;
    
    scene.add(coordinateDisplay);
    updateCoordinateDisplay();
}

function updateCoordinateDisplay() {
    if (!coordinateDisplay) return;
    
    const pos = ballPosition;
    const x = pos.x.toFixed(2);
    const y = pos.y.toFixed(2);
    const z = pos.z.toFixed(2);
    const text = `X: ${x}\nY: ${y}\nZ: ${z}`;
    
    const canvas = coordinateDisplay.userData.canvas;
    const context = coordinateDisplay.userData.context;
    const texture = coordinateDisplay.userData.texture;
    
    // Clear canvas
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw text
    context.fillStyle = '#ffffff';
    context.font = 'Bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Draw multi-line text
    const lines = text.split('\n');
    const lineHeight = 28;
    const startY = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, index) => {
        context.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });
    
    // Update texture
    texture.needsUpdate = true;
    
    // Update sprite position to follow ball
    coordinateDisplay.position.set(pos.x, pos.y + 1.5, pos.z);
}

