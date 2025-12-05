// Rotating fan obstacle system
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';

let fans = [];

export function createFan(config) {
    const {
        x,                    // X position
        z,                    // Z position
        radius = 2.0,         // Fan radius
        height = 0.1,         // Fan height (thin, on ground)
        numBlades = 4,        // Number of fan blades
        rotationSpeed = 2.0,   // Rotation speed (radians per second)
        pushStrength = 5.0,   // How strong the fan pushes the ball
        bladeLengthMultiplier = 2.0, // Blade length relative to radius
        color = 0x888888      // Fan color (gray by default)
    } = config;

    const fanGroup = new THREE.Group();
    fanGroup.position.set(x, height / 2, z);

    // Create fan base (circular base)
    const baseGeometry = new THREE.CylinderGeometry(radius * 0.3, radius * 0.3, height, 16);
    const baseMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.3,
            roughness: 0.7
        })
        : new THREE.MeshBasicMaterial({ color: 0x444444 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0;
    base.castShadow = true;
    base.receiveShadow = true;
    fanGroup.add(base);

    // Create fan blades (taller and extended - act as moving walls)
    const bladeGroup = new THREE.Group();
    const bladeAngle = (Math.PI * 2) / numBlades;
    const bladeHeight = 0.8; // Taller blades for visibility
    const bladeLength = radius * bladeLengthMultiplier; // Much longer blades (extended significantly)
    const bladeWidth = radius * 0.2; // Blade width
    
    const bladeMeshes = [];
    
    for (let i = 0; i < numBlades; i++) {
        const bladeGeometry = new THREE.BoxGeometry(bladeLength, bladeHeight, bladeWidth);
        const bladeMaterial = isFullMode
            ? new THREE.MeshStandardMaterial({
                color: color,
                metalness: 0.2,
                roughness: 0.6
            })
            : new THREE.MeshBasicMaterial({ color: color });
        
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        // Position blade extending outward from center
        // Blade center is positioned at radius * 0.5 from fan center, extending outward
        blade.position.set(
            Math.cos(i * bladeAngle) * radius * 0.5,
            bladeHeight / 2 + 0.1, // Raised above ground
            Math.sin(i * bladeAngle) * radius * 0.5
        );
        blade.rotation.y = i * bladeAngle;
        // Store blade's world position offset for collision detection
        blade.userData.offsetFromFanCenter = radius * 0.5;
        blade.castShadow = true;
        blade.receiveShadow = true;
        
        // Store blade data for collision detection
        blade.userData.isFanBlade = true;
        blade.userData.bladeIndex = i;
        blade.userData.bladeLength = bladeLength;
        blade.userData.bladeHeight = bladeHeight;
        blade.userData.bladeWidth = bladeWidth;
        blade.userData.baseAngle = i * bladeAngle;
        
        bladeGroup.add(blade);
        bladeMeshes.push(blade);
    }
    
    fanGroup.add(bladeGroup);

    // Store fan data
    fanGroup.userData.isFan = true;
    fanGroup.userData.x = x;
    fanGroup.userData.z = z;
    fanGroup.userData.radius = radius;
    fanGroup.userData.height = height;
    fanGroup.userData.rotationSpeed = rotationSpeed;
    fanGroup.userData.pushStrength = pushStrength;
    fanGroup.userData.rotation = 0;
    fanGroup.userData.bladeGroup = bladeGroup;
    fanGroup.userData.bladeMeshes = bladeMeshes;
    fanGroup.userData.bladeHeight = bladeHeight;
    fanGroup.userData.bladeLength = bladeLength;
    fanGroup.userData.bladeWidth = bladeWidth;

    scene.add(fanGroup);
    fans.push(fanGroup);

    return fanGroup;
}

export function updateFans(deltaTime) {
    fans.forEach(fan => {
        fan.userData.rotation += deltaTime * fan.userData.rotationSpeed;
        fan.userData.bladeGroup.rotation.y = fan.userData.rotation;
    });
}

export function getFans() {
    return fans;
}

export function removeAllFans() {
    fans.forEach(fan => {
        scene.remove(fan);
        fan.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    });
    fans = [];
}

export function checkFanBladeCollisions(ballPos, ballRadius) {
    const collisions = [];

    for (const fan of fans) {
        const fanPos = new THREE.Vector3(fan.userData.x, 0, fan.userData.z);
        const rotationSpeed = fan.userData.rotationSpeed;

        for (const blade of fan.userData.bladeMeshes) {
            const bladeCenter = new THREE.Vector3();
            blade.getWorldPosition(bladeCenter);

            const bladeQuat = new THREE.Quaternion();
            blade.getWorldQuaternion(bladeQuat);
            const invBladeQuat = bladeQuat.clone().invert();

            const localBallPos = new THREE.Vector3().subVectors(ballPos, bladeCenter).applyQuaternion(invBladeQuat);

            const halfLength = fan.userData.bladeLength / 2;
            const halfHeight = fan.userData.bladeHeight / 2;
            const halfWidth = fan.userData.bladeWidth / 2;

            if (Math.abs(localBallPos.x) > halfLength + ballRadius ||
                Math.abs(localBallPos.y) > halfHeight + ballRadius ||
                Math.abs(localBallPos.z) > halfWidth + ballRadius) {
                continue;
            }

            const closestLocal = new THREE.Vector3(
                Math.max(-halfLength, Math.min(localBallPos.x, halfLength)),
                Math.max(-halfHeight, Math.min(localBallPos.y, halfHeight)),
                Math.max(-halfWidth, Math.min(localBallPos.z, halfWidth))
            );

            const closestWorldPoint = bladeCenter.clone().add(closestLocal.clone().applyQuaternion(bladeQuat));
            const distance = ballPos.distanceTo(closestWorldPoint);

            if (distance >= ballRadius + 0.01) {
                continue;
            }

            let normal = new THREE.Vector3().subVectors(ballPos, closestWorldPoint);
            const normalLength = normal.length();
            if (normalLength < 0.001) {
                normal = new THREE.Vector3(
                    ballPos.x - fanPos.x,
                    0,
                    ballPos.z - fanPos.z
                );
                if (normal.length() < 0.001) {
                    normal = new THREE.Vector3(1, 0, 0).applyQuaternion(bladeQuat);
                }
            }
            normal.normalize();

            const distFromCenter = Math.sqrt(
                Math.pow(closestWorldPoint.x - fanPos.x, 2) + 
                Math.pow(closestWorldPoint.z - fanPos.z, 2)
            );
            const tangentialSpeed = rotationSpeed * distFromCenter;

            const angleToCollision = Math.atan2(closestWorldPoint.z - fanPos.z, closestWorldPoint.x - fanPos.x);
            const tangentialAngle = angleToCollision + Math.PI / 2;
            const bladeVelocity = new THREE.Vector3(
                Math.cos(tangentialAngle) * tangentialSpeed,
                0,
                Math.sin(tangentialAngle) * tangentialSpeed
            );

            const penetrationDepth = Math.max(0, ballRadius - distance);
            const correctedPos = ballPos.clone().add(
                normal.clone().multiplyScalar(penetrationDepth + 0.01)
            );

            collisions.push({
                collided: true,
                correctedPos,
                normal,
                blade,
                bladeVelocity
            });
        }
    }

    return collisions.length > 0 ? collisions[0] : { collided: false };
}

export function checkFanPush(ballPos, ballRadius) {
    const pushForces = [];
    
    for (const fan of fans) {
        const fanPos = new THREE.Vector3(fan.userData.x, 0, fan.userData.z);
        const distance = Math.sqrt(
            Math.pow(ballPos.x - fanPos.x, 2) + 
            Math.pow(ballPos.z - fanPos.z, 2)
        );
        
        // Check if ball is within fan's influence radius
        if (distance > 0.01 && distance < fan.userData.radius + ballRadius && ballPos.y < fan.userData.height + ballRadius + 1.0) {
            // Calculate angle from fan center to ball
            const angleToBall = Math.atan2(ballPos.z - fanPos.z, ballPos.x - fanPos.x);
            
            // Fan rotates clockwise, so push direction is tangential (perpendicular to radius)
            // Clockwise means: if ball is at angle θ, push at angle θ + π/2 (90 degrees clockwise)
            const pushAngle = angleToBall + Math.PI / 2;
            const pushDirection = new THREE.Vector3(
                Math.cos(pushAngle),
                0,
                Math.sin(pushAngle)
            );
            
            // Push strength decreases with distance
            const maxDistance = fan.userData.radius + ballRadius;
            const distanceFactor = Math.max(0, 1.0 - (distance / maxDistance));
            const pushMagnitude = fan.userData.pushStrength * distanceFactor;
            
            pushForces.push({
                force: pushDirection.clone().multiplyScalar(pushMagnitude),
                fan: fan
            });
        }
    }
    
    return pushForces;
}

