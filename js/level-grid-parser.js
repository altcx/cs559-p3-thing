// Grid-based level format parser
// Allows creating levels using ASCII art grid format
import * as THREE from 'three';

/**
 * Grid format symbols:
 * . = Empty space
 * S = Start position (ball start)
 * H = Hole
 * B = Bumper
 * F = Fan
 * M = Magnetic Field
 * P = Power-up
 * W = Wall (custom wall)
 * R = Rectangular hole (hazard)
 * 
 * Grid coordinates:
 * - Each line is a row (Z coordinate, negative to positive from top to bottom)
 * - Each character is a column (X coordinate, negative to positive from left to right)
 * - Grid center (0,0) is at the center of the grid
 */

/**
 * Parse a grid string and convert it to a level definition
 * @param {string} gridString - The grid as a string (newline-separated rows)
 * @param {Object} options - Additional options for the level
 * @returns {Object} Level definition object
 */
export function parseGridLevel(gridString, options = {}) {
    const lines = gridString.trim().split('\n').map(line => line.trim());
    const gridHeight = lines.length;
    const gridWidth = Math.max(...lines.map(line => line.length));
    
    // Calculate course dimensions based on grid size
    // Each grid cell = 2 units in world space (adjustable)
    const cellSize = options.cellSize || 2.0;
    const courseWidth = gridWidth * cellSize;
    const courseHeight = gridHeight * cellSize;
    
    // Calculate offset to center the grid at origin
    const offsetX = -(gridWidth - 1) * cellSize / 2;
    const offsetZ = -(gridHeight - 1) * cellSize / 2;
    
    const levelDef = {
        width: courseWidth,
        height: courseHeight,
        holePosition: null,
        ballStartPosition: null,
        hasHump: options.hasHump || false,
        powerUpPositions: [],
        bumpers: [],
        fans: [],
        magneticFields: [],
        customWalls: [],
        rectangularHoles: [],
        movingWalls: [],
        ...options // Allow overriding defaults
    };
    
    // First pass: collect wall and hole positions and parse other objects
    const wallGrid = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false));
    const holeGrid = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false));
    
    for (let row = 0; row < gridHeight; row++) {
        const line = lines[row];
        for (let col = 0; col < line.length; col++) {
            const char = line[col].toUpperCase();
            if (char === '.') continue; // Empty space
            
            // Calculate world position
            const x = offsetX + col * cellSize;
            const z = offsetZ + row * cellSize;
            
            switch (char) {
                case 'S':
                    // Start position
                    levelDef.ballStartPosition = new THREE.Vector3(x, 0.5, z);
                    break;
                    
                case 'H':
                    // Hole
                    levelDef.holePosition = new THREE.Vector3(x, 0, z);
                    break;
                    
                case 'B':
                    // Bumper
                    levelDef.bumpers.push({
                        position: new THREE.Vector3(x, 0.5, z),
                        radius: options.bumperRadius || 1.5,
                        tubeRadius: options.bumperTubeRadius || 0.3
                    });
                    break;
                    
                case 'F':
                    // Fan
                    levelDef.fans.push({
                        x: x,
                        z: z,
                        radius: options.fanRadius || 3.0,
                        height: options.fanHeight || 0.1,
                        numBlades: options.fanBlades || 4,
                        rotationSpeed: options.fanSpeed || 2.0,
                        pushStrength: options.fanStrength || 8.0,
                        bladeLengthMultiplier: options.fanBladeLength || 1.6,
                        color: options.fanColor || 0x888888
                    });
                    break;
                    
                case 'M':
                    // Magnetic Field
                    levelDef.magneticFields.push({
                        position: new THREE.Vector3(x, 0.5, z),
                        strength: options.magneticStrength || 0.5,
                        range: options.magneticRange || 8.0
                    });
                    break;
                    
                case 'P':
                    // Power-up
                    levelDef.powerUpPositions.push(new THREE.Vector3(x, 1.0, z));
                    break;
                    
                case 'W':
                    // Mark wall position for later processing
                    wallGrid[row][col] = true;
                    break;
                    
                case 'R':
                    // Mark rectangular hole position for later processing
                    holeGrid[row][col] = true;
                    break;
            }
        }
    }
    
    // Second pass: fuse adjacent walls into segments
    const usedWalls = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false));
    
    // Find horizontal wall runs (rows)
    for (let row = 0; row < gridHeight; row++) {
        let runStart = -1;
        for (let col = 0; col <= gridWidth; col++) {
            const isWall = col < gridWidth && wallGrid[row][col];
            
            if (isWall && runStart === -1) {
                // Start of a run
                runStart = col;
            } else if (!isWall && runStart !== -1) {
                // End of a run - create merged wall segment
                const runLength = col - runStart;
                if (runLength > 0) {
                    // Calculate center position of the run
                    const centerCol = runStart + (runLength - 1) / 2;
                    const x = offsetX + centerCol * cellSize;
                    const z = offsetZ + row * cellSize;
                    
                    // Create horizontal wall segment
                    levelDef.customWalls.push({
                        x: x,
                        z: z,
                        width: runLength * cellSize,
                        depth: cellSize
                    });
                    
                    // Mark these walls as used
                    for (let c = runStart; c < col; c++) {
                        usedWalls[row][c] = true;
                    }
                }
                runStart = -1;
            }
        }
    }
    
    // Find vertical wall runs (columns) - only for walls not already used in horizontal runs
    for (let col = 0; col < gridWidth; col++) {
        let runStart = -1;
        for (let row = 0; row <= gridHeight; row++) {
            const isWall = row < gridHeight && wallGrid[row][col] && !usedWalls[row][col];
            
            if (isWall && runStart === -1) {
                // Start of a run
                runStart = row;
            } else if ((!isWall || usedWalls[row][col]) && runStart !== -1) {
                // End of a run - create merged wall segment
                const runLength = row - runStart;
                if (runLength > 0) {
                    // Calculate center position of the run
                    const centerRow = runStart + (runLength - 1) / 2;
                    const x = offsetX + col * cellSize;
                    const z = offsetZ + centerRow * cellSize;
                    
                    // Create vertical wall segment
                    levelDef.customWalls.push({
                        x: x,
                        z: z,
                        width: cellSize,
                        depth: runLength * cellSize
                    });
                    
                    // Mark these walls as used
                    for (let r = runStart; r < row; r++) {
                        usedWalls[r][col] = true;
                    }
                }
                runStart = -1;
            }
        }
    }
    
    // Handle any remaining single walls (not part of horizontal or vertical runs)
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            if (wallGrid[row][col] && !usedWalls[row][col]) {
                const x = offsetX + col * cellSize;
                const z = offsetZ + row * cellSize;
                levelDef.customWalls.push({
                    x: x,
                    z: z,
                    width: cellSize,
                    depth: cellSize
                });
            }
        }
    }
    
    // Fuse adjacent rectangular holes into segments
    const usedHoles = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false));
    
    // Find horizontal hole runs (rows)
    for (let row = 0; row < gridHeight; row++) {
        let runStart = -1;
        for (let col = 0; col <= gridWidth; col++) {
            const isHole = col < gridWidth && holeGrid[row][col];
            
            if (isHole && runStart === -1) {
                runStart = col;
            } else if (!isHole && runStart !== -1) {
                const runLength = col - runStart;
                if (runLength > 0) {
                    const centerCol = runStart + (runLength - 1) / 2;
                    const x = offsetX + centerCol * cellSize;
                    const z = offsetZ + row * cellSize;
                    
                    levelDef.rectangularHoles.push({
                        x: x,
                        z: z,
                        width: runLength * cellSize,
                        length: cellSize
                    });
                    
                    for (let c = runStart; c < col; c++) {
                        usedHoles[row][c] = true;
                    }
                }
                runStart = -1;
            }
        }
    }
    
    // Find vertical hole runs (columns) - only for holes not already used
    for (let col = 0; col < gridWidth; col++) {
        let runStart = -1;
        for (let row = 0; row <= gridHeight; row++) {
            const isHole = row < gridHeight && holeGrid[row][col] && !usedHoles[row][col];
            
            if (isHole && runStart === -1) {
                runStart = row;
            } else if ((!isHole || usedHoles[row][col]) && runStart !== -1) {
                const runLength = row - runStart;
                if (runLength > 0) {
                    const centerRow = runStart + (runLength - 1) / 2;
                    const x = offsetX + col * cellSize;
                    const z = offsetZ + centerRow * cellSize;
                    
                    levelDef.rectangularHoles.push({
                        x: x,
                        z: z,
                        width: cellSize,
                        length: runLength * cellSize
                    });
                    
                    for (let r = runStart; r < row; r++) {
                        usedHoles[r][col] = true;
                    }
                }
                runStart = -1;
            }
        }
    }
    
    // Handle any remaining single holes
    for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
            if (holeGrid[row][col] && !usedHoles[row][col]) {
                const x = offsetX + col * cellSize;
                const z = offsetZ + row * cellSize;
                levelDef.rectangularHoles.push({
                    x: x,
                    z: z,
                    width: cellSize,
                    length: cellSize
                });
            }
        }
    }
    
    // Validate required positions
    if (!levelDef.holePosition) {
        console.warn('Warning: No hole position (H) found in grid');
        levelDef.holePosition = new THREE.Vector3(0, 0, courseHeight / 2 - cellSize);
    }
    
    if (!levelDef.ballStartPosition) {
        console.warn('Warning: No start position (S) found in grid');
        levelDef.ballStartPosition = new THREE.Vector3(0, 0.5, -courseHeight / 2 + cellSize);
    }
    
    return levelDef;
}

