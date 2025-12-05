// Teleporter system - colored squares that teleport the ball
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';

let teleporters = [];
let lastTeleportedDestinationId = null; // Track which teleporter we teleported TO (to prevent going back)
let teleportCooldown = 0; // Cooldown timer to prevent immediate re-teleportation

// Color palette for teleporter pairs
const TELEPORTER_COLORS = [
    0xff0000, // Red
    0x00ff00, // Green
    0x0000ff, // Blue
    0xffff00, // Yellow
    0xff00ff, // Magenta
    0x00ffff, // Cyan
    0xff8800, // Orange
    0x8800ff, // Purple
];

let colorIndex = 0;

export function createTeleporter(config) {
    const {
        position,              // THREE.Vector3 position
        pairId = 0,           // ID to match with paired teleporter
        size = 4.0,          // Size of the teleporter square (increased from 2.0)
        color = null          // Optional color override
    } = config;

    // Use provided color or assign from palette based on pairId
    const teleporterColor = color !== null ? color : TELEPORTER_COLORS[pairId % TELEPORTER_COLORS.length];

    const teleporterGroup = new THREE.Group();
    teleporterGroup.position.set(position.x, 0.01, position.z); // Slightly above ground
    
    // Create visual indicator (colored square) - animated shader effect
    const squareGeometry = new THREE.PlaneGeometry(size, size);
    const vertexShader = `
        varying vec2 vUv;
        uniform float time;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform vec3 color;
        uniform float time;
        uniform float opacity;
        varying vec2 vUv;

        void main() {
            // Create animated pulsing effect
            float pulse = sin(time * 3.0) * 0.3 + 0.7;
            float wave = sin(vUv.x * 10.0 + time * 2.0) * sin(vUv.y * 10.0 + time * 2.0) * 0.1;

            // Create border effect
            float border = 1.0 - smoothstep(0.1, 0.2, length(vUv - vec2(0.5)));
            border += 1.0 - smoothstep(0.45, 0.5, length(vUv - vec2(0.5)));

            vec3 finalColor = color * (pulse + wave + border * 0.5);
            gl_FragColor = vec4(finalColor, opacity * (0.8 + pulse * 0.2));
        }
    `;

    const squareMaterial = isFullMode
        ? new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(teleporterColor) },
                time: { value: 0 },
                opacity: { value: 0.9 }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            emissive: teleporterColor,
            emissiveIntensity: 0.3
        })
        : new THREE.MeshBasicMaterial({
            color: teleporterColor,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
    const square = new THREE.Mesh(squareGeometry, squareMaterial);
    square.rotation.x = -Math.PI / 2; // Lay flat on ground
    square.receiveShadow = false;
    teleporterGroup.add(square);
    
    // Create border/outline for better visibility
    const borderGeometry = new THREE.RingGeometry(size * 0.45, size * 0.5, 4);
    const borderMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({
            color: teleporterColor,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            emissive: teleporterColor,
            emissiveIntensity: 1.0
        })
        : new THREE.MeshBasicMaterial({
            color: teleporterColor,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.001; // Slightly above the square
    teleporterGroup.add(border);
    
    // Store teleporter data
    teleporterGroup.userData.isTeleporter = true;
    teleporterGroup.userData.position = position.clone();
    teleporterGroup.userData.pairId = pairId;
    teleporterGroup.userData.size = size;
    teleporterGroup.userData.color = teleporterColor;
    teleporterGroup.userData.square = square;
    teleporterGroup.userData.border = border;
    teleporterGroup.userData.startTime = Date.now() / 1000; // For animation

    scene.add(teleporterGroup);
    teleporters.push(teleporterGroup);

    return teleporterGroup;
}

export function getTeleporters() {
    return teleporters;
}

export function removeAllTeleporters() {
    teleporters.forEach(teleporter => {
        scene.remove(teleporter);
        // Dispose geometries and materials
        if (teleporter.userData.square) {
            teleporter.userData.square.geometry.dispose();
            teleporter.userData.square.material.dispose();
        }
        if (teleporter.userData.border) {
            teleporter.userData.border.geometry.dispose();
            teleporter.userData.border.material.dispose();
        }
    });
    teleporters = [];
}

export function removeTeleportersByPairId(pairId) {
    const teleportersToRemove = teleporters.filter(teleporter => teleporter.userData.pairId === pairId);
    teleportersToRemove.forEach(teleporter => {
        scene.remove(teleporter);
        // Dispose geometries and materials
        if (teleporter.userData.square) {
            teleporter.userData.square.geometry.dispose();
            teleporter.userData.square.material.dispose();
        }
        if (teleporter.userData.border) {
            teleporter.userData.border.geometry.dispose();
            teleporter.userData.border.material.dispose();
        }
        // Remove from the array
        const index = teleporters.indexOf(teleporter);
        if (index > -1) {
            teleporters.splice(index, 1);
        }
    });
}

// Create a one-way teleporter that sends ball to a specific destination (no return)
export function createOneWayTeleporter(position, destination, color = 0x00ff00) {
    // Validate inputs
    if (!position || !destination) {
        console.error('createOneWayTeleporter: position or destination is null', { position, destination });
        return null;
    }
    
    const teleporterGroup = new THREE.Group();
    teleporterGroup.position.set(position.x, 0.01, position.z); // Slightly above ground
    
    // Create visual indicator (colored square) - animated shader effect
    const squareGeometry = new THREE.PlaneGeometry(4.0, 4.0);
    const vertexShader = `
        varying vec2 vUv;
        uniform float time;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform vec3 color;
        uniform float time;
        uniform float opacity;
        varying vec2 vUv;

        void main() {
            // Create animated pulsing effect
            float pulse = sin(time * 3.0) * 0.3 + 0.7;
            float wave = sin(vUv.x * 10.0 + time * 2.0) * sin(vUv.y * 10.0 + time * 2.0) * 0.1;

            // Create border effect
            float border = 1.0 - smoothstep(0.1, 0.2, length(vUv - vec2(0.5)));
            border += 1.0 - smoothstep(0.45, 0.5, length(vUv - vec2(0.5)));

            vec3 finalColor = color * (pulse + wave + border * 0.5);
            gl_FragColor = vec4(finalColor, opacity * (0.8 + pulse * 0.2));
        }
    `;

    const squareMaterial = isFullMode
        ? new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(color) },
                time: { value: 0 },
                opacity: { value: 0.9 }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            emissive: color,
            emissiveIntensity: 0.3
        })
        : new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
    const square = new THREE.Mesh(squareGeometry, squareMaterial);
    square.rotation.x = -Math.PI / 2; // Lay flat on ground
    square.receiveShadow = false;
    teleporterGroup.add(square);
    
    // Create border/outline for better visibility
    const borderGeometry = new THREE.RingGeometry(4.0 * 0.45, 4.0 * 0.5, 4);
    const borderMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            emissive: color,
            emissiveIntensity: 1.0
        })
        : new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.001; // Slightly above the square
    teleporterGroup.add(border);
    
    // Store teleporter data - mark as one-way
    teleporterGroup.userData.isTeleporter = true;
    teleporterGroup.userData.isOneWay = true; // Mark as one-way
    teleporterGroup.userData.position = position.clone();
    teleporterGroup.userData.destination = destination.clone(); // Store destination directly
    teleporterGroup.userData.size = 4.0;
    teleporterGroup.userData.color = color;
    teleporterGroup.userData.square = square;
    teleporterGroup.userData.border = border;
    teleporterGroup.userData.startTime = Date.now() / 1000; // For animation

    scene.add(teleporterGroup);
    teleporters.push(teleporterGroup);

    return teleporterGroup;
}

