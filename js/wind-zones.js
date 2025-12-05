// Wind zones - invisible areas that push the ball in a direction
import * as THREE from 'three';
import { scene } from './main.js';

let windZones = [];
let windParticles = []; // Animated particles to show wind direction

/**
 * Create a wind zone
 * @param {Object} config - Wind zone configuration
 * @param {THREE.Vector3} config.position - Center position of the zone
 * @param {THREE.Vector3} config.size - Size of the zone (width, height, depth)
 * @param {THREE.Vector3} config.direction - Direction of wind push (normalized)
 * @param {number} config.strength - Strength of wind push force
 * @param {number} config.color - Color of wind particles (hex)
 */
export function createWindZone(config) {
    const {
        position = new THREE.Vector3(0, 0, 0),
        size = new THREE.Vector3(10, 10, 10),
        direction = new THREE.Vector3(1, 0, 0), // Default: push in +X direction
        strength = 5.0,
        color = 0x88ccff // Light blue for wind
    } = config;
    
    // Normalize direction
    const normalizedDir = direction.clone().normalize();
    
    // Create zone bounds
    const zone = {
        position: position.clone(),
        size: size.clone(),
        direction: normalizedDir,
        strength: strength,
        color: color,
        minX: position.x - size.x / 2,
        maxX: position.x + size.x / 2,
        minY: position.y - size.y / 2,
        maxY: position.y + size.y / 2,
        minZ: position.z - size.z / 2,
        maxZ: position.z + size.z / 2,
        particles: [],
        particleGroup: null
    };
    
    // Create visual indicator (animated particles)
    createWindParticles(zone);
    
    windZones.push(zone);
    
    console.log(`Wind zone created at (${position.x}, ${position.y}, ${position.z}) with direction (${normalizedDir.x.toFixed(2)}, ${normalizedDir.y.toFixed(2)}, ${normalizedDir.z.toFixed(2)})`);
    
    return zone;
}

/**
 * Create animated wind particles for visual indication
 */
