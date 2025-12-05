// Level 3: Narrow path with rectangular holes on sides, easier path on left
import * as THREE from 'three';

export const level3 = {
    width: 50,
    height: 50,
    holePosition: new THREE.Vector3(0, 0, 20), // Hole at end of narrow path
    ballStartPosition: new THREE.Vector3(0, 0.5, -20), // Start at beginning
    hasHump: false,
    powerUpPositions: [
        new THREE.Vector3(20, 0.5, 0),  // Power box at x=20, z=0
        new THREE.Vector3(-20, 0.5, 0)  // Power box at x=-20, z=0
    ],
    // AI Waypoints for Level 3
    // The wind zone in the center pushes +X, so AI should go around the outside (right side)
    // to avoid being pushed into the right rectangular hole
    aiWaypoints: [
        // Go right to avoid the center wind zone
        new THREE.Vector3(20, 0, -18),
        // Continue along the right edge, staying outside the wind zone
        new THREE.Vector3(22, 0, -5),
        new THREE.Vector3(22, 0, 5),
        new THREE.Vector3(20, 0, 15),
        // Approach the hole from the safe side
        new THREE.Vector3(5, 0, 19),
        // Final approach to hole
        new THREE.Vector3(0, 0, 19.5),
    ],
    // Use bright pink floor texture (same as other levels)
    usePinkFloor: true,
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
    bumpers: [], // No bumpers for Hole 3
    // Wind zones - push ball in a direction when inside
    windZones: [
        {
            position: new THREE.Vector3(0, 5, 3), // Center of zone (moved forward in Z)
            size: new THREE.Vector3(20, 10, 6),  // x=-10 to 10, z=0 to 6, 10 units high (even thinner along Z)
            direction: new THREE.Vector3(1, 0, 0), // Push in +X direction
            strength: 45.0, // Half strength (was 90.0)
            color: 0x88ccff // Light blue
        }
    ],
    // Megastructures around the narrow path course
    models: [
        // Spiral Tower - FARTHER AWAY, holographic spiral structure
        {
            type: 'spiralTower',
            geometry: 'spiralTower',
            position: new THREE.Vector3(-65, 0, -60),
            height: 41.25,
            radius: 3.75
        },
        // Energy Bridge - FARTHER AWAY, holographic bridge
        {
            type: 'energyBridge',
            geometry: 'energyBridge',
            position: new THREE.Vector3(70, 0, 8),
            length: 33.75,
            height: 11.25
        },
        // Floating Citadel - FARTHER AWAY, central tower with rings
        {
            type: 'floatingCitadel',
            geometry: 'floatingCitadel',
            position: new THREE.Vector3(35, 2, 65),
            size: 21
        },
        // Mystical Gateway - FARTHER AWAY, portal-like structure
        {
            type: 'mysticalGateway',
            geometry: 'mysticalGateway',
            position: new THREE.Vector3(-70, 0, 70),
            width: 17.25,
            height: 26.25
        },
        // Crystal Formation - FARTHER AWAY, cluster of iridescent crystals
        {
            type: 'crystalFormation',
            geometry: 'crystalFormation',
            position: new THREE.Vector3(75, 0, -25),
            scale: 1.05
        },
        // Iridescent Torus Knot - Complex intertwined structure
        {
            type: 'iridescentTorusKnot',
            geometry: 'iridescentTorusKnot',
            position: new THREE.Vector3(-55, 8, 35),
            scale: 8,
            p: 3,
            q: 2,
            color: 0xff00ff,
            intensity: 1.5
        },
        // Crystal Lattice Dome - Geodesic dome structure
        {
            type: 'crystalLatticeDome',
            geometry: 'crystalLatticeDome',
            position: new THREE.Vector3(60, 0, 50),
            radius: 15,
            segments: 16,
            color: 0x00ffcc,
            intensity: 1.3
        },
        // Shimmering Helix Tower - Double helix structure
        {
            type: 'shimmeringHelix',
            geometry: 'shimmeringHelix',
            position: new THREE.Vector3(-45, 0, -55),
            height: 45,
            radius: 5,
            turns: 4,
            strands: 2,
            color: 0xffaa00,
            intensity: 1.4
        },
        // Prismatic Spires - Cluster of sharp iridescent spires
        {
            type: 'prismaticSpires',
            geometry: 'prismaticSpires',
            position: new THREE.Vector3(55, 0, -40),
            count: 5,
            maxHeight: 30,
            baseRadius: 8,
            color: 0x00ff00,
            intensity: 1.2
        },
        // Flying Machines - 2 unique machines with Level 5 color scheme
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(0, 12, 0), // High center orbit
            orbitRadius: 35,
            orbitHeight: 8,
            orbitSpeed: 0.3,
            colorScheme: {
                body: 0xAADDFF,    // Light blue
                nose: 0x88CCFF,    // Light cyan-blue
                wings: 0x88EEFF,   // Cyan
                tail: 0xDDAAFF,    // Light purple/lavender
                engines: 0x88CCFF  // Light cyan-blue
            }
        },
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(-15, 10, -10), // Side orbit
            orbitRadius: 28,
            orbitHeight: 7,
            orbitSpeed: 0.45,
            colorScheme: {
                body: 0x88EEFF,    // Cyan
                nose: 0xAADDFF,    // Light blue
                wings: 0xDDAAFF,   // Light purple/lavender
                tail: 0x88CCFF,    // Light cyan-blue
                engines: 0xAADDFF  // Light blue
            }
        }
    ]
};

