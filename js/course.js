// Course geometry and setup
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, isFullMode } from './main.js';
import { getHolePosition } from './game.js';
import { createBumper, removeAllBumpers } from './bumpers.js';
import { createMovingWall, removeAllMovingWalls } from './moving-walls.js';
import { createFan, removeAllFans } from './fans.js';
import { createMagneticField, removeAllMagneticFields } from './magnetic-fields.js';
import { createTeleporter, removeAllTeleporters } from './teleporters.js';
import { createCourseFloor, removeFloor, updateFloor, hideFloor, showFloor, getFloorMesh } from './floor.js';

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
let coordinateAxes = null; // Coordinate axes indicator
let models = []; // 3D models loaded for the course
let gltfLoader = new GLTFLoader();

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

// Clear all course objects from the scene
export function clearCourse() {
    console.log('COURSE: Clearing all course objects');
    
    // Remove floor
    removeFloor();
    coursePlane = null;
    
    // Remove hump
    if (courseHump) {
        scene.remove(courseHump);
        courseHump.geometry?.dispose();
        courseHump.material?.dispose();
        courseHump = null;
    }
    
    // Remove all walls
    walls.forEach(wall => {
        if (wall) {
            scene.remove(wall);
            wall.geometry?.dispose();
            wall.material?.dispose();
        }
    });
    walls = [];
    
    // Remove test walls
    testWalls.forEach(wall => {
        if (wall) {
            scene.remove(wall);
            wall.geometry?.dispose();
            wall.material?.dispose();
        }
    });
    testWalls = [];
    
    // Remove custom walls
    removeAllCustomWalls();
    
    // Remove rectangular hole walls
    removeAllRectangularHoleWalls();
    
    // Remove rectangular hole edge walls
    rectangularHoleEdgeWalls.forEach(wall => {
        if (wall) {
            scene.remove(wall);
            wall.geometry?.dispose();
            wall.material?.dispose();
        }
    });
    rectangularHoleEdgeWalls = [];
    
    // Remove all bumpers
    removeAllBumpers();
    
    // Remove all moving walls
    removeAllMovingWalls();
    
    // Remove all fans
    removeAllFans();
    
    // Remove all magnetic fields
    removeAllMagneticFields();
    
    // Remove coordinate axes
    removeCoordinateAxes();
    
    // Remove all 3D models
    removeAllModels();
    
    // Import and remove wind zones and windmills
    import('./wind-zones.js').then(module => {
        if (module.removeAllWindZones) {
            module.removeAllWindZones();
        }
    });
    
    import('./windmill.js').then(module => {
        if (module.removeAllWindmills) {
            module.removeAllWindmills();
        }
    });
    
    console.log('COURSE: All course objects cleared');
}

export function createCourse(courseDef = null, courseIndex = -1) {
    console.log('COURSE: createCourse called with courseDef:', courseDef);
    console.log('COURSE: courseDef has models:', courseDef && courseDef.models);
    console.log('COURSE: models length:', courseDef && courseDef.models && courseDef.models.length);

    // Store course definition
    courseDefinition = courseDef;
    
    // Set course dimensions from definition
    if (courseDef) {
        COURSE_WIDTH = courseDef.width;
        COURSE_HEIGHT = courseDef.height;
    }
    
    // Floor creation - only create floor for level 3 (courseIndex === 2)
    // For other levels, create if floorPolygons or painted tiles exist
    // The invisible physics plane for collision is handled separately in physics.js
    if (courseIndex === 2) {
        // Level 3: Create floor with normal grass texture
        coursePlane = createCourseFloor(scene, courseDef);
    } else if (courseDef && (
        (Array.isArray(courseDef.floorPolygons) && courseDef.floorPolygons.length > 0) ||
        (Array.isArray(courseDef.paintedFloorTiles) && courseDef.paintedFloorTiles.length > 0)
    )) {
        // Other levels: Create floor from polygons or painted tiles
        coursePlane = createCourseFloor(scene, courseDef);
    } else {
        // No floor - start with empty floor
        coursePlane = null;
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
    
    // Only create obstacles in full mode
    if (isFullMode) {
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
        
        // Create moving walls if defined
        if (courseDef && courseDef.movingWalls && courseDef.movingWalls.length > 0) {
            courseDef.movingWalls.forEach(movingWallDef => {
                createMovingWall(movingWallDef);
            });
        }
        
        // Create fans if defined
        if (courseDef && courseDef.fans && courseDef.fans.length > 0) {
            courseDef.fans.forEach(fanDef => {
                createFan(fanDef);
            });
        }
        
        // Create magnetic fields if defined
        if (courseDef && courseDef.magneticFields && courseDef.magneticFields.length > 0) {
            courseDef.magneticFields.forEach(fieldDef => {
                createMagneticField(fieldDef);
            });
        }
        
        // Create teleporters if defined
        if (courseDef && courseDef.teleporters && courseDef.teleporters.length > 0) {
            courseDef.teleporters.forEach(teleporterDef => {
                createTeleporter(teleporterDef);
            });
        }
    }

    // Create models if defined
    if (courseDef && courseDef.models && courseDef.models.length > 0) {
        console.log(`COURSE: Creating ${courseDef.models.length} megastructures for course`);
        courseDef.models.forEach((modelDef, index) => {
            console.log(`COURSE: Creating megastructure ${index + 1}:`, modelDef);
            const result = createModel(modelDef);
            console.log(`COURSE: Megastructure ${index + 1} creation result:`, result);
        });
        console.log(`COURSE: Total models in scene:`, models.length);
    }

    // Coordinate axes removed - no longer needed
    // if (courseIndex >= 3) {
    //     createCoordinateAxes();
    // }

    return {
        plane: coursePlane,
        hump: courseHump,
        walls: walls,
        width: COURSE_WIDTH,
        height: COURSE_HEIGHT
    };
}

// Model loading functionality
function createModel(config) {
    const {
        url,                    // Path to model file
        format = 'glb',         // 'glb', 'gltf', or 'obj'
        type,                   // 'floatingIsland', 'decoration', etc.
        geometry,               // 'box', 'cylinder', 'octahedron', etc. for procedural geometry
        size,                   // THREE.Vector3 size for procedural geometry
        color,                  // Color for procedural geometry
        position,               // THREE.Vector3 position
        rotation = new THREE.Euler(0, 0, 0), // Rotation in radians
        scale = new THREE.Vector3(1, 1, 1), // Scale
        castShadow = true,      // Cast shadows
        receiveShadow = true,   // Receive shadows
        userData = {}           // Optional custom data
    } = config;

    // Handle procedural geometry (floating islands, decorations)
    if (geometry) {
        let meshGeometry;
        let material;

        // Create geometry based on type
        switch (geometry) {
            case 'box':
                meshGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
                break;
            case 'cylinder':
                meshGeometry = new THREE.CylinderGeometry(size.x, size.x, size.y, 16);
                break;
            case 'sphere':
                meshGeometry = new THREE.SphereGeometry(size.x, 16, 16);
                break;
            case 'octahedron':
                meshGeometry = new THREE.OctahedronGeometry(size.x);
                break;
            case 'tetrahedron':
                meshGeometry = new THREE.TetrahedronGeometry(size.x);
                break;
            case 'dodecahedron':
                meshGeometry = new THREE.DodecahedronGeometry(size.x);
                break;
            case 'icosahedron':
                meshGeometry = new THREE.IcosahedronGeometry(size.x);
                break;
                    case 'proceduralIsland':
                // Create an organic island shape using multiple combined geometries
                return createProceduralIsland(config);
            case 'flyingMachine':
                console.log('MEGA: Matched flyingMachine case, calling createFlyingMachine');
                const flyingMachine = createFlyingMachine(position, config.orbitRadius, config.orbitHeight, config.orbitSpeed, config.colorScheme);
                console.log('MEGA: createFlyingMachine returned:', flyingMachine);
                return flyingMachine;
            case 'crystalPillar':
                console.log('MEGA: Matched crystalPillar case, calling createCrystalPillar');
                const result = createCrystalPillar(position, config.height, config.radius);
                console.log('MEGA: createCrystalPillar returned:', result);
                return result;
            case 'floatingRing':
                return createFloatingRing(position, config.radius, config.thickness);
            case 'archway':
                return createArchway(position, config.width, config.height);
            case 'spiralTower':
                return createSpiralTower(position, config.height, config.radius);
            case 'floatingPlatform':
                return createFloatingPlatform(position, config.size, config.height);
            case 'energyBridge':
                return createEnergyBridge(position, config.length, config.height);
            case 'crystalFormation':
                return createCrystalFormation(position, config.scale);
            case 'holographicDome':
                return createHolographicDome(position, config.radius, config.height);
            case 'aeroArch':
                return createAeroArch(position, config.span, config.rise);
            case 'floatingCitadel':
                return createFloatingCitadel(position, config.size);
            case 'mysticalGateway':
                return createMysticalGateway(position, config.width, config.height);
            case 'giantArch':
                return createGiantArch(position, config.width, config.height, config.thickness);
            case 'giantSpiral':
                return createGiantSpiral(position, config.height, config.radius, config.turns);
            case 'giantRingGate':
                return createGiantRingGate(position, config.radius, config.thickness);
            case 'giantCrystalPillar':
                return createGiantCrystalPillar(position, config.height, config.radius);
            // New iridescent structures for Level 1
            case 'iridescentObelisk':
                return createIridescentObelisk(position, config.height, config.width, config.color, config.intensity);
            case 'floatingIridescentRing':
                return createFloatingIridescentRing(position, config.radius, config.tubeRadius, config.color, config.rotationAxis);
            case 'prismaticPyramid':
                return createPrismaticPyramid(position, config.size, config.height, config.color);
            // New iridescent structures for Level 3
            case 'iridescentTorusKnot':
                return createIridescentTorusKnot(position, config.scale, config.p, config.q, config.color, config.intensity);
            case 'crystalLatticeDome':
                return createCrystalLatticeDome(position, config.radius, config.segments, config.color, config.intensity);
            case 'shimmeringHelix':
                return createShimmeringHelix(position, config.height, config.radius, config.turns, config.strands, config.color, config.intensity);
            case 'prismaticSpires':
                return createPrismaticSpires(position, config.count, config.maxHeight, config.baseRadius, config.color, config.intensity);
            case 'box':
                console.log('MEGA: Creating test box/cube');
                const boxGeometry = new THREE.BoxGeometry(config.size.x, config.size.y, config.size.z);
                const boxMaterial = isFullMode
                    ? new THREE.MeshStandardMaterial({ color: config.color })
                    : new THREE.MeshBasicMaterial({ color: config.color });
                const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
                boxMesh.position.copy(position);
                scene.add(boxMesh);
                models.push(boxMesh);
                console.log('MEGA: Added test box/cube to scene');
                return;
            case 'sphere':
                console.log('MEGA: Creating test sphere');
                const sphereGeometry = new THREE.SphereGeometry(config.size.x, 16, 16);
                const sphereMaterial = isFullMode
                    ? new THREE.MeshStandardMaterial({ color: config.color })
                    : new THREE.MeshBasicMaterial({ color: config.color });
                const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
                sphereMesh.position.copy(position);
                scene.add(sphereMesh);
                models.push(sphereMesh);
                console.log('MEGA: Added test sphere to scene');
                return;
            default:
                console.log('MEGA: Unknown geometry type:', geometry, 'falling back to box');
                const defaultGeometry = new THREE.BoxGeometry(1, 1, 1);
                const defaultMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const defaultMesh = new THREE.Mesh(defaultGeometry, defaultMaterial);
                defaultMesh.position.copy(position);
                scene.add(defaultMesh);
                models.push(defaultMesh);
                return;
        }

        // Create material
        if (isFullMode) {
            material = new THREE.MeshStandardMaterial({
                color: color,
                metalness: 0.2,
                roughness: 0.8
            });
        } else {
            material = new THREE.MeshBasicMaterial({ color: color });
        }

        // Create mesh
        const mesh = new THREE.Mesh(meshGeometry, material);
        mesh.position.copy(position);
        mesh.rotation.copy(rotation);
        mesh.scale.copy(scale);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        mesh.userData = { ...userData, isProceduralModel: true, type: type };

        // Add to scene
        scene.add(mesh);
        models.push(mesh);

        console.log(`Created procedural ${geometry} model at position`, position);
        return;
    }

    // Handle file-based models
    if (format === 'glb') {
        gltfLoader.load(
            url,
            (gltf) => {
                const model = gltf.scene;

                // Set position, rotation, and scale
                model.position.copy(position);
                model.rotation.copy(rotation);
                model.scale.copy(scale);

                // Set shadow properties
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = castShadow;
                        child.receiveShadow = receiveShadow;
                    }
                });

                // Add user data
                model.userData = { ...userData, isModel: true };

                // Start model invisible if it's the neco-arc model
                if (url.includes('neco-arc')) {
                    model.visible = false;
                    model.userData.isNecoArc = true;
                }

                // Add to scene and store reference
                scene.add(model);
                models.push(model);

                console.log(`Loaded model: ${url} at position`, position);
            },
            (progress) => {
                console.log(`Loading model ${url}: ${(progress.loaded / progress.total * 100)}%`);
            },
            (error) => {
                console.error(`Error loading model ${url}:`, error);
            }
        );
    } else {
        console.warn(`Model format '${format}' not supported yet. Only GLB is currently supported.`);
    }
}

