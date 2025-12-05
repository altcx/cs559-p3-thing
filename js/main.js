// Main game initialization and render loop
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initPhysics, updatePhysics } from './physics.js';
import { createCourse, updateAnimatedMaterials } from './course.js';
import { createBall, getBallPosition, getBallVelocity, resetBall, setBallPosition, setBallVelocity, setBallStartPosition, hideBall, showBall, getBallMesh } from './ball.js';
import { resetCollisions } from './collisions.js';
import { initControls, updateWobbleTime, updateWASDControls } from './controls.js';
import { initUI, updateUI } from './ui.js';
import { createHole, checkWinCondition, incrementStroke, getStrokeCount, getPar, calculateRating, resetHole, getTotalScore, addHoleScore, getHoleScores, getHolePosition, setHolePosition, resetTotalScore, getLastBallState, decrementStroke, setStrokeCount, isComplete, setHoleComplete, setPar } from './game.js';
import { initHUD, updateHUD, showRating, showHoleCompleteScreen, hideHoleCompleteScreen, triggerRatingEffects, showRatingText, hideRatingText, showStrokePenaltyText, hideStrokePenaltyText, resetLevel } from './hud.js';
import { loadCourse, nextCourse, getCurrentCourseIndex, getTotalCourses } from './courses.js';
import { removeAllTeleporters, removeTeleportersByPairId } from './teleporters.js';
import { updateHoleIndicator } from './hole-indicator.js';
import { updateAnimations, updateScreenShake } from './animations.js';
import { updateParticles, updateBallTrail, createBallTrail, createEnvironmentalParticles, updateEnvironmentalParticles, createParticleBurst, createGoldBurst, createMagicAppearanceEffect, createBallExplosionEffect } from './particles.js';
import { initMenu, hideMenu, showMenu } from './menu.js';
import { createPowerUp, updatePowerUps, checkPowerUpCollection, removeAllPowerUps } from './powerups.js';
import { initInventory, addToInventory, clearInventory } from './inventory.js';
import { updateMovingWalls } from './moving-walls.js';
import { updateMagneticFields } from './magnetic-fields.js';
import { updateTeleporterCooldown, updateTeleporterAnimations } from './teleporters.js';
import { activateSpeedBoost, activateSharpshooter, activateMagneticPull, activateRewind, clearAllPowerUps as clearAllPowerUpEffects, clearMagneticPull, getSpeedBoostMultiplier, consumeSpeedBoost } from './powerup-effects.js';
import { updateModelAnimations } from './course.js';
import { updateFloor } from './floor.js';
import { enterPaintingMode, exitPaintingMode, isInPaintingMode } from './floor-painter.js';
import { updateWindZones } from './wind-zones.js';
import { createNightSkybox, updateSkybox } from './skybox.js';
import { updateCosmetics } from './cosmetics.js';
import { initializeGhostAI, updateGhostAI, setGhostAIEnabled, isGhostAIEnabled, getGhostAIState, setGhostAIDifficulty, Difficulty } from './ghost-ai.js';
import { hideGhostBall, showGhostBall, getGhostBallStrokes, removeGhostBall } from './ghost-ball.js';

// Get canvas element
const canvas = document.getElementById('game-canvas');
const groupIdElement = document.getElementById('group-id');
const modeToggleButton = document.getElementById('mode-toggle');

if (!canvas) {
    console.error('Canvas element not found!');
    throw new Error('Canvas element not found');
}

if (!modeToggleButton) {
    console.error('Mode toggle button not found!');
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdbe4e6); // Light gray sky/background (will be replaced by night skybox)

// Create night skybox with stars
createNightSkybox();

// Camera setup
const camera = new THREE.PerspectiveCamera(
    75, // FOV
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near plane
    1000 // Far plane
);
camera.position.set(0, 10, 20);
camera.lookAt(0, 0, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lighting setup - brighter ambient light to keep colors vibrant
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Increased from 0.6 to 1.0
scene.add(ambientLight);

// Hemisphere light for more natural lighting (sky color from above, ground color from below)
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.4);
scene.add(hemisphereLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5); // Reduced from 0.8 to 0.5
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Function to update lighting based on mode
function updateLightingForMode() {
    if (isFullMode) {
        // Full mode: enable all lighting
        ambientLight.intensity = 1.0;
        hemisphereLight.intensity = 0.4;
        directionalLight.intensity = 0.5;
        renderer.shadowMap.enabled = true;
    } else {
        // Prototype mode: minimal lighting, no shadows
        ambientLight.intensity = 2.0; // Bright ambient for flat look
        hemisphereLight.intensity = 0.0; // No hemisphere
        directionalLight.intensity = 0.0; // No directional
        renderer.shadowMap.enabled = false;
    }
}

// Function to update lighting for larger courses (levels 4 and 5)
export function updateLightingForCourse(courseIndex) {
    if (courseIndex === 3) { // Level 4 (0-indexed)
        // Level 4 is L-shaped: bounds approximately x: -24.5 to 7.5, z: -30 to 30
        // Center is approximately at x: -8.5, z: 0
        const centerX = -8.5;
        const centerZ = 0;
        const halfWidth = 25;
        const halfHeight = 35;
        
        directionalLight.shadow.camera.left = centerX - halfWidth;
        directionalLight.shadow.camera.right = centerX + halfWidth;
        directionalLight.shadow.camera.top = centerZ + halfHeight;
        directionalLight.shadow.camera.bottom = centerZ - halfHeight;
        directionalLight.shadow.camera.far = 100;
        // Position light to cover the L-shaped area
        directionalLight.position.set(centerX + 15, 35, centerZ + 15);
        directionalLight.target.position.set(centerX, 0, centerZ);
        directionalLight.target.updateMatrixWorld();
        directionalLight.intensity = 0.7; // Brighter for better shadows
        hemisphereLight.intensity = 0.5; // Increase hemisphere light for better coverage
    } else if (courseIndex === 4) { // Level 5 (0-indexed)
        // Level 5 is 100x100, centered at origin
        const centerX = 0;
        const centerZ = 0;
        const halfSize = 60;
        
        directionalLight.shadow.camera.left = centerX - halfSize;
        directionalLight.shadow.camera.right = centerX + halfSize;
        directionalLight.shadow.camera.top = centerZ + halfSize;
        directionalLight.shadow.camera.bottom = centerZ - halfSize;
        directionalLight.shadow.camera.far = 150;
        // Position light to cover the large area
        directionalLight.position.set(centerX + 40, 50, centerZ + 40);
        directionalLight.target.position.set(centerX, 0, centerZ);
        directionalLight.target.updateMatrixWorld();
        directionalLight.intensity = 0.8; // Brighter for very large area
        hemisphereLight.intensity = 0.6; // Increase hemisphere light even more
        // Update shadow map size for better quality on large area
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
    } else {
        // Reset to default for smaller courses
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        directionalLight.shadow.camera.far = 50;
        directionalLight.position.set(10, 20, 10);
        directionalLight.target.position.set(0, 0, 0);
        directionalLight.target.updateMatrixWorld();
        directionalLight.intensity = 0.5;
        hemisphereLight.intensity = 0.4; // Default hemisphere light
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
    }
    
    // Update shadow camera projection matrix
    directionalLight.shadow.camera.updateProjectionMatrix();
}

