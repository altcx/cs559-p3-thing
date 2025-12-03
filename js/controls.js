// Mouse/touch input handling for ball aiming and launching
import * as THREE from 'three';
import { getBallPosition, getBallMesh, setBallVelocity, getBallVelocity } from './ball.js';
import { incrementStroke, saveBallState } from './game.js';
import { getSpeedBoostMultiplier, consumeSpeedBoost, isSharpshooterActive, consumeSharpshooter } from './powerup-effects.js';

// These will be set by initControls
let camera = null;
let renderer = null;
let controls = null; // OrbitControls reference to enable/disable

const BALL_RADIUS = 0.5;
const MAX_PULL_DISTANCE = 1.67; // Maximum pull distance in world units (reduced to 1/3 of original 5)
const POWER_SCALE = 80; // Scale factor for velocity based on pull distance (10x from 8, originally 3)
const WOBBLE_AMPLITUDE = Math.PI / 8; // 22.5 degrees (45 degrees total arc)
const WOBBLE_SPEED = 3; // Oscillation speed

let isAiming = false;
let aimStartPosition = null;
let currentMousePosition = null;
let wobbleTime = 0;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// State for touch support
let touchStartPosition = null;
let isTouchActive = false;

export function initControls(cameraRef, rendererRef, controlsRef) {
    camera = cameraRef;
    renderer = rendererRef;
    controls = controlsRef;
    const canvas = renderer.domElement;
    
    // Mouse events
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    
    // Touch events
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
}

function onMouseDown(event) {
    if (isAiming) return;
    
    // Check if ball is moving (can't aim while ball is moving)
    const ballVelocity = getBallVelocity();
    if (ballVelocity.length() > 0.01) return;
    
    const ballPos = getBallPosition();
    const ballScreenPos = getScreenPosition(ballPos);
    
    // Check if click is near ball
    const distance = Math.sqrt(
        Math.pow(event.clientX - ballScreenPos.x, 2) + 
        Math.pow(event.clientY - ballScreenPos.y, 2)
    );
    
    if (distance < 50) { // 50 pixel threshold
        startAiming(event.clientX, event.clientY);
    }
}

function onMouseMove(event) {
    if (isAiming) {
        currentMousePosition = new THREE.Vector2(event.clientX, event.clientY);
        updateAiming();
    }
}

function onMouseUp(event) {
    if (isAiming) {
        finishAiming();
    }
}

function onMouseLeave(event) {
    if (isAiming) {
        cancelAiming();
    }
}

function onTouchStart(event) {
    event.preventDefault();
    if (isAiming || isTouchActive) return;
    
    // Check if ball is moving (can't aim while ball is moving)
    const ballVelocity = getBallVelocity();
    if (ballVelocity.length() > 0.01) return;
    
    const touch = event.touches[0];
    const ballPos = getBallPosition();
    const ballScreenPos = getScreenPosition(ballPos);
    
    const distance = Math.sqrt(
        Math.pow(touch.clientX - ballScreenPos.x, 2) + 
        Math.pow(touch.clientY - ballScreenPos.y, 2)
    );
    
    if (distance < 50) {
        isTouchActive = true;
        startAiming(touch.clientX, touch.clientY);
    }
}

function onTouchMove(event) {
    if (isAiming && isTouchActive) {
        event.preventDefault();
        const touch = event.touches[0];
        currentMousePosition = new THREE.Vector2(touch.clientX, touch.clientY);
        updateAiming();
    }
}

function onTouchEnd(event) {
    if (isAiming && isTouchActive) {
        event.preventDefault();
        finishAiming();
        isTouchActive = false;
    }
}

function startAiming(clientX, clientY) {
    isAiming = true;
    wobbleTime = 0;
    aimStartPosition = new THREE.Vector2(clientX, clientY);
    currentMousePosition = aimStartPosition.clone();
    
    // Disable camera controls when aiming
    if (controls) {
        controls.enabled = false;
    }
}

function updateAiming() {
    if (!isAiming || !aimStartPosition || !currentMousePosition) return;
    
    // Update wobble time
    wobbleTime += 0.016; // Approximate frame time (will use actual delta in Phase 4)
    
    // Calculate pull vector
    const pullVector = new THREE.Vector2(
        currentMousePosition.x - aimStartPosition.x,
        currentMousePosition.y - aimStartPosition.y
    );
    
    const pullDistance = Math.min(pullVector.length() / 100, MAX_PULL_DISTANCE); // Scale pixel distance to world units
    
    // Check if pulled back far enough to activate wobble
    if (pullDistance > 0.1) {
        // Wobble is active
    } else {
        // Reset wobble if too close to ball
        wobbleTime = 0;
    }
}

