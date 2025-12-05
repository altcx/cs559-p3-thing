// Level 2: With bumpers
import * as THREE from 'three';

export const level2 = {
    width: 50,
    height: 50,
    holePosition: new THREE.Vector3(0, 0, 20),
    ballStartPosition: new THREE.Vector3(0, 0.5, -20),
    hasHump: false,
    powerUpPositions: [
        // Power boxes in the 4 corners (middle of each corner section in a 3x3 grid)
        new THREE.Vector3(-17, 0.5, 17),  // Top-left corner
        new THREE.Vector3(17, 0.5, 17),   // Top-right corner
        new THREE.Vector3(-17, 0.5, -17), // Bottom-left corner
        new THREE.Vector3(17, 0.5, -17)   // Bottom-right corner
    ],
    // AI Waypoints for Level 2 - Course with bumpers and wind zones
    // Start at (0, -20), hole at (0, 20)
    // Bumpers at: (-10, 0), (10, 0), (0, -10), (-4, 20), (4, 20)
    // Wind zones push -Z at corners
    aiWaypoints: [
        // Go slightly right to avoid the bumper at (0, -10)
        new THREE.Vector3(5, 0, -10),
        // Navigate between bumpers at (-10, 0) and (10, 0)
        new THREE.Vector3(0, 0, 0),
        // Approach hole, avoiding bumpers at (-4, 20) and (4, 20)
        new THREE.Vector3(0, 0, 12),
        new THREE.Vector3(0, 0, 19.5),     // Final approach to hole (between bumpers)
    ],
    // Floor polygons - defined by corner coordinates
    floorPolygons: [
        [
            { x: -26.5, z: -26.5 },
            { x: 26, z: -26 },
            { x: 25.5, z: 25.5 },
            { x: -26, z: 25.5 }
        ]
    ],
    // Wind zones removed
    windZones: [],
    testWalls: [],
    // Many random bumpers scattered across the course
    bumpers: [
        // Original strategic bumpers
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
            position: new THREE.Vector3(-4, 0.5, 20),
            radius: 1.5,
            tubeRadius: 0.3
        },
        {
            position: new THREE.Vector3(4, 0.5, 20),
            radius: 1.5,
            tubeRadius: 0.3
        },
        // Random bumpers scattered around
        { position: new THREE.Vector3(-15, 0.5, -15), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(15, 0.5, -15), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-15, 0.5, 15), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(15, 0.5, 15), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-8, 0.5, -18), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(8, 0.5, -18), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-12, 0.5, -5), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(12, 0.5, -5), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-6, 0.5, 5), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(6, 0.5, 5), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-18, 0.5, 8), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(18, 0.5, 8), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-14, 0.5, 12), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(14, 0.5, 12), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-7, 0.5, -12), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(7, 0.5, -12), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-11, 0.5, 3), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(11, 0.5, 3), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-3, 0.5, -8), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(3, 0.5, -8), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-9, 0.5, 8), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(9, 0.5, 8), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-16, 0.5, -8), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(16, 0.5, -8), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-5, 0.5, 15), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(5, 0.5, 15), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-13, 0.5, -2), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(13, 0.5, -2), radius: 1.5, tubeRadius: 0.3 }
    ],
    // Megastructures around the bumper field - glass and iridescent
    models: [
        // Crystal Pillar - RAISED & SMALLER, iridescent
        {
            type: 'crystalPillar',
            geometry: 'crystalPillar',
            position: new THREE.Vector3(40, 4, -25),
            height: 11.25,
            radius: 1.125
        },
        // Floating Ring - RAISED & SMALLER, glass ring
        {
            type: 'floatingRing',
            geometry: 'floatingRing',
            position: new THREE.Vector3(-35, 3, 20),
            radius: 11.25,
            thickness: 1.5
        },
        // Aero Arch - RAISED & SMALLER, curved arch
        {
            type: 'aeroArch',
            geometry: 'aeroArch',
            position: new THREE.Vector3(38, 2, 15),
            span: 18.75,
            rise: 13.5
        },
        // Holographic Dome - RAISED & SMALLER, glowing dome
        {
            type: 'holographicDome',
            geometry: 'holographicDome',
            position: new THREE.Vector3(-42, 1, -15),
            radius: 7.5,
            height: 11.25
        },
        // Flying Machines - 3 unique machines with Level 5 color scheme
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(0, 8, 0), // Center orbit
            orbitRadius: 30,
            orbitHeight: 6,
            orbitSpeed: 0.4,
            colorScheme: {
                body: 0x88CCFF,    // Light cyan-blue
                nose: 0xAADDFF,    // Light blue
                wings: 0xDDAAFF,   // Light purple/lavender
                tail: 0x88EEFF,    // Cyan
                engines: 0xAADDFF  // Light blue
            }
        },
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(-20, 6, 10), // Side orbit
            orbitRadius: 20,
            orbitHeight: 5,
            orbitSpeed: 0.5,
            colorScheme: {
                body: 0xDDAAFF,    // Light purple/lavender
                nose: 0x88EEFF,    // Cyan
                wings: 0x88CCFF,   // Light cyan-blue
                tail: 0xAADDFF,    // Light blue
                engines: 0xDDAAFF  // Light purple/lavender
            }
        },
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(18, 7, -12), // Another orbit
            orbitRadius: 25,
            orbitHeight: 5.5,
            orbitSpeed: 0.35,
            colorScheme: {
                body: 0x88EEFF,    // Cyan
                nose: 0xDDAAFF,    // Light purple/lavender
                wings: 0xAADDFF,   // Light blue
                tail: 0x88CCFF,    // Light cyan-blue
                engines: 0x88EEFF  // Cyan
            }
        }
    ]
};