// Camera controls - will be updated to follow ball
let controls = null;

// Camera distance constants
const CAMERA_DISTANCE = 8;
const CAMERA_HEIGHT = 4;
let cameraFollowingBall = true; // Track if camera should follow ball
let currentHoleIn5HoleGame = 0; // Track current hole in 5-hole mode
let teleportCameraAngle = false; // Track if camera should use special teleport angle
let teleportCameraTimer = 0; // Timer for teleport camera effect
let freeCamMode = false; // Free camera mode for cutscene recording
let freeCamSpeed = 20.0; // Speed for free cam movement (increased for easier navigation)
let cutsceneTestMode = false; // Set to true to test camera positioning, false for normal cutscene
let cutscenePaused = false; // Track if cutscene is paused for testing
let cutsceneActive = false; // Track if cutscene is active

// Store starting camera state for level (to restore when ball goes out of bounds)
let startingCameraPosition = new THREE.Vector3();
let startingCameraTarget = new THREE.Vector3();
let startingCameraOffsetZ = 0;

// Free camera keyboard state
const freeCamKeys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    space: false
};
let cutsceneTimer = 0; // Timer for cutscene
let cutsceneOverlay = null; // Visual overlay for cutscene
let cutsceneTotalDuration = 12.0; // Total cutscene duration in seconds
let cutscenePhase = 0; // Current phase of cutscene (0=fade-in, 1=explosion, 2=you-died)
let ballExplosionParticles = null; // Reference to ball explosion particle system
let ballExplosionInterval = null; // Interval for continuous ball particles
let yellowPortalDestination = null; // Store destination yellow portal position for spawning return teleporter

function initCameraControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Disable panning - only allow rotation
    controls.enablePan = false;
    
    // Disable zooming to maintain constant distance
    controls.enableZoom = false;
    
    // Allow both left and right mouse buttons to rotate
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.ROTATE
    };
    
    // Set initial target to ball position (will be updated)
    const ballPos = getBallPosition();
    controls.target.set(ballPos.x, ballPos.y, ballPos.z);
    
    // Position camera to keep ball in bottom third at constant distance
    camera.position.set(ballPos.x, ballPos.y + CAMERA_HEIGHT, ballPos.z + CAMERA_DISTANCE);
    camera.lookAt(ballPos);
    
    controls.update();
}

// Game mode (true = Full mode, false = Prototype mode)
let isFullMode = true; // Start in full mode

// Mode toggle functionality
if (modeToggleButton) {
    // Set initial button text
    modeToggleButton.textContent = 'Full Mode';
    
    modeToggleButton.addEventListener('click', () => {
        isFullMode = !isFullMode;
        modeToggleButton.textContent = isFullMode ? 'Full Mode' : 'Prototype Mode';
        console.log('Mode switched to:', isFullMode ? 'Full' : 'Prototype');
        
        // Reload current level with new mode
        reloadCurrentLevelWithMode();
    });
}

// Initialize physics system
try {
    initPhysics();
    console.log('Physics initialized');
} catch (error) {
    console.error('Error initializing physics:', error);
}

// Don't load course immediately - wait for menu selection
// Course will be loaded when user selects from menu

// Initialize camera controls after ball is created
initCameraControls();

// Initialize controls and UI (pass references to avoid circular dependency)
// Note: controls must be initialized before this
try {
    initControls(camera, renderer, controls);
    console.log('Controls initialized');
} catch (error) {
    console.error('Error initializing controls:', error);
}

try {
    initUI(scene, camera);
    console.log('UI initialized');
} catch (error) {
    console.error('Error initializing UI:', error);
}

// Initialize HUD
try {
    initHUD();
    console.log('HUD initialized');
} catch (error) {
    console.error('Error initializing HUD:', error);
}

// Initialize Menu
try {
    initMenu();
    console.log('Menu initialized');
} catch (error) {
    console.error('Error initializing menu:', error);
}

// Initialize Inventory
try {
    initInventory();
    console.log('Inventory initialized');
} catch (error) {
    console.error('Error initializing inventory:', error);
}

// Ghost AI settings
let ghostAIEnabled = true; // Enable ghost ball by default
let ghostAIDifficulty = Difficulty.MEDIUM; // Default difficulty


// Delta time tracking for smooth animations
let lastTime = 0;
const targetFPS = 60;
const frameTime = 1000 / targetFPS;

