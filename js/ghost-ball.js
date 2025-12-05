// Ghost Ball - NPC ball that plays alongside the player in real-time
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';
import { getTerrainHeight, getRectangularHoles } from './course.js';
import { PHYSICS_CONSTANTS } from './physics.js';
import { getHolePosition, HOLE_RADIUS } from './game.js';

// Ghost ball constants
const BALL_RADIUS = 0.5;
const GHOST_COLOR = 0x88CCFF; // Light blue for ghost
const GHOST_OPACITY = 0.6;

// Ghost ball state
let ghostBallMesh = null;
let ghostBallPosition = new THREE.Vector3(0, BALL_RADIUS, 0);
let ghostBallVelocity = new THREE.Vector3(0, 0, 0);
let ghostBallStartPosition = new THREE.Vector3(0, BALL_RADIUS, 0);
let ghostBallStrokes = 0;
let ghostBallActive = false;
let ghostBallFinished = false;
let ghostBallInHole = false;

// Trail effect for ghost ball
let ghostTrailPoints = [];
const MAX_TRAIL_POINTS = 30;
let ghostTrailLine = null;

// Marker over ghost ball
let ghostMarker = null;

// Teleporter cooldown for ghost ball (independent from player)
let ghostTeleportCooldown = 0;
let ghostLastTeleportedDestinationId = null;
let ghostJustTeleported = false;

// Track if ghost ball triggered rectangular hole OOB
let ghostHasTriggeredRectangularHoleOOB = false;

/**
 * Create the ghost ball mesh
 */
export function createGhostBall() {
    // Remove existing ghost ball if present
    if (ghostBallMesh) {
        scene.remove(ghostBallMesh);
        ghostBallMesh.geometry.dispose();
        ghostBallMesh.material.dispose();
    }
    
    const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    const ballMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({
            color: GHOST_COLOR,
            transparent: true,
            opacity: GHOST_OPACITY,
            emissive: GHOST_COLOR,
            emissiveIntensity: 0.3
        })
        : new THREE.MeshBasicMaterial({
            color: GHOST_COLOR,
            transparent: true,
            opacity: GHOST_OPACITY
        });
    
    ghostBallMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    ghostBallMesh.position.copy(ghostBallPosition);
    ghostBallMesh.castShadow = false;
    ghostBallMesh.receiveShadow = false;
    ghostBallMesh.userData.isGhostBall = true;
    
    scene.add(ghostBallMesh);
    
    // Create trail line
    createGhostTrail();

    // Create marker
    createGhostMarker();

    return ghostBallMesh;
}

/**
 * Update ghost ball material based on current mode (for mode switching)
 */
export function updateGhostBallMaterial() {
    if (!ghostBallMesh) return;
    
    // Dispose old material
    if (ghostBallMesh.material) {
        ghostBallMesh.material.dispose();
    }
    
    // Create new material based on mode
    const ballMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({
            color: GHOST_COLOR,
            transparent: true,
            opacity: GHOST_OPACITY,
            emissive: GHOST_COLOR,
            emissiveIntensity: 0.3
        })
        : new THREE.MeshBasicMaterial({
            color: GHOST_COLOR,
            transparent: true,
            opacity: GHOST_OPACITY
        });
    
    ghostBallMesh.material = ballMaterial;
}

/**
 * Create trail effect for ghost ball
 */
function createGhostTrail() {
    if (ghostTrailLine) {
        scene.remove(ghostTrailLine);
        ghostTrailLine.geometry.dispose();
        ghostTrailLine.material.dispose();
    }
    
    const trailMaterial = new THREE.LineBasicMaterial({
        color: GHOST_COLOR,
        transparent: true,
        opacity: 0.4,
        linewidth: 2
    });
    
    const trailGeometry = new THREE.BufferGeometry();
    ghostTrailLine = new THREE.Line(trailGeometry, trailMaterial);
    ghostTrailLine.frustumCulled = false;
    scene.add(ghostTrailLine);
}

/**
 * Create marker over ghost ball
 */
function createGhostMarker() {
    if (ghostMarker) {
        scene.remove(ghostMarker);
        ghostMarker.geometry.dispose();
        ghostMarker.material.dispose();
    }

    // Create a simple marker - a small ring or circle above the ball
    const markerGeometry = new THREE.RingGeometry(0.3, 0.5, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0x88CCFF,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });

    ghostMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    ghostMarker.rotation.x = -Math.PI / 2; // Lay flat
    ghostMarker.position.copy(ghostBallPosition);
    ghostMarker.position.y += 2.0; // Float above the ball

    scene.add(ghostMarker);
}

