// Windmill obstacle system
import * as THREE from 'three';
import { scene } from './main.js';

let windmills = [];

export function createWindmill(position, radius = 3.0, numBlades = 4, rotationSpeed = 1.0) {
    const windmillGroup = new THREE.Group();
    windmillGroup.position.set(position.x, position.y, position.z);
    
    // Create central pole
    const poleHeight = 3.0;
    const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, poleHeight, 16);
    const poleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513, // Brown
        metalness: 0.3,
        roughness: 0.7
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = poleHeight / 2;
    pole.castShadow = true;
    pole.receiveShadow = true;
    windmillGroup.add(pole);
    
    // Create rotating blades group (vertical blades perpendicular to ground)
    const bladesGroup = new THREE.Group();
    const bladesGroupHeight = 1.5; // Height above ground for the blade group
    bladesGroup.position.y = bladesGroupHeight;
    
    // Create blades (vertical blades perpendicular to ground, like traditional windmill)
    const bladeThickness = 0.1; // Thin in the blade's thickness direction
    const bladeLength = radius; // Length of blade extending outward
    const bladeHeight = radius * 0.3; // Height of blade (vertical dimension)
    // Geometry: length (X), height (Y), thickness (Z) - rotated 90 degrees around X axis
    const bladeGeometry = new THREE.BoxGeometry(bladeLength, bladeHeight, bladeThickness);
    const bladeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFFFFFF, // White
        metalness: 0.1,
        roughness: 0.8
    });
    
    const blades = [];
    for (let i = 0; i < numBlades; i++) {
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        const angle = (i / numBlades) * Math.PI * 2;
        // Position blade extending outward from center
        blade.position.x = Math.cos(angle) * (bladeLength / 2);
        blade.position.z = Math.sin(angle) * (bladeLength / 2);
        blade.position.y = 0; // Center vertically
        blade.rotation.y = angle; // Rotate blade to point outward
        blade.rotation.x = Math.PI / 2; // Rotate 90 degrees so blade is vertical (perpendicular to ground)
        blade.castShadow = true;
        blade.receiveShadow = true;
        bladesGroup.add(blade);
        blades.push(blade);
    }
    
    windmillGroup.add(bladesGroup);
    
    // Store windmill data
    windmillGroup.userData.isWindmill = true;
    windmillGroup.userData.bladesGroup = bladesGroup;
    windmillGroup.userData.rotationSpeed = rotationSpeed;
    windmillGroup.userData.radius = radius;
    windmillGroup.userData.blades = blades;
    windmillGroup.userData.position = position.clone();
    
    scene.add(windmillGroup);
    windmills.push(windmillGroup);
    
    return windmillGroup;
}

export function updateWindmills(deltaTime) {
    windmills.forEach(windmill => {
        if (windmill.userData.bladesGroup) {
            windmill.userData.bladesGroup.rotation.y += windmill.userData.rotationSpeed * deltaTime;
        }
    });
}

export function getWindmills() {
    return windmills;
}

export function removeAllWindmills() {
    windmills.forEach(windmill => {
        scene.remove(windmill);
        // Dispose of geometries and materials
        windmill.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                child.material?.dispose();
            }
        });
    });
    windmills = [];
}

