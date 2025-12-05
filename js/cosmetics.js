import * as THREE from 'three';
import { BLOSSOM_SVG } from './blossom-svg.js';
import { isFullMode } from './main.js';

const STORAGE_KEY = 'golf_selected_cosmetic';
const STORAGE_KEY_SKIN = 'golf_selected_skin';

// Ball skins (colors and effects)
const BALL_SKINS = [
    { id: 'white', name: 'White', color: 0xffffff },
    { id: 'red', name: 'Red', color: 0xff3333 },
    { id: 'blue', name: 'Blue', color: 0x3399ff },
    { id: 'yellow', name: 'Yellow', color: 0xffd700 },
    { id: 'green', name: 'Green', color: 0x33ff66 },
    { id: 'purple', name: 'Purple', color: 0x9933ff },
    { id: 'pink', name: 'Pink', color: 0xff66b2 },
    { id: 'black', name: 'Black', color: 0x222222 },
    { id: 'rainbow', name: 'Rainbow', color: null, isAnimated: true },
    { id: 'pulse', name: 'Pulse', color: null, isAnimated: true },
    { id: 'aurora', name: 'Aurora', color: null, isVideo: true, videoPath: 'mp4s/Aurora-1764872332999.mp4' },
    { 
        id: 'blossom', 
        name: 'Blossom', 
        color: null, 
        isSvg: true, 
        svgCode: BLOSSOM_SVG
    }
];

// Hat/accessory cosmetics
const COSMETICS = [
    {
        id: 'none',
        name: 'None',
        createMesh: null
    },
    {
        id: 'wizard_hat',
        name: 'Wizard Hat',
        createMesh: createWizardHatMesh
    },
    {
        id: 'crown',
        name: 'Royal Crown',
        createMesh: createCrownMesh
    },
    {
        id: 'halo',
        name: 'Halo',
        createMesh: createHaloMesh
    },
    {
        id: 'sombrero',
        name: 'Sombrero',
        createMesh: createSombreroMesh
    },
    {
        id: 'top_hat',
        name: 'Top Hat',
        createMesh: createTopHatMesh
    },
    {
        id: 'rice_hat',
        name: 'Rice Hat',
        createMesh: createRiceHatMesh
    }
];

const DEFAULT_BALL_RADIUS = 0.5;

let selectedCosmeticId = loadSelection(STORAGE_KEY, 'none', COSMETICS);
let selectedSkinId = loadSelection(STORAGE_KEY_SKIN, 'white', BALL_SKINS);

let currentBallMesh = null;
let currentBallRadius = DEFAULT_BALL_RADIUS;
let currentCosmeticMesh = null;
let cosmeticScene = null;
let ballVideoTexture = null;
let ballVideoElement = null;
let ballSvgTexture = null;

function loadSelection(key, defaultValue, list) {
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            const parsed = JSON.parse(stored);
            const exists = list.some(item => item.id === parsed);
            if (exists) return parsed;
        }
    } catch (error) {
        console.warn('Failed to load selection from storage:', error);
    }
    return defaultValue;
}

function saveSelection(key, id) {
    try {
        localStorage.setItem(key, JSON.stringify(id));
    } catch (error) {
        console.warn('Failed to save selection:', error);
    }
}

function disposeCosmeticMesh(mesh) {
    if (!mesh) return;
    mesh.traverse(child => {
        if (child.isMesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat?.dispose());
            } else {
                child.material?.dispose();
            }
        }
    });
}

// ============ HAT COSMETICS ============

