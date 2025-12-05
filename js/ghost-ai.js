// Ghost Ball AI Controller - Waypoint-based pathfinding with obstacle awareness
import * as THREE from 'three';
import {
    getGhostBallState,
    applyGhostBallShot,
    isGhostBallAtRest,
    isGhostBallActive,
    getGhostBallPosition,
    updateGhostBallPhysics,
    checkGhostBallWinCondition,
    initializeGhostBallForHole,
    createGhostBall,
    hideGhostBall,
    showGhostBall,
    updateGhostTeleportCooldown,
    setGhostBallVelocity,
    setGhostBallPosition
} from './ghost-ball.js';
import {
    checkGhostWallCollisions,
    resetGhostCollisions,
    processGhostTeleportation
} from './ghost-collisions.js';
import { getHolePosition, HOLE_RADIUS } from './game.js';
import { getCourseBounds, getCustomWalls, getTestWalls, getRectangularHoles } from './course.js';
import { checkFanPush, checkFanBladeCollisions, getFans } from './fans.js';
import { applyWindForce } from './wind-zones.js';
import { getMagneticFields } from './magnetic-fields.js';
import { getBumpers } from './bumpers.js';
import { getCurrentCourseIndex } from './courses.js';

// AI Difficulty levels
export const Difficulty = {
    EASY: 'EASY',
    MEDIUM: 'MEDIUM',
    HARD: 'HARD'
};

// AI Status
export const NpcStatus = {
    IDLE: 'idle',
    AIMING: 'aiming',
    SHOOTING: 'shooting',
    BALL_IN_MOTION: 'ballInMotion',
    FINISHED: 'finished',
    EXPLORING: 'exploring',
    ESCAPING_MAGNET: 'escapingMagnet'
};

// Course-specific waypoints
const COURSE_WAYPOINTS = {
    // Course 3 (index 2): Narrow path with holes on sides
    2: [
        new THREE.Vector3(-23.5, 0, -24),   // Corner 1: Go to left side
        new THREE.Vector3(-24, 0, 22),      // Corner 2: Travel up left side
        new THREE.Vector3(0, 0, 19.5),      // Corner 3: Approach hole
    ],
    // Course 4 (index 3): L-shaped course
    3: [
        new THREE.Vector3(-8.5, 0, 26.5),   // Corner 1: Go to extension area
        new THREE.Vector3(-19, 0, -29),     // Corner 2: Enter the corridor
        new THREE.Vector3(-54.5, 0, -29.5), // Corner 3: Navigate past fans
        new THREE.Vector3(-60.5, 0, -23.5), // Corner 4: Approach hole
    ],
    // Course 5 (index 4): Complex path with teleporters
    4: [
        new THREE.Vector3(1, 0, -11),      // Corner 1
        new THREE.Vector3(16, 0, -11),     // Corner 2: Near first teleporter
        new THREE.Vector3(37.5, 0, -23),   // Corner 3
        new THREE.Vector3(39.5, 0, -35),   // Corner 4: Near second teleporter
        new THREE.Vector3(1, 0, -36.5),    // Corner 5: Approach hole
    ]
};

// Default NPC configuration
const DEFAULT_CONFIG = {
    difficulty: Difficulty.MEDIUM,
    maxPower: 1.0,
    shotDelayMs: 600,
    startDelayMs: 4000, // 4 second delay before starting
    stagnationThreshold: 4,
    stagnationDistanceThreshold: 2.0,
    waypointReachThreshold: 5.0, // Distance to consider waypoint reached
    magnetEscapePower: 0.9 // High power to escape magnetic fields
};

// AI state
let npcState = {
    status: NpcStatus.IDLE,
    lastShotTimeMs: 0,
    config: { ...DEFAULT_CONFIG },
    enabled: true,
    hasStarted: false,
    // Waypoint navigation
    currentWaypointIndex: 0,
    courseWaypoints: [],
    // Stagnation tracking
    shotHistory: [],
    lastProgressPosition: null,
    shotsWithoutProgress: 0,
    explorationMode: false,
    failedShots: [], // Array of {direction, power} that failed
    consecutiveWallHits: 0,
    // Magnetic field handling
    inMagneticField: false,
    magnetFieldCenter: null,
    escapeAttempts: 0
};

// Physics constants
const BALL_RADIUS = 0.5;
const SIMULATION_TIME_STEP = 1/60;
const MAX_SIMULATION_TIME = 8;
const MAX_PULL_DISTANCE = 1.67;
const POWER_SCALE = 80;

/**
 * Initialize ghost AI for a new hole
 */
