// Converter: Grid file to Level JavaScript file
// This can be run in Node.js or browser console to generate level code

import * as THREE from 'three';
import { parseGridLevel } from './level-grid-parser.js';

/**
 * Generate JavaScript code for a level from a grid string
 * @param {string} gridString - The grid as a string
 * @param {Object} options - Additional options
 * @param {string} levelName - Name of the level (e.g., 'level5')
 * @returns {string} JavaScript code for the level
 */
export function generateLevelCode(gridString, options = {}, levelName = 'level') {
    const levelDef = parseGridLevel(gridString, options);
    
    let code = `// ${levelName.charAt(0).toUpperCase() + levelName.slice(1)}: Generated from grid format\n`;
    code += `import * as THREE from 'three';\n\n`;
    code += `export const ${levelName} = {\n`;
    
    // Basic properties
    code += `    width: ${levelDef.width},\n`;
    code += `    height: ${levelDef.height},\n`;
    
    // Hole position
    if (levelDef.holePosition) {
        code += `    holePosition: new THREE.Vector3(${levelDef.holePosition.x}, ${levelDef.holePosition.y}, ${levelDef.holePosition.z}),\n`;
    }
    
    // Start position
    if (levelDef.ballStartPosition) {
        code += `    ballStartPosition: new THREE.Vector3(${levelDef.ballStartPosition.x}, ${levelDef.ballStartPosition.y}, ${levelDef.ballStartPosition.z}),\n`;
    }
    
    // Hump
    code += `    hasHump: ${levelDef.hasHump},\n`;
    if (levelDef.hasHump && levelDef.humpPosition) {
        code += `    humpPosition: new THREE.Vector3(${levelDef.humpPosition.x}, ${levelDef.humpPosition.y}, ${levelDef.humpPosition.z}),\n`;
        if (levelDef.humpHeight) code += `    humpHeight: ${levelDef.humpHeight},\n`;
        if (levelDef.humpWidth) code += `    humpWidth: ${levelDef.humpWidth},\n`;
        if (levelDef.humpRadius) code += `    humpRadius: ${levelDef.humpRadius},\n`;
    }
    
    // Power-ups
    if (levelDef.powerUpPositions && levelDef.powerUpPositions.length > 0) {
        code += `    powerUpPositions: [\n`;
        levelDef.powerUpPositions.forEach(pos => {
            code += `        new THREE.Vector3(${pos.x}, ${pos.y}, ${pos.z}),\n`;
        });
        code += `    ],\n`;
    } else {
        code += `    powerUpPositions: [],\n`;
    }
    
    // Bumpers
    if (levelDef.bumpers && levelDef.bumpers.length > 0) {
        code += `    bumpers: [\n`;
        levelDef.bumpers.forEach(bumper => {
            code += `        {\n`;
            code += `            position: new THREE.Vector3(${bumper.position.x}, ${bumper.position.y}, ${bumper.position.z}),\n`;
            code += `            radius: ${bumper.radius},\n`;
            code += `            tubeRadius: ${bumper.tubeRadius}\n`;
            code += `        },\n`;
        });
        code += `    ],\n`;
    } else {
        code += `    bumpers: [],\n`;
    }
    
    // Fans
    if (levelDef.fans && levelDef.fans.length > 0) {
        code += `    fans: [\n`;
        levelDef.fans.forEach(fan => {
            code += `        {\n`;
            code += `            x: ${fan.x},\n`;
            code += `            z: ${fan.z},\n`;
            code += `            radius: ${fan.radius},\n`;
            code += `            height: ${fan.height},\n`;
            code += `            numBlades: ${fan.numBlades},\n`;
            code += `            rotationSpeed: ${fan.rotationSpeed},\n`;
            code += `            pushStrength: ${fan.pushStrength},\n`;
            code += `            bladeLengthMultiplier: ${fan.bladeLengthMultiplier},\n`;
            code += `            color: ${fan.color}\n`;
            code += `        },\n`;
        });
        code += `    ],\n`;
    }
    
    // Magnetic fields
    if (levelDef.magneticFields && levelDef.magneticFields.length > 0) {
        code += `    magneticFields: [\n`;
        levelDef.magneticFields.forEach(field => {
            code += `        {\n`;
            code += `            position: new THREE.Vector3(${field.position.x}, ${field.position.y}, ${field.position.z}),\n`;
            code += `            strength: ${field.strength},\n`;
            code += `            range: ${field.range}\n`;
            code += `        },\n`;
        });
        code += `    ],\n`;
    }
    
    // Custom walls
    if (levelDef.customWalls && levelDef.customWalls.length > 0) {
        code += `    customWalls: [\n`;
        levelDef.customWalls.forEach(wall => {
            code += `        { x: ${wall.x}, z: ${wall.z}, width: ${wall.width}, depth: ${wall.depth} },\n`;
        });
        code += `    ],\n`;
    }
    
    // Rectangular holes
    if (levelDef.rectangularHoles && levelDef.rectangularHoles.length > 0) {
        code += `    rectangularHoles: [\n`;
        levelDef.rectangularHoles.forEach(hole => {
            code += `        {\n`;
            code += `            x: ${hole.x},\n`;
            code += `            z: ${hole.z},\n`;
            code += `            width: ${hole.width},\n`;
            code += `            length: ${hole.length}\n`;
            code += `        },\n`;
        });
        code += `    ],\n`;
    }
    
    code += `};\n`;
    
    return code;
}

/**
 * Browser-friendly function to convert grid to level code
 * Can be called from browser console
 */
export function convertGridToLevelCode(gridString, levelName = 'level') {
    return generateLevelCode(gridString, {}, levelName);
}

