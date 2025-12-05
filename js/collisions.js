// Collision detection and response
import * as THREE from 'three';
import { scene } from './main.js';
import { getBallPosition, getBallVelocity, setBallVelocity, setBallPosition, resetBall } from './ball.js';
import { getCourseBounds, getTestWalls, getRectangularHoleWalls, getRectangularHoleEdgeWalls, getRectangularHoles, getCustomWalls } from './course.js';
import { PHYSICS_CONSTANTS } from './physics.js';
import { incrementStroke } from './game.js';
import { createImpactEffect } from './particles.js';
import { checkBumperCollisions } from './bumpers.js';
// Removed Ghost Ball imports - no longer needed

const BALL_RADIUS = 0.5;
let isOutOfBounds = false;
let hasTriggeredRectangularHoleOOB = false; // Prevent multiple triggers
let outOfBoundsTimer = 0;
const OUT_OF_BOUNDS_GRACE = 0.35; // seconds the ball must stay outside before penalty

// Store previous position for continuous collision detection
let previousBallPosition = null;


export function checkWallCollisions() {
    const ballPos = getBallPosition();
    const ballVel = getBallVelocity();
    const deltaTime = PHYSICS_CONSTANTS?.DELTA_TIME_OVERRIDE || 0; // optional override, else handled by substeps
    
    // Store previous position for next frame
    if (previousBallPosition === null) {
        previousBallPosition = ballPos.clone();
    }
    const bounds = getCourseBounds();
    const OUT_OF_BOUNDS_MARGIN = 2.0;
    
    // Initialize collision tracking
    let collisionOccurred = false;
    
    // Check if completely out of bounds, but allow a short grace period
    const outsideBounds = (
        ballPos.x < bounds.minX - OUT_OF_BOUNDS_MARGIN || 
        ballPos.x > bounds.maxX + OUT_OF_BOUNDS_MARGIN ||
        ballPos.z < bounds.minZ - OUT_OF_BOUNDS_MARGIN || 
        ballPos.z > bounds.maxZ + OUT_OF_BOUNDS_MARGIN
    );
    if (outsideBounds) {
        // Use deltaTime if provided; otherwise assume ~60fps for safety
        const dt = deltaTime && deltaTime > 0 ? deltaTime : 1 / 60;
        outOfBoundsTimer += dt;
        if (outOfBoundsTimer >= OUT_OF_BOUNDS_GRACE && !isOutOfBounds) {
            handleOutOfBounds();
            return true;
        }
        // Still outside but within grace period; treat as collision handled to avoid further processing
        return true;
    } else {
        // Reset timer when back inside
        outOfBoundsTimer = 0;
    }
    
    // Normal wall collision (only for standard rectangular courses - custom wall courses use customWalls)
    let collisionNormal = new THREE.Vector3();
    const correctedPos = ballPos.clone();
    
    // Check if we have custom walls - if so, skip perimeter collision as custom walls handle it
    const customWalls = getCustomWalls();
    const hasCustomWalls = customWalls && customWalls.length > 0;
    
    if (!hasCustomWalls) {
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
            
            // Create impact effect at collision point
            const impactIntensity = Math.min(ballVel.length() / 50.0, 2.0); // Scale intensity by speed
            createImpactEffect(correctedPos.clone(), collisionNormal.clone(), impactIntensity);
        }
    }
    
    // Check collisions with test walls (internal walls) - use same simple logic as perimeter walls
    const testWalls = getTestWalls();
    for (const testWall of testWalls) {
        if (!testWall.userData.wallBounds) {
            continue;
        }
        
        // Quick AABB rejection
        const bounds = testWall.userData.wallBounds;
        if (ballPos.x + BALL_RADIUS < bounds.minX || 
            ballPos.x - BALL_RADIUS > bounds.maxX ||
            ballPos.z + BALL_RADIUS < bounds.minZ || 
            ballPos.z - BALL_RADIUS > bounds.maxZ ||
            ballPos.y >= bounds.maxY || ballPos.y <= bounds.minY) {
            continue;
        }
        
        // Transform to local space for accurate collision check
        const wallPos = testWall.position;
        const wallRotation = testWall.rotation.y;
        const wallWidth = testWall.userData.wallWidth || 2.0;
        const wallLength = testWall.userData.wallLength || 15.0;
        const wallHeight = testWall.userData.wallHeight || 3.0;
        
        const cosRot = Math.cos(-wallRotation);
        const sinRot = Math.sin(-wallRotation);
        
        const relativePos = ballPos.clone().sub(wallPos);
        const localX = relativePos.x * cosRot - relativePos.z * sinRot;
        const localZ = relativePos.x * sinRot + relativePos.z * cosRot;
        const localY = relativePos.y;
        
        const halfWidth = wallWidth / 2;
        const halfDepth = wallLength / 2;
        const halfHeight = wallHeight / 2;
        
        // Check collision in local space (same as perimeter walls)
        let correctedLocalX = localX;
        let correctedLocalZ = localZ;
        let wallCollision = false;
        let collisionNormalLocal = new THREE.Vector3();
        
        // Check each face and clamp (same logic as perimeter walls)
        if (localX + BALL_RADIUS > -halfWidth && localX - BALL_RADIUS < halfWidth &&
            localZ + BALL_RADIUS > -halfDepth && localZ - BALL_RADIUS < halfDepth &&
            localY < halfHeight && localY > -halfHeight) {
            
            // Ball is inside - find closest face and push out (same as perimeter walls)
            const distToLeft = Math.abs(localX - (-halfWidth));
            const distToRight = Math.abs(localX - halfWidth);
            const distToFront = Math.abs(localZ - (-halfDepth));
            const distToBack = Math.abs(localZ - halfDepth);
            
            const minDist = Math.min(distToLeft, distToRight, distToFront, distToBack);
            
            if (minDist === distToLeft) {
                correctedLocalX = -halfWidth + BALL_RADIUS;
                collisionNormalLocal.set(1, 0, 0);
                wallCollision = true;
            } else if (minDist === distToRight) {
                correctedLocalX = halfWidth - BALL_RADIUS;
                collisionNormalLocal.set(-1, 0, 0);
                wallCollision = true;
            } else if (minDist === distToFront) {
                correctedLocalZ = -halfDepth + BALL_RADIUS;
                collisionNormalLocal.set(0, 0, 1);
                wallCollision = true;
            } else if (minDist === distToBack) {
                correctedLocalZ = halfDepth - BALL_RADIUS;
                collisionNormalLocal.set(0, 0, -1);
                wallCollision = true;
            }
            
            if (wallCollision) {
                // Transform back to world space
                const correctedWorldX = correctedLocalX * cosRot - correctedLocalZ * sinRot + wallPos.x;
                const correctedWorldZ = correctedLocalX * sinRot + correctedLocalZ * cosRot + wallPos.z;
                const correctedWorldPos = new THREE.Vector3(correctedWorldX, ballPos.y, correctedWorldZ);
                
                // Transform normal to world space
                const normalX = collisionNormalLocal.x * cosRot - collisionNormalLocal.z * sinRot;
                const normalZ = collisionNormalLocal.x * sinRot + collisionNormalLocal.z * cosRot;
                const wallNormal = new THREE.Vector3(normalX, 0, normalZ).normalize();
                
                setBallPosition(correctedWorldPos);
                
                if (ballVel.length() > 0.01) {
                    const reflectedVel = ballVel.clone();
                    reflectedVel.reflect(wallNormal);
                    reflectedVel.multiplyScalar(PHYSICS_CONSTANTS.BOUNCE_DAMPING);
                    setBallVelocity(reflectedVel);
                    
                    // Create impact effect at collision point
                    const impactIntensity = Math.min(ballVel.length() / 50.0, 2.0);
                    createImpactEffect(correctedWorldPos.clone(), wallNormal.clone(), impactIntensity);
                }
                
                collisionOccurred = true;
                break; // Only handle one collision per frame
            }
        }
    }
    
    // Check collisions with custom walls using swept collision detection
    // This prevents fast-moving balls from phasing through walls
    if (!collisionOccurred) {
        const customWalls = getCustomWalls();
        const prevPos = previousBallPosition || ballPos.clone();
        
        for (const wall of customWalls) {
            const bounds = wall.userData.bounds;
            if (!bounds) continue;
            
            // Expand bounds by ball radius for swept sphere collision
            const expandedBounds = {
                minX: bounds.minX - BALL_RADIUS,
                maxX: bounds.maxX + BALL_RADIUS,
                minZ: bounds.minZ - BALL_RADIUS,
                maxZ: bounds.maxZ + BALL_RADIUS
            };
            
            // First check: is ball currently overlapping?
            const currentlyOverlapping = (
                ballPos.x > expandedBounds.minX && 
                ballPos.x < expandedBounds.maxX &&
                ballPos.z > expandedBounds.minZ && 
                ballPos.z < expandedBounds.maxZ
            );
            
            // Second check: did ball path cross through the wall? (swept collision)
            let sweptCollision = false;
            let collisionT = 1.0; // Parameter along path where collision occurs (0=start, 1=end)
            let collisionNormal = new THREE.Vector3();
            
            if (!currentlyOverlapping && prevPos) {
                // Check if line segment from prevPos to ballPos crosses any wall face
                const dx = ballPos.x - prevPos.x;
                const dz = ballPos.z - prevPos.z;
                
                // Check each face of the expanded AABB
                // Left face (x = minX)
                if (dx > 0 && prevPos.x <= expandedBounds.minX && ballPos.x >= expandedBounds.minX) {
                    const t = (expandedBounds.minX - prevPos.x) / dx;
                    const zAtT = prevPos.z + t * dz;
                    if (t >= 0 && t <= 1 && zAtT >= expandedBounds.minZ && zAtT <= expandedBounds.maxZ) {
                        if (t < collisionT) {
                            collisionT = t;
                            collisionNormal.set(-1, 0, 0);
                            sweptCollision = true;
                        }
                    }
                }
                // Right face (x = maxX)
                if (dx < 0 && prevPos.x >= expandedBounds.maxX && ballPos.x <= expandedBounds.maxX) {
                    const t = (expandedBounds.maxX - prevPos.x) / dx;
                    const zAtT = prevPos.z + t * dz;
                    if (t >= 0 && t <= 1 && zAtT >= expandedBounds.minZ && zAtT <= expandedBounds.maxZ) {
                        if (t < collisionT) {
                            collisionT = t;
                            collisionNormal.set(1, 0, 0);
                            sweptCollision = true;
                        }
                    }
                }
                // Front face (z = minZ)
                if (dz > 0 && prevPos.z <= expandedBounds.minZ && ballPos.z >= expandedBounds.minZ) {
                    const t = (expandedBounds.minZ - prevPos.z) / dz;
                    const xAtT = prevPos.x + t * dx;
                    if (t >= 0 && t <= 1 && xAtT >= expandedBounds.minX && xAtT <= expandedBounds.maxX) {
                        if (t < collisionT) {
                            collisionT = t;
                            collisionNormal.set(0, 0, -1);
                            sweptCollision = true;
                        }
                    }
                }
                // Back face (z = maxZ)
                if (dz < 0 && prevPos.z >= expandedBounds.maxZ && ballPos.z <= expandedBounds.maxZ) {
                    const t = (expandedBounds.maxZ - prevPos.z) / dz;
                    const xAtT = prevPos.x + t * dx;
                    if (t >= 0 && t <= 1 && xAtT >= expandedBounds.minX && xAtT <= expandedBounds.maxX) {
                        if (t < collisionT) {
                            collisionT = t;
                            collisionNormal.set(0, 0, 1);
                            sweptCollision = true;
                        }
                    }
                }
            }
            
            if (currentlyOverlapping || sweptCollision) {
                let correctedPos;
                
                if (sweptCollision && !currentlyOverlapping) {
                    // Ball passed through - place it at the collision point
                    correctedPos = new THREE.Vector3(
                        prevPos.x + collisionT * (ballPos.x - prevPos.x),
                        ballPos.y,
                        prevPos.z + collisionT * (ballPos.z - prevPos.z)
                    );
                    // Push slightly outside the wall
                    correctedPos.add(collisionNormal.clone().multiplyScalar(0.01));
                } else {
                    // Ball is currently overlapping - push out to nearest edge
                    const distToLeft = ballPos.x - expandedBounds.minX;
                    const distToRight = expandedBounds.maxX - ballPos.x;
                    const distToFront = ballPos.z - expandedBounds.minZ;
                    const distToBack = expandedBounds.maxZ - ballPos.z;
                    
                    const minDist = Math.min(distToLeft, distToRight, distToFront, distToBack);
                    
                    correctedPos = ballPos.clone();
                    
                    if (minDist === distToLeft) {
                        correctedPos.x = expandedBounds.minX;
                        collisionNormal.set(-1, 0, 0);
                    } else if (minDist === distToRight) {
                        correctedPos.x = expandedBounds.maxX;
                        collisionNormal.set(1, 0, 0);
                    } else if (minDist === distToFront) {
                        correctedPos.z = expandedBounds.minZ;
                        collisionNormal.set(0, 0, -1);
                    } else if (minDist === distToBack) {
                        correctedPos.z = expandedBounds.maxZ;
                        collisionNormal.set(0, 0, 1);
                    }
                }
                
                setBallPosition(correctedPos);
                
                if (ballVel.length() > 0.01) {
                    const reflectedVel = ballVel.clone();
                    reflectedVel.reflect(collisionNormal);
                    reflectedVel.multiplyScalar(PHYSICS_CONSTANTS.BOUNCE_DAMPING);
                    setBallVelocity(reflectedVel);
                    
                    const impactIntensity = Math.min(ballVel.length() / 50.0, 2.0);
                    createImpactEffect(correctedPos.clone(), collisionNormal.clone(), impactIntensity);
                }
                
                collisionOccurred = true;
                break;
            }
        }
    }
    
    // Check collisions with bumpers (donut-shaped obstacles)
    const bumperCollision = checkBumperCollisions(ballPos, BALL_RADIUS);
    if (bumperCollision.collided) {
        const correctedPos = bumperCollision.correctedPos;
        const bumperNormal = bumperCollision.normal;
        
        setBallPosition(correctedPos);
        
        if (ballVel.length() > 0.01) {
            // Reflect velocity off the bumper with 200% energy retention (adds energy!)
            const reflectedVel = ballVel.clone();
            reflectedVel.reflect(bumperNormal);
            // Bumpers add energy - multiply by 2.0 (200% retention)
            reflectedVel.multiplyScalar(2.0);
            setBallVelocity(reflectedVel);
            
            // Create impact effect
            const impactIntensity = Math.min(ballVel.length() / 50.0, 2.0);
            createImpactEffect(correctedPos.clone(), bumperNormal.clone(), impactIntensity);
        }
        
        collisionOccurred = true;
    }
    
    // Edge barriers removed - no collision detection needed for them
    // These barriers are positioned slightly inward from the edges
    // They only collide when ball is already well inside the hole (falling), not when approaching from above
    if (ballPos.y < -2.0) { // Only check when ball is deep in the hole
        const rectangularHoleEdgeWalls = getRectangularHoleEdgeWalls();
        const rectangularHoles = getRectangularHoles();
        
        // Check if ball is over any rectangular hole area
        let isOverRectangularHole = false;
        let currentRectHole = null;
        for (const rectHole of rectangularHoles) {
            const halfWidth = rectHole.width / 2;
            const halfLength = rectHole.length / 2;
            const distX = Math.abs(ballPos.x - rectHole.x);
            const distZ = Math.abs(ballPos.z - rectHole.z);
            if (distX < halfWidth && distZ < halfLength) {
                isOverRectangularHole = true;
                currentRectHole = rectHole;
                break;
            }
        }
        
        // Only check barrier collisions if ball is inside the hole
        if (isOverRectangularHole) {
            for (const barrier of rectangularHoleEdgeWalls) {
                const rectHole = barrier.userData.rectangularHole;
                if (!rectHole || rectHole !== currentRectHole) continue;
                
                const wallType = barrier.userData.wallType;
                const halfWidth = rectHole.width / 2;
                const halfLength = rectHole.length / 2;
                const BARRIER_INSET = 0.3;
                const BARRIER_THICKNESS = 0.1;
                const HOLE_DEPTH = 10.0;
                
                let isColliding = false;
                let collisionNormal = new THREE.Vector3();
                let correctedPos = ballPos.clone();
                
                if (wallType === 'left') {
                    // Left barrier - positioned inward from left edge
                    const barrierX = rectHole.x - halfWidth + BARRIER_INSET;
                    const distX = Math.abs(ballPos.x - barrierX);
                    const distZ = Math.abs(ballPos.z - rectHole.z);
                    if (distX < BARRIER_THICKNESS + BALL_RADIUS && 
                        distZ < halfLength - BARRIER_INSET + BALL_RADIUS &&
                        ballPos.y > -HOLE_DEPTH) {
                        correctedPos.x = barrierX - BARRIER_THICKNESS - BALL_RADIUS;
                        collisionNormal.set(1, 0, 0);
                        isColliding = true;
                    }
                } else if (wallType === 'right') {
                    // Right barrier - positioned inward from right edge
                    const barrierX = rectHole.x + halfWidth - BARRIER_INSET;
                    const distX = Math.abs(ballPos.x - barrierX);
                    const distZ = Math.abs(ballPos.z - rectHole.z);
                    if (distX < BARRIER_THICKNESS + BALL_RADIUS && 
                        distZ < halfLength - BARRIER_INSET + BALL_RADIUS &&
                        ballPos.y > -HOLE_DEPTH) {
                        correctedPos.x = barrierX + BARRIER_THICKNESS + BALL_RADIUS;
                        collisionNormal.set(-1, 0, 0);
                        isColliding = true;
                    }
                } else if (wallType === 'front') {
                    // Front barrier - positioned inward from front edge
                    const barrierZ = rectHole.z - halfLength + BARRIER_INSET;
                    const distX = Math.abs(ballPos.x - rectHole.x);
                    const distZ = Math.abs(ballPos.z - barrierZ);
                    if (distX < halfWidth - BARRIER_INSET + BALL_RADIUS && 
                        distZ < BARRIER_THICKNESS + BALL_RADIUS &&
                        ballPos.y > -HOLE_DEPTH) {
                        correctedPos.z = barrierZ - BARRIER_THICKNESS - BALL_RADIUS;
                        collisionNormal.set(0, 0, 1);
                        isColliding = true;
                    }
                } else if (wallType === 'back') {
                    // Back barrier - positioned inward from back edge
                    const barrierZ = rectHole.z + halfLength - BARRIER_INSET;
                    const distX = Math.abs(ballPos.x - rectHole.x);
                    const distZ = Math.abs(ballPos.z - barrierZ);
                    if (distX < halfWidth - BARRIER_INSET + BALL_RADIUS && 
                        distZ < BARRIER_THICKNESS + BALL_RADIUS &&
                        ballPos.y > -HOLE_DEPTH) {
                        correctedPos.z = barrierZ + BARRIER_THICKNESS + BALL_RADIUS;
                        collisionNormal.set(0, 0, -1);
                        isColliding = true;
                    }
                }
                
                if (isColliding) {
                    // Use regular wall collision logic - push the ball away from the wall
                    setBallPosition(correctedPos);

                    if (ballVel.length() > 0.01) {
                        const reflectedVel = ballVel.clone();
                        reflectedVel.reflect(collisionNormal);
                        reflectedVel.multiplyScalar(PHYSICS_CONSTANTS.BOUNCE_DAMPING);
                        setBallVelocity(reflectedVel);

                        const impactIntensity = Math.min(ballVel.length() / 50.0, 2.0);
                        createImpactEffect(correctedPos.clone(), collisionNormal.clone(), impactIntensity);
                    }

                    collisionOccurred = true;
                    break; // Only handle one collision per frame
                }
            }
        }
    }

    // Edge barriers removed - no collision detection needed for them

    // Check collisions with rectangular hole interior walls (deep inside the hole)
    // These walls are very deep and prevent the ball from escaping once it's deep in the hole
    if (ballPos.y < -5.0) {
        const rectangularHoleWalls = getRectangularHoleWalls();
        
        for (const wall of rectangularHoleWalls) {
            const rectHole = wall.userData.rectangularHole;
            if (!rectHole) continue;
            
            const wallType = wall.userData.wallType;
            const halfWidth = rectHole.width / 2;
            const halfLength = rectHole.length / 2;
            const wallThickness = 0.2;
            
            let isColliding = false;
            let collisionNormal = new THREE.Vector3();
            let correctedPos = ballPos.clone();
            
            if (wallType === 'left') {
                // Left wall - check X collision
                const distX = Math.abs(ballPos.x - (rectHole.x - halfWidth));
                const distZ = Math.abs(ballPos.z - rectHole.z);
                if (distX < wallThickness + BALL_RADIUS && distZ < halfLength + BALL_RADIUS) {
                    correctedPos.x = rectHole.x - halfWidth - wallThickness - BALL_RADIUS;
                    collisionNormal.set(1, 0, 0);
                    isColliding = true;
                }
            } else if (wallType === 'right') {
                // Right wall - check X collision
                const distX = Math.abs(ballPos.x - (rectHole.x + halfWidth));
                const distZ = Math.abs(ballPos.z - rectHole.z);
                if (distX < wallThickness + BALL_RADIUS && distZ < halfLength + BALL_RADIUS) {
                    correctedPos.x = rectHole.x + halfWidth + wallThickness + BALL_RADIUS;
                    collisionNormal.set(-1, 0, 0);
                    isColliding = true;
                }
            } else if (wallType === 'front') {
                // Front wall - check Z collision
                const distX = Math.abs(ballPos.x - rectHole.x);
                const distZ = Math.abs(ballPos.z - (rectHole.z - halfLength));
                if (distX < halfWidth + BALL_RADIUS && distZ < wallThickness + BALL_RADIUS) {
                    correctedPos.z = rectHole.z - halfLength - wallThickness - BALL_RADIUS;
                    collisionNormal.set(0, 0, 1);
                    isColliding = true;
                }
            } else if (wallType === 'back') {
                // Back wall - check Z collision
                const distX = Math.abs(ballPos.x - rectHole.x);
                const distZ = Math.abs(ballPos.z - (rectHole.z + halfLength));
                if (distX < halfWidth + BALL_RADIUS && distZ < wallThickness + BALL_RADIUS) {
                    correctedPos.z = rectHole.z + halfLength + wallThickness + BALL_RADIUS;
                    collisionNormal.set(0, 0, -1);
                    isColliding = true;
                }
            }
            
            if (isColliding) {
                setBallPosition(correctedPos);
                
                if (ballVel.length() > 0.01) {
                    const reflectedVel = ballVel.clone();
                    reflectedVel.reflect(collisionNormal);
                    reflectedVel.multiplyScalar(PHYSICS_CONSTANTS.BOUNCE_DAMPING);
                    setBallVelocity(reflectedVel);
                    
                    const impactIntensity = Math.min(ballVel.length() / 50.0, 2.0);
                    createImpactEffect(correctedPos.clone(), collisionNormal.clone(), impactIntensity);
                }
                
                collisionOccurred = true;
                break; // Only handle one collision per frame
            }
        }
    }

    // Always update previous position for next frame
    // Use the current (possibly corrected) ball position
    previousBallPosition = getBallPosition().clone();

    return collisionOccurred;
}

function handleOutOfBounds() {
    isOutOfBounds = true;
    outOfBoundsTimer = 0;
    setBallVelocity(new THREE.Vector3(0, 0, 0));
    
    // +2 stroke penalty
    incrementStroke();
    incrementStroke();
    
    showOutOfBoundsMessage();
    
    setTimeout(() => {
        resetBall();
        resetCollisions();
        hideOutOfBoundsMessage();
        isOutOfBounds = false;
    }, 2000);
}

export function handleRectangularHoleOutOfBounds() {
    // Prevent multiple triggers - only trigger once per fall
    if (hasTriggeredRectangularHoleOOB) {
        return;
    }
    hasTriggeredRectangularHoleOOB = true;
    
    // Same as regular out of bounds - ball fell into rectangular hole hazard
    handleOutOfBounds();
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

export function resetCollisions() {
    isOutOfBounds = false;
    previousBallPosition = null; // Reset previous position tracking
    hasTriggeredRectangularHoleOOB = false; // Reset flag when collisions reset
    outOfBoundsTimer = 0;
}
