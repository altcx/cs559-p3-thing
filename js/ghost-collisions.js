// Ghost Ball Collision System - Independent from player ball collisions
import * as THREE from 'three';
import { 
    getGhostBallPosition, 
    getGhostBallVelocity, 
    setGhostBallPosition, 
    setGhostBallVelocity,
    resetGhostBall,
    respawnGhostBallAtPosition,
    getGhostJustTeleported,
    clearGhostJustTeleported,
    getGhostTeleportCooldown,
    setGhostTeleportCooldown,
    getGhostLastTeleportedDestination,
    setGhostLastTeleportedDestination,
    GHOST_BALL_RADIUS
} from './ghost-ball.js';
import { 
    getCourseBounds, 
    getTestWalls, 
    getRectangularHoles, 
    getRectangularHoleWalls, 
    getRectangularHoleEdgeWalls, 
    getCustomWalls 
} from './course.js';
import { PHYSICS_CONSTANTS } from './physics.js';
import { checkBumperCollisions } from './bumpers.js';
import { getTeleporters } from './teleporters.js';

const BALL_RADIUS = GHOST_BALL_RADIUS;

// Track previous position for swept collision detection
let ghostPreviousBallPosition = null;

// Out of bounds tracking
let ghostIsOutOfBounds = false;
let ghostOutOfBoundsTimer = 0;
const OUT_OF_BOUNDS_GRACE = 0.35;

/**
 * Check wall collisions for ghost ball
 * Same logic as player ball but operates on ghost ball state
 * @returns {boolean} True if collision occurred
 */
