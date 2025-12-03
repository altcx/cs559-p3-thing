// Course geometry and setup
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';
import { getHolePosition } from './game.js';
import { createBumper, removeAllBumpers } from './bumpers.js';

// Course dimensions - will be set per course
let COURSE_WIDTH = 50;
let COURSE_HEIGHT = 50;
const DEFAULT_WALL_HEIGHT = 0.5; // Shorter walls for better ball visibility
const WALL_THICKNESS = 2.0; // Doubled from 1.0 for better aesthetics

let coursePlane = null;
let courseHump = null; // Hump/ramp in the middle
let walls = [];
let testWalls = []; // Test walls for Ghost Ball testing
let rectangularHoleWalls = []; // Walls inside rectangular holes (for when ball is falling)

function buildCourseShape(courseDef) {
    const shape = new THREE.Shape();

    if (courseDef && courseDef.isLShaped && courseDef.customWalls) {
        // Calculate interior boundaries from actual wall positions
        // Walls are positioned at their center, so interior is inside their bounds
        
        // Find the interior boundaries by analyzing wall positions
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        courseDef.customWalls.forEach(wall => {
            // Wall bounds: center ± half size
            const wallMinX = wall.x - wall.width / 2;
            const wallMaxX = wall.x + wall.width / 2;
            const wallMinZ = wall.z - wall.depth / 2;
            const wallMaxZ = wall.z + wall.depth / 2;
            
            // Interior is on the inside of each wall
            // For walls on the left (negative x), interior is to the right (x > wallMaxX)
            // For walls on the right (positive x), interior is to the left (x < wallMinX)
            // For walls at back (negative z), interior is forward (z > wallMaxZ)
            // For walls at front (positive z), interior is backward (z < wallMinZ)
        });
        
        // Based on the actual wall definitions:
        // Back wall: x: 0, z: -31, width: 17, depth: 2 -> interior z > -30
        // Left wall main: x: -8.5, z: -15, width: 2, depth: 32 -> interior x > -7.5
        // Left wall extension: x: -23.5, z: 15, width: 2, depth: 32 -> interior x > -22.5
        // Right wall: x: 8.5, z: 0, width: 2, depth: 62 -> interior x < 7.5
        // Top wall: x: -7.5, z: 31, width: 32, depth: 2 -> interior z < 30
        
        // Main rectangle: x: -7.5 to 7.5, z: -30 to 0
        // Extension: x: -22.5 to -7.5, z: 0 to 30
        
        // Trace clockwise around the interior boundary
        shape.moveTo(-7.5, -30);   // Bottom-left of main
        shape.lineTo(7.5, -30);     // Bottom-right of main
        shape.lineTo(7.5, 0);       // Top-right of main (front edge)
        shape.lineTo(-7.5, 0);      // Top-left of main (connection point)
        shape.lineTo(-22.5, 0);     // Bottom-left of extension
        shape.lineTo(-22.5, 30);    // Top-left of extension
        shape.lineTo(-7.5, 30);     // Top-right of extension
        shape.lineTo(-7.5, -30);    // Back to start (left edge of main)
        shape.closePath();
        return shape;
    }

    // Standard rectangular course
    const halfWidth = COURSE_WIDTH / 2;
    const halfHeight = COURSE_HEIGHT / 2;
    shape.moveTo(-halfWidth, -halfHeight);
    shape.lineTo(halfWidth, -halfHeight);
    shape.lineTo(halfWidth, halfHeight);
    shape.lineTo(-halfWidth, halfHeight);
    shape.closePath();
    return shape;
}
let rectangularHoleEdgeWalls = []; // Thin walls on top of rectangular holes (for collision when ball is above ground)
let customWalls = []; // Custom walls for L-shaped or other custom courses
let courseDefinition = null; // Current course definition

