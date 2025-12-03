// Level 3: Narrow path with rectangular holes on sides, easier path on left
import * as THREE from 'three';

export const level3 = {
    width: 50,
    height: 50,
    holePosition: new THREE.Vector3(0, 0, 20), // Hole at end of narrow path
    ballStartPosition: new THREE.Vector3(0, 0.5, -20), // Start at beginning
    hasHump: false,
    powerUpPositions: [],
    // Rectangular holes (hazards) on each side of narrow path
    // Narrow path is in the middle (x=0), made even thinner
    rectangularHoles: [
        // Left rectangular hole (left side of narrow path)
        {
            x: -9, // Wider gap in middle for thicker path
            z: 0, // Center vertically
            width: 16, // Wider holes but more space in middle
            length: 35 // Length (front-back) - long hole
        },
        // Right rectangular hole (right side of narrow path)
        {
            x: 9, // Wider gap in middle for thicker path
            z: 0, // Center vertically
            width: 16, // Wider holes but more space in middle
            length: 35 // Length (front-back) - long hole
        }
    ],
    bumpers: [] // No bumpers for Hole 3
};