export function initializeGhostAI(startPosition, config = {}) {
    npcState.config = { ...DEFAULT_CONFIG, ...config };
    npcState.status = NpcStatus.IDLE;
    npcState.lastShotTimeMs = performance.now(); // Start timing from now for the delay
    npcState.hasStarted = false;

    // Set up waypoints for current course
    const courseIndex = getCurrentCourseIndex();
    if (COURSE_WAYPOINTS[courseIndex]) {
        npcState.courseWaypoints = COURSE_WAYPOINTS[courseIndex];
        console.log(`Ghost AI: Using ${npcState.courseWaypoints.length} waypoints for course ${courseIndex + 1}`);
        COURSE_WAYPOINTS[courseIndex].forEach((wp, i) => {
            console.log(`  Waypoint ${i + 1}: (${wp.x.toFixed(1)}, ${wp.z.toFixed(1)})`);
        });

        // Adjust waypoint reach threshold and stagnation settings based on course
        if (courseIndex === 2) {
            npcState.config.waypointReachThreshold = 6.0; // Larger threshold for stage 3 waypoints
            npcState.config.stagnationThreshold = 3; // Moderate stagnation detection for stage 3
            npcState.config.stagnationDistanceThreshold = 2.5; // Moderate progress requirement
        } else {
            npcState.config.waypointReachThreshold = 5.0; // Default threshold
            npcState.config.stagnationThreshold = 4; // Default stagnation threshold
            npcState.config.stagnationDistanceThreshold = 2.0; // Default progress requirement
        }
    } else {
        npcState.courseWaypoints = [];
    }
    npcState.currentWaypointIndex = 0;

    // Reset tracking
    npcState.shotHistory = [];
    npcState.lastProgressPosition = startPosition.clone();
    npcState.shotsWithoutProgress = 0;
    npcState.explorationMode = false;
    npcState.failedShots = [];
    npcState.consecutiveWallHits = 0;
    npcState.inMagneticField = false;
    npcState.magnetFieldCenter = null;
    npcState.escapeAttempts = 0;

    createGhostBall();
    const offset = new THREE.Vector3(1.5, 0, 0);
    initializeGhostBallForHole(startPosition, offset);
    resetGhostCollisions();

    console.log(`Ghost AI initialized for course ${courseIndex + 1} at (${startPosition.x.toFixed(1)}, ${startPosition.z.toFixed(1)})`);
    return npcState;
}

/**
 * Main update function
 */
export function updateGhostAI(deltaTime, currentTimeMs) {
    if (!npcState.enabled) return npcState;
    
    const ballState = getGhostBallState();
    
    if (npcState.status === NpcStatus.FINISHED || !ballState.active) {
        npcState.status = NpcStatus.FINISHED;
        return npcState;
    }
    
    updateGhostTeleportCooldown(deltaTime);
    
    if (processGhostTeleportation()) {
        return npcState;
    }
    
    // Update physics
    updateGhostPhysicsWithCollisions(deltaTime);
    
    if (checkGhostBallWinCondition()) {
        npcState.status = NpcStatus.FINISHED;
        console.log(`Ghost AI finished in ${ballState.strokes} strokes!`);
        return npcState;
    }
    
    if (!ballState.atRest) {
        npcState.status = NpcStatus.BALL_IN_MOTION;
        return npcState;
    }
    
    // Ball is at rest - check situation and decide shot
    if (!npcState.hasStarted) {
        if (currentTimeMs - npcState.lastShotTimeMs < npcState.config.startDelayMs) {
            return npcState;
        }
        npcState.hasStarted = true;
        npcState.lastProgressPosition = ballState.position.clone();
    }
    
    if (currentTimeMs - npcState.lastShotTimeMs < npcState.config.shotDelayMs) {
        return npcState;
    }
    
    // Check for magnetic field situation
    checkMagneticFieldSituation(ballState.position);
    
    // Check for stagnation
    updateProgressTracking(ballState.position);
    
    // Decide and take shot
    const shot = decideShot(ballState.position);
    if (shot) {
        recordShotAttempt(shot);
        applyGhostBallShot(shot.direction, shot.power);
        npcState.lastShotTimeMs = currentTimeMs;
        npcState.status = NpcStatus.SHOOTING;
    }
    
    return npcState;
}

/**
 * Update physics with windmill collision
 */