export function createCourse(courseDef = null) {
    // Store course definition
    courseDefinition = courseDef;
    
    // Set course dimensions from definition
    if (courseDef) {
        COURSE_WIDTH = courseDef.width;
        COURSE_HEIGHT = courseDef.height;
    }
    
    // ===== CREATE GRASS/COURSE SURFACE =====
    // Create grass that exactly matches the interior of the walls
    
    if (courseDef && courseDef.isLShaped && courseDef.customWalls) {
        // Calculate interior boundaries directly from wall positions
        // Walls are centered at their position, so interior is inside their bounds
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        courseDef.customWalls.forEach(wall => {
            const wallMinX = wall.x - wall.width / 2;
            const wallMaxX = wall.x + wall.width / 2;
            const wallMinZ = wall.z - wall.depth / 2;
            const wallMaxZ = wall.z + wall.depth / 2;
            
            // For left walls (negative x), interior is to the right (x > wallMaxX)
            if (wall.x < 0) {
                minX = Math.max(minX, wallMaxX);
            }
            // For right walls (positive x), interior is to the left (x < wallMinX)
            if (wall.x > 0) {
                maxX = Math.min(maxX, wallMinX);
            }
            // For back walls (negative z), interior is forward (z > wallMaxZ)
            if (wall.z < 0) {
                minZ = Math.max(minZ, wallMaxZ);
            }
            // For front/top walls (positive z), interior is backward (z < wallMinZ)
            if (wall.z > 0) {
                maxZ = Math.min(maxZ, wallMinZ);
            }
        });
        
        // For L-shape, we know the structure:
        // Main: x: -7.5 to 7.5, z: -30 to 0
        // Extension: x: -22.5 to -7.5, z: 0 to 30
        // Use exact values from wall calculations
        const mainMinX = -7.5, mainMaxX = 7.5, mainMinZ = -30, mainMaxZ = 0;
        const extMinX = -22.5, extMaxX = -7.5, extMinZ = 0, extMaxZ = 30;
        
        const courseShape = new THREE.Shape();
        // THREE.Shape: (x, y) where y becomes world z after rotation.x = -PI/2
        // Trace clockwise around the L-shape perimeter
        // Main: x: -7.5 to 7.5, z: -30 to 0
        // Extension: x: -22.5 to -7.5, z: 0 to 30
        courseShape.moveTo(-7.5, -30);    // Start: Bottom-left main
        courseShape.lineTo(7.5, -30);     // Bottom edge main
        courseShape.lineTo(7.5, 0);       // Right edge main (to front)
        courseShape.lineTo(-7.5, 0);      // Front edge main (connection point)
        courseShape.lineTo(-22.5, 0);     // Bottom edge extension (extends left)
        courseShape.lineTo(-22.5, 30);     // Left edge extension (extends up)
        courseShape.lineTo(-7.5, 30);      // Top edge extension
        courseShape.lineTo(-7.5, -30);     // Left edge main (back to start)
        courseShape.closePath();
        
        // Add hole cutout - hole position uses (x, z) coordinates
        const holePos = getHolePosition();
        const holePath = new THREE.Path();
        holePath.absarc(holePos.x, holePos.z, 2.0, 0, Math.PI * 2, false);
        courseShape.holes.push(holePath);
        
        // Add rectangular holes if any
        if (courseDef.rectangularHoles && courseDef.rectangularHoles.length > 0) {
            courseDef.rectangularHoles.forEach(rectHole => {
                const rectPath = new THREE.Path();
                const hw = rectHole.width / 2;
                const hl = rectHole.length / 2;
                rectPath.moveTo(rectHole.x - hw, rectHole.z - hl);
                rectPath.lineTo(rectHole.x + hw, rectHole.z - hl);
                rectPath.lineTo(rectHole.x + hw, rectHole.z + hl);
                rectPath.lineTo(rectHole.x - hw, rectHole.z + hl);
                rectPath.closePath();
                courseShape.holes.push(rectPath);
            });
        }
        
        const courseGeometry = new THREE.ShapeGeometry(courseShape);
        courseGeometry.computeVertexNormals();
        
        const courseMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x14cbee, 
            side: THREE.DoubleSide,
            metalness: 0.1,
            roughness: 0.3
        });
        
        // TEMPORARILY DISABLED FOR TESTING - Stage 4 grass plane
        // coursePlane = new THREE.Mesh(courseGeometry, courseMaterial);
        // coursePlane.rotation.x = -Math.PI / 2; // Rotate to horizontal
        // coursePlane.position.y = 0;
        // coursePlane.castShadow = true;
        // coursePlane.receiveShadow = true;
        // scene.add(coursePlane);
        
    } else {
        // Standard rectangular course
        const courseShape = buildCourseShape(courseDef);
        
        // Add hole cutout
        const holePos = getHolePosition();
        const holePath = new THREE.Path();
        holePath.absarc(holePos.x, holePos.z, 2.0, 0, Math.PI * 2, false);
        courseShape.holes.push(holePath);
        
        // Add rectangular holes if any
        if (courseDef && courseDef.rectangularHoles && courseDef.rectangularHoles.length > 0) {
            courseDef.rectangularHoles.forEach(rectHole => {
                const rectPath = new THREE.Path();
                const hw = rectHole.width / 2;
                const hl = rectHole.length / 2;
                rectPath.moveTo(rectHole.x - hw, rectHole.z - hl);
                rectPath.lineTo(rectHole.x + hw, rectHole.z - hl);
                rectPath.lineTo(rectHole.x + hw, rectHole.z + hl);
                rectPath.lineTo(rectHole.x - hw, rectHole.z + hl);
                rectPath.closePath();
                courseShape.holes.push(rectPath);
            });
        }
        
        let courseGeometry;
        if (courseDef && courseDef.terrainSlopes && courseDef.terrainSlopes.length > 0) {
            courseGeometry = new THREE.PlaneGeometry(COURSE_WIDTH, COURSE_HEIGHT, 50, 50);
            applyTerrainSlopes(courseGeometry, courseDef.terrainSlopes);
            cutHoleInTerrain(courseGeometry, getHolePosition());
            if (courseDef.rectangularHoles && courseDef.rectangularHoles.length > 0) {
                courseDef.rectangularHoles.forEach(rectHole => {
                    cutRectangularHoleInTerrain(courseGeometry, rectHole);
                });
            }
            courseGeometry.rotateX(-Math.PI / 2);
        } else {
            courseGeometry = new THREE.ShapeGeometry(courseShape);
        }
        courseGeometry.computeVertexNormals();
        
        const courseMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x14cbee, 
            side: THREE.DoubleSide,
            metalness: 0.1,
            roughness: 0.3
        });
        
        coursePlane = new THREE.Mesh(courseGeometry, courseMaterial);
        coursePlane.rotation.x = -Math.PI / 2;
        coursePlane.position.y = 0;
        coursePlane.castShadow = true;
        coursePlane.receiveShadow = true;
        scene.add(coursePlane);
    }
    
    // Create hump if course has one
    if (courseDef && courseDef.hasHump) {
        createHump(courseDef);
    }
    
    // Create custom walls if defined (for L-shaped or other custom courses)
    if (courseDef && courseDef.customWalls) {
        createCustomWalls(courseDef.customWalls, courseDef.wallHeight || DEFAULT_WALL_HEIGHT);
    } else if (!courseDef || !courseDef.isLShaped) {
        // Create walls around perimeter (standard rectangular course)
        createWalls(courseDef);
    }
    
    // Create bumpers if defined
    if (courseDef && courseDef.bumpers && courseDef.bumpers.length > 0) {
        courseDef.bumpers.forEach(bumperDef => {
            createBumper(
                bumperDef.position,
                bumperDef.radius || 1.0,
                bumperDef.tubeRadius || 0.3
            );
        });
    }
    
    // Create walls inside rectangular holes if defined
    if (courseDef && courseDef.rectangularHoles && courseDef.rectangularHoles.length > 0) {
        createRectangularHoleWalls(courseDef.rectangularHoles);
    }
    
    return {
        plane: coursePlane,
        hump: courseHump,
        walls: walls,
        width: COURSE_WIDTH,
        height: COURSE_HEIGHT
    };
}

