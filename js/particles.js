// Particle system for visual effects
import * as THREE from 'three';
import { scene } from './main.js';

let particleSystems = [];

export function createParticleBurst(position, color, count = 50, speed = 2.0) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const lifetimes = new Float32Array(count);
    
    const particleColor = new THREE.Color(color);
    
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Random direction
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const radius = Math.random() * speed;
        
        velocities[i3] = Math.sin(phi) * Math.cos(theta) * radius;
        velocities[i3 + 1] = Math.cos(phi) * radius;
        velocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
        
        // Start at position
        positions[i3] = position.x;
        positions[i3 + 1] = position.y;
        positions[i3 + 2] = position.z;
        
        // Color
        colors[i3] = particleColor.r;
        colors[i3 + 1] = particleColor.g;
        colors[i3 + 2] = particleColor.b;
        
        // Size - 10x larger
        sizes[i] = Math.random() * 2.0 + 1.0; // Was 0.1-0.3, now 1.0-3.0
        
        // Lifetime - longer for bigger effect
        lifetimes[i] = Math.random() * 1.0 + 1.0; // 1.0 to 2.0 seconds (longer)
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
        size: 2.0, // 10x larger (was 0.2)
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.userData.velocities = velocities;
    particles.userData.lifetimes = lifetimes;
    particles.userData.startTime = Date.now();
    particles.userData.startPositions = positions.slice();
    
    scene.add(particles);
    particleSystems.push(particles);
    
    return particles;
}

export function createFireworks(position, count = 3) {
    // Create multiple bursts for fireworks effect - 10x more intense
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 4, // Larger spread
                Math.random() * 4,
                (Math.random() - 0.5) * 4
            );
            createParticleBurst(
                position.clone().add(offset),
                0xFFD700, // Gold
                300, // 10x more particles (was 30)
                10.0 // 10x faster/more spread (was 3.0)
            );
        }, i * 100);
    }
}

export function createSparkles(position, count = 30) {
    return createParticleBurst(position, 0xC0C0C0, count * 10, 5.0); // 10x more particles and speed (was count, 1.5)
}

export function createGoldBurst(position, count = 50) {
    return createParticleBurst(position, 0xFFD700, count * 10, 8.0); // 10x more particles and speed (was count, 2.5)
}

// Ball trail system
let ballTrailParticles = null;
let ballTrailPositions = [];
const MAX_TRAIL_POINTS = 60; // Increased for longer, smoother trail
const TRAIL_SPACING = 0.1; // Very small spacing for continuous trail

export function createBallTrail() {
    if (ballTrailParticles) return; // Already exists
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_TRAIL_POINTS * 3);
    const colors = new Float32Array(MAX_TRAIL_POINTS * 3);
    const sizes = new Float32Array(MAX_TRAIL_POINTS);
    
    // Initialize all positions off-screen
    for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
        const i3 = i * 3;
        positions[i3] = -1000;
        positions[i3 + 1] = -1000;
        positions[i3 + 2] = -1000;
        colors[i3] = 1.0;
        colors[i3 + 1] = 1.0;
        colors[i3 + 2] = 1.0;
        sizes[i] = 0.3;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    
    ballTrailParticles = new THREE.Points(geometry, material);
    scene.add(ballTrailParticles);
}

