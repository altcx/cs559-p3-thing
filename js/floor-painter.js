// Floor painting tool - polygon corner marking mode
// Mark corners of polygons, export coordinates for AI to create floor geometry
import * as THREE from 'three';
import { scene, camera, renderer } from './main.js';
import { removeFloor } from './floor.js';

let isPaintingMode = false;
let gridOverlay = null;
let currentCourseDef = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// Polygon data
let polygons = []; // Array of polygons, each polygon is an array of corner points
let currentPolygon = []; // Current polygon being drawn
let cornerMarkers = []; // Visual markers for corners

// Pan controls
let isRightClickPanning = false;
let panStartMouse = new THREE.Vector2();
let panStartCameraPos = new THREE.Vector3();
let preventContextMenuHandler = null;

// Grid settings
const GRID_SIZE = 200;
const GRID_COLOR = 0x444444;
const CORNER_COLOR = 0xff0000; // Red for corners
const LINE_COLOR = 0x00ff00; // Green for polygon edges
const COMPLETED_POLYGON_COLOR = 0x0088ff; // Blue for completed polygons

/**
 * Enter floor painting mode (polygon corner marking)
 * @param {Object} courseDef - Current course definition
 */
export function enterPaintingMode(courseDef) {
    if (isPaintingMode) return;
    
    isPaintingMode = true;
    currentCourseDef = courseDef;
    polygons = [];
    currentPolygon = [];
    cornerMarkers = [];
    
    // Remove existing floor completely
    removeFloor(scene);
    
    // Create grid overlay
    createGridOverlay();
    
    // Set camera to top-down view
    camera.position.set(0, 80, 0);
    camera.rotation.set(-Math.PI / 2, 0, 0);
    camera.updateProjectionMatrix();
    
    // Add event listeners
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', onWheel, { passive: false });
    
    // Prevent context menu
    preventContextMenuHandler = (e) => {
        if (isPaintingMode) e.preventDefault();
    };
    document.addEventListener('contextmenu', preventContextMenuHandler);
    
    // Create export button
    createExportButton();
    
    console.log('=== POLYGON CORNER MARKING MODE ===');
    console.log('Left-click to place polygon corners');
    console.log('Press ENTER to complete current polygon');
    console.log('Press Z to undo last corner');
    console.log('Press C to clear current polygon');
    console.log('Press X to delete last completed polygon');
    console.log('Press E to export polygon data');
    console.log('Press ESC to exit');
    console.log('Right-click drag to pan, scroll to zoom');
    console.log('WASD/Arrow keys to pan');
}

/**
 * Exit painting mode
 */
export function exitPaintingMode() {
    if (!isPaintingMode) return;
    
    isPaintingMode = false;
    
    // Remove overlays
    removeGridOverlay();
    removeCornerMarkers();
    removeExportButton();
    
    // Remove event listeners
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('wheel', onWheel);
    
    if (preventContextMenuHandler) {
        document.removeEventListener('contextmenu', preventContextMenuHandler);
        preventContextMenuHandler = null;
    }
    
    console.log('Polygon marking mode exited.');
}

/**
 * Check if in painting mode
 */
export function isInPaintingMode() {
    return isPaintingMode;
}

/**
 * Create grid overlay
 */
function createGridOverlay() {
    if (gridOverlay) removeGridOverlay();
    
    gridOverlay = new THREE.Group();
    
    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE / 2, GRID_COLOR, GRID_COLOR);
    gridHelper.position.y = 0.01;
    gridOverlay.add(gridHelper);
    
    scene.add(gridOverlay);
}

/**
 * Remove grid overlay
 */
function removeGridOverlay() {
    if (gridOverlay) {
        scene.remove(gridOverlay);
        gridOverlay.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        gridOverlay = null;
    }
}

/**
 * Remove all corner markers
 */
function removeCornerMarkers() {
    cornerMarkers.forEach(marker => {
        scene.remove(marker);
        if (marker.geometry) marker.geometry.dispose();
        if (marker.material) marker.material.dispose();
    });
    cornerMarkers = [];
}

/**
 * Add a corner marker at position
 */
