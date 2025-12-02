// Course geometry and setup
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';
import { getHolePosition } from './game.js';

// Course dimensions - will be set per course
let COURSE_WIDTH = 50;
let COURSE_HEIGHT = 50;
const DEFAULT_WALL_HEIGHT = 2;
const WALL_THICKNESS = 2.0; // Doubled from 1.0 for better aesthetics

let coursePlane = null;
let courseHump = null; // Hump/ramp in the middle
let walls = [];
let courseDefinition = null; // Current course definition

export function createCourse(courseDef = null) {
    // Store course definition
    courseDefinition = courseDef;
    
    // Set course dimensions from definition
    if (courseDef) {
        COURSE_WIDTH = courseDef.width;
        COURSE_HEIGHT = courseDef.height;
    }
    
    // Create course floor with a hole cut out
    // Use ShapeGeometry to create a plane with a hole
    const courseShape = new THREE.Shape();
    courseShape.moveTo(-COURSE_WIDTH / 2, -COURSE_HEIGHT / 2);
    courseShape.lineTo(COURSE_WIDTH / 2, -COURSE_HEIGHT / 2);
    courseShape.lineTo(COURSE_WIDTH / 2, COURSE_HEIGHT / 2);
    courseShape.lineTo(-COURSE_WIDTH / 2, COURSE_HEIGHT / 2);
    courseShape.lineTo(-COURSE_WIDTH / 2, -COURSE_HEIGHT / 2);
    
    // Add hole (will be positioned at hole location)
    // Get hole position from game.js
    const holePos = getHolePosition();
    const holeX = holePos.x; // Hole X position relative to course center
    const holeZ = holePos.z; // Hole Z position relative to course center
    const HOLE_RADIUS = 2.0; // Match game.js
    
    const holePath = new THREE.Path();
    holePath.absarc(holeX, holeZ, HOLE_RADIUS, 0, Math.PI * 2, false);
    courseShape.holes.push(holePath);
    
    const courseGeometry = new THREE.ShapeGeometry(courseShape);
    // Ensure proper normals for lighting
    courseGeometry.computeVertexNormals();
    
    // Material based on mode - use MeshBasicMaterial for pure colors without lighting
    const courseMaterial = isFullMode 
        ? new THREE.MeshBasicMaterial({ 
            color: 0x14cbee, 
            side: THREE.DoubleSide
        })
        : new THREE.MeshBasicMaterial({ 
            color: 0x14cbee, 
            side: THREE.DoubleSide
        });
    
    coursePlane = new THREE.Mesh(courseGeometry, courseMaterial);
    coursePlane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    coursePlane.position.y = 0;
    coursePlane.receiveShadow = true; // Enable shadows on course
    scene.add(coursePlane);
    
    // Create hump if course has one
    if (courseDef && courseDef.hasHump) {
        createHump(courseDef);
    }
    
    // Create walls around perimeter (with hump height if applicable)
    createWalls(courseDef);
    
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
    const wallMaterial = isFullMode
        ? new THREE.MeshBasicMaterial({ color: 0xe5c4ee }) // Light purple for full mode
        : new THREE.MeshBasicMaterial({ color: 0xe5c4ee }); // Light purple for prototype
    
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
        const leftWall = createWall((COURSE_WIDTH - humpWidth) / 2 + WALL_THICKNESS, baseWallHeight, WALL_THICKNESS);
        leftWall.position.set(-(COURSE_WIDTH + humpWidth) / 4, baseWallHeight / 2, -COURSE_HEIGHT / 2 - WALL_THICKNESS / 2);
        walls.push(leftWall);
        
        // Middle segment (over hump) - taller
        const middleWall = createWall(humpWidth + WALL_THICKNESS * 2, humpWallHeight, WALL_THICKNESS);
        middleWall.position.set(humpPos.x, humpWallHeight / 2, -COURSE_HEIGHT / 2 - WALL_THICKNESS / 2);
        walls.push(middleWall);
        
        // Right segment
        const rightWall = createWall((COURSE_WIDTH - humpWidth) / 2 + WALL_THICKNESS, baseWallHeight, WALL_THICKNESS);
        rightWall.position.set((COURSE_WIDTH + humpWidth) / 4, baseWallHeight / 2, -COURSE_HEIGHT / 2 - WALL_THICKNESS / 2);
        walls.push(rightWall);
    } else {
        // Normal wall
        const northWall = createWall(COURSE_WIDTH + WALL_THICKNESS * 2, baseWallHeight, WALL_THICKNESS);
        northWall.position.set(0, baseWallHeight / 2, -COURSE_HEIGHT / 2 - WALL_THICKNESS / 2);
        walls.push(northWall);
    }
    
    // South wall (bottom) - same logic
    if (courseDef && courseDef.hasHump) {
        const humpPos = courseDef.humpPosition || new THREE.Vector3(0, 0, 0);
        const humpWidth = courseDef.humpWidth || 8;
        
        const leftWall = createWall((COURSE_WIDTH - humpWidth) / 2 + WALL_THICKNESS, baseWallHeight, WALL_THICKNESS);
        leftWall.position.set(-(COURSE_WIDTH + humpWidth) / 4, baseWallHeight / 2, COURSE_HEIGHT / 2 + WALL_THICKNESS / 2);
        walls.push(leftWall);
        
        const middleWall = createWall(humpWidth + WALL_THICKNESS * 2, humpWallHeight, WALL_THICKNESS);
        middleWall.position.set(humpPos.x, humpWallHeight / 2, COURSE_HEIGHT / 2 + WALL_THICKNESS / 2);
        walls.push(middleWall);
        
        const rightWall = createWall((COURSE_WIDTH - humpWidth) / 2 + WALL_THICKNESS, baseWallHeight, WALL_THICKNESS);
        rightWall.position.set((COURSE_WIDTH + humpWidth) / 4, baseWallHeight / 2, COURSE_HEIGHT / 2 + WALL_THICKNESS / 2);
        walls.push(rightWall);
    } else {
        const southWall = createWall(COURSE_WIDTH + WALL_THICKNESS * 2, baseWallHeight, WALL_THICKNESS);
        southWall.position.set(0, baseWallHeight / 2, COURSE_HEIGHT / 2 + WALL_THICKNESS / 2);
        walls.push(southWall);
    }
    
    // East wall (right) - full height
    const eastWall = createWall(WALL_THICKNESS, humpWallHeight, COURSE_HEIGHT + WALL_THICKNESS * 2);
    eastWall.position.set(COURSE_WIDTH / 2 + WALL_THICKNESS / 2, humpWallHeight / 2, 0);
    walls.push(eastWall);
    
    // West wall (left) - full height
    const westWall = createWall(WALL_THICKNESS, humpWallHeight, COURSE_HEIGHT + WALL_THICKNESS * 2);
    westWall.position.set(-COURSE_WIDTH / 2 - WALL_THICKNESS / 2, humpWallHeight / 2, 0);
    walls.push(westWall);
    
    function createWall(width, height, depth) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const wall = new THREE.Mesh(geometry, wallMaterial);
        wall.castShadow = false; // Disable shadows to keep colors bright
        wall.receiveShadow = false;
        scene.add(wall);
        return wall;
    }
}