export function updateBallTrail(ballPosition, ballVelocity) {
    if (!ballTrailParticles) createBallTrail();
    
    const speed = ballVelocity.length();
    
    // Always add trail point when ball is moving - use very small threshold for smooth continuous trail
    const lastPoint = ballTrailPositions[ballTrailPositions.length - 1];
    
    // Very small threshold ensures continuous trail without gaps
    const distanceThreshold = TRAIL_SPACING * 0.1; // Much smaller threshold
    
    // Add point if no last point exists, or if moved enough (very small distance)
    if (!lastPoint || ballPosition.distanceTo(lastPoint) > distanceThreshold) {
        ballTrailPositions.push(ballPosition.clone());
        
        // Keep only recent points
        if (ballTrailPositions.length > MAX_TRAIL_POINTS) {
            ballTrailPositions.shift();
        }
    }
    
    // If ball stopped, gradually fade out trail but keep it visible
    if (speed < 0.1) {
        // Don't clear immediately - let it fade naturally over time
        // Remove one point per frame when stopped (slowly)
        if (ballTrailPositions.length > 0 && Math.random() < 0.1) {
            ballTrailPositions.shift();
        }
    }
    
    // Update particle positions
    const positions = ballTrailParticles.geometry.attributes.position.array;
    const colors = ballTrailParticles.geometry.attributes.color.array;
    const sizes = ballTrailParticles.geometry.attributes.size.array;
    
    // Color based on speed (blue = slow, red = fast)
    const maxSpeed = 150.0;
    const speedRatio = Math.min(speed / maxSpeed, 1.0);
    const trailColor = new THREE.Color();
    trailColor.setHSL(0.6 - speedRatio * 0.6, 1.0, 0.5); // Blue to red
    
    for (let i = 0; i < ballTrailPositions.length; i++) {
        const i3 = i * 3;
        const point = ballTrailPositions[i];
        positions[i3] = point.x;
        positions[i3 + 1] = point.y + 0.1; // Slightly above ground
        positions[i3 + 2] = point.z;
        
        // Smooth fade from newest (brightest) to oldest (faintest)
        // Use smooth curve for better visual continuity
        const normalizedIndex = i / Math.max(ballTrailPositions.length - 1, 1);
        const fade = Math.pow(1.0 - normalizedIndex, 0.5); // Smooth fade curve
        const minFade = 0.3; // Higher minimum fade to prevent flashing
        const adjustedFade = minFade + fade * (1.0 - minFade);
        
        colors[i3] = trailColor.r * adjustedFade;
        colors[i3 + 1] = trailColor.g * adjustedFade;
        colors[i3 + 2] = trailColor.b * adjustedFade;
        sizes[i] = 0.3 * adjustedFade;
    }
    
    // Clear unused positions
    for (let i = ballTrailPositions.length; i < MAX_TRAIL_POINTS; i++) {
        const i3 = i * 3;
        positions[i3] = -1000;
        positions[i3 + 1] = -1000;
        positions[i3 + 2] = -1000;
    }
    
    ballTrailParticles.geometry.attributes.position.needsUpdate = true;
    ballTrailParticles.geometry.attributes.color.needsUpdate = true;
    ballTrailParticles.geometry.attributes.size.needsUpdate = true;
}