function updateGhostPhysicsWithCollisions(deltaTime) {
    const MAX_STEP_DISTANCE = BALL_RADIUS * 0.25;
    const MAX_SUB_STEPS = 40;
    
    const { velocity } = getGhostBallState();
    const speed = velocity.length();
    const expectedDistance = speed * deltaTime;
    
    let numSubSteps = Math.max(1, Math.min(Math.ceil(expectedDistance / MAX_STEP_DISTANCE), MAX_SUB_STEPS));
    const subDeltaTime = deltaTime / numSubSteps;
    
    for (let step = 0; step < numSubSteps; step++) {
        const ballPos = getGhostBallPosition();
        
        // Apply fan push forces
        const pushForces = checkFanPush(ballPos, BALL_RADIUS);
        if (pushForces.length > 0) {
            const currentVel = getGhostBallState().velocity.clone();
            pushForces.forEach(({ force }) => {
                currentVel.add(force.clone().multiplyScalar(subDeltaTime));
            });
            setGhostBallVelocity(currentVel);
        }
        
        // Apply wind forces
        const windVel = getGhostBallState().velocity.clone();
        applyWindForce(ballPos, windVel, subDeltaTime);
        setGhostBallVelocity(windVel);
        
        // Update physics
        updateGhostBallPhysics(subDeltaTime);
        
        // Check windmill blade collisions
        const fanCollision = checkFanBladeCollisions(getGhostBallPosition(), BALL_RADIUS);
        if (fanCollision.collided) {
            setGhostBallPosition(fanCollision.correctedPos);
            
            const currentVel = getGhostBallState().velocity;
            const dot = currentVel.dot(fanCollision.normal);
            const reflectedVel = currentVel.clone().sub(
                fanCollision.normal.clone().multiplyScalar(2 * dot)
            );
            reflectedVel.add(fanCollision.bladeVelocity.clone().multiplyScalar(0.3));
            reflectedVel.multiplyScalar(0.5);
            setGhostBallVelocity(reflectedVel);
        }
        
        checkGhostWallCollisions();
        
        if (getGhostBallState().velocity.lengthSq() < 0.0001) break;
    }
}

/**
 * Check if ball is in a magnetic field (now we want to USE magnetic fields, not escape them)
 */
function checkMagneticFieldSituation(ballPos) {
    const fields = getMagneticFields();
    npcState.inMagneticField = false;
    npcState.magnetFieldCenter = null;

    for (const field of fields) {
        const fieldPos = field.userData.position;
        const fieldRange = field.userData.range;

        const distance = Math.sqrt(
            Math.pow(ballPos.x - fieldPos.x, 2) +
            Math.pow(ballPos.z - fieldPos.z, 2)
        );

        if (distance < fieldRange) { // Within magnetic field range
            npcState.inMagneticField = true;
            npcState.magnetFieldCenter = fieldPos.clone();
            npcState.status = NpcStatus.ESCAPING_MAGNET; // This means "using magnet" now
            break;
        }
    }

    if (!npcState.inMagneticField) {
        npcState.escapeAttempts = 0;
    }
}

/**
 * Update progress tracking for stagnation detection
 */
function updateProgressTracking(currentPosition) {
    const target = getCurrentTarget();
    const currentDist = currentPosition.distanceTo(target);
    const lastDist = npcState.lastProgressPosition.distanceTo(target);
    const progress = lastDist - currentDist;
    
    if (progress > npcState.config.stagnationDistanceThreshold) {
        npcState.shotsWithoutProgress = 0;
        npcState.lastProgressPosition = currentPosition.clone();
        npcState.explorationMode = false;
        npcState.failedShots = [];
        npcState.consecutiveWallHits = 0;
    } else {
        npcState.shotsWithoutProgress++;

        // Only enter exploration mode if we don't have waypoints to follow
        // or if we've been stuck for a really long time
        // For stage 3, be conservative about exploration mode since we have waypoints
        const courseIndex = getCurrentCourseIndex();
        const explorationThreshold = courseIndex === 2 ? 6 : npcState.config.stagnationThreshold * 3;

        if (npcState.shotsWithoutProgress >= explorationThreshold) {
            if (npcState.courseWaypoints.length === 0 || npcState.currentWaypointIndex >= npcState.courseWaypoints.length - 1) {
                npcState.explorationMode = true;
                console.log('Ghost AI: Entering exploration mode (no waypoints or final waypoint)');
            }
        }
    }
    
    // Trim failed shots history
    if (npcState.failedShots.length > 8) {
        npcState.failedShots = npcState.failedShots.slice(-8);
    }
}

/**
 * Get current target (next waypoint or hole)
 */
function getCurrentTarget() {
    const holePos = getHolePosition();

    if (npcState.courseWaypoints.length === 0) {
        return holePos;
    }

    // Check if we've reached current waypoint
    const ballPos = getGhostBallPosition();

    // Continue checking waypoints until we find one we haven't reached
    while (npcState.currentWaypointIndex < npcState.courseWaypoints.length) {
        const waypoint = npcState.courseWaypoints[npcState.currentWaypointIndex];
        const distToWaypoint = Math.sqrt(
            Math.pow(ballPos.x - waypoint.x, 2) +
            Math.pow(ballPos.z - waypoint.z, 2)
        );

        // Debug: show current position and waypoint
        if (Math.random() < 0.1) { // Only log occasionally to avoid spam
            console.log(`Ghost AI: Ball at (${ballPos.x.toFixed(1)}, ${ballPos.z.toFixed(1)}), waypoint ${npcState.currentWaypointIndex + 1} at (${waypoint.x.toFixed(1)}, ${waypoint.z.toFixed(1)}), dist: ${distToWaypoint.toFixed(1)}`);
        }

        if (distToWaypoint < npcState.config.waypointReachThreshold) {
            npcState.currentWaypointIndex++;
            console.log(`Ghost AI: ✓ Reached waypoint ${npcState.currentWaypointIndex}/${npcState.courseWaypoints.length} at (${waypoint.x.toFixed(1)}, ${waypoint.z.toFixed(1)})`);
        } else {
            // Haven't reached this waypoint yet, so it's our current target
            return waypoint;
        }
    }

    // All waypoints reached, go for the hole
    console.log(`Ghost AI: All waypoints reached, targeting hole at (${holePos.x.toFixed(1)}, ${holePos.z.toFixed(1)})`);
    return holePos;
}