function createHump(courseDef) {
    const humpPos = courseDef.humpPosition || new THREE.Vector3(0, 0, 0);
    const humpHeight = courseDef.humpHeight || 1.5;
    const humpWidth = courseDef.humpWidth || COURSE_WIDTH; // Full course width
    const humpRadius = courseDef.humpRadius || 8; // Radius of the hump curve
    
    // Create a terrain hump that the ball can roll over
    // Use a cylinder rotated 90 degrees around X axis to create a ramp across the course width
    // This creates a smooth hump that spans the full width
    const humpGeometry = new THREE.CylinderGeometry(
        humpRadius, // Top radius (larger = wider hump)
        humpRadius, // Bottom radius (same for smooth hump)
        humpWidth,   // Height of cylinder = width of hump across course
        32           // Segments for smooth curve
    );
    
    const humpMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({ color: 0x14cbee })
        : new THREE.MeshStandardMaterial({ color: 0x14cbee });
    
    courseHump = new THREE.Mesh(humpGeometry, humpMaterial);
    
    // Rotate 90 degrees around X axis so cylinder becomes a hump across the course width
    courseHump.rotation.x = Math.PI / 2;
    
    // Position so the hump sits on the ground and the top is at humpHeight
    // The cylinder's center is at its midpoint, so we position it so the top touches ground + humpHeight
    courseHump.position.set(
        humpPos.x, 
        humpHeight, // Top of hump is at this height
        humpPos.z
    );
    
    courseHump.receiveShadow = true;
    courseHump.castShadow = true;
    
    // Store hump data for collision detection
    courseHump.userData.isTerrain = true;
    courseHump.userData.humpHeight = humpHeight;
    courseHump.userData.humpRadius = humpRadius;
    courseHump.userData.humpPosition = humpPos;
    
    scene.add(courseHump);
}

