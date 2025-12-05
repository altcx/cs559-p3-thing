// Animated night skybox with stars and shooting stars
import * as THREE from 'three';
import { scene } from './main.js';

let skybox = null;
let stars = null;
let starField = null;
let shootingStars = [];
let nebulaLayers = [];

/**
 * Create an animated night skybox with stars
 */
export function createNightSkybox() {
    // Remove existing skybox if any
    removeSkybox();
    
    // Set scene background to deep space black
    scene.background = new THREE.Color(0x000000); // Pure black for space
    
    // Create a large sphere for the skybox with gradient
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x000033) }, // Very dark blue at top
            bottomColor: { value: new THREE.Color(0x000000) }, // Pure black at bottom
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            varying vec3 vWorldPosition;
            
            void main() {
                float h = normalize(vWorldPosition).y;
                float t = max(h, 0.0); // 0 at bottom, 1 at top
                vec3 color = mix(bottomColor, topColor, t * t);
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        side: THREE.BackSide
    });
    skybox = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(skybox);
    
    // Create star field
    createStarField();
    
    // Create nebula layers for depth
    createNebulaLayers();
    
    // Initialize shooting stars
    initializeShootingStars();
    
    console.log('Space skybox created with stars, nebula, and shooting stars');
}

/**
 * Create a field of stars distributed across the sky
 */