function createWindParticles(zone) {
    const particleGroup = new THREE.Group();
    
    // Create particle streams (reduced density - half of previous)
    const numStreams = 25; // Reduced from 50 (half density)
    const particlesPerStream = 8; // Reduced from 15 (half density)
    
    // Calculate perpendicular vectors for swirling motion
    const dir = zone.direction.clone();
    let perp1 = new THREE.Vector3();
    let perp2 = new THREE.Vector3();
    
    // Find perpendicular vectors to wind direction
    if (Math.abs(dir.x) < 0.9) {
        perp1.set(1, 0, 0).cross(dir).normalize();
    } else {
        perp1.set(0, 1, 0).cross(dir).normalize();
    }
    perp2.crossVectors(dir, perp1).normalize();
    
    for (let s = 0; s < numStreams; s++) {
        // Random position within the zone
        const startX = zone.minX + Math.random() * zone.size.x;
        const startY = zone.minY + Math.random() * zone.size.y;
        const startZ = zone.minZ + Math.random() * zone.size.z;
        
        for (let p = 0; p < particlesPerStream; p++) {
            // Create thicker particles using multiple line segments
            const length = 1.0 + Math.random() * 1.5; // Longer particles
            const numSegments = 4; // Multiple segments for thicker appearance
            
            const points = [];
            for (let i = 0; i <= numSegments; i++) {
                const t = i / numSegments;
                points.push(new THREE.Vector3(
                    zone.direction.x * length * t,
                    zone.direction.y * length * t,
                    zone.direction.z * length * t
                ));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            // Use thicker line material
            const material = new THREE.LineBasicMaterial({
                color: zone.color,
                transparent: true,
                opacity: 0.5 + Math.random() * 0.4,
                linewidth: 3 // Request thicker lines (may not work on all systems)
            });
            
            const line = new THREE.Line(geometry, material);
            
            // Create additional parallel lines for thickness effect
            const thicknessLines = [];
            for (let t = 0; t < 2; t++) {
                const offset = (t - 0.5) * 0.15; // Small offset for thickness
                const thickPoints = points.map(pt => {
                    const offsetVec = new THREE.Vector3(
                        perp1.x * offset + perp2.x * offset * 0.5,
                        perp1.y * offset + perp2.y * offset * 0.5,
                        perp1.z * offset + perp2.z * offset * 0.5
                    );
                    return pt.clone().add(offsetVec);
                });
                const thickGeometry = new THREE.BufferGeometry().setFromPoints(thickPoints);
                const thickLine = new THREE.Line(thickGeometry, material.clone());
                thicknessLines.push(thickLine);
                particleGroup.add(thickLine);
            }
            
            // Offset position along wind direction
            const offset = (p / particlesPerStream) * Math.max(zone.size.x, zone.size.z);
            line.position.set(
                startX + zone.direction.x * offset,
                startY + zone.direction.y * offset,
                startZ + zone.direction.z * offset
            );
            
            thicknessLines.forEach(thickLine => {
                thickLine.position.copy(line.position);
            });
            
            // Store animation data with swirl parameters
            line.userData = {
                basePosition: line.position.clone(),
                speed: 5 + Math.random() * 6, // Faster movement
                offset: Math.random() * Math.PI * 2,
                streamIndex: s,
                particleIndex: p,
                maxTravel: Math.max(zone.size.x, zone.size.z),
                swirlRadius: 0.4 + Math.random() * 0.8, // Swirl radius
                swirlSpeed: 2.5 + Math.random() * 3.5, // Swirl speed
                swirlPhase: Math.random() * Math.PI * 2, // Initial swirl phase
                perp1: perp1.clone(),
                perp2: perp2.clone(),
                thicknessLines: thicknessLines // Store reference to thickness lines
            };
            
            particleGroup.add(line);
            zone.particles.push(line);
        }
    }
    
    // Removed wireframe boundary box - edges are now invisible
    
    zone.particleGroup = particleGroup;
    scene.add(particleGroup);
}

/**
 * Update wind zones (animate particles)
 * @param {number} deltaTime - Time since last frame
 */
export function updateWindZones(deltaTime) {
    const time = Date.now() / 1000;
    
    windZones.forEach(zone => {
        zone.particles.forEach(particle => {
            const data = particle.userData;
            
            // Calculate swirl motion (circular motion perpendicular to wind direction)
            const swirlAngle = time * data.swirlSpeed + data.swirlPhase;
            const swirlOffsetX = (Math.cos(swirlAngle) * data.perp1.x + Math.sin(swirlAngle) * data.perp2.x) * data.swirlRadius;
            const swirlOffsetY = (Math.cos(swirlAngle) * data.perp1.y + Math.sin(swirlAngle) * data.perp2.y) * data.swirlRadius;
            const swirlOffsetZ = (Math.cos(swirlAngle) * data.perp1.z + Math.sin(swirlAngle) * data.perp2.z) * data.swirlRadius;
            
            // Move particle in wind direction with swirl
            // Use modulo to create continuous looping motion
            const progress = (time * data.speed) % (data.maxTravel * 2);
            const baseX = data.basePosition.x + zone.direction.x * (progress - data.maxTravel);
            const baseY = data.basePosition.y + zone.direction.y * (progress - data.maxTravel);
            const baseZ = data.basePosition.z + zone.direction.z * (progress - data.maxTravel);
            
            particle.position.set(
                baseX + swirlOffsetX,
                baseY + swirlOffsetY,
                baseZ + swirlOffsetZ
            );
            
            // Update thickness lines position
            if (data.thicknessLines) {
                data.thicknessLines.forEach(thickLine => {
                    thickLine.position.copy(particle.position);
                });
            }
            
            // Check if particle is outside zone bounds and reset
            if (particle.position.x < zone.minX - 2 || particle.position.x > zone.maxX + 2 ||
                particle.position.y < zone.minY - 2 || particle.position.y > zone.maxY + 2 ||
                particle.position.z < zone.minZ - 2 || particle.position.z > zone.maxZ + 2) {
                // Reset to random position within zone
                data.basePosition.set(
                    zone.minX + Math.random() * zone.size.x,
                    zone.minY + Math.random() * zone.size.y,
                    zone.minZ + Math.random() * zone.size.z
                );
                particle.position.copy(data.basePosition);
                if (data.thicknessLines) {
                    data.thicknessLines.forEach(thickLine => {
                        thickLine.position.copy(data.basePosition);
                    });
                }
                data.swirlPhase = Math.random() * Math.PI * 2; // Reset swirl phase
            }
            
            // Pulse opacity for more dynamic effect
            const pulse = 0.5 + 0.4 * Math.sin(time * 4 + data.offset);
            particle.material.opacity = pulse;
            if (data.thicknessLines) {
                data.thicknessLines.forEach(thickLine => {
                    thickLine.material.opacity = pulse * 0.7; // Slightly more transparent
                });
            }
        });
    });
}

/**
 * Apply wind force to ball if it's inside any wind zone
 * @param {THREE.Vector3} ballPosition - Current ball position
 * @param {THREE.Vector3} ballVelocity - Current ball velocity (will be modified)
 * @param {number} deltaTime - Time since last frame
 * @returns {boolean} True if ball is in a wind zone
 */
export function applyWindForce(ballPosition, ballVelocity, deltaTime) {
    let inWindZone = false;
    
    windZones.forEach(zone => {
        // Check if ball is inside this zone
        if (ballPosition.x >= zone.minX && ballPosition.x <= zone.maxX &&
            ballPosition.y >= zone.minY && ballPosition.y <= zone.maxY &&
            ballPosition.z >= zone.minZ && ballPosition.z <= zone.maxZ) {
            
            // Apply wind force to velocity
            ballVelocity.x += zone.direction.x * zone.strength * deltaTime;
            ballVelocity.y += zone.direction.y * zone.strength * deltaTime;
            ballVelocity.z += zone.direction.z * zone.strength * deltaTime;
            
            inWindZone = true;
        }
    });
    
    return inWindZone;
}

/**
 * Remove all wind zones
 */
export function removeAllWindZones() {
    windZones.forEach(zone => {
        if (zone.particleGroup) {
            scene.remove(zone.particleGroup);
            zone.particleGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    });
    windZones = [];
    console.log('All wind zones removed');
}

/**
 * Get all wind zones
 */
export function getWindZones() {
    return windZones;
}

