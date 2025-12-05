// Mouse/touch input handling for ball aiming and launching
import * as THREE from 'three';
import { getBallPosition, getBallMesh, setBallVelocity, getBallVelocity, setBallPosition } from './ball.js';
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
let maxPullDistance = 0; // Track maximum distance pulled away from start
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// State for touch support
let touchStartPosition = null;
let isTouchActive = false;

// State for WASD keyboard controls
let keysPressed = {};
const WASD_SPEED = 10.0; // Speed for WASD movement

// Y-key Easter egg for arrow key ball controls
let yPressCount = 0;
let lastYPressTime = 0;
const Y_PRESS_TIMEOUT = 2000; // 2 seconds to reset counter
let arrowKeyControlsEnabled = false;

export function initControls(cameraRef, rendererRef, controlsRef) {
    camera = cameraRef;
    renderer = rendererRef;
    controls = controlsRef;
    const canvas = renderer.domElement;

    // Log that arrow key ball controls are disabled by default (Easter egg hint)
    console.log('💡 Tip: Arrow key ball controls are disabled by default. Try pressing Y multiple times...');
    
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
    
    // Keyboard events for WASD controls
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
}

function onKeyDown(event) {
    const key = event.key.toLowerCase();
    keysPressed[key] = true;

    // Handle Y key Easter egg for arrow key ball controls
    if (key === 'y') {
        const currentTime = Date.now();
        if (currentTime - lastYPressTime > Y_PRESS_TIMEOUT) {
            // Reset counter if too much time has passed
            yPressCount = 1;
        } else {
            yPressCount++;
        }
        lastYPressTime = currentTime;

        if (yPressCount >= 5 && !arrowKeyControlsEnabled) {
            arrowKeyControlsEnabled = true;
            console.log('🎉 Arrow key ball controls UNLOCKED! Use arrow keys to move the ball. Press ESC to disable.');
            yPressCount = 0; // Reset counter after unlocking
        } else if (yPressCount > 0 && yPressCount < 5) {
            console.log(`Y-key progress: ${yPressCount}/5 (press Y ${5 - yPressCount} more times)`);
        }
    }

    // Handle ESC to disable arrow key ball controls (only if freecam didn't just handle it)
    if (event.key === 'Escape' && arrowKeyControlsEnabled && !window._freecamJustToggled) {
        arrowKeyControlsEnabled = false;
        console.log('🚫 Arrow key ball controls DISABLED. Press Y 5 times to unlock again.');
    }
}

function onKeyUp(event) {
    const key = event.key.toLowerCase();
    keysPressed[key] = false;
}

export function updateWASDControls(deltaTime) {
    // Check if arrow key ball controls are unlocked via Y-key Easter egg
    if (!arrowKeyControlsEnabled) {
        return; // Arrow key controls are disabled by default
    }

    // Check if any arrow keys are pressed
    const upPressed = keysPressed['arrowup'];
    const downPressed = keysPressed['arrowdown'];
    const leftPressed = keysPressed['arrowleft'];
    const rightPressed = keysPressed['arrowright'];

    if (!upPressed && !downPressed && !leftPressed && !rightPressed) {
        return; // No movement keys pressed
    }
    
    const ballPos = getBallPosition();
    const moveSpeed = WASD_SPEED * deltaTime;
    
    // Calculate movement direction based on camera orientation
    // Get camera forward and right vectors projected onto the XZ plane
    const cameraForward = new THREE.Vector3();
    camera.getWorldDirection(cameraForward);
    cameraForward.y = 0; // Project onto XZ plane
    cameraForward.normalize();
    
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraForward, new THREE.Vector3(0, 1, 0)).normalize();
    
    const movement = new THREE.Vector3(0, 0, 0);
    
    // Arrow Up = forward (camera forward direction)
    if (upPressed) {
        movement.add(cameraForward.clone().multiplyScalar(moveSpeed));
    }
    // Arrow Down = backward (opposite of camera forward)
    if (downPressed) {
        movement.add(cameraForward.clone().multiplyScalar(-moveSpeed));
    }
    // Arrow Left = left (camera left direction)
    if (leftPressed) {
        movement.add(cameraRight.clone().multiplyScalar(-moveSpeed));
    }
    // Arrow Right = right (camera right direction)
    if (rightPressed) {
        movement.add(cameraRight.clone().multiplyScalar(moveSpeed));
    }
    
    // Apply movement to ball position
    const newPosition = ballPos.clone().add(movement);
    newPosition.y = ballPos.y; // Keep Y position the same
    setBallPosition(newPosition);
    
    // Set velocity to zero when using WASD (direct control)
    setBallVelocity(new THREE.Vector3(0, 0, 0));
}

// Export function to check if arrow key ball controls are enabled
export function areWASDControlsEnabled() {
    return arrowKeyControlsEnabled;
}

async function onMouseDown(event) {
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

async function onTouchStart(event) {
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
        // updateAiming() will check if cursor returned to ball and cancel if needed
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
    maxPullDistance = 0; // Reset max pull distance
    aimStartPosition = new THREE.Vector2(clientX, clientY);
    currentMousePosition = aimStartPosition.clone();
    
    // Disable camera controls when aiming
    if (controls) {
        controls.enabled = false;
    }
}

function updateAiming() {
    if (!isAiming || !aimStartPosition || !currentMousePosition) return;
    
    // Calculate pull vector
    const pullVector = new THREE.Vector2(
        currentMousePosition.x - aimStartPosition.x,
        currentMousePosition.y - aimStartPosition.y
    );
    
    const distanceFromStart = pullVector.length(); // Distance in pixels
    const pullDistance = Math.min(distanceFromStart / 100, MAX_PULL_DISTANCE); // Scale pixel distance to world units
    
    // Update maximum pull distance (track how far they've moved away)
    if (distanceFromStart > maxPullDistance) {
        maxPullDistance = distanceFromStart;
    }
    
    // Only check for return-to-ball if they've moved away significantly first (at least 50 pixels)
    // This prevents canceling when they're just starting to aim
    if (maxPullDistance > 50) {
        // They've moved away, now check if they've returned to near the start
        // If they bring cursor back to within 40 pixels of where they started, cancel aiming
        if (distanceFromStart < 40) {
            cancelAiming();
            return;
        }
    }
    
    // Update wobble time
    wobbleTime += 0.016; // Approximate frame time (will use actual delta in Phase 4)
    
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
    
    // Calculate pull vector in screen space
    const pullVector = new THREE.Vector2(
        currentMousePosition.x - aimStartPosition.x,
        currentMousePosition.y - aimStartPosition.y
    );
    
    const distanceFromStart = pullVector.length();
    const pullDistance = Math.min(distanceFromStart / 100, MAX_PULL_DISTANCE);
    
    // Only cancel if they've moved away significantly AND returned to near start
    if (maxPullDistance > 50 && distanceFromStart < 40) {
        // They moved away and came back, cancel aiming without shooting
        cancelAiming();
        return;
    }
    
    if (pullDistance < 0.1) {
        // Too close, cancel
        cancelAiming();
        return;
    }
    
    // Save ball state before shot (for Mulligan power-up)
    saveBallState(ballPos, ballVel);
    
    const ballScreenPos = getScreenPosition(ballPos);
    
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
    maxPullDistance = 0; // Reset max pull distance
    
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