function createWalls(courseDef = null) {
    // Reset walls arrays
    walls = [];
    testWalls = [];
    
    // Different colors for different walls
    const wallColors = {
        north: 0xff0000,      // Red
        south: 0x0000ff,      // Blue
        east: 0x00ff00,       // Green
        west: 0xffff00,       // Yellow
        extended: 0x800080,   // Purple (darker)
        test: 0xff8800        // Orange
    };
    
    function createWallWithColor(width, height, depth, color) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = isFullMode
            ? new THREE.MeshStandardMaterial({ 
                color: color,
                metalness: 0.1,
                roughness: 0.3
            })
            : new THREE.MeshStandardMaterial({ 
                color: color,
                metalness: 0.1,
                roughness: 0.3
            });
        const wall = new THREE.Mesh(geometry, material);
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
        return wall;
    }
    
    const INFINITE_WALL_HEIGHT = 1000; // Very tall to look like they go on forever
    
    // Get wall height from course definition or use default
    let baseWallHeight = courseDef?.wallHeight || DEFAULT_WALL_HEIGHT;
    let humpWallHeight = baseWallHeight;
    
    if (courseDef && courseDef.hasHump) {
        humpWallHeight = baseWallHeight + (courseDef.humpHeight || 1.5);
    }
    
    // North wall (top) - higher in middle if hump exists
    if (courseDef && courseDef.hasHump) {
        // Create segmented wall that follows hump
        const humpPos = courseDef.humpPosition || new THREE.Vector3(0, 0, 0);
        const humpWidth = courseDef.humpWidth || 8;
        
        // Left segment
        const leftWall = createWallWithColor((COURSE_WIDTH - humpWidth) / 2 + WALL_THICKNESS, baseWallHeight, WALL_THICKNESS, wallColors.north);
        leftWall.position.set(-(COURSE_WIDTH + humpWidth) / 4, baseWallHeight / 2, -COURSE_HEIGHT / 2 - WALL_THICKNESS / 2);
        walls.push(leftWall);
        
        // Middle segment (over hump) - taller
        const middleWall = createWallWithColor(humpWidth + WALL_THICKNESS * 2, humpWallHeight, WALL_THICKNESS, wallColors.north);
        middleWall.position.set(humpPos.x, humpWallHeight / 2, -COURSE_HEIGHT / 2 - WALL_THICKNESS / 2);
        walls.push(middleWall);
        
        // Right segment
        const rightWall = createWallWithColor((COURSE_WIDTH - humpWidth) / 2 + WALL_THICKNESS, baseWallHeight, WALL_THICKNESS, wallColors.north);
        rightWall.position.set((COURSE_WIDTH + humpWidth) / 4, baseWallHeight / 2, -COURSE_HEIGHT / 2 - WALL_THICKNESS / 2);
        walls.push(rightWall);
    } else {
        // Normal wall
        const northWall = createWallWithColor(COURSE_WIDTH + WALL_THICKNESS * 2, baseWallHeight, WALL_THICKNESS, wallColors.north);
        northWall.position.set(0, baseWallHeight / 2, -COURSE_HEIGHT / 2 - WALL_THICKNESS / 2);
        walls.push(northWall);
    }
    
    // South wall (bottom) - same logic
    if (courseDef && courseDef.hasHump) {
        const humpPos = courseDef.humpPosition || new THREE.Vector3(0, 0, 0);
        const humpWidth = courseDef.humpWidth || 8;
        
        const leftWall = createWallWithColor((COURSE_WIDTH - humpWidth) / 2 + WALL_THICKNESS, baseWallHeight, WALL_THICKNESS, wallColors.south);
        leftWall.position.set(-(COURSE_WIDTH + humpWidth) / 4, baseWallHeight / 2, COURSE_HEIGHT / 2 + WALL_THICKNESS / 2);
        walls.push(leftWall);
        
        const middleWall = createWallWithColor(humpWidth + WALL_THICKNESS * 2, humpWallHeight, WALL_THICKNESS, wallColors.south);
        middleWall.position.set(humpPos.x, humpWallHeight / 2, COURSE_HEIGHT / 2 + WALL_THICKNESS / 2);
        walls.push(middleWall);
        
        const rightWall = createWallWithColor((COURSE_WIDTH - humpWidth) / 2 + WALL_THICKNESS, baseWallHeight, WALL_THICKNESS, wallColors.south);
        rightWall.position.set((COURSE_WIDTH + humpWidth) / 4, baseWallHeight / 2, COURSE_HEIGHT / 2 + WALL_THICKNESS / 2);
        walls.push(rightWall);
    } else {
        const southWall = createWallWithColor(COURSE_WIDTH + WALL_THICKNESS * 2, baseWallHeight, WALL_THICKNESS, wallColors.south);
        southWall.position.set(0, baseWallHeight / 2, COURSE_HEIGHT / 2 + WALL_THICKNESS / 2);
        walls.push(southWall);
    }
    
    // East wall (right) - full height
    const eastWall = createWallWithColor(WALL_THICKNESS, humpWallHeight, COURSE_HEIGHT + WALL_THICKNESS * 2, wallColors.east);
    eastWall.position.set(COURSE_WIDTH / 2 + WALL_THICKNESS / 2, humpWallHeight / 2, 0);
    walls.push(eastWall);
    
    // West wall (left) - full height
    const westWall = createWallWithColor(WALL_THICKNESS, humpWallHeight, COURSE_HEIGHT + WALL_THICKNESS * 2, wallColors.west);
    westWall.position.set(-COURSE_WIDTH / 2 - WALL_THICKNESS / 2, humpWallHeight / 2, 0);
    walls.push(westWall);
    
    // Create extended walls that go down forever (very tall)
    function createExtendedWall(width, height, depth, color) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = isFullMode
            ? new THREE.MeshStandardMaterial({ 
                color: color,
                metalness: 0.1,
                roughness: 0.3
            })
            : new THREE.MeshStandardMaterial({ 
                color: color,
                metalness: 0.1,
                roughness: 0.3
            });
        const wall = new THREE.Mesh(geometry, material);
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
        return wall;
    }
    
    // Create extended walls below the visible walls
    // North wall (top) - extended downward
    const northExtendedWall = createExtendedWall(COURSE_WIDTH + WALL_THICKNESS * 2, INFINITE_WALL_HEIGHT, WALL_THICKNESS, wallColors.extended);
    northExtendedWall.position.set(0, -INFINITE_WALL_HEIGHT / 2, -COURSE_HEIGHT / 2 - WALL_THICKNESS / 2);
    walls.push(northExtendedWall);
    
    // South wall (bottom) - extended downward
    const southExtendedWall = createExtendedWall(COURSE_WIDTH + WALL_THICKNESS * 2, INFINITE_WALL_HEIGHT, WALL_THICKNESS, wallColors.extended);
    southExtendedWall.position.set(0, -INFINITE_WALL_HEIGHT / 2, COURSE_HEIGHT / 2 + WALL_THICKNESS / 2);
    walls.push(southExtendedWall);
    
    // East wall (right) - extended downward
    const eastExtendedWall = createExtendedWall(WALL_THICKNESS, INFINITE_WALL_HEIGHT, COURSE_HEIGHT + WALL_THICKNESS * 2, wallColors.extended);
    eastExtendedWall.position.set(COURSE_WIDTH / 2 + WALL_THICKNESS / 2, -INFINITE_WALL_HEIGHT / 2, 0);
    walls.push(eastExtendedWall);
    
    // West wall (left) - extended downward
    const westExtendedWall = createExtendedWall(WALL_THICKNESS, INFINITE_WALL_HEIGHT, COURSE_HEIGHT + WALL_THICKNESS * 2, wallColors.extended);
    westExtendedWall.position.set(-COURSE_WIDTH / 2 - WALL_THICKNESS / 2, -INFINITE_WALL_HEIGHT / 2, 0);
    walls.push(westExtendedWall);
    
    // Create test walls if defined in course
    if (courseDef && courseDef.testWalls && courseDef.testWalls.length > 0) {
        console.log('Creating', courseDef.testWalls.length, 'test walls');
        courseDef.testWalls.forEach((wallDef, index) => {
            console.log(`Creating test wall ${index}:`, wallDef);
            const testWall = createWallWithColor(wallDef.width, wallDef.height, wallDef.length, wallColors.test);
            testWall.position.set(
                wallDef.position.x,
                wallDef.height / 2,
                wallDef.position.z
            );
            testWall.rotation.y = wallDef.rotation || 0;
            testWall.userData.isTestWall = true;
            // Store wall properties for accurate collision detection
            testWall.userData.wallWidth = wallDef.width;
            testWall.userData.wallLength = wallDef.length;
            testWall.userData.wallHeight = wallDef.height;
            // Keep AABB bounds for quick rejection (but collision uses accurate local space check)
            const cosRot = Math.cos(wallDef.rotation || 0);
            const sinRot = Math.sin(wallDef.rotation || 0);
            const halfWidth = wallDef.width / 2;
            const halfLength = wallDef.length / 2;
            testWall.userData.wallBounds = {
                minX: wallDef.position.x - Math.abs(halfWidth * cosRot) - Math.abs(halfLength * sinRot),
                maxX: wallDef.position.x + Math.abs(halfWidth * cosRot) + Math.abs(halfLength * sinRot),
                minZ: wallDef.position.z - Math.abs(halfLength * cosRot) - Math.abs(halfWidth * sinRot),
                maxZ: wallDef.position.z + Math.abs(halfLength * cosRot) + Math.abs(halfWidth * sinRot),
                minY: 0,
                maxY: wallDef.height
            };
            walls.push(testWall);
            testWalls.push(testWall);
        });
        console.log('Total test walls created:', testWalls.length);
    } else {
        console.log('No test walls to create. Course def:', courseDef?.testWalls);
    }
}

