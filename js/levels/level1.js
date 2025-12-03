// Level 1: Long rectangle (straight)
import * as THREE from 'three';

export const level1 = {
    width: 15,  // Narrow width (left-right)
    height: 60, // Long length (front-back)
    holePosition: new THREE.Vector3(0, 0, 25),
    ballStartPosition: new THREE.Vector3(0, 0.5, -25),
    hasHump: false,
    powerUpPositions: [] // No power-ups on hole 1
};

