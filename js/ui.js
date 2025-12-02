// Visual feedback UI (arrow, power meter)
import * as THREE from 'three';
import { getAimingState } from './controls.js';

// These will be set by initUI
let scene = null;
let camera = null;

let arrowTriangles = []; // Array of triangle meshes for the path
let powerMeterBar = null;
let powerMeterContainer = null;

export function initUI(sceneRef, cameraRef) {
    scene = sceneRef;
    camera = cameraRef;
    // Arrow will be created dynamically when aiming
    createPowerMeter();
}

function createPowerMeter() {
    // Create power meter container (2D overlay using CSS, or 3D object)
    // For now, we'll use a simple approach - power meter will be drawn in 2D overlay
    // We'll create a 3D arrow for the direction indicator
}

export function updateUI() {
    const aimingState = getAimingState();
    
    if (aimingState && aimingState.isAiming) {
        drawAimingArrow(aimingState);
        updatePowerMeter(aimingState.pullDistance);
    } else {
        hideAimingArrow();
        hidePowerMeter();
    }
}

function drawAimingArrow(aimingState) {
    const ballPos = aimingState.ballPosition;
    const direction = aimingState.direction;
    const pullDistance = aimingState.pullDistance;
    
    // Clear old triangles
    hideAimingArrow();
    
    // Arrow length based on pull distance
    const arrowLength = Math.max(2, pullDistance * 3);
    const triangleCount = Math.max(5, Math.floor(arrowLength * 2)); // More triangles for longer arrows
    const triangleSpacing = arrowLength / triangleCount;
    
    // Ball radius is 0.5, so 1.5x ball size = 0.75
    const BALL_RADIUS = 0.5;
    const MAX_TRIANGLE_SIZE = BALL_RADIUS * 1.5; // Furthest arrow (1.5x ball size)
    const MIN_TRIANGLE_SIZE = MAX_TRIANGLE_SIZE * 0.3; // Closest arrow (smaller)
    
    // White color for all arrows
    const arrowColor = 0xFFFFFF; // White
    const triangleMaterial = new THREE.MeshBasicMaterial({ 
        color: arrowColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
    });
    
    // Create flat triangles along the path
    for (let i = 0; i < triangleCount; i++) {
        const t = i / triangleCount; // 0 = closest to ball, 1 = furthest from ball
        const distanceAlongPath = t * arrowLength;
        
        // Calculate triangle size - furthest (t=1) is largest, closest (t=0) is smallest
        const triangleSize = MIN_TRIANGLE_SIZE + (MAX_TRIANGLE_SIZE - MIN_TRIANGLE_SIZE) * t;
        
        // Position along the path
        const trianglePos = new THREE.Vector3(
            ballPos.x + direction.x * distanceAlongPath,
            ballPos.y + 0.1, // Slightly above ground
            ballPos.z + direction.z * distanceAlongPath
        );
        
        // Create flat triangle (pointing in direction)
        // Create vertices for a flat triangle pointing forward
        const vertices = new Float32Array([
            0, 0, 0,                    // Tip of triangle (pointing forward)
            -triangleSize * 0.5, 0, triangleSize,  // Back left
            triangleSize * 0.5, 0, triangleSize    // Back right
        ]);
        
        const indices = new Uint16Array([0, 1, 2]);
        
        const triangleGeometry = new THREE.BufferGeometry();
        triangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        triangleGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
        triangleGeometry.computeVertexNormals();
        
        const triangle = new THREE.Mesh(triangleGeometry, triangleMaterial.clone());
        
        // Position triangle
        triangle.position.copy(trianglePos);
        
        // Rotate to point in direction (flip 180 degrees so triangle points forward, not backward)
        const dir = direction.clone().normalize();
        // Calculate angle in XZ plane and add 180 degrees to flip direction
        const angle = Math.atan2(dir.x, dir.z) + Math.PI;
        triangle.rotation.y = angle;
        
        // Scale opacity based on distance (fade out slightly)
        const opacity = 0.9 - t * 0.2; // Fade from 90% to 70%
        triangle.material.opacity = opacity;
        
        scene.add(triangle);
        arrowTriangles.push(triangle);
    }
}

function hideAimingArrow() {
    // Remove all triangle meshes
    arrowTriangles.forEach(triangle => {
        scene.remove(triangle);
        triangle.geometry.dispose();
        triangle.material.dispose();
    });
    arrowTriangles = [];
}

function getPowerColor(pullDistance) {
    const maxPull = 1.67; // MAX_PULL_DISTANCE (updated to match controls.js)
    const ratio = pullDistance / maxPull;
    
    if (ratio < 0.33) {
        // Green to yellow
        return new THREE.Color().lerpColors(
            new THREE.Color(0x00ff00), // Green
            new THREE.Color(0xffff00), // Yellow
            ratio * 3
        );
    } else if (ratio < 0.66) {
        // Yellow to orange
        return new THREE.Color().lerpColors(
            new THREE.Color(0xffff00), // Yellow
            new THREE.Color(0xff8800), // Orange
            (ratio - 0.33) * 3
        );
    } else {
        // Orange to red
        return new THREE.Color().lerpColors(
            new THREE.Color(0xff8800), // Orange
            new THREE.Color(0xff0000), // Red
            (ratio - 0.66) * 3
        );
    }
}

function updatePowerMeter(pullDistance) {
    const powerMeter = document.getElementById('power-meter');
    const powerMeterFill = document.getElementById('power-meter-fill');
    
    if (powerMeter && powerMeterFill) {
        const maxPull = 1.67; // MAX_PULL_DISTANCE (updated to match controls.js)
        const percentage = Math.min((pullDistance / maxPull) * 100, 100);
        powerMeterFill.style.width = percentage + '%';
        powerMeter.style.display = 'block';
    }
}

function hidePowerMeter() {
    const powerMeter = document.getElementById('power-meter');
    if (powerMeter) {
        powerMeter.style.display = 'none';
    }
}

