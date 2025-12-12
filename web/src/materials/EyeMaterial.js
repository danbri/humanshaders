// HumanShaders Web - Eye Material
// Three.js ShaderMaterial wrapper for eye rendering

import * as THREE from 'three';
import eyeVertexShader from '../shaders/eye.vert.glsl';
import eyeFragmentShader from '../shaders/eye.frag.glsl';

export class EyeMaterial extends THREE.ShaderMaterial {
    constructor(options = {}) {
        const defaultTexture = new THREE.DataTexture(
            new Uint8Array([255, 255, 255, 255]),
            1, 1,
            THREE.RGBAFormat
        );
        defaultTexture.needsUpdate = true;

        const defaultNormal = new THREE.DataTexture(
            new Uint8Array([128, 128, 255, 255]),
            1, 1,
            THREE.RGBAFormat
        );
        defaultNormal.needsUpdate = true;

        const defaultHeight = new THREE.DataTexture(
            new Uint8Array([0, 0, 0, 255]),
            1, 1,
            THREE.RGBAFormat
        );
        defaultHeight.needsUpdate = true;

        super({
            vertexShader: eyeVertexShader,
            fragmentShader: eyeFragmentShader,
            uniforms: {
                // Sclera
                uScleraColor: { value: new THREE.Color(options.scleraColor || 0xffffff) },
                uScleraAlbedoMap: { value: options.scleraAlbedoMap || defaultTexture },
                uScleraNormalMap: { value: options.scleraNormalMap || defaultNormal },

                // Iris
                uIrisColor: { value: new THREE.Color(options.irisColor || 0xffffff) },
                uIrisAlbedoMap: { value: options.irisAlbedoMap || defaultTexture },
                uIrisNormalMap: { value: options.irisNormalMap || defaultNormal },
                uIrisHeightMap: { value: options.irisHeightMap || defaultHeight },

                // Parameters
                uIrisScale: { value: options.irisScale ?? 2.5 },
                uHeightmapScale: { value: options.heightmapScale ?? 32.0 },
                uUseParallax: { value: options.useParallax ?? true },
                uRoughness: { value: options.roughness ?? 0.1 },
                uSpecular: { value: options.specular ?? 0.5 },
                uNormalStrength: { value: options.normalStrength ?? 1.0 },

                // SSS
                uUseSSS: { value: options.useSSS ?? true },
                uSssStrength: { value: options.sssStrength ?? 0.4 },

                // Lighting
                uLightPosition: { value: new THREE.Vector3(5, 5, 5) },
                uLightColor: { value: new THREE.Color(0xffffff) },
                uLightIntensity: { value: 2.0 },
                uAmbientColor: { value: new THREE.Color(0x404040) },
            },
            lights: false,
            side: THREE.FrontSide,
        });

        this.extensions.derivatives = true;
    }

    // Convenience setters
    set irisScale(value) {
        this.uniforms.uIrisScale.value = value;
    }

    set useParallax(value) {
        this.uniforms.uUseParallax.value = value;
    }

    set roughness(value) {
        this.uniforms.uRoughness.value = value;
    }

    // Update lighting from scene
    updateLighting(light, ambient) {
        if (light) {
            this.uniforms.uLightPosition.value.copy(light.position);
            this.uniforms.uLightColor.value.copy(light.color);
            this.uniforms.uLightIntensity.value = light.intensity;
        }
        if (ambient) {
            this.uniforms.uAmbientColor.value.copy(ambient.color);
        }
    }
}
