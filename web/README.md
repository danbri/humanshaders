# HumanShaders Web

WebGL/WebGPU port of HumanShaders for iOS/WebKit compatibility.

## Features

- **Multi-layer SSS**: Per-channel (R/G/B) wrapped diffuse with different LOD sampling
- **PBR Rendering**: Schlick-GGX specular with double specularity option
- **Micro-detail**: High-frequency normal/AO tiling for pore-level detail
- **Eye Shader**: Parallax iris depth, sclera/iris blending, custom Fresnel
- **iOS Optimized**: Designed for Safari WebGL 2

## Quick Start

```bash
cd web
npm install
npm run dev
```

## Project Structure

```
web/
├── src/
│   ├── main.js              # Application entry point
│   ├── shaders/
│   │   ├── skin.vert.glsl   # Skin vertex shader
│   │   ├── skin.frag.glsl   # Skin fragment shader (multi-layer SSS)
│   │   ├── eye.vert.glsl    # Eye vertex shader
│   │   └── eye.frag.glsl    # Eye fragment shader (parallax)
│   └── materials/
│       ├── SkinMaterial.js  # Three.js skin material wrapper
│       └── EyeMaterial.js   # Three.js eye material wrapper
├── index.html
├── package.json
└── vite.config.js
```

## Key Techniques Ported from Godot

### Multi-layer Normal SSS

The skin shader samples normals at 3 different LOD levels to simulate wavelength-dependent scattering:

```glsl
// Red scatters deepest, blue shallowest
vec3 dn_r = sampleNormalLod(uv, smoothness * 1.0);
vec3 dn_g = sampleNormalLod(uv, smoothness * 0.8);
vec3 dn_b = sampleNormalLod(uv, smoothness * 0.7);

vec3 scatter = vec3(
    smoothstep(0.40, 1.2, wrap(dn_r, light)),
    smoothstep(0.425, 1.2, wrap(dn_g, light)),
    smoothstep(0.44, 1.2, wrap(dn_b, light))
);
```

### Eye Parallax

Iris depth is simulated using parallax mapping with Fresnel-based falloff:

```glsl
vec2 parallaxOffset = viewDirTangent.xy / (viewDirTangent.z * fresnel)
                    * depth * heightScale * 0.01;
irisUv = clamp(irisUv - parallaxOffset, 0.0, 1.0);
```

## Browser Support

| Browser | Support |
|---------|---------|
| Safari (iOS 15+) | WebGL 2 ✓ |
| Safari (iOS 17+) | WebGPU ✓ |
| Chrome | WebGL 2 ✓, WebGPU ✓ |
| Firefox | WebGL 2 ✓ |

## Credits

- Original HumanShaders by [MatMADNESS](https://github.com/matmadness/HumanShaders)
- Lee Perry-Smith head scan (CC BY 3.0)
- Three.js for WebGL abstraction

## Live Demo

https://danbri.github.io/humanshaders/