// Creates wizard hat with y=0 being where it attaches to ball top
function createWizardHatMesh(ballRadius = 0.5) {
    const group = new THREE.Group();
    const hatColor = 0x7d3cff;
    const material = new THREE.MeshStandardMaterial({
        color: hatColor,
        metalness: 0.2,
        roughness: 0.4
    });
    
    const brimThickness = 0.05;
    const brimRadius = ballRadius * 0.9;
    const brimGeometry = new THREE.CylinderGeometry(brimRadius, brimRadius, brimThickness, 32);
    const brim = new THREE.Mesh(brimGeometry, material);
    brim.castShadow = true;
    brim.receiveShadow = true;
    
    // y=0 is where brim bottom touches ball top
    brim.position.y = brimThickness / 2;
    group.add(brim);
    
    const coneHeight = ballRadius * 1.2;
    const coneRadius = ballRadius * 0.5;
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 32);
    const cone = new THREE.Mesh(coneGeometry, material);
    cone.castShadow = true;
    cone.receiveShadow = true;
    cone.position.y = brimThickness + coneHeight / 2;
    group.add(cone);
    
    group.name = 'wizard_hat_cosmetic';
    return group;
}

// Creates crown with y=0 being where it attaches to ball top
function createCrownMesh(ballRadius = 0.5) {
    const group = new THREE.Group();
    
    const goldMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.8,
        roughness: 0.2
    });
    
    const gemMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.3,
        roughness: 0.1,
        emissive: 0x330000
    });
    
    // Crown base band
    const bandHeight = ballRadius * 0.25;
    const bandRadius = ballRadius * 0.7;
    const bandGeometry = new THREE.CylinderGeometry(bandRadius, bandRadius * 0.95, bandHeight, 32);
    const band = new THREE.Mesh(bandGeometry, goldMaterial);
    band.castShadow = true;
    band.receiveShadow = true;
    band.position.y = bandHeight / 2;
    group.add(band);
    
    // Crown points (5 points around the crown)
    const numPoints = 5;
    const pointHeight = ballRadius * 0.35;
    const pointRadius = ballRadius * 0.08;
    
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const x = Math.cos(angle) * bandRadius * 0.85;
        const z = Math.sin(angle) * bandRadius * 0.85;
        
        // Create pointed tip using cone
        const pointGeometry = new THREE.ConeGeometry(pointRadius, pointHeight, 8);
        const point = new THREE.Mesh(pointGeometry, goldMaterial);
        point.castShadow = true;
        point.position.set(x, bandHeight + pointHeight / 2, z);
        group.add(point);
        
        // Add gem at base of each point
        const gemGeometry = new THREE.SphereGeometry(pointRadius * 0.8, 16, 16);
        const gem = new THREE.Mesh(gemGeometry, gemMaterial);
        gem.position.set(x, bandHeight * 0.7, z);
        group.add(gem);
    }
    
    group.name = 'crown_cosmetic';
    return group;
}

// Creates halo with y=0 being where it attaches to ball top, but halo hovers above
function createHaloMesh(ballRadius = 0.5) {
    const group = new THREE.Group();
    
    const goldMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0xffaa00,
        emissiveIntensity: 0.3
    });
    
    // Create halo ring using a torus
    const haloRadius = ballRadius * 0.8;
    const tubeRadius = ballRadius * 0.08;
    const haloGeometry = new THREE.TorusGeometry(haloRadius, tubeRadius, 16, 32);
    const halo = new THREE.Mesh(haloGeometry, goldMaterial);
    halo.castShadow = true;
    halo.receiveShadow = true;
    
    // Halo hovers above the ball - position it above y=0
    halo.position.y = ballRadius * 0.3; // Hover above the ball
    halo.rotation.x = Math.PI / 2; // Rotate to be horizontal
    
    group.add(halo);
    
    // Add small glow particles/spheres around the halo for extra effect
    const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffaa00,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.6
    });
    
    const numGlows = 8;
    for (let i = 0; i < numGlows; i++) {
        const angle = (i / numGlows) * Math.PI * 2;
        const glowGeometry = new THREE.SphereGeometry(ballRadius * 0.05, 8, 8);
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(
            Math.cos(angle) * haloRadius,
            ballRadius * 0.3,
            Math.sin(angle) * haloRadius
        );
        group.add(glow);
    }
    
    group.name = 'halo_cosmetic';
    return group;
}