function removeAllModels() {
    models.forEach(model => {
        scene.remove(model);
        // Dispose geometries, materials, and textures for both individual meshes and groups
        model.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            material.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            }
        });
    });
    models = [];
}

export { removeAllModels, updateAnimatedMaterials };

// Hide neco-arc model
export function hideNecoArcModel() {
    models.forEach(model => {
        if (model.userData.isNecoArc) {
            model.visible = false;
            console.log('Neco-arc model hidden');
        }
    });
}

// Show neco-arc model (called when teleporter is used)
export function showNecoArcModel() {
    console.log('showNecoArcModel called, models array length:', models.length);
    
    let foundModel = false;
    models.forEach(model => {
        if (model.userData.isNecoArc) {
            foundModel = true;
            console.log('Found neco-arc model at position:', model.position);
            
            // Create particle burst effect at model position
            import('./particles.js').then(particlesModule => {
                const modelPos = model.position;
                // Create multiple particle bursts
                particlesModule.createParticleBurst(
                    new THREE.Vector3(modelPos.x, modelPos.y + 10, modelPos.z),
                    0xffff00, // Yellow particles
                    100,
                    5.0
                );
                particlesModule.createParticleBurst(
                    new THREE.Vector3(modelPos.x, modelPos.y + 5, modelPos.z),
                    0xff00ff, // Magenta particles
                    80,
                    4.0
                );
                particlesModule.createGoldBurst(
                    new THREE.Vector3(modelPos.x, modelPos.y, modelPos.z),
                    150
                );
            });

            // Make sure model and all children are visible
            model.visible = true;
            model.userData.fadeInStartTime = Date.now() / 1000;
            model.userData.fadeInDuration = 2.0; // 2 seconds fade-in
            
            // Set initial opacity to 0 for fade-in, but ensure visibility
            model.traverse((child) => {
                child.visible = true; // Make sure all children are visible
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            mat.transparent = true;
                            mat.opacity = 0;
                        });
                    } else {
                        child.material.transparent = true;
                        child.material.opacity = 0;
                    }
                }
            });

            console.log('Neco-arc model revealed with fade-in!');
        }
    });
    
    if (!foundModel) {
        console.error('showNecoArcModel: No neco-arc model found in models array!');
        // Try to find it in the scene directly
        scene.traverse((obj) => {
            if (obj.userData && obj.userData.isNecoArc) {
                console.log('Found neco-arc in scene (not in models array):', obj);
                obj.visible = true;
                obj.traverse((child) => {
                    child.visible = true;
                });
            }
        });
    }
}

// Update model fade-in animation
export function updateModelAnimations(deltaTime) {
    models.forEach(model => {
        if (model.userData.isNecoArc && model.userData.fadeInStartTime) {
            const elapsed = (Date.now() / 1000) - model.userData.fadeInStartTime;
            const progress = Math.min(elapsed / model.userData.fadeInDuration, 1.0);
            
            // Smooth fade-in using ease-out curve
            const opacity = progress * progress; // Ease-out quadratic
            
            model.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat.transparent !== undefined) {
                                mat.opacity = opacity;
                            }
                        });
                    } else {
                        if (child.material.transparent !== undefined) {
                            child.material.opacity = opacity;
                        }
                    }
                }
            });
        }
        
        // Animate floating iridescent rings
        if (model.userData.rotationAxis && model.userData.rotationSpeed) {
            const axis = model.userData.rotationAxis;
            const speed = model.userData.rotationSpeed;
            model.rotateOnAxis(axis, speed * deltaTime);
        }
    });
}

// Hide/show course elements for cutscene
let courseElementsHidden = false;
let hiddenElements = {
    coursePlane: null,
    courseHump: null,
    walls: [],
    teleporters: [],
    hole: null,
    bumpers: [],
    fans: [],
    magneticFields: [],
    powerUps: [],
    movingWalls: [],
    rectangularHoleWalls: []
};

