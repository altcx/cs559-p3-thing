// Course management and multiple courses
import * as THREE from 'three';
import { scene } from './main.js';
import { createCourse as createCourseGeometry, getCourseBounds, getRectangularHoleWalls, getRectangularHoleEdgeWalls, removeAllRectangularHoleWalls, removeAllCustomWalls, removeCoordinateAxes } from './course.js';
import { createHole, setHolePosition } from './game.js';
import { createPowerUp, removeAllPowerUps, POWERUP_TYPES } from './powerups.js';
import { removeAllBumpers } from './bumpers.js';
import { removeAllMovingWalls } from './moving-walls.js';
import { removeAllFans } from './fans.js';
import { removeAllMagneticFields } from './magnetic-fields.js';
import { removeAllTeleporters, resetTeleporterState } from './teleporters.js';
import { removeAllModels } from './course.js';
import { removeFloor } from './floor.js';
import { createWindZone, removeAllWindZones } from './wind-zones.js';
import { updateLightingForCourse } from './main.js';

// Import all level definitions
import { level1 } from './levels/level1.js';
import { level2 } from './levels/level2.js';
import { level3 } from './levels/level3.js';
import { level4 } from './levels/level4.js';
import { level5 } from './levels/level5.js';

let gameMode = 'single'; // 'single' or '5holes'
let currentHoleIn5HoleGame = 0;

let currentCourseIndex = 0;
let courses = [];

// Course definitions - 5 holes total
// Each level is now defined in its own file in the levels/ directory
const COURSE_DEFINITIONS = [
    level1,
    level2,
    level3,
    level4,
    level5
];

export function getCurrentCourseIndex() {
    return currentCourseIndex;
}

export function getTotalCourses() {
    return COURSE_DEFINITIONS.length;
}

export function getCurrentCourse() {
    return courses[currentCourseIndex];
}

export function getCurrentCourseDefinition() {
    return COURSE_DEFINITIONS[currentCourseIndex];
}

export async function loadCourse(courseIndex) {
    // Remove all power-ups from previous course
    removeAllPowerUps();
    
    // Remove previous course and any start markers
    if (courses.length > 0) {
        courses.forEach(course => {
            if (course.plane) {
                scene.remove(course.plane);
                course.plane.geometry?.dispose();
                course.plane.material?.dispose();
            }
            if (course.hump) {
                scene.remove(course.hump);
                course.hump.geometry?.dispose();
                course.hump.material?.dispose();
            }
            if (course.holeMesh) {
                scene.remove(course.holeMesh);
                course.holeMesh.geometry?.dispose();
                course.holeMesh.material?.dispose();
            }
            if (course.chamfer) {
                scene.remove(course.chamfer);
                course.chamfer.geometry?.dispose();
                course.chamfer.material?.dispose();
            }
            if (course.walls) {
                course.walls.forEach(wall => {
                    scene.remove(wall);
                    wall.geometry?.dispose();
                    wall.material?.dispose();
                });
            }
            if (course.startMarker) {
                scene.remove(course.startMarker);
                course.startMarker.geometry?.dispose();
                course.startMarker.material?.dispose();
            }
        });
        courses = [];
    }
    
    // Remove all bumpers from previous course
    removeAllBumpers();
    removeAllMagneticFields();

    // Remove rectangular hole walls (both edge and interior)
    removeAllRectangularHoleWalls();

    // Remove all custom walls from previous course
    removeAllCustomWalls();
    
    // Remove all moving walls from previous course
    removeAllMovingWalls();
    
    // Remove all fans from previous course
    removeAllFans();
    
    // Remove all teleporters from previous course
    removeAllTeleporters();
    resetTeleporterState(); // Reset teleporter state for new level

    // Remove all models from previous course
    removeAllModels();

    // Remove coordinate axes from previous course
    removeCoordinateAxes();
    
    // Remove floor from previous course
    removeFloor(scene);
    
    // Remove wind zones from previous course
    removeAllWindZones();
    
    // Also remove any orphaned hole indicators and chamfers
    const objectsToRemove = [];
    scene.traverse((child) => {
        if (child.userData && child.userData.isStartMarker) {
            objectsToRemove.push(child);
        }
        // Remove any orphaned chamfers (torus geometries at y=0)
        // Note: We've already cleared courses, so we can safely remove all torus geometries
        if (child.geometry && child.geometry.type === 'TorusGeometry' && child.position.y === 0) {
            objectsToRemove.push(child);
        }
    });
    objectsToRemove.forEach(obj => {
        scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    });
    
    
    currentCourseIndex = courseIndex;
    
    if (courseIndex >= COURSE_DEFINITIONS.length) {
        console.error('Course index out of range');
        return null;
    }
    
    // Update lighting for this course (especially important for levels 4 and 5)
    updateLightingForCourse(courseIndex);
    
    const courseDef = COURSE_DEFINITIONS[courseIndex];
    
    // Set hole position before creating course (so course geometry has correct hole)
    setHolePosition(courseDef.holePosition);
    
    // Create course geometry (with hole cutout and hump if applicable)
    // Pass courseIndex so coordinate axes can be created for holes 4+
    const courseData = createCourseGeometry(courseDef, courseIndex);
    
    // Create hole at the correct position
    const holeData = await createHole();
    
    // Create power-ups for this course
    const powerUps = [];
    if (courseDef.powerUpPositions && courseDef.powerUpPositions.length > 0) {
        console.log('Creating', courseDef.powerUpPositions.length, 'power-ups for course', courseIndex);
        
        // All available power-up types - ensure equal probability
        const availablePowerUps = [
            POWERUP_TYPES.SPEED_BOOST,
            POWERUP_TYPES.SHARPSHOOTER,
            POWERUP_TYPES.MAGNETIC_PULL,
            POWERUP_TYPES.REWIND
        ];
        
        courseDef.powerUpPositions.forEach((pos, index) => {
            // Use crypto.getRandomValues for better randomization if available, otherwise fall back to Math.random
            let randomIndex;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const randomArray = new Uint32Array(1);
                crypto.getRandomValues(randomArray);
                randomIndex = randomArray[0] % availablePowerUps.length;
            } else {
                // Fallback to Math.random with better precision
                randomIndex = Math.floor(Math.random() * availablePowerUps.length);
            }
            
            const powerUpType = availablePowerUps[randomIndex];
            
            console.log(`Creating power-up ${index} at position:`, pos, 'type:', powerUpType, 'randomIndex:', randomIndex);
            const powerUp = createPowerUp(pos, powerUpType);
            powerUps.push(powerUp);
        });
    } else {
        console.log('No power-up positions defined for course', courseIndex);
    }
    
    // Create wind zones for this course
    if (courseDef.windZones && courseDef.windZones.length > 0) {
        console.log('Creating', courseDef.windZones.length, 'wind zone(s) for course', courseIndex);
        courseDef.windZones.forEach((windZoneConfig, index) => {
            console.log(`Creating wind zone ${index} at position:`, windZoneConfig.position);
            createWindZone(windZoneConfig);
        });
    }
    
    const course = {
        index: courseIndex,
        definition: courseDef,
        plane: courseData.plane,
        hump: courseData.hump,
        walls: courseData.walls,
        holeMesh: holeData.holeMesh,
        chamfer: holeData.chamfer,
        powerUps: powerUps
    };
    
    courses.push(course);
    
    return course;
}

export function nextCourse() {
    if (currentCourseIndex + 1 < COURSE_DEFINITIONS.length) {
        return loadCourse(currentCourseIndex + 1);
    }
    return null; // No more courses
}

