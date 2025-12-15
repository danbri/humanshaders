// HumanShaders Web - Skin Material
// Three.js ShaderMaterial wrapper for skin rendering

import * as THREE from 'three';
import skinVertexShader from '../shaders/skin.vert.glsl';
import skinFragmentShader from '../shaders/skin.frag.glsl';

export class SkinMaterial extends THREE.ShaderMaterial {
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

        super({
            vertexShader: skinVertexShader,
            fragmentShader: skinFragmentShader,
            uniforms: {
                // Albedo
                uAlbedo: { value: new THREE.Color(options.albedo || 0xffffff) },
                uAlbedoMap: { value: options.albedoMap || defaultTexture },

                // Normal
                uNormalMap: { value: options.normalMap || defaultNormal },
                uNormalStrength: { value: options.normalStrength ?? 1.0 },

                // Roughness
                uRoughnessMap: { value: options.roughnessMap || defaultTexture },
                uRoughness: { value: options.roughness ?? 0.4 },

                // Metallic
                uMetallic: { value: options.metallic ?? 0.0 },

                // AO
                uAoMap: { value: options.aoMap || defaultTexture },
                uAoStrength: { value: options.aoStrength ?? 0.5 },

                // Micro-detail
                uUseMicroDetail: { value: options.useMicroDetail ?? false },
                uMicroDetailMap: { value: options.microDetailMap || defaultNormal },
                uMicroDetailScale: { value: options.microDetailScale ?? 25.0 },
                uMicroNormalStrength: { value: options.microNormalStrength ?? 0.3 },
                uMicroAoStrength: { value: options.microAoStrength ?? 0.4 },

                // SSS
                uUseSSS: { value: options.useSSS ?? true },
                uSssStrength: { value: options.sssStrength ?? 0.4 },
                uSkinSmoothness: { value: options.skinSmoothness ?? 5.0 },
                uSkinFalloff: { value: options.skinFalloff ?? 1.0 },
                uSssColor: { value: new THREE.Color(options.sssColor || 0xffddcc) },

                // Translucency
                uUseTranslucency: { value: options.useTranslucency ?? false },
                uTranslucencyStrength: { value: options.translucencyStrength ?? 0.75 },
                uTranslucencyMap: { value: options.translucencyMap || defaultTexture },

                // Double specularity
                uDoubleSpecularity: { value: options.doubleSpecularity ?? true },

                // Lighting (will be updated by scene)
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
    set albedo(value) {
        this.uniforms.uAlbedo.value.set(value);
    }

    set albedoMap(value) {
        this.uniforms.uAlbedoMap.value = value;
    }

    set normalMap(value) {
        this.uniforms.uNormalMap.value = value;
    }

    set roughness(value) {
        this.uniforms.uRoughness.value = value;
    }

    set sssStrength(value) {
        this.uniforms.uSssStrength.value = value;
    }

    set useSSS(value) {
        this.uniforms.uUseSSS.value = value;
    }

    set useMicroDetail(value) {
        this.uniforms.uUseMicroDetail.value = value;
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