// Render loop
function animate(currentTime) {
    requestAnimationFrame(animate);
    
    
    // Calculate delta time in seconds
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap at 0.1s to prevent large jumps
    lastTime = currentTime;
    
    // Update wobble time for aiming
    updateWobbleTime(deltaTime);
    
    // Update WASD keyboard controls
    updateWASDControls(deltaTime);
    
    // Update physics
    updatePhysics(deltaTime);
    
    // Update UI (arrow, power meter)
    updateUI();
    
    // Update hole indicator ring color
    updateHoleIndicator();
    
    // Update animations
    updateAnimations();
    
    // Update screen shake
    updateScreenShake(canvas);
    
    // Update particles
    updateParticles();
    
    // Get ball position for use in various checks
    const ballPos = getBallPosition();
    const ballVel = getBallVelocity();
    
    // Update ball trail (skip during cutscene)
    if (!cutsceneActive) {
        updateBallTrail(ballPos, ballVel);
    }
    
    // Update environmental particles
    updateEnvironmentalParticles();
    
    // Update power-ups (bob animation, rotation, shader)
    updatePowerUps(camera);
    
    // Update moving walls
    updateMovingWalls(deltaTime);
    
    // Update magnetic fields animation
    updateMagneticFields(deltaTime);
    
    // Update teleporter cooldown
    updateTeleporterCooldown(deltaTime);

    // Update teleporter animations
    updateTeleporterAnimations(deltaTime);

    // Update model animations (fade-in, etc.)
    updateModelAnimations(deltaTime);
    
    // Update floor shader animation (subtle wind effect)
    updateFloor(deltaTime);
    
    // Update wind zone animations (particle effects)
    updateWindZones(deltaTime);
    
    // Update skybox animation (twinkling stars)
    updateSkybox(deltaTime);

    // Update animated materials (iridescent, holographic effects)
    updateAnimatedMaterials(deltaTime);

    // Check power-up collection
    const collectedPowerUp = checkPowerUpCollection(ballPos);
    if (collectedPowerUp) {
        addToInventory(collectedPowerUp);
    }
    
    // Update Ghost Ball AI (if enabled and not in cutscene)
    if (ghostAIEnabled && !cutsceneActive) {
        updateGhostAI(deltaTime, currentTime);
    }
    
    // Check win condition
    const winResult = checkWinCondition();
    if (winResult) {
        if (cameraFollowingBall) {
            // Stop following ball and center on hole immediately
            cameraFollowingBall = false;
            const holePos = getHolePosition();
            
            // Despawn ball when it goes through the hole
            hideBall();
            
            // Hide ghost ball when hole is complete
            if (ghostAIEnabled) {
                hideGhostBall();
            }
            
            // Clear Magnetic Pull power-up (it lasts until hole completion)
            clearMagneticPull();
            
            // Add hole score (golf scoring - relative to par)
            const currentStrokes = getStrokeCount();
            const holePar = getPar();
            addHoleScore(currentStrokes, holePar);
            
            // Get rating and show text immediately
            const rating = calculateRating();
            const isSpecialRating = rating === 'HOLE_IN_ONE' || rating === 'EAGLE' || rating === 'BIRDIE';
            
            // Show rating text immediately (before menu)
            showRatingText(rating);
            
            // Trigger effects immediately (during pause)
            triggerRatingEffects(rating, holePos);
            
            // Longer pause for special ratings (Hole-in-One, Eagle, Birdie)
            const pauseDuration = isSpecialRating ? 3000 : 1500; // 3 seconds for special, 1.5 for others
            
            // Wait before showing menu (pause with camera at hole and rating text visible)
            setTimeout(() => {
                // Hide rating text and show completion screen after pause
                hideRatingText();
                showHoleCompleteScreen(currentStrokes, getTotalScore(), getCurrentCourseIndex(), getTotalCourses());
            }, pauseDuration);
            
            console.log('Hole completed! Strokes:', currentStrokes, 'Par:', holePar, 'Total:', getTotalScore());
        }
    }
    
    // Update HUD
    updateHUD();
    
    // Update teleport camera timer
    if (teleportCameraTimer > 0) {
        teleportCameraTimer -= deltaTime;
        if (teleportCameraTimer <= 0) {
            teleportCameraAngle = false;
            teleportCameraTimer = 0;
        }
    }
    
    // Update cutscene timer and phases
    if (cutsceneActive && cutsceneTimer > 0) {
        // TESTING: If cutscene test mode is on, pause on first frame and don't advance timer while paused
        if (cutsceneTestMode && !cutscenePaused && cutsceneTimer === cutsceneTotalDuration) {
            cutscenePaused = true;
            console.log('=== CUTSCENE TEST MODE ===');
            console.log('Cutscene auto-paused for camera positioning');
            console.log('Use WASD to move horizontally');
            console.log('Space = up, Shift = down');
            console.log('Mouse to rotate camera (hold right click)');
            console.log('Press L to log camera position');
            console.log('Press P to resume cutscene');
        }
        
        // Only advance timer if not paused
        if (!cutscenePaused) {
            cutsceneTimer -= deltaTime;
            const elapsed = cutsceneTotalDuration - cutsceneTimer;
            
            // Phase transitions:
            // 0-3 seconds: Neco-arc fade-in with intense particles (ball hidden)
            // 3-7 seconds: Ball levitation animation
            // 7-12 seconds: "You Died" fade-in
            
            // Phase 0: Neco-arc fade-in with lots of particles (0-3 seconds)
            if (cutscenePhase === 0 && elapsed < 3) {
                // Hide ball during neco-arc appearance (only once)
                if (elapsed < 0.1) {
                    hideBall();
                }
                
                // Create TONS of intense particle effects around neco-arc model
                // Limit particle creation to avoid performance issues
                if (Math.random() < 0.3) { // Reduced to 30% chance, but more particles per burst
                    const necoArcPos = new THREE.Vector3(-82, -65, 37);
                    
                    // Create multiple particle bursts at various positions around the model
                    for (let i = 0; i < 2; i++) { // Reduced from 3 to 2 loops
                        const offsetX = (Math.random() - 0.5) * 15;
                        const offsetZ = (Math.random() - 0.5) * 15;
                        const offsetY = Math.random() * 15;
                        
                        // Yellow particles
                        createParticleBurst(
                            new THREE.Vector3(necoArcPos.x + offsetX, necoArcPos.y + offsetY, necoArcPos.z + offsetZ),
                            0xffff00, // Yellow
                            40 + Math.random() * 30, // 40-70 particles
                            2.5 + Math.random() * 1.0 // 2.5-3.5 speed
                        );
                        
                        // Magenta particles
                        createParticleBurst(
                            new THREE.Vector3(necoArcPos.x + offsetX * 0.8, necoArcPos.y + offsetY * 1.2, necoArcPos.z + offsetZ * 0.8),
                            0xff00ff, // Magenta
                            35 + Math.random() * 25, // 35-60 particles
                            2.0 + Math.random() * 1.0 // 2.0-3.0 speed
                        );
                    }
                    
                    // Gold sparkles - multiple bursts
                    createGoldBurst(necoArcPos, 60);
                    createGoldBurst(
                        new THREE.Vector3(necoArcPos.x + (Math.random() - 0.5) * 5, necoArcPos.y + 5, necoArcPos.z + (Math.random() - 0.5) * 5),
                        50
                    );
                    
                    // Magic appearance effect (only occasionally)
                    if (Math.random() < 0.3) {
                        createMagicAppearanceEffect(necoArcPos);
                    }
                    
                    // Additional red/orange particles for more intensity
                    if (Math.random() < 0.4) {
                        createParticleBurst(
                            new THREE.Vector3(necoArcPos.x + (Math.random() - 0.5) * 8, necoArcPos.y + 8, necoArcPos.z + (Math.random() - 0.5) * 8),
                            0xff6600, // Orange
                            25,
                            2.0
                        );
                    }
                }
            }
            
            if (elapsed >= 3 && cutscenePhase === 0) {
                // Transition to phase 1 - start ball animation
                cutscenePhase = 1;
                console.log('Phase 1: Ball levitation animation (3-7s)');
                
                // Show ball and start at initial position
                showBall();
                if (ballStartPos) {
                    setBallPosition(ballStartPos);
                    setBallVelocity(new THREE.Vector3(0, 0, 0));
                }
            }
            
            // Phase 1: Ball levitation animation (3-7 seconds)
            if (cutscenePhase === 1 && elapsed >= 3 && elapsed < 7 && ballLevitationStartPos && ballLevitationTargetPos) {
                const ballElapsed = elapsed - 3; // Time since ball animation started
                const levitationProgress = Math.min(ballElapsed / 3.0, 1.0); // 3 seconds to levitate
                const easeProgress = 1 - Math.pow(1 - levitationProgress, 3); // Ease out cubic
                
                // Interpolate between start and target positions
                const currentPos = new THREE.Vector3().lerpVectors(
                    ballLevitationStartPos,
                    ballLevitationTargetPos,
                    easeProgress
                );
                
                // Add floating effect
                const floatOffset = Math.sin(ballElapsed * 2) * 0.5; // Gentle floating
                currentPos.y += floatOffset;
                
                setBallPosition(currentPos);
                
                // Create continuous particle trail during levitation
                if (Math.random() < 0.3) { // 30% chance each frame
                    createParticleBurst(currentPos.clone(), 0xffff00, 10, 1.5); // Yellow particles
                    createParticleBurst(currentPos.clone(), 0xff00ff, 5, 1.0); // Magenta particles
                }
                
                // Start intense particles when ball reaches peak
                if (levitationProgress >= 0.9 && !ballExplosionInterval) {
                    startBallExplosionParticles();
                }
            }
            
            if (elapsed >= 7 && cutscenePhase === 1) {
                // Transition to phase 2 - show "You Died"
                cutscenePhase = 2;
                stopBallExplosionParticles();
                import('./hud.js').then(hudModule => {
                    hudModule.showYouDiedScreen();
                });
                console.log('Phase 2: YOU DIED (7-12s)');
            }
            
            // Keep ball floating at peak during transition to phase 2
            if (cutscenePhase === 1 && elapsed >= 6.5 && ballLevitationTargetPos) {
                const floatOffset = Math.sin(elapsed * 3) * 1.0; // More intense floating
                const floatingPos = ballLevitationTargetPos.clone();
                floatingPos.y += floatOffset;
                setBallPosition(floatingPos);
            }
            
            if (cutsceneTimer <= 0) {
                // Cutscene ended - restore everything
                endCutscene();
            }
        }
    }

    // Update camera
    if (isInPaintingMode()) {
        // In painting mode, camera is completely independent from ball
        // Camera is controlled by WASD/arrow keys in floor-painter.js
        // Disable all controls and don't update camera here
        controls.enabled = false;
        cameraFollowingBall = false;
        // Camera position/rotation is managed entirely by floor-painter.js
        // Skip all camera update logic below
    } else if (cutsceneActive) {
        // Enable free camera movement during cutscene (for positioning)
        // Enable orbit controls for mouse rotation
        controls.enabled = true;
        controls.enablePan = false;
        controls.enableZoom = true;
        
        // Get camera's forward and right vectors for WASD movement
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        camera.getWorldDirection(forward);
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        
        // Calculate movement based on keys pressed
        const moveSpeed = freeCamSpeed * deltaTime;
        
        if (freeCamKeys.w) {
            camera.position.addScaledVector(forward, moveSpeed);
            controls.target.addScaledVector(forward, moveSpeed);
        }
        if (freeCamKeys.s) {
            camera.position.addScaledVector(forward, -moveSpeed);
            controls.target.addScaledVector(forward, -moveSpeed);
        }
        if (freeCamKeys.a) {
            camera.position.addScaledVector(right, -moveSpeed);
            controls.target.addScaledVector(right, -moveSpeed);
        }
        if (freeCamKeys.d) {
            camera.position.addScaledVector(right, moveSpeed);
            controls.target.addScaledVector(right, moveSpeed);
        }
        if (freeCamKeys.space) {
            camera.position.y += moveSpeed;
            controls.target.y += moveSpeed;
        }
        if (freeCamKeys.shift) {
            camera.position.y -= moveSpeed;
            controls.target.y -= moveSpeed;
        }
        
        controls.update();
    } else if (freeCamMode) {
        // Minecraft-style creative freecam - completely free camera movement
        const moveSpeed = freeCamSpeed * deltaTime;

        // Get camera's forward, right, and up vectors
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);

        camera.getWorldDirection(forward);
        right.crossVectors(forward, up).normalize();

        // WASD movement in 3D space relative to camera orientation
        if (freeCamKeys.w) {
            camera.position.addScaledVector(forward, moveSpeed);
        }
        if (freeCamKeys.s) {
            camera.position.addScaledVector(forward, -moveSpeed);
        }
        if (freeCamKeys.a) {
            camera.position.addScaledVector(right, -moveSpeed);
        }
        if (freeCamKeys.d) {
            camera.position.addScaledVector(right, moveSpeed);
        }
        if (freeCamKeys.space) {
            camera.position.addScaledVector(up, moveSpeed);
        }
        if (freeCamKeys.shift) {
            camera.position.addScaledVector(up, -moveSpeed);
        }
    } else if (cameraFollowingBall) {
        // Follow ball at constant distance
        const ballPos = getBallPosition();
        controls.target.set(ballPos.x, ballPos.y, ballPos.z);
        controls.update();
        
        // Disable panning and zooming when following ball
        controls.enablePan = false;
        controls.enableZoom = false;
        
        // Special camera angle when teleporting (look at neco-arc model)
        if (teleportCameraAngle && teleportCameraTimer > 0) {
            // Look towards neco-arc model position (-82, -100, 37)
            const necoArcPos = new THREE.Vector3(-82, -100, 37);
            const directionToNecoArc = new THREE.Vector3().subVectors(necoArcPos, ballPos).normalize();
            
            // Position camera to look at neco-arc from ball position
            camera.position.set(
                ballPos.x - directionToNecoArc.x * CAMERA_DISTANCE * 0.8,
                ballPos.y + CAMERA_HEIGHT * 1.5,
                ballPos.z - directionToNecoArc.z * CAMERA_DISTANCE * 0.8
            );
            camera.lookAt(necoArcPos);
        } else {
            // Normal camera following
            // After OrbitControls updates, maintain constant distance from ball
            const currentCameraPos = camera.position.clone();
            const toBall = new THREE.Vector3().subVectors(ballPos, currentCameraPos);
            
            // Calculate current horizontal distance
            const horizontalDistance = Math.sqrt(toBall.x * toBall.x + toBall.z * toBall.z);
            
            if (horizontalDistance > 0.01) {
                // Normalize horizontal direction
                const horizontalDir = new THREE.Vector3(toBall.x, 0, toBall.z).normalize();
                
                // Set camera position maintaining constant horizontal distance and height
                camera.position.set(
                    ballPos.x - horizontalDir.x * CAMERA_DISTANCE,
                    ballPos.y + CAMERA_HEIGHT,
                    ballPos.z - horizontalDir.z * CAMERA_DISTANCE
                );
                
                // Make sure camera looks at ball
                camera.lookAt(ballPos);
            }
        }
    } else {
        // Center camera on hole (ball has fallen in)
        const holePos = getHolePosition();
        controls.target.set(holePos.x, holePos.y, holePos.z);
        controls.update();
        
        // Position camera to look at hole from above
        camera.position.set(
            holePos.x,
            holePos.y + CAMERA_HEIGHT * 1.5,
            holePos.z + CAMERA_DISTANCE * 0.8
        );
        camera.lookAt(holePos);
        
        // Disable camera controls when hole is complete
        controls.enabled = false;
    }
    
    updateCosmetics();
    renderer.render(scene, camera);
}

