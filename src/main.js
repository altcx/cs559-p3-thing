import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// Camera setup
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// OrbitControls for camera interaction
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 20;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
scene.add(directionalLight);

// Ground plane
const groundGeometry = new THREE.PlaneGeometry(20, 20);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x404040,
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Create a cube
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff6b6b,
    roughness: 0.5,
    metalness: 0.5
});
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(-2, 0.5, 0);
cube.castShadow = true;
scene.add(cube);

// Create a sphere
const sphereGeometry = new THREE.SphereGeometry(0.7, 32, 32);
const sphereMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4ecdc4,
    roughness: 0.3,
    metalness: 0.7
});
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(0, 0.7, 0);
sphere.castShadow = true;
scene.add(sphere);

// Create a cone
const coneGeometry = new THREE.ConeGeometry(0.6, 1.5, 32);
const coneMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffe66d,
    roughness: 0.4,
    metalness: 0.6
});
const cone = new THREE.Mesh(coneGeometry, coneMaterial);
cone.position.set(2, 0.75, 0);
cone.castShadow = true;
scene.add(cone);

// Create a torus
const torusGeometry = new THREE.TorusGeometry(0.6, 0.2, 16, 100);
const torusMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xa8e6cf,
    roughness: 0.4,
    metalness: 0.6
});
const torus = new THREE.Mesh(torusGeometry, torusMaterial);
torus.position.set(0, 0.6, -2);
torus.castShadow = true;
scene.add(torus);

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Rotate objects
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    sphere.rotation.y += 0.005;

    cone.rotation.y += 0.01;

    torus.rotation.x += 0.01;
    torus.rotation.y += 0.005;

    controls.update();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();
