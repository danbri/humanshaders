# Web/iOS Compatibility Study for HumanShaders

## Executive Summary

This document analyzes the HumanShaders Godot project with the goal of creating a web-based (WebGL/WebGPU) version that is iOS/WebKit-friendly. The project contains sophisticated real-time rendering shaders for realistic human skin, eyes, and eye wetness effects.

---

## 1. Current Architecture Analysis

### 1.1 Rendering Features Used

| Feature | Skin Shader | Eye Shader | Eye Wetness | WebGL 2 | WebGPU |
|---------|-------------|------------|-------------|---------|--------|
| PBR (GGX/Schlick) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Subsurface Scattering | ✓ (custom) | ✓ (simple) | - | ⚠️ | ✓ |
| Parallax Mapping | - | ✓ | - | ✓ | ✓ |
| Custom Light Function | ✓ | ✓ | - | ⚠️ | ✓ |
| Screen Texture Sampling | - | - | ✓ | ✓ | ✓ |
| Multi-layer Normal Blending | ✓ | ✓ | - | ✓ | ✓ |
| Fresnel Effects | ✓ | ✓ | - | ✓ | ✓ |
| Texture LOD Sampling | ✓ | ✓ | ✓ | ✓ | ✓ |

### 1.2 Shader Complexity Breakdown

#### Skin Shader (`skin_shader.gdshader`) - 323 lines
- **Uniforms**: 25+ parameters (textures + scalars)
- **Key Techniques**:
  - Burley diffuse BRDF
  - Schlick-GGX specular BRDF
  - Multi-layer wrapped diffuse for SSS approximation
  - Micro-detail normal/AO blending
  - Translucency with color gradient lookup
  - Double specularity option
  - Custom `light()` function with per-light processing

#### Eye Shader (`eye_shader.gdshader`) - 177 lines
- **Uniforms**: 15+ parameters
- **Key Techniques**:
  - Parallax mapping for iris depth (conditional - disabled in Compatibility Renderer)
  - Dual-texture system (sclera + iris)
  - Custom Fresnel calculation
  - SSS for sclera translucency

#### Eye Wetness (`vshader_eye_wetness.tres`) - ~250 lines generated
- **Technique**: Screen texture blur with micro-detail overlay
- **Approach**: Emission-based wet surface effect

---

## 2. iOS/WebKit Constraints & Considerations

### 2.1 WebGL on iOS Safari

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| **WebGL 2 Support** | Full support since iOS 15+ | Target WebGL 2 minimum |
| **Max Texture Units** | 16 (vs 32 on desktop) | Combine textures into atlases |
| **Max Uniforms** | ~1024 vectors | May need to reduce uniform count |
| **Shader Precision** | `highp` may not be available in fragment | Use `mediump` where possible |
| **Power/Thermal Throttling** | GPU downclocks under load | Optimize for mobile frame budgets |
| **Memory Limits** | ~256MB GPU memory typical | Use compressed textures (ASTC) |
| **No Compute Shaders** | WebGL 2 limitation | Pre-compute on CPU or bake |

### 2.2 WebGPU on iOS Safari

| Status | Notes |
|--------|-------|
| **Availability** | Supported in Safari 17+ (iOS 17+) |
| **Compute Shaders** | ✓ Available |
| **Storage Buffers** | ✓ Available |
| **WGSL Shaders** | Required (not GLSL) |
| **Performance** | Significantly better than WebGL |

### 2.3 Critical iOS-Specific Issues

1. **Derivative Functions**: `dFdx`/`dFdy` can be slow or imprecise
2. **Dependent Texture Reads**: Performance penalty for UV manipulation before sampling
3. **Branching**: Avoid divergent branches in fragment shaders
4. **Loop Unrolling**: iOS GPU prefers unrolled loops

---

## 3. Porting Strategy

### 3.1 Recommended Approach: Three.js with Custom Shaders

**Why Three.js:**
- Mature WebGL/WebGPU abstraction
- Excellent iOS Safari compatibility testing
- Large ecosystem and documentation
- Built-in PBR materials as baseline
- Easy integration of custom shaders