function createRectangularHoleWalls(rectangularHoles) {
    // Create walls inside each rectangular hole to prevent seeing through
    // Use same infinite height as perimeter walls
    const INFINITE_WALL_HEIGHT = 1000; // Very tall to look like they go on forever
    const EDGE_WALL_HEIGHT = 2.0; // Height of edge walls (above ground)
    const EDGE_WALL_THICKNESS = 0.01; // Very thin for edge walls (almost invisible)
    const INTERIOR_WALL_THICKNESS = 0.2;
    
    // Different colors for rectangular hole walls
    const holeWallColors = {
        left: 0xff00ff,   // Magenta
        right: 0x00ffff,  // Cyan
        front: 0xff8800,  // Orange
        back: 0x8800ff    // Purple
    };
    
    rectangularHoles.forEach((rectHole, holeIndex) => {
        const halfWidth = rectHole.width / 2;
        const halfLength = rectHole.length / 2;
        
        // No edge barriers - removed to prevent interference with low-speed balls
        
        // Create interior walls (deep inside the hole, extending downward)
        // These prevent the ball from escaping once it's deep in the hole
        const INTERIOR_WALL_DEPTH = INFINITE_WALL_HEIGHT; // Very deep
        
        // Left interior wall
        const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(INTERIOR_WALL_THICKNESS, INTERIOR_WALL_DEPTH, rectHole.length),
            new THREE.MeshStandardMaterial({ 
                color: holeWallColors.left,
                metalness: 0.1,
                roughness: 0.7
            })
        );
        leftWall.position.set(rectHole.x - halfWidth, -INTERIOR_WALL_DEPTH / 2, rectHole.z);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        leftWall.userData.isRectangularHoleWall = true;
        leftWall.userData.rectangularHole = rectHole;
        leftWall.userData.wallType = 'left';
        rectangularHoleWalls.push(leftWall);
        scene.add(leftWall);
        
        // Right interior wall
        const rightWall = new THREE.Mesh(
            new THREE.BoxGeometry(INTERIOR_WALL_THICKNESS, INTERIOR_WALL_DEPTH, rectHole.length),
            new THREE.MeshStandardMaterial({ 
                color: holeWallColors.right,
                metalness: 0.1,
                roughness: 0.7
            })
        );
        rightWall.position.set(rectHole.x + halfWidth, -INTERIOR_WALL_DEPTH / 2, rectHole.z);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        rightWall.userData.isRectangularHoleWall = true;
        rightWall.userData.rectangularHole = rectHole;
        rightWall.userData.wallType = 'right';
        rectangularHoleWalls.push(rightWall);
        scene.add(rightWall);
        
        // Front interior wall
        const frontWall = new THREE.Mesh(
            new THREE.BoxGeometry(rectHole.width, INTERIOR_WALL_DEPTH, INTERIOR_WALL_THICKNESS),
            new THREE.MeshStandardMaterial({ 
                color: holeWallColors.front,
                metalness: 0.1,
                roughness: 0.7
            })
        );
        frontWall.position.set(rectHole.x, -INTERIOR_WALL_DEPTH / 2, rectHole.z - halfLength);
        frontWall.castShadow = true;
        frontWall.receiveShadow = true;
        frontWall.userData.isRectangularHoleWall = true;
        frontWall.userData.rectangularHole = rectHole;
        frontWall.userData.wallType = 'front';
        rectangularHoleWalls.push(frontWall);
        scene.add(frontWall);
        
        // Back interior wall
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(rectHole.width, INTERIOR_WALL_DEPTH, INTERIOR_WALL_THICKNESS),
            new THREE.MeshStandardMaterial({ 
                color: holeWallColors.back,
                metalness: 0.1,
                roughness: 0.7
            })
        );
        backWall.position.set(rectHole.x, -INTERIOR_WALL_DEPTH / 2, rectHole.z + halfLength);
        backWall.castShadow = true;
        backWall.receiveShadow = true;
        backWall.userData.isRectangularHoleWall = true;
        backWall.userData.rectangularHole = rectHole;
        backWall.userData.wallType = 'back';
        rectangularHoleWalls.push(backWall);
        scene.add(backWall);
    });
}

