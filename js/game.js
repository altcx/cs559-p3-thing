// Game // Game state, win conditions, and scoring
import * as THREE from 'three';
import { scene, isFullMode } from './main.js';
import { getBallPosition, getBallVelocity, resetBall } from './ball.js';

const BALL_RADIUS = 0.5;
export const HOLE_RADIUS = 2.0; // Doubled from 1.0 (exported for use in hole-indicator.js)
const HOLE_DEPTH = 1.5; // Deeper hole
let HOLE_POSITION = new THREE.Vector3(0, 0, 20); // Center of course, towards bottom (updated for 50x50 course)

export function setHolePosition(position) {
    HOLE_POSITION.copy(position);
}

export function getHolePosition() {
    return HOLE_POSITION.clone();
}

let holeMesh = null;
let flagMesh = null;
let chamfer = null;
let indicatorRing = null; // Color-changing ring around hole
let strokeCount = 0;
let par = 3; // Default par for the hole
let isHoleComplete = false;
let holeScores = []; // Array of scores for each hole [{hole: 0, strokes: 3, par: 3, relativeScore: 0}, ...]
let totalScore = 0; // Total score (sum of relative scores - lower is better in golf)

export async function createHole() {
    // Create hole as a deep cylinder going down into the ground
    // Make it deeper and wider to ensure ball can fall in
    // Use BackSide material like inspiration code to avoid collision issues
    const holeGeometry = new THREE.CylinderGeometry(HOLE_RADIUS, HOLE_RADIUS, HOLE_DEPTH * 2, 32);
    const holeMaterial = isFullMode
        ? new THREE.MeshStandardMaterial({ color: 0x000000, side: THREE.BackSide }) // Black, back side only
        : new THREE.MeshStandardMaterial({ color: 0x000000, side: THREE.BackSide }); // Black, back side only
    
    holeMesh = new THREE.Mesh(holeGeometry, holeMaterial);
    // Position so the top of the cylinder is at ground level (y = 0)
    holeMesh.position.set(HOLE_POSITION.x, -HOLE_DEPTH, HOLE_POSITION.z);
    holeMesh.receiveShadow = true;
    scene.add(holeMesh);
    
    // Create chamfered edge (beveled rim) around the hole
    // Use a torus positioned at ground level for chamfered effect
    const chamferRadius = HOLE_RADIUS + 0.3; // Slightly larger than hole for chamfer
    const chamferTubeRadius = 0.2; // Width of the chamfer
    const chamferGeometry = new THREE.TorusGeometry(chamferRadius, chamferTubeRadius, 16, 32);
    const chamferMaterial = isFullMode
        ? new THREE.MeshBasicMaterial({ color: 0x8B4513 }) // Brown for full mode
        : new THREE.MeshBasicMaterial({ color: 0xFF6347 }); // Red for prototype
    
    chamfer = new THREE.Mesh(chamferGeometry, chamferMaterial);
    // Position at ground level for chamfered effect
    chamfer.position.set(HOLE_POSITION.x, 0, HOLE_POSITION.z);
    chamfer.rotation.x = Math.PI / 2; // Rotate to be horizontal
    scene.add(chamfer);
    
    // Create hole indicator (black circle, color-changing circle with shader, and flag)
    const { createHoleIndicator } = await import('./hole-indicator.js');
    createHoleIndicator(HOLE_POSITION);
    
    return { holeMesh, chamfer, indicatorRing: null };
}

export function checkWinCondition() {
    if (isHoleComplete) return false;
    
    const ballPos = getBallPosition();
    const ballVel = getBallVelocity();
    const holePos = getHolePosition();
    
    // Check if ball is near hole (horizontal distance)
    const horizontalDistance = Math.sqrt(
        Math.pow(ballPos.x - holePos.x, 2) +
        Math.pow(ballPos.z - holePos.z, 2)
    );
    
    // Ball must be:
    // 1. Within hole radius (horizontally) - exact size
    // 2. Below ground level (fallen into hole) - deep enough
    // 3. Either moving slowly OR deep enough in hole (velocity check relaxed)
    const isDeepEnough = ballPos.y < -0.5; // Ball has fallen deep into hole
    const isInHole = horizontalDistance < HOLE_RADIUS && // Exact hole size
        isDeepEnough && // Ball has fallen below ground level
        (ballVel.length() < 5.0 || ballPos.y < -1.0); // Relaxed velocity check OR very deep
    
    // Debug logging
    if (horizontalDistance < HOLE_RADIUS * 1.5) {
        // Only log when close to hole to avoid spam
        console.log('Ball near hole:', {
            horizontalDistance: horizontalDistance.toFixed(2),
            ballY: ballPos.y.toFixed(2),
            velocity: ballVel.length().toFixed(2),
            isInHole: isInHole
        });
    }
    
    if (isInHole) {
        isHoleComplete = true;
        console.log('WIN CONDITION MET! Ball at:', ballPos, 'Hole at:', holePos, 'Distance:', horizontalDistance);
        return true;
    }
    
    return false;
}

export function incrementStroke() {
    strokeCount++;
    return strokeCount;
}

export function getStrokeCount() {
    return strokeCount;
}

export function getPar() {
    return par;
}

export function setPar(newPar) {
    par = newPar;
}

export function calculateRating() {
    const diff = strokeCount - par;
    
    if (strokeCount === 1) return 'HOLE_IN_ONE';
    if (diff <= -2) return 'EAGLE';
    if (diff === -1) return 'BIRDIE';
    if (diff === 0) return 'PAR';
    if (diff === 1) return 'BOGEY';
    return 'DOUBLE_BOGEY';
}

export function resetHole() {
    strokeCount = 0;
    isHoleComplete = false;
    resetBall();
}

export function getTotalScore() {
    return totalScore;
}

export function getHoleScores() {
    return holeScores;
}

export function addHoleScore(strokes, holePar) {
    const relativeScore = strokes - holePar; // Positive = over par, negative = under par
    const holeScore = {
        hole: holeScores.length,
        strokes: strokes,
        par: holePar,
        relativeScore: relativeScore
    };
    holeScores.push(holeScore);
    
    // Recalculate total score (sum of relative scores)
    totalScore = holeScores.reduce((sum, score) => sum + score.relativeScore, 0);
    
    return holeScore;
}

export function resetTotalScore() {
    totalScore = 0;
    holeScores = [];
}

export function isComplete() {
    return isHoleComplete;
}