export function hideAllCourseElements() {
    if (courseElementsHidden) return; // Already hidden
    
    courseElementsHidden = true;
    
    // Hide floor using floor module
    hideFloor();
    
    // Hide course plane (reference for restoring)
    if (coursePlane) {
        hiddenElements.coursePlane = coursePlane;
    }
    
    // Hide course hump
    if (courseHump) {
        courseHump.visible = false;
        hiddenElements.courseHump = courseHump;
    }
    
    // Hide custom walls
    const customWalls = getCustomWalls();
    customWalls.forEach(wall => {
        if (wall && wall.visible !== undefined) {
            wall.visible = false;
            hiddenElements.walls.push(wall);
        }
    });
    
    // Hide rectangular hole walls
    rectangularHoleWalls.forEach(wall => {
        if (wall && wall.visible !== undefined) {
            wall.visible = false;
            hiddenElements.rectangularHoleWalls.push(wall);
        }
    });
    
    // Helper function to check if object is part of neco-arc model
    function isPartOfNecoArc(obj) {
        let current = obj;
        while (current) {
            if (current.userData && current.userData.isNecoArc) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }
    
    // Hide EVERYTHING via scene traversal (synchronous - much faster and more reliable)
    // Hide all meshes, lights, and objects except ball and neco-arc model
    scene.traverse((object) => {
        // Skip the ball and its coordinate display
        if (object.userData && object.userData.isBall) return;
        if (object.isSprite) return; // Skip sprites (like coordinate display)
        
        // Skip neco-arc model and all its children
        if (object.userData && object.userData.isNecoArc) return;
        if (isPartOfNecoArc(object)) return;
        
        // Skip particles
        if (object.userData && object.userData.isParticle) return;
        if (object.isPoints) return; // Skip particle systems
        
        // Hide ALL meshes (ground, walls, everything)
        if (object.isMesh) {
            if (object.visible !== false) { // Only hide if not already hidden
                object.visible = false;
                // Store in appropriate category
                if (object.userData && object.userData.isTeleporter) {
                    hiddenElements.teleporters.push(object);
                } else if (object.userData && object.userData.isBumper) {
                    hiddenElements.bumpers.push(object);
                } else if (object.userData && object.userData.isFan) {
                    hiddenElements.fans.push(object);
                } else if (object.userData && object.userData.isMagneticField) {
                    hiddenElements.magneticFields.push(object);
                } else if (object.userData && object.userData.isPowerUp) {
                    hiddenElements.powerUps.push(object);
                } else if (object.userData && object.userData.isMovingWall) {
                    hiddenElements.movingWalls.push(object);
                } else if (object.userData && (object.userData.isHole || object.userData.isHoleIndicator)) {
                    if (!hiddenElements.hole) hiddenElements.hole = [];
                    hiddenElements.hole.push(object);
                } else if (object.geometry && object.geometry.type === 'CylinderGeometry' && 
                           object.material && object.material.color && object.material.color.getHex() === 0x000000) {
                    // Black cylinder (hole)
                    if (!hiddenElements.hole) hiddenElements.hole = [];
                    hiddenElements.hole.push(object);
                } else {
                    // Generic mesh (walls, ground, etc.)
                    hiddenElements.walls.push(object);
                }
            }
            return;
        }
        
        // Hide lights (except ambient/hemisphere that might be needed)
        if (object.isLight && object.type !== 'AmbientLight' && object.type !== 'HemisphereLight') {
            if (object.visible !== undefined) {
                object.visible = false;
            }
            return;
        }
        
        // Hide groups that might contain course elements (but not neco-arc)
        if (object.isGroup && !object.userData.isNecoArc && !object.userData.isBall && !isPartOfNecoArc(object)) {
            // Check if group contains course elements
            let hasCourseElements = false;
            object.traverse((child) => {
                if (child.isMesh && child !== object) {
                    hasCourseElements = true;
                }
            });
            if (hasCourseElements && object.visible !== false) {
                object.visible = false;
                hiddenElements.walls.push(object);
            }
        }
    });
    
    console.log('All course elements hidden for cutscene');
}

export function showAllCourseElements() {
    if (!courseElementsHidden) return; // Already visible
    
    courseElementsHidden = false;
    
    // Show floor using floor module
    showFloor();
    
    // Show course plane
    if (hiddenElements.coursePlane) {
        hiddenElements.coursePlane.visible = true;
    }
    
    // Show course hump
    if (hiddenElements.courseHump) {
        hiddenElements.courseHump.visible = true;
    }
    
    // Show walls
    hiddenElements.walls.forEach(wall => {
        if (wall) wall.visible = true;
    });
    
    hiddenElements.rectangularHoleWalls.forEach(wall => {
        if (wall) wall.visible = true;
    });
    
    // Show teleporters
    hiddenElements.teleporters.forEach(tp => {
        if (tp) tp.visible = true;
    });
    
    // Show hole
    if (hiddenElements.hole) {
        hiddenElements.hole.forEach(obj => {
            if (obj) obj.visible = true;
        });
    }
    
    // Show other elements
    hiddenElements.bumpers.forEach(bumper => {
        if (bumper) bumper.visible = true;
    });
    
    hiddenElements.fans.forEach(fan => {
        if (fan) fan.visible = true;
    });
    
    hiddenElements.magneticFields.forEach(field => {
        if (field) field.visible = true;
    });
    
    hiddenElements.powerUps.forEach(powerUp => {
        if (powerUp) powerUp.visible = true;
    });
    
    hiddenElements.movingWalls.forEach(wall => {
        if (wall) wall.visible = true;
    });
    
    // Clear hidden elements
    hiddenElements = {
        coursePlane: null,
        courseHump: null,
        walls: [],
        teleporters: [],
        hole: null,
        bumpers: [],
        fans: [],
        magneticFields: [],
        powerUps: [],
        movingWalls: [],
        rectangularHoleWalls: []
    };
    
    console.log('All course elements shown again');
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
        : new THREE.MeshBasicMaterial({ color: 0x14cbee });
    
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
    
    // All walls use the same color
    const wallColor = 0xd3685c; // #d3685c
    const wallColors = {
        north: wallColor,
        south: wallColor,
        east: wallColor,
        west: wallColor,
        extended: wallColor,
        test: wallColor
    };
    
    function createWallWithColor(width, height, depth, color) {
        const geometry = new THREE.BoxGeometry(width, height, depth);

        // Use fade material for tall walls that extend below ground
        let material;
        if (height >= 100) { // Tall walls (like infinite walls)
            material = createWallFadeMaterial(color);
        } else {
            material = isFullMode
                ? new THREE.MeshStandardMaterial({
                    color: color,
                    metalness: 0.1,
                    roughness: 0.3
                })
                : new THREE.MeshBasicMaterial({
                    color: color
                });
        }

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

        // Extended walls are tall and extend below ground - use fade material
        const material = createWallFadeMaterial(color);

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
    // Create invisible walls deep inside each rectangular hole to prevent ball from escaping
    // These walls are invisible and only serve as collision boundaries
    const INFINITE_WALL_HEIGHT = 1000; // Very tall to look like they go on forever
    const INTERIOR_WALL_THICKNESS = 0.2;
    
    rectangularHoles.forEach((rectHole, holeIndex) => {
        const halfWidth = rectHole.width / 2;
        const halfLength = rectHole.length / 2;
        
        // Create interior walls (deep inside the hole, extending downward)
        // These prevent the ball from escaping once it's deep in the hole
        const INTERIOR_WALL_DEPTH = INFINITE_WALL_HEIGHT; // Very deep
        
        // Invisible material - completely transparent
        const invisibleMaterial = new THREE.MeshStandardMaterial({ 
            transparent: true,
            opacity: 0,
            visible: false
        });
        
        // Left interior wall
        const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(INTERIOR_WALL_THICKNESS, INTERIOR_WALL_DEPTH, rectHole.length),
            invisibleMaterial
        );
        leftWall.position.set(rectHole.x - halfWidth, -INTERIOR_WALL_DEPTH / 2, rectHole.z);
        leftWall.castShadow = false;
        leftWall.receiveShadow = false;
        leftWall.userData.isRectangularHoleWall = true;
        leftWall.userData.rectangularHole = rectHole;
        leftWall.userData.wallType = 'left';
        rectangularHoleWalls.push(leftWall);
        scene.add(leftWall);
        
        // Right interior wall
        const rightWall = new THREE.Mesh(
            new THREE.BoxGeometry(INTERIOR_WALL_THICKNESS, INTERIOR_WALL_DEPTH, rectHole.length),
            invisibleMaterial
        );
        rightWall.position.set(rectHole.x + halfWidth, -INTERIOR_WALL_DEPTH / 2, rectHole.z);
        rightWall.castShadow = false;
        rightWall.receiveShadow = false;
        rightWall.userData.isRectangularHoleWall = true;
        rightWall.userData.rectangularHole = rectHole;
        rightWall.userData.wallType = 'right';
        rectangularHoleWalls.push(rightWall);
        scene.add(rightWall);
        
        // Front interior wall
        const frontWall = new THREE.Mesh(
            new THREE.BoxGeometry(rectHole.width, INTERIOR_WALL_DEPTH, INTERIOR_WALL_THICKNESS),
            invisibleMaterial
        );
        frontWall.position.set(rectHole.x, -INTERIOR_WALL_DEPTH / 2, rectHole.z - halfLength);
        frontWall.castShadow = false;
        frontWall.receiveShadow = false;
        frontWall.userData.isRectangularHoleWall = true;
        frontWall.userData.rectangularHole = rectHole;
        frontWall.userData.wallType = 'front';
        rectangularHoleWalls.push(frontWall);
        scene.add(frontWall);
        
        // Back interior wall
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(rectHole.width, INTERIOR_WALL_DEPTH, INTERIOR_WALL_THICKNESS),
            invisibleMaterial
        );
        backWall.position.set(rectHole.x, -INTERIOR_WALL_DEPTH / 2, rectHole.z + halfLength);
        backWall.castShadow = false;
        backWall.receiveShadow = false;
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
        // Level 4 L-shape extends much further in -X direction
        // Corridor goes from x=8 to x=-90, with fans at x=-30 and x=-40, hole at x=-60
        // Z range is approximately -31 to 31
        return {
            minX: -92, // Extended to cover full corridor (wall at x=-90)
            maxX: 9,   // Right wall at x=8.5
            minZ: -32, // Back wall at z=-31
            maxZ: 32,  // Front wall at z=31
            width: 101,
            height: 64
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

/**
 * Detect adjacent walls and create connector collision volumes at junctions
 * This prevents the ball from phasing through gaps at wall corners
 */
function detectAndCreateWallConnectors(wallDefs, wallHeight) {
    const connectors = [];
    const TOLERANCE = 0.1; // Small tolerance for floating point comparison
    
    // Check each pair of walls for adjacency
    for (let i = 0; i < wallDefs.length; i++) {
        for (let j = i + 1; j < wallDefs.length; j++) {
            const wall1 = wallDefs[i];
            const wall2 = wallDefs[j];
            
            // Calculate wall edges
            const w1Left = wall1.x - wall1.width / 2;
            const w1Right = wall1.x + wall1.width / 2;
            const w1Front = wall1.z - wall1.depth / 2;
            const w1Back = wall1.z + wall1.depth / 2;
            
            const w2Left = wall2.x - wall2.width / 2;
            const w2Right = wall2.x + wall2.width / 2;
            const w2Front = wall2.z - wall2.depth / 2;
            const w2Back = wall2.z + wall2.depth / 2;
            
            let connectorPos = null;
            let connectorSize = null;
            
            // Check for horizontal adjacency (walls share X edges)
            // Wall1's right edge touches Wall2's left edge
            // Connectors need to be thick enough to block the ball (radius 0.5)
            const CONNECTOR_THICKNESS = 1.0;
            if (Math.abs(w1Right - w2Left) < TOLERANCE) {
                // Check if they share Z range
                const zOverlapMin = Math.max(w1Front, w2Front);
                const zOverlapMax = Math.min(w1Back, w2Back);
                if (zOverlapMax > zOverlapMin) {
                    // Create connector at junction
                    connectorPos = new THREE.Vector3(w1Right, 0, (zOverlapMin + zOverlapMax) / 2);
                    connectorSize = { width: CONNECTOR_THICKNESS, depth: zOverlapMax - zOverlapMin };
                }
            }
            // Wall1's left edge touches Wall2's right edge
            else if (Math.abs(w1Left - w2Right) < TOLERANCE) {
                const zOverlapMin = Math.max(w1Front, w2Front);
                const zOverlapMax = Math.min(w1Back, w2Back);
                if (zOverlapMax > zOverlapMin) {
                    connectorPos = new THREE.Vector3(w1Left, 0, (zOverlapMin + zOverlapMax) / 2);
                    connectorSize = { width: CONNECTOR_THICKNESS, depth: zOverlapMax - zOverlapMin };
                }
            }
            // Check for vertical adjacency (walls share Z edges)
            // Wall1's back edge touches Wall2's front edge
            else if (Math.abs(w1Back - w2Front) < TOLERANCE) {
                const xOverlapMin = Math.max(w1Left, w2Left);
                const xOverlapMax = Math.min(w1Right, w2Right);
                if (xOverlapMax > xOverlapMin) {
                    connectorPos = new THREE.Vector3((xOverlapMin + xOverlapMax) / 2, 0, w1Back);
                    connectorSize = { width: xOverlapMax - xOverlapMin, depth: CONNECTOR_THICKNESS };
                }
            }
            // Wall1's front edge touches Wall2's back edge
            else if (Math.abs(w1Front - w2Back) < TOLERANCE) {
                const xOverlapMin = Math.max(w1Left, w2Left);
                const xOverlapMax = Math.min(w1Right, w2Right);
                if (xOverlapMax > xOverlapMin) {
                    connectorPos = new THREE.Vector3((xOverlapMin + xOverlapMax) / 2, 0, w1Front);
                    connectorSize = { width: xOverlapMax - xOverlapMin, depth: CONNECTOR_THICKNESS };
                }
            }
            
            // Create connector if adjacency was detected
            if (connectorPos && connectorSize) {
                const geometry = new THREE.BoxGeometry(connectorSize.width, wallHeight, connectorSize.depth);
                // Make connectors invisible to prevent z-fighting, but they still provide collision
                const material = new THREE.MeshBasicMaterial({
                    color: 0xd3685c,
                    transparent: true,
                    opacity: 0,
                    depthWrite: false
                });
                
                const connectorMesh = new THREE.Mesh(geometry, material);
                connectorMesh.position.set(connectorPos.x, wallHeight / 2, connectorPos.z);
                connectorMesh.castShadow = false;  // Invisible connectors don't cast shadows
                connectorMesh.receiveShadow = false;
                
                // Store bounds for collision detection
                connectorMesh.userData.isCustomWall = true;
                connectorMesh.userData.isConnector = true;
                connectorMesh.userData.bounds = {
                    minX: connectorPos.x - connectorSize.width / 2,
                    maxX: connectorPos.x + connectorSize.width / 2,
                    minZ: connectorPos.z - connectorSize.depth / 2,
                    maxZ: connectorPos.z + connectorSize.depth / 2
                };
                
                scene.add(connectorMesh);
                customWalls.push(connectorMesh);
                connectors.push(connectorMesh);
                
                console.log(`Created wall connector at (${connectorPos.x.toFixed(1)}, ${connectorPos.z.toFixed(1)})`);
            }
        }
    }
    
    console.log(`Created ${connectors.length} wall connectors to prevent ball phasing`);
    return connectors;
}

// Simple custom wall creation function
// Each wall is defined with: { x, z, width, depth } - center position and size
function createCustomWalls(wallDefs, wallHeight) {
    // Clear previous custom walls
    customWalls = [];
    
    // Generate unique color for each wall using HSL
    function generateUniqueColor(index, total) {
        // Use HSL to generate evenly distributed colors
        const hue = (index / total) * 360; // Distribute hues across 360 degrees
        const saturation = 80 + (index % 3) * 5; // Vary saturation between 80-90%
        const lightness = 45 + (index % 4) * 5; // Vary lightness between 45-60%
        
        // Convert HSL to RGB
        const h = hue / 360;
        const s = saturation / 100;
        const l = lightness / 100;
        
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    }
    
    wallDefs.forEach((wallDef, index) => {
        const width = wallDef.width;
        const depth = wallDef.depth;
        const height = wallHeight;
        
        // All walls use the same color
        const wallColor = 0xd3685c; // #d3685c
        
        // Log wall color for identification (format: #RRGGBB)
        const colorHex = '#' + wallColor.toString(16).padStart(6, '0');
        console.log(`Wall ${index} at (${wallDef.x}, ${wallDef.z}): color = ${colorHex.toUpperCase()}`);
        
        // Create the actual collision wall (visible part)
        const geometry = new THREE.BoxGeometry(width, height, depth);
        // Always use MeshStandardMaterial for proper lighting and shadows
        const material = new THREE.MeshStandardMaterial({
            color: wallColor,
            metalness: 0.1,
            roughness: 0.7
        });

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
        // Use same color as walls for the facade
        const facadeDepth = 50; // How far down the facade extends
        const facadeGeometry = new THREE.BoxGeometry(width, facadeDepth, depth);
        const facadeColor = wallColor; // Same color as walls (#d3685c)
        // Create fade material for walls that fade out as they go down
        const facadeMaterial = createWallFadeMaterial(facadeColor);
        
        const facadeMesh = new THREE.Mesh(facadeGeometry, facadeMaterial);
        // Offset facade slightly below the wall to prevent z-fighting at the y=0 boundary
        facadeMesh.position.set(wallDef.x, -facadeDepth / 2 - 0.01, wallDef.z);
        facadeMesh.castShadow = false; // Facade doesn't cast shadows
        facadeMesh.receiveShadow = false;
        facadeMesh.userData.isVisualFacade = true; // Mark as visual only
        
        scene.add(facadeMesh);
    });
    
    // After all walls are created, detect adjacencies and create connectors
    detectAndCreateWallConnectors(wallDefs, wallHeight);
}

/**
 * Create a material for walls that fades out based on Y position
 * Walls become invisible below y = -10
 */
function createIslandMaterials(baseColor, secondaryColor, textureType, gradientEnabled = false) {
    const materials = {};

    if (gradientEnabled && isFullMode) {
        // Create gradient materials using custom shaders
        materials.base = createGradientMaterial(baseColor, textureType === 'sandy' ? createSandTexture() : createEarthTexture());
        materials.vegetation = createGradientMaterial(secondaryColor, null);
        materials.rock = createGradientMaterial(new THREE.Color(baseColor).multiplyScalar(0.7), null);
    } else {
        if (isFullMode) {
            // Base material for earth/rock
            materials.base = new THREE.MeshStandardMaterial({
                color: baseColor,
                metalness: 0.1,
                roughness: 0.9,
                map: textureType === 'sandy' ? createSandTexture() : createEarthTexture()
            });

            // Vegetation material
            materials.vegetation = new THREE.MeshStandardMaterial({
                color: secondaryColor,
                metalness: 0.0,
                roughness: 0.8
            });

            // Rock material
            materials.rock = new THREE.MeshStandardMaterial({
                color: new THREE.Color(baseColor).multiplyScalar(0.7), // Darker version
                metalness: 0.2,
                roughness: 0.95
            });
        } else {
            // Basic materials for prototype mode
            materials.base = new THREE.MeshBasicMaterial({ color: baseColor });
            materials.vegetation = new THREE.MeshBasicMaterial({ color: secondaryColor });
            materials.rock = new THREE.MeshBasicMaterial({ color: new THREE.Color(baseColor).multiplyScalar(0.7) });
        }
    }

    return materials;
}

function createIslandTextures(textureType) {
    const textures = {};

    // Create procedural textures based on type
    switch (textureType) {
        case 'sandy':
            textures.base = createSandTexture();
            break;
        case 'rocky':
            textures.base = createRockTexture();
            break;
        case 'grassy':
            textures.base = createGrassTexture();
            break;
        case 'forested':
            textures.base = createForestTexture();
            break;
        default: // 'earth' or 'mixed'
            textures.base = createEarthTexture();
    }

    return textures;
}

function createSandTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Create sandy texture with noise
    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            const noise = (Math.random() - 0.5) * 0.3;
            const r = Math.floor(210 + noise * 50);
            const g = Math.floor(180 + noise * 50);
            const b = Math.floor(140 + noise * 50);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
}

function createEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Create earthy texture with variations
    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            const noise = (Math.random() - 0.5) * 0.4;
            const r = Math.floor(139 + noise * 30);
            const g = Math.floor(125 + noise * 30);
            const b = Math.floor(107 + noise * 30);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    return texture;
}

function createRockTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Create rocky texture with dark variations
    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            const noise = (Math.random() - 0.5) * 0.5;
            const r = Math.floor(105 + noise * 40);
            const g = Math.floor(105 + noise * 40);
            const b = Math.floor(105 + noise * 40);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
}

function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Create grassy texture with green variations
    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            const noise = (Math.random() - 0.5) * 0.3;
            const r = Math.floor(34 + noise * 30);
            const g = Math.floor(139 + noise * 30);
            const b = Math.floor(34 + noise * 30);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5);
    return texture;
}

function createForestTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Create forest floor texture with organic variations
    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            const noise = (Math.random() - 0.5) * 0.4;
            const r = Math.floor(85 + noise * 40);
            const g = Math.floor(107 + noise * 40);
            const b = Math.floor(47 + noise * 40);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
}

function createGradientMaterial(baseColor, texture = null) {
    const color = new THREE.Color(baseColor);

    return new THREE.ShaderMaterial({
        uniforms: {
            baseColor: { value: color },
            topColor: { value: new THREE.Color(color).multiplyScalar(1.3) }, // Lighter at top
            bottomColor: { value: new THREE.Color(color).multiplyScalar(0.7) }, // Darker at bottom
            textureMap: { value: texture }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            varying vec2 vUv;

            void main() {
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                vNormal = normalize(normalMatrix * normal);
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 baseColor;
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform sampler2D textureMap;
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            varying vec2 vUv;

            void main() {
                // Calculate gradient based on world Y position
                float gradientFactor = (vWorldPosition.y + 5.0) / 10.0; // Normalize Y from -5 to 5
                gradientFactor = clamp(gradientFactor, 0.0, 1.0);

                // Interpolate between bottom and top colors
                vec3 gradientColor = mix(bottomColor, topColor, gradientFactor);

                // Apply texture if available
                vec4 texColor = texture2D(textureMap, vUv * 2.0);
                vec3 finalColor = gradientColor;

                if (textureMap != null) {
                    finalColor = mix(gradientColor, texColor.rgb, 0.6);
                }

                // Simple lighting
                vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                float lightIntensity = max(dot(vNormal, lightDir), 0.3);
                finalColor *= lightIntensity;

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `,
        transparent: false
    });
}

// Function to update animated materials
function updateAnimatedMaterials(deltaTime) {
    const currentTime = performance.now() * 0.001; // Convert to seconds

    models.forEach(model => {
        if (model.userData && model.userData.isProceduralModel) {
            model.traverse(child => {
                if (child.isMesh && child.material && child.material.uniforms && child.material.uniforms.time) {
                    child.material.uniforms.time.value = currentTime;
                }
            });
        }

        // Animate flying machines
        if (model.userData && model.userData.orbitRadius) {
            const orbitRadius = model.userData.orbitRadius;
            const orbitHeight = model.userData.orbitHeight;
            const orbitSpeed = model.userData.orbitSpeed;
            const initialPosition = model.userData.initialPosition;

            // Calculate orbital position
            const angle = currentTime * orbitSpeed;
            const x = initialPosition.x + Math.cos(angle) * orbitRadius;
            const z = initialPosition.z + Math.sin(angle) * orbitRadius;
            const y = initialPosition.y + orbitHeight + Math.sin(angle * 2) * 2; // Bobbing motion

            model.position.set(x, y, z);

            // Rotate the flying machine to face direction of travel
            model.rotation.y = angle + Math.PI / 2;

            // Add some banking during turns
            model.rotation.z = Math.sin(angle) * 0.2;
        }

        // Animate giant spiral top crystal rotation
        if (model.userData && model.userData.topCrystal) {
            model.userData.topCrystal.rotation.y += deltaTime * model.userData.rotationSpeed;
        }

        // Animate giant ring gate rotation
        if (model.userData && model.userData.mainRing) {
            model.userData.mainRing.rotation.z += deltaTime * model.userData.rotationSpeed;
        }
    });
}

function createIridescentMaterial(baseColor = 0x00ffff, intensity = 1.0) {
    return new THREE.ShaderMaterial({
        uniforms: {
            baseColor: { value: new THREE.Color(baseColor) },
            time: { value: 0.0 },
            intensity: { value: intensity }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;

            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 baseColor;
            uniform float time;
            uniform float intensity;
            varying vec3 vNormal;
            varying vec3 vViewPosition;

            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);

                // Fresnel effect for glass-like appearance
                float fresnel = pow(1.0 - dot(viewDir, normal), 2.0);

                // Iridescent color shifting based on viewing angle
                float hue = dot(normal, viewDir) * 2.0 + time * 0.5;
                vec3 iridescent = vec3(
                    0.5 + 0.5 * sin(hue),
                    0.5 + 0.5 * sin(hue + 2.094),
                    0.5 + 0.5 * sin(hue + 4.188)
                );

                // Combine iridescent effect with base color
                vec3 finalColor = mix(baseColor, iridescent, fresnel * intensity);

                // Add some transparency for glass effect
                float alpha = 0.7 + fresnel * 0.3;

                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });
}

function createGlassMaterial(baseColor = 0xffffff, opacity = 0.3) {
    return new THREE.ShaderMaterial({
        uniforms: {
            baseColor: { value: new THREE.Color(baseColor) },
            opacity: { value: opacity }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;

            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 baseColor;
            uniform float opacity;
            varying vec3 vNormal;
            varying vec3 vViewPosition;

            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);

                // Strong Fresnel effect for glass
                float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);

                // Glass-like refraction colors
                vec3 glassColor = baseColor * (1.0 + fresnel * 0.5);

                gl_FragColor = vec4(glassColor, opacity + fresnel * 0.4);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });
}

function createHolographicMaterial(baseColor = 0x00ffff) {
    return new THREE.ShaderMaterial({
        uniforms: {
            baseColor: { value: new THREE.Color(baseColor) },
            time: { value: 0.0 }
        },
        vertexShader: `
            varying vec3 vPosition;
            varying vec3 vNormal;

            void main() {
                vPosition = position;
                vNormal = normal;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 baseColor;
            uniform float time;
            varying vec3 vPosition;
            varying vec3 vNormal;

            void main() {
                // Create grid-like holographic effect
                vec3 pos = vPosition * 10.0;
                float grid = abs(sin(pos.x + time)) * abs(sin(pos.y + time)) * abs(sin(pos.z + time));

                // Fresnel for edge highlighting
                vec3 viewDir = normalize(cameraPosition - vPosition);
                float fresnel = pow(1.0 - dot(viewDir, vNormal), 2.0);

                vec3 finalColor = baseColor * (grid * 0.5 + fresnel * 0.8);

                gl_FragColor = vec4(finalColor, 0.6);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });
}

// ===== MEGAStructure Creation Functions =====

function createCrystalPillar(position, height = 50, radius = 3) {
    console.log(`MEGA: Creating crystal pillar at (${position.x}, ${position.y}, ${position.z})`);
    const group = new THREE.Group();
    group.position.copy(position);

    // Main crystal pillar - iridescent crystal
    const geometry = new THREE.CylinderGeometry(radius, radius * 0.7, height, 8);
    const material = createIridescentMaterial(0xff1493, 1.0); // Deep pink iridescent
    const pillar = new THREE.Mesh(geometry, material);
    pillar.position.y = height / 2;
    group.add(pillar);
    console.log('MEGA: Created crystal pillar mesh with iridescent material');

    // Add crystal facets on top - iridescent
    for (let i = 0; i < 6; i++) {
        const facetGeometry = new THREE.OctahedronGeometry(radius * 0.8);
        const facet = new THREE.Mesh(facetGeometry, createIridescentMaterial(0x9370db, 0.8)); // Medium purple iridescent
        facet.position.y = height + radius * 0.5;
        facet.rotation.y = (i * Math.PI) / 3;
        facet.scale.set(0.5, 1, 0.5);
        group.add(facet);
    }

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - height - 2; // Position below original
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added crystal pillar group and mirrored version to scene');
}

function createFloatingRing(position, radius = 25, thickness = 2) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Main ring
    const geometry = new THREE.TorusGeometry(radius, thickness, 8, 32);
    const material = createIridescentMaterial(0xffffff, 0.8);
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Inner decorative elements
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        const x = Math.cos(angle) * (radius - thickness * 2);
        const z = Math.sin(angle) * (radius - thickness * 2);

        const spikeGeometry = new THREE.ConeGeometry(1, 4, 6);
        const spike = new THREE.Mesh(spikeGeometry, createIridescentMaterial(0xffff00, 0.6));
        spike.position.set(x, 0, z);
        spike.rotation.x = Math.PI;
        group.add(spike);
    }

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - thickness * 2 - 2; // Position below original
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added floating ring and mirrored version to scene');

    return group;
}

function createArchway(position, width = 30, height = 40) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Create arch curve
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-width/2, 0, 0),
        new THREE.Vector3(-width/4, height * 0.7, 0),
        new THREE.Vector3(0, height, 0),
        new THREE.Vector3(width/4, height * 0.7, 0),
        new THREE.Vector3(width/2, 0, 0)
    ]);

    const geometry = new THREE.TubeGeometry(curve, 32, 2, 8, false);
    const material = createIridescentMaterial(0x87ceeb, 0.8);
    const arch = new THREE.Mesh(geometry, material);
    group.add(arch);

    // Add pillars at base
    const pillarGeometry = new THREE.CylinderGeometry(1.5, 2, height * 0.8, 8);
    const pillarMaterial = createIridescentMaterial(0x9370db, 0.7);

    const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    leftPillar.position.set(-width/2, height * 0.4, 0);
    group.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    rightPillar.position.set(width/2, height * 0.4, 0);
    group.add(rightPillar);

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - height - 2; // Position below original
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added archway and mirrored version to scene');

    return group;
}