function createStarField() {
    starField = new THREE.Group();
    
    const numStars = 8000; // Increased from 2000 for denser star field
    const starGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    const twinklePhases = []; // For twinkling animation
    
    // Generate random star positions on a sphere
    for (let i = 0; i < numStars; i++) {
        // Random position on sphere surface
        const theta = Math.random() * Math.PI * 2; // Azimuth angle
        const phi = Math.acos(2 * Math.random() - 1); // Polar angle
        
        const radius = 450 + Math.random() * 50; // Slightly varied distance
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        positions.push(x, y, z);
        
        // Random star color (realistic stellar distribution)
        const colorType = Math.random();
        let r, g, b;
        if (colorType < 0.5) {
            // White/blue-white stars (most common)
            r = 0.9 + Math.random() * 0.1;
            g = 0.9 + Math.random() * 0.1;
            b = 1.0;
        } else if (colorType < 0.7) {
            // Bright blue stars
            r = 0.7 + Math.random() * 0.2;
            g = 0.85 + Math.random() * 0.15;
            b = 1.0;
        } else if (colorType < 0.85) {
            // Yellow/golden stars
            r = 1.0;
            g = 0.9 + Math.random() * 0.1;
            b = 0.6 + Math.random() * 0.3;
        } else if (colorType < 0.95) {
            // Red/orange stars
            r = 1.0;
            g = 0.5 + Math.random() * 0.4;
            b = 0.3 + Math.random() * 0.3;
        } else {
            // Rare purple/pink stars
            r = 0.9 + Math.random() * 0.1;
            g = 0.6 + Math.random() * 0.2;
            b = 1.0;
        }
        
        colors.push(r, g, b);
        
        // Random star size with more variation
        const sizeRoll = Math.random();
        if (sizeRoll < 0.6) {
            // Small stars (60%)
            sizes.push(0.3 + Math.random() * 0.7);
        } else if (sizeRoll < 0.9) {
            // Medium stars (30%)
            sizes.push(1.0 + Math.random() * 1.5);
        } else {
            // Large bright stars (10%)
            sizes.push(2.5 + Math.random() * 2.0);
        }
        
        // Random twinkle phase for animation (with different speeds)
        // Some stars twinkle fast, some slow, some barely at all
        const twinkleSpeed = Math.random();
        if (twinkleSpeed < 0.3) {
            twinklePhases.push(Math.random() * Math.PI * 2); // Normal speed
        } else if (twinkleSpeed < 0.6) {
            twinklePhases.push((Math.random() * Math.PI * 2) + 100); // Slow (offset)
        } else if (twinkleSpeed < 0.9) {
            twinklePhases.push((Math.random() * Math.PI * 2) + 200); // Very slow
        } else {
            twinklePhases.push((Math.random() * Math.PI * 2) + 300); // Pulsars (fast)
        }
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    starGeometry.setAttribute('starColor', new THREE.Float32BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    starGeometry.setAttribute('twinklePhase', new THREE.Float32BufferAttribute(twinklePhases, 1));
    
    // Create shader material for stars with twinkling
    const starMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 starColor;
            attribute float twinklePhase;
            varying vec3 vColor;
            varying float vTwinkle;
            
            void main() {
                vColor = starColor;
                vTwinkle = twinklePhase;
                
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float time;
            varying vec3 vColor;
            varying float vTwinkle;
            
            void main() {
                // Determine twinkle speed based on phase offset
                float speed = 1.0;
                float phase = vTwinkle;
                if (vTwinkle > 300.0) {
                    // Pulsars - fast
                    speed = 5.0;
                    phase = vTwinkle - 300.0;
                } else if (vTwinkle > 200.0) {
                    // Very slow
                    speed = 0.3;
                    phase = vTwinkle - 200.0;
                } else if (vTwinkle > 100.0) {
                    // Slow
                    speed = 0.6;
                    phase = vTwinkle - 100.0;
                }
                
                // Create more dramatic twinkling effect with multiple frequencies
                float twinkle1 = sin(time * 2.0 * speed + phase) * 0.35;
                float twinkle2 = sin(time * 3.7 * speed + phase * 2.0) * 0.15;
                float twinkle = twinkle1 + twinkle2 + 0.7;
                
                // Create star shape (circular with soft edges and bright center)
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                
                // Add bright core
                float core = 1.0 - smoothstep(0.0, 0.15, dist);
                float brightness = alpha + core * 0.5;
                
                gl_FragColor = vec4(vColor * twinkle * (1.0 + core * 0.3), alpha * brightness);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    stars = new THREE.Points(starGeometry, starMaterial);
    starField.add(stars);
    scene.add(starField);
    
    // Store reference to material for animation
    stars.userData.material = starMaterial;
}

/**
 * Create nebula/gas cloud layers for depth
 */
function createNebulaLayers() {
    // Create multiple nebula clouds at different positions
    const nebulaConfigs = [
        { position: new THREE.Vector3(300, 200, -400), color: 0x4400ff, size: 150 },
        { position: new THREE.Vector3(-350, 150, -350), color: 0xff0088, size: 120 },
        { position: new THREE.Vector3(200, -250, -400), color: 0x0088ff, size: 180 },
        { position: new THREE.Vector3(-250, -200, 350), color: 0x8800ff, size: 140 },
        { position: new THREE.Vector3(0, 300, -450), color: 0x00ffaa, size: 100 },
        { position: new THREE.Vector3(400, -100, 200), color: 0xff4400, size: 130 },
        { position: new THREE.Vector3(-400, 250, 300), color: 0xaa00ff, size: 160 },
        { position: new THREE.Vector3(350, -200, -300), color: 0x00aaff, size: 110 }
    ];
    
    nebulaConfigs.forEach(config => {
        const nebulaGeometry = new THREE.SphereGeometry(config.size, 16, 16);
        const nebulaMaterial = new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.08,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide
        });
        
        const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
        nebula.position.copy(config.position);
        starField.add(nebula);
        nebulaLayers.push(nebula);
    });
    
    // Add distant galaxy/star cluster sprites
    createDistantGalaxies();
    
    // Add Milky Way-like band across sky
    createMilkyWayBand();
}

/**
 * Create a Milky Way-like band of stars across the sky
 */
function createMilkyWayBand() {
    const bandStarCount = 3000;
    const bandGeometry = new THREE.BufferGeometry();
    const bandPositions = [];
    const bandColors = [];
    const bandSizes = [];
    
    for (let i = 0; i < bandStarCount; i++) {
        // Create band across the sky (like Milky Way)
        const t = Math.random();
        const angle = t * Math.PI * 2;
        const bandWidth = 60; // Width of the band in degrees
        const bandOffset = (Math.random() - 0.5) * bandWidth * Math.PI / 180;
        
        const radius = 450 + Math.random() * 40;
        const phi = Math.PI / 2 + bandOffset; // Near equator with some spread
        const theta = angle;
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        bandPositions.push(x, y, z);
        
        // Milky Way colors (mostly white/blue-white with dust)
        const dustiness = Math.random();
        if (dustiness < 0.6) {
            // Bright white/blue stars
            bandColors.push(0.9, 0.95, 1.0);
        } else if (dustiness < 0.85) {
            // Slightly dimmer blue-white
            bandColors.push(0.7, 0.8, 0.9);
        } else {
            // Dust (dim yellow-brown)
            bandColors.push(0.6, 0.5, 0.3);
        }
        
        // Varied sizes
        bandSizes.push(0.2 + Math.random() * 0.8);
    }
    
    bandGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bandPositions, 3));
    bandGeometry.setAttribute('color', new THREE.Float32BufferAttribute(bandColors, 3));
    bandGeometry.setAttribute('size', new THREE.Float32BufferAttribute(bandSizes, 1));
    
    const bandMaterial = new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    
    const milkyWay = new THREE.Points(bandGeometry, bandMaterial);
    starField.add(milkyWay);
}

