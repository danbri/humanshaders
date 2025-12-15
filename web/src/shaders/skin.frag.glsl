// HumanShaders Web - Skin Fragment Shader
// Port of Godot skin_shader.gdshader with multi-layer SSS

precision highp float;

// Uniforms - Material properties
uniform vec3 uAlbedo;
uniform sampler2D uAlbedoMap;
uniform sampler2D uNormalMap;
uniform sampler2D uRoughnessMap;
uniform sampler2D uAoMap;

// Micro-detail
uniform bool uUseMicroDetail;
uniform sampler2D uMicroDetailMap;
uniform float uMicroDetailScale;
uniform float uMicroNormalStrength;
uniform float uMicroAoStrength;

// SSS parameters
uniform bool uUseSSS;
uniform float uSssStrength;
uniform float uSkinSmoothness;
uniform float uSkinFalloff;
uniform vec3 uSssColor;

// Translucency
uniform bool uUseTranslucency;
uniform float uTranslucencyStrength;
uniform sampler2D uTranslucencyMap;

// Material parameters
uniform float uRoughness;
uniform float uMetallic;
uniform float uNormalStrength;
uniform float uAoStrength;
uniform bool uDoubleSpecularity;

// Scene uniforms
uniform vec3 uLightPosition;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform vec3 uAmbientColor;

// Varyings
varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;
varying mat3 vTBN;

#define PI 3.14159265359
#define RECIPROCAL_PI 0.31830988618

// GGX Distribution
float DistributionGGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    float denom = NdotH2 * (a2 - 1.0) + 1.0;
    return a2 / (PI * denom * denom);
}

// Geometry function (Schlick-GGX)
float GeometryGGX(float NdotL, float NdotV, float roughness) {
    return 0.5 / mix(2.0 * NdotL * NdotV, NdotL + NdotV, roughness);
}

// Fresnel-Schlick
vec3 FresnelSchlick(float cosTheta, vec3 F0) {
    float m = 1.0 - cosTheta;
    float m2 = m * m;
    return F0 + (1.0 - F0) * (m2 * m2 * m);
}

// Decode normal from normal map
vec3 decodeNormal(vec3 normalSample) {
    vec3 n;
    n.xy = normalSample.xy * 2.0 - 1.0;
    n.y = -n.y; // Flip Y for OpenGL convention
    n.z = sqrt(max(0.0, 1.0 - dot(n.xy, n.xy)));
    return normalize(n);
}

// Sample normal at specific LOD level
vec3 sampleNormalLod(vec2 uv, float lod) {
    vec3 normalSample = textureLod(uNormalMap, uv, lod).rgb;
    return decodeNormal(normalSample);
}

// Normal blending (additive)
vec3 blendNormals(vec3 base, vec3 detail) {
    return normalize(vec3(base.xy + detail.xy, base.z));
}

// Overlay blend mode for AO
vec3 overlayBlend(vec3 base, vec3 blend) {
    vec3 limit = step(0.5, base);
    return mix(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), limit);
}