// Creates sombrero with y=0 being where it attaches to ball top
function createSombreroMesh(ballRadius = 0.5) {
    const group = new THREE.Group();
    
    // Traditional sombrero colors
    const brimMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513, // Brown
        metalness: 0.1,
        roughness: 0.7
    });
    
    const topMaterial = new THREE.MeshStandardMaterial({
        color: 0xCD853F, // Tan/peru
        metalness: 0.1,
        roughness: 0.7
    });
    
    const bandMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF0000, // Red band
        metalness: 0.2,
        roughness: 0.5
    });
    
    // Wide brim
    const brimThickness = ballRadius * 0.08;
    const brimRadius = ballRadius * 1.4; // Much wider than wizard hat
    const brimGeometry = new THREE.CylinderGeometry(brimRadius, brimRadius * 1.1, brimThickness, 32);
    const brim = new THREE.Mesh(brimGeometry, brimMaterial);
    brim.castShadow = true;
    brim.receiveShadow = true;
    
    // y=0 is where brim bottom touches ball top
    brim.position.y = brimThickness / 2;
    group.add(brim);
    
    // Top cone/crown of sombrero
    const topHeight = ballRadius * 0.8;
    const topRadiusTop = ballRadius * 0.4;
    const topRadiusBottom = ballRadius * 0.5;
    const topGeometry = new THREE.CylinderGeometry(topRadiusTop, topRadiusBottom, topHeight, 16);
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.castShadow = true;
    top.receiveShadow = true;
    top.position.y = brimThickness + topHeight / 2;
    group.add(top);
    
    // Decorative band around the top
    const bandHeight = ballRadius * 0.15;
    const bandRadius = topRadiusBottom;
    const bandGeometry = new THREE.CylinderGeometry(bandRadius, bandRadius, bandHeight, 16);
    const band = new THREE.Mesh(bandGeometry, bandMaterial);
    band.castShadow = true;
    band.receiveShadow = true;
    band.position.y = brimThickness + topHeight * 0.3;
    group.add(band);
    
    // Add some decorative patterns/embroidery on the brim (small circles)
    const patternMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFD700, // Gold
        metalness: 0.5,
        roughness: 0.3
    });
    
    const numPatterns = 6;
    for (let i = 0; i < numPatterns; i++) {
        const angle = (i / numPatterns) * Math.PI * 2;
        const patternRadius = brimRadius * 0.7;
        const patternGeometry = new THREE.CylinderGeometry(ballRadius * 0.03, ballRadius * 0.03, brimThickness * 1.5, 8);
        const pattern = new THREE.Mesh(patternGeometry, patternMaterial);
        pattern.position.set(
            Math.cos(angle) * patternRadius,
            brimThickness / 2,
            Math.sin(angle) * patternRadius
        );
        pattern.rotation.z = Math.PI / 2;
        group.add(pattern);
    }
    
    group.name = 'sombrero_cosmetic';
    return group;
}

// Creates top hat
function createTopHatMesh(ballRadius = 0.5) {
    const group = new THREE.Group();
    
    const blackMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.1,
        roughness: 0.8
    });
    
    const bandMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.3,
        roughness: 0.5
    });
    
    // Brim
    const brimThickness = ballRadius * 0.05;
    const brimRadius = ballRadius * 0.9;
    const brimGeometry = new THREE.CylinderGeometry(brimRadius, brimRadius, brimThickness, 32);
    const brim = new THREE.Mesh(brimGeometry, blackMaterial);
    brim.castShadow = true;
    brim.receiveShadow = true;
    brim.position.y = brimThickness / 2;
    group.add(brim);
    
    // Top cylinder
    const topHeight = ballRadius * 1.0;
    const topRadius = ballRadius * 0.6;
    const topGeometry = new THREE.CylinderGeometry(topRadius, topRadius, topHeight, 32);
    const top = new THREE.Mesh(topGeometry, blackMaterial);
    top.castShadow = true;
    top.receiveShadow = true;
    top.position.y = brimThickness + topHeight / 2;
    group.add(top);
    
    // Band
    const bandHeight = ballRadius * 0.15;
    const bandRadius = topRadius * 1.02;
    const bandGeometry = new THREE.CylinderGeometry(bandRadius, bandRadius, bandHeight, 32);
    const band = new THREE.Mesh(bandGeometry, bandMaterial);
    band.castShadow = true;
    band.receiveShadow = true;
    band.position.y = brimThickness + bandHeight / 2;
    group.add(band);
    
    group.name = 'top_hat_cosmetic';
    return group;
}