### 3.2 Alternative Frameworks

| Framework | Pros | Cons |
|-----------|------|------|
| **Babylon.js** | PBR focused, good SSS support | Larger bundle size |
| **PlayCanvas** | Good mobile optimization | Requires engine buy-in |
| **Raw WebGL/WebGPU** | Maximum control | Significant development time |
| **Godot Web Export** | Direct port | Limited iOS WebGL performance |

### 3.3 Phased Implementation Plan

#### Phase 1: Core PBR Foundation
```
Tasks:
├── Set up Three.js project with WebGL 2 renderer
├── Implement basic PBR material (GGX + Schlick-Fresnel)
├── Port normal mapping with strength control
├── Add roughness/metallic texture support
├── Test on iOS Safari
```

#### Phase 2: Skin Shader
```
Tasks:
├── Port wrapped diffuse SSS approximation
├── Implement multi-layer normal LOD sampling
├── Add micro-detail normal/AO blending
├── Port translucency system
├── Implement double specularity
├── Optimize for mobile performance
```

#### Phase 3: Eye Shader
```
Tasks:
├── Port iris/sclera dual-texture system
├── Implement parallax mapping (with mobile fallback)
├── Port custom Fresnel effect
├── Add SSS for sclera
```

#### Phase 4: Eye Wetness & Polish
```
Tasks:
├── Implement screen-space wet effect
├── Add post-processing (optional)
├── Performance profiling on iOS devices
├── LOD system for mobile
```

---

## 4. Technical Porting Details

### 4.1 Godot to GLSL/WGSL Mapping

| Godot Shader | GLSL (WebGL 2) | WGSL (WebGPU) |
|--------------|----------------|---------------|
| `ALBEDO` | `gl_FragColor.rgb` (via MRT) | Output struct |
| `ROUGHNESS` | G-buffer output | Output struct |
| `NORMAL_MAP` | Tangent-space transform | Same |
| `SSS_STRENGTH` | Custom implementation needed | Custom |
| `DIFFUSE_LIGHT` | Accumulator in light loop | Same |
| `SPECULAR_LIGHT` | Accumulator in light loop | Same |
| `LIGHT` / `VIEW` / `NORMAL` | Passed as varying/uniform | Same |
| `textureLod()` | `textureLod()` | `textureSampleLevel()` |

### 4.2 SSS Implementation Options for Web

#### Option A: Screen-Space SSS (Recommended for Quality)
```glsl
// Post-process blur based on SSS strength in G-buffer
// Pros: High quality, physically accurate
// Cons: Requires MRT, extra passes
```

#### Option B: Pre-Integrated Skin Shading (Recommended for Mobile)
```glsl
// Use pre-computed LUT for diffuse scattering
// Based on curvature and N·L
// Pros: Single pass, fast
// Cons: Less accurate
```

#### Option C: Wrapped Diffuse Only (Fallback)
```glsl
// Simple wrapped Lambert with color tinting
float wrap = 0.5;
float NdotL_wrapped = (dot(N, L) + wrap) / (1.0 + wrap);
// Pros: Very fast
// Cons: Least accurate
```

### 4.3 Critical Code Translations

#### Skin Shader - Multi-layer SSS Approximation
```glsl
// Godot original:
vec3 dn_r = custom_normal(textureLod(texture_normal, UV, 1.0*s).rgb);
vec3 dn_g = custom_normal(textureLod(texture_normal, UV, 0.8*s).rgb);
vec3 dn_b = custom_normal(textureLod(texture_normal, UV, 0.7*s).rgb);

// WebGL 2 equivalent:
vec3 dn_r = decodeNormal(textureLod(normalMap, vUv, smoothness * 1.0).rgb);
vec3 dn_g = decodeNormal(textureLod(normalMap, vUv, smoothness * 0.8).rgb);
vec3 dn_b = decodeNormal(textureLod(normalMap, vUv, smoothness * 0.7).rgb);

float wrapped_r = smoothstep(0.4, 1.2, dot(dn_r, lightDir) * 0.5 + 0.5);
float wrapped_g = smoothstep(0.425, 1.2, dot(dn_g, lightDir) * 0.5 + 0.5);
float wrapped_b = smoothstep(0.44, 1.2, dot(dn_b, lightDir) * 0.5 + 0.5);
vec3 sss_diffuse = vec3(wrapped_r, wrapped_g, wrapped_b);
```

