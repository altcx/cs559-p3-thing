// Course management and multiple courses
import * as THREE from 'three';
import { scene } from './main.js';
import { createCourse as createCourseGeometry, getCourseBounds } from './course.js';
import { createHole, setHolePosition } from './game.js';

let gameMode = 'single'; // 'single' or '9holes'
let currentHoleIn9HoleGame = 0;

let currentCourseIndex = 0;
let courses = [];

// Course definitions - 9 holes total
const COURSE_DEFINITIONS = [
    // Hole 1: Long rectangle (straight)
    {
        width: 15,  // Narrow width (left-right)
        height: 60, // Long length (front-back)
        holePosition: new THREE.Vector3(0, 0, 25),
        ballStartPosition: new THREE.Vector3(0, 0.5, -25),
        hasHump: false,
        wallHeight: 1.0 // Shorter walls for hole 1
    },
    // Hole 2: Placeholder
    {
        width: 50,
        height: 50,
        holePosition: new THREE.Vector3(0, 0, 20),
        ballStartPosition: new THREE.Vector3(0, 0.5, -20),
        hasHump: false
    },
    // Hole 3: Placeholder
    {
        width: 50,
        height: 50,
        holePosition: new THREE.Vector3(0, 0, 20),
        ballStartPosition: new THREE.Vector3(0, 0.5, -20),
        hasHump: false
    },
    // Hole 4: Placeholder
    {
        width: 50,
        height: 50,
        holePosition: new THREE.Vector3(0, 0, 20),
        ballStartPosition: new THREE.Vector3(0, 0.5, -20),
        hasHump: false
    },
    // Hole 5: Placeholder
    {
        width: 50,
        height: 50,
        holePosition: new THREE.Vector3(0, 0, 20),
        ballStartPosition: new THREE.Vector3(0, 0.5, -20),
        hasHump: false
    },
    // Hole 6: Placeholder
    {
        width: 50,
        height: 50,
        holePosition: new THREE.Vector3(0, 0, 20),
        ballStartPosition: new THREE.Vector3(0, 0.5, -20),
        hasHump: false
    },
    // Hole 7: Placeholder
    {
        width: 50,
        height: 50,
        holePosition: new THREE.Vector3(0, 0, 20),
        ballStartPosition: new THREE.Vector3(0, 0.5, -20),
        hasHump: false
    },
    // Hole 8: Placeholder
    {
        width: 50,
        height: 50,
        holePosition: new THREE.Vector3(0, 0, 20),
        ballStartPosition: new THREE.Vector3(0, 0.5, -20),
        hasHump: false
    },
    // Hole 9: Placeholder
    {
        width: 50,
        height: 50,
        holePosition: new THREE.Vector3(0, 0, 20),
        ballStartPosition: new THREE.Vector3(0, 0.5, -20),
        hasHump: false
    }
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
    // Remove previous course and any start markers
    if (courses.length > 0) {
        courses.forEach(course => {
            if (course.plane) scene.remove(course.plane);
            if (course.hump) scene.remove(course.hump);
            if (course.holeMesh) scene.remove(course.holeMesh);
            if (course.chamfer) scene.remove(course.chamfer);
            if (course.walls) {
                course.walls.forEach(wall => scene.remove(wall));
            }
            if (course.startMarker) scene.remove(course.startMarker);
        });
        courses = [];
    }
    
    // Remove any orphaned start markers from scene
    const objectsToRemove = [];
    scene.traverse((child) => {
        if (child.userData && child.userData.isStartMarker) {
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
    
    const course = {
        index: courseIndex,
        definition: courseDef,
        plane: courseData.plane,
        hump: courseData.hump,
        walls: courseData.walls,
        holeMesh: holeData.holeMesh,
        chamfer: holeData.chamfer
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