// Creates rice hat (conical hat)
function createRiceHatMesh(ballRadius = 0.5) {
    const group = new THREE.Group();
    
    const strawMaterial = new THREE.MeshStandardMaterial({
        color: 0xE4D96F, // Straw color
        metalness: 0.0,
        roughness: 1.0
    });
    
    // Cone
    const coneHeight = ballRadius * 0.6;
    const coneRadius = ballRadius * 1.2;
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 32);
    const cone = new THREE.Mesh(coneGeometry, strawMaterial);
    cone.castShadow = true;
    cone.receiveShadow = true;
    cone.position.y = coneHeight / 2;
    group.add(cone);
    
    // Chin strap (simple torus segment or just implied)
    // Adding a small detail on top
    const knobGeometry = new THREE.SphereGeometry(ballRadius * 0.05, 8, 8);
    const knob = new THREE.Mesh(knobGeometry, strawMaterial);
    knob.position.y = coneHeight;
    group.add(knob);
    
    group.name = 'rice_hat_cosmetic';
    return group;
}

function instantiateCosmeticMesh(cosmeticId, radius) {
    if (cosmeticId === 'none') return null;
    const cosmetic = COSMETICS.find(cos => cos.id === cosmeticId);
    if (!cosmetic || typeof cosmetic.createMesh !== 'function') {
        return null;
    }
    return cosmetic.createMesh(radius);
}

function updateCosmeticTransform() {
    if (!currentBallMesh || !currentCosmeticMesh) return;
    // Hat mesh has y=0 at attachment point, so just position at ball top
    currentCosmeticMesh.position.set(
        currentBallMesh.position.x,
        currentBallMesh.position.y + currentBallRadius,
        currentBallMesh.position.z
    );
    currentCosmeticMesh.rotation.set(0, 0, 0);
}

function applyCosmeticToBall() {
    if (!currentBallMesh || !cosmeticScene) return;
    
    // Remove existing cosmetic mesh
    if (currentCosmeticMesh) {
        cosmeticScene.remove(currentCosmeticMesh);
        disposeCosmeticMesh(currentCosmeticMesh);
        currentCosmeticMesh = null;
    }
    
    // Only apply cosmetics in full mode
    if (!isFullMode) {
        return;
    }
    
    currentCosmeticMesh = instantiateCosmeticMesh(selectedCosmeticId, currentBallRadius);
    if (currentCosmeticMesh) {
        cosmeticScene.add(currentCosmeticMesh);
        updateCosmeticTransform();
    }
}

// ============ BALL SKINS ============

function createVideoTexture(videoPath) {
    // Dispose old video if switching
    if (ballVideoElement) {
        ballVideoElement.pause();
        ballVideoElement.src = '';
        ballVideoElement.load();
    }
    if (ballVideoTexture) {
        ballVideoTexture.dispose();
    }
    
    // Create video element
    const video = document.createElement('video');
    video.src = videoPath;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    
    // Play video when it's ready
    video.addEventListener('loadeddata', () => {
        video.play().catch(err => {
            console.warn('Video autoplay failed:', err);
            // Try playing on user interaction
            document.addEventListener('click', () => {
                video.play().catch(() => {});
            }, { once: true });
        });
    });
    
    // Create texture from video
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    
    ballVideoElement = video;
    ballVideoTexture = texture;
    
    return texture;
}

