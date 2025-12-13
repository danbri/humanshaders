// HumanShaders Web - Main Application
// WebGL port of HumanShaders for iOS/WebKit compatibility

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GUI from 'lil-gui';
import { SkinMaterial } from './materials/SkinMaterial.js';

// Configuration
const CONFIG = {
    // Use Three.js CDN for the Lee Perry-Smith model
    modelUrl: 'https://threejs.org/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb',
    textureBaseUrl: 'https://threejs.org/examples/models/gltf/LeePerrySmith/',
    // Local micro-detail textures
    microDetailUrl: './textures/skin_micro_nrm_ao.png',
};

// Global state
let renderer, scene, camera, controls;
let skinMaterial;
let mainLight, ambientLight;
let gui;
let microDetailTexture = null;

// Texture loader
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();

// Initialize
async function init() {
    // Create renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.getElementById('app').appendChild(renderer.domElement);

    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        35,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.set(0, 0, 3);

    // Create controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controls.target.set(0, 0, 0);

    // Create lights
    mainLight = new THREE.DirectionalLight(0xffffff, 2);
    mainLight.position.set(2, 3, 4);
    scene.add(mainLight);

    ambientLight = new THREE.AmbientLight(0x404050, 0.5);
    scene.add(ambientLight);

    // Add a subtle fill light
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-2, 0, -1);
    scene.add(fillLight);

    // Load model and textures
    await loadHeadModel();

    // Setup GUI
    setupGUI();

    // Hide loading screen
    const loading = document.getElementById('loading');
    loading.classList.add('hidden');

    // Start render loop
    animate();

    // Handle resize
    window.addEventListener('resize', onResize);
}

// Load texture helper
function loadTexture(url, colorSpace = THREE.LinearSRGBColorSpace) {
    return new Promise((resolve) => {
        textureLoader.load(
            url,
            (texture) => {
                texture.colorSpace = colorSpace;
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.flipY = false;
                resolve(texture);
            },
            undefined,
            () => resolve(null)
        );
    });
}

// Load the Lee Perry-Smith head model
async function loadHeadModel() {
    const progressBar = document.getElementById('progress-bar');

    progressBar.style.width = '10%';

    // Load textures in parallel
    const [albedoMap, normalMap, specMap, microDetail] = await Promise.all([
        loadTexture(CONFIG.textureBaseUrl + 'Map-COL.jpg', THREE.SRGBColorSpace),
        loadTexture(CONFIG.textureBaseUrl + 'Infinite-Level_02_Tangent_SmoothUV.jpg'),
        loadTexture(CONFIG.textureBaseUrl + 'Map-SPEC.jpg'),
        loadTexture(CONFIG.microDetailUrl),
    ]);

    microDetailTexture = microDetail;

    progressBar.style.width = '50%';

    // Create skin material with micro-detail enabled
    skinMaterial = new SkinMaterial({
        albedo: 0xffeedd,
        albedoMap: albedoMap,
        normalMap: normalMap,
        roughnessMap: specMap,
        roughness: 0.5,
        normalStrength: 1.0,
        // SSS settings
        useSSS: true,
        sssStrength: 0.4,
        skinSmoothness: 5.0,
        skinFalloff: 1.0,
        sssColor: 0xffccaa,
        doubleSpecularity: true,
        // Micro-detail settings
        useMicroDetail: microDetail !== null,
        microDetailMap: microDetail,
        microDetailScale: 50.0,
        microNormalStrength: 0.3,
        microAoStrength: 0.15,
    });

    progressBar.style.width = '70%';

    // Load GLTF model
    return new Promise((resolve, reject) => {
        gltfLoader.load(
            CONFIG.modelUrl,
            (gltf) => {
                progressBar.style.width = '100%';

                const model = gltf.scene;

                // Find the mesh and apply our material
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.material = skinMaterial;
                        child.material.needsUpdate = true;

                        // Ensure proper tangents for normal mapping
                        if (!child.geometry.attributes.tangent) {
                            child.geometry.computeTangents();
                        }
                    }
                });

                // Center and scale model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2 / maxDim;

                model.scale.setScalar(scale);
                model.position.sub(center.multiplyScalar(scale));
                model.position.y -= 0.2;

                scene.add(model);
                resolve(model);
            },
            (progress) => {
                const percent = 70 + (progress.loaded / progress.total) * 30;
                progressBar.style.width = `${percent}%`;
            },
            reject
        );
    });
}