export function updateTeleporterCooldown(deltaTime) {
    if (teleportCooldown > 0) {
        teleportCooldown -= deltaTime;
        if (teleportCooldown <= 0) {
            teleportCooldown = 0;
            // Note: We don't reset lastTeleportedDestinationId here
            // Teleporters are permanently one-way - once you teleport from A to B,
            // you can never teleport from B back to A
        }
    }
}

// Update teleporter animations
export function updateTeleporterAnimations(deltaTime) {
    teleporters.forEach(teleporter => {
        if (teleporter.userData.square && teleporter.userData.square.material.uniforms) {
            // Update time uniform for animation
            teleporter.userData.square.material.uniforms.time.value += deltaTime;
        }
    });
}

export function resetTeleporterState() {
    // Reset teleporter state when starting a new hole/level
    lastTeleportedDestinationId = null;
    teleportCooldown = 0;
}

export function checkTeleporterCollision(ballPosition, ballRadius = 0.5) {
    for (const teleporter of teleporters) {
        const teleporterPos = teleporter.userData.position;
        const teleporterSize = teleporter.userData.size;

        // Check if ball is within teleporter bounds (square collision)
        const halfSize = teleporterSize / 2;
        const dx = Math.abs(ballPosition.x - teleporterPos.x);
        const dz = Math.abs(ballPosition.z - teleporterPos.z);

        if (dx < halfSize + ballRadius && dz < halfSize + ballRadius) {
            // Check if this is a one-way teleporter (spawned after cutscene)
            if (teleporter.userData.isOneWay && teleporter.userData.destination) {
                // One-way teleporter - send directly to destination
                teleportCooldown = 0.5;
                return {
                    teleported: true,
                    destination: teleporter.userData.destination.clone(),
                    sourceTeleporter: teleporter,
                    destTeleporter: null,
                    pairId: -1, // Special ID for one-way
                    isYellowPortal: false
                };
            }
            
            // Ball is on teleporter, find paired teleporter
            const pairId = teleporter.userData.pairId;

            // Prevent teleporting back (one-way teleporters)
            // If we're on the teleporter we just teleported TO, don't allow teleporting back
            if (lastTeleportedDestinationId === teleporter) {
                continue; // Skip this teleporter - can't go back
            }

            const pairedTeleporter = teleporters.find(t =>
                t.userData.pairId === pairId && t !== teleporter
            );

            if (pairedTeleporter) {
                // Set cooldown and track which teleporter we teleported TO
                teleportCooldown = 0.5; // 0.5 second cooldown
                lastTeleportedDestinationId = pairedTeleporter; // Remember the destination

                // Check if this is the yellow portal (pairId 3) - triggers special cutscene
                const isYellowPortal = pairId === 3;

                // Return the destination position - will trigger ball respawn
                return {
                    teleported: true,
                    destination: pairedTeleporter.userData.position.clone(),
                    sourceTeleporter: teleporter,
                    destTeleporter: pairedTeleporter,
                    pairId: pairId,
                    isYellowPortal: isYellowPortal
                };
            }
        }
    }

    return { teleported: false };
}

// Function to handle ball teleportation by respawning at destination