function addCornerMarker(x, z, isCompleted = false) {
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshBasicMaterial({ 
        color: isCompleted ? COMPLETED_POLYGON_COLOR : CORNER_COLOR 
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(x, 0.5, z);
    scene.add(marker);
    cornerMarkers.push(marker);
    return marker;
}

/**
 * Draw lines between corners
 */
function updatePolygonLines() {
    // Remove existing lines
    const linesToRemove = cornerMarkers.filter(m => m.isLine);
    linesToRemove.forEach(line => {
        scene.remove(line);
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
    });
    cornerMarkers = cornerMarkers.filter(m => !m.isLine);
    
    // Draw lines for completed polygons
    polygons.forEach(polygon => {
        if (polygon.length >= 2) {
            drawPolygonLines(polygon, COMPLETED_POLYGON_COLOR);
        }
    });
    
    // Draw lines for current polygon
    if (currentPolygon.length >= 2) {
        drawPolygonLines(currentPolygon, LINE_COLOR);
    }
}

/**
 * Draw lines for a polygon
 */
function drawPolygonLines(polygon, color) {
    const points = polygon.map(p => new THREE.Vector3(p.x, 0.3, p.z));
    // Close the polygon
    if (polygon.length >= 3) {
        points.push(new THREE.Vector3(polygon[0].x, 0.3, polygon[0].z));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    line.isLine = true;
    scene.add(line);
    cornerMarkers.push(line);
}

/**
 * Redraw all markers and lines
 */
function redrawAll() {
    removeCornerMarkers();
    
    // Draw completed polygons
    polygons.forEach(polygon => {
        polygon.forEach(corner => {
            addCornerMarker(corner.x, corner.z, true);
        });
    });
    
    // Draw current polygon corners
    currentPolygon.forEach(corner => {
        addCornerMarker(corner.x, corner.z, false);
    });
    
    // Draw lines
    updatePolygonLines();
}

/**
 * Handle mouse down
 */
function onMouseDown(event) {
    if (!isPaintingMode) return;
    
    // Right-click for panning
    if (event.button === 2) {
        isRightClickPanning = true;
        panStartMouse.set(event.clientX, event.clientY);
        panStartCameraPos.copy(camera.position);
        event.preventDefault();
        return;
    }
    
    // Left-click to place corner
    if (event.button === 0) {
        placeCorner(event);
    }
}

/**
 * Handle mouse move
 */
function onMouseMove(event) {
    if (!isPaintingMode || !isRightClickPanning) return;
    
    const deltaX = (event.clientX - panStartMouse.x) * 0.1;
    const deltaY = (event.clientY - panStartMouse.y) * 0.1;
    
    camera.position.x = panStartCameraPos.x - deltaX;
    camera.position.z = panStartCameraPos.z + deltaY;
}

/**
 * Handle mouse up
 */
function onMouseUp(event) {
    if (!isPaintingMode) return;
    if (event.button === 2) {
        isRightClickPanning = false;
    }
}

/**
 * Place a corner at mouse position
 */
function placeCorner(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    
    raycaster.ray.intersectPlane(plane, intersectionPoint);
    
    if (intersectionPoint) {
        // Round to 0.5 for cleaner coordinates
        const x = Math.round(intersectionPoint.x * 2) / 2;
        const z = Math.round(intersectionPoint.z * 2) / 2;
        
        currentPolygon.push({ x, z });
        console.log(`Corner ${currentPolygon.length}: (${x}, ${z})`);
        
        redrawAll();
    }
}

/**
 * Handle keyboard input
 */
function onKeyDown(event) {
    if (!isPaintingMode) return;
    
    const panSpeed = 5;
    const key = event.key.toLowerCase();
    
    switch (key) {
        case 'enter':
            // Complete current polygon
            if (currentPolygon.length >= 3) {
                polygons.push([...currentPolygon]);
                console.log(`Polygon ${polygons.length} completed with ${currentPolygon.length} corners`);
                currentPolygon = [];
                redrawAll();
            } else {
                console.log('Need at least 3 corners to complete a polygon');
            }
            event.preventDefault();
            break;
            
        case 'z':
            // Undo last corner
            if (currentPolygon.length > 0) {
                const removed = currentPolygon.pop();
                console.log(`Removed corner at (${removed.x}, ${removed.z})`);
                redrawAll();
            }
            event.preventDefault();
            break;
            
        case 'c':
            // Clear current polygon
            currentPolygon = [];
            console.log('Current polygon cleared');
            redrawAll();
            event.preventDefault();
            break;
            
        case 'x':
            // Delete last completed polygon
            if (polygons.length > 0) {
                polygons.pop();
                console.log('Deleted last completed polygon');
                redrawAll();
            }
            event.preventDefault();
            break;
            
        case 'e':
            // Export
            exportPolygonData();
            event.preventDefault();
            break;
            
        case 'escape':
            exitPaintingMode();
            event.preventDefault();
            break;
            
        case 'arrowup':
        case 'w':
            camera.position.z -= panSpeed;
            event.preventDefault();
            break;
            
        case 'arrowdown':
        case 's':
            camera.position.z += panSpeed;
            event.preventDefault();
            break;
            
        case 'arrowleft':
        case 'a':
            camera.position.x -= panSpeed;
            event.preventDefault();
            break;
            
        case 'arrowright':
        case 'd':
            camera.position.x += panSpeed;
            event.preventDefault();
            break;
    }
}

/**
 * Handle mouse wheel
 */
function onWheel(event) {
    if (!isPaintingMode) return;
    
    event.preventDefault();
    
    const zoomSpeed = 5;
    const newY = camera.position.y + (event.deltaY > 0 ? zoomSpeed : -zoomSpeed);
    camera.position.y = Math.max(10, Math.min(200, newY));
}

/**
 * Create export button
 */
function createExportButton() {
    removeExportButton();
    
    const button = document.createElement('button');
    button.id = 'floor-export-button';
    button.textContent = 'Export Polygons (E)';
    button.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        padding: 15px 25px;
        font-size: 18px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
    `;
    button.addEventListener('click', exportPolygonData);
    document.body.appendChild(button);
    
    // Add instructions panel
    const instructions = document.createElement('div');
    instructions.id = 'floor-instructions';
    instructions.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 1000;
        padding: 15px;
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 5px;
        font-family: monospace;
        font-size: 14px;
        line-height: 1.6;
    `;
    instructions.innerHTML = `
        <strong>Polygon Corner Marking</strong><br>
        Left-click: Place corner<br>
        ENTER: Complete polygon<br>
        Z: Undo last corner<br>
        C: Clear current polygon<br>
        X: Delete last polygon<br>
        E: Export data<br>
        ESC: Exit<br>
        Right-drag / WASD: Pan<br>
        Scroll: Zoom
    `;
    document.body.appendChild(instructions);
}

/**
 * Remove export button
 */
function removeExportButton() {
    const button = document.getElementById('floor-export-button');
    if (button) button.remove();
    
    const instructions = document.getElementById('floor-instructions');
    if (instructions) instructions.remove();
}

/**
 * Export polygon data
 */
function exportPolygonData() {
    // Include current polygon if it has at least 3 corners
    const allPolygons = [...polygons];
    if (currentPolygon.length >= 3) {
        allPolygons.push([...currentPolygon]);
    }
    
    if (allPolygons.length === 0) {
        alert('No polygons to export. Place at least 3 corners and press ENTER to complete a polygon.');
        return;
    }
    
    // Format as easy-to-read code
    let code = `// Floor polygons - ${allPolygons.length} polygon(s)\n`;
    code += `// Paste this in the chat for AI to create floor geometry\n\n`;
    
    allPolygons.forEach((polygon, index) => {
        code += `// Polygon ${index + 1} (${polygon.length} corners):\n`;
        polygon.forEach((corner, cornerIndex) => {
            code += `//   Corner ${cornerIndex + 1}: (${corner.x}, ${corner.z})\n`;
        });
        code += `\n`;
    });
    
    // Also output as JSON for easy parsing
    code += `// JSON format:\n`;
    code += JSON.stringify(allPolygons, null, 2);
    
    // Copy to clipboard
    navigator.clipboard.writeText(code).then(() => {
        console.log('=== POLYGON DATA EXPORTED ===');
        console.log(code);
        alert(`Exported ${allPolygons.length} polygon(s)!\n\nCopied to clipboard.\nPaste it in the chat and I will create the floor geometry.`);
    }).catch(err => {
        console.error('Failed to copy:', err);
        console.log(code);
        prompt('Copy this polygon data:', code);
    });
}