function createSpiralTower(position, height = 60, radius = 4) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Create spiral path
    const points = [];
    for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const angle = t * Math.PI * 4; // 2 full rotations
        const r = radius * (1 - t * 0.3); // Spiral inward
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = t * height;
        points.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 200, 1.5, 8, false);
    const material = createIridescentMaterial(0x00ff88, 0.9);
    const spiral = new THREE.Mesh(geometry, material);
    group.add(spiral);

    // Add crystal at top
    const crystalGeometry = new THREE.OctahedronGeometry(3);
    const crystal = new THREE.Mesh(crystalGeometry, createIridescentMaterial(0xff0080, 1.0));
    crystal.position.y = height + 2;
    group.add(crystal);

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - height - 2; // Position below original
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added spiral tower and mirrored version to scene');

    return group;
}

function createFloatingPlatform(position, size = 20, height = 2) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Main platform
    const geometry = new THREE.CylinderGeometry(size, size * 0.9, height, 16);
    const material = createIridescentMaterial(0xe6e6fa, 0.8);
    const platform = new THREE.Mesh(geometry, material);
    platform.position.y = height / 2;
    group.add(platform);

    // Add floating crystal spires
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6;
        const x = Math.cos(angle) * (size * 0.7);
        const z = Math.sin(angle) * (size * 0.7);

        const spireGeometry = new THREE.ConeGeometry(1, 8, 6);
        const spire = new THREE.Mesh(spireGeometry, createIridescentMaterial(0xffa500, 0.8));
        spire.position.set(x, height + 4, z);
        group.add(spire);
    }

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - height - 2; // Position below original
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added floating platform and mirrored version to scene');

    return group;
}

function createEnergyBridge(position, length = 40, height = 8) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Bridge supports
    const supportGeometry = new THREE.CylinderGeometry(1, 1.5, height, 8);
    const supportMaterial = createIridescentMaterial(0x4169e1, 0.6);

    const leftSupport = new THREE.Mesh(supportGeometry, supportMaterial);
    leftSupport.position.set(-length/2, height/2, 0);
    group.add(leftSupport);

    const rightSupport = new THREE.Mesh(supportGeometry, supportMaterial);
    rightSupport.position.set(length/2, height/2, 0);
    group.add(rightSupport);

    // Energy bridge surface
    const bridgeGeometry = new THREE.PlaneGeometry(length, 3);
    const bridgeMaterial = createIridescentMaterial(0x00ffff, 0.9);
    const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);
    bridge.position.y = height;
    bridge.rotation.x = -Math.PI / 2;
    group.add(bridge);

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - height - 2; // Position below original
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added energy bridge and mirrored version to scene');

    return group;
}

function createCrystalFormation(position, scale = 1) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.scale.setScalar(scale);

    // Large central crystal
    const centralGeometry = new THREE.OctahedronGeometry(4);
    const central = new THREE.Mesh(centralGeometry, createIridescentMaterial(0xff69b4, 1.0));
    central.position.y = 2;
    group.add(central);

    // Surrounding smaller crystals
    const positions = [
        [3, 1, 0], [-3, 1, 0], [0, 1, 3], [0, 1, -3],
        [2, 3, 2], [-2, 3, 2], [2, 3, -2], [-2, 3, -2]
    ];

    positions.forEach(([x, y, z]) => {
        const crystalGeometry = new THREE.OctahedronGeometry(1.5);
        const crystal = new THREE.Mesh(crystalGeometry, createIridescentMaterial(0x9370db, 0.8));
        crystal.position.set(x, y, z);
        crystal.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(crystal);
    });

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - 8; // Position below original (fixed offset for crystal formation)
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added crystal formation and mirrored version to scene');

    return group;
}

function createHolographicDome(position, radius = 15, height = 20) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Dome structure
    const geometry = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const material = createIridescentMaterial(0xff1493, 0.9);
    const dome = new THREE.Mesh(geometry, material);
    dome.position.y = height / 2;
    group.add(dome);

    // Support pillars
    const pillarGeometry = new THREE.CylinderGeometry(0.8, 1.2, height, 8);
    const pillarMaterial = createIridescentMaterial(0x00ced1, 0.8);

    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6;
        const x = Math.cos(angle) * (radius - 2);
        const z = Math.sin(angle) * (radius - 2);

        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        pillar.position.set(x, height / 2, z);
        group.add(pillar);
    }

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - height - 2; // Position below original
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added holographic dome and mirrored version to scene');

    return group;
}