function finishAiming() {
    if (!isAiming || !aimStartPosition || !currentMousePosition) return;
    
    const ballPos = getBallPosition();
    const ballVel = getBallVelocity();
    
    // Save ball state before shot (for Mulligan power-up)
    saveBallState(ballPos, ballVel);
    
    const ballScreenPos = getScreenPosition(ballPos);
    
    // Calculate pull vector in screen space
    const pullVector = new THREE.Vector2(
        currentMousePosition.x - aimStartPosition.x,
        currentMousePosition.y - aimStartPosition.y
    );
    
    const pullDistance = Math.min(pullVector.length() / 100, MAX_PULL_DISTANCE);
    
    if (pullDistance < 0.1) {
        // Too close, cancel
        cancelAiming();
        return;
    }
    
    // Calculate world direction (pull BACK, so ball goes FORWARD in opposite direction)
    const pullBackDirection = calculateWorldDirection(ballScreenPos, currentMousePosition);
    
    // Apply wobble to direction (unless Sharpshooter is active)
    let finalDirection;
    if (isSharpshooterActive()) {
        // No wobble - straight shot
        finalDirection = pullBackDirection.clone();
        consumeSharpshooter(); // Consume after use
    } else {
        // Normal wobble
        const wobbleOffset = Math.sin(wobbleTime * WOBBLE_SPEED) * WOBBLE_AMPLITUDE;
        finalDirection = new THREE.Vector3(
            pullBackDirection.x * Math.cos(wobbleOffset) - pullBackDirection.z * Math.sin(wobbleOffset),
            0,
            pullBackDirection.x * Math.sin(wobbleOffset) + pullBackDirection.z * Math.cos(wobbleOffset)
        ).normalize();
    }
    
    // Velocity is in the OPPOSITE direction of pull (forward)
    const forwardDirection = finalDirection.clone().multiplyScalar(-1);
    
    // Calculate velocity
    let velocity = forwardDirection.multiplyScalar(pullDistance * POWER_SCALE);
    
    // Apply speed boost multiplier if active
    const speedBoostMultiplier = getSpeedBoostMultiplier();
    console.log('Launching ball. Speed boost multiplier:', speedBoostMultiplier);
    if (speedBoostMultiplier > 1.0) {
        console.log('Applying speed boost! Original velocity:', velocity.length(), 'New velocity:', velocity.length() * speedBoostMultiplier);
        velocity.multiplyScalar(speedBoostMultiplier);
        consumeSpeedBoost(); // Consume after use
    }
    
    // Apply velocity to ball
    setBallVelocity(velocity);
    
    // Increment stroke count
    incrementStroke();
    
    // Reset aiming state (this will re-enable camera controls)
    cancelAiming();
}

function cancelAiming() {
    isAiming = false;
    aimStartPosition = null;
    currentMousePosition = null;
    wobbleTime = 0;
    
    // Re-enable camera controls when not aiming
    if (controls) {
        controls.enabled = true;
    }
}

function getScreenPosition(worldPosition) {
    const vector = worldPosition.clone();
    vector.project(camera);
    
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    
    return new THREE.Vector2(x, y);
}

function calculateWorldDirection(ballScreenPos, mouseScreenPos) {
    // Calculate the drag direction in screen space (from ball to mouse)
    const dragVector = new THREE.Vector2(
        mouseScreenPos.x - ballScreenPos.x,
        mouseScreenPos.y - ballScreenPos.y
    );
    
    // Convert this screen-space drag direction to world-space direction
    // We need to project this onto the ground plane
    const ballPos = getBallPosition();
    
    // Get the world position where the mouse is pointing on the ground
    const mouseWorld = screenToWorldOnGround(mouseScreenPos);
    
    // Calculate direction from ball to mouse world position (this is the pull direction)
    const pullDirection = new THREE.Vector3(
        mouseWorld.x - ballPos.x,
        0,
        mouseWorld.z - ballPos.z
    ).normalize();
    
    return pullDirection;
}

function screenToWorldOnGround(screenPos) {
    // Convert screen coordinates to normalized device coordinates
    mouse.x = (screenPos.x / window.innerWidth) * 2 - 1;
    mouse.y = -(screenPos.y / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Intersect with ground plane (y = 0)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    
    return intersection;
}

export function getAimingState() {
    // Don't show aiming if ball is moving
    const ballVelocity = getBallVelocity();
    if (ballVelocity.length() > 0.01) {
        return null;
    }
    
    if (!isAiming || !aimStartPosition || !currentMousePosition) {
        return null;
    }
    
    const ballPos = getBallPosition();
    const ballScreenPos = getScreenPosition(ballPos);
    
    const pullVector = new THREE.Vector2(
        currentMousePosition.x - aimStartPosition.x,
        currentMousePosition.y - aimStartPosition.y
    );
    
    const pullDistance = Math.min(pullVector.length() / 100, MAX_PULL_DISTANCE);
    
    // If pull distance is too small, don't show arrow
    if (pullDistance < 0.1) {
        return null;
    }
    
    // Calculate base direction (pull back direction)
    const pullBackDirection = calculateWorldDirection(ballScreenPos, currentMousePosition);
    
    // Apply wobble (only if pulled back enough and Sharpshooter is not active)
    let finalPullDirection;
    let wobbleOffset = 0;
    if (isSharpshooterActive()) {
        // No wobble - straight shot
        finalPullDirection = pullBackDirection.clone();
        wobbleOffset = 0;
    } else {
        // Normal wobble
        wobbleOffset = Math.sin(wobbleTime * WOBBLE_SPEED) * WOBBLE_AMPLITUDE;
        finalPullDirection = new THREE.Vector3(
            pullBackDirection.x * Math.cos(wobbleOffset) - pullBackDirection.z * Math.sin(wobbleOffset),
            0,
            pullBackDirection.x * Math.sin(wobbleOffset) + pullBackDirection.z * Math.cos(wobbleOffset)
        ).normalize();
    }
    
    // Forward direction (opposite of pull) - this is where the ball will go
    const forwardDirection = finalPullDirection.clone().multiplyScalar(-1);
    
    return {
        isAiming: true,
        pullDistance: pullDistance,
        direction: forwardDirection, // Direction ball will travel
        wobbleOffset: wobbleOffset,
        ballPosition: ballPos
    };
}

export function updateWobbleTime(deltaTime) {
    if (isAiming) {
        wobbleTime += deltaTime;
    }
}

