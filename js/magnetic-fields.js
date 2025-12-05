// Static magnetic field system
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';

let magneticFields = [];

export function createMagneticField(config) {
    const {
        position,              // THREE.Vector3 position
        strength = 0.5,        // Pull force strength
        range = 8.0,           // Range in units where pull is active
        color = 0x00ffff       // Field color (cyan by default)
    } = config;

    const fieldGroup = new THREE.Group();
    fieldGroup.position.set(position.x, 0.01, position.z); // Slightly above ground
    
    // Create visual indicator (circular ring) - made more visible
    const ringGeometry = new THREE.RingGeometry(range * 0.6, range, 64);
    const ringMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.7,  // Increased from 0.3 to 0.7 for better visibility
            side: THREE.DoubleSide,
            emissive: color,
            emissiveIntensity: 0.6  // Increased from 0.2 to 0.6 for better visibility
        })
        : new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.7,  // Increased from 0.3 to 0.7
            side: THREE.DoubleSide
        });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2; // Lay flat on ground
    ring.receiveShadow = false;
    fieldGroup.add(ring);
    
    // Create inner ring for better visibility
    const innerRingGeometry = new THREE.RingGeometry(range * 0.3, range * 0.5, 64);
    const innerRingMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            emissive: color,
            emissiveIntensity: 0.4
        })
        : new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.rotation.x = -Math.PI / 2;
    fieldGroup.add(innerRing);
    
    // Create safe zone indicator (where ball can rest and launch)
    const SAFE_ZONE_RADIUS = 1.5;
    const safeZoneGeometry = new THREE.CircleGeometry(SAFE_ZONE_RADIUS, 32);
    const safeZoneMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,  // Subtle indicator
            side: THREE.DoubleSide,
            emissive: color,
            emissiveIntensity: 0.1
        })
        : new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
    const safeZone = new THREE.Mesh(safeZoneGeometry, safeZoneMaterial);
    safeZone.rotation.x = -Math.PI / 2;
    safeZone.position.y = 0.005; // Slightly above ground
    fieldGroup.add(safeZone);
    
    // Create center indicator - made larger and more visible
    const centerGeometry = new THREE.CircleGeometry(range * 0.15, 16);  // Increased from 0.1 to 0.15
    const centerMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1.0  // Increased from 0.5 to 1.0 for better visibility
        })
        : new THREE.MeshBasicMaterial({ 
            color: color,
            opacity: 0.9  // Added opacity for better visibility
        });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.rotation.x = -Math.PI / 2;
    fieldGroup.add(center);
    
    // Store field data and animation references
    fieldGroup.userData.isMagneticField = true;
    fieldGroup.userData.position = position.clone();
    fieldGroup.userData.strength = strength;
    fieldGroup.userData.range = range;
    fieldGroup.userData.color = color;
    fieldGroup.userData.ring = ring;
    fieldGroup.userData.innerRing = innerRing;
    fieldGroup.userData.center = center;
    fieldGroup.userData.startTime = Date.now() / 1000; // Animation start time
    
    scene.add(fieldGroup);
    magneticFields.push(fieldGroup);
    
    return fieldGroup;
}

export function getMagneticFields() {
    return magneticFields;
}

export function removeAllMagneticFields() {
    magneticFields.forEach(field => {
        // Clean up pulse rings
        if (field.userData.pulseRings) {
            field.userData.pulseRings.forEach(pulseRing => {
                scene.remove(pulseRing.mesh);
                pulseRing.mesh.geometry?.dispose();
                pulseRing.mesh.material?.dispose();
            });
        }
        
        scene.remove(field);
        // Dispose of geometries and materials
        field.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
    });
    magneticFields = [];
}

export function checkMagneticFieldPull(ballPosition, deltaTime) {
    // Returns the total pull force from all magnetic fields
    const totalPullForce = new THREE.Vector3(0, 0, 0);
    const SAFE_ZONE_RADIUS = 1.5; // Safe zone in center where pull doesn't apply (allows ball to rest and launch)
    
    for (const field of magneticFields) {
        const fieldPos = field.userData.position;
        const directionToField = new THREE.Vector3(
            fieldPos.x - ballPosition.x,
            0, // Only horizontal pull
            fieldPos.z - ballPosition.z
        );
        const distanceToField = directionToField.length();
        
        // Skip if ball is in safe zone (center) - allows ball to rest and launch
        if (distanceToField < SAFE_ZONE_RADIUS) {
            continue;
        }
        
        // Apply pull if within range (but outside safe zone)
        if (distanceToField > 0 && distanceToField < field.userData.range) {
            // Normalize direction
            directionToField.normalize();
            
            // Calculate pull strength (stronger when closer, but account for safe zone)
            // Adjust distance calculation to account for safe zone
            const effectiveDistance = distanceToField - SAFE_ZONE_RADIUS;
            const effectiveRange = field.userData.range - SAFE_ZONE_RADIUS;
            const normalizedDistance = Math.max(0, effectiveDistance / effectiveRange); // 0 to 1
            const pullStrength = field.userData.strength * (1.0 - normalizedDistance * 0.5); // Stronger when closer
            
            // Calculate pull force
            const pullForce = directionToField.multiplyScalar(pullStrength * deltaTime * 60); // Scale by deltaTime and 60 for consistent force
            totalPullForce.add(pullForce);
        }
    }
    
    return totalPullForce;
}