void main() {
    vec2 uv = vUv;

    // Sample base textures
    vec4 albedoSample = texture2D(uAlbedoMap, uv);
    vec3 albedo = uAlbedo * albedoSample.rgb;

    float roughnessSample = texture2D(uRoughnessMap, uv).g;
    float roughness = uRoughness * roughnessSample;
    roughness = clamp(roughness, 0.04, 1.0);

    float ao = texture2D(uAoMap, uv).r;

    // Micro-detail
    if (uUseMicroDetail) {
        vec4 microDetail = texture2D(uMicroDetailMap, uv * uMicroDetailScale);
        float microAo = mix(0.5, microDetail.b, uMicroAoStrength * 2.0);
        albedo = overlayBlend(albedo, vec3(microAo));
        ao *= mix(1.0, microDetail.b, uMicroAoStrength);
    }

    // Normal mapping
    vec3 normalSample = texture2D(uNormalMap, uv).rgb;
    vec3 normal = decodeNormal(normalSample);

    // Blend micro-detail normals
    if (uUseMicroDetail) {
        vec3 microNormal = texture2D(uMicroDetailMap, uv * uMicroDetailScale).rgb;
        microNormal = mix(vec3(0.5, 0.5, 1.0), microNormal, uMicroNormalStrength);
        normal = blendNormals(normal, decodeNormal(microNormal));
    }

    // Transform normal to world space
    normal = normalize(vTBN * mix(vec3(0.0, 0.0, 1.0), normal, uNormalStrength));

    // View and light vectors
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(uLightPosition - vWorldPosition);
    vec3 halfDir = normalize(viewDir + lightDir);

    // Dot products
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float LdotH = max(dot(lightDir, halfDir), 0.0);

    // === MULTI-LAYER SSS (Key HumanShaders technique) ===
    vec3 diffuseLight = vec3(0.0);

    if (uUseSSS) {
        // Sample normals at different LOD levels for SSS
        // Red channel scatters deepest, blue shallowest
        float s = uSkinSmoothness;
        vec3 dn_r = sampleNormalLod(uv, s * 1.0);
        vec3 dn_g = sampleNormalLod(uv, s * 0.8);
        vec3 dn_b = sampleNormalLod(uv, s * 0.7);

        // Transform to world space
        dn_r = normalize(vTBN * dn_r);
        dn_g = normalize(vTBN * dn_g);
        dn_b = normalize(vTBN * dn_b);

        // Wrapped diffuse with per-channel falloff
        float wrap = 0.5;
        float sf = uSkinFalloff;

        float wrapped_r = smoothstep(0.4 / sf, 1.2 * sf, dot(dn_r, lightDir) * wrap + (1.0 - wrap));
        float wrapped_g = smoothstep(0.425 / sf, 1.2 * sf, dot(dn_g, lightDir) * wrap + (1.0 - wrap));
        float wrapped_b = smoothstep(0.44 / sf, 1.2 * sf, dot(dn_b, lightDir) * wrap + (1.0 - wrap));

        vec3 sssLight = vec3(wrapped_r, wrapped_g, wrapped_b);

        // Apply AO to SSS
        sssLight *= ao * uAoStrength + (1.0 - uAoStrength);

        // Blend SSS with standard diffuse
        diffuseLight = mix(vec3(NdotL), sssLight, uSssStrength) * uSssColor;
    } else {
        // Standard Lambert diffuse
        diffuseLight = vec3(NdotL);
    }

    // Translucency (back-lighting)
    if (uUseTranslucency) {
        float translucencyMask = texture2D(uTranslucencyMap, uv).r;
        float backLight = max(dot(viewDir, -lightDir - normal * 0.4), 0.0);
        vec3 translucency = backLight * translucencyMask * uTranslucencyStrength * uSssColor;
        diffuseLight += translucency;
    }

    // === PBR Specular (Schlick-GGX) ===
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, uMetallic);

    float D = DistributionGGX(NdotH, roughness);
    float G = GeometryGGX(NdotL, NdotV, roughness);
    vec3 F = FresnelSchlick(LdotH, F0);

    vec3 specular = D * G * F;

    // Double specularity for skin (second lobe)
    if (uDoubleSpecularity) {
        float roughness2 = min(roughness + 0.3, 1.0);
        float D2 = DistributionGGX(NdotH, roughness2);
        float G2 = GeometryGGX(NdotL, NdotV, roughness2);
        vec3 specular2 = D2 * G2 * F;
        specular = mix(specular2, specular, 0.6) * 2.0;
    }

    // Apply AO to specular
    specular *= ao * uAoStrength + (1.0 - uAoStrength);

    // Combine lighting
    vec3 lightColor = uLightColor * uLightIntensity;
    vec3 diffuse = albedo * (1.0 - uMetallic) * diffuseLight * RECIPROCAL_PI;

    vec3 color = (diffuse + specular) * lightColor;

    // Add ambient
    vec3 ambient = albedo * uAmbientColor * ao;
    color += ambient;

    // Tone mapping (simple Reinhard)
    color = color / (color + vec3(1.0));

    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
}