export function checkGhostWallCollisions() {
    // Skip collision check if just teleported
    if (getGhostJustTeleported()) {
        clearGhostJustTeleported();
        ghostPreviousBallPosition = null;
        return false;
    }
    
    const ballPos = getGhostBallPosition();
    const ballVel = getGhostBallVelocity();
    
    if (ghostPreviousBallPosition === null) {
        ghostPreviousBallPosition = ballPos.clone();
    }
    
    const bounds = getCourseBounds();
    const OUT_OF_BOUNDS_MARGIN = 2.0;
    
    let collisionOccurred = false;
    
    // Check if completely out of bounds
    const outsideBounds = (
        ballPos.x < bounds.minX - OUT_OF_BOUNDS_MARGIN || 
        ballPos.x > bounds.maxX + OUT_OF_BOUNDS_MARGIN ||
        ballPos.z < bounds.minZ - OUT_OF_BOUNDS_MARGIN || 
        ballPos.z > bounds.maxZ + OUT_OF_BOUNDS_MARGIN
    );
    
    if (outsideBounds) {
        ghostOutOfBoundsTimer += 1/60;
        if (ghostOutOfBoundsTimer >= OUT_OF_BOUNDS_GRACE && !ghostIsOutOfBounds) {
            handleGhostOutOfBounds();
            return true;
        }
        return true;
    } else {
        ghostOutOfBoundsTimer = 0;
    }
    
    // Wall collision
    let collisionNormal = new THREE.Vector3();
    const correctedPos = ballPos.clone();
    
    // Check custom walls
    const customWalls = getCustomWalls();
    const hasCustomWalls = customWalls && customWalls.length > 0;
    
    if (!hasCustomWalls) {
        // Perimeter walls (same as player ball)
        if (ballPos.z - BALL_RADIUS < bounds.minZ) {
            correctedPos.z = bounds.minZ + BALL_RADIUS;
            collisionNormal.set(0, 0, 1);
            collisionOccurred = true;
        }
        if (ballPos.z + BALL_RADIUS > bounds.maxZ) {
            correctedPos.z = bounds.maxZ - BALL_RADIUS;
            collisionNormal.set(0, 0, -1);
            collisionOccurred = true;
        }
        if (ballPos.x + BALL_RADIUS > bounds.maxX) {
            correctedPos.x = bounds.maxX - BALL_RADIUS;
            collisionNormal.set(-1, 0, 0);
            collisionOccurred = true;
        }
        if (ballPos.x - BALL_RADIUS < bounds.minX) {
            correctedPos.x = bounds.minX + BALL_RADIUS;
            collisionNormal.set(1, 0, 0);
            collisionOccurred = true;
        }
        
        if (collisionOccurred) {
            setGhostBallPosition(correctedPos);
        }
        
        if (collisionOccurred && ballVel.length() > 0.01) {
            const reflectedVel = ballVel.clone();
            reflectedVel.reflect(collisionNormal);
            reflectedVel.multiplyScalar(PHYSICS_CONSTANTS.BOUNCE_DAMPING);
            setGhostBallVelocity(reflectedVel);
        }
    }
    
    // Test walls (internal walls)
    const testWalls = getTestWalls();
    for (const testWall of testWalls) {
        if (!testWall.userData.wallBounds) continue;
        
        const wallBounds = testWall.userData.wallBounds;
        if (ballPos.x + BALL_RADIUS < wallBounds.minX || 
            ballPos.x - BALL_RADIUS > wallBounds.maxX ||
            ballPos.z + BALL_RADIUS < wallBounds.minZ || 
            ballPos.z - BALL_RADIUS > wallBounds.maxZ ||
            ballPos.y >= wallBounds.maxY || ballPos.y <= wallBounds.minY) {
            continue;
        }
        
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
        
        let correctedLocalX = localX;
        let correctedLocalZ = localZ;
        let wallCollision = false;
        let collisionNormalLocal = new THREE.Vector3();
        
        if (localX + BALL_RADIUS > -halfWidth && localX - BALL_RADIUS < halfWidth &&
            localZ + BALL_RADIUS > -halfDepth && localZ - BALL_RADIUS < halfDepth &&
            localY < halfHeight && localY > -halfHeight) {
            
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
                const correctedWorldX = correctedLocalX * cosRot - correctedLocalZ * sinRot + wallPos.x;
                const correctedWorldZ = correctedLocalX * sinRot + correctedLocalZ * cosRot + wallPos.z;
                const correctedWorldPos = new THREE.Vector3(correctedWorldX, ballPos.y, correctedWorldZ);
                
                const normalX = collisionNormalLocal.x * cosRot - collisionNormalLocal.z * sinRot;
                const normalZ = collisionNormalLocal.x * sinRot + collisionNormalLocal.z * cosRot;
                const wallNormal = new THREE.Vector3(normalX, 0, normalZ).normalize();
                
                setGhostBallPosition(correctedWorldPos);
                
                if (ballVel.length() > 0.01) {
                    const reflectedVel = ballVel.clone();
                    reflectedVel.reflect(wallNormal);
                    reflectedVel.multiplyScalar(PHYSICS_CONSTANTS.BOUNCE_DAMPING);
                    setGhostBallVelocity(reflectedVel);
                }
                
                collisionOccurred = true;
                break;
            }
        }
    }
    
    // Custom walls with swept collision detection
    if (!collisionOccurred) {
        const prevPos = ghostPreviousBallPosition || ballPos.clone();
        
        for (const wall of customWalls) {
            const wallBounds = wall.userData.bounds;
            if (!wallBounds) continue;
            
            const expandedBounds = {
                minX: wallBounds.minX - BALL_RADIUS,
                maxX: wallBounds.maxX + BALL_RADIUS,
                minZ: wallBounds.minZ - BALL_RADIUS,
                maxZ: wallBounds.maxZ + BALL_RADIUS
            };
            
            const currentlyOverlapping = (
                ballPos.x > expandedBounds.minX && 
                ballPos.x < expandedBounds.maxX &&
                ballPos.z > expandedBounds.minZ && 
                ballPos.z < expandedBounds.maxZ
            );
            
            let sweptCollision = false;
            let collisionT = 1.0;
            let localCollisionNormal = new THREE.Vector3();
            
            if (!currentlyOverlapping && prevPos) {
                const dx = ballPos.x - prevPos.x;
                const dz = ballPos.z - prevPos.z;
                
                // Left face
                if (dx > 0 && prevPos.x <= expandedBounds.minX && ballPos.x >= expandedBounds.minX) {
                    const t = (expandedBounds.minX - prevPos.x) / dx;
                    const zAtT = prevPos.z + t * dz;
                    if (t >= 0 && t <= 1 && zAtT >= expandedBounds.minZ && zAtT <= expandedBounds.maxZ) {
                        if (t < collisionT) {
                            collisionT = t;
                            localCollisionNormal.set(-1, 0, 0);
                            sweptCollision = true;
                        }
                    }
                }
                // Right face
                if (dx < 0 && prevPos.x >= expandedBounds.maxX && ballPos.x <= expandedBounds.maxX) {
                    const t = (expandedBounds.maxX - prevPos.x) / dx;
                    const zAtT = prevPos.z + t * dz;
                    if (t >= 0 && t <= 1 && zAtT >= expandedBounds.minZ && zAtT <= expandedBounds.maxZ) {
                        if (t < collisionT) {
                            collisionT = t;
                            localCollisionNormal.set(1, 0, 0);
                            sweptCollision = true;
                        }
                    }
                }
                // Front face
                if (dz > 0 && prevPos.z <= expandedBounds.minZ && ballPos.z >= expandedBounds.minZ) {
                    const t = (expandedBounds.minZ - prevPos.z) / dz;
                    const xAtT = prevPos.x + t * dx;
                    if (t >= 0 && t <= 1 && xAtT >= expandedBounds.minX && xAtT <= expandedBounds.maxX) {
                        if (t < collisionT) {
                            collisionT = t;
                            localCollisionNormal.set(0, 0, -1);
                            sweptCollision = true;
                        }
                    }
                }
                // Back face
                if (dz < 0 && prevPos.z >= expandedBounds.maxZ && ballPos.z <= expandedBounds.maxZ) {
                    const t = (expandedBounds.maxZ - prevPos.z) / dz;
                    const xAtT = prevPos.x + t * dx;
                    if (t >= 0 && t <= 1 && xAtT >= expandedBounds.minX && xAtT <= expandedBounds.maxX) {
                        if (t < collisionT) {
                            collisionT = t;
                            localCollisionNormal.set(0, 0, 1);
                            sweptCollision = true;
                        }
                    }
                }
            }
            
            if (currentlyOverlapping || sweptCollision) {
                let newCorrectedPos;
                
                if (sweptCollision && !currentlyOverlapping) {
                    newCorrectedPos = new THREE.Vector3(
                        prevPos.x + collisionT * (ballPos.x - prevPos.x),
                        ballPos.y,
                        prevPos.z + collisionT * (ballPos.z - prevPos.z)
                    );
                    newCorrectedPos.add(localCollisionNormal.clone().multiplyScalar(0.01));
                } else {
                    const distToLeft = ballPos.x - expandedBounds.minX;
                    const distToRight = expandedBounds.maxX - ballPos.x;
                    const distToFront = ballPos.z - expandedBounds.minZ;
                    const distToBack = expandedBounds.maxZ - ballPos.z;
                    
                    const minDist = Math.min(distToLeft, distToRight, distToFront, distToBack);
                    
                    newCorrectedPos = ballPos.clone();
                    
                    if (minDist === distToLeft) {
                        newCorrectedPos.x = expandedBounds.minX;
                        localCollisionNormal.set(-1, 0, 0);
                    } else if (minDist === distToRight) {
                        newCorrectedPos.x = expandedBounds.maxX;
                        localCollisionNormal.set(1, 0, 0);
                    } else if (minDist === distToFront) {
                        newCorrectedPos.z = expandedBounds.minZ;
                        localCollisionNormal.set(0, 0, -1);
                    } else if (minDist === distToBack) {
                        newCorrectedPos.z = expandedBounds.maxZ;
                        localCollisionNormal.set(0, 0, 1);
                    }
                }
                
                setGhostBallPosition(newCorrectedPos);
                
                if (ballVel.length() > 0.01) {
                    const reflectedVel = ballVel.clone();
                    reflectedVel.reflect(localCollisionNormal);
                    reflectedVel.multiplyScalar(PHYSICS_CONSTANTS.BOUNCE_DAMPING);
                    setGhostBallVelocity(reflectedVel);
                }
                
                collisionOccurred = true;
                break;
            }
        }
    }
    
    // Bumper collisions
    const bumperCollision = checkBumperCollisions(ballPos, BALL_RADIUS);
    if (bumperCollision.collided) {
        const bCorrectedPos = bumperCollision.correctedPos;
        const bumperNormal = bumperCollision.normal;
        
        setGhostBallPosition(bCorrectedPos);
        
        if (ballVel.length() > 0.01) {
            const reflectedVel = ballVel.clone();
            reflectedVel.reflect(bumperNormal);
            reflectedVel.multiplyScalar(2.0); // Bumpers add energy
            setGhostBallVelocity(reflectedVel);
        }
        
        collisionOccurred = true;
    }
    
    // Update previous position
    ghostPreviousBallPosition = getGhostBallPosition().clone();
    
    return collisionOccurred;
}

