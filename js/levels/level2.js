// Level 2: With bumpers
import * as THREE from 'three';

export const level2 = {
    width: 50,
    height: 50,
    holePosition: new THREE.Vector3(0, 0, 20),
    ballStartPosition: new THREE.Vector3(0, 0.5, -20),
    hasHump: false,
    powerUpPositions: [
        new THREE.Vector3(0, 1.0, 0) // Power-up in the middle
    ],
    testWalls: [],
    bumpers: [
        {
            position: new THREE.Vector3(-10, 0.5, 0),
            radius: 1.5,
            tubeRadius: 0.3
        },
        {
            position: new THREE.Vector3(10, 0.5, 0),
            radius: 1.5,
            tubeRadius: 0.3
        },
        {
            position: new THREE.Vector3(0, 0.5, -10),
            radius: 1.5,
            tubeRadius: 0.3
        },
        {
            position: new THREE.Vector3(-4, 0.5, 20), // Left side of hole
            radius: 1.5,
            tubeRadius: 0.3
        },
        {
            position: new THREE.Vector3(4, 0.5, 20), // Right side of hole
            radius: 1.5,
            tubeRadius: 0.3
        }
    ]
};

