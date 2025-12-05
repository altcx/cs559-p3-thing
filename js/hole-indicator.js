// Hole indicator with shader-based color-changing circle
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';
import { getHolePosition } from './game.js';
import { isMagneticPullActive, getMagneticPullEffect } from './powerup-effects.js';
import { getBallPosition } from './ball.js';

let blackCircle = null;
let colorChangingCircle = null;
let flag = null;
let flagPole = null;
let poleBall = null; // Golden ball on top of pole
let magneticFieldIndicators = []; // Array of circles showing magnetic pull range

// Shader for color-changing circle
const colorChangingShader = {
    uniforms: {
        time: { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float opacity;
        varying vec2 vUv;
        
        void main() {
            // Create a smooth color transition using sine waves
            float hue = mod(time * 0.5, 1.0);
            
            // Convert HSV to RGB for smooth color cycling
            vec3 color;
            float h = hue * 6.0;
            float c = 0.8; // Saturation
            float v = 1.0; // Brightness
            
            int i = int(h);
            float f = h - float(i);
            float p = v * (1.0 - c);
            float q = v * (1.0 - c * f);
            float t = v * (1.0 - c * (1.0 - f));
            
            if (i == 0) color = vec3(v, t, p);
            else if (i == 1) color = vec3(q, v, p);
            else if (i == 2) color = vec3(p, v, t);
            else if (i == 3) color = vec3(p, q, v);
            else if (i == 4) color = vec3(t, p, v);
            else color = vec3(v, p, q);
            
            // Add a subtle pulsing effect
            float pulse = sin(time * 2.0) * 0.1 + 0.9;
            color *= pulse;
            
            gl_FragColor = vec4(color, opacity);
        }
`
};

export function createHoleIndicator(holePosition) {
    const HOLE_RADIUS = 2.0;
    
    // Remove old indicators if they exist
    if (blackCircle) scene.remove(blackCircle);
    if (colorChangingCircle) scene.remove(colorChangingCircle);
    if (flag) scene.remove(flag);
    if (flagPole) scene.remove(flagPole);
    if (poleBall) scene.remove(poleBall);
    cleanupMagneticFieldIndicator(); // Clean up magnetic field indicator
    
    // Create black circle on the ground
    const blackCircleGeometry = new THREE.CircleGeometry(HOLE_RADIUS + 0.2, 32);
    const blackCircleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        side: THREE.DoubleSide
    });
    blackCircle = new THREE.Mesh(blackCircleGeometry, blackCircleMaterial);
    blackCircle.rotation.x = -Math.PI / 2;
    blackCircle.position.set(holePosition.x, 0.01, holePosition.z); // Slightly above ground
    scene.add(blackCircle);
    
    // Create color-changing circle with shader (or basic material in prototype mode)
    const colorCircleGeometry = new THREE.CircleGeometry(HOLE_RADIUS + 0.5, 32);
    const colorCircleMaterial = isFullMode
        ? new THREE.ShaderMaterial({
            uniforms: colorChangingShader.uniforms,
            vertexShader: colorChangingShader.vertexShader,
            fragmentShader: colorChangingShader.fragmentShader,
            transparent: true,
            side: THREE.DoubleSide
        })
        : new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Green in prototype mode
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
    colorChangingCircle = new THREE.Mesh(colorCircleGeometry, colorCircleMaterial);
    colorChangingCircle.rotation.x = -Math.PI / 2;
    colorChangingCircle.position.set(holePosition.x, 0.02, holePosition.z); // Above black circle
    scene.add(colorChangingCircle);
    
    // Only create flag and pole in full mode
    if (isFullMode) {
        // Create flag pole (taller)
        const poleHeight = 7.0; // Increased from 6.0
        const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, poleHeight, 8);
        const poleMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 }); // Brown
        flagPole = new THREE.Mesh(poleGeometry, poleMaterial);
        flagPole.position.set(holePosition.x, poleHeight / 2, holePosition.z);
        scene.add(flagPole);
        
        // Create golden ball on top of pole
        const ballRadius = 0.15;
        const ballGeometry = new THREE.SphereGeometry(ballRadius, 16, 16);
        const ballMaterial = new THREE.MeshBasicMaterial({ color: 0xFFD700 }); // Gold
        poleBall = new THREE.Mesh(ballGeometry, ballMaterial);
        poleBall.position.set(holePosition.x, poleHeight, holePosition.z);
        scene.add(poleBall);
        
        // Create flag with simple fabric physics
        createFlag(holePosition, poleHeight);
    }
}

function createFlag(holePosition, poleHeight) {
    const flagWidth = 2.0; // Increased from 1.5 (slightly larger)
    const flagHeight = 1.3; // Increased from 1.0 (slightly larger)
    const segments = 12; // More segments for smoother animation
    
    // Create flag geometry
    const flagGeometry = new THREE.PlaneGeometry(flagWidth, flagHeight, segments, segments);
    
    // Flag material
    const flagMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFF0000, // Red flag
        side: THREE.DoubleSide,
        transparent: true
    });
    
    flag = new THREE.Mesh(flagGeometry, flagMaterial);
    
    // Position flag at top of pole, offset forward by 50% of flag width to extend outward
    // The flag should start at the pole and extend outward
    flag.position.set(
        holePosition.x, // At pole position (no X offset)
        poleHeight - 0.2 - flagHeight * 0.5, // At top of pole, moved down by 50% of flag height
        holePosition.z - flagWidth * 0.5 // Offset forward by 50% of flag width
    );
    
    // Rotate flag to extend outward from pole (perpendicular to pole)
    flag.rotation.y = Math.PI / 2;
    
    // Store original positions for vertices (for wave animation)
    flag.userData.originalPositions = [];
    flag.userData.time = 0;
    flag.userData.holePosition = holePosition;
    flag.userData.poleHeight = poleHeight;
    flag.userData.flagWidth = flagWidth;
    flag.userData.flagHeight = flagHeight;
    
    const positions = flagGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const pos = new THREE.Vector3().fromBufferAttribute(positions, i);
        flag.userData.originalPositions.push(pos.clone());
    }
    
    scene.add(flag);
}

export function updateHoleIndicator() {
    // Update shader time for color-changing circle
    if (colorChangingCircle && colorChangingCircle.material.uniforms) {
        const time = Date.now() / 1000;
        colorChangingCircle.material.uniforms.time.value = time;
        
        // Enhance proximity effect - intensify glow as ball approaches
        const ballPos = getBallPosition();
        const holePos = getHolePosition();
        const distance = Math.sqrt(
            Math.pow(ballPos.x - holePos.x, 2) +
            Math.pow(ballPos.z - holePos.z, 2)
        );
        
        // Intensity increases as ball gets closer (max at 5 units away)
        const maxProximityDistance = 5.0;
        const proximityFactor = Math.max(0, 1.0 - (distance / maxProximityDistance));
        
        // Scale circle size based on proximity (pulse more when close)
        const baseScale = 1.0;
        const proximityScale = 1.0 + proximityFactor * 0.3; // Up to 30% larger when close
        const pulseScale = Math.sin(time * 3.0) * 0.1 + 1.0; // Continuous pulse
        colorChangingCircle.scale.set(proximityScale * pulseScale, proximityScale * pulseScale, 1.0);
        
        // Increase opacity when close
        if (colorChangingCircle.material.uniforms.opacity === undefined) {
            colorChangingCircle.material.uniforms.opacity = { value: 0.7 };
        }
        colorChangingCircle.material.uniforms.opacity.value = 0.7 + proximityFactor * 0.3; // 0.7 to 1.0
    }
    
    // Update magnetic field indicator visibility
    updateMagneticFieldIndicator();
    
    // Update flag animation (more visible fabric physics)
    if (flag && flag.geometry && flag.userData.originalPositions) {
        const positions = flag.geometry.attributes.position;
        const time = Date.now() / 1000;
        flag.userData.time = time;
        
        // More pronounced wave animation - simulate wind blowing flag
        for (let i = 0; i < positions.count; i++) {
            const originalPos = flag.userData.originalPositions[i];
            const x = originalPos.x; // Position along flag width (0 to flagWidth)
            const y = originalPos.y; // Position along flag height
            
            // Get flag dimensions from userData
            const flagWidth = flag.userData.flagWidth;
            const flagHeight = flag.userData.flagHeight;
            
            // Normalize x to 0-1 range for better wave distribution
            const normalizedX = (x + flagWidth / 2) / flagWidth;
            const normalizedY = (y + flagHeight / 2) / flagHeight;
            
            // Create more visible wave effect
            // Primary wave - stronger at the free end (right side)
            const waveStrength = normalizedX; // Stronger at free end
            const primaryWave = Math.sin(time * 3.0 + normalizedX * 4.0) * waveStrength * 0.4;
            
            // Secondary wave for more complex motion
            const secondaryWave = Math.sin(time * 2.0 + normalizedX * 3.0 + normalizedY * 2.0) * waveStrength * 0.2;
            
            // Vertical wave (flag flapping up and down)
            const verticalWave = Math.sin(time * 2.5 + normalizedX * 3.5) * waveStrength * 0.15;
            
            // Apply waves
            // Z is the direction perpendicular to flag plane (wind direction)
            const newZ = originalPos.z + primaryWave + secondaryWave;
            const newY = originalPos.y + verticalWave;
            
            positions.setZ(i, newZ);
            positions.setY(i, newY);
        }
        
        positions.needsUpdate = true;
        flag.geometry.computeVertexNormals();
    }
}

function updateMagneticFieldIndicator() {
    const isActive = isMagneticPullActive();
    const magneticEffect = getMagneticPullEffect();
    
    if (isActive && magneticEffect) {
        // Create indicators if they don't exist
        if (magneticFieldIndicators.length === 0) {
            console.log('Creating magnetic field indicators with range:', magneticEffect.range);
            createMagneticFieldIndicators(magneticEffect.range);
            console.log('Created', magneticFieldIndicators.length, 'magnetic field circles');
        }
        
        // Update all indicators
        const time = Date.now() / 1000;
        magneticFieldIndicators.forEach((indicator, index) => {
            indicator.visible = true;
            
            // Handle arrows separately
            if (indicator.userData.isArrow) {
                // Pulse arrows
                const pulse = Math.sin(time * 2.0 + indicator.userData.angle) * 0.3 + 0.7;
                if (indicator.material) {
                    indicator.material.opacity = pulse * 0.9;
                }
            } else {
                // Animate circle shrinking
                updateCircleAnimation(indicator, time, index, magneticEffect.range);
            }
        });
    } else {
        // Hide all magnetic field indicators
        magneticFieldIndicators.forEach(indicator => {
            indicator.visible = false;
        });
    }
}

function createMagneticFieldIndicators(range) {
    const holePos = getHolePosition();
    const NUM_CIRCLES = 8; // Increased from 5 to 8 for more visibility
    
    // Create a large base circle showing the full range
    const baseRingThickness = range * 0.15; // Thick base ring
    const baseRingGeometry = new THREE.RingGeometry(range - baseRingThickness, range, 128);
    const baseRingMaterial = new THREE.MeshBasicMaterial({
        color: 0xADD8E6, // Pastel blue
        transparent: true,
        opacity: 0.9, // Very visible
        side: THREE.DoubleSide
    });
    const baseCircle = new THREE.Mesh(baseRingGeometry, baseRingMaterial);
    baseCircle.rotation.x = -Math.PI / 2;
    baseCircle.position.set(holePos.x, 0.1, holePos.z); // Higher above ground
    baseCircle.userData.isBaseRing = true;
    scene.add(baseCircle);
    magneticFieldIndicators.push(baseCircle);
    
    // Create multiple animated circles that will shrink inward
    for (let i = 0; i < NUM_CIRCLES; i++) {
        // Create much thicker rings for better visibility
        const ringThickness = range * 0.4; // 40% of radius thickness (much thicker!)
        const innerRadius = range - ringThickness;
        const outerRadius = range;
        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 128);
        
        // Create a bright, glowing pastel blue material
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xADD8E6, // Pastel blue
            transparent: true,
            opacity: 1.0, // Fully opaque
            side: THREE.DoubleSide
        });
        
        const circle = new THREE.Mesh(ringGeometry, ringMaterial);
        circle.rotation.x = -Math.PI / 2; // Lay flat on ground
        circle.position.set(holePos.x, 0.1 + i * 0.01, holePos.z); // Higher above ground, stacked
        circle.userData.originalRadius = range;
        circle.userData.circleIndex = i;
        circle.userData.startTime = Date.now() / 1000 - (i * 0.4); // Stagger start times
        
        scene.add(circle);
        magneticFieldIndicators.push(circle);
    }
    
    // Create inner glow circle for extra visibility
    const innerGlowGeometry = new THREE.CircleGeometry(range * 0.3, 64);
    const innerGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xADD8E6, // Pastel blue
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
    innerGlow.rotation.x = -Math.PI / 2;
    innerGlow.position.set(holePos.x, 0.12, holePos.z);
    innerGlow.userData.isInnerGlow = true;
    scene.add(innerGlow);
    magneticFieldIndicators.push(innerGlow);
    
    // Create directional arrows/lines pointing toward the hole for extra visibility
    const numArrows = 16; // Number of arrows around the circle
    for (let i = 0; i < numArrows; i++) {
        const angle = (i / numArrows) * Math.PI * 2;
        const arrowDistance = range * 0.7; // Position arrows at 70% of range
        
        // Create arrow line pointing toward center
        const arrowLength = range * 0.2;
        const arrowGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(
                Math.cos(angle) * arrowDistance,
                0.15,
                Math.sin(angle) * arrowDistance
            ),
            new THREE.Vector3(
                Math.cos(angle) * (arrowDistance - arrowLength),
                0.15,
                Math.sin(angle) * (arrowDistance - arrowLength)
            )
        ]);
        
        const arrowMaterial = new THREE.LineBasicMaterial({
            color: 0xADD8E6, // Pastel blue
            transparent: true,
            opacity: 0.9,
            linewidth: 3
        });
        
        const arrow = new THREE.Line(arrowGeometry, arrowMaterial);
        arrow.position.set(holePos.x, 0, holePos.z);
        arrow.userData.isArrow = true;
        arrow.userData.angle = angle;
        scene.add(arrow);
        magneticFieldIndicators.push(arrow);
    }
}

function updateCircleAnimation(circle, time, index, maxRadius) {
    // Handle base ring - pulsing effect
    if (circle.userData.isBaseRing) {
        const pulse = Math.sin(time * 2.0) * 0.2 + 0.8; // Pulse between 0.6 and 1.0
        if (circle.material) {
            circle.material.opacity = pulse * 0.9;
        }
        // Slight scale pulse
        const scalePulse = Math.sin(time * 2.0) * 0.05 + 1.0;
        circle.scale.set(scalePulse, scalePulse, 1.0);
        return;
    }
    
    // Handle inner glow - pulsing effect
    if (circle.userData.isInnerGlow) {
        const pulse = Math.sin(time * 3.0) * 0.3 + 0.7; // Pulse between 0.4 and 1.0
        if (circle.material) {
            circle.material.opacity = pulse * 0.6;
        }
        const scalePulse = Math.sin(time * 3.0) * 0.1 + 1.0;
        circle.scale.set(scalePulse, scalePulse, 1.0);
        return;
    }
    
    // Animate animated circles by scaling down (shrinking effect)
    const cycleDuration = 2.5; // Faster cycle for more visible effect
    const elapsed = time - circle.userData.startTime;
    const cycleTime = elapsed % cycleDuration;
    const progress = cycleTime / cycleDuration; // 0 to 1
    
    // Scale from max radius down to center (scale from 1.0 to 0.0)
    const scale = 1.0 - progress;
    
    // Fade out as it shrinks, but keep it more visible
    const fade = scale;
    
    // Update scale
    circle.scale.set(scale, scale, 1.0);
    
    // Update opacity - keep it brighter
    if (circle.material) {
        circle.material.opacity = fade * 1.0; // Fully opaque when visible
    }
}

export function cleanupMagneticFieldIndicator() {
    magneticFieldIndicators.forEach(indicator => {
        scene.remove(indicator);
        indicator.geometry?.dispose();
        indicator.material?.dispose();
    });
    magneticFieldIndicators = [];
}

// Remove all hole indicator objects (for mode switching)
export function removeHoleIndicator() {
    console.log('HOLE-INDICATOR: Removing all hole indicator objects');
    
    // Remove black circle
    if (blackCircle) {
        scene.remove(blackCircle);
        blackCircle.geometry?.dispose();
        blackCircle.material?.dispose();
        blackCircle = null;
    }
    
    // Remove color changing circle
    if (colorChangingCircle) {
        scene.remove(colorChangingCircle);
        colorChangingCircle.geometry?.dispose();
        colorChangingCircle.material?.dispose();
        colorChangingCircle = null;
    }
    
    // Remove flag
    if (flag) {
        scene.remove(flag);
        flag.geometry?.dispose();
        flag.material?.dispose();
        flag = null;
    }
    
    // Remove flag pole
    if (flagPole) {
        scene.remove(flagPole);
        flagPole.geometry?.dispose();
        flagPole.material?.dispose();
        flagPole = null;
    }
    
    // Remove pole ball
    if (poleBall) {
        scene.remove(poleBall);
        poleBall.geometry?.dispose();
        poleBall.material?.dispose();
        poleBall = null;
    }
    
    // Remove magnetic field indicators
    cleanupMagneticFieldIndicator();
    
    console.log('HOLE-INDICATOR: All hole indicator objects removed');
}