/**
 * Main shot decision function
 */
function decideShot(ballPos) {
    const target = getCurrentTarget();
    const courseIndex = getCurrentCourseIndex();

    console.log(`Ghost AI: Current target is waypoint ${npcState.currentWaypointIndex + 1}/${npcState.courseWaypoints.length} at (${target.x.toFixed(1)}, ${target.z.toFixed(1)})`);
    console.log(`Ghost AI: Ball at (${ballPos.x.toFixed(1)}, ${ballPos.z.toFixed(1)}), exploration: ${npcState.explorationMode}, magnetic: ${npcState.inMagneticField}`);

    // For stage 3, use simplified waypoint-following logic
    if (courseIndex === 2) {
        return decideStage3Shot(ballPos, target);
    }

    // Priority 1: Use magnetic field if it's helping us reach our target (but only if we're not in exploration mode)
    if (!npcState.explorationMode && npcState.inMagneticField && npcState.magnetFieldCenter) {
        console.log('Ghost AI: Using magnetic field strategy');
        return decideMagnetEscapeShot(ballPos);
    }

    // Priority 2: Try direct shot to current target (waypoint or hole)
    if (isPathClearToTarget(ballPos, target)) {
        const directShot = calculateShotToTarget(ballPos, target);
        if (directShot && !isShotInFailedList(directShot)) {
            const simResult = simulateShot(ballPos, directShot.direction, directShot.power);
            if (!simResult.hitWallImmediately && !simResult.outOfBounds) {
                console.log(`Ghost AI: Taking direct shot to waypoint (${target.x.toFixed(1)}, ${target.z.toFixed(1)})`);
                return directShot;
            }
        }
    }

    // Path blocked or direct shot failed - find alternative toward target
    console.log(`Ghost AI: Finding alternative shot toward waypoint (${target.x.toFixed(1)}, ${target.z.toFixed(1)})`);
    return findBestAlternativeShot(ballPos, target);
}

/**
 * Simplified shot decision for stage 3 - focus on waypoint following
 */
function decideStage3Shot(ballPos, target) {
    console.log(`Ghost AI: Stage 3 - targeting waypoint (${target.x.toFixed(1)}, ${target.z.toFixed(1)})`);

    // Always try direct shot first, with relaxed validation
    const directShot = calculateShotToTarget(ballPos, target);
    if (directShot) {
        // For stage 3, be more lenient with shot validation
        const simResult = simulateShot(ballPos, directShot.direction, directShot.power);
        if (!simResult.outOfBounds) {
            console.log(`Ghost AI: Stage 3 - taking direct shot to waypoint`);
            return directShot;
        }
    }

    // If direct shot fails, try a simple alternative
    console.log(`Ghost AI: Stage 3 - trying alternative shot`);
    return findSimpleAlternativeShot(ballPos, target);
}

/**
 * Decide magnetic field interaction shot (now we USE magnets, not escape them)
 */