export function checkWindmillCollisions(ballPosition, ballRadius = 0.5) {
    for (const windmill of windmills) {
        const bladesGroup = windmill.userData.bladesGroup;
        if (!bladesGroup) continue;
        
        const windmillPos = windmill.position;
        const blades = windmill.userData.blades || [];
        
        // Check collision with each blade
        for (const blade of blades) {
            // Get blade's world position and rotation
            const bladeWorldPos = new THREE.Vector3();
            blade.getWorldPosition(bladeWorldPos);
            
            const bladeWorldQuat = new THREE.Quaternion();
            blade.getWorldQuaternion(bladeWorldQuat);
            const bladeWorldRot = new THREE.Euler();
            bladeWorldRot.setFromQuaternion(bladeWorldQuat);
            
            // Blade is a vertical box: length=radius (X), height=radius*0.3 (Y), thickness=0.1 (Z)
            // But rotated 90 degrees around X axis, so in world space:
            // - X stays X (length)
            // - Y becomes Z (height becomes depth)
            // - Z becomes -Y (thickness becomes vertical)
            // Transform ball position to blade's local space
            const relativePos = ballPosition.clone().sub(bladeWorldPos);
            
            // Rotate to blade's local space (Y rotation for outward direction, X rotation for vertical orientation)
            const cosRotY = Math.cos(-bladeWorldRot.y);
            const sinRotY = Math.sin(-bladeWorldRot.y);
            const cosRotX = Math.cos(-bladeWorldRot.x);
            const sinRotX = Math.sin(-bladeWorldRot.x);
            
            // First rotate around Y axis
            let tempX = relativePos.x * cosRotY - relativePos.z * sinRotY;
            let tempZ = relativePos.x * sinRotY + relativePos.z * cosRotY;
            let tempY = relativePos.y;
            
            // Then rotate around X axis (for the 90-degree vertical rotation)
            const localX = tempX;
            const localY = tempY * cosRotX - tempZ * sinRotX;
            const localZ = tempY * sinRotX + tempZ * cosRotX;
            
            // Blade dimensions in local space (vertical blade)
            const bladeLength = windmill.userData.radius / 2; // Half-length in X direction
            const bladeHeight = (windmill.userData.radius * 0.3) / 2; // Half-height in Y direction (local)
            const bladeThickness = 0.1 / 2; // Half-thickness in Z direction (local)
            
            // Check collision (ball must be within blade bounds)
            if (localX + ballRadius > -bladeLength &&
                localX - ballRadius < bladeLength &&
                localY + ballRadius > -bladeHeight &&
                localY - ballRadius < bladeHeight &&
                localZ + ballRadius > -bladeThickness &&
                localZ - ballRadius < bladeThickness) {
                
                // Find closest face and push out
                let correctedLocalX = localX;
                let correctedLocalY = localY;
                let correctedLocalZ = localZ;
                let collisionNormalLocal = new THREE.Vector3();
                
                const distToLeft = Math.abs(localX - (-bladeLength));
                const distToRight = Math.abs(localX - bladeLength);
                const distToTop = Math.abs(localY - bladeHeight);
                const distToBottom = Math.abs(localY - (-bladeHeight));
                const distToFront = Math.abs(localZ - bladeThickness);
                const distToBack = Math.abs(localZ - (-bladeThickness));
                
                const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom, distToFront, distToBack);
                
                if (minDist === distToLeft) {
                    correctedLocalX = -bladeLength + ballRadius;
                    collisionNormalLocal.set(1, 0, 0);
                } else if (minDist === distToRight) {
                    correctedLocalX = bladeLength - ballRadius;
                    collisionNormalLocal.set(-1, 0, 0);
                } else if (minDist === distToTop) {
                    correctedLocalY = bladeHeight + ballRadius;
                    collisionNormalLocal.set(0, 1, 0);
                } else if (minDist === distToBottom) {
                    correctedLocalY = -bladeHeight - ballRadius;
                    collisionNormalLocal.set(0, -1, 0);
                } else if (minDist === distToFront) {
                    correctedLocalZ = bladeThickness + ballRadius;
                    collisionNormalLocal.set(0, 0, 1);
                } else if (minDist === distToBack) {
                    correctedLocalZ = -bladeThickness - ballRadius;
                    collisionNormalLocal.set(0, 0, -1);
                }
                
                // Transform back to world space (reverse the rotations)
                // First reverse X rotation
                let tempY = correctedLocalY * cosRotX - correctedLocalZ * sinRotX;
                let tempZ = correctedLocalY * sinRotX + correctedLocalZ * cosRotX;
                // Then reverse Y rotation
                const correctedWorldX = correctedLocalX * cosRotY - tempZ * sinRotY + bladeWorldPos.x;
                const correctedWorldZ = correctedLocalX * sinRotY + tempZ * cosRotY + bladeWorldPos.z;
                const correctedWorldY = tempY + bladeWorldPos.y;
                const correctedWorldPos = new THREE.Vector3(correctedWorldX, correctedWorldY, correctedWorldZ);
                
                // Transform normal to world space (reverse rotations)
                let tempNormY = collisionNormalLocal.y * cosRotX - collisionNormalLocal.z * sinRotX;
                let tempNormZ = collisionNormalLocal.y * sinRotX + collisionNormalLocal.z * cosRotX;
                const normalX = collisionNormalLocal.x * cosRotY - tempNormZ * sinRotY;
                const normalZ = collisionNormalLocal.x * sinRotY + tempNormZ * cosRotY;
                const bladeNormal = new THREE.Vector3(normalX, tempNormY, normalZ).normalize();
                
                return {
                    collided: true,
                    windmill: windmill,
                    blade: blade,
                    bladeWorldPos: correctedWorldPos,
                    bladeNormal: bladeNormal
                };
            }
        }
    }
    
    return { collided: false };
}

