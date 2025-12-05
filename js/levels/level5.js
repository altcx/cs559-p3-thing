// Level5: Generated from grid format
import * as THREE from 'three';

export const level5 = {
    width: 100,
    height: 100,
    holePosition: new THREE.Vector3(1, 0, -37),
    ballStartPosition: new THREE.Vector3(0, 0.5, 0),
    cameraStartBehind: true,  // Camera starts behind ball (positive Z), looking towards hole (negative Z)
    hasHump: false,
    powerUpPositions: [],
    bumpers: [],
    // AI Waypoints for Level 5 - Path through teleporters
    // Teleporter pairs:
    //   Pair 0 (red): (16, -11) <-> (39, 0)
    //   Pair 1 (blue): (39, -35) <-> (1, -25)
    // Optimal path: Start -> Teleporter 0 entry -> (teleport) -> Teleporter 1 entry -> (teleport) -> Hole
    aiWaypoints: [
        // From start (0, 0), approach the first red teleporter
        new THREE.Vector3(8, 0, -5),
        new THREE.Vector3(16, 0, -11),     // Red teleporter entrance
        // After teleporting to (39, 0), head to blue teleporter at (39, -35)
        new THREE.Vector3(39, 0, -10),
        new THREE.Vector3(39, 0, -20),
        new THREE.Vector3(39, 0, -35),     // Blue teleporter entrance
        // After teleporting to (1, -25), head to hole at (1, -37)
        new THREE.Vector3(1, 0, -30),
        new THREE.Vector3(1, 0, -36.5),    // Hole approach
    ],
    // Floor polygons - defined by corner coordinates
    floorPolygons: [
        // Polygon 1 (8 corners)
        [
            { x: -17.5, z: 14.5 },
            { x: 20.5, z: 15.5 },
            { x: 20.5, z: 7.5 },
            { x: 5, z: 6.5 },
            { x: 4.5, z: -5 },
            { x: -3.5, z: -4.5 },
            { x: -4, z: 7 },
            { x: -17.5, z: 7 }
        ],
        // Polygon 2 (4 corners)
        [
            { x: 31, z: 39 },
            { x: 31, z: -5 },
            { x: 47, z: -5 },
            { x: 47, z: 38.5 }
        ],
        // Polygon 3 (4 corners)
        [
            { x: -3.5, z: 43.5 },
            { x: 5, z: 43.5 },
            { x: 4.5, z: 21.5 },
            { x: -3, z: 21 }
        ],
        // Polygon 4 (4 corners)
        [
            { x: -33, z: -33.5 },
            { x: -33, z: -41.5 },
            { x: -9, z: -40.5 },
            { x: -9.5, z: -33 }
        ]
    ],
    magneticFields: [
        {
            position: new THREE.Vector3(39, 0.5, -13),
            strength: 0.5,
            range: 8
        },
    ],
    teleporters: [
        {
            position: new THREE.Vector3(16, 0, -11),
            pairId: 0,
            size: 4.0
        },
        {
            position: new THREE.Vector3(39, 0, 0),
            pairId: 0,
            size: 4.0
        },
        {
            position: new THREE.Vector3(39, 0, -35),
            pairId: 1,
            size: 4.0,
            color: 0x0000ff
        },
        {
            position: new THREE.Vector3(1, 0, -25),
            pairId: 1,
            size: 4.0,
            color: 0x0000ff
        },
        {
            position: new THREE.Vector3(-11, 0, -11),  // Yellow teleporter aligned with z = -11, x = -11
            pairId: 3,
            size: 4.0,
            color: 0xffff00  // Yellow - triggers cutscene
        },
        {
            position: new THREE.Vector3(39, 0, -35),  // Cutscene starter - connects to yellow teleporter
            pairId: 3,
            size: 4.0,
            color: 0xffff00  // Yellow - triggers cutscene
        },
    ],
    models: [
        {
            url: 'models/neco-arc.glb',    // Path to neco-arc model
            format: 'glb',                  // GLB format
            position: new THREE.Vector3(-82, -65, 37),  // Position at x=-82, moved up by 40 units (y=-65, was -105)
            rotation: new THREE.Euler(0, 0, 0),    // No rotation
            scale: new THREE.Vector3(60, 60, 60),     // normal size (increased from 20x)
            castShadow: true,              // Cast shadows
            receiveShadow: true,           // Receive shadows
        },
        // Giant background structures - randomly positioned around course 5 (LOWERED)
        {
            type: 'giantArch',
            geometry: 'giantArch',
            position: new THREE.Vector3(-60, -20, 50),
            width: 40,
            height: 50,
            thickness: 2.5
        },
        {
            type: 'giantSpiral',
            geometry: 'giantSpiral',
            position: new THREE.Vector3(70, -20, 30),
            height: 60,
            radius: 10,
            turns: 3
        },
        {
            type: 'giantRingGate',
            geometry: 'giantRingGate',
            position: new THREE.Vector3(-50, -20, -60),
            radius: 30,
            thickness: 2.5
        },
        {
            type: 'giantCrystalPillar',
            geometry: 'giantCrystalPillar',
            position: new THREE.Vector3(80, -20, -50),
            height: 70,
            radius: 5
        },
        {
            type: 'giantArch',
            geometry: 'giantArch',
            position: new THREE.Vector3(50, -20, 60),
            width: 35,
            height: 45,
            thickness: 2
        },
        {
            type: 'giantSpiral',
            geometry: 'giantSpiral',
            position: new THREE.Vector3(-70, -20, -40),
            height: 55,
            radius: 9,
            turns: 2.5
        },
        {
            type: 'giantRingGate',
            geometry: 'giantRingGate',
            position: new THREE.Vector3(60, -20, 40),
            radius: 28,
            thickness: 2
        },
        {
            type: 'giantCrystalPillar',
            geometry: 'giantCrystalPillar',
            position: new THREE.Vector3(-80, -20, 20),
            height: 65,
            radius: 4.5
        },
        {
            type: 'giantArch',
            geometry: 'giantArch',
            position: new THREE.Vector3(40, -20, -70),
            width: 38,
            height: 48,
            thickness: 2.2
        },
        {
            type: 'giantSpiral',
            geometry: 'giantSpiral',
            position: new THREE.Vector3(-90, -20, 10),
            height: 58,
            radius: 11,
            turns: 3.5
        },
        // Flying Machines - 2 unique machines with Level 5 color scheme
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(0, 20, 0), // High central orbit
            orbitRadius: 50,
            orbitHeight: 12,
            orbitSpeed: 0.2,
            colorScheme: {
                body: 0xAADDFF,    // Light blue
                nose: 0xDDAAFF,    // Light purple/lavender
                wings: 0x88CCFF,   // Light cyan-blue
                tail: 0x88EEFF,    // Cyan
                engines: 0xAADDFF  // Light blue
            }
        },
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(30, 15, -20), // Side orbit
            orbitRadius: 35,
            orbitHeight: 10,
            orbitSpeed: 0.4,
            colorScheme: {
                body: 0x88EEFF,    // Cyan
                nose: 0x88CCFF,    // Light cyan-blue
                wings: 0xAADDFF,   // Light blue
                tail: 0xDDAAFF,    // Light purple/lavender
                engines: 0x88EEFF  // Cyan
            }
        }
    ],
    // Floor zones to fill specific areas
    floorZones: [
        // T-shape section at bottom - flip about X axis (negate Z)
        { minX: -34, maxX: -8, minZ: 33, maxZ: 41, flipZ: true }
    ],
    customWalls: [
        { x: 1, z: -43, width: 10, depth: 2 },
        { x: -3, z: -41, width: 2, depth: 2 },
        { x: 5, z: -41, width: 2, depth: 2 },
        { x: -3, z: -39, width: 2, depth: 2 },
        { x: 5, z: -39, width: 2, depth: 2 },
        { x: 39, z: -39, width: 18, depth: 2 },
        { x: -3, z: -37, width: 2, depth: 2 },
        { x: 5, z: -37, width: 2, depth: 2 },
        { x: 31, z: -37, width: 2, depth: 2 },
        { x: 47, z: -37, width: 2, depth: 2 },
        { x: -3, z: -35, width: 2, depth: 2 },
        { x: 5, z: -35, width: 2, depth: 2 },
        { x: 31, z: -35, width: 2, depth: 2 },
        { x: 47, z: -35, width: 2, depth: 2 },
        { x: -3, z: -33, width: 2, depth: 2 },
        { x: 5, z: -33, width: 2, depth: 2 },
        { x: 31, z: -33, width: 2, depth: 2 },
        { x: 47, z: -33, width: 2, depth: 2 },
        { x: -3, z: -31, width: 2, depth: 2 },
        { x: 5, z: -31, width: 2, depth: 2 },
        { x: 31, z: -31, width: 2, depth: 2 },
        { x: 47, z: -31, width: 2, depth: 2 },
        { x: -3, z: -29, width: 2, depth: 2 },
        { x: 5, z: -29, width: 2, depth: 2 },
        { x: 31, z: -29, width: 2, depth: 2 },
        { x: 35, z: -29, width: 2, depth: 2 },
        { x: 43, z: -29, width: 2, depth: 2 },
        { x: 47, z: -29, width: 2, depth: 2 },
        { x: -3, z: -27, width: 2, depth: 2 },
        { x: 5, z: -27, width: 2, depth: 2 },
        { x: 31, z: -27, width: 2, depth: 2 },
        { x: 35, z: -27, width: 2, depth: 2 },
        { x: 41, z: -27, width: 2, depth: 2 },
        { x: 47, z: -27, width: 2, depth: 2 },
        { x: -3, z: -25, width: 2, depth: 2 },
        { x: 5, z: -25, width: 2, depth: 2 },
        { x: 31, z: -25, width: 2, depth: 2 },
        { x: 47, z: -25, width: 2, depth: 2 },
        { x: -3, z: -23, width: 2, depth: 2 },
        { x: 5, z: -23, width: 2, depth: 2 },
        { x: 31, z: -23, width: 2, depth: 2 },
        { x: 47, z: -23, width: 2, depth: 2 },
        { x: 1, z: -21, width: 10, depth: 2 },
        { x: 33, z: -21, width: 6, depth: 2 },
        { x: 41, z: -21, width: 6, depth: 2 },
        { x: 47, z: -21, width: 2, depth: 2 },
        { x: 31, z: -19, width: 2, depth: 2 },
        { x: 47, z: -19, width: 2, depth: 2 },
        { x: 31, z: -17, width: 2, depth: 2 },
        { x: 46, z: -17, width: 4, depth: 2 },
        { x: 2, z: -15, width: 40, depth: 2 },
        { x: 32, z: -15, width: 4, depth: 2 },
        { x: 47, z: -15, width: 2, depth: 2 },

        { x: -17, z: -13, width: 2, depth: 2 },
        { x: 21, z: -13, width: 2, depth: 2 },
        { x: 31, z: -13, width: 2, depth: 2 },
        { x: 47, z: -13, width: 2, depth: 2 },
       
        { x: -17, z: -11, width: 2, depth: 2 },
        { x: 21, z: -11, width: 2, depth: 2 },
        { x: 31, z: -11, width: 2, depth: 2 },
        { x: 47, z: -11, width: 2, depth: 2 },
       
        { x: -17, z: -9, width: 2, depth: 2 },
        { x: 21, z: -9, width: 2, depth: 2 },
        { x: 31, z: -9, width: 2, depth: 2 },
        { x: 42, z: -9, width: 4, depth: 2 },
        { x: 47, z: -9, width: 2, depth: 2 },
        { x: -10, z: -7, width: 16, depth: 2 },  // Extended to x = -18
        { x: 13, z: -7, width: 18, depth: 2 },
        { x: 32, z: -7, width: 4, depth: 2 },
        { x: 47, z: -7, width: 2, depth: 2 },
        { x: -3, z: -5, width: 2, depth: 2 },
        { x: 5, z: -5, width: 2, depth: 2 },
        { x: 31, z: -5, width: 2, depth: 2 },
        { x: 38, z: -5, width: 4, depth: 2 },
        { x: 47, z: -5, width: 2, depth: 2 },
        { x: -3, z: -3, width: 2, depth: 2 },
        { x: 5, z: -3, width: 2, depth: 2 },
        { x: 31, z: -3, width: 2, depth: 2 },
        { x: 39, z: -3, width: 2, depth: 2 },
        { x: 46, z: -3, width: 4, depth: 2 },
        { x: -3, z: -1, width: 2, depth: 2 },
        { x: 5, z: -1, width: 2, depth: 2 },
        { x: 31, z: -1, width: 2, depth: 2 },
        { x: 47, z: -1, width: 2, depth: 2 },
        { x: -3, z: 1, width: 2, depth: 2 },
        { x: 5, z: 1, width: 2, depth: 2 },
        { x: 31, z: 1, width: 2, depth: 2 },
        { x: 47, z: 1, width: 2, depth: 2 },
        { x: -3, z: 3, width: 2, depth: 2 },
        { x: 5, z: 3, width: 2, depth: 2 },
        { x: 31, z: 3, width: 2, depth: 2 },
        { x: 47, z: 3, width: 2, depth: 2 },
        { x: 1, z: 5, width: 10, depth: 2 },
        { x: 39, z: 5, width: 18, depth: 2 },
        { x: -21, z: 33, width: 26, depth: 2 },
        { x: -9, z: 35, width: 2, depth: 2 },
        { x: -9, z: 37, width: 2, depth: 2 },
        { x: -9, z: 39, width: 2, depth: 2 },
        { x: -21, z: 41, width: 26, depth: 2 },
    ],
};
