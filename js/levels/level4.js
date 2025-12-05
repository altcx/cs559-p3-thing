// Level 4: L-Shaped Course - The Elbow
import * as THREE from 'three';

export const level4 = {
    // Course shape: L-shaped (main rectangle + extension to the right near hole)
    // Custom shape means we don't use width/height for the course geometry
    isLShaped: true,
    holePosition: new THREE.Vector3(-60, 0, -23.25), // Hole between pink and green walls, near yellow wall
    ballStartPosition: new THREE.Vector3(0, 0.5, -15), // Start at beginning of main rectangle
    hasHump: false,
    powerUpPositions: [
        new THREE.Vector3(5, 0.5, 0),   // Power box at x=5, z=0
        new THREE.Vector3(0, 0.5, 0),   // Power box at x=0, z=0
        new THREE.Vector3(-5, 0.5, 0)   // Power box at x=-5, z=0
    ],
    // AI Waypoints for Level 4 - L-shaped course
    // Start at (0, -15), need to go around the L to hole at (-60, -23.25)
    // Avoid wind zone at center (0, 0) and fans at x=-30 and x=-40
    aiWaypoints: [
        // First go up to avoid the wind zone in the center
        new THREE.Vector3(0, 0, 20),
        // Turn left into the corridor
        new THREE.Vector3(-15, 0, 25),
        // Continue through the corridor, avoiding magnetic fields
        new THREE.Vector3(-20, 0, -20),
        // Navigate past the fans (at x=-30 and x=-40, z=-23.5)
        // Go to the top edge to avoid them
        new THREE.Vector3(-25, 0, -28),
        new THREE.Vector3(-35, 0, -28),    // Pass first fan from above
        new THREE.Vector3(-45, 0, -28),    // Pass second fan from above
        // Approach the hole
        new THREE.Vector3(-55, 0, -23),
        new THREE.Vector3(-59, 0, -23.25), // Final approach to hole
    ],
    // Wind zones removed for easier gameplay
    windZones: [],
    // Bumpers placed after the wind zone (flipped to positive Z, thinner along X, sparse - 25% of original)
    bumpers: [
        { position: new THREE.Vector3(-4, 0.5, 8), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(2, 0.5, 15), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(-1, 0.5, 22), radius: 1.5, tubeRadius: 0.3 },
        { position: new THREE.Vector3(3, 0.5, 12), radius: 1.5, tubeRadius: 0.3 }
    ],
    // Floor polygons - defined by corner coordinates
    floorPolygons: [
        [
            { x: -90.5, z: 31.5 },
            { x: -90.5, z: 15.5 },
            { x: -23.5, z: 15.5 },
            { x: -23.5, z: -30.5 },
            { x: 8, z: -30.5 },
            { x: 9, z: 31.5 }
        ]
    ],
    // Static magnetic fields - act like magnetic pull power-up but placed at specific locations
    magneticFields: [
        // Magnetic fields between blue (x: -23.5) and orange (x: -8.5) walls
        // Placed around x: -16 (midpoint between the walls)
        {
            position: new THREE.Vector3(-16, 0.5, -10),
            strength: 0.5,  // Pull force strength (same as power-up)
            range: 8.0     // Range in units where pull is active
        },
        {
            position: new THREE.Vector3(-16, 0.5, 10),
            strength: 0.5,
            range: 8.0
        }
    ],
    // Simple wall definitions: each wall is a box with position and size
    // Walls are placed at their center position, positioned just outside course boundaries
    // Course shape: Main rectangle (x: -7.5 to 7.5, z: -30 to 0) + Extension (x: -22.5 to -7.5, z: 0 to 30)
    // Both parts are equal size: 15 units wide, 30 units long
    // Extension connects at the front (z=0) of the main rectangle, turning LEFT
    customWalls: [
        // Back wall (bottom of main rectangle) - extended further in -X direction
        // Originally width: 17, now extended even more in -X
        { x: -40.5, z: -31, width: 100, depth: 2 },
        
        // Parallel wall to ff0066 (pink) wall, moved in -Z direction
        // Pink wall is at z: -31
        { x: -56.5, z: -15, width: 68, depth: 2 },
        
        // Left wall of extension - positioned at x=-23.5, shortened to 75% (cut from -Z side)
        // Originally depth=62, now depth=46.5≈46, keeping +Z end at z=31, new center at z=8
        { x: -23.5, z: 8, width: 2, depth: 46 },
        
        // Left wall of main rectangle - positioned at x=-8.5, expanded 50% in +Z direction
        // Originally covered z: -30 to 0, now extends further in +Z
        { x: -8.5, z: -7, width: 2, depth: 48 },
        
        // Right wall (full height) - positioned at x=8.5, covers z: -30 to 30
        { x: 8.5, z: 0, width: 2, depth: 62 },
        
        // Top wall (spans entire top) - positioned at z=31, covers x: -22.5 to 7.5
        { x: -7.5, z: 31, width: 32, depth: 2 },
        
        // Wall at x = -90, extending along Z axis from z = -32 to z = -15
        // Center z = (-32 + -14.5) / 2 = -23.25, depth = 17.5
        { x: -90, z: -23.25, width: 2, depth: 17.5 }
    ],
    // Floor zones to fill specific areas
    floorZones: [
        // Main corridor in negative Z space: extend further in -x direction (beyond x = -89)
        { minX: -120, maxX: -21, minZ: -31, maxZ: -15, flipZ: false },
        // Fill the gap at x = -9.5 to -7.5, z = 17 to 31
        { minX: -9.5, maxX: -7.5, minZ: 17, maxZ: 31, flipZ: false }
    ],
    // Rotating fans that push the ball
    fans: [
        {
            x: -30,              // X position
            z: -23.5,            // Z position (matches yellow wall center)
            radius: 3.0,         // Fan radius
            height: 0.1,         // Fan height (thin, on ground)
            numBlades: 4,        // Number of fan blades
            rotationSpeed: 2.0, // Rotation speed (radians per second, counter-clockwise)
            pushStrength: 8.0,  // How strong the fan pushes the ball
            bladeLengthMultiplier: 1.6,  // Reduced from 2.8 to 1.6 for easier passage
            color: 0x888888      // Fan color (gray)
        },
        {
            x: -40,              // X position (further in -x direction from first fan)
            z: -23.5,            // Z position (same as first fan)
            radius: 3.0,         // Fan radius
            height: 0.1,         // Fan height (thin, on ground)
            numBlades: 4,        // Number of fan blades
            rotationSpeed: -2.0, // Rotation speed (negative for clockwise)
            pushStrength: 8.0,  // How strong the fan pushes the ball
            bladeLengthMultiplier: 1.6,  // Reduced from 2.8 to 1.6 for easier passage
            color: 0x888888      // Fan color (gray)
        }
    ],
    // Megastructures around the complex course
    models: [
        // Floating Platform - FARTHER AWAY, glass platform
        {
            type: 'floatingPlatform',
            geometry: 'floatingPlatform',
            position: new THREE.Vector3(-80, 3, -35),
            size: 17.25,
            height: 2.25
        },
        // Archway - FARTHER AWAY, glass arch
        {
            type: 'archway',
            geometry: 'archway',
            position: new THREE.Vector3(75, 0, 25),
            width: 28.5,
            height: 33.75
        },
        // Crystal Pillar - FARTHER AWAY, crystal tower
        {
            type: 'crystalPillar',
            geometry: 'crystalPillar',
            position: new THREE.Vector3(-75, 0, 45),
            height: 56.25,
            radius: 3.375
        },
        // Aero Arch - FARTHER AWAY, aerodynamic structure
        {
            type: 'aeroArch',
            geometry: 'aeroArch',
            position: new THREE.Vector3(52, 0, -70),
            span: 33.75,
            rise: 24
        },
        // Flying Machines - 3 unique machines with Level 5 color scheme
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(-20, 10, 0), // Orbiting around center
            orbitRadius: 40,
            orbitHeight: 7,
            orbitSpeed: 0.35,
            colorScheme: {
                body: 0xDDAAFF,    // Light purple/lavender
                nose: 0x88CCFF,    // Light cyan-blue
                wings: 0x88EEFF,   // Cyan
                tail: 0xAADDFF,    // Light blue
                engines: 0xDDAAFF  // Light purple/lavender
            }
        },
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(-45, 8, -10), // Corridor orbit
            orbitRadius: 25,
            orbitHeight: 6,
            orbitSpeed: 0.5,
            colorScheme: {
                body: 0x88CCFF,    // Light cyan-blue
                nose: 0xDDAAFF,    // Light purple/lavender
                wings: 0xAADDFF,   // Light blue
                tail: 0x88EEFF,    // Cyan
                engines: 0x88CCFF  // Light cyan-blue
            }
        },
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(0, 15, 15), // High orbit above starting area
            orbitRadius: 30,
            orbitHeight: 10,
            orbitSpeed: 0.25,
            colorScheme: {
                body: 0x88EEFF,    // Cyan
                nose: 0x88CCFF,    // Light cyan-blue
                wings: 0xDDAAFF,   // Light purple/lavender
                tail: 0xAADDFF,    // Light blue
                engines: 0x88EEFF  // Cyan
            }
        }
    ]
};