/**
 * Update ghost ball trail
 */
function updateGhostTrail() {
    if (!ghostTrailLine || !ghostBallActive) return;

    const speed = ghostBallVelocity.length();

    // Only add trail points when moving and position is valid
    if (speed > 0.5 && isValidPosition(ghostBallPosition)) {
        ghostTrailPoints.push(ghostBallPosition.clone());
        if (ghostTrailPoints.length > MAX_TRAIL_POINTS) {
            ghostTrailPoints.shift();
        }
    } else if (ghostTrailPoints.length > 0) {
        // Fade out trail when stopped
        ghostTrailPoints.shift();
    }

    // Update trail geometry with NaN checks
    if (ghostTrailPoints.length >= 2) {
        // Filter out invalid points
        const validPoints = ghostTrailPoints.filter(point => isValidPosition(point));

        if (validPoints.length >= 2) {
            const positions = new Float32Array(validPoints.length * 3);
            validPoints.forEach((point, i) => {
                positions[i * 3] = point.x;
                positions[i * 3 + 1] = point.y;
                positions[i * 3 + 2] = point.z;
            });

            ghostTrailLine.geometry.setAttribute(
                'position',
                new THREE.BufferAttribute(positions, 3)
            );
            ghostTrailLine.geometry.setDrawRange(0, validPoints.length);
            ghostTrailLine.visible = true;
        } else {
            ghostTrailLine.visible = false;
        }
    } else {
        ghostTrailLine.visible = false;
    }
}

/**
 * Check if a position vector is valid (no NaN values)
 */
function isValidPosition(position) {
    return position &&
           !isNaN(position.x) &&
           !isNaN(position.y) &&
           !isNaN(position.z) &&
           isFinite(position.x) &&
           isFinite(position.y) &&
           isFinite(position.z);
}

/**
 * Initialize ghost ball for a new hole
 * @param {THREE.Vector3} startPosition - Tee position (same as player)
 * @param {THREE.Vector3} offset - Optional offset from player (default: slight X offset)
 */
export function initializeGhostBallForHole(startPosition, offset = new THREE.Vector3(1.5, 0, 0)) {
    // Set start position with optional offset
    ghostBallStartPosition.copy(startPosition).add(offset);
    ghostBallStartPosition.y = BALL_RADIUS;
    
    // Reset state
    ghostBallPosition.copy(ghostBallStartPosition);
    ghostBallVelocity.set(0, 0, 0);
    ghostBallStrokes = 0;
    ghostBallActive = true;
    ghostBallFinished = false;
    ghostBallInHole = false;
    ghostTrailPoints = [];
    
    // Reset teleporter state
    ghostTeleportCooldown = 0;
    ghostLastTeleportedDestinationId = null;
    ghostJustTeleported = false;
    ghostHasTriggeredRectangularHoleOOB = false;
    
    // Update mesh position
    if (ghostBallMesh) {
        ghostBallMesh.position.copy(ghostBallPosition);
        ghostBallMesh.visible = true;
    } else {
        createGhostBall();
    }
    
    console.log(`Ghost ball initialized at (${ghostBallPosition.x.toFixed(2)}, ${ghostBallPosition.y.toFixed(2)}, ${ghostBallPosition.z.toFixed(2)})`);
    
    return {
        position: ghostBallPosition.clone(),
        strokes: ghostBallStrokes,
        active: ghostBallActive
    };
}

/**
 * Update ghost ball physics (same physics as player ball but independent)
 * @param {number} deltaTime - Time since last frame
 */