function createAeroArch(position, span = 35, rise = 25) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Create aerodynamic arch curve
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-span/2, 0, 0),
        new THREE.Vector3(-span/4, rise * 0.6, 2),
        new THREE.Vector3(0, rise, 0),
        new THREE.Vector3(span/4, rise * 0.6, -2),
        new THREE.Vector3(span/2, 0, 0)
    ]);

    const geometry = new THREE.TubeGeometry(curve, 64, 1.5, 12, false);
    const material = createIridescentMaterial(0x1e90ff, 0.9);
    const arch = new THREE.Mesh(geometry, material);
    group.add(arch);

    // Add aerodynamic wing-like elements
    const wingGeometry = new THREE.PlaneGeometry(8, 2);
    const wingMaterial = createIridescentMaterial(0x87ceeb, 0.8);

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-span/3, rise * 0.8, 0);
    leftWing.rotation.set(0, 0, Math.PI / 6);
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(span/3, rise * 0.8, 0);
    rightWing.rotation.set(0, 0, -Math.PI / 6);
    group.add(rightWing);

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - rise - 2; // Position below original
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added aero arch and mirrored version to scene');

    return group;
}

function createFloatingCitadel(position, size = 25) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Central tower
    const towerGeometry = new THREE.CylinderGeometry(size * 0.2, size * 0.3, size * 0.8, 12);
    const towerMaterial = createIridescentMaterial(0xffd700, 0.8);
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.y = size * 0.4;
    group.add(tower);

    // Surrounding spires
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        const radius = size * 0.6;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const spireGeometry = new THREE.ConeGeometry(2, 8, 8);
        const spire = new THREE.Mesh(spireGeometry, createIridescentMaterial(0xf0e68c, 0.8));
        spire.position.set(x, 4, z);
        group.add(spire);
    }

    // Floating rings around the structure
    for (let i = 0; i < 3; i++) {
        const ringGeometry = new THREE.TorusGeometry(size * (0.4 + i * 0.2), 0.5, 8, 16);
        const ring = new THREE.Mesh(ringGeometry, createIridescentMaterial(0x00ff7f, 0.9));
        ring.position.y = size * (0.2 + i * 0.3);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
    }

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - size - 2; // Position below original
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added floating citadel and mirrored version to scene');

    return group;
}

function createMysticalGateway(position, width = 20, height = 30) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Gateway frame - two vertical pillars with horizontal connections
    const pillarGeometry = new THREE.CylinderGeometry(1.5, 2, height, 8);
    const pillarMaterial = createIridescentMaterial(0x8a2be2, 0.7);

    const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    leftPillar.position.set(-width/2, height/2, 0);
    group.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    rightPillar.position.set(width/2, height/2, 0);
    group.add(rightPillar);

    // Horizontal crossbars
    const barGeometry = new THREE.CylinderGeometry(1, 1, width, 8);
    const barMaterial = createIridescentMaterial(0xff69b4, 0.8);

    const topBar = new THREE.Mesh(barGeometry, barMaterial);
    topBar.position.set(0, height, 0);
    topBar.rotation.z = Math.PI / 2;
    group.add(topBar);

    const middleBar = new THREE.Mesh(barGeometry, barMaterial);
    middleBar.position.set(0, height * 0.5, 0);
    middleBar.rotation.z = Math.PI / 2;
    group.add(middleBar);

    // Mystical energy field in the center
    const fieldGeometry = new THREE.PlaneGeometry(width * 0.8, height * 0.8);
    const fieldMaterial = createIridescentMaterial(0x00bfff, 0.9);
    const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.position.set(0, height * 0.5, 0);
    group.add(field);

    // Create mirrored version below
    const mirroredGroup = group.clone();
    mirroredGroup.rotation.x = Math.PI; // Flip upside down
    mirroredGroup.position.y = position.y - height - 2; // Position below original
    scene.add(mirroredGroup);
    models.push(mirroredGroup);

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added mystical gateway and mirrored version to scene');

    return group;
}

function createFlyingMachine(position, orbitRadius = 30, orbitHeight = 8, orbitSpeed = 0.5, colorScheme = null) {
    console.log(`MEGA: Creating flying machine at (${position.x}, ${position.y}, ${position.z})`);
    const group = new THREE.Group();
    group.position.copy(position);

    // Default color scheme or use provided colors
    const colors = colorScheme || {
        body: 0x4169e1,    // Royal blue
        nose: 0x00ffff,    // Cyan
        wings: 0xff1493,   // Deep pink
        tail: 0x32cd32,    // Lime green
        engines: 0xffd700  // Gold
    };

    // Main body - sleek aerodynamic fuselage
    const bodyGeometry = new THREE.CylinderGeometry(0.8, 1.2, 6, 8);
    const body = new THREE.Mesh(bodyGeometry, createIridescentMaterial(colors.body, 0.9));
    body.rotation.z = Math.PI / 2;
    group.add(body);

    // Cockpit/nose
    const noseGeometry = new THREE.ConeGeometry(0.8, 2, 8);
    const nose = new THREE.Mesh(noseGeometry, createIridescentMaterial(colors.nose, 0.8));
    nose.position.x = 3;
    group.add(nose);

    // Wings - delta wing design
    const wingGeometry = new THREE.ConeGeometry(3, 0.3, 3);
    const leftWing = new THREE.Mesh(wingGeometry, createIridescentMaterial(colors.wings, 0.8));
    leftWing.position.set(0, 1.5, 0);
    leftWing.rotation.z = Math.PI / 2;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, createIridescentMaterial(colors.wings, 0.8));
    rightWing.position.set(0, -1.5, 0);
    rightWing.rotation.z = -Math.PI / 2;
    group.add(rightWing);

    // Vertical stabilizer
    const tailGeometry = new THREE.BoxGeometry(0.2, 2, 1);
    const tail = new THREE.Mesh(tailGeometry, createIridescentMaterial(colors.tail, 0.8));
    tail.position.x = -3;
    tail.position.y = 0;
    group.add(tail);

    // Engine glow effects
    const engineGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const leftEngine = new THREE.Mesh(engineGeometry, createIridescentMaterial(colors.engines, 0.9));
    leftEngine.position.set(-2, 1, 0);
    group.add(leftEngine);

    const rightEngine = new THREE.Mesh(engineGeometry, createIridescentMaterial(colors.engines, 0.9));
    rightEngine.position.set(-2, -1, 0);
    group.add(rightEngine);

    // Store animation parameters
    group.userData.orbitRadius = orbitRadius;
    group.userData.orbitHeight = orbitHeight;
    group.userData.orbitSpeed = orbitSpeed;
    group.userData.initialPosition = position.clone();

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added flying machine to scene');

    return group;
}

function createGiantArch(position, width = 30, height = 40, thickness = 2) {
    console.log(`MEGA: Creating giant arch at (${position.x}, ${position.y}, ${position.z})`);
    const group = new THREE.Group();
    group.position.copy(position);

    const material = createIridescentMaterial(0x88CCFF, 0.5);

    // Create arch using torus segment
    const archRadius = height / 2;
    const archGeom = new THREE.TorusGeometry(archRadius, thickness, 16, 48, Math.PI);
    const arch = new THREE.Mesh(archGeom, material);
    arch.rotation.x = Math.PI / 2;
    arch.rotation.z = Math.PI / 2;
    arch.position.y = archRadius;
    group.add(arch);

    // Pillars on sides
    const pillarGeom = new THREE.CylinderGeometry(thickness * 0.8, thickness, height * 0.1, 12);
    const leftPillar = new THREE.Mesh(pillarGeom, material);
    leftPillar.position.set(-archRadius, height * 0.05, 0);
    group.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeom, material);
    rightPillar.position.set(archRadius, height * 0.05, 0);
    group.add(rightPillar);

    // Decorative rings along arch
    for (let i = 0; i < 5; i++) {
        const t = (i + 1) / 6;
        const angle = t * Math.PI;
        const ringGeom = new THREE.TorusGeometry(thickness * 1.5, thickness * 0.15, 8, 16);
        const ring = new THREE.Mesh(ringGeom, material);
        ring.position.set(
            -Math.cos(angle) * archRadius,
            archRadius + Math.sin(angle) * archRadius,
            0
        );
        ring.rotation.y = Math.PI / 2;
        ring.rotation.x = angle;
        group.add(ring);
    }

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added giant arch to scene');

    return group;
}

function createGiantSpiral(position, height = 50, radius = 8, turns = 3) {
    console.log(`MEGA: Creating giant spiral at (${position.x}, ${position.y}, ${position.z})`);
    const group = new THREE.Group();
    group.position.copy(position);

    const material = createIridescentMaterial(0xAADDFF, 0.45);

    // Create spiral using tube geometry
    const spiralPoints = [];
    const segments = 100;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = t * Math.PI * 2 * turns;
        const y = t * height;
        const r = radius * (1 - t * 0.3); // Taper toward top
        spiralPoints.push(new THREE.Vector3(
            Math.cos(angle) * r,
            y,
            Math.sin(angle) * r
        ));
    }

    const spiralCurve = new THREE.CatmullRomCurve3(spiralPoints);
    const tubeRadius = 1.5;
    const spiralGeom = new THREE.TubeGeometry(spiralCurve, 100, tubeRadius, 12, false);
    const spiral = new THREE.Mesh(spiralGeom, material);
    group.add(spiral);

    // Add floating rings along spiral
    for (let i = 0; i < 8; i++) {
        const t = (i + 1) / 9;
        const angle = t * Math.PI * 2 * turns;
        const y = t * height;
        const r = radius * (1 - t * 0.3);

        const ringGeom = new THREE.TorusGeometry(tubeRadius * 2, tubeRadius * 0.3, 8, 16);
        const ring = new THREE.Mesh(ringGeom, material);
        ring.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
    }

    // Top crystal
    const topCrystalGeom = new THREE.OctahedronGeometry(3, 0);
    const topCrystal = new THREE.Mesh(topCrystalGeom, material);
    topCrystal.position.y = height + 3;
    group.add(topCrystal);

    // Store for animation
    group.userData.topCrystal = topCrystal;
    group.userData.rotationSpeed = 0.0003;

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added giant spiral to scene');

    return group;
}

