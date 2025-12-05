// Power-up system
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';
import { createPowerUpParticles, updatePowerUpParticles } from './particles.js';

// Power-up types
export const POWERUP_TYPES = {
    SPEED_BOOST: 'SPEED_BOOST',
    SHARPSHOOTER: 'SHARPSHOOTER',
    MAGNETIC_PULL: 'MAGNETIC_PULL',
    REWIND: 'REWIND' // Undo last shot
};

let powerUps = []; // Array of active power-up meshes
let powerUpHitboxes = []; // Ground hitboxes for collection

// Shader for iridescent Saint Quartz effect
const iridescentShader = {
    uniforms: {
        time: { value: 0.0 },
        viewVector: { value: new THREE.Vector3() }
    },
    vertexShader: `
        uniform vec3 viewVector;
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying float vTime;
        
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            vTime = time;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying float vTime;
        
        void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDirection = normalize(vViewPosition);
            
            // Enhanced iridescent effect based on viewing angle
            float fresnel = pow(1.0 - dot(normal, viewDirection), 1.5);
            
            // More pronounced rainbow color based on angle and time
            // Use multiple frequencies for richer iridescence - MUCH faster color changes
            float hue1 = mod(dot(normal, viewDirection) * 1.5 + vTime * 1.5, 1.0);
            float hue2 = mod(dot(normal, viewDirection) * 1.2 + vTime * 1.2 + 0.3, 1.0);
            float hue3 = mod(dot(normal, viewDirection) * 0.9 + vTime * 0.9 + 0.6, 1.0);
            
            // Convert HSV to RGB for each hue
            vec3 color1, color2, color3;
            
            // First hue
            float h1 = hue1 * 6.0;
            int i1 = int(h1);
            float f1 = h1 - float(i1);
            float c1 = 1.0; // Full saturation for vibrant colors
            float v1 = 0.95 + fresnel * 0.05;
            float p1 = v1 * (1.0 - c1);
            float q1 = v1 * (1.0 - c1 * f1);
            float t1 = v1 * (1.0 - c1 * (1.0 - f1));
            if (i1 == 0) color1 = vec3(v1, t1, p1);
            else if (i1 == 1) color1 = vec3(q1, v1, p1);
            else if (i1 == 2) color1 = vec3(p1, v1, t1);
            else if (i1 == 3) color1 = vec3(p1, q1, v1);
            else if (i1 == 4) color1 = vec3(t1, p1, v1);
            else color1 = vec3(v1, p1, q1);
            
            // Second hue
            float h2 = hue2 * 6.0;
            int i2 = int(h2);
            float f2 = h2 - float(i2);
            float c2 = 0.9;
            float v2 = 0.9 + fresnel * 0.1;
            float p2 = v2 * (1.0 - c2);
            float q2 = v2 * (1.0 - c2 * f2);
            float t2 = v2 * (1.0 - c2 * (1.0 - f2));
            if (i2 == 0) color2 = vec3(v2, t2, p2);
            else if (i2 == 1) color2 = vec3(q2, v2, p2);
            else if (i2 == 2) color2 = vec3(p2, v2, t2);
            else if (i2 == 3) color2 = vec3(p2, q2, v2);
            else if (i2 == 4) color2 = vec3(t2, p2, v2);
            else color2 = vec3(v2, p2, q2);
            
            // Third hue
            float h3 = hue3 * 6.0;
            int i3 = int(h3);
            float f3 = h3 - float(i3);
            float c3 = 0.85;
            float v3 = 0.85 + fresnel * 0.15;
            float p3 = v3 * (1.0 - c3);
            float q3 = v3 * (1.0 - c3 * f3);
            float t3 = v3 * (1.0 - c3 * (1.0 - f3));
            if (i3 == 0) color3 = vec3(v3, t3, p3);
            else if (i3 == 1) color3 = vec3(q3, v3, p3);
            else if (i3 == 2) color3 = vec3(p3, v3, t3);
            else if (i3 == 3) color3 = vec3(p3, q3, v3);
            else if (i3 == 4) color3 = vec3(t3, p3, v3);
            else color3 = vec3(v3, p3, q3);
            
            // Blend the three colors for richer iridescence
            vec3 color = mix(color1, color2, 0.5);
            color = mix(color, color3, 0.33);
            
            // Enhanced glow effect - more intense
            float glow = fresnel * 1.2 + 0.6;
            color += vec3(glow * 0.5);
            
            // Boost saturation for more vibrant iridescence
            float maxComponent = max(max(color.r, color.g), color.b);
            if (maxComponent > 0.0) {
                color = color / maxComponent * (1.0 + fresnel * 0.2);
            }
            
            // Add time-based color shift for more dynamic effect - faster changes
            vec3 timeShift = vec3(
                sin(vTime * 1.0) * 0.15,
                sin(vTime * 1.0 + 2.094) * 0.15, // 120 degrees
                sin(vTime * 1.0 + 4.189) * 0.15  // 240 degrees
            );
            color += timeShift;
            
            // Ensure colors stay vibrant
            color = clamp(color, 0.0, 1.5);
            
            gl_FragColor = vec4(color, 0.95);
        }
    `
};