export function getCourseBounds() {
    // Check if this is an L-shaped course
    if (courseDefinition && courseDefinition.isLShaped) {
        // L-shape: main rectangle (-7.5 to 7.5, -30 to 0) + extension (-22.5 to -7.5, 0 to 30)
        // Both parts are equal size: 15 wide, 30 long
        // Extension connects at the front (z=0) of the main rectangle, turning LEFT
        return {
            minX: -22.5, // Extended to the left (matches course shape)
            maxX: 7.5,
            minZ: -30,
            maxZ: 30, // Extended upward (matches course shape)
            width: 30,
            height: 60
        };
    }
    
    // Standard rectangular course
    return {
        minX: -COURSE_WIDTH / 2,
        maxX: COURSE_WIDTH / 2,
        minZ: -COURSE_HEIGHT / 2,
        maxZ: COURSE_HEIGHT / 2,
        width: COURSE_WIDTH,
        height: COURSE_HEIGHT
    };
}

export function getRectangularHoles() {
    if (!courseDefinition || !courseDefinition.rectangularHoles) {
        return [];
    }
    return courseDefinition.rectangularHoles;
}

export function getRectangularHoleWalls() {
    return rectangularHoleWalls;
}

export function getRectangularHoleEdgeWalls() {
    return rectangularHoleEdgeWalls;
}