export function updateGhostBallPhysics(deltaTime) {
    if (!ghostBallActive || ghostBallFinished) return;
    
    // Check if ghost ball is over hole
    const holePos = getHolePosition();
    const distanceToHole = Math.sqrt(
        Math.pow(ghostBallPosition.x - holePos.x, 2) +
        Math.pow(ghostBallPosition.z - holePos.z, 2)
    );
    const isOverHole = distanceToHole < HOLE_RADIUS;
    
    // Cap maximum velocity
    const MAX_SPEED = 200.0;
    let horizontalVel = new THREE.Vector3(ghostBallVelocity.x, 0, ghostBallVelocity.z);
    let currentSpeed = horizontalVel.length();
    
    if (currentSpeed > MAX_SPEED) {
        const scaleFactor = MAX_SPEED / currentSpeed;
        ghostBallVelocity.x *= scaleFactor;
        ghostBallVelocity.z *= scaleFactor;
        horizontalVel.multiplyScalar(scaleFactor);
        currentSpeed = MAX_SPEED;
    }
    
    // Check if over rectangular holes
    const rectangularHoles = getRectangularHoles();
    let isOverRectangularHole = false;
    for (const rectHole of rectangularHoles) {
        const halfWidth = rectHole.width / 2;
        const halfLength = rectHole.length / 2;
        const distX = Math.abs(ghostBallPosition.x - rectHole.x);
        const distZ = Math.abs(ghostBallPosition.z - rectHole.z);
        if (distX < halfWidth && distZ < halfLength) {
            isOverRectangularHole = true;
            break;
        }
    }
    
    // Check if deep in hole
    const isDeepInHole = ghostBallPosition.y < -0.5 && isOverHole;
    
    // Apply downward force when over hole
    if (isOverHole) {
        const BASE_DOWNWARD_FORCE = -200.0;
        const MAX_PULL_DISTANCE = 1.67;
        const POWER_SCALE = 80;
        const MAX_SHOT_SPEED = MAX_PULL_DISTANCE * POWER_SCALE;
        const speedFactor = Math.min(currentSpeed / MAX_SHOT_SPEED, 1.0);
        const DOWNWARD_FORCE = BASE_DOWNWARD_FORCE * (1.0 - speedFactor * 0.3);
        
        ghostBallVelocity.y += DOWNWARD_FORCE * deltaTime;
        
        const reductionFactor = 0.85 - (speedFactor * 0.1);
        ghostBallVelocity.x *= reductionFactor;
        ghostBallVelocity.z *= reductionFactor;
    }
    
    // Apply gravity when over rectangular holes
    if (isOverRectangularHole) {
        const DOWNWARD_FORCE = -150.0;
        ghostBallVelocity.y += DOWNWARD_FORCE * deltaTime;
        
        // Check if fallen deep into hazard - reset ghost ball position
        if (ghostBallPosition.y < -3.0 && !ghostHasTriggeredRectangularHoleOOB) {
            ghostHasTriggeredRectangularHoleOOB = true;
            handleGhostBallOutOfBounds();
        }
    } else {
        ghostHasTriggeredRectangularHoleOOB = false;
    }
    
    // Damping when deep in hole
    if (isDeepInHole) {
        ghostBallVelocity.multiplyScalar(0.95);
    }
    
    // Apply velocity to position
    const movement = ghostBallVelocity.clone().multiplyScalar(deltaTime);
    ghostBallPosition.add(movement);
    
    // Recalculate horizontal velocity
    horizontalVel.set(ghostBallVelocity.x, 0, ghostBallVelocity.z);
    currentSpeed = horizontalVel.length();
    
    // Apply friction
    if (currentSpeed > 0.01) {
        let friction = 0.98;
        if (currentSpeed < 1.0) {
            friction = 0.92;
        } else if (currentSpeed < 3.0) {
            const t = (currentSpeed - 1.0) / 2.0;
            friction = 0.92 + (0.06 * t);
        }
        ghostBallVelocity.x *= friction;
        ghostBallVelocity.z *= friction;
    }
    
    // Stop if too slow
    if (horizontalVel.length() < PHYSICS_CONSTANTS.MIN_VELOCITY) {
        ghostBallVelocity.x = 0;
        ghostBallVelocity.z = 0;
    }
    
    // Terrain collision (same as player ball)
    if (!isOverHole && !isOverRectangularHole) {
        const terrainY = getTerrainHeight(ghostBallPosition.x, ghostBallPosition.z);
        const targetY = terrainY + BALL_RADIUS;
        
        // Calculate slope gradient
        const slopeGradientX = calculateSlopeGradient(ghostBallPosition.x, ghostBallPosition.z, 'x');
        const slopeGradientZ = calculateSlopeGradient(ghostBallPosition.x, ghostBallPosition.z, 'z');
        
        const slopeGravityStrength = 15.0;
        ghostBallVelocity.x += slopeGradientX * slopeGravityStrength * deltaTime;
        ghostBallVelocity.z += slopeGradientZ * slopeGravityStrength * deltaTime;
        
        if (ghostBallPosition.y < targetY) {
            ghostBallPosition.y = targetY;
            if (ghostBallVelocity.y < 0) {
                ghostBallVelocity.y = 0;
            }
            const friction = 0.95;
            ghostBallVelocity.x *= friction;
            ghostBallVelocity.z *= friction;
        } else if (ghostBallPosition.y > targetY + 0.1) {
            ghostBallVelocity.y += PHYSICS_CONSTANTS.GRAVITY * deltaTime;
        }
    }
    
    // Update mesh position
    if (ghostBallMesh) {
        ghostBallMesh.position.copy(ghostBallPosition);

        // Rotate ball based on movement
        if (horizontalVel.length() > 0.01) {
            const rotationAxis = new THREE.Vector3(-ghostBallVelocity.z, 0, ghostBallVelocity.x).normalize();
            const rotationAmount = horizontalVel.length() * deltaTime / BALL_RADIUS;
            ghostBallMesh.rotateOnAxis(rotationAxis, rotationAmount);
        }
    }

    // Update marker position
    if (ghostMarker && ghostBallActive && isValidPosition(ghostBallPosition)) {
        ghostMarker.position.copy(ghostBallPosition);
        ghostMarker.position.y = ghostBallPosition.y + 2.0;
    }

    // Update trail
    updateGhostTrail();
}