// Create a Saint Quartz-style crystal (star-shaped polyhedron)
function createSaintQuartzGeometry() {
    // Create a Stella Octangula (compound of two tetrahedra) - 8-pointed star
    // For simplicity, we'll use an OctahedronGeometry and modify it, or create custom geometry
    
    // Create an octahedron as base - make it bigger so it's more visible
    const geometry = new THREE.OctahedronGeometry(16.0, 0);
    
    // Scale vertices to create star points
    const positions = geometry.attributes.position;
    const newPositions = [];
    
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        const length = Math.sqrt(x * x + y * y + z * z);
        const normalized = new THREE.Vector3(x / length, y / length, z / length);
        
        // Extend points outward to create star shape
        const extended = normalized.multiplyScalar(0.7);
        newPositions.push(extended.x, extended.y, extended.z);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    geometry.computeVertexNormals();
    
    return geometry;
}

// Get color for powerup based on type (for prototype mode)
function getPowerUpColor(type) {
    switch (type) {
        case POWERUP_TYPES.SPEED_BOOST:
            return 0x00ffff; // Cyan/light blue
        case POWERUP_TYPES.SHARPSHOOTER:
            return 0xff00ff; // Magenta
        case POWERUP_TYPES.MAGNETIC_PULL:
            return 0xffff00; // Yellow
        case POWERUP_TYPES.REWIND:
            return 0x00ff00; // Green
        default:
            return 0xffffff; // White fallback
    }
}

