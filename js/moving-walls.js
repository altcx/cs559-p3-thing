// Moving walls obstacle system
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';

let movingWalls = [];

export function createMovingWall(config) {
    const {
        x,                    // X position (fixed)
        zCenter,              // Center Z position for oscillation
        zRange,               // Range of oscillation (half the total distance)
        width = 1.0,          // Wall width (thinner than regular walls)
        height = 1.0,         // Wall height (taller than regular walls)
        depth = 0.5,          // Wall depth (along z-axis)
        speed = 2.0,          // Oscillation speed
        color = 0xd3685c      // Wall color (#d3685c)
    } = config;

    const wallGeometry = new THREE.BoxGeometry(width, height, depth);
    const wallMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.2,
            roughness: 0.6
        })
        : new THREE.MeshBasicMaterial({ color: color });

    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    wallMesh.position.set(x, height / 2, zCenter);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    wallMesh.userData.isMovingWall = true;
    wallMesh.userData.x = x;
    wallMesh.userData.zCenter = zCenter;
    wallMesh.userData.zRange = zRange;
    wallMesh.userData.width = width;
    wallMesh.userData.height = height;
    wallMesh.userData.depth = depth;
    wallMesh.userData.speed = speed;
    wallMesh.userData.time = 0;
    wallMesh.userData.direction = 1; // 1 for positive z, -1 for negative z

    scene.add(wallMesh);
    movingWalls.push(wallMesh);

    return wallMesh;
}

export function updateMovingWalls(deltaTime) {
    movingWalls.forEach(wall => {
        wall.userData.time += deltaTime * wall.userData.speed;
        
        const oscillation = Math.sin(wall.userData.time) * wall.userData.zRange;
        const newZ = wall.userData.zCenter + oscillation;
        
        wall.position.z = newZ;
        
        const velocityZ = Math.cos(wall.userData.time) * wall.userData.zRange * wall.userData.speed;
        wall.userData.velocity = new THREE.Vector3(0, 0, velocityZ);
    });
}

export function getMovingWalls() {
    return movingWalls;
}

export function removeAllMovingWalls() {
    movingWalls.forEach(wall => {
        scene.remove(wall);
        wall.geometry.dispose();
        wall.material.dispose();
    });
    movingWalls = [];
}

export function checkMovingWallCollisions(ballPos, ballRadius) {
    for (const wall of movingWalls) {
        const wallBounds = {
            minX: wall.userData.x - wall.userData.width / 2,
            maxX: wall.userData.x + wall.userData.width / 2,
            minY: 0,
            maxY: wall.userData.height,
            minZ: wall.position.z - wall.userData.depth / 2,
            maxZ: wall.position.z + wall.userData.depth / 2
        };

        // Check if ball overlaps wall bounds (same as custom walls)
        if (ballPos.x + ballRadius > wallBounds.minX && 
            ballPos.x - ballRadius < wallBounds.maxX &&
            ballPos.z + ballRadius > wallBounds.minZ && 
            ballPos.z - ballRadius < wallBounds.maxZ &&
            ballPos.y < wallBounds.maxY && ballPos.y > wallBounds.minY) {
            
            // Calculate distances to each side of the wall
            const distToLeft = ballPos.x - wallBounds.minX;
            const distToRight = wallBounds.maxX - ballPos.x;
            const distToFront = ballPos.z - wallBounds.minZ;
            const distToBack = wallBounds.maxZ - ballPos.z;
            
            // Find minimum distance to push out (same logic as custom walls)
            const minDist = Math.min(distToLeft, distToRight, distToFront, distToBack);
            
            let correctedPos = ballPos.clone();
            let collisionNormal = new THREE.Vector3();
            
            // Push ball out based on closest side
            if (minDist === distToLeft && distToLeft < ballRadius) {
                correctedPos.x = wallBounds.minX - ballRadius;
                collisionNormal.set(-1, 0, 0);
            } else if (minDist === distToRight && distToRight < ballRadius) {
                correctedPos.x = wallBounds.maxX + ballRadius;
                collisionNormal.set(1, 0, 0);
            } else if (minDist === distToFront && distToFront < ballRadius) {
                correctedPos.z = wallBounds.minZ - ballRadius;
                collisionNormal.set(0, 0, -1);
            } else if (minDist === distToBack && distToBack < ballRadius) {
                correctedPos.z = wallBounds.maxZ + ballRadius;
                collisionNormal.set(0, 0, 1);
            }
            
            return {
                collided: true,
                correctedPos: correctedPos,
                normal: collisionNormal,
                wall: wall
            };
        }
    }

    return { collided: false };
}