/**
 * Load a level from a grid file
 * @param {string} filePath - Path to the grid file
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Level definition object
 */
export async function loadGridLevel(filePath, options = {}) {
    try {
        const response = await fetch(filePath);
        const gridString = await response.text();
        return parseGridLevel(gridString, options);
    } catch (error) {
        console.error('Error loading grid level:', error);
        throw error;
    }
}

/**
 * Convert an existing level definition to grid format (for editing)
 * @param {Object} levelDef - Level definition object
 * @param {number} gridWidth - Width of grid in cells
 * @param {number} gridHeight - Height of grid in cells
 * @returns {string} Grid string representation
 */
export function levelToGrid(levelDef, gridWidth = 200, gridHeight = 200) {
    const cellSize = Math.max(levelDef.width / gridWidth, levelDef.height / gridHeight);
    const grid = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill('.'));
    
    // Helper to convert world position to grid coordinates
    const worldToGrid = (worldX, worldZ) => {
        const gridX = Math.round((worldX + levelDef.width / 2) / cellSize);
        const gridZ = Math.round((worldZ + levelDef.height / 2) / cellSize);
        return { x: Math.max(0, Math.min(gridWidth - 1, gridX)), z: Math.max(0, Math.min(gridHeight - 1, gridZ)) };
    };
    
    // Place start position
    if (levelDef.ballStartPosition) {
        const pos = worldToGrid(levelDef.ballStartPosition.x, levelDef.ballStartPosition.z);
        grid[pos.z][pos.x] = 'S';
    }
    
    // Place hole
    if (levelDef.holePosition) {
        const pos = worldToGrid(levelDef.holePosition.x, levelDef.holePosition.z);
        grid[pos.z][pos.x] = 'H';
    }
    
    // Place bumpers
    if (levelDef.bumpers) {
        levelDef.bumpers.forEach(bumper => {
            const pos = worldToGrid(bumper.position.x, bumper.position.z);
            if (grid[pos.z][pos.x] === '.') {
                grid[pos.z][pos.x] = 'B';
            }
        });
    }
    
    // Place fans
    if (levelDef.fans) {
        levelDef.fans.forEach(fan => {
            const pos = worldToGrid(fan.x, fan.z);
            if (grid[pos.z][pos.x] === '.') {
                grid[pos.z][pos.x] = 'F';
            }
        });
    }
    
    // Place magnetic fields
    if (levelDef.magneticFields) {
        levelDef.magneticFields.forEach(field => {
            const pos = worldToGrid(field.position.x, field.position.z);
            if (grid[pos.z][pos.x] === '.') {
                grid[pos.z][pos.x] = 'M';
            }
        });
    }
    
    // Place power-ups
    if (levelDef.powerUpPositions) {
        levelDef.powerUpPositions.forEach(powerUp => {
            const pos = worldToGrid(powerUp.x, powerUp.z);
            if (grid[pos.z][pos.x] === '.') {
                grid[pos.z][pos.x] = 'P';
            }
        });
    }
    
    // Convert grid to string
    return grid.map(row => row.join('')).join('\n');
}