/**
 * Handle ghost ball out of bounds
 */
function handleGhostOutOfBounds() {
    ghostIsOutOfBounds = true;
    ghostOutOfBoundsTimer = 0;
    setGhostBallVelocity(new THREE.Vector3(0, 0, 0));
    
    // Reset after delay (no visual message for ghost)
    setTimeout(() => {
        resetGhostBall();
        resetGhostCollisions();
        ghostIsOutOfBounds = false;
    }, 500); // Shorter delay for AI
}

/**
 * Reset ghost collision state
 */
export function resetGhostCollisions() {
    ghostIsOutOfBounds = false;
    ghostPreviousBallPosition = null;
    ghostOutOfBoundsTimer = 0;
}

/**
 * Check ghost ball teleporter collision
 * Same as player but does NOT trigger cutscenes
 * @returns {Object} Teleport result
 */
export function checkGhostTeleporterCollision() {
    const ballPos = getGhostBallPosition();
    const teleporters = getTeleporters();
    
    // Check cooldown
    if (getGhostTeleportCooldown() > 0) {
        return { teleported: false };
    }
    
    for (const teleporter of teleporters) {
        const teleporterPos = teleporter.userData.position;
        const teleporterSize = teleporter.userData.size;
        
        const halfSize = teleporterSize / 2;
        const dx = Math.abs(ballPos.x - teleporterPos.x);
        const dz = Math.abs(ballPos.z - teleporterPos.z);
        
        if (dx < halfSize + BALL_RADIUS && dz < halfSize + BALL_RADIUS) {
            // One-way teleporter
            if (teleporter.userData.isOneWay && teleporter.userData.destination) {
                setGhostTeleportCooldown(0.5);
                return {
                    teleported: true,
                    destination: teleporter.userData.destination.clone(),
                    isYellowPortal: false
                };
            }
            
            const pairId = teleporter.userData.pairId;
            
            // Prevent teleporting back
            if (getGhostLastTeleportedDestination() === teleporter) {
                continue;
            }
            
            const pairedTeleporter = teleporters.find(t =>
                t.userData.pairId === pairId && t !== teleporter
            );
            
            if (pairedTeleporter) {
                setGhostTeleportCooldown(0.5);
                setGhostLastTeleportedDestination(pairedTeleporter);
                
                // Check if yellow portal - ghost still teleports but NO cutscene
                const isYellowPortal = pairId === 3;
                
                return {
                    teleported: true,
                    destination: pairedTeleporter.userData.position.clone(),
                    isYellowPortal: isYellowPortal // For logging only, no cutscene
                };
            }
        }
    }
    
    return { teleported: false };
}

/**
 * Process ghost ball teleportation
 */
export function processGhostTeleportation() {
    const teleportResult = checkGhostTeleporterCollision();
    
    if (teleportResult.teleported) {
        // Teleport ghost ball WITHOUT triggering cutscene
        respawnGhostBallAtPosition(teleportResult.destination, false);
        console.log('Ghost ball teleported to:', teleportResult.destination);
        return true;
    }
    
    return false;
}


