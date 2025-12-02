// Main game initialization and render loop
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initPhysics, updatePhysics } from './physics.js';
import { createCourse } from './course.js';
import { createBall, getBallPosition, resetBall, setBallPosition, setBallStartPosition, hideBall, showBall, getBallMesh } from './ball.js';
import { initControls, updateWobbleTime } from './controls.js';
import { initUI, updateUI } from './ui.js';
import { createHole, checkWinCondition, incrementStroke, getStrokeCount, getPar, calculateRating, resetHole, getTotalScore, addHoleScore, getHoleScores, getHolePosition, setHolePosition, resetTotalScore } from './game.js';
import { initHUD, updateHUD, showRating, showHoleCompleteScreen, hideHoleCompleteScreen, triggerRatingEffects, showRatingText, hideRatingText } from './hud.js';
import { loadCourse, nextCourse, getCurrentCourseIndex, getTotalCourses } from './courses.js';
import { updateHoleIndicator } from './hole-indicator.js';
import { updateAnimations, updateScreenShake } from './animations.js';
import { updateParticles } from './particles.js';
import { initMenu, hideMenu, showMenu } from './menu.js';

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
scene.background = new THREE.Color(0xdbe4e6); // Light gray sky/background

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

// Camera controls - will be updated to follow ball
let controls = null;

// Camera distance constants
const CAMERA_DISTANCE = 15;
const CAMERA_HEIGHT = 8;
let cameraFollowingBall = true; // Track if camera should follow ball
let currentHoleIn9HoleGame = 0; // Track current hole in 9-hole mode

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
let isFullMode = false;

// Mode toggle functionality
if (modeToggleButton) {
    modeToggleButton.addEventListener('click', () => {
        isFullMode = !isFullMode;
        modeToggleButton.textContent = isFullMode ? 'Full Mode' : 'Prototype Mode';
        // Mode switching logic will be implemented in Phase 9
        console.log('Mode switched to:', isFullMode ? 'Full' : 'Prototype');
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
    
    // Check win condition
    const winResult = checkWinCondition();
    if (winResult) {
        if (cameraFollowingBall) {
            // Stop following ball and center on hole immediately
            cameraFollowingBall = false;
            const holePos = getHolePosition();
            
            // Despawn ball when it goes through the hole
            hideBall();
            
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
    
    // Update camera
    if (cameraFollowingBall) {
        // Follow ball at constant distance
        const ballPos = getBallPosition();
        controls.target.set(ballPos.x, ballPos.y, ballPos.z);
        controls.update();
        
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
    
    // Render scene
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Listen for game start event
window.addEventListener('startGame', (event) => {
    const { mode, startHole } = event.detail;
    
    // Reset total score if starting new game
    if (mode === '9holes') {
        resetTotalScore();
        currentHoleIn9HoleGame = 0;
    }
    
    // Load the starting hole
    loadAndStartHole(startHole, mode);
});

async function loadAndStartHole(holeIndex, mode) {
    try {
        const courseDef = await loadCourse(holeIndex);
        if (courseDef) {
            setHolePosition(courseDef.definition.holePosition);
            setBallStartPosition(courseDef.definition.ballStartPosition);
            
            // Create ball if it doesn't exist
            if (!getBallMesh()) {
                createBall();
            }
            
            // Reset ball to start position
            resetBall();
            showBall();
            
            // Reset camera following
            cameraFollowingBall = true;
            controls.enabled = true;
            
            // Reset hole completion state
            resetHole();
            
            // Hide completion screen
            hideHoleCompleteScreen();
            
            // Create hole
            await createHole();
            
            console.log('Hole', holeIndex, 'loaded');
        }
    } catch (error) {
        console.error('Error loading course:', error);
    }
}

// Listen for next course event
window.addEventListener('nextCourse', () => {
    const currentIndex = getCurrentCourseIndex();
    const totalCourses = getTotalCourses();
    
    // Check if we're in 9-hole mode
    const is9HoleMode = currentHoleIn9HoleGame !== undefined;
    
    if (is9HoleMode && currentHoleIn9HoleGame + 1 < 9) {
        // Continue 9-hole game
        currentHoleIn9HoleGame++;
        loadAndStartHole(currentHoleIn9HoleGame, '9holes');
    } else if (currentIndex + 1 < totalCourses) {
        // Next hole in single mode
        const nextCourseData = nextCourse();
        if (nextCourseData) {
            loadAndStartHole(currentIndex + 1, 'single');
        }
    } else {
        // All holes complete - show menu
        showMenu();
    }
});

// Start render loop
animate(0);

// Export for use in other modules
export { scene, camera, renderer, isFullMode };

