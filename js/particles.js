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

