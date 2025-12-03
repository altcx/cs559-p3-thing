// Level 4: L-Shaped Course - The Elbow
import * as THREE from 'three';

export const level4 = {
    // Course shape: L-shaped (main rectangle + extension to the right near hole)
    // Custom shape means we don't use width/height for the course geometry
    isLShaped: true,
    holePosition: new THREE.Vector3(-15, 0, 15), // Hole in the extension area (centered in extension, LEFT side)
    ballStartPosition: new THREE.Vector3(0, 0.5, -15), // Start at beginning of main rectangle
    hasHump: false,
    powerUpPositions: [],
    bumpers: [],
    // Simple wall definitions: each wall is a box with position and size
    // Walls are placed at their center position, positioned just outside course boundaries
    // Course shape: Main rectangle (x: -7.5 to 7.5, z: -30 to 0) + Extension (x: -22.5 to -7.5, z: 0 to 30)
    // Both parts are equal size: 15 units wide, 30 units long
    // Extension connects at the front (z=0) of the main rectangle, turning LEFT
    customWalls: [
        // Back wall (bottom of main rectangle) - positioned at z=-31, covers x: -7.5 to 7.5
        { x: 0, z: -31, width: 17, depth: 2 },
        
        // Left wall of extension - positioned at x=-23.5, covers z: 0 to 30
        { x: -23.5, z: 15, width: 2, depth: 32 },
        
        // Left wall of main rectangle - positioned at x=-8.5, covers z: -30 to 0
        { x: -8.5, z: -15, width: 2, depth: 32 },
        
        // Right wall (full height) - positioned at x=8.5, covers z: -30 to 30
        { x: 8.5, z: 0, width: 2, depth: 62 },
        
        // Top wall (spans entire top) - positioned at z=31, covers x: -22.5 to 7.5
        { x: -7.5, z: 31, width: 32, depth: 2 }
    ]
};

