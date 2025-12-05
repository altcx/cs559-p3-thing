// Level 1: Long rectangle (straight)
import * as THREE from 'three';

export const level1 = {
    width: 15,  // Narrow width (left-right)
    height: 60, // Long length (front-back)
    holePosition: new THREE.Vector3(0, 0, 25),
    ballStartPosition: new THREE.Vector3(0, 0.5, -25),
    hasHump: false,
    powerUpPositions: [], // No power-ups on hole 1
    // Floor polygons - defined by corner coordinates
    floorPolygons: [
        [
            { x: -8, z: -30.5 },
            { x: 8.5, z: -30.5 },
            { x: 8, z: 31 },
            { x: -9, z: 31 }
        ]
    ],
    // Rotating fans (windmills) that push the ball
    fans: [
        {
            x: 0,               // X position
            z: 4,               // Z position
            radius: 3.0,         // Fan radius
            height: 0.1,         // Fan height (thin, on ground)
            numBlades: 4,        // Number of fan blades
            rotationSpeed: 2.0,  // Rotation speed (radians per second, counter-clockwise)
            pushStrength: 8.0,   // How strong the fan pushes the ball
            bladeLengthMultiplier: 1.6,
            color: 0x888888     // Fan color (gray)
        }
    ],
    // Procedurally generated floating islands around the course
    models: [
        // Large floating islands closer to course with gradients
        {
            type: 'floatingIsland',
            geometry: 'proceduralIsland',
            position: new THREE.Vector3(-28, 3, -18),
            baseColor: 0x8B7D6B, // Warm brown/taupe
            secondaryColor: 0x9CAF88, // Sage green for vegetation
            textureType: 'earth',
            gradientEnabled: true,
            scale: 1.8,
            rotation: new THREE.Euler(0, 0.7, 0)
        },
        {
            type: 'floatingIsland',
            geometry: 'proceduralIsland',
            position: new THREE.Vector3(35, 4.5, 12),
            baseColor: 0xA0522D, // Sienna brown
            secondaryColor: 0x228B22, // Forest green
            textureType: 'rocky',
            gradientEnabled: true,
            scale: 2.2,
            rotation: new THREE.Euler(0, -0.5, 0)
        },
        {
            type: 'floatingIsland',
            geometry: 'proceduralIsland',
            position: new THREE.Vector3(-32, 2.5, 28),
            baseColor: 0x696969, // Dim gray
            secondaryColor: 0x32CD32, // Lime green accents
            textureType: 'mixed',
            gradientEnabled: true,
            scale: 1.6,
            rotation: new THREE.Euler(0, 1.2, 0)
        },
        {
            type: 'floatingIsland',
            geometry: 'proceduralIsland',
            position: new THREE.Vector3(30, 3.5, -25),
            baseColor: 0x8B4513, // Saddle brown
            secondaryColor: 0x9ACD32, // Yellow green
            textureType: 'grassy',
            gradientEnabled: true,
            scale: 1.9,
            rotation: new THREE.Euler(0, 0.3, 0)
        },
        // Smaller island clusters closer to course
        {
            type: 'floatingIsland',
            geometry: 'proceduralIsland',
            position: new THREE.Vector3(-38, 2, 6),
            baseColor: 0xCD853F, // Peru brown
            secondaryColor: 0x40E0D0, // Turquoise accents
            textureType: 'sandy',
            gradientEnabled: true,
            scale: 1.0,
            rotation: new THREE.Euler(0, 0.9, 0)
        },
        {
            type: 'floatingIsland',
            geometry: 'proceduralIsland',
            position: new THREE.Vector3(38, 3.8, -8),
            baseColor: 0x708090, // Slate gray
            secondaryColor: 0x98FB98, // Pale green
            textureType: 'forested',
            gradientEnabled: true,
            scale: 1.3,
            rotation: new THREE.Euler(0, -0.8, 0)
        },
        // Flying machine that orbits around the course
        {
            type: 'flyingMachine',
            geometry: 'flyingMachine',
            position: new THREE.Vector3(0, 6, 0), // Start at course center
            orbitRadius: 25, // Orbit radius around course
            orbitHeight: 5, // Height above ground
            orbitSpeed: 0.3 // Slow, majestic orbit
        },
        // Iridescent Crystal Obelisks - Tall thin crystals (Level 5 color scheme)
        {
            type: 'iridescentObelisk',
            geometry: 'iridescentObelisk',
            position: new THREE.Vector3(-22, 0, -10),
            height: 35,
            width: 3,
            color: 0x88CCFF, // Light cyan-blue (Giant Arch color)
            intensity: 1.2
        },
        {
            type: 'iridescentObelisk',
            geometry: 'iridescentObelisk',
            position: new THREE.Vector3(25, 0, 15),
            height: 40,
            width: 2.5,
            color: 0xAADDFF, // Light blue (Giant Spiral color)
            intensity: 1.3
        },
        // Floating Iridescent Rings - Circular hoops (Level 5 color scheme)
        {
            type: 'floatingIridescentRing',
            geometry: 'floatingIridescentRing',
            position: new THREE.Vector3(-30, 15, 5),
            radius: 8,
            tubeRadius: 1.2,
            color: 0xDDAAFF, // Light purple/lavender (Giant Ring Gate color)
            rotationAxis: new THREE.Vector3(0, 1, 0.3)
        },
        {
            type: 'floatingIridescentRing',
            geometry: 'floatingIridescentRing',
            position: new THREE.Vector3(28, 12, -15),
            radius: 6,
            tubeRadius: 0.8,
            color: 0x88EEFF, // Cyan (Giant Crystal Pillar color)
            rotationAxis: new THREE.Vector3(0.2, 1, 0)
        },
        // Prismatic Pyramid - Multi-faceted glowing pyramid (Level 5 color scheme)
        {
            type: 'prismaticPyramid',
            geometry: 'prismaticPyramid',
            position: new THREE.Vector3(20, 0, 25),
            size: 12,
            height: 18,
            color: 0x88CCFF // Light cyan-blue (Giant Arch color)
        }
    ]
};