function createSvgTexture(svgCode) {
    // Dispose old SVG texture if switching
    if (ballSvgTexture) {
        ballSvgTexture.dispose();
    }
    
    // Create canvas to render SVG
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Create an Image from SVG
    const img = new Image();
    const svgBlob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    // Create texture immediately with placeholder
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    // When image loads, draw to canvas and update texture
    img.onload = () => {
        ctx.drawImage(img, 0, 0, 512, 512);
        texture.needsUpdate = true;
        URL.revokeObjectURL(url);
    };
    
    img.onerror = (err) => {
        console.error('Failed to load SVG:', err);
        // Fill with a fallback gradient
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, '#FF7777');
        gradient.addColorStop(1, '#fdcadb');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        texture.needsUpdate = true;
        URL.revokeObjectURL(url);
    };
    
    img.src = url;
    
    ballSvgTexture = texture;
    
    return texture;
}

function applyBallSkin() {
    if (!currentBallMesh) return;
    
    // In prototype mode, always use default white color
    if (!isFullMode) {
        if (!(currentBallMesh.material instanceof THREE.MeshBasicMaterial)) {
            currentBallMesh.material.dispose();
            currentBallMesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        } else {
            currentBallMesh.material.color.setHex(0xffffff);
        }
        return;
    }
    
    const skin = BALL_SKINS.find(s => s.id === selectedSkinId);
    if (!skin) return;
    
    if (skin.isVideo) {
        // Video texture skin
        const videoTexture = createVideoTexture(skin.videoPath);
        const material = new THREE.MeshStandardMaterial({
            map: videoTexture,
            emissive: 0x000000,
            emissiveIntensity: 0.2
        });
        currentBallMesh.material = material;
    } else if (skin.isSvg) {
        // SVG texture skin
        const svgTexture = createSvgTexture(skin.svgCode);
        const material = new THREE.MeshStandardMaterial({
            map: svgTexture,
            emissive: 0xffffff,
            emissiveIntensity: 0.3,
            emissiveMap: svgTexture
        });
        currentBallMesh.material = material;
    } else if (skin.isAnimated) {
        // Animated skin - use standard material
        if (!(currentBallMesh.material instanceof THREE.MeshStandardMaterial)) {
            currentBallMesh.material.dispose();
            currentBallMesh.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        }
        currentBallMesh.material.color.setHex(0xffffff);
        
        // Reset emissive for pulse
        currentBallMesh.material.emissive.setHex(0x000000);
        currentBallMesh.material.emissiveIntensity = 0;
    } else {
        // Solid color skin
        if (!(currentBallMesh.material instanceof THREE.MeshStandardMaterial)) {
            currentBallMesh.material.dispose();
            currentBallMesh.material = new THREE.MeshStandardMaterial({ color: skin.color });
        } else {
            currentBallMesh.material.color.setHex(skin.color);
        }
    }
}

function updateAnimatedSkin(time) {
    if (!currentBallMesh) return;
    
    // Ensure video is playing if video skin is active
    if (ballVideoElement && selectedSkinId === 'aurora') {
        if (ballVideoElement.paused && ballVideoElement.readyState >= 2) {
            ballVideoElement.play().catch(() => {
                // Autoplay blocked, will play on user interaction
            });
        }
    }
    
    if (selectedSkinId === 'rainbow') {
        // Cycle through rainbow colors
        const hue = (time * 0.5) % 1;
        currentBallMesh.material.color.setHSL(hue, 1, 0.5);
    } else if (selectedSkinId === 'pulse') {
        // Pulse between red and blue
        const t = (Math.sin(time * 3) + 1) / 2; // 0 to 1
        currentBallMesh.material.color.setHSL(0.7 * t, 1, 0.5);
        currentBallMesh.material.emissive.setHSL(0.7 * t, 1, 0.2);
        currentBallMesh.material.emissiveIntensity = 0.5 + 0.5 * t;
    }
}

// ============ EXPORTS ============

export function registerBallForCosmetics(ballMesh, sceneRef, radius = DEFAULT_BALL_RADIUS) {
    if (currentCosmeticMesh && cosmeticScene) {
        cosmeticScene.remove(currentCosmeticMesh);
        disposeCosmeticMesh(currentCosmeticMesh);
        currentCosmeticMesh = null;
    }
    
    cosmeticScene = sceneRef;
    currentBallMesh = ballMesh;
    currentBallRadius = radius || DEFAULT_BALL_RADIUS;
    applyCosmeticToBall();
    applyBallSkin();
}

