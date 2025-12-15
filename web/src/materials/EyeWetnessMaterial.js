// HumanShaders Web - Eye Wetness Material
// Three.js ShaderMaterial for wet eye surface effect

import * as THREE from 'three';
import eyeWetnessVertexShader from '../shaders/eyeWetness.vert.glsl';
import eyeWetnessFragmentShader from '../shaders/eyeWetness.frag.glsl';

export class EyeWetnessMaterial extends THREE.ShaderMaterial {
    constructor(options = {}) {
        const defaultTexture = new THREE.DataTexture(
            new Uint8Array([255, 255, 255, 255]),
            1, 1,
            THREE.RGBAFormat
        );
        defaultTexture.needsUpdate = true;

        super({
            vertexShader: eyeWetnessVertexShader,
            fragmentShader: eyeWetnessFragmentShader,
            uniforms: {
                uScreenTexture: { value: options.screenTexture || null },
                uResolution: { value: new THREE.Vector2(
                    options.resolution?.x || window.innerWidth,
                    options.resolution?.y || window.innerHeight
                )},
                uRoughness: { value: options.roughness ?? 0.2 },
                uShadow: { value: options.shadow ?? 0.4 },
                uShadowColor: { value: new THREE.Color(options.shadowColor || 0xffffff) },
                uUseMicroDetail: { value: options.useMicroDetail ?? false },
                uMicroDetailMap: { value: options.microDetailMap || defaultTexture },
                uMicroDetailSize: { value: options.microDetailSize ?? 25.0 },
            },
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            side: THREE.FrontSide,
        });
    }

    // Update resolution on window resize
    setResolution(width, height) {
        this.uniforms.uResolution.value.set(width, height);
    }

    // Set screen texture from render target
    setScreenTexture(texture) {
        this.uniforms.uScreenTexture.value = texture;
    }

    set roughness(value) {
        this.uniforms.uRoughness.value = value;
    }

    set shadow(value) {
        this.uniforms.uShadow.value = value;
    }
}