function createGiantRingGate(position, radius = 25, thickness = 2) {
    console.log(`MEGA: Creating giant ring gate at (${position.x}, ${position.y}, ${position.z})`);
    const group = new THREE.Group();
    group.position.copy(position);

    const material = createIridescentMaterial(0xDDAAFF, 0.4);

    // Main ring
    const mainRingGeom = new THREE.TorusGeometry(radius, thickness, 16, 64);
    const mainRing = new THREE.Mesh(mainRingGeom, material);
    mainRing.rotation.x = Math.PI / 2;
    mainRing.position.y = radius;
    group.add(mainRing);

    // Inner decorative rings
    for (let i = 0; i < 3; i++) {
        const innerRadius = radius * (0.7 - i * 0.15);
        const innerThickness = thickness * 0.5;
        const innerRingGeom = new THREE.TorusGeometry(innerRadius, innerThickness, 12, 48);
        const innerRing = new THREE.Mesh(innerRingGeom, material);
        innerRing.rotation.x = Math.PI / 2;
        innerRing.position.y = radius;
        group.add(innerRing);
    }

    // Floating orbs around ring
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const orbGeom = new THREE.SphereGeometry(thickness * 0.8, 12, 12);
        const orb = new THREE.Mesh(orbGeom, material);
        orb.position.set(
            Math.cos(angle) * radius,
            radius + Math.sin(angle) * radius,
            0
        );
        group.add(orb);
    }

    // Store for animation
    group.userData.mainRing = mainRing;
    group.userData.rotationSpeed = 0.0001;

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added giant ring gate to scene');

    return group;
}

function createGiantCrystalPillar(position, height = 60, baseRadius = 4) {
    console.log(`MEGA: Creating giant crystal pillar at (${position.x}, ${position.y}, ${position.z})`);
    const group = new THREE.Group();
    group.position.copy(position);

    const material = createIridescentMaterial(0x88EEFF, 0.5);

    // Main crystal pillar
    const pillarGeom = new THREE.CylinderGeometry(baseRadius * 0.3, baseRadius, height, 8);
    const pillar = new THREE.Mesh(pillarGeom, material);
    pillar.position.y = height / 2;
    group.add(pillar);

    // Crystal facets around
    for (let i = 0; i < 6; i++) {
        const facetHeight = height * (0.5 + Math.random() * 0.4);
        const facetGeom = new THREE.ConeGeometry(baseRadius * 0.4, facetHeight, 5);
        const facet = new THREE.Mesh(facetGeom, material);
        const angle = (i / 6) * Math.PI * 2;
        facet.position.set(
            Math.cos(angle) * baseRadius * 1.2,
            facetHeight / 2,
            Math.sin(angle) * baseRadius * 1.2
        );
        facet.rotation.z = Math.cos(angle) * 0.2;
        facet.rotation.x = Math.sin(angle) * 0.2;
        group.add(facet);
    }

    // Top crystal cluster
    for (let i = 0; i < 5; i++) {
        const topHeight = height * (0.2 + Math.random() * 0.15);
        const topGeom = new THREE.ConeGeometry(baseRadius * 0.25, topHeight, 5);
        const top = new THREE.Mesh(topGeom, material);
        const angle = (i / 5) * Math.PI * 2;
        const dist = i === 0 ? 0 : baseRadius * 0.5;
        top.position.set(
            Math.cos(angle) * dist,
            height + topHeight / 2,
            Math.sin(angle) * dist
        );
        if (i > 0) {
            top.rotation.z = Math.cos(angle) * 0.3;
            top.rotation.x = Math.sin(angle) * 0.3;
        }
        group.add(top);
    }

    // Add to scene
    scene.add(group);
    models.push(group);
    console.log('MEGA: Added giant crystal pillar to scene');

    return group;
}

// ============ NEW IRIDESCENT STRUCTURES FOR LEVEL 1 ============

function createIridescentObelisk(position, height = 35, width = 3, color = 0x00ffff, intensity = 1.2) {
    const group = new THREE.Group();
    group.position.copy(position);
    
    const material = createIridescentMaterial(color, intensity);
    
    // Main obelisk shaft (tall rectangular prism)
    const shaftGeom = new THREE.BoxGeometry(width, height, width);
    const shaft = new THREE.Mesh(shaftGeom, material);
    shaft.position.y = height / 2;
    group.add(shaft);
    
    // Pyramidal top
    const capGeom = new THREE.ConeGeometry(width * 0.7, width * 2, 4);
    const cap = new THREE.Mesh(capGeom, material);
    cap.position.y = height + width;
    cap.rotation.y = Math.PI / 4; // 45 degree rotation for square pyramid
    group.add(cap);
    
    // Decorative rings around obelisk
    for (let i = 0; i < 3; i++) {
        const ringY = height * (0.3 + i * 0.25);
        const ringGeom = new THREE.TorusGeometry(width * 0.7, width * 0.1, 8, 16);
        const ring = new THREE.Mesh(ringGeom, material);
        ring.position.y = ringY;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
    }
    
    scene.add(group);
    models.push(group);
    return group;
}

function createFloatingIridescentRing(position, radius = 8, tubeRadius = 1.2, color = 0xffff00, rotationAxis = new THREE.Vector3(0, 1, 0.3)) {
    const group = new THREE.Group();
    group.position.copy(position);
    
    const material = createIridescentMaterial(color, 1.3);
    
    // Main ring
    const ringGeom = new THREE.TorusGeometry(radius, tubeRadius, 16, 32);
    const ring = new THREE.Mesh(ringGeom, material);
    group.add(ring);
    
    // Inner decorative ring
    const innerRingGeom = new THREE.TorusGeometry(radius * 0.7, tubeRadius * 0.5, 12, 24);
    const innerRing = new THREE.Mesh(innerRingGeom, material);
    group.add(innerRing);
    
    // Store rotation axis for animation
    group.userData.rotationAxis = rotationAxis.normalize();
    group.userData.rotationSpeed = 0.5;
    
    scene.add(group);
    models.push(group);
    return group;
}

function createPrismaticPyramid(position, size = 12, height = 18, color = 0x00ff88) {
    const group = new THREE.Group();
    group.position.copy(position);
    
    const material = createIridescentMaterial(color, 1.4);
    
    // Main pyramid
    const pyramidGeom = new THREE.ConeGeometry(size, height, 4);
    const pyramid = new THREE.Mesh(pyramidGeom, material);
    pyramid.position.y = height / 2;
    pyramid.rotation.y = Math.PI / 4;
    group.add(pyramid);
    
    // Four smaller pyramids at each corner of base
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const smallPyramid = new THREE.Mesh(
            new THREE.ConeGeometry(size * 0.3, height * 0.4, 4),
            material
        );
        smallPyramid.position.set(
            Math.cos(angle) * size * 0.7,
            height * 0.2,
            Math.sin(angle) * size * 0.7
        );
        smallPyramid.rotation.y = angle;
        group.add(smallPyramid);
    }
    
    // Crystal at apex
    const apexCrystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(size * 0.3),
        material
    );
    apexCrystal.position.y = height;
    group.add(apexCrystal);
    
    scene.add(group);
    models.push(group);
    return group;
}

// ============ NEW IRIDESCENT STRUCTURES FOR LEVEL 3 ============

function createIridescentTorusKnot(position, scale = 8, p = 3, q = 2, color = 0xff00ff, intensity = 1.5) {
    const group = new THREE.Group();
    group.position.copy(position);
    
    const material = createIridescentMaterial(color, intensity);
    
    // Torus knot
    const knotGeom = new THREE.TorusKnotGeometry(scale, scale * 0.3, 128, 16, p, q);
    const knot = new THREE.Mesh(knotGeom, material);
    group.add(knot);
    
    // Store rotation for animation
    group.userData.rotationSpeed = 0.3;
    
    scene.add(group);
    models.push(group);
    return group;
}

function createCrystalLatticeDome(position, radius = 15, segments = 16, color = 0x00ffcc, intensity = 1.3) {
    const group = new THREE.Group();
    group.position.copy(position);
    
    const material = createIridescentMaterial(color, intensity);
    
    // Create geodesic dome using icosahedron
    const domeGeom = new THREE.IcosahedronGeometry(radius, 2);
    const dome = new THREE.Mesh(domeGeom, material);
    dome.position.y = radius * 0.5;
    
    // Make it appear as wireframe lattice
    const edges = new THREE.EdgesGeometry(domeGeom);
    const lineMat = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    dome.add(wireframe);
    
    group.add(dome);
    
    // Add glowing nodes at vertices
    const positions = domeGeom.attributes.position;
    const vertexSet = new Set();
    
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i).toFixed(2);
        const y = positions.getY(i).toFixed(2);
        const z = positions.getZ(i).toFixed(2);
        const key = `${x},${y},${z}`;
        
        if (!vertexSet.has(key)) {
            vertexSet.add(key);
            const node = new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 8, 8),
                material
            );
            node.position.set(
                parseFloat(x),
                parseFloat(y) + radius * 0.5,
                parseFloat(z)
            );
            group.add(node);
        }
    }
    
    scene.add(group);
    models.push(group);
    return group;
}

function createShimmeringHelix(position, height = 45, radius = 5, turns = 4, strands = 2, color = 0xffaa00, intensity = 1.4) {
    const group = new THREE.Group();
    group.position.copy(position);
    
    const material = createIridescentMaterial(color, intensity);
    
    // Create double helix
    for (let strand = 0; strand < strands; strand++) {
        const points = [];
        const segments = 100;
        const offset = (strand / strands) * Math.PI * 2;
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = t * turns * Math.PI * 2 + offset;
            const y = t * height;
            
            points.push(new THREE.Vector3(
                Math.cos(angle) * radius,
                y,
                Math.sin(angle) * radius
            ));
        }
        
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeom = new THREE.TubeGeometry(curve, segments, radius * 0.2, 8, false);
        const tube = new THREE.Mesh(tubeGeom, material);
        group.add(tube);
    }
    
    // Add spheres at intervals along helix
    const sphereCount = turns * 8;
    for (let i = 0; i < sphereCount; i++) {
        const t = i / sphereCount;
        const angle = t * turns * Math.PI * 2;
        const y = t * height;
        
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 0.3, 8, 8),
            material
        );
        sphere.position.set(
            Math.cos(angle) * radius,
            y,
            Math.sin(angle) * radius
        );
        group.add(sphere);
    }
    
    scene.add(group);
    models.push(group);
    return group;
}