/**
 * Calculate terrain slope gradient
 */
function calculateSlopeGradient(x, z, direction) {
    const sampleDistance = 0.5;
    const currentHeight = getTerrainHeight(x, z);
    
    let adjacentHeight;
    if (direction === 'x') {
        adjacentHeight = getTerrainHeight(x + sampleDistance, z);
    } else if (direction === 'z') {
        adjacentHeight = getTerrainHeight(x, z + sampleDistance);
    } else {
        return 0;
    }
    
    return (adjacentHeight - currentHeight) / sampleDistance;
}

/**
 * Handle ghost ball out of bounds (reset to start position with penalty)
 */
function handleGhostBallOutOfBounds() {
    console.log('Ghost ball out of bounds - resetting with +2 stroke penalty');
    ghostBallStrokes += 2; // Penalty strokes
    resetGhostBall();
}

/**
 * Reset ghost ball to start position
 */
export function resetGhostBall() {
    ghostBallPosition.copy(ghostBallStartPosition);
    ghostBallVelocity.set(0, 0, 0);
    ghostJustTeleported = false;
    ghostHasTriggeredRectangularHoleOOB = false;
    
    if (ghostBallMesh) {
        ghostBallMesh.position.copy(ghostBallPosition);
        ghostBallMesh.rotation.set(0, 0, 0);
    }
}

/**
 * Check if ghost ball has won (reached hole)
 * @returns {boolean} True if ghost ball is in hole
 */
export function checkGhostBallWinCondition() {
    if (!ghostBallActive || ghostBallFinished) return false;
    
    const holePos = getHolePosition();
    const horizontalDistance = Math.sqrt(
        Math.pow(ghostBallPosition.x - holePos.x, 2) +
        Math.pow(ghostBallPosition.z - holePos.z, 2)
    );
    
    const isDeepEnough = ghostBallPosition.y < -0.5;
    const isInHole = horizontalDistance < HOLE_RADIUS &&
        isDeepEnough &&
        (ghostBallVelocity.length() < 5.0 || ghostBallPosition.y < -1.0);
    
    if (isInHole && !ghostBallInHole) {
        ghostBallInHole = true;
        ghostBallFinished = true;
        ghostBallActive = false;
        
        // Hide ghost ball
        if (ghostBallMesh) {
            ghostBallMesh.visible = false;
        }
        
        console.log(`Ghost ball finished in ${ghostBallStrokes} strokes!`);
        return true;
    }
    
    return false;
}

/**
 * Apply a shot to the ghost ball
 * @param {THREE.Vector3} direction - Normalized direction vector
 * @param {number} power - Shot power (0-1)
 */
export function applyGhostBallShot(direction, power) {
    if (!ghostBallActive || ghostBallFinished) return;
    
    const MAX_PULL_DISTANCE = 1.67;
    const POWER_SCALE = 80;
    const velocity = direction.clone().multiplyScalar(power * MAX_PULL_DISTANCE * POWER_SCALE);
    
    ghostBallVelocity.copy(velocity);
    ghostBallStrokes++;
    
    console.log(`Ghost ball shot ${ghostBallStrokes}: power=${power.toFixed(2)}, velocity=(${velocity.x.toFixed(2)}, ${velocity.z.toFixed(2)})`);
}

/**
 * Check if ghost ball is at rest (stopped moving)
 * @returns {boolean} True if ball is at rest
 */
export function isGhostBallAtRest() {
    return ghostBallVelocity.length() < 0.1;
}

/**
 * Check if ghost ball is still in play
 * @returns {boolean} True if ghost ball is active and not finished
 */
export function isGhostBallActive() {
    return ghostBallActive && !ghostBallFinished;
}

/**
 * Get ghost ball state for AI decisions
 */