// Impact effects for wall collisions
export function createImpactEffect(position, normal, intensity = 1.0) {
    // Create spark particles in direction of collision normal
    const sparkColor = 0xFFFFAA; // Yellow-white sparks
    const sparkCount = Math.floor(20 * intensity);
    
    // Create particles that shoot out along the normal
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(sparkCount * 3);
    const velocities = new Float32Array(sparkCount * 3);
    const colors = new Float32Array(sparkCount * 3);
    const lifetimes = new Float32Array(sparkCount);
    
    const sparkColorObj = new THREE.Color(sparkColor);
    
    for (let i = 0; i < sparkCount; i++) {
        const i3 = i * 3;
        
        // Random direction around the normal
        const randomDir = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize();
        
        const direction = normal.clone().add(randomDir.multiplyScalar(0.5)).normalize();
        const speed = (Math.random() * 3.0 + 2.0) * intensity;
        
        velocities[i3] = direction.x * speed;
        velocities[i3 + 1] = direction.y * speed;
        velocities[i3 + 2] = direction.z * speed;
        
        positions[i3] = position.x;
        positions[i3 + 1] = position.y;
        positions[i3 + 2] = position.z;
        
        colors[i3] = sparkColorObj.r;
        colors[i3 + 1] = sparkColorObj.g;
        colors[i3 + 2] = sparkColorObj.b;
        
        lifetimes[i] = Math.random() * 0.3 + 0.2; // Short-lived sparks
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.userData.velocities = velocities;
    particles.userData.lifetimes = lifetimes;
    particles.userData.startTime = Date.now();
    
    scene.add(particles);
    particleSystems.push(particles);
    
    return particles;
}

export function updateParticles() {
    const currentTime = Date.now();
    
    particleSystems = particleSystems.filter(particles => {
        const elapsed = (currentTime - particles.userData.startTime) / 1000; // Convert to seconds
        const positions = particles.geometry.attributes.position.array;
        const velocities = particles.userData.velocities;
        const lifetimes = particles.userData.lifetimes;
        
        let allDead = true;
        
        for (let i = 0; i < lifetimes.length; i++) {
            const lifetime = lifetimes[i];
            const age = elapsed;
            
            if (age < lifetime) {
                allDead = false;
                const i3 = i * 3;
                
                // Update position
                const deltaTime = 0.016; // Approximate frame time
                positions[i3] += velocities[i3] * deltaTime;
                positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
                positions[i3 + 2] += velocities[i3 + 2] * deltaTime;
                
                // Apply gravity
                velocities[i3 + 1] -= 9.8 * deltaTime * 0.1; // Gravity
                
                // Fade out
                const fadeProgress = age / lifetime;
                particles.material.opacity = 1 - fadeProgress;
            } else {
                // Particle is dead, hide it
                const i3 = i * 3;
                positions[i3] = -1000; // Move off screen
                positions[i3 + 1] = -1000;
                positions[i3 + 2] = -1000;
            }
        }
        
        particles.geometry.attributes.position.needsUpdate = true;
        
        if (allDead) {
            scene.remove(particles);
            particles.geometry.dispose();
            particles.material.dispose();
            return false; // Remove from systems
        }
        
        return true; // Keep in systems
    });
}

// Environmental particles - ambient floating particles
let environmentalParticles = null;
const ENV_PARTICLE_COUNT = 50;

export function createEnvironmentalParticles() {
    if (environmentalParticles) return; // Already exists
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(ENV_PARTICLE_COUNT * 3);
    const velocities = new Float32Array(ENV_PARTICLE_COUNT * 3);
    const colors = new Float32Array(ENV_PARTICLE_COUNT * 3);
    const sizes = new Float32Array(ENV_PARTICLE_COUNT);
    
    // Default spawn area (will work with any course size)
    const centerX = 0;
    const centerZ = 0;
    const spreadX = 100;
    const spreadZ = 100;
    
    for (let i = 0; i < ENV_PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        
        // Random position in course area, floating above ground
        positions[i3] = centerX + (Math.random() - 0.5) * spreadX;
        positions[i3 + 1] = Math.random() * 5.0 + 2.0; // 2-7 units above ground
        positions[i3 + 2] = centerZ + (Math.random() - 0.5) * spreadZ;
        
        // Slow random velocity (drifting)
        velocities[i3] = (Math.random() - 0.5) * 0.5;
        velocities[i3 + 1] = Math.random() * 0.3 + 0.1; // Slow upward drift
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.5;
        
        // Dust mote colors (light gray/brown)
        const dustColor = new THREE.Color();
        dustColor.setHSL(0.1, 0.1, 0.6 + Math.random() * 0.2);
        colors[i3] = dustColor.r;
        colors[i3 + 1] = dustColor.g;
        colors[i3 + 2] = dustColor.b;
        
        sizes[i] = Math.random() * 0.1 + 0.05; // Small particles
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true
    });
    
    environmentalParticles = new THREE.Points(geometry, material);
    environmentalParticles.userData.velocities = velocities;
    scene.add(environmentalParticles);
}

// Power-up particle effects - continuous particles around power-ups
let powerUpParticleSystems = [];

export function createPowerUpParticles(position, type) {
    const PARTICLE_COUNT = 30;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const lifetimes = new Float32Array(PARTICLE_COUNT);
    const startTimes = new Float32Array(PARTICLE_COUNT);
    
    // Color based on power-up type
    let baseColor;
    switch(type) {
        case 'SPEED_BOOST':
            baseColor = new THREE.Color(0xFF4444); // Red
            break;
        case 'SHARPSHOOTER':
            baseColor = new THREE.Color(0x4444FF); // Blue
            break;
        case 'MAGNETIC_PULL':
            baseColor = new THREE.Color(0xFF44FF); // Magenta
            break;
        case 'REWIND':
            baseColor = new THREE.Color(0x44FF44); // Green
            break;
        default:
            baseColor = new THREE.Color(0xFFFFFF); // White
    }
    
    const time = Date.now() / 1000;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        
        // Create particles in a sphere around the power-up
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const radius = Math.random() * 2.0 + 1.5; // 1.5 to 3.5 units from center
        
        // Position particles in a sphere around power-up
        positions[i3] = position.x + Math.sin(phi) * Math.cos(theta) * radius;
        positions[i3 + 1] = position.y + Math.cos(phi) * radius;
        positions[i3 + 2] = position.z + Math.sin(phi) * Math.sin(theta) * radius;
        
        // Velocity - slow drift outward and upward
        velocities[i3] = Math.sin(phi) * Math.cos(theta) * 0.3;
        velocities[i3 + 1] = Math.cos(phi) * 0.5 + 0.3; // Upward drift
        velocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * 0.3;
        
        // Color with slight variation
        const colorVariation = 0.3;
        colors[i3] = baseColor.r + (Math.random() - 0.5) * colorVariation;
        colors[i3 + 1] = baseColor.g + (Math.random() - 0.5) * colorVariation;
        colors[i3 + 2] = baseColor.b + (Math.random() - 0.5) * colorVariation;
        
        sizes[i] = Math.random() * 0.3 + 0.2;
        lifetimes[i] = Math.random() * 2.0 + 2.0; // 2-4 seconds
        startTimes[i] = time - Math.random() * 2.0; // Stagger start times
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.userData.velocities = velocities;
    particles.userData.lifetimes = lifetimes;
    particles.userData.startTimes = startTimes;
    particles.userData.basePosition = position.clone();
    particles.userData.type = type;
    
    scene.add(particles);
    powerUpParticleSystems.push(particles);
    
    return particles;
}