export function createPowerUp(position, type = POWERUP_TYPES.SPEED_BOOST) {
    console.log('Creating power-up at position:', position, 'type:', type);
    
    // Create Saint Quartz-style crystal
    const geometry = createSaintQuartzGeometry();
    
    // Create material based on mode
    const material = isFullMode
        ? new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                viewVector: { value: new THREE.Vector3() }
            },
            vertexShader: iridescentShader.vertexShader,
            fragmentShader: iridescentShader.fragmentShader,
            transparent: true,
            side: THREE.DoubleSide
        })
        : new THREE.MeshBasicMaterial({
            color: getPowerUpColor(type),
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
    
    const powerUpMesh = new THREE.Mesh(geometry, material);
    powerUpMesh.position.set(position.x, position.y, position.z);
    powerUpMesh.scale.set(2.0, 2.0, 2.0); // Scale the entire mesh 2x larger
    powerUpMesh.userData.type = type;
    powerUpMesh.userData.originalY = position.y;
    powerUpMesh.userData.bobOffset = 0;
    powerUpMesh.userData.rotationSpeed = 0.02;
    
    // Create particle effects around power-up
    const particleSystem = createPowerUpParticles(position, type);
    powerUpMesh.userData.particleSystem = particleSystem;
    
    scene.add(powerUpMesh);
    powerUps.push(powerUpMesh);
    
    console.log('Power-up created and added to scene. Total power-ups:', powerUps.length);
    
    // Create ground hitbox (invisible cylinder)
    const hitboxRadius = 0.8;
    const hitboxHeight = 0.2;
    const hitboxGeometry = new THREE.CylinderGeometry(hitboxRadius, hitboxRadius, hitboxHeight, 16);
    const hitboxMaterial = new THREE.MeshBasicMaterial({ 
        visible: false, // Invisible
        transparent: true,
        opacity: 0
    });
    
    const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
    hitbox.position.set(position.x, 0.1, position.z); // Just above ground
    hitbox.userData.isPowerUpHitbox = true;
    hitbox.userData.powerUpType = type;
    hitbox.userData.powerUpMesh = powerUpMesh;
    
    scene.add(hitbox);
    powerUpHitboxes.push(hitbox);
    
    return { mesh: powerUpMesh, hitbox: hitbox };
}

export function updatePowerUps(camera) {
    if (!camera) return;
    
    // Update all power-ups
    powerUps.forEach(powerUp => {
        // Bob/hover animation
        powerUp.userData.bobOffset += 0.02;
        const bobAmount = Math.sin(powerUp.userData.bobOffset) * 0.15;
        powerUp.position.y = powerUp.userData.originalY + bobAmount;
        
        // Rotation animation
        powerUp.rotation.y += powerUp.userData.rotationSpeed;
        powerUp.rotation.x += powerUp.userData.rotationSpeed * 0.5;
        
        // Update shader uniforms for color-changing effect
        if (powerUp.material && powerUp.material.uniforms) {
            // Use elapsed time since page load for smooth animation
            powerUp.material.uniforms.time.value = performance.now() / 1000.0;
            
            // Update view vector for fresnel effect
            const viewDirection = new THREE.Vector3();
            viewDirection.subVectors(camera.position, powerUp.position).normalize();
            powerUp.material.uniforms.viewVector.value.copy(viewDirection);
        }
        
        // Update particle effects
        if (powerUp.userData.particleSystem) {
            updatePowerUpParticles(powerUp.userData.particleSystem, powerUp.position);
        }
    });
}

export function checkPowerUpCollection(ballPosition) {
    const BALL_RADIUS = 0.5;
    
    for (let i = powerUpHitboxes.length - 1; i >= 0; i--) {
        const hitbox = powerUpHitboxes[i];
        const distance = ballPosition.distanceTo(hitbox.position);
        
        // Check if ball is within hitbox radius
        if (distance < 0.8 + BALL_RADIUS) {
            // Collect power-up
            const powerUpType = hitbox.userData.powerUpType;
            const powerUpMesh = hitbox.userData.powerUpMesh;
            
            // Clean up particle system
            if (powerUpMesh.userData.particleSystem) {
                const particleSystem = powerUpMesh.userData.particleSystem;
                scene.remove(particleSystem);
                particleSystem.geometry?.dispose();
                particleSystem.material?.dispose();
            }
            
            // Remove from scene
            scene.remove(powerUpMesh);
            scene.remove(hitbox);
            
            // Dispose geometries and materials
            powerUpMesh.geometry?.dispose();
            powerUpMesh.material?.dispose();
            hitbox.geometry?.dispose();
            hitbox.material?.dispose();
            
            // Remove from arrays
            powerUps = powerUps.filter(p => p !== powerUpMesh);
            powerUpHitboxes = powerUpHitboxes.filter(h => h !== hitbox);
            
            return powerUpType;
        }
    }
    
    return null;
}

export function removeAllPowerUps() {
    powerUps.forEach(powerUp => {
        // Clean up particle system
        if (powerUp.userData.particleSystem) {
            const particleSystem = powerUp.userData.particleSystem;
            scene.remove(particleSystem);
            particleSystem.geometry?.dispose();
            particleSystem.material?.dispose();
        }
        
        scene.remove(powerUp);
        powerUp.geometry?.dispose();
        powerUp.material?.dispose();
    });
    
    powerUpHitboxes.forEach(hitbox => {
        scene.remove(hitbox);
        hitbox.geometry?.dispose();
        hitbox.material?.dispose();
    });
    
    powerUps = [];
    powerUpHitboxes = [];
}