export function getGhostBallState() {
    return {
        position: ghostBallPosition.clone(),
        velocity: ghostBallVelocity.clone(),
        strokes: ghostBallStrokes,
        active: ghostBallActive,
        finished: ghostBallFinished,
        inHole: ghostBallInHole,
        atRest: isGhostBallAtRest()
    };
}

/**
 * Get ghost ball position
 */
export function getGhostBallPosition() {
    return ghostBallPosition.clone();
}

/**
 * Get ghost ball velocity
 */
export function getGhostBallVelocity() {
    return ghostBallVelocity.clone();
}

/**
 * Set ghost ball position (for teleportation)
 */
export function setGhostBallPosition(position) {
    ghostBallPosition.copy(position);
    if (ghostBallMesh) {
        ghostBallMesh.position.copy(ghostBallPosition);
    }
}

/**
 * Set ghost ball velocity
 */
export function setGhostBallVelocity(velocity) {
    ghostBallVelocity.copy(velocity);
}

/**
 * Handle ghost ball teleportation
 */
export function respawnGhostBallAtPosition(position, isYellowPortal = false) {
    ghostBallPosition.copy(position);
    ghostBallPosition.y = BALL_RADIUS;
    ghostBallVelocity.set(0, 0, 0);
    ghostJustTeleported = true;
    
    if (ghostBallMesh) {
        ghostBallMesh.position.copy(ghostBallPosition);
        ghostBallMesh.rotation.set(0, 0, 0);
    }

    // Update marker position
    if (ghostMarker && isValidPosition(ghostBallPosition)) {
        ghostMarker.position.copy(ghostBallPosition);
        ghostMarker.position.y = ghostBallPosition.y + 2.0;
    }

    // NOTE: Ghost ball does NOT trigger yellow portal cutscene
    // It just teleports silently
    if (isYellowPortal) {
        console.log('Ghost ball used yellow portal (no cutscene triggered)');
    }
}

/**
 * Update ghost teleporter cooldown
 */
export function updateGhostTeleportCooldown(deltaTime) {
    if (ghostTeleportCooldown > 0) {
        ghostTeleportCooldown -= deltaTime;
        if (ghostTeleportCooldown <= 0) {
            ghostTeleportCooldown = 0;
        }
    }
}

/**
 * Clear the just teleported flag
 */
export function clearGhostJustTeleported() {
    ghostJustTeleported = false;
}

/**
 * Check if ghost just teleported
 */
export function getGhostJustTeleported() {
    return ghostJustTeleported;
}

/**
 * Get/set ghost teleporter state
 */
export function getGhostTeleportCooldown() {
    return ghostTeleportCooldown;
}

export function setGhostTeleportCooldown(cooldown) {
    ghostTeleportCooldown = cooldown;
}

export function getGhostLastTeleportedDestination() {
    return ghostLastTeleportedDestinationId;
}

export function setGhostLastTeleportedDestination(teleporter) {
    ghostLastTeleportedDestinationId = teleporter;
}

/**
 * Get ghost ball strokes
 */
export function getGhostBallStrokes() {
    return ghostBallStrokes;
}

/**
 * Hide ghost ball
 */
export function hideGhostBall() {
    if (ghostBallMesh) {
        ghostBallMesh.visible = false;
    }
    if (ghostTrailLine) {
        ghostTrailLine.visible = false;
    }
    if (ghostMarker) {
        ghostMarker.visible = false;
    }
    ghostBallActive = false;
}

/**
 * Show ghost ball
 */
export function showGhostBall() {
    if (ghostBallMesh) {
        ghostBallMesh.visible = true;
    }
    if (ghostMarker) {
        ghostMarker.visible = true;
    }
    ghostBallActive = true;
}

/**
 * Clean up ghost ball resources
 */
export function removeGhostBall() {
    if (ghostBallMesh) {
        scene.remove(ghostBallMesh);
        ghostBallMesh.geometry.dispose();
        ghostBallMesh.material.dispose();
        ghostBallMesh = null;
    }
    
    if (ghostTrailLine) {
        scene.remove(ghostTrailLine);
        ghostTrailLine.geometry.dispose();
        ghostTrailLine.material.dispose();
        ghostTrailLine = null;
    }

    if (ghostMarker) {
        scene.remove(ghostMarker);
        ghostMarker.geometry.dispose();
        ghostMarker.material.dispose();
        ghostMarker = null;
    }

    ghostTrailPoints = [];
    ghostBallActive = false;
}

export { BALL_RADIUS as GHOST_BALL_RADIUS };

