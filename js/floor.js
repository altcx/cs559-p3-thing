// Floor texture system - procedural coordinate-based ground plane
import * as THREE from 'three';
import { isFullMode } from './main.js';

let floorMesh = null;
let floorMaterial = null;

// Shader uniforms for animation
const floorUniforms = {
    uTime: { value: 0 },
    uGridScale: { value: 4.0 },
    uPrimaryColor: { value: new THREE.Color(0xe39de5) },      // #e39de5
    uSecondaryColor: { value: new THREE.Color(0xd67dd8) },   // Slightly darker
    uAccentColor: { value: new THREE.Color(0xf0bdf2) },       // Lighter accent
    uLineColor: { value: new THREE.Color(0xc85dca) },        // Darker for grid lines
    uLineWidth: { value: 0.03 },
    uNoiseScale: { value: 0.15 },
    uNoiseStrength: { value: 0.08 }
};

// Vertex shader - passes world coordinates to fragment shader
const floorVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    
    void main() {
        vUv = uv;
        
        // Calculate world position for coordinate-based texturing
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Fragment shader - creates procedural grass/turf texture based on world coordinates
const floorFragmentShader = `
    uniform float uTime;
    uniform float uGridScale;
    uniform vec3 uPrimaryColor;
    uniform vec3 uSecondaryColor;
    uniform vec3 uAccentColor;
    uniform vec3 uLineColor;
    uniform float uLineWidth;
    uniform float uNoiseScale;
    uniform float uNoiseStrength;
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    
    // Simplex noise functions for organic texture
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
    
    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                          -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                        + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                                dot(x12.zw, x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }
    
    // Fractal Brownian Motion for more complex noise
    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 4; i++) {
            value += amplitude * snoise(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
        }
        return value;
    }
    
    // Hash function for random patterns
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    
    // Create grass blade pattern
    float grassBlades(vec2 coord, float scale) {
        vec2 id = floor(coord * scale);
        vec2 gv = fract(coord * scale) - 0.5;
        
        float d = length(gv);
        float blade = 0.0;
        
        // Random offset per cell
        float h = hash(id);
        vec2 offset = vec2(h - 0.5, fract(h * 127.1) - 0.5) * 0.4;
        
        // Create blade-like shape
        vec2 bladePos = gv - offset;
        float bladeWidth = 0.08 + h * 0.04;
        float bladeHeight = 0.3 + fract(h * 43.7) * 0.2;
        
        // Blade shape using distance field
        float dx = abs(bladePos.x);
        float dy = bladePos.y;
        
        if (dy > -bladeHeight && dy < bladeHeight * 0.5) {
            float taper = 1.0 - smoothstep(0.0, bladeHeight, dy + bladeHeight);
            blade = 1.0 - smoothstep(bladeWidth * taper * 0.5, bladeWidth * taper, dx);
        }
        
        return blade;
    }
    
    void main() {
        // Use world coordinates for seamless tiling
        vec2 worldCoord = vWorldPosition.xz;
        
        // Base coordinate for grid
        vec2 gridCoord = worldCoord / uGridScale;
        
        // Create checker pattern for putting green stripes
        vec2 stripeCoord = floor(gridCoord * 2.0);
        float stripe = mod(stripeCoord.x + stripeCoord.y, 2.0);
        
        // Mix primary and secondary colors based on stripe
        vec3 baseColor = mix(uPrimaryColor, uSecondaryColor, stripe * 0.4);
        
        // Add noise for natural variation
        float noise1 = fbm(worldCoord * uNoiseScale);
        float noise2 = fbm(worldCoord * uNoiseScale * 2.3 + 100.0);
        
        // Combine noises for organic texture
        float combinedNoise = (noise1 + noise2 * 0.5) * uNoiseStrength;
        baseColor = mix(baseColor, uAccentColor, combinedNoise + 0.5 * uNoiseStrength);
        
        // Add subtle grass blade texture
        float blades = grassBlades(worldCoord, 8.0);
        blades += grassBlades(worldCoord + 0.37, 12.0) * 0.5;
        blades += grassBlades(worldCoord - 0.19, 6.0) * 0.3;
        blades = clamp(blades, 0.0, 1.0);
        
        // Darken slightly where grass blades are denser
        baseColor = mix(baseColor, baseColor * 0.85, blades * 0.3);
        
        // Create coordinate grid lines (subtle)
        vec2 gridLines = abs(fract(gridCoord) - 0.5);
        float lineX = 1.0 - smoothstep(uLineWidth, uLineWidth + 0.01, gridLines.x);
        float lineY = 1.0 - smoothstep(uLineWidth, uLineWidth + 0.01, gridLines.y);
        float gridLine = max(lineX, lineY) * 0.15; // Very subtle grid
        
        // Major grid lines every 5 units (more visible)
        vec2 majorGridCoord = worldCoord / (uGridScale * 5.0);
        vec2 majorGridLines = abs(fract(majorGridCoord) - 0.5);
        float majorLineX = 1.0 - smoothstep(uLineWidth * 0.5, uLineWidth * 0.5 + 0.005, majorGridLines.x);
        float majorLineY = 1.0 - smoothstep(uLineWidth * 0.5, uLineWidth * 0.5 + 0.005, majorGridLines.y);
        float majorGridLine = max(majorLineX, majorLineY) * 0.25;
        
        // Combine grid lines
        float totalGridLine = max(gridLine, majorGridLine);
        baseColor = mix(baseColor, uLineColor, totalGridLine);
        
        // Add very subtle time-based animation (wind effect)
        float windNoise = snoise(worldCoord * 0.1 + uTime * 0.3) * 0.02;
        baseColor += windNoise;
        
        // Vignette effect based on distance from origin (optional, subtle)
        float distFromOrigin = length(worldCoord) * 0.005;
        float vignette = 1.0 - smoothstep(0.0, 1.0, distFromOrigin * 0.1);
        baseColor *= 0.95 + vignette * 0.05;
        
        gl_FragColor = vec4(baseColor, 1.0);
    }
`;

/**
 * Creates the floor plane with procedural grass texture
 * @param {THREE.Scene} scene - The Three.js scene to add the floor to
 * @param {Object} options - Configuration options
 * @param {number} options.width - Width of the floor (default: 200)
 * @param {number} options.height - Height/depth of the floor (default: 200)
 * @param {number} options.segments - Geometry segments for detail (default: 100)
 * @param {THREE.Vector3} options.position - Position of the floor (default: origin)
 * @returns {THREE.Mesh} The floor mesh
 */
export function createFloor(scene, options = {}) {
    const {
        width = 200,
        height = 200,
        segments = 100,
        position = new THREE.Vector3(0, 0, 0)
    } = options;
    
    if (floorMesh) {
        removeFloor(scene);
    }
    
    const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
    
    // Use shader material in full mode, basic material in prototype mode
    if (isFullMode) {
        floorMaterial = new THREE.ShaderMaterial({
            uniforms: floorUniforms,
            vertexShader: floorVertexShader,
            fragmentShader: floorFragmentShader,
            side: THREE.DoubleSide
        });
    } else {
        // Prototype mode: simple basic material with primary color
        floorMaterial = new THREE.MeshBasicMaterial({
            color: floorUniforms.uPrimaryColor.value,
            side: THREE.DoubleSide
        });
    }
    
    floorMesh = new THREE.Mesh(geometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.copy(position);
    floorMesh.receiveShadow = true;
    floorMesh.userData.isFloor = true;
    floorMesh.userData.isCoursePlane = true;
    scene.add(floorMesh);
    
    console.log(`Floor created: ${width}x${height} at position (${position.x}, ${position.y}, ${position.z})`);
    
    return floorMesh;
}

/**
 * Creates a floor shaped to match a custom course definition
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {Object} courseDef - Course definition with shape info
 * @returns {THREE.Mesh} The floor mesh
 */
export function createCourseFloor(scene, courseDef) {
    // Remove existing floor
    if (floorMesh) {
        removeFloor(scene);
    }
    
    let geometry = null;
    
    // If we have floor polygons, use them (highest priority)
    if (Array.isArray(courseDef.floorPolygons) && courseDef.floorPolygons.length > 0) {
        console.log('Creating floor from polygons:', courseDef.floorPolygons);
        geometry = createGeometryFromPolygons(courseDef.floorPolygons);
        console.log('Polygon geometry created:', geometry ? 'success' : 'failed');
        // Set floor color to #e39de5
        setFloorColors({
            primary: 0xe39de5,
            secondary: 0xd67dd8,
            accent: 0xf0bdf2,
            line: 0xc85dca
        });
    } else if (courseDef.usePinkFloor) {
        // Use #e39de5 floor for levels that request it (like level 3)
        setFloorColors({
            primary: 0xe39de5,
            secondary: 0xd67dd8,
            accent: 0xf0bdf2,
            line: 0xc85dca
        });
    } else {
        // Use #e39de5 for all floors
        setFloorColors({
            primary: 0xe39de5,
            secondary: 0xd67dd8,
            accent: 0xf0bdf2,
            line: 0xc85dca
        });
    }
    
    // If we have painted tiles, use them (for painting mode) - only if no polygon geometry
    if (!geometry && Array.isArray(courseDef.paintedFloorTiles) && courseDef.paintedFloorTiles.length > 0) {
        geometry = createGeometryFromPaintedTiles(courseDef.paintedFloorTiles);
    }
    
    // Only use flood-fill if we don't have painted tiles and customWalls exist
    if (!geometry && courseDef?.customWalls?.length && 
        (!courseDef.paintedFloorTiles || courseDef.paintedFloorTiles.length === 0)) {
        geometry = createGridFloorGeometryFromWalls(courseDef);
    }
    
    // Only create rectangular/default floor if we don't have painted tiles
    // AND we're not in a "paint-only" mode (indicated by empty customWalls array)
    if (!geometry && (!courseDef.paintedFloorTiles || courseDef.paintedFloorTiles.length === 0)) {
        // If customWalls is explicitly empty array, don't create default floor (painting mode)
        if (Array.isArray(courseDef.customWalls) && courseDef.customWalls.length === 0) {
            // Don't create any floor - return null
            return null;
        }
        
        // Otherwise, create normal floor
        geometry = createRectangularCourseGeometry(courseDef);
        
        if (!geometry) {
            geometry = new THREE.PlaneGeometry(200, 200, 50, 50);
        }
    }
    
    // If no geometry was created and we have no painted tiles, don't create floor
    if (!geometry) {
        console.log('No floor geometry created - returning null');
        return null;
    }
    
    console.log('Creating floor mesh with geometry:', geometry.type);
    
    // Create material based on mode
    if (isFullMode) {
        // Full mode: use shader material with procedural texture
        floorMaterial = new THREE.ShaderMaterial({
            uniforms: floorUniforms,
            vertexShader: floorVertexShader,
            fragmentShader: floorFragmentShader,
            side: THREE.DoubleSide
        });
    } else {
        // Prototype mode: simple basic material with primary color
        floorMaterial = new THREE.MeshBasicMaterial({
            color: floorUniforms.uPrimaryColor.value,
            side: THREE.DoubleSide
        });
    }
    
    // Create mesh
    floorMesh = new THREE.Mesh(geometry, floorMaterial);
    
    // Rotate to be horizontal
    floorMesh.rotation.x = -Math.PI / 2;
    
    // Position at ground level
    floorMesh.position.y = 0;
    
    // Enable shadows
    floorMesh.receiveShadow = true;
    
    // Mark for identification
    floorMesh.userData.isFloor = true;
    floorMesh.userData.isCoursePlane = true;
    
    // Add to scene
    scene.add(floorMesh);
    
    console.log('Course floor created and added to scene');
    
    return floorMesh;
}

/**
 * Updates the floor shader uniforms (call in animation loop)
 * @param {number} deltaTime - Time since last frame in seconds
 */
export function updateFloor(deltaTime) {
    // Only update shader uniforms in full mode (basic material doesn't have uniforms)
    if (isFullMode && floorMaterial && floorUniforms) {
        floorUniforms.uTime.value += deltaTime;
    }
}

/**
 * Removes the floor from the scene
 * @param {THREE.Scene} scene - The Three.js scene
 */
export function removeFloor(scene) {
    if (floorMesh) {
        scene.remove(floorMesh);
        
        if (floorMesh.geometry) {
            floorMesh.geometry.dispose();
        }
        if (floorMaterial) {
            floorMaterial.dispose();
        }
        
        floorMesh = null;
        floorMaterial = null;
        
        console.log('Floor removed');
    }
}

/**
 * Gets the current floor mesh
 * @returns {THREE.Mesh|null} The floor mesh or null
 */
export function getFloorMesh() {
    return floorMesh;
}

/**
 * Sets floor texture colors
 * @param {Object} colors - Color configuration
 */
export function setFloorColors(colors = {}) {
    if (!floorUniforms) return;
    
    if (colors.primary) {
        floorUniforms.uPrimaryColor.value.set(colors.primary);
    }
    if (colors.secondary) {
        floorUniforms.uSecondaryColor.value.set(colors.secondary);
    }
    if (colors.accent) {
        floorUniforms.uAccentColor.value.set(colors.accent);
    }
    if (colors.line) {
        floorUniforms.uLineColor.value.set(colors.line);
    }
}

/**
 * Sets floor grid scale (size of grid cells)
 * @param {number} scale - Grid cell size in world units
 */
export function setFloorGridScale(scale) {
    if (floorUniforms) {
        floorUniforms.uGridScale.value = scale;
    }
}

/**
 * Sets floor line width for grid
 * @param {number} width - Line width (0.0 to 0.5)
 */
export function setFloorLineWidth(width) {
    if (floorUniforms) {
        floorUniforms.uLineWidth.value = Math.max(0, Math.min(0.5, width));
    }
}

/**
 * Hides the floor
 */
export function hideFloor() {
    if (floorMesh) {
        floorMesh.visible = false;
    }
}

/**
 * Shows the floor
 */
export function showFloor() {
    if (floorMesh) {
        floorMesh.visible = true;
    }
}

// Export uniforms for external access if needed
export { floorUniforms };

function createRectangularCourseGeometry(courseDef = null) {
    const width = courseDef?.width || 50;
    const height = courseDef?.height || 50;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    const shape = new THREE.Shape();
    shape.moveTo(-halfWidth, -halfHeight);
    shape.lineTo(halfWidth, -halfHeight);
    shape.lineTo(halfWidth, halfHeight);
    shape.lineTo(-halfWidth, halfHeight);
    shape.closePath();
    
    if (Array.isArray(courseDef?.rectangularHoles)) {
        courseDef.rectangularHoles.forEach((rectHole) => {
            const path = new THREE.Path();
            const halfHoleWidth = rectHole.width / 2;
            const halfHoleLength = rectHole.length / 2;
            const minX = rectHole.x - halfHoleWidth;
            const maxX = rectHole.x + halfHoleWidth;
            const minZ = rectHole.z - halfHoleLength;
            const maxZ = rectHole.z + halfHoleLength;
            
            path.moveTo(minX, minZ);
            path.lineTo(minX, maxZ);
            path.lineTo(maxX, maxZ);
            path.lineTo(maxX, minZ);
            path.closePath();
            shape.holes.push(path);
        });
    }
    
    return new THREE.ShapeGeometry(shape, 64);
}

function createGridFloorGeometryFromWalls(courseDef) {
    if (!courseDef?.customWalls?.length || !courseDef?.ballStartPosition) {
        return null;
    }
    
    const walls = courseDef.customWalls;
    const rects = [];
    const xs = [];
    const zs = [];
    
    walls.forEach((wall) => {
        const halfWidth = wall.width / 2;
        const halfDepth = wall.depth / 2;
        const minX = wall.x - halfWidth;
        const maxX = wall.x + halfWidth;
        const minZ = wall.z - halfDepth;
        const maxZ = wall.z + halfDepth;
        
        rects.push({ minX, maxX, minZ, maxZ });
        xs.push(minX, maxX);
        zs.push(minZ, maxZ);
    });
    
    if (Array.isArray(courseDef.rectangularHoles)) {
        courseDef.rectangularHoles.forEach((hole) => {
            const halfWidth = hole.width / 2;
            const halfLength = hole.length / 2;
            rects.push({
                minX: hole.x - halfWidth,
                maxX: hole.x + halfWidth,
                minZ: hole.z - halfLength,
                maxZ: hole.z + halfLength
            });
        });
    }
    
    if (xs.length === 0 || zs.length === 0) {
        return null;
    }
    
    const margin = 4;
    const gridMinX = Math.min(...xs) - margin;
    const gridMaxX = Math.max(...xs) + margin;
    const gridMinZ = Math.min(...zs) - margin;
    const gridMaxZ = Math.max(...zs) + margin;
    
    const gridStep = 0.5;
    const cols = Math.ceil((gridMaxX - gridMinX) / gridStep);
    const rows = Math.ceil((gridMaxZ - gridMinZ) / gridStep);
    
    if (cols * rows > 50000) {
        console.warn('Floor grid too large, falling back to rectangular geometry');
        return null;
    }
    
    const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
    const queue = [];
    
    // Add ball start position as first seed point
    const seedPoints = [
        { x: courseDef.ballStartPosition.x, z: courseDef.ballStartPosition.z }
    ];
    
    // Add hole position as additional seed point if it exists
    if (courseDef.holePosition) {
        seedPoints.push({ x: courseDef.holePosition.x, z: courseDef.holePosition.z });
    }
    
    // Add any custom floor seed points from level definition
    if (Array.isArray(courseDef.floorSeedPoints)) {
        courseDef.floorSeedPoints.forEach(pt => {
            seedPoints.push({ x: pt.x, z: pt.z });
        });
    }
    
    // Initialize flood-fill from all seed points
    seedPoints.forEach(seed => {
        const col = Math.floor((seed.x - gridMinX) / gridStep);
        const row = Math.floor((seed.z - gridMinZ) / gridStep);
        
        if (col >= 0 && col < cols && row >= 0 && row < rows) {
            if (!visited[row][col] && !isBlockedCell(col, row)) {
                visited[row][col] = true;
                queue.push({ col, row });
            }
        }
    });
    
    if (queue.length === 0) {
        console.warn('No valid seed points for floor generation');
        return null;
    }
    
    const cellCenters = [];
    
    while (queue.length > 0) {
        const { col, row } = queue.shift();
        const center = gridToWorld(col, row);
        cellCenters.push(center);
        
        const neighbors = [
            { col: col + 1, row },
            { col: col - 1, row },
            { col, row: row + 1 },
            { col, row: row - 1 }
        ];
        
        neighbors.forEach((neighbor) => {
            if (neighbor.col < 0 || neighbor.col >= cols || neighbor.row < 0 || neighbor.row >= rows) {
                return;
            }
            if (visited[neighbor.row][neighbor.col]) {
                return;
            }
            if (isBlockedCell(neighbor.col, neighbor.row)) {
                return;
            }
            visited[neighbor.row][neighbor.col] = true;
            queue.push(neighbor);
        });
    }
    
    // Add explicit floor zones from level definition
    if (Array.isArray(courseDef.floorZones)) {
        courseDef.floorZones.forEach(zone => {
            const zoneMinX = zone.minX;
            const zoneMaxX = zone.maxX;
            const zoneMinZ = zone.minZ;
            const zoneMaxZ = zone.maxZ;
            const flipZ = zone.flipZ || false;
            
            // Generate tiles for this zone
            for (let x = zoneMinX; x < zoneMaxX; x += gridStep) {
                for (let z = zoneMinZ; z < zoneMaxZ; z += gridStep) {
                    // Apply Z flip if specified (flip about X axis means negate Z)
                    const finalZ = flipZ ? -z : z;
                    cellCenters.push({ x: x + gridStep / 2, z: finalZ + gridStep / 2 });
                }
            }
        });
    }
    
    // Add painted tiles from level definition (if any)
    if (Array.isArray(courseDef.paintedFloorTiles)) {
        courseDef.paintedFloorTiles.forEach(tileKey => {
            const [x, z] = tileKey.split(',').map(Number);
            cellCenters.push({ x, z });
        });
    }
    
    // Remove tiles in exclusion zones
    if (Array.isArray(courseDef.floorExclusions)) {
        const exclusions = courseDef.floorExclusions;
        const filteredCenters = cellCenters.filter(cell => {
            // Check if this cell is inside any exclusion zone
            for (const exclusion of exclusions) {
                if (cell.x >= exclusion.minX && cell.x <= exclusion.maxX &&
                    cell.z >= exclusion.minZ && cell.z <= exclusion.maxZ) {
                    return false; // Exclude this cell
                }
            }
            return true; // Keep this cell
        });
        cellCenters.length = 0;
        cellCenters.push(...filteredCenters);
    }
    
    if (cellCenters.length === 0) {
        console.warn('No reachable floor cells detected, falling back to rectangular geometry');
        return null;
    }
    
    const tileGeometry = new THREE.PlaneGeometry(gridStep, gridStep);
    const translatedGeometries = cellCenters.map(({ x, z }) => {
        const geom = tileGeometry.clone();
        geom.translate(x, z, 0);
        return geom;
    });
    
    const mergedGeometry = mergePlanarGeometries(translatedGeometries);
    tileGeometry.dispose();
    translatedGeometries.forEach((geom) => geom.dispose());
    
    return mergedGeometry;
    
    function isBlockedCell(col, row) {
        const { x, z } = gridToWorld(col, row);
        return rects.some((rect) => pointInRect(rect, x, z));
    }
    
    function gridToWorld(col, row) {
        return {
            x: gridMinX + (col + 0.5) * gridStep,
            z: gridMinZ + (row + 0.5) * gridStep
        };
    }
}

function pointInRect(rect, x, z) {
    return (
        x >= rect.minX &&
        x <= rect.maxX &&
        z >= rect.minZ &&
        z <= rect.maxZ
    );
}

/**
 * Create floor geometry from polygon definitions
 * Each polygon is an array of corner points {x, z}
 */
function createGeometryFromPolygons(polygons) {
    if (!polygons || polygons.length === 0) {
        console.log('createGeometryFromPolygons: No polygons provided');
        return null;
    }
    
    console.log(`createGeometryFromPolygons: Processing ${polygons.length} polygon(s)`);
    
    const shapes = [];
    
    polygons.forEach((polygon, index) => {
        if (!polygon || polygon.length < 3) {
            console.warn(`Polygon ${index} has less than 3 corners, skipping`);
            return;
        }
        
        console.log(`Creating shape for polygon ${index} with ${polygon.length} corners:`, polygon);
        
        // Create THREE.Shape from polygon corners
        const shape = new THREE.Shape();
        
        // Move to first corner
        shape.moveTo(polygon[0].x, polygon[0].z);
        
        // Draw lines to each subsequent corner
        for (let i = 1; i < polygon.length; i++) {
            shape.lineTo(polygon[i].x, polygon[i].z);
        }
        
        // Close the shape
        shape.closePath();
        
        shapes.push(shape);
    });
    
    if (shapes.length === 0) {
        console.log('createGeometryFromPolygons: No valid shapes created');
        return null;
    }
    
    console.log(`createGeometryFromPolygons: Created ${shapes.length} shape(s)`);
    
    // If multiple polygons, combine them
    if (shapes.length === 1) {
        const geometry = new THREE.ShapeGeometry(shapes[0], 64);
        console.log('createGeometryFromPolygons: Created single ShapeGeometry');
        return geometry;
    } else {
        // Combine multiple shapes into one geometry
        const geometries = shapes.map(shape => new THREE.ShapeGeometry(shape, 64));
        const mergedGeometry = mergePlanarGeometries(geometries);
        geometries.forEach(geom => geom.dispose());
        console.log('createGeometryFromPolygons: Created merged geometry from multiple shapes');
        return mergedGeometry;
    }
}

/**
 * Create floor geometry directly from painted tiles
 * Optimized: Groups adjacent tiles into larger rectangles for better performance
 */
function createGeometryFromPaintedTiles(paintedTiles) {
    if (!paintedTiles || paintedTiles.length === 0) {
        return null;
    }
    
    const gridStep = 0.5;
    
    // Convert tile coordinates to a set for quick lookup
    const tileSet = new Set(paintedTiles);
    
    // Group tiles into optimized rectangular regions
    const regions = groupTilesIntoRectangles(paintedTiles, gridStep);
    
    if (regions.length === 0) {
        return null;
    }
    
    // Create larger geometries for each rectangular region
    const regionGeometries = regions.map(region => {
        const width = region.maxX - region.minX;
        const height = region.maxZ - region.minZ;
        const centerX = (region.minX + region.maxX) / 2;
        const centerZ = (region.minZ + region.maxZ) / 2;
        
        const geometry = new THREE.PlaneGeometry(width, height);
        geometry.translate(centerX, centerZ, 0);
        return geometry;
    });
    
    // Merge all regions into one geometry
    const mergedGeometry = mergePlanarGeometries(regionGeometries);
    
    // Dispose of intermediate geometries
    regionGeometries.forEach((geom) => geom.dispose());
    
    return mergedGeometry;
}

/**
 * Group tiles into the largest possible rectangular regions
 * Uses a greedy scanline-based algorithm for better performance
 * Minimum rectangle size: 2x2 tiles to reduce geometry count
 */
function groupTilesIntoRectangles(paintedTiles, gridStep) {
    if (!paintedTiles || paintedTiles.length === 0) {
        return [];
    }
    
    const MIN_SIZE = 12; // Minimum total tiles (area) - rectangles must have at least 12 tiles
    
    // Convert to set for O(1) lookup
    const tileSet = new Set(paintedTiles);
    const usedTiles = new Set();
    const regions = [];
    
    // Parse all tiles into coordinates
    const tiles = paintedTiles.map(key => {
        const [x, z] = key.split(',').map(Number);
        return { x, z, key };
    });
    
    // Sort tiles by Z then X for scanline processing
    tiles.sort((a, b) => {
        if (Math.abs(a.z - b.z) < 0.01) {
            return a.x - b.x;
        }
        return a.z - b.z;
    });
    
    // Process tiles in scanlines (rows)
    for (const startTile of tiles) {
        if (usedTiles.has(startTile.key)) {
            continue;
        }
        
        // Try to expand horizontally first (along X axis)
        let maxWidth = 1;
        let currentZ = startTile.z;
        
        // Find maximum width at this Z position
        while (true) {
            const nextX = startTile.x + maxWidth * gridStep;
            const nextKey = `${nextX.toFixed(1)},${currentZ.toFixed(1)}`;
            if (tileSet.has(nextKey) && !usedTiles.has(nextKey)) {
                maxWidth++;
            } else {
                break;
            }
        }
        
        // Now try to expand vertically (along Z axis) with this width
        let maxHeight = 1;
        let canExpand = true;
        
        while (canExpand) {
            const nextZ = startTile.z + maxHeight * gridStep;
            let rowValid = true;
            
            // Check if entire row at this Z is valid
            for (let w = 0; w < maxWidth; w++) {
                const checkX = startTile.x + w * gridStep;
                const checkKey = `${checkX.toFixed(1)},${nextZ.toFixed(1)}`;
                if (!tileSet.has(checkKey) || usedTiles.has(checkKey)) {
                    rowValid = false;
                    break;
                }
            }
            
            if (rowValid) {
                maxHeight++;
            } else {
                canExpand = false;
            }
        }
        
        // Only create rectangles that have at least MIN_SIZE tiles total (area)
        // Skip smaller rectangles - they'll be handled in the orphan pass
        const area = maxWidth * maxHeight;
        if (area < MIN_SIZE) {
            continue;
        }
        
        // Create region for this rectangle
        const region = {
            minX: startTile.x - gridStep / 2,
            maxX: startTile.x + (maxWidth - 1) * gridStep + gridStep / 2,
            minZ: startTile.z - gridStep / 2,
            maxZ: startTile.z + (maxHeight - 1) * gridStep + gridStep / 2
        };
        
        regions.push(region);
        
        // Mark all tiles in this region as used
        for (let h = 0; h < maxHeight; h++) {
            for (let w = 0; w < maxWidth; w++) {
                const tileX = startTile.x + w * gridStep;
                const tileZ = startTile.z + h * gridStep;
                const tileKey = `${tileX.toFixed(1)},${tileZ.toFixed(1)}`;
                usedTiles.add(tileKey);
            }
        }
    }
    
    // Handle any remaining unused tiles (orphaned tiles that couldn't form minimum-sized rectangles)
    // Group them into small clusters
    const orphanedTiles = tiles.filter(t => !usedTiles.has(t.key));
    if (orphanedTiles.length > 0) {
        // Group orphaned tiles into small clusters
        for (const tile of orphanedTiles) {
            if (usedTiles.has(tile.key)) continue;
            
            // Try to find nearby orphaned tiles to group together
            const cluster = [tile];
            usedTiles.add(tile.key);
            
            // Look for adjacent tiles
            for (const otherTile of orphanedTiles) {
                if (usedTiles.has(otherTile.key)) continue;
                
                const dx = Math.abs(otherTile.x - tile.x);
                const dz = Math.abs(otherTile.z - tile.z);
                
                // If adjacent and we can form a cluster up to MIN_SIZE tiles
                if ((dx < gridStep * 1.1 && dz < gridStep * 1.1) && cluster.length < MIN_SIZE) {
                    cluster.push(otherTile);
                    usedTiles.add(otherTile.key);
                }
            }
            
            // Create region for cluster
            if (cluster.length > 0) {
                const xs = cluster.map(t => t.x);
                const zs = cluster.map(t => t.z);
                const region = {
                    minX: Math.min(...xs) - gridStep / 2,
                    maxX: Math.max(...xs) + gridStep / 2,
                    minZ: Math.min(...zs) - gridStep / 2,
                    maxZ: Math.max(...zs) + gridStep / 2
                };
                regions.push(region);
            }
        }
    }
    
    return regions;
}

function mergePlanarGeometries(geometries) {
    if (!Array.isArray(geometries) || geometries.length === 0) {
        return null;
    }
    
    const processedGeometries = [];
    
    geometries.forEach((geometry) => {
        if (!geometry) {
            return;
        }
        const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        processedGeometries.push(geom);
    });
    
    if (processedGeometries.length === 0) {
        return null;
    }
    
    const attributeNames = Object.keys(processedGeometries[0].attributes);
    const mergedGeometry = new THREE.BufferGeometry();
    
    const arrays = {};
    const offsets = {};
    
    attributeNames.forEach((name) => {
        let length = 0;
        processedGeometries.forEach((geometry) => {
            const attribute = geometry.attributes[name];
            if (!attribute) {
                throw new Error(`Attribute '${name}' missing on merged geometry source`);
            }
            length += attribute.array.length;
        });
        
        const ArrayType = processedGeometries[0].attributes[name].array.constructor;
        arrays[name] = new ArrayType(length);
        offsets[name] = 0;
    });
    
    processedGeometries.forEach((geometry) => {
        attributeNames.forEach((name) => {
            const attribute = geometry.attributes[name];
            arrays[name].set(attribute.array, offsets[name]);
            offsets[name] += attribute.array.length;
        });
    });
    
    attributeNames.forEach((name) => {
        const sampleAttribute = processedGeometries[0].attributes[name];
        mergedGeometry.setAttribute(
            name,
            new THREE.BufferAttribute(
                arrays[name],
                sampleAttribute.itemSize,
                sampleAttribute.normalized
            )
        );
    });
    
    processedGeometries.forEach((geometry) => geometry.dispose());
    
    mergedGeometry.computeBoundingBox();
    mergedGeometry.computeBoundingSphere();
    
    return mergedGeometry;
}