#### Eye Shader - Parallax Mapping
```glsl
// Godot original (already has compatibility check):
#if CURRENT_RENDERER != RENDERER_COMPATIBILITY
  if (use_heightmap) {
    vec3 view_dir = normalize(...);
    float depth = 1.0 - iris_depth.b;
    vec2 ofs = iris_uv - view_dir.xy / (view_dir.z * fresnel) * depth * heightmap_scale * 0.01;
    iris_uv = clamp(ofs, 0., 1.);
  }
#endif

// WebGL 2 with mobile detection:
#ifdef MOBILE_DEVICE
  // Skip parallax on mobile for performance
#else
  vec3 viewDirTangent = normalize(TBN * viewDir);
  float depth = 1.0 - texture(heightMap, irisUv).b;
  vec2 offset = viewDirTangent.xy / viewDirTangent.z * depth * heightScale;
  irisUv -= offset;
#endif
```

### 4.4 Texture Optimization for iOS

| Original | Web Optimized | Size Reduction |
|----------|---------------|----------------|
| PNG 4096x4096 | ASTC 4x4 2048x2048 | ~90% |
| Separate Normal/AO | Combined RGBA | 50% fewer samples |
| HDR Environment | Prefiltered cubemap | Runtime savings |

**Texture Packing Strategy:**
```
Channel Packing:
├── albedo_metallic.png  → RGB: Albedo, A: Metallic
├── normal_roughness.png → RG: Normal XY, B: Roughness, A: AO
├── detail_ao.png        → RGB: Micro Normal, A: Micro AO
└── sss_translucency.png → R: SSS Mask, G: Translucency, BA: unused
```

---

## 5. Performance Budget for iOS

### 5.1 Target Specifications

| Metric | Target (60fps) | Target (30fps) |
|--------|----------------|----------------|
| Frame Time | <16.6ms | <33.3ms |
| Draw Calls | <50 | <100 |
| Triangles | <100k | <300k |
| Texture Memory | <128MB | <256MB |
| Shader Instructions | <200 ALU | <400 ALU |

### 5.2 Mobile LOD Strategy

```
LOD 0 (Desktop/High-end):
├── Full parallax mapping
├── Multi-layer SSS
├── Micro-detail normals
├── Double specularity
└── 4K textures

LOD 1 (Mobile/Medium):
├── Simple parallax or disabled
├── Pre-integrated SSS LUT
├── No micro-detail
├── Single specularity
└── 2K textures

LOD 2 (Low-end/Fallback):
├── No parallax
├── Wrapped diffuse only
├── Basic normal mapping
├── Single specularity
└── 1K textures
```

---

## 6. WebGPU Advantages (Future-Proofing)

### 6.1 Benefits for This Project

1. **Compute Shaders**: Pre-compute SSS kernels, real-time skin detail
2. **Better Performance**: Reduced driver overhead, better batching
3. **Uniform Buffers**: More efficient parameter passing
4. **WGSL**: Cleaner shader syntax, better error messages

### 6.2 WebGPU Migration Path

```
Recommended: Build WebGL 2 first, then add WebGPU renderer
├── Abstract renderer interface
├── Shared shader logic (generate from common source)
├── Feature detection: navigator.gpu availability
└── Graceful fallback to WebGL 2
```

---

## 7. Recommended Architecture

### 7.1 Project Structure