export function getCourseBounds() {
    return {
        minX: -COURSE_WIDTH / 2,
        maxX: COURSE_WIDTH / 2,
        minZ: -COURSE_HEIGHT / 2,
        maxZ: COURSE_HEIGHT / 2,
        width: COURSE_WIDTH,
        height: COURSE_HEIGHT
    };
}

export function getTerrainHeight(x, z) {
    // Get the height of the terrain at position (x, z)
    // Returns the Y position the ball should be at
    
    // Base ground level
    let terrainY = 0;
    
    // Check if there's a hump and if we're on it
    if (courseHump && courseDefinition && courseDefinition.hasHump) {
        const humpPos = courseDefinition.humpPosition || new THREE.Vector3(0, 0, 0);
        const humpHeight = courseDefinition.humpHeight || 1.5;
        const humpRadius = courseDefinition.humpRadius || 8;
        
        // Distance from hump center along Z axis (course length direction)
        const distanceFromHumpCenter = Math.abs(z - humpPos.z);
        
        // Check if we're within the hump's influence (within radius)
        if (distanceFromHumpCenter < humpRadius) {
            // Calculate height using circular arc formula
            // y = humpHeight * sqrt(1 - (distance/humpRadius)^2)
            const normalizedDistance = distanceFromHumpCenter / humpRadius;
            if (normalizedDistance <= 1.0) {
                const heightFactor = Math.sqrt(1 - normalizedDistance * normalizedDistance);
                terrainY = humpHeight * heightFactor;
            }
        }
    }
    
    return terrainY;
}

export function getCourseHump() {
    return courseHump;
}