// Handle keyboard input for free cam mode and cutscene testing
window.addEventListener('keydown', (event) => {
    // Press G to toggle Ghost Ball AI
    if (event.key === 'g' || event.key === 'G') {
        ghostAIEnabled = !ghostAIEnabled;
        setGhostAIEnabled(ghostAIEnabled);
        console.log(`Ghost AI ${ghostAIEnabled ? 'ENABLED' : 'DISABLED'}`);
    }
    
    // Press 1, 2, 3 to change ghost AI difficulty
    if (event.key === '1') {
        ghostAIDifficulty = Difficulty.EASY;
        setGhostAIDifficulty(Difficulty.EASY);
        console.log('Ghost AI difficulty: EASY');
    }
    if (event.key === '2') {
        ghostAIDifficulty = Difficulty.MEDIUM;
        setGhostAIDifficulty(Difficulty.MEDIUM);
        console.log('Ghost AI difficulty: MEDIUM');
    }
    if (event.key === '3') {
        ghostAIDifficulty = Difficulty.HARD;
        setGhostAIDifficulty(Difficulty.HARD);
        console.log('Ghost AI difficulty: HARD');
    }
    
    // Press P to toggle floor painting mode
    // Press P to toggle floor painting mode - DISABLED
    /*
    if (event.key === 'p' || event.key === 'P') {
        if (!cutsceneActive) {
            if (isInPaintingMode()) {
                exitPaintingMode();
            } else {
                // Get current course definition
                import('./courses.js').then(coursesModule => {
                    const courseDef = coursesModule.getCurrentCourseDefinition();
                    if (courseDef) {
                        enterPaintingMode(courseDef);
                    } else {
                        console.warn('No course loaded. Load a course first to paint floor.');
                    }
                });
            }
        }
    }
    */
    
    // Press C to toggle free cam mode
    if (event.key === 'c' || event.key === 'C') {
        toggleFreeCam();
    }
    // Press ESC to exit free cam mode (if active) - takes priority over other ESC handlers
    if (event.key === 'Escape' && freeCamMode) {
        toggleFreeCam(); // This will reset camera to ball-following position
        // Set a flag so other handlers know freecam was just toggled
        window._freecamJustToggled = true;
        setTimeout(() => { window._freecamJustToggled = false; }, 0);
    }
    // Press R to reset level (+1 stroke penalty)
    if (event.key === 'r' || event.key === 'R') {
        resetLevel();
    }
    // Press L to log current camera state (for cutscene recording)
    if (event.key === 'l' || event.key === 'L') {
        logCameraState();
    }
    // Press P to pause/unpause cutscene (for testing)
    if ((event.key === 'p' || event.key === 'P') && cutsceneActive && cutsceneTestMode) {
        cutscenePaused = !cutscenePaused;
        console.log(cutscenePaused ? '=== CUTSCENE PAUSED ===\nUse WASD to move horizontally\nSpace = up, Shift = down\nMouse to rotate camera\nPress L to log camera position\nPress P to resume' : '=== CUTSCENE RESUMED ===');
    }
    
    // Free camera movement keys (available during cutscene or freeCamMode)
    if (cutsceneActive || freeCamMode) {
        if (event.key === 'w' || event.key === 'W') freeCamKeys.w = true;
        if (event.key === 'a' || event.key === 'A') freeCamKeys.a = true;
        if (event.key === 's' || event.key === 'S') freeCamKeys.s = true;
        if (event.key === 'd' || event.key === 'D') freeCamKeys.d = true;
        if (event.key === 'Shift') freeCamKeys.shift = true;
        if (event.key === ' ') {
            freeCamKeys.space = true;
            event.preventDefault(); // Prevent page scroll
        }
    }
});