```
humanshaders-web/
├── src/
│   ├── core/
│   │   ├── Renderer.ts          # WebGL/WebGPU abstraction
│   │   ├── MaterialSystem.ts    # Shader management
│   │   └── TextureLoader.ts     # Compressed texture support
│   ├── shaders/
│   │   ├── skin/
│   │   │   ├── skin.vert.glsl
│   │   │   ├── skin.frag.glsl
│   │   │   └── skin.wgsl        # WebGPU version
│   │   ├── eye/
│   │   │   ├── eye.vert.glsl
│   │   │   ├── eye.frag.glsl
│   │   │   └── eye.wgsl
│   │   └── common/
│   │       ├── pbr.glsl         # Shared BRDF functions
│   │       ├── sss.glsl         # SSS utilities
│   │       └── normal.glsl      # Normal mapping utilities
│   ├── materials/
│   │   ├── SkinMaterial.ts
│   │   ├── EyeMaterial.ts
│   │   └── EyeWetnessMaterial.ts
│   ├── loaders/
│   │   └── HeadModelLoader.ts   # GLTF with material setup
│   └── index.ts
├── assets/
│   ├── models/                  # Optimized GLTF/GLB
│   └── textures/                # Compressed textures
├── examples/
│   └── basic-head.html
└── package.json
```

### 7.2 Recommended Tech Stack

```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@three/webgpu": "^0.160.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "glslify": "^7.1.1"
  }
}
```

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| iOS Safari WebGL bugs | Medium | High | Test early, maintain fallbacks |
| Performance on older iPhones | High | Medium | Aggressive LOD system |
| WebGPU adoption rate | Medium | Low | WebGL 2 as primary target |
| Texture memory limits | Medium | High | Texture streaming, compression |
| SSS quality on mobile | High | Medium | Pre-integrated LUT approach |

---

## 9. Conclusion & Recommendations

### Immediate Next Steps

1. **Prototype Phase**: Create minimal Three.js prototype with basic PBR
2. **Skin Shader Port**: Focus on the wrapped diffuse SSS technique first
3. **iOS Testing**: Test on real iOS devices early (iPhone 12+ recommended)
4. **Performance Baseline**: Establish frame time budgets before adding features

### Long-term Considerations

- WebGPU will provide better performance and capabilities
- Consider a progressive enhancement approach (WebGL 2 → WebGPU)
- Asset pipeline should output both compressed and uncompressed textures
- Consider GLTF export from Godot for model compatibility

### Estimated Complexity

| Component | Effort | Notes |
|-----------|--------|-------|
| PBR Foundation | 1-2 weeks | Well-documented in Three.js |
| Skin Shader | 2-3 weeks | SSS approximation is complex |
| Eye Shader | 1-2 weeks | Parallax is tricky on mobile |
| Eye Wetness | 1 week | Screen-space effect |
| iOS Optimization | 2+ weeks | Iterative testing required |
| **Total** | **7-10 weeks** | For production-ready result |

---

## 10. Gap Analysis: Existing Three.js vs HumanShaders

### 10.1 Existing Three.js Resources (Lee Perry-Smith / Infinite Head)

Three.js already includes the **Infinite head scan** (same model used in HumanShaders) with several examples:

#### Available Assets in Three.js (`examples/models/gltf/LeePerrySmith/`)
| File | Description |
|------|-------------|
| `LeePerrySmith.glb` | 3D head model (GLTF binary) |
| `Map-COL.jpg` | Diffuse/albedo texture |
| `Map-SPEC.jpg` | Specular map |
| `Infinite-Level_02_Tangent_SmoothUV.jpg` | Normal map |
| `Infinite-Level_02_Disp_NoSmoothUV-4096.jpg` | Displacement map (4K) |

#### Existing Three.js Examples