/**
 * Create distant galaxies/star clusters for deep space feel
 */
function createDistantGalaxies() {
    const galaxyCount = 12;
    
    for (let i = 0; i < galaxyCount; i++) {
        // Random position on far sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 480;
        
        const position = new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );
        
        // Create canvas for galaxy texture
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Draw galaxy spiral
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        const colors = [0x88aaff, 0xaa88ff, 0xffaa88, 0x88ffaa];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
        gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.4)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.scale.set(40, 40, 1);
        starField.add(sprite);
    }
}

/**
 * Initialize shooting stars system
 */
function initializeShootingStars() {
    // Create a pool of shooting stars that will be reused
    const numShootingStars = 25; // Increased for more frequent shooting stars
    
    for (let i = 0; i < numShootingStars; i++) {
        const shootingStar = createShootingStar();
        shootingStars.push(shootingStar);
        scene.add(shootingStar.line);
    }
    
    // Add space dust particles (floating slowly)
    createSpaceDust();
}

/**
 * Create floating space dust particles
 */
function createSpaceDust() {
    const dustCount = 1000;
    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = [];
    const dustColors = [];
    const dustSizes = [];
    const dustVelocities = [];
    
    for (let i = 0; i < dustCount; i++) {
        // Random position in sphere around course
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 100 + Math.random() * 300;
        
        dustPositions.push(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );
        
        // Dim colors
        const brightness = 0.3 + Math.random() * 0.4;
        dustColors.push(brightness, brightness, brightness * 1.1);
        
        // Small sizes
        dustSizes.push(0.1 + Math.random() * 0.3);
        
        // Random slow velocity for drifting
        dustVelocities.push(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5
        );
    }
    
    dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));
    dustGeometry.setAttribute('size', new THREE.Float32BufferAttribute(dustSizes, 1));
    dustGeometry.setAttribute('velocity', new THREE.Float32BufferAttribute(dustVelocities, 3));
    
    const dustMaterial = new THREE.PointsMaterial({
        size: 2,
        vertexColors: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.userData.isSpaceDust = true;
    starField.add(dust);
}

/**
 * Create a single shooting star
 */
function createShootingStar() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(6); // 2 points (start and end)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        linewidth: 2
    });
    
    const line = new THREE.Line(geometry, material);
    
    return {
        line: line,
        active: false,
        lifetime: 0,
        maxLifetime: 0,
        startPos: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        length: 0
    };
}

/**
 * Spawn a new shooting star
 */