window.addEventListener('keyup', (event) => {
    // Free camera movement keys release (only when in cutscene or freeCamMode)
    if (cutsceneActive || freeCamMode) {
        if (event.key === 'w' || event.key === 'W') freeCamKeys.w = false;
        if (event.key === 'a' || event.key === 'A') freeCamKeys.a = false;
        if (event.key === 's' || event.key === 'S') freeCamKeys.s = false;
        if (event.key === 'd' || event.key === 'D') freeCamKeys.d = false;
        if (event.key === 'Shift') freeCamKeys.shift = false;
        if (event.key === ' ') freeCamKeys.space = false;
    }
});

// Mouse movement for freecam
document.addEventListener('mousemove', onFreecamMouseMove);

// Pointer lock events for freecam
document.addEventListener('pointerlockchange', onPointerLockChange);

// Click to lock pointer in freecam mode
renderer.domElement.addEventListener('click', () => {
    if (freeCamMode && !isPointerLocked) {
        requestPointerLock();
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Listen for game start event
// Track if playing single selected level (goes back to menu after) vs playing through levels
let isSingleLevelMode = false;

window.addEventListener('startGame', (event) => {
    const { mode, startHole } = event.detail;
    
    // Reset total score if starting new game
    if (mode === '5holes') {
        resetTotalScore();
        currentHoleIn5HoleGame = 0;
        isSingleLevelMode = false;
    } else if (mode === 'single') {
        // Single level selected from menu - go back to menu after
        isSingleLevelMode = true;
        resetTotalScore();
    }
    
    // Clear inventory and power-ups when starting a new game
    clearInventory();
    clearAllPowerUpEffects();
    
    // Load the starting hole
    loadAndStartHole(startHole, mode);
});

// Export for hud.js to check
export function getIsSingleLevelMode() {
    return isSingleLevelMode;
}

// Listen for power-up activation events
window.addEventListener('powerUpActivated', (event) => {
    const powerUp = event.detail;
    console.log('Power-up activated event received:', powerUp);
    if (powerUp.type === 'SPEED_BOOST') {
        activateSpeedBoost();
        console.log('Speed Boost activated! Multiplier:', getSpeedBoostMultiplier());
    } else if (powerUp.type === 'SHARPSHOOTER') {
        activateSharpshooter();
        console.log('Sharpshooter activated! Arrow wobble disabled.');
    } else if (powerUp.type === 'MAGNETIC_PULL') {
        activateMagneticPull();
        console.log('Magnetic Pull activated! Ball will be attracted to hole.');
    } else if (powerUp.type === 'REWIND') {
        activateRewind();
        console.log('Rewind activated! Undoing last shot.');
        
        const lastState = getLastBallState();
        if (lastState) {
            // Restore ball position and velocity
            setBallPosition(lastState.position);
            setBallVelocity(lastState.velocity);
            // Decrement stroke count
            decrementStroke();
            console.log('Ball reset to previous position, stroke count decremented');
        } else {
            console.log('No previous shot to undo');
        }
    }
});

// Function to reload current level with new mode
async function reloadCurrentLevelWithMode() {
    const currentIndex = getCurrentCourseIndex();
    if (currentIndex === -1) {
        console.log('No level loaded, cannot switch mode');
        return;
    }
    
    console.log(`Reloading hole ${currentIndex + 1} in ${isFullMode ? 'Full' : 'Prototype'} mode`);
    
    // Update lighting for new mode
    updateLightingForMode();
    
    // Update ghost ball material for new mode (if it exists)
    const ghostBallModule = await import('./ghost-ball.js');
    if (ghostBallModule.updateGhostBallMaterial) {
        ghostBallModule.updateGhostBallMaterial();
    }
    
    // Clear the scene completely
    await clearCurrentLevel();
    
    // Reload the same hole with new mode
    const mode = isSingleLevelMode ? 'single' : '5holes';
    await loadAndStartHole(currentIndex, mode);
}

// Function to clear current level (remove all objects)
async function clearCurrentLevel() {
    // Remove all teleporters
    removeAllTeleporters();
    
    // Remove all power-ups
    removeAllPowerUps();
    
    // Don't remove ghost ball - just update its material for the new mode
    // The ghost ball will persist across mode switches
    
    // Import and clear course
    const courseModule = await import('./course.js');
    if (courseModule.clearCourse) {
        courseModule.clearCourse();
    }
    
    // Import and clear hole
    const gameModule = await import('./game.js');
    if (gameModule.removeHole) {
        gameModule.removeHole();
    }
}

async function loadAndStartHole(holeIndex, mode) {
    try {
        // Reset cutscene state when loading any level
        cutsceneActive = false;
        cutsceneTimer = 0;
        cutscenePhase = 0;
        yellowPortalDestination = null;
        stopBallExplosionParticles();
        removeCutsceneOverlay(true);
        
        // Hide any UI overlays from previous level
        const hudModule = await import('./hud.js');
        hudModule.hideYouDiedScreen();
        hudModule.hideStrokePenaltyText();
        hudModule.hideHoleCompleteScreen();
        
        // Show all course elements (in case they were hidden during cutscene)
        const courseModule = await import('./course.js');
        courseModule.showAllCourseElements();
        courseModule.hideNecoArcModel();
        
        // Re-enable camera controls
        if (controls) {
            controls.enabled = true;
        }
        cameraFollowingBall = true;
        
        const courseDef = await loadCourse(holeIndex);
        if (courseDef) {
            // Get the start position directly from the level definition
            const levelDef = courseDef.definition;
            const startPos = levelDef.ballStartPosition 
                ? new THREE.Vector3(levelDef.ballStartPosition.x, levelDef.ballStartPosition.y, levelDef.ballStartPosition.z)
                : new THREE.Vector3(0, 0.5, 0); // Fallback if not defined
            
            console.log(`Loading hole ${holeIndex + 1}: Start position from level def: (${startPos.x.toFixed(2)}, ${startPos.y.toFixed(2)}, ${startPos.z.toFixed(2)})`);
            
            // Set hole position
            setHolePosition(levelDef.holePosition);
            
            // Clear active power-up effects (but keep inventory)
            clearAllPowerUpEffects();
            
            // Create ball if it doesn't exist
            if (!getBallMesh()) {
                createBall();
                createBallTrail();
            }
            
            // Set the ball's start position for this level FIRST (before resetHole)
            // This is critical because resetHole() calls resetBall() which uses BALL_START_POSITION
            setBallStartPosition(startPos);
            
            // Reset hole state (stroke count, completion flag)
            // This will call resetBall() which now uses the correct BALL_START_POSITION
            resetHole();
            
            showBall();
            resetCollisions();
            
            // Reset camera to follow ball at the start position
            cameraFollowingBall = true;
            controls.enabled = true;
            controls.target.set(startPos.x, startPos.y, startPos.z);
            
            // Position camera behind the ball (default) or use level's custom camera offset if defined
            const cameraOffsetZ = levelDef.cameraStartBehind ? CAMERA_DISTANCE : -CAMERA_DISTANCE;
            camera.position.set(startPos.x, startPos.y + CAMERA_HEIGHT, startPos.z + cameraOffsetZ);
            camera.lookAt(startPos);
            controls.update();
            
            // Store starting camera state for restoring when ball goes out of bounds
            startingCameraPosition.copy(camera.position);
            startingCameraTarget.copy(controls.target);
            startingCameraOffsetZ = cameraOffsetZ;
            
            // Hide completion screen
            hideHoleCompleteScreen();
            
            // Create hole
            await createHole();
            
            // Set par for this level (2, 3, 4, 5, 5)
            const pars = [3, 3, 4, 5, 5];
            if (holeIndex < pars.length) {
                setPar(pars[holeIndex]);
            }
            
            // Initialize Ghost Ball AI
            if (ghostAIEnabled) {
                initializeGhostAI(startPos, {
                    difficulty: ghostAIDifficulty,
                    shotDelayMs: 1000,
                    startDelayMs: 2000 // 2 second delay before AI starts
                });
                // Ghost ball visibility is handled by initializeGhostAI
            }
            
            console.log(`Hole ${holeIndex + 1} loaded - ball spawns at (${startPos.x}, ${startPos.y}, ${startPos.z})`);
        }
    } catch (error) {
        console.error('Error loading course:', error);
    }
}


// Listen for next course event
window.addEventListener('nextCourse', () => {
    const currentIndex = getCurrentCourseIndex();
    const totalCourses = getTotalCourses();
    
    // Check if we're in 5-hole mode
    const is5HoleMode = currentHoleIn5HoleGame !== undefined;
    
    // Ensure cutscene state is fully reset before moving to next hole
    cutsceneActive = false;
    cutsceneTimer = 0;
    cutscenePhase = 0;
    yellowPortalDestination = null;
    stopBallExplosionParticles();
    removeCutsceneOverlay(true);
    
    if (is5HoleMode && currentHoleIn5HoleGame + 1 < 5) {
        // Continue 5-hole game
        currentHoleIn5HoleGame++;
        console.log(`Next hole in 5-hole mode: ${currentHoleIn5HoleGame + 1}`);
        loadAndStartHole(currentHoleIn5HoleGame, '5holes');
    } else if (currentIndex + 1 < totalCourses) {
        // Next hole in single mode
        const nextCourseData = nextCourse();
        if (nextCourseData) {
            console.log(`Next hole in single mode: ${currentIndex + 2}`);
            loadAndStartHole(currentIndex + 1, 'single');
        }
    } else {
        // All holes complete - show menu
        showMenu();
    }
});

// Start render loop
animate(0);

// Function called when teleportation happens (deprecated - kept for backwards compatibility)
export function onTeleportation(destinationPosition) {
    // Redirect to new yellow portal function
    onYellowPortalTeleportation(destinationPosition);
}

// Ball levitation state for cutscene
let ballLevitationStartPos = null;
let ballLevitationTargetPos = null;
let ballLevitationStartTime = 0;
let ballStartPos = null; // Initial ball position for cutscene

// Function called when yellow portal teleportation happens - triggers special cutscene
export function onYellowPortalTeleportation(destinationPosition) {
    if (cutsceneActive) return; // Already in cutscene
    
    // Validate destination position
    if (!destinationPosition) {
        console.error('onYellowPortalTeleportation called with null destinationPosition');
        return;
    }
    
    cutsceneActive = true;
    cutscenePhase = 0; // Start at phase 0 (neco-arc fade-in with particles)
    cutsceneTotalDuration = 12.0; // 12 second cutscene
    cutsceneTimer = cutsceneTotalDuration;
    
    // Store destination position for spawning return teleporter
    yellowPortalDestination = destinationPosition.clone();
    console.log('Yellow portal destination stored:', yellowPortalDestination);
    
    // Set camera to the found position (looking at the scene)
    // Camera position found during testing
    camera.position.set(9.90, 32.22, 38.54);
    camera.rotation.set(1.266, 1.441, -1.264);
    
    // Set camera target
    const cameraTarget = new THREE.Vector3(-20.26, 35.98, 37.36);
    controls.target.copy(cameraTarget);
    
    // Calculate ball position relative to camera
    // The ball should appear in front of the camera at the same relative position
    // Calculate offset from camera to target, then position ball relative to that
    const cameraToTarget = new THREE.Vector3().subVectors(cameraTarget, camera.position);
    const cameraForward = new THREE.Vector3().subVectors(cameraTarget, camera.position).normalize();
    
    // Position ball in front of camera, between camera and target
    // Start position: closer to camera, lower
    const ballStartOffset = cameraForward.clone().multiplyScalar(25); // Distance in front of camera
    ballStartPos = new THREE.Vector3(
        camera.position.x + ballStartOffset.x,
        camera.position.y + ballStartOffset.y - 10, // Lower than camera
        camera.position.z + ballStartOffset.z
    );
    
    // Target position: further from camera, higher
    const ballTargetOffset = cameraForward.clone().multiplyScalar(30); // Further in front
    ballLevitationTargetPos = new THREE.Vector3(
        camera.position.x + ballTargetOffset.x,
        camera.position.y + ballTargetOffset.y + 5, // Higher than camera
        camera.position.z + ballTargetOffset.z
    );
    
    // Enable camera controls for freecam during cutscene
    controls.enabled = true;
    controls.enablePan = false;
    controls.enableZoom = true;
    cameraFollowingBall = false;
    freeCamMode = false;
    
    console.log('Freecam enabled - Use WASD to move, Space/Shift for up/down, Mouse to rotate, L to log position');
    
    // Hide all course elements except ball and model
    import('./course.js').then(courseModule => {
        courseModule.hideAllCourseElements();
        
        // Re-show neco-arc model
        courseModule.showNecoArcModel();
    });
    
    // Hide ghost ball during cutscene
    if (ghostAIEnabled) {
        hideGhostBall();
    }
    
    // Prepare ball for animation (but hide it initially)
    // Hide ball initially - it will appear in phase 1
    hideBall();
    
    // Store start position for animation
    ballLevitationStartPos = ballStartPos.clone();
    ballLevitationStartTime = Date.now() / 1000;
    
    // Move ball to initial position relative to camera (but hidden)
    setBallPosition(ballStartPos);
    setBallVelocity(new THREE.Vector3(0, 0, 0));
    
    console.log('Ball prepared at', ballStartPos, 'will animate to', ballLevitationTargetPos);
    
    // Create initial magic particles for neco-arc appearance
    const necoArcPos = new THREE.Vector3(-82, -65, 37);
    createMagicAppearanceEffect(necoArcPos);
    
    console.log('Yellow Portal Cutscene Started - 12 seconds total');
    console.log('Phase 0: Neco-arc fade-in with particles (0-3s)');
    console.log('Phase 1: Ball levitation animation (3-7s)');
    console.log('Phase 2: YOU DIED (7-12s)');
}

// Start continuous ball explosion particles (phase 1: 4-8 seconds)
function startBallExplosionParticles() {
    console.log('Phase 1: Intense ball particles (4-8s)');
    
    // Create continuous explosion particles around the ball at levitation position
    ballExplosionInterval = setInterval(() => {
        if (!cutsceneActive || cutscenePhase !== 1) {
            stopBallExplosionParticles();
            return;
        }
        
        // Get actual ball position
        const ballPos = getBallPosition();
        
        // Create intense particle effects
        createBallExplosionEffect(ballPos);
        createParticleBurst(ballPos, 0xff0000, 15, 2.0); // Red particles
        createParticleBurst(ballPos, 0xffff00, 10, 1.5); // Yellow particles
        createGoldBurst(ballPos, 20); // Gold sparkles
    }, 80); // Create new burst every 80ms for more intensity
}

// Stop ball explosion particles
function stopBallExplosionParticles() {
    if (ballExplosionInterval) {
        clearInterval(ballExplosionInterval);
        ballExplosionInterval = null;
    }
    console.log('Ball explosion particles stopped');
}

// Create visual overlay for cutscene
function createCutsceneOverlay() {
    if (cutsceneOverlay) {
        cutsceneOverlay.style.display = 'block';
        cutsceneOverlay.style.opacity = '0';
        // Fade in the overlay
        setTimeout(() => {
            cutsceneOverlay.style.opacity = '1';
        }, 50);
        return;
    }
    
    cutsceneOverlay = document.createElement('div');
    cutsceneOverlay.id = 'cutscene-overlay';
    cutsceneOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at center, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.95) 100%);
        z-index: 100;
        pointer-events: none;
        opacity: 0;
        transition: opacity 1s ease-in-out;
    `;
    
    // Add pulsing animation style
    const style = document.createElement('style');
    style.id = 'cutscene-style';
    style.textContent = `
        @keyframes cutscenePulse {
            0%, 100% { opacity: 0.8; }
            50% { opacity: 1.0; }
        }
        @keyframes darkPulse {
            0%, 100% { 
                background: radial-gradient(circle at center, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.95) 100%);
            }
            50% { 
                background: radial-gradient(circle at center, rgba(20, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.98) 100%);
            }
        }
    `;
    if (!document.getElementById('cutscene-style')) {
        document.head.appendChild(style);
    }
    
    document.body.appendChild(cutsceneOverlay);
    
    // Fade in after a small delay
    setTimeout(() => {
        cutsceneOverlay.style.opacity = '1';
        cutsceneOverlay.style.animation = 'darkPulse 3s ease-in-out infinite';
    }, 50);
}

function removeCutsceneOverlay(immediate = false) {
    if (cutsceneOverlay) {
        if (immediate) {
            // Immediately remove the overlay (for level restart)
            cutsceneOverlay.remove();
            cutsceneOverlay = null;
        } else {
            // Fade out then remove
            cutsceneOverlay.style.transition = 'opacity 0.5s ease-out';
            cutsceneOverlay.style.opacity = '0';
            setTimeout(() => {
                if (cutsceneOverlay) {
                    cutsceneOverlay.remove();
                    cutsceneOverlay = null;
                }
            }, 500);
        }
    }
}

// End cutscene and restore everything
async function endCutscene() {
    cutsceneActive = false;
    cutsceneTimer = 0;
    cutscenePhase = 0;

    // Stop any remaining particle effects
    stopBallExplosionParticles();

    // Hide "You Died" screen
    import('./hud.js').then(hudModule => {
        hudModule.hideYouDiedScreen();
    });

    // Show all course elements again
    import('./course.js').then(courseModule => {
        courseModule.showAllCourseElements();

        // Hide neco-arc model
        courseModule.hideNecoArcModel();
    });

    // DESPAWN the ball completely - hide it and move it far away
    hideBall();
    setBallVelocity(new THREE.Vector3(0, 0, 0));
    setBallPosition(new THREE.Vector3(0, -1000, 0)); // Move far away while hidden
    resetCollisions();

    // Wait a brief moment then SHOW +67 PENALTY, then show menu
    setTimeout(() => {
        // Mark hole as complete to prevent further play
        setHoleComplete(true);

        // Stop following ball and center on hole for the menu
        cameraFollowingBall = false;

        // Keep ball hidden during menu
        hideBall();

        // Clear Magnetic Pull power-up (it lasts until hole completion)
        clearMagneticPull();

        // Add 67 strokes as penalty
        const currentStrokes = getStrokeCount();
        const penaltyStrokes = currentStrokes + 67;
        setStrokeCount(penaltyStrokes);

        // Add hole score with the penalty strokes
        const holePar = getPar();
        addHoleScore(penaltyStrokes, holePar);

        // Re-enable camera controls for menu interaction
        controls.enabled = true;

        // Show +67 penalty text first
        showStrokePenaltyText(67);

        // Wait a bit longer before showing the menu (after penalty text is shown)
        setTimeout(() => {
            // Hide penalty text and show hole completion screen
            hideStrokePenaltyText();
            showHoleCompleteScreen(penaltyStrokes, getTotalScore(), getCurrentCourseIndex(), getTotalCourses());
        }, 2500); // Show menu after 2.5 seconds (penalty text shows for 3 seconds, but we'll hide it early)

        console.log('Cutscene ended - showing +67 penalty, then menu');
    }, 200); // 200ms delay

    // Clear stored destination
    yellowPortalDestination = null;
}

// Store original camera state when entering freecam
let savedCameraPosition = null;
let savedCameraTarget = null;
let savedCameraRotation = null;

// First-person camera controls for freecam
let isPointerLocked = false;
let euler = new THREE.Euler(0, 0, 0, 'YXZ'); // YXZ order for FPS controls
let mouseSensitivity = 0.002;

// Mouse look for freecam
function onFreecamMouseMove(event) {
    if (!freeCamMode) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    euler.y -= movementX * mouseSensitivity; // Horizontal rotation
    euler.x -= movementY * mouseSensitivity; // Vertical rotation

    // Clamp vertical rotation to prevent flipping
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));

    camera.quaternion.setFromEuler(euler);
}

// Request pointer lock for freecam
function requestPointerLock() {
    if (!freeCamMode) return;
    renderer.domElement.requestPointerLock();
}

// Handle pointer lock events
function onPointerLockChange() {
    isPointerLocked = (document.pointerLockElement === renderer.domElement);
}

// Check if freecam is active (for other modules)
export function isFreeCamActive() {
    return freeCamMode;
}

// Toggle free cam mode (can be called with a key press)
export function toggleFreeCam() {
    freeCamMode = !freeCamMode;
    if (freeCamMode) {
        // Save current camera state
        savedCameraPosition = camera.position.clone();
        savedCameraTarget = controls.target.clone();
        savedCameraRotation = camera.rotation.clone();

        // Set up first-person camera controls
        euler.setFromQuaternion(camera.quaternion);
        cameraFollowingBall = false;
        controls.enabled = false; // Disable OrbitControls completely

        // Request pointer lock for mouse look
        setTimeout(() => requestPointerLock(), 100); // Small delay to ensure mode switch is complete

        console.log('Free cam mode ON - Minecraft-style camera: WASD to move in all directions, mouse to look around, Space/Shift for vertical, click to lock mouse. Press C or ESC to exit.');
    } else {
        // Release pointer lock if active
        if (document.pointerLockElement === renderer.domElement) {
            document.exitPointerLock();
        }

        // Restore camera to follow ball
        cameraFollowingBall = true;
        controls.enabled = true; // Re-enable OrbitControls
        controls.enablePan = false;
        controls.enableZoom = false;

        // Reset to default ball-following position
        const ballPos = getBallPosition();
        controls.target.set(ballPos.x, ballPos.y, ballPos.z);
        camera.position.set(ballPos.x, ballPos.y + CAMERA_HEIGHT, ballPos.z + CAMERA_DISTANCE);
        if (savedCameraRotation) {
            camera.rotation.copy(savedCameraRotation); // Restore original rotation
        }
        controls.update();

        console.log('Free cam mode OFF - Camera following ball');
    }
}

// Log current camera state (for cutscene recording)
export function logCameraState() {
    const pos = camera.position;
    const rot = camera.rotation;
    console.log(`Camera State:`);
    console.log(`  Position: new THREE.Vector3(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    console.log(`  Rotation: new THREE.Euler(${rot.x.toFixed(3)}, ${rot.y.toFixed(3)}, ${rot.z.toFixed(3)})`);
    console.log(`  Target: new THREE.Vector3(${controls.target.x.toFixed(2)}, ${controls.target.y.toFixed(2)}, ${controls.target.z.toFixed(2)})`);
}

/**
 * Restore camera to starting angle/position for the current level
 */
export function restoreStartingCameraAngle() {
    if (controls) {
        controls.target.copy(startingCameraTarget);
        camera.position.copy(startingCameraPosition);
        camera.lookAt(startingCameraTarget);
        controls.update();
    }
}

// Export for use in other modules
export { scene, camera, renderer, isFullMode };

// Export ghost AI control functions
export function getGhostAIEnabledState() {
    return ghostAIEnabled;
}

export function setGhostAIEnabledState(enabled) {
    ghostAIEnabled = enabled;
    setGhostAIEnabled(enabled);
}

export function getGhostAIDifficultyState() {
    return ghostAIDifficulty;
}