export function removeAllRectangularHoleWalls() {
    // Remove edge walls
    rectangularHoleEdgeWalls.forEach(wall => {
        scene.remove(wall);
        wall.geometry?.dispose();
        wall.material?.dispose();
    });
    rectangularHoleEdgeWalls = [];

    // Remove interior walls
    rectangularHoleWalls.forEach(wall => {
        scene.remove(wall);
        wall.geometry?.dispose();
        wall.material?.dispose();
    });
    rectangularHoleWalls = [];
}

export function removeAllCustomWalls() {
    // Remove all custom wall sections from scene
    customWalls.forEach(wall => {
        scene.remove(wall);
        wall.geometry.dispose();
        wall.material.dispose();
    });
    customWalls = [];
    
    // Remove visual facades
    const facadesToRemove = [];
    scene.traverse((child) => {
        if (child.userData && child.userData.isVisualFacade) {
            facadesToRemove.push(child);
        }
    });
    
    facadesToRemove.forEach(facade => {
        scene.remove(facade);
        facade.geometry.dispose();
        facade.material.dispose();
    });
}

// Terrain slope functions for creating hills and valleys
function applyTerrainSlopes(geometry, terrainSlopes) {
    const positions = geometry.attributes.position;
    const vertices = positions.array;

    // Apply each terrain slope
    terrainSlopes.forEach(slope => {
        const center = slope.center;
        const height = slope.height;
        const radius = slope.radius;
        const shape = slope.shape; // 'peak' or 'valley'

        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];     // X coordinate on plane surface
            const y = vertices[i + 1]; // Y coordinate on plane surface (will become Z after rotation)

            // Calculate distance from slope center using surface coordinates
            const distance = Math.sqrt(
                Math.pow(x - center.x, 2) +
                Math.pow(y - center.z, 2) // Y becomes Z after rotation, so use center.z
            );

            // Only affect vertices within the slope radius
            if (distance < radius) {
                // Calculate height factor (0 at edge, 1 at center)
                const heightFactor = 1 - (distance / radius);

                // Apply different formulas for peaks vs valleys
                let slopeHeight;
                if (shape === 'peak') {
                    // Smooth peak using cosine function
                    slopeHeight = height * Math.pow(Math.cos(heightFactor * Math.PI / 2), 2);
                } else if (shape === 'valley') {
                    // Smooth valley (negative peak)
                    slopeHeight = -Math.abs(height) * Math.pow(Math.cos(heightFactor * Math.PI / 2), 2);
                }

                // Add slope height to vertex Z position (which becomes Y after rotation)
                vertices[i + 2] += slopeHeight;
            }
        }
    });

    // Update geometry after modifying vertices
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
}