1. **[webgl_materials_normalmap](https://threejs.org/examples/webgl_materials_normalmap.html)**
   - `MeshPhongMaterial` with normal mapping
   - Post-processing: Bleach bypass, color correction, FXAA
   - Basic specular highlights

2. **[webgl_materials_subsurface_scattering](https://threejs.org/examples/webgl_materials_subsurface_scattering.html)**
   - Uses `SubsurfaceScatteringShader.js` (GDC 2011 technique)
   - Thickness-based translucency
   - Parameters: distortion, ambient, attenuation, power, scale

3. **[AlteredQualia Skin Demo](https://alteredqualia.com/three/examples/webgl_materials_skin.html)** (external)
   - `THREE.ShaderSkin` specialized shader
   - Multi-pass bloom
   - Beckmann distribution for specular

### 10.2 Feature Gap Analysis

| Feature | Three.js Has | HumanShaders Has | Gap |
|---------|--------------|------------------|-----|
| **Model** | ✓ Infinite head | ✓ Infinite + Emily | Model available |
| **Diffuse Texture** | ✓ Map-COL.jpg | ✓ Higher quality | Minor |
| **Normal Map** | ✓ Basic tangent | ✓ Multi-layer LOD | **Significant** |
| **Specular** | ✓ Basic Phong/GGX | ✓ Double GGX | Moderate |
| **SSS - Thickness** | ✓ Basic translucency | ✓ Multi-layer wrapped | **Significant** |
| **SSS - Noise Dithering** | ✗ | ✓ Interleaved gradient | **Missing** |
| **Micro-Detail Normals** | ✗ | ✓ 25-50x tiled overlay | **Missing** |
| **Micro-Detail AO** | ✗ | ✓ Overlay blend | **Missing** |
| **Translucency Gradient** | ✗ | ✓ Color LUT | **Missing** |
| **Light Warping** | ✗ | ✓ Optional LUT | **Missing** |
| **Tinted Shadow Penumbra** | ✗ | ✓ RGB overlay | **Missing** |
| **Eye Shader** | ✗ | ✓ Full iris/sclera | **Missing entirely** |
| **Eye Parallax** | ✗ | ✓ Heightmap-based | **Missing entirely** |
| **Eye Wetness** | ✗ | ✓ Screen-space blur | **Missing entirely** |

### 10.3 What's Missing - Detailed Breakdown

#### Critical Gaps (Required for parity)

1. **Multi-layer Normal SSS** (~200 lines)
   - Three.js SSS uses thickness map only
   - HumanShaders samples normal at 3 LOD levels per-channel (R/G/B)
   - Creates realistic light wrap around surface detail
   ```
   Effort: High - Core differentiator of skin quality
   ```

2. **Micro-Detail System** (~50 lines)
   - High-frequency normal tiling (25-50x UV scale)
   - AO overlay for pore-level detail
   - Critical for close-up realism
   ```
   Effort: Medium - Straightforward to implement
   ```

3. **Eye Rendering System** (~180 lines)
   - Dual-texture iris/sclera blend
   - Parallax depth for iris
   - Custom Fresnel calculation
   - SSS for sclera translucency
   ```
   Effort: High - Completely new system
   ```

#### Nice-to-Have Gaps

4. **Translucency Color Gradient** (~30 lines)
   - LUT-based color lookup for backlit areas
   - Ears, nose, thin skin areas
   ```
   Effort: Low
   ```

5. **Eye Wetness Effect** (~100 lines)
   - Screen-space blur with emission
   - Micro-detail modulation
   ```
   Effort: Medium
   ```

6. **SSS Noise Dithering** (~20 lines)
   - Breaks up banding in SSS
   - Animated interleaved gradient noise
   ```
   Effort: Low
   ```

### 10.4 Revised Effort Estimate

Given existing Three.js foundation:

| Task | From Scratch | Using Three.js Base |
|------|--------------|---------------------|
| PBR Foundation | 1-2 weeks | **Already done** ✓ |
| Basic SSS | 1 week | **Partially done** ✓ |
| Multi-layer Normal SSS | 2 weeks | 1-2 weeks |
| Micro-detail System | 1 week | 3-4 days |
| Eye Shader | 2 weeks | 1-2 weeks |
| Eye Wetness | 1 week | 3-4 days |
| Polish & iOS Testing | 2 weeks | 1-2 weeks |
| **Total** | **7-10 weeks** | **4-6 weeks** |

### 10.5 Recommended Starting Point

```javascript
// Start from Three.js SSS example and extend:
import { SubsurfaceScatteringShader } from 'three/examples/jsm/shaders/SubsurfaceScatteringShader.js';

// Key modifications needed:
// 1. Replace thickness-based SSS with multi-layer normal sampling
// 2. Add micro-detail normal/AO texture inputs
// 3. Implement wrapped diffuse per-channel (R/G/B smoothstep)
// 4. Add translucency color LUT sampling
```

### 10.6 Three.js SSS Shader Comparison

**Current Three.js SSS (`SubsurfaceScatteringShader.js`):**
- Based on GDC 2011 "Approximating Translucency" talk
- Uses thickness map for light transmission
- Single-pass forward rendering
- Good for general translucent materials (wax, jade, etc.)

**HumanShaders SSS Approach:**
- Multi-layer normal sampling at different LOD levels
- Per-channel (R/G/B) wrapped diffuse with different falloffs
- Simulates wavelength-dependent scattering depth
- Optimized specifically for human skin

**Key Algorithmic Difference:**
```glsl
// Three.js SSS (thickness-based):
float scatter = pow(saturate(dot(viewDir, -lightDir)), thicknessPower)
              * thicknessScale * thickness;

// HumanShaders SSS (normal-based):
vec3 dn_r = normalLod(uv, 1.0 * smoothness);  // Red scatters deepest
vec3 dn_g = normalLod(uv, 0.8 * smoothness);  // Green medium
vec3 dn_b = normalLod(uv, 0.7 * smoothness);  // Blue shallowest
vec3 scatter = vec3(
    smoothstep(0.40, 1.2, wrap(dn_r, light)),
    smoothstep(0.425, 1.2, wrap(dn_g, light)),
    smoothstep(0.44, 1.2, wrap(dn_b, light))
);
```

---

## Appendix A: Reference Resources

### Three.js Examples (Starting Points)
- [Three.js Normal Map Demo](https://threejs.org/examples/webgl_materials_normalmap.html) - Lee Perry-Smith head with basic normal mapping
- [Three.js SSS Demo](https://threejs.org/examples/webgl_materials_subsurface_scattering.html) - Thickness-based subsurface scattering
- [AlteredQualia Skin Demo](https://alteredqualia.com/three/examples/webgl_materials_skin.html) - Advanced skin shader with bloom
- [Three.js Modified Materials](https://threejs.org/examples/webgl_materials_modified.html) - Custom material modification patterns

### Documentation
- [Three.js Custom Materials](https://threejs.org/docs/#api/en/materials/ShaderMaterial)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [iOS WebGL Best Practices](https://developer.apple.com/documentation/webgl)
- [ASTC Texture Compression](https://developer.arm.com/documentation/102162/latest/)

### Research Papers & Techniques
- [Pre-Integrated Skin Shading (GPU Gems 3)](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-14-advanced-techniques-realistic-real-time-skin)
- [GDC 2011 - Approximating Translucency](https://colinbarrebrisebois.com/2011/03/07/gdc-2011-approximating-translucency-for-a-fast-cheap-and-convincing-subsurface-scattering-look/) - Basis for Three.js SSS
- [Screen-Space SSS Discussion](https://discourse.threejs.org/t/skin-shading-with-screen-space-sub-surface-scattering/83939) - Three.js forum

## Appendix B: iOS Device GPU Capabilities

| Device | GPU | WebGL 2 | WebGPU | Notes |
|--------|-----|---------|--------|-------|
| iPhone 12+ | A14+ | ✓ | ✓ (iOS 17+) | Full support |
| iPhone 11 | A13 | ✓ | ✓ (iOS 17+) | Good performance |
| iPhone XS/XR | A12 | ✓ | ✓ (iOS 17+) | Moderate performance |
| iPhone X/8 | A11 | ✓ | ✗ | WebGL 2 only |
| iPad Pro M1+ | M1+ | ✓ | ✓ | Desktop-class |