function spawnShootingStar(shootingStar) {
    // Random position on a sphere far away
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 400;
    
    shootingStar.startPos.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
    );
    
    // Random velocity direction (shooting across the sky in various directions)
    const velocityMagnitude = 150 + Math.random() * 250;
    
    // Some shooting stars go across the sky (perpendicular to radial)
    if (Math.random() < 0.7) {
        // Tangential motion (across the sky)
        const tangentTheta = theta + Math.PI / 2 + (Math.random() - 0.5) * 1.0;
        const tangentPhi = phi + (Math.random() - 0.5) * 0.8;
        
        shootingStar.velocity.set(
            Math.sin(tangentPhi) * Math.cos(tangentTheta) * velocityMagnitude,
            Math.sin(tangentPhi) * Math.sin(tangentTheta) * velocityMagnitude,
            Math.cos(tangentPhi) * velocityMagnitude
        );
    } else {
        // Toward/away from center
        const velocityTheta = theta + (Math.random() - 0.5) * 0.8;
        const velocityPhi = phi + (Math.random() - 0.5) * 0.8;
        const direction = Math.random() < 0.5 ? -1 : 1;
        
        shootingStar.velocity.set(
            direction * Math.sin(velocityPhi) * Math.cos(velocityTheta) * velocityMagnitude,
            direction * Math.sin(velocityPhi) * Math.sin(velocityTheta) * velocityMagnitude,
            direction * Math.cos(velocityPhi) * velocityMagnitude
        );
    }
    
    shootingStar.length = 30 + Math.random() * 70; // Longer trail length (30-100)
    shootingStar.lifetime = 0;
    shootingStar.maxLifetime = 1.0 + Math.random() * 2.0; // 1-3 seconds
    shootingStar.active = true;
    
    // Set initial line positions
    const positions = shootingStar.line.geometry.attributes.position.array;
    positions[0] = shootingStar.startPos.x;
    positions[1] = shootingStar.startPos.y;
    positions[2] = shootingStar.startPos.z;
    positions[3] = shootingStar.startPos.x;
    positions[4] = shootingStar.startPos.y;
    positions[5] = shootingStar.startPos.z;
    shootingStar.line.geometry.attributes.position.needsUpdate = true;
    
    // Random color (varied for visual interest)
    const colorRoll = Math.random();
    if (colorRoll < 0.5) {
        shootingStar.line.material.color.setHex(0xffffff); // White
    } else if (colorRoll < 0.7) {
        shootingStar.line.material.color.setHex(0x88ddff); // Light blue
    } else if (colorRoll < 0.85) {
        shootingStar.line.material.color.setHex(0xffaa88); // Orange
    } else if (colorRoll < 0.95) {
        shootingStar.line.material.color.setHex(0xaaffaa); // Greenish
    } else {
        shootingStar.line.material.color.setHex(0xffaaff); // Purple/pink
    }
}

/**
 * Update shooting stars
 */
function updateShootingStars(deltaTime) {
    // Spawn new shooting stars more frequently for space atmosphere
    if (Math.random() < 0.08) { // 8% chance per frame (~5 per second at 60fps)
        const inactiveStar = shootingStars.find(s => !s.active);
        if (inactiveStar) {
            spawnShootingStar(inactiveStar);
        }
    }
    
    // Update active shooting stars
    shootingStars.forEach(shootingStar => {
        if (!shootingStar.active) return;
        
        shootingStar.lifetime += deltaTime;
        
        // Check if shooting star expired
        if (shootingStar.lifetime >= shootingStar.maxLifetime) {
            shootingStar.active = false;
            shootingStar.line.material.opacity = 0;
            return;
        }
        
        // Calculate current position
        const progress = shootingStar.lifetime / shootingStar.maxLifetime;
        const currentPos = shootingStar.startPos.clone().add(
            shootingStar.velocity.clone().multiplyScalar(shootingStar.lifetime)
        );
        
        // Calculate tail position (based on trail length)
        const tailDirection = shootingStar.velocity.clone().normalize();
        const tailPos = currentPos.clone().sub(tailDirection.multiplyScalar(shootingStar.length));
        
        // Update line positions
        const positions = shootingStar.line.geometry.attributes.position.array;
        positions[0] = tailPos.x;
        positions[1] = tailPos.y;
        positions[2] = tailPos.z;
        positions[3] = currentPos.x;
        positions[4] = currentPos.y;
        positions[5] = currentPos.z;
        shootingStar.line.geometry.attributes.position.needsUpdate = true;
        
        // Fade in quickly, then fade out
        let opacity;
        if (progress < 0.1) {
            // Fade in
            opacity = progress / 0.1;
        } else if (progress > 0.7) {
            // Fade out
            opacity = (1 - progress) / 0.3;
        } else {
            // Full brightness
            opacity = 1.0;
        }
        
        shootingStar.line.material.opacity = opacity * 0.9;
    });
}