function cutHoleInTerrain(geometry, holePosition) {
    const positions = geometry.attributes.position;
    const vertices = positions.array;
    const HOLE_RADIUS = 2.0;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];     // Final X coordinate
        const y = vertices[i + 1]; // Becomes final Z coordinate after rotation

        // Calculate distance from hole center using final coordinates
        const distance = Math.sqrt(
            Math.pow(x - holePosition.x, 2) +
            Math.pow(y - holePosition.z, 2) // y becomes z after rotation
        );

        // If within hole radius, set height to a very low value (cutting a hole)
        if (distance < HOLE_RADIUS) {
            vertices[i + 2] = -10.0; // Deep hole (Z coordinate becomes Y after rotation)
        }
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
}

function cutRectangularHoleInTerrain(geometry, rectHole) {
    const positions = geometry.attributes.position;
    const vertices = positions.array;
    const halfWidth = rectHole.width / 2;
    const halfLength = rectHole.length / 2;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];     // Final X coordinate
        const y = vertices[i + 1]; // Becomes final Z coordinate after rotation

        // Check if vertex is within rectangular hole bounds using final coordinates
        if (x >= rectHole.x - halfWidth && x <= rectHole.x + halfWidth &&
            y >= rectHole.z - halfLength && y <= rectHole.z + halfLength) { // y becomes z after rotation
            vertices[i + 2] = -10.0; // Deep rectangular hole (Z becomes Y after rotation)
        }
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
}

export function getTestWalls() {
    return testWalls;
}

export function getCustomWalls() {
    return customWalls;
}

// Simple custom wall creation function
// Each wall is defined with: { x, z, width, depth } - center position and size
function createCustomWalls(wallDefs, wallHeight) {
    // Clear previous custom walls
    customWalls = [];
    
    // Different colors for each custom wall
    const customWallColors = [
        0xff0066,  // Hot pink
        0x00ff66,  // Bright green
        0x0066ff,  // Bright blue
        0xff6600,  // Bright orange
        0x6600ff,  // Bright purple
        0x00ffff,  // Cyan
        0xffff00,  // Yellow
        0xff00ff   // Magenta
    ];
    
    wallDefs.forEach((wallDef, index) => {
        const width = wallDef.width;
        const depth = wallDef.depth;
        const height = wallHeight;
        
        // Cycle through colors for each wall
        const wallColor = customWallColors[index % customWallColors.length];
        
        // Create the actual collision wall (visible part)
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = isFullMode
            ? new THREE.MeshStandardMaterial({
                color: wallColor,
                metalness: 0.1,
                roughness: 0.7
            })
            : new THREE.MeshBasicMaterial({ color: wallColor });

        const wallMesh = new THREE.Mesh(geometry, material);
        wallMesh.position.set(wallDef.x, height / 2, wallDef.z);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;

        // Store bounds for collision detection (simple AABB)
        wallMesh.userData.isCustomWall = true;
        wallMesh.userData.bounds = {
            minX: wallDef.x - width / 2,
            maxX: wallDef.x + width / 2,
            minZ: wallDef.z - depth / 2,
            maxZ: wallDef.z + depth / 2
        };

        scene.add(wallMesh);
        customWalls.push(wallMesh);
        
        // Create visual facade that extends downward (no collision, just visual)
        // Use darker version of the wall color for the facade
        const facadeDepth = 50; // How far down the facade extends
        const facadeGeometry = new THREE.BoxGeometry(width, facadeDepth, depth);
        const facadeColor = wallColor * 0.7; // Darker version
        const facadeMaterial = isFullMode
            ? new THREE.MeshStandardMaterial({
                color: facadeColor,
                metalness: 0.1,
                roughness: 0.8,
                side: THREE.DoubleSide
            })
            : new THREE.MeshBasicMaterial({ 
                color: facadeColor,
                side: THREE.DoubleSide
            });
        
        const facadeMesh = new THREE.Mesh(facadeGeometry, facadeMaterial);
        facadeMesh.position.set(wallDef.x, -facadeDepth / 2, wallDef.z);
        facadeMesh.castShadow = false; // Facade doesn't cast shadows
        facadeMesh.receiveShadow = false;
        facadeMesh.userData.isVisualFacade = true; // Mark as visual only
        
        scene.add(facadeMesh);
    });
}

export function getTerrainHeight(x, z) {
    // Simple flat terrain - all ground is at y=0
    return 0;
}

export function getCourseHump() {
    return courseHump;
}