// Setup GUI controls
function setupGUI() {
    gui = new GUI({ title: 'HumanShaders' });

    // SSS folder
    const sssFolder = gui.addFolder('Subsurface Scattering');
    sssFolder.add(skinMaterial.uniforms.uUseSSS, 'value').name('Enable SSS');
    sssFolder.add(skinMaterial.uniforms.uSssStrength, 'value', 0, 1).name('SSS Strength');
    sssFolder.add(skinMaterial.uniforms.uSkinSmoothness, 'value', 0, 10).name('Skin Smoothness');
    sssFolder.add(skinMaterial.uniforms.uSkinFalloff, 'value', 0.7, 2).name('Skin Falloff');
    sssFolder.addColor({ color: '#ffccaa' }, 'color')
        .name('SSS Color')
        .onChange((value) => {
            skinMaterial.uniforms.uSssColor.value.set(value);
        });
    sssFolder.open();

    // Micro-detail folder
    const microFolder = gui.addFolder('Micro Detail');
    microFolder.add(skinMaterial.uniforms.uUseMicroDetail, 'value').name('Enable');
    microFolder.add(skinMaterial.uniforms.uMicroDetailScale, 'value', 10, 100).name('Scale');
    microFolder.add(skinMaterial.uniforms.uMicroNormalStrength, 'value', 0, 1).name('Normal Strength');
    microFolder.add(skinMaterial.uniforms.uMicroAoStrength, 'value', 0, 1).name('AO Strength');

    // Material folder
    const matFolder = gui.addFolder('Material');
    matFolder.add(skinMaterial.uniforms.uRoughness, 'value', 0, 1).name('Roughness');
    matFolder.add(skinMaterial.uniforms.uNormalStrength, 'value', 0, 2).name('Normal Strength');
    matFolder.add(skinMaterial.uniforms.uDoubleSpecularity, 'value').name('Double Specular');
    matFolder.addColor({ color: '#ffeedd' }, 'color')
        .name('Skin Tint')
        .onChange((value) => {
            skinMaterial.uniforms.uAlbedo.value.set(value);
        });

    // Lighting folder
    const lightFolder = gui.addFolder('Lighting');
    lightFolder.add(mainLight, 'intensity', 0, 5).name('Light Intensity');
    lightFolder.add(mainLight.position, 'x', -5, 5).name('Light X');
    lightFolder.add(mainLight.position, 'y', -5, 5).name('Light Y');
    lightFolder.add(mainLight.position, 'z', -5, 5).name('Light Z');
    lightFolder.addColor({ color: '#ffffff' }, 'color')
        .name('Light Color')
        .onChange((value) => {
            mainLight.color.set(value);
        });

    // Rendering folder
    const renderFolder = gui.addFolder('Rendering');
    renderFolder.add(renderer, 'toneMappingExposure', 0, 2).name('Exposure');

    // Mobile detection - collapse GUI on small screens
    if (window.innerWidth < 768) {
        gui.close();
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    controls.update();

    // Update material lighting
    if (skinMaterial) {
        skinMaterial.updateLighting(mainLight, ambientLight);
    }

    renderer.render(scene, camera);
}

// Handle window resize
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Detect WebGL support
function checkWebGLSupport() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) {
            throw new Error('WebGL not supported');
        }
        return true;
    } catch (e) {
        document.getElementById('loading').innerHTML = `
            <h1>WebGL Not Supported</h1>
            <p>Your browser or device does not support WebGL.</p>
        `;
        return false;
    }
}

// Start
if (checkWebGLSupport()) {
    init().catch((error) => {
        console.error('Failed to initialize:', error);
        document.getElementById('loading').innerHTML = `
            <h1>Error</h1>
            <p>Failed to load: ${error.message}</p>
        `;
    });
}