function decideMagnetEscapeShot(ballPos) {
    npcState.escapeAttempts++;

    const target = getCurrentTarget();

    // Check if magnetic field is between us and target (use it) or not (avoid it)
    const toTarget = new THREE.Vector3(target.x - ballPos.x, 0, target.z - ballPos.z).normalize();
    const toMagnet = new THREE.Vector3(
        npcState.magnetFieldCenter.x - ballPos.x,
        0,
        npcState.magnetFieldCenter.z - ballPos.z
    ).normalize();

    const dotProduct = toTarget.dot(toMagnet);
    const magnetIsInPath = dotProduct > 0.3; // Magnetic field is roughly toward the target

    let desiredDirection;

    if (magnetIsInPath) {
        // Use the magnetic field - aim toward it with moderate power
        desiredDirection = toMagnet.clone();
        console.log(`Ghost AI: Using magnetic field to help reach target (attempt ${npcState.escapeAttempts})`);
    } else {
        // Avoid the magnetic field - aim perpendicular to it
        desiredDirection = new THREE.Vector3(-toMagnet.z, 0, toMagnet.x);
        console.log(`Ghost AI: Avoiding magnetic field (attempt ${npcState.escapeAttempts})`);
    }

    // Use moderate power to let physics work
    const power = 0.4 + (npcState.escapeAttempts * 0.1);

    // Try desired direction first
    if (!willHitObstacleImmediately(ballPos, desiredDirection, power)) {
        return { direction: desiredDirection, power };
    }

    // Try opposite direction if first choice hits wall
    const oppositeDir = desiredDirection.clone().multiplyScalar(-1);
    if (!willHitObstacleImmediately(ballPos, oppositeDir, power)) {
        return { direction: oppositeDir, power };
    }

    // Try perpendicular directions
    const perpDirs = [
        new THREE.Vector3(-desiredDirection.z, 0, desiredDirection.x),
        new THREE.Vector3(desiredDirection.z, 0, -desiredDirection.x)
    ];

    for (const dir of perpDirs) {
        if (!willHitObstacleImmediately(ballPos, dir, power)) {
            return { direction: dir, power };
        }
    }

    // Last resort: any direction that's clear
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const testDir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        if (!willHitObstacleImmediately(ballPos, testDir, power)) {
            return { direction: testDir, power };
        }
    }

    return { direction: desiredDirection, power };
}

/**
 * Check if path to target is clear of walls, bumpers, and obstacles
 */