export function getAvailableCosmetics() {
    return COSMETICS.slice();
}

export function getAvailableSkins() {
    return BALL_SKINS.slice();
}

export function getSelectedCosmeticId() {
    return selectedCosmeticId;
}

export function getSelectedSkinId() {
    return selectedSkinId;
}

export function setSelectedCosmetic(id) {
    const exists = COSMETICS.some(cos => cos.id === id);
    if (!exists) {
        console.warn('Attempted to select unknown cosmetic:', id);
        return;
    }
    
    selectedCosmeticId = id;
    saveSelection(STORAGE_KEY, id);
    applyCosmeticToBall();
}

export function setSelectedSkin(id) {
    const exists = BALL_SKINS.some(skin => skin.id === id);
    if (!exists) {
        console.warn('Attempted to select unknown skin:', id);
        return;
    }
    
    selectedSkinId = id;
    saveSelection(STORAGE_KEY_SKIN, id);
    applyBallSkin();
}

export function updateCosmetics(deltaTime = 0.016) {
    updateCosmeticTransform();
    updateAnimatedSkin(Date.now() * 0.001);
}

export function createCosmeticPreview(container) {
    const previewSize = 500;
    const width = previewSize;
    const height = previewSize;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.domElement.style.cssText = `
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
    `;
    container.appendChild(renderer.domElement);
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    camera.position.set(0, 0.5, 3.5);
    
    const handleResize = () => {
        const rect = container.getBoundingClientRect();
        const containerSize = Math.min(rect.width, rect.height) || previewSize;
        renderer.setSize(containerSize, containerSize);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
    };
    
    requestAnimationFrame(() => handleResize());
    window.addEventListener('resize', handleResize);
    
    const hemi = new THREE.HemisphereLight(0xffffff, 0x555555, 1.2);
    scene.add(hemi);
    
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 3, 2);
    scene.add(dir);
    
    const ballGeometry = new THREE.SphereGeometry(DEFAULT_BALL_RADIUS, 32, 32);
    let ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const previewBall = new THREE.Mesh(ballGeometry, ballMaterial);
    scene.add(previewBall);
    
    let previewCosmetic = null;
    let animationFrame = null;
    let currentPreviewSkin = 'white';
    let previewVideoElement = null;
    let previewVideoTexture = null;
    let previewSvgTexture = null;
    
    const setCosmetic = (cosmeticId) => {
        if (previewCosmetic) {
            scene.remove(previewCosmetic);
            disposeCosmeticMesh(previewCosmetic);
            previewCosmetic = null;
        }
        const mesh = instantiateCosmeticMesh(cosmeticId, DEFAULT_BALL_RADIUS);
        if (mesh) {
            // y=0 is attachment point, position at ball top
            mesh.position.set(0, DEFAULT_BALL_RADIUS, 0);
            scene.add(mesh);
            previewCosmetic = mesh;
        }
    };
    
    const setSkin = (skinId) => {
        currentPreviewSkin = skinId;
        const skin = BALL_SKINS.find(s => s.id === skinId);
        
        // Dispose old video if switching away from video skin
        if (previewVideoElement && skin && !skin.isVideo) {
            previewVideoElement.pause();
            previewVideoElement.src = '';
            previewVideoElement.load();
            previewVideoElement = null;
        }
        if (previewVideoTexture && skin && !skin.isVideo) {
            previewVideoTexture.dispose();
            previewVideoTexture = null;
        }
        
        // Dispose old SVG texture if switching away from SVG skin
        if (previewSvgTexture && skin && !skin.isSvg) {
            previewSvgTexture.dispose();
            previewSvgTexture = null;
        }
        
        // Dispose old material if switching
        if (previewBall.material !== ballMaterial) {
            previewBall.material.dispose();
        }
        
        if (skin && skin.isVideo) {
            // Video texture skin
            if (previewVideoElement) {
                previewVideoElement.pause();
                previewVideoElement.src = '';
                previewVideoElement.load();
            }
            if (previewVideoTexture) {
                previewVideoTexture.dispose();
            }
            
            const video = document.createElement('video');
            video.src = skin.videoPath;
            video.crossOrigin = 'anonymous';
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.autoplay = true;
            
            video.addEventListener('loadeddata', () => {
                video.play().catch(err => {
                    console.warn('Preview video autoplay failed:', err);
                    document.addEventListener('click', () => {
                        video.play().catch(() => {});
                    }, { once: true });
                });
            });
            
            const texture = new THREE.VideoTexture(video);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.format = THREE.RGBAFormat;
            
            previewVideoElement = video;
            previewVideoTexture = texture;
            
            ballMaterial = new THREE.MeshStandardMaterial({
                map: texture,
                emissive: 0x000000,
                emissiveIntensity: 0.2
            });
            previewBall.material = ballMaterial;
        } else if (skin && skin.isSvg) {
            // SVG texture skin
            if (previewSvgTexture) {
                previewSvgTexture.dispose();
            }
            
            // Encode SVG as data URI
            // Create canvas to render SVG
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            
            previewSvgTexture = texture;
            
            ballMaterial = new THREE.MeshStandardMaterial({
                map: texture,
                emissive: 0xffffff,
                emissiveIntensity: 0.3,
                emissiveMap: texture
            });
            previewBall.material = ballMaterial;
            
            // Load SVG into canvas
            const img = new Image();
            const svgBlob = new Blob([skin.svgCode], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = () => {
                ctx.drawImage(img, 0, 0, 512, 512);
                texture.needsUpdate = true;
                URL.revokeObjectURL(url);
            };
            
            img.onerror = () => {
                // Fallback gradient
                const gradient = ctx.createLinearGradient(0, 0, 512, 512);
                gradient.addColorStop(0, '#FF7777');
                gradient.addColorStop(1, '#fdcadb');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 512, 512);
                texture.needsUpdate = true;
                URL.revokeObjectURL(url);
            };
            
            img.src = url;
        } else if (skin && skin.isAnimated) {
            // Animated skin
            ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
            previewBall.material = ballMaterial;
        } else if (skin) {
            // Solid color
            ballMaterial = new THREE.MeshStandardMaterial({ color: skin.color });
            previewBall.material = ballMaterial;
        } else {
            // Default white
            ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
            previewBall.material = ballMaterial;
        }
    };
    
    const animate = () => {
        animationFrame = requestAnimationFrame(animate);
        const time = Date.now() * 0.001;
        
        previewBall.rotation.y += 0.01;
        if (previewCosmetic) {
            previewCosmetic.rotation.y += 0.01;
        }
        
        // Handle animated skins
        if (ballMaterial instanceof THREE.MeshStandardMaterial) {
            if (currentPreviewSkin === 'rainbow') {
                const hue = (time * 0.5) % 1;
                ballMaterial.color.setHSL(hue, 1, 0.5);
            } else if (currentPreviewSkin === 'pulse') {
                const t = (Math.sin(time * 3) + 1) / 2;
                ballMaterial.color.setHSL(0.7 * t, 1, 0.5);
                ballMaterial.emissive.setHSL(0.7 * t, 1, 0.2);
                ballMaterial.emissiveIntensity = 0.5 + 0.5 * t;
            }
        }
        
        renderer.render(scene, camera);
    };
    animate();
    
    const dispose = () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
        ballGeometry.dispose();
        if (previewBall.material) {
            previewBall.material.dispose();
        }
        if (previewVideoElement) {
            previewVideoElement.pause();
            previewVideoElement.src = '';
            previewVideoElement.load();
        }
        if (previewVideoTexture) {
            previewVideoTexture.dispose();
        }
        if (previewSvgTexture) {
            previewSvgTexture.dispose();
        }
        if (previewCosmetic) {
            disposeCosmeticMesh(previewCosmetic);
            previewCosmetic = null;
        }
        if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
        }
    };
    
    return {
        setCosmetic,
        setSkin,
        dispose
    };
}
