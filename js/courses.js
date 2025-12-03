// Course management and multiple courses
import * as THREE from 'three';
import { scene } from './main.js';
import { createCourse as createCourseGeometry, getCourseBounds, getRectangularHoleWalls, getRectangularHoleEdgeWalls, removeAllRectangularHoleWalls, removeAllCustomWalls } from './course.js';
import { createHole, setHolePosition } from './game.js';
import { createPowerUp, removeAllPowerUps, POWERUP_TYPES } from './powerups.js';
import { removeAllBumpers } from './bumpers.js';

// Import all level definitions
import { level1 } from './levels/level1.js';
import { level2 } from './levels/level2.js';
import { level3 } from './levels/level3.js';
import { level4 } from './levels/level4.js';
import { level5 } from './levels/level5.js';
import { level6 } from './levels/level6.js';
import { level7 } from './levels/level7.js';
import { level8 } from './levels/level8.js';
import { level9 } from './levels/level9.js';

let gameMode = 'single'; // 'single' or '9holes'
let currentHoleIn9HoleGame = 0;

let currentCourseIndex = 0;
let courses = [];

// Course definitions - 9 holes total
// Each level is now defined in its own file in the levels/ directory
const COURSE_DEFINITIONS = [
    level1,
    level2,
    level3,
    level4,
    level5,
    level6,
    level7,
    level8,
    level9
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

    // Remove rectangular hole walls (both edge and interior)
    removeAllRectangularHoleWalls();

    // Remove all custom walls from previous course
    removeAllCustomWalls();
    
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
    
    const courseDef = COURSE_DEFINITIONS[courseIndex];
    
    // Set hole position before creating course (so course geometry has correct hole)
    setHolePosition(courseDef.holePosition);
    
    // Create course geometry (with hole cutout and hump if applicable)
    const courseData = createCourseGeometry(courseDef);
    
    // Create hole at the correct position
    const holeData = await createHole();
    
    // Create power-ups for this course
    const powerUps = [];
    if (courseDef.powerUpPositions && courseDef.powerUpPositions.length > 0) {
        console.log('Creating', courseDef.powerUpPositions.length, 'power-ups for course', courseIndex);
        courseDef.powerUpPositions.forEach((pos, index) => {
            // Randomly select from all available power-ups with equal probability
            const availablePowerUps = [
                POWERUP_TYPES.SPEED_BOOST,
                POWERUP_TYPES.SHARPSHOOTER,
                POWERUP_TYPES.MAGNETIC_PULL,
                POWERUP_TYPES.REWIND
            ];
            const powerUpType = availablePowerUps[Math.floor(Math.random() * availablePowerUps.length)];
            
            console.log(`Creating power-up ${index} at position:`, pos, 'type:', powerUpType);
            const powerUp = createPowerUp(pos, powerUpType);
            powerUps.push(powerUp);
        });
    } else {
        console.log('No power-up positions defined for course', courseIndex);
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

