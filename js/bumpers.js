// Bumper obstacle system
import * as THREE from 'three';
import { scene } from './main.js';

let bumpers = [];

export function createBumper(position, radius = 1.0, tubeRadius = 0.3) {
    const bumperGroup = new THREE.Group();
    bumperGroup.position.set(position.x, position.y, position.z);
    
    // Create donut-shaped bumper using TorusGeometry
    const bumperGeometry = new THREE.TorusGeometry(radius, tubeRadius, 16, 32);
    const bumperMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFFD700, // Gold color
        metalness: 0.5,
        roughness: 0.3,
        emissive: 0xFFD700,
        emissiveIntensity: 0.2
    });
    const bumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
    bumper.rotation.x = Math.PI / 2; // Rotate to be horizontal (parallel to ground)
    bumper.castShadow = true;
    bumper.receiveShadow = true;
    bumperGroup.add(bumper);
    
    // Store bumper data
    bumperGroup.userData.isBumper = true;
    bumperGroup.userData.radius = radius;
    bumperGroup.userData.tubeRadius = tubeRadius;
    bumperGroup.userData.position = position.clone();
    
    scene.add(bumperGroup);
    bumpers.push(bumperGroup);
    
    return bumperGroup;
}

export function getBumpers() {
    return bumpers;
}

export function removeAllBumpers() {
    bumpers.forEach(bumper => {
        scene.remove(bumper);
        // Dispose of geometries and materials
        bumper.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                child.material?.dispose();
            }
        });
    });
    bumpers = [];
}

export function checkBumperCollisions(ballPosition, ballRadius = 0.5) {
    for (const bumper of bumpers) {
        const bumperPos = bumper.position;
        const bumperRadius = bumper.userData.radius;
        const tubeRadius = bumper.userData.tubeRadius;
        
        // Calculate distance from ball center to bumper center (in XZ plane)
        const horizontalDist = Math.sqrt(
            Math.pow(ballPosition.x - bumperPos.x, 2) + 
            Math.pow(ballPosition.z - bumperPos.z, 2)
        );
        
        // Check if ball is at the right height (within tube radius vertically)
        const verticalDist = Math.abs(ballPosition.y - bumperPos.y);
        
        // Collision occurs if:
        // 1. Ball is within the donut's outer radius (bumperRadius + tubeRadius)
        // 2. Ball is outside the donut's inner radius (bumperRadius - tubeRadius)
        // 3. Ball is at the right height (within tubeRadius vertically)
        const outerRadius = bumperRadius + tubeRadius + ballRadius;
        const innerRadius = Math.max(0, bumperRadius - tubeRadius - ballRadius);
        
        if (horizontalDist <= outerRadius && 
            horizontalDist >= innerRadius &&
            verticalDist <= tubeRadius + ballRadius) {
            
            // Calculate collision normal (pointing from bumper center to ball)
            const normal = new THREE.Vector3(
                (ballPosition.x - bumperPos.x) / horizontalDist,
                0, // Donut is horizontal, so normal is horizontal
                (ballPosition.z - bumperPos.z) / horizontalDist
            );
            
            // Push ball out to the surface of the bumper
            const pushDistance = outerRadius + 0.01; // Small margin
            const correctedPos = new THREE.Vector3(
                bumperPos.x + normal.x * pushDistance,
                ballPosition.y, // Keep Y position
                bumperPos.z + normal.z * pushDistance
            );
            
            return {
                collided: true,
                bumper: bumper,
                correctedPos: correctedPos,
                normal: normal
            };
        }
    }
    
    return { collided: false };
}