function isPathClearToTarget(start, end) {
    const customWalls = getCustomWalls();
    const testWalls = getTestWalls();
    const fans = getAllFans();
    const bumpers = getBumpers();

    const numSamples = 10;
    for (let t = 0; t <= 1; t += 1 / numSamples) {
        const point = new THREE.Vector3().lerpVectors(start, end, t);
        point.y = BALL_RADIUS;

        // Check custom walls
        for (const wall of customWalls) {
            const bounds = wall.userData.bounds;
            if (!bounds) continue;

            const margin = BALL_RADIUS + 0.5;
            if (point.x > bounds.minX - margin &&
                point.x < bounds.maxX + margin &&
                point.z > bounds.minZ - margin &&
                point.z < bounds.maxZ + margin) {
                return false;
            }
        }

        // Check test walls
        for (const wall of testWalls) {
            const wallBounds = wall.userData.wallBounds;
            if (!wallBounds) continue;

            const margin = BALL_RADIUS + 0.5;
            if (point.x > wallBounds.minX - margin &&
                point.x < wallBounds.maxX + margin &&
                point.z > wallBounds.minZ - margin &&
                point.z < wallBounds.maxZ + margin) {
                return false;
            }
        }

        // Check fans/windmills
        for (const fan of fans) {
            const fanX = fan.userData?.x ?? fan.position?.x ?? 0;
            const fanZ = fan.userData?.z ?? fan.position?.z ?? 0;
            const fanRadius = (fan.userData?.radius ?? 3.0) * 2;

            const distToFan = Math.sqrt(
                Math.pow(point.x - fanX, 2) +
                Math.pow(point.z - fanZ, 2)
            );
            if (distToFan < fanRadius) return false;
        }

        // Check bumpers
        for (const bumper of bumpers) {
            const bumperPos = bumper.position;
            const bumperRadius = bumper.userData.radius;
            const tubeRadius = bumper.userData.tubeRadius;

            const horizontalDist = Math.sqrt(
                Math.pow(point.x - bumperPos.x, 2) +
                Math.pow(point.z - bumperPos.z, 2)
            );

            // Check if point is within bumper's collision area
            const outerRadius = bumperRadius + tubeRadius + BALL_RADIUS + 0.5; // Extra margin
            const innerRadius = Math.max(0, bumperRadius - tubeRadius - BALL_RADIUS - 0.5);

            if (horizontalDist <= outerRadius && horizontalDist >= innerRadius) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Get all fans safely
 */
function getAllFans() {
    try {
        return getFans() || [];
    } catch {
        return [];
    }
}

/**
 * Calculate shot to reach target
 */
function calculateShotToTarget(ballPos, target) {
    const direction = new THREE.Vector3(
        target.x - ballPos.x,
        0,
        target.z - ballPos.z
    );
    const distance = direction.length();
    direction.normalize();
    
    // Estimate power based on distance
    const maxShotDistance = MAX_PULL_DISTANCE * POWER_SCALE * 0.4;
    let power = Math.min(distance / maxShotDistance, 1.0);
    power = Math.max(power, 0.2);
    
    // Reduce power for short distances
    if (distance < 5) power = Math.min(power, 0.35);
    if (distance < 3) power = Math.min(power, 0.25);
    
    return { direction, power };
}

/**
 * Check if shot will hit wall immediately
 */
function willHitObstacleImmediately(ballPos, direction, power) {
    const checkDistance = Math.min(power * MAX_PULL_DISTANCE * POWER_SCALE * 0.05, 3.0);

    const customWalls = getCustomWalls();
    const testWalls = getTestWalls();
    const bumpers = getBumpers();

    // Check multiple points along initial trajectory
    for (let dist = 0.5; dist <= checkDistance; dist += 0.5) {
        const point = ballPos.clone().add(direction.clone().multiplyScalar(dist));

        // Check walls
        for (const wall of customWalls) {
            const bounds = wall.userData.bounds;
            if (!bounds) continue;

            if (point.x > bounds.minX - BALL_RADIUS &&
                point.x < bounds.maxX + BALL_RADIUS &&
                point.z > bounds.minZ - BALL_RADIUS &&
                point.z < bounds.maxZ + BALL_RADIUS) {
                return true;
            }
        }

        for (const wall of testWalls) {
            const wallBounds = wall.userData.wallBounds;
            if (!wallBounds) continue;

            if (point.x > wallBounds.minX - BALL_RADIUS &&
                point.x < wallBounds.maxX + BALL_RADIUS &&
                point.z > wallBounds.minZ - BALL_RADIUS &&
                point.z < wallBounds.maxZ + BALL_RADIUS) {
                return true;
            }
        }

        // Check bumpers
        for (const bumper of bumpers) {
            const bumperPos = bumper.position;
            const bumperRadius = bumper.userData.radius;
            const tubeRadius = bumper.userData.tubeRadius;

            const horizontalDist = Math.sqrt(
                Math.pow(point.x - bumperPos.x, 2) +
                Math.pow(point.z - bumperPos.z, 2)
            );

            // Check if point is within bumper's collision area
            const outerRadius = bumperRadius + tubeRadius + BALL_RADIUS;
            const innerRadius = Math.max(0, bumperRadius - tubeRadius - BALL_RADIUS);

            if (horizontalDist <= outerRadius && horizontalDist >= innerRadius) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Find best alternative shot when direct path is blocked
 */
function findBestAlternativeShot(ballPos, target) {
    const candidates = [];
    const dirToTarget = new THREE.Vector3(target.x - ballPos.x, 0, target.z - ballPos.z).normalize();
    
    // Generate candidates at various angles
    const angleOffsets = npcState.explorationMode 
        ? [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90, 120, -120, 150, -150, 180]
        : [0, 20, -20, 40, -40, 60, -60, 80, -80];
    
    const powerLevels = npcState.explorationMode
        ? [0.3, 0.5, 0.7, 0.9]
        : [0.3, 0.5, 0.7];
    
    for (const angleDeg of angleOffsets) {
        const angleRad = angleDeg * Math.PI / 180;
        const direction = new THREE.Vector3(
            dirToTarget.x * Math.cos(angleRad) - dirToTarget.z * Math.sin(angleRad),
            0,
            dirToTarget.x * Math.sin(angleRad) + dirToTarget.z * Math.cos(angleRad)
        ).normalize();
        
        for (const power of powerLevels) {
            const shot = { direction: direction.clone(), power };
            
            // Skip failed shots
            if (isShotInFailedList(shot)) continue;
            
            // Skip shots that immediately hit walls
            if (willHitObstacleImmediately(ballPos, direction, power)) continue;
            
            // Simulate and score
            const simResult = simulateShot(ballPos, direction, power);
            const score = evaluateSimulationResult(simResult, ballPos, target);
            
            candidates.push({ shot, score, simResult });
        }
    }
    
    // Sort by score and return best
    candidates.sort((a, b) => b.score - a.score);
    
    if (candidates.length > 0 && candidates[0].score > -1000) {
        return candidates[0].shot;
    }
    
    // Fallback: find any direction that doesn't immediately hit a wall
    return findAnyOpenShot(ballPos);
}

/**
 * Check if shot is in failed list
 */
function isShotInFailedList(shot) {
    for (const failed of npcState.failedShots) {
        const dotProduct = shot.direction.dot(failed.direction);
        const powerDiff = Math.abs(shot.power - failed.power);
        
        if (dotProduct > 0.9 && powerDiff < 0.15) {
            return true;
        }
    }
    return false;
}

/**
 * Simulate a shot
 */
function simulateShot(startPos, direction, power) {
    let pos = startPos.clone();
    let vel = direction.clone().multiplyScalar(power * MAX_PULL_DISTANCE * POWER_SCALE);
    
    const bounds = getCourseBounds();
    const holePos = getHolePosition();
    const rectangularHoles = getRectangularHoles();
    const customWalls = getCustomWalls();
    const testWalls = getTestWalls();
    const fans = getAllFans();
    const bumpers = getBumpers();

    let time = 0;
    let inHole = false;
    let outOfBounds = false;
    let inHazard = false;
    let hitWallImmediately = false;
    let wallHits = 0;
    let hitBumper = false;
    let minDistToTarget = Infinity;
    let totalDistance = 0;
    let lastPos = pos.clone();
    
    const target = getCurrentTarget();
    
    while (time < MAX_SIMULATION_TIME && !inHole && !outOfBounds && !inHazard) {
        const step = vel.clone().multiplyScalar(SIMULATION_TIME_STEP);
        pos.add(step);
        totalDistance += step.length();
        
        vel.x *= 0.97;
        vel.z *= 0.97;
        
        if (vel.length() < 0.1) break;
        
        // Check bounds
        if (pos.x < bounds.minX - 1 || pos.x > bounds.maxX + 1 ||
            pos.z < bounds.minZ - 1 || pos.z > bounds.maxZ + 1) {
            outOfBounds = true;
            break;
        }
        
        // Check hazards
        for (const rectHole of rectangularHoles) {
            const halfWidth = rectHole.width / 2;
            const halfLength = rectHole.length / 2;
            if (Math.abs(pos.x - rectHole.x) < halfWidth &&
                Math.abs(pos.z - rectHole.z) < halfLength) {
                inHazard = true;
                break;
            }
        }
        if (inHazard) break;
        
        // Check wall collisions
        let hitWall = false;
        for (const wall of customWalls) {
            const wallBounds = wall.userData.bounds;
            if (!wallBounds) continue;
            
            if (pos.x > wallBounds.minX - BALL_RADIUS && 
                pos.x < wallBounds.maxX + BALL_RADIUS &&
                pos.z > wallBounds.minZ - BALL_RADIUS && 
                pos.z < wallBounds.maxZ + BALL_RADIUS) {
                hitWall = true;
                wallHits++;
                if (time < 0.2) hitWallImmediately = true;
                
                // Bounce
                const distLeft = Math.abs(pos.x - wallBounds.minX);
                const distRight = Math.abs(pos.x - wallBounds.maxX);
                const distFront = Math.abs(pos.z - wallBounds.minZ);
                const distBack = Math.abs(pos.z - wallBounds.maxZ);
                const minDist = Math.min(distLeft, distRight, distFront, distBack);
                
                if (minDist === distLeft || minDist === distRight) {
                    vel.x *= -0.5;
                    pos.x = minDist === distLeft ? wallBounds.minX - BALL_RADIUS : wallBounds.maxX + BALL_RADIUS;
                } else {
                    vel.z *= -0.5;
                    pos.z = minDist === distFront ? wallBounds.minZ - BALL_RADIUS : wallBounds.maxZ + BALL_RADIUS;
                }
                break;
            }
        }
        
        if (!hitWall) {
            for (const wall of testWalls) {
                const wallBounds = wall.userData.wallBounds;
                if (!wallBounds) continue;
                
                if (pos.x > wallBounds.minX - BALL_RADIUS && 
                    pos.x < wallBounds.maxX + BALL_RADIUS &&
                    pos.z > wallBounds.minZ - BALL_RADIUS && 
                    pos.z < wallBounds.maxZ + BALL_RADIUS) {
                    hitWall = true;
                    wallHits++;
                    if (time < 0.2) hitWallImmediately = true;
                    vel.multiplyScalar(-0.5);
                    break;
                }
            }
        }
        
        // Check bumpers
        for (const bumper of bumpers) {
            const bumperPos = bumper.position;
            const bumperRadius = bumper.userData.radius;
            const tubeRadius = bumper.userData.tubeRadius;

            const horizontalDist = Math.sqrt(
                Math.pow(pos.x - bumperPos.x, 2) +
                Math.pow(pos.z - bumperPos.z, 2)
            );

            // Check if ball is within bumper's collision area
            const outerRadius = bumperRadius + tubeRadius + BALL_RADIUS;
            const innerRadius = Math.max(0, bumperRadius - tubeRadius - BALL_RADIUS);

            if (horizontalDist <= outerRadius && horizontalDist >= innerRadius) {
                // Ball hit a bumper - bounce away with energy boost
                hitBumper = true;
                const awayDir = new THREE.Vector3(pos.x - bumperPos.x, 0, pos.z - bumperPos.z).normalize();
                vel.copy(awayDir.multiplyScalar(vel.length() * 2.0)); // Bumper energy boost
                break; // Only handle one bumper collision per step
            }
        }

        // Check windmills
        for (const fan of fans) {
            const fanX = fan.userData?.x ?? fan.position?.x ?? 0;
            const fanZ = fan.userData?.z ?? fan.position?.z ?? 0;
            const fanRadius = fan.userData?.radius ?? 3.0;

            const distToFan = Math.sqrt(
                Math.pow(pos.x - fanX, 2) +
                Math.pow(pos.z - fanZ, 2)
            );

            if (distToFan < fanRadius * 1.2) {
                const awayDir = new THREE.Vector3(pos.x - fanX, 0, pos.z - fanZ).normalize();
                vel.copy(awayDir.multiplyScalar(vel.length() * 0.4));
            }
        }
        
        // Track distances
        const distToTarget = pos.distanceTo(target);
        minDistToTarget = Math.min(minDistToTarget, distToTarget);
        
        const distToHole = pos.distanceTo(holePos);
        if (distToHole < HOLE_RADIUS && vel.length() < 5) {
            inHole = true;
        }
        
        lastPos = pos.clone();
        time += SIMULATION_TIME_STEP;
    }
    
    return {
        finalPosition: pos,
        inHole,
        outOfBounds,
        inHazard,
        hitWallImmediately,
        wallHits,
        hitBumper,
        minDistToTarget,
        totalDistance,
        timeElapsed: time
    };
}

/**
 * Evaluate simulation result
 */
function evaluateSimulationResult(result, startPos, target) {
    if (result.inHole) return 10000;
    if (result.outOfBounds) return -5000;
    if (result.inHazard) return -4000;
    if (result.hitWallImmediately) return -3000;
    
    let score = 0;
    
    // Progress toward target
    const startDist = startPos.distanceTo(target);
    const endDist = result.finalPosition.distanceTo(target);
    const progress = startDist - endDist;
    
    score += progress * 150;
    
    // Distance to target at end
    score += 500 - endDist * 10;
    
    // Penalties
    score -= result.wallHits * 200;
    if (result.hitBumper) score -= 150; // Penalty for hitting bumpers

    // Bonus for getting close
    if (endDist < 5) score += 300;
    if (endDist < 3) score += 500;
    
    // Bonus for movement (avoid getting stuck)
    if (result.totalDistance > 2) score += 100;
    
    return score;
}

/**
 * Find a simple alternative shot toward target (for stage 3)
 */
function findSimpleAlternativeShot(ballPos, target) {
    const dirToTarget = new THREE.Vector3(target.x - ballPos.x, 0, target.z - ballPos.z).normalize();

    // Try the direct direction first
    if (!willHitObstacleImmediately(ballPos, dirToTarget, 0.5)) {
        return { direction: dirToTarget, power: 0.5 };
    }

    // Try slight variations
    const angles = [-20, -10, 10, 20, -30, 30];
    for (const angleDeg of angles) {
        const angleRad = angleDeg * Math.PI / 180;
        const direction = new THREE.Vector3(
            dirToTarget.x * Math.cos(angleRad) - dirToTarget.z * Math.sin(angleRad),
            0,
            dirToTarget.x * Math.sin(angleRad) + dirToTarget.z * Math.cos(angleRad)
        ).normalize();

        if (!willHitObstacleImmediately(ballPos, direction, 0.5)) {
            return { direction, power: 0.5 };
        }
    }

    // Last resort - find any open direction
    return findAnyOpenShot(ballPos);
}

/**
 * Find any open direction as fallback
 */
function findAnyOpenShot(ballPos) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const power = 0.4 + Math.random() * 0.3;

        if (!willHitObstacleImmediately(ballPos, direction, power)) {
            return { direction, power };
        }
    }

    // Absolute fallback
    return {
        direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
        power: 0.5
    };
}

/**
 * Record shot attempt for stagnation detection
 */
function recordShotAttempt(shot) {
    npcState.shotHistory.push({
        direction: shot.direction.clone(),
        power: shot.power,
        timestamp: Date.now()
    });
    
    if (npcState.shotHistory.length > 10) {
        npcState.shotHistory.shift();
    }
}

/**
 * Mark a shot as failed (called when ball doesn't make progress)
 */
function markShotAsFailed(shot) {
    npcState.failedShots.push({
        direction: shot.direction.clone(),
        power: shot.power
    });
}

// Export configuration functions

export function setGhostAIDifficulty(difficulty) {
    npcState.config.difficulty = difficulty;
    console.log(`Ghost AI difficulty: ${difficulty}`);
}

export function setGhostAIEnabled(enabled) {
    npcState.enabled = enabled;
    if (enabled) showGhostBall();
    else hideGhostBall();
}

export function getGhostAIState() {
    return {
        ...npcState,
        ballState: getGhostBallState()
    };
}

export function isGhostAIEnabled() {
    return npcState.enabled;
}

export function resetGhostAI() {
    npcState.status = NpcStatus.IDLE;
    npcState.lastShotTimeMs = 0;
    npcState.hasStarted = false;
    npcState.currentWaypointIndex = 0;
    npcState.shotHistory = [];
    npcState.shotsWithoutProgress = 0;
    npcState.explorationMode = false;
    npcState.failedShots = [];
    npcState.consecutiveWallHits = 0;
    npcState.inMagneticField = false;
    npcState.escapeAttempts = 0;
}

export function setGhostAIConfig(config) {
    npcState.config = { ...npcState.config, ...config };
}

export function getGhostAIConfig() {
    return { ...npcState.config };
}