export function updatePowerUpParticles(particleSystem, powerUpPosition) {
    const time = Date.now() / 1000;
    const positions = particleSystem.geometry.attributes.position.array;
    const velocities = particleSystem.userData.velocities;
    const lifetimes = particleSystem.userData.lifetimes;
    const startTimes = particleSystem.userData.startTimes;
    const basePosition = particleSystem.userData.basePosition;
    
    const deltaTime = 0.016; // Approximate frame time
    
    for (let i = 0; i < lifetimes.length; i++) {
        const i3 = i * 3;
        const age = time - startTimes[i];
        const lifetime = lifetimes[i];
        
        if (age >= lifetime) {
            // Reset particle - respawn it around power-up
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const radius = Math.random() * 2.0 + 1.5;
            
            positions[i3] = powerUpPosition.x + Math.sin(phi) * Math.cos(theta) * radius;
            positions[i3 + 1] = powerUpPosition.y + Math.cos(phi) * radius;
            positions[i3 + 2] = powerUpPosition.z + Math.sin(phi) * Math.sin(theta) * radius;
            
            velocities[i3] = Math.sin(phi) * Math.cos(theta) * 0.3;
            velocities[i3 + 1] = Math.cos(phi) * 0.5 + 0.3;
            velocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * 0.3;
            
            startTimes[i] = time;
        } else {
            // Update position relative to power-up
            positions[i3] += velocities[i3] * deltaTime;
            positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
            positions[i3 + 2] += velocities[i3 + 2] * deltaTime;
            
            // Apply slight gravity
            velocities[i3 + 1] -= 2.0 * deltaTime;
            
            // Fade out as particle ages
            const fadeProgress = age / lifetime;
            particleSystem.material.opacity = 0.8 * (1.0 - fadeProgress * 0.5);
        }
    }
    
    particleSystem.geometry.attributes.position.needsUpdate = true;
}

export function updateEnvironmentalParticles() {
    if (!environmentalParticles) {
        createEnvironmentalParticles();
        return;
    }
    
    const positions = environmentalParticles.geometry.attributes.position.array;
    const velocities = environmentalParticles.userData.velocities;
    
    // Default bounds (will work with any course size)
    const centerX = 0;
    const centerZ = 0;
    const spreadX = 100;
    const spreadZ = 100;
    
    for (let i = 0; i < ENV_PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        
        // Update position
        positions[i3] += velocities[i3] * 0.01;
        positions[i3 + 1] += velocities[i3 + 1] * 0.01;
        positions[i3 + 2] += velocities[i3 + 2] * 0.01;
        
        // Wrap around if out of bounds
        if (positions[i3] < centerX - spreadX / 2) positions[i3] = centerX + spreadX / 2;
        if (positions[i3] > centerX + spreadX / 2) positions[i3] = centerX - spreadX / 2;
        if (positions[i3 + 2] < centerZ - spreadZ / 2) positions[i3 + 2] = centerZ + spreadZ / 2;
        if (positions[i3 + 2] > centerZ + spreadZ / 2) positions[i3 + 2] = centerZ - spreadZ / 2;
        
        // Reset height if too high or too low
        if (positions[i3 + 1] > 10) positions[i3 + 1] = 2;
        if (positions[i3 + 1] < 0) positions[i3 + 1] = 2;
    }
    
    environmentalParticles.geometry.attributes.position.needsUpdate = true;
}