/**
 * Update skybox animation (twinkling stars, shooting stars, nebula)
 * @param {number} deltaTime - Time since last frame
 */
export function updateSkybox(deltaTime) {
    if (stars && stars.userData.material) {
        stars.userData.material.uniforms.time.value += deltaTime;
    }
    
    // Slow rotation of star field for movement
    if (starField) {
        starField.rotation.y += deltaTime * 0.01; // Very slow rotation
        starField.rotation.x += deltaTime * 0.005; // Even slower X rotation
        
        // Update space dust positions (drifting)
        starField.traverse((child) => {
            if (child.userData && child.userData.isSpaceDust && child.geometry) {
                const positions = child.geometry.attributes.position;
                const velocities = child.geometry.attributes.velocity;
                
                if (positions && velocities) {
                    for (let i = 0; i < positions.count; i++) {
                        positions.setX(i, positions.getX(i) + velocities.getX(i) * deltaTime);
                        positions.setY(i, positions.getY(i) + velocities.getY(i) * deltaTime);
                        positions.setZ(i, positions.getZ(i) + velocities.getZ(i) * deltaTime);
                        
                        // Wrap around if too far
                        const x = positions.getX(i);
                        const y = positions.getY(i);
                        const z = positions.getZ(i);
                        const distSq = x*x + y*y + z*z;
                        
                        if (distSq > 400 * 400) {
                            // Reset to opposite side
                            const factor = -0.8;
                            positions.setX(i, x * factor);
                            positions.setY(i, y * factor);
                            positions.setZ(i, z * factor);
                        }
                    }
                    positions.needsUpdate = true;
                }
            }
        });
    }
    
    // Update shooting stars
    updateShootingStars(deltaTime);
    
    // Animate nebula layers (subtle pulsing)
    nebulaLayers.forEach((nebula, index) => {
        const time = performance.now() * 0.001;
        const pulseSpeed = 0.5 + index * 0.1;
        const pulse = Math.sin(time * pulseSpeed) * 0.02 + 0.08;
        nebula.material.opacity = pulse;
        
        // Slow rotation for each nebula
        nebula.rotation.x += deltaTime * 0.02;
        nebula.rotation.y += deltaTime * 0.015;
    });
}

/**
 * Remove skybox and stars
 */
export function removeSkybox() {
    if (skybox) {
        scene.remove(skybox);
        skybox.geometry.dispose();
        skybox.material.dispose();
        skybox = null;
    }
    
    if (starField) {
        scene.remove(starField);
        starField.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        starField = null;
        stars = null;
    }
    
    // Remove shooting stars
    shootingStars.forEach(shootingStar => {
        if (shootingStar.line) {
            scene.remove(shootingStar.line);
            shootingStar.line.geometry.dispose();
            shootingStar.line.material.dispose();
        }
    });
    shootingStars = [];
    
    // Clear nebula layers
    nebulaLayers = [];
    
    // Reset background to default
    scene.background = new THREE.Color(0xdbe4e6);
}