function createPrismaticSpires(position, count = 5, maxHeight = 30, baseRadius = 8, color = 0x00ff00, intensity = 1.2) {
    const group = new THREE.Group();
    group.position.copy(position);
    
    const material = createIridescentMaterial(color, intensity);
    
    // Create cluster of spires
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const distance = i === 0 ? 0 : baseRadius * (0.5 + Math.random() * 0.5);
        const spireHeight = maxHeight * (0.5 + Math.random() * 0.5);
        
        // Main spire
        const spireGeom = new THREE.ConeGeometry(
            baseRadius * 0.3,
            spireHeight,
            6
        );
        const spire = new THREE.Mesh(spireGeom, material);
        spire.position.set(
            Math.cos(angle) * distance,
            spireHeight / 2,
            Math.sin(angle) * distance
        );
        
        // Slight random tilt
        if (i > 0) {
            spire.rotation.z = (Math.random() - 0.5) * 0.2;
            spire.rotation.x = (Math.random() - 0.5) * 0.2;
        }
        
        group.add(spire);
        
        // Add crystal formations at base
        const crystalCount = 3;
        for (let j = 0; j < crystalCount; j++) {
            const crystalAngle = angle + (j / crystalCount) * Math.PI * 2;
            const crystal = new THREE.Mesh(
                new THREE.OctahedronGeometry(baseRadius * 0.15),
                material
            );
            crystal.position.set(
                Math.cos(angle) * distance + Math.cos(crystalAngle) * baseRadius * 0.3,
                spireHeight * 0.1,
                Math.sin(angle) * distance + Math.sin(crystalAngle) * baseRadius * 0.3
            );
            group.add(crystal);
        }
    }
    
    scene.add(group);
    models.push(group);
    return group;
}

function createProceduralIsland(config) {
    const {
        position,
        baseColor = 0x8B7D6B,
        secondaryColor = 0x9CAF88,
        textureType = 'earth',
        gradientEnabled = false,
        scale = 1.0,
        rotation = new THREE.Euler(0, 0, 0)
    } = config;

    // Create a group to hold all island parts
    const islandGroup = new THREE.Group();
    islandGroup.position.copy(position);
    islandGroup.rotation.copy(rotation);
    islandGroup.scale.setScalar(scale);

    // Create materials based on texture type and gradient setting
    const materials = createIslandMaterials(baseColor, secondaryColor, textureType, gradientEnabled);

    // Create procedural textures for more realistic appearance
    const textures = createIslandTextures(textureType);

    // Main island base - irregular shape using multiple boxes with varied materials
    const baseParts = [
        { pos: new THREE.Vector3(0, 0, 0), size: new THREE.Vector3(8, 1.5, 6) },
        { pos: new THREE.Vector3(2, 0.2, -1), size: new THREE.Vector3(4, 1.2, 4) },
        { pos: new THREE.Vector3(-1, 0.1, 2), size: new THREE.Vector3(5, 1.0, 3) },
        { pos: new THREE.Vector3(3, 0.3, 3), size: new THREE.Vector3(3, 0.8, 4) },
        { pos: new THREE.Vector3(-3, 0.15, -2), size: new THREE.Vector3(4, 1.1, 2) }
    ];

    baseParts.forEach((part, index) => {
        const geometry = new THREE.BoxGeometry(part.size.x, part.size.y, part.size.z);
        // Use base material for earth/ground parts
        const mesh = new THREE.Mesh(geometry, materials.base);
        mesh.position.copy(part.pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        islandGroup.add(mesh);
    });

    // Add some elevated areas (hills)
    const hillParts = [
        { pos: new THREE.Vector3(1, 0.8, -1), size: new THREE.Vector3(2, 1.2, 2) },
        { pos: new THREE.Vector3(-2, 0.6, 1), size: new THREE.Vector3(1.5, 0.8, 1.5) },
        { pos: new THREE.Vector3(3, 1.0, 2), size: new THREE.Vector3(1.8, 1.0, 2.2) }
    ];

    hillParts.forEach(part => {
        const geometry = new THREE.BoxGeometry(part.size.x, part.size.y, part.size.z);
        // Hills use base material but slightly different texture scaling
        const mesh = new THREE.Mesh(geometry, materials.base.clone());
        if (mesh.material.map) {
            mesh.material.map.repeat.set(2, 2); // Different texture scale for hills
        }
        mesh.position.copy(part.pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        islandGroup.add(mesh);
    });

    // Add some tree-like structures (simple cylinders)
    const treePositions = [
        new THREE.Vector3(0.5, 1.2, -0.5),
        new THREE.Vector3(-1.5, 0.9, 0.8),
        new THREE.Vector3(2.5, 1.5, 1.5),
        new THREE.Vector3(-2.8, 0.8, -1.2)
    ];

    treePositions.forEach(treePos => {
        // Tree trunk - use rock material for bark-like appearance
        const trunkGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.8, 8);
        const trunk = new THREE.Mesh(trunkGeometry, materials.rock);
        trunk.position.set(treePos.x, treePos.y, treePos.z);
        islandGroup.add(trunk);

        // Tree foliage (flattened sphere) - use vegetation material
        const foliageGeometry = new THREE.SphereGeometry(0.4, 8, 6);
        const foliage = new THREE.Mesh(foliageGeometry, materials.vegetation);
        foliage.position.set(treePos.x, treePos.y + 0.6, treePos.z);
        foliage.scale.set(1, 0.6, 1); // Flatten slightly
        islandGroup.add(foliage);
    });

    // Add some rock formations
    const rockPositions = [
        new THREE.Vector3(4, 0.4, -2),
        new THREE.Vector3(-4, 0.3, 3),
        new THREE.Vector3(0, 0.5, 4)
    ];

    rockPositions.forEach(rockPos => {
        const rockGeometry = new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.4);
        const rock = new THREE.Mesh(rockGeometry, materials.rock);
        rock.position.copy(rockPos);
        rock.rotation.set(
            Math.random() * 0.5,
            Math.random() * Math.PI * 2,
            Math.random() * 0.3
        );
        islandGroup.add(rock);
    });

    islandGroup.userData = { ...config.userData, isProceduralIsland: true, type: 'floatingIsland' };

    // Add to scene
    scene.add(islandGroup);
    models.push(islandGroup);
    console.log(`MEGA: Added megastructure to scene, total models: ${models.length}`);
}

function createWallFadeMaterial(baseColor) {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            baseColor: { value: new THREE.Color(baseColor) },
            fadeStart: { value: 1.5 }, // Start fading at y = 1.5
            fadeEnd: { value: -15.0 }, // Fully invisible at y = -15
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            varying vec3 vNormal;

            void main() {
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 baseColor;
            uniform float fadeStart;
            uniform float fadeEnd;
            varying vec3 vWorldPosition;
            varying vec3 vNormal;

            void main() {
                // Calculate opacity based on Y position
                float y = vWorldPosition.y;
                float opacity = 1.0;

                if (y < fadeStart) {
                    // Linear fade from fadeStart to fadeEnd
                    opacity = clamp((y - fadeEnd) / (fadeStart - fadeEnd), 0.0, 1.0);
                }

                // Simple lighting
                vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                float lightIntensity = max(dot(vNormal, lightDir), 0.3);

                vec3 finalColor = baseColor * lightIntensity;

                gl_FragColor = vec4(finalColor, opacity);

                // Discard fully transparent fragments
                if (opacity < 0.01) {
                    discard;
                }
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
    });

    return material;
}

function createCoordinateAxes() {
    // Remove previous coordinate axes if they exist
    if (coordinateAxes) {
        scene.remove(coordinateAxes);
        coordinateAxes = null;
    }
    
    // Create a group to hold all axes
    coordinateAxes = new THREE.Group();
    
    const arrowLength = 5;
    const arrowHeadLength = 0.5;
    const arrowHeadWidth = 0.3;
    const labelDistance = arrowLength + 1;
    const baseHeight = 3.0; // Raised up in the air
    
    // Helper function to create text sprite
    function createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 128;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'Bold 60px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 2, 1);
        
        return sprite;
    }
    
    // X-axis (red) - positive direction
    const xArrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, baseHeight, 0),
        arrowLength,
        0xff0000,
        arrowHeadLength,
        arrowHeadWidth
    );
    coordinateAxes.add(xArrow);
    
    const xLabel = createTextSprite('X', '#ff0000');
    xLabel.position.set(labelDistance, baseHeight, 0);
    coordinateAxes.add(xLabel);
    
    // -X-axis (dark red) - negative direction
    const negXArrow = new THREE.ArrowHelper(
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, baseHeight, 0),
        arrowLength,
        0x880000,
        arrowHeadLength,
        arrowHeadWidth
    );
    coordinateAxes.add(negXArrow);
    
    const negXLabel = createTextSprite('-X', '#880000');
    negXLabel.position.set(-labelDistance, baseHeight, 0);
    coordinateAxes.add(negXLabel);
    
    // Y-axis (green) - positive direction (up)
    const yArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, baseHeight, 0),
        arrowLength,
        0x00ff00,
        arrowHeadLength,
        arrowHeadWidth
    );
    coordinateAxes.add(yArrow);
    
    const yLabel = createTextSprite('Y', '#00ff00');
    yLabel.position.set(0, labelDistance + baseHeight, 0);
    coordinateAxes.add(yLabel);
    
    // -Y-axis (dark green) - negative direction (down)
    const negYArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, baseHeight, 0),
        arrowLength,
        0x008800,
        arrowHeadLength,
        arrowHeadWidth
    );
    coordinateAxes.add(negYArrow);
    
    const negYLabel = createTextSprite('-Y', '#008800');
    negYLabel.position.set(0, -labelDistance + baseHeight, 0);
    coordinateAxes.add(negYLabel);
    
    // Z-axis (blue) - positive direction
    const zArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, baseHeight, 0),
        arrowLength,
        0x0000ff,
        arrowHeadLength,
        arrowHeadWidth
    );
    coordinateAxes.add(zArrow);
    
    const zLabel = createTextSprite('Z', '#0000ff');
    zLabel.position.set(0, baseHeight, labelDistance);
    coordinateAxes.add(zLabel);
    
    // -Z-axis (dark blue) - negative direction
    const negZArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, baseHeight, 0),
        arrowLength,
        0x000088,
        arrowHeadLength,
        arrowHeadWidth
    );
    coordinateAxes.add(negZArrow);
    
    const negZLabel = createTextSprite('-Z', '#000088');
    negZLabel.position.set(0, baseHeight, -labelDistance);
    coordinateAxes.add(negZLabel);
    
    // Position at origin (0, 0, 0) - the baseHeight is already applied to individual elements
    coordinateAxes.position.set(0, 0, 0);
    
    scene.add(coordinateAxes);
}

export function getTerrainHeight(x, z) {
    // Simple flat terrain - all ground is at y=0
    return 0;
}

export function getCourseHump() {
    return courseHump;
}

export function removeCoordinateAxes() {
    if (coordinateAxes) {
        scene.remove(coordinateAxes);
        // Dispose of sprites and their materials
        coordinateAxes.traverse((child) => {
            if (child.material) {
                if (child.material.map) {
                    child.material.map.dispose();
                }
                child.material.dispose();
            }
        });
        coordinateAxes = null;
    }
}