export function updateMagneticFields(deltaTime) {
    // Animate all magnetic fields with pulsing effects
    const time = Date.now() / 1000;
    
    for (const field of magneticFields) {
        const ring = field.userData.ring;
        const innerRing = field.userData.innerRing;
        const center = field.userData.center;
        const range = field.userData.range;
        const startTime = field.userData.startTime;
        
        if (!ring || !innerRing || !center) continue;
        
        // Create pulsing rings that expand outward (similar to magnetic pull indicator)
        const cycleDuration = 2.5; // 2.5 seconds per pulse cycle
        const elapsed = time - startTime;
        const cycleTime = elapsed % cycleDuration;
        const progress = cycleTime / cycleDuration; // 0 to 1
        
        // Pulse the outer ring - scale and opacity animation
        const pulseScale = 0.8 + 0.2 * Math.sin(progress * Math.PI * 2); // Scale between 0.8 and 1.0
        const pulseOpacity = 0.5 + 0.3 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2)); // Opacity between 0.5 and 0.8
        
        ring.scale.set(pulseScale, pulseScale, 1.0);
        if (ring.material) {
            ring.material.opacity = pulseOpacity;
            if (ring.material.emissiveIntensity !== undefined) {
                ring.material.emissiveIntensity = 0.4 + 0.3 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2));
            }
        }
        
        // Pulse the inner ring with offset phase
        const innerProgress = (cycleTime + cycleDuration * 0.3) % cycleDuration / cycleDuration;
        const innerPulseScale = 0.85 + 0.15 * Math.sin(innerProgress * Math.PI * 2);
        const innerPulseOpacity = 0.4 + 0.2 * (0.5 + 0.5 * Math.sin(innerProgress * Math.PI * 2));
        
        innerRing.scale.set(innerPulseScale, innerPulseScale, 1.0);
        if (innerRing.material) {
            innerRing.material.opacity = innerPulseOpacity;
            if (innerRing.material.emissiveIntensity !== undefined) {
                innerRing.material.emissiveIntensity = 0.3 + 0.2 * (0.5 + 0.5 * Math.sin(innerProgress * Math.PI * 2));
            }
        }
        
        // Pulse the center indicator
        const centerProgress = (cycleTime + cycleDuration * 0.6) % cycleDuration / cycleDuration;
        const centerPulseScale = 0.9 + 0.1 * Math.sin(centerProgress * Math.PI * 2);
        const centerPulseIntensity = 0.8 + 0.4 * (0.5 + 0.5 * Math.sin(centerProgress * Math.PI * 2));
        
        center.scale.set(centerPulseScale, centerPulseScale, 1.0);
        if (center.material && center.material.emissiveIntensity !== undefined) {
            center.material.emissiveIntensity = centerPulseIntensity;
        }
        
        // Add expanding pulse rings (like the magnetic pull indicator)
        // Create temporary expanding rings that fade out
        if (Math.floor(cycleTime * 2) !== field.userData.lastPulseRing) {
            field.userData.lastPulseRing = Math.floor(cycleTime * 2);
            createExpandingPulseRing(field, range);
        }
        
        // Update existing pulse rings
        if (field.userData.pulseRings) {
            field.userData.pulseRings = field.userData.pulseRings.filter(pulseRing => {
                const age = time - pulseRing.startTime;
                const lifetime = 1.5; // Ring lifetime
                
                if (age > lifetime) {
                    scene.remove(pulseRing.mesh);
                    pulseRing.mesh.geometry?.dispose();
                    pulseRing.mesh.material?.dispose();
                    return false;
                }
                
                const scale = age / lifetime; // Scale from 0 to 1
                const opacity = 1.0 - scale; // Fade out
                
                pulseRing.mesh.scale.set(scale, scale, 1.0);
                if (pulseRing.mesh.material) {
                    pulseRing.mesh.material.opacity = opacity * 0.6;
                }
                
                return true;
            });
        }
    }
}

function createExpandingPulseRing(field, range) {
    // Create a new expanding ring that pulses outward
    const ringThickness = range * 0.15;
    const pulseRingGeometry = new THREE.RingGeometry(range * 0.1, range * 0.1 + ringThickness, 64);
    const pulseRingMaterial = new THREE.MeshBasicMaterial({
        color: field.userData.color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    
    const pulseRing = new THREE.Mesh(pulseRingGeometry, pulseRingMaterial);
    pulseRing.rotation.x = -Math.PI / 2;
    const fieldPos = field.userData.position;
    pulseRing.position.set(fieldPos.x, 0.02, fieldPos.z);
    
    scene.add(pulseRing);
    
    if (!field.userData.pulseRings) {
        field.userData.pulseRings = [];
    }
    
    field.userData.pulseRings.push({
        mesh: pulseRing,
        startTime: Date.now() / 1000
    });
}

