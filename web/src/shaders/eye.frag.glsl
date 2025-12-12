// HumanShaders Web - Eye Fragment Shader
// Port of Godot eye_shader.gdshader with parallax iris

precision highp float;

// Sclera (white) textures
uniform vec3 uScleraColor;
uniform sampler2D uScleraAlbedoMap;
uniform sampler2D uScleraNormalMap;

// Iris textures
uniform vec3 uIrisColor;
uniform sampler2D uIrisAlbedoMap;
uniform sampler2D uIrisNormalMap;
uniform sampler2D uIrisHeightMap;

// Material parameters
uniform float uIrisScale;
uniform float uHeightmapScale;
uniform bool uUseParallax;
uniform float uRoughness;
uniform float uSpecular;
uniform float uNormalStrength;

// SSS
uniform bool uUseSSS;
uniform float uSssStrength;

// Scene
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
varying vec3 vViewDirTangent;

#define PI 3.14159265359

// GGX Distribution
float DistributionGGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    float denom = NdotH2 * (a2 - 1.0) + 1.0;
    return a2 / (PI * denom * denom);
}

// Geometry function
float GeometryGGX(float NdotL, float NdotV, float roughness) {
    return 0.5 / mix(2.0 * NdotL * NdotV, NdotL + NdotV, roughness);
}

// Fresnel-Schlick
vec3 FresnelSchlick(float cosTheta, vec3 F0) {
    float m = 1.0 - cosTheta;
    float m2 = m * m;
    return F0 + (1.0 - F0) * (m2 * m2 * m);
}

void main() {
    vec2 baseUv = vUv;

    // Eye-specific Fresnel for specular enhancement
    float fresnel = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
    fresnel = clamp(pow(1.0 - fresnel + 0.32, 7.0), 0.0, 1.0) + 1.0;

    // Calculate iris UV (scaled from center)
    vec2 uvCenter = vec2(0.5);
    vec2 irisUv = clamp((baseUv - uvCenter) * uIrisScale + uvCenter, 0.0, 1.0);

    // Sample iris depth for alpha mask
    vec4 irisDepth = texture2D(uIrisHeightMap, irisUv);
    float irisAlpha = smoothstep(0.0, 0.2, 1.0 - irisDepth.b);

    // Parallax mapping for iris depth effect
    float irisUvSize = 1.6;

    if (uUseParallax) {
        irisUvSize /= (1.0 + uHeightmapScale * 0.025);

        float depth = 1.0 - irisDepth.b;
        vec2 parallaxOffset = vViewDirTangent.xy / (vViewDirTangent.z * fresnel) * depth * uHeightmapScale * 0.01;
        irisUv = clamp(irisUv - parallaxOffset, 0.0, 1.0);
    }

    irisUv = (irisUv - uvCenter) * irisUvSize + uvCenter;

    // Sample albedo textures
    vec4 scleraDiff = texture2D(uScleraAlbedoMap, baseUv) * vec4(uScleraColor, 1.0);
    vec4 irisDiff = texture2D(uIrisAlbedoMap, irisUv) * vec4(uIrisColor, 1.0);

    // Blend sclera and iris
    vec3 albedo = mix(scleraDiff.rgb, irisDiff.rgb, irisAlpha);

    // Normal mapping
    vec3 scleraNormal = texture2D(uScleraNormalMap, baseUv).rgb;
    vec3 irisNormal = texture2D(uIrisNormalMap, irisUv).rgb;

    // Blend normals based on iris heightmap for depth illusion
    vec3 irisNormalMix = vec3(
        1.5 - irisDepth.r * 2.0 + (irisNormal.r - 0.5),
        1.5 - irisDepth.g * 2.0 + (irisNormal.g - 0.5),
        irisDepth.b
    );

    // Decode and transform normal
    vec3 normalSample = mix(scleraNormal, vec3(0.5, 0.5, 1.0), irisAlpha);
    vec3 normal;
    normal.xy = normalSample.xy * 2.0 - 1.0;
    normal.y = -normal.y;
    normal.z = sqrt(max(0.0, 1.0 - dot(normal.xy, normal.xy)));
    normal = normalize(vTBN * mix(vec3(0.0, 0.0, 1.0), normal, uNormalStrength));

    // Lighting calculations
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(uLightPosition - vWorldPosition);
    vec3 halfDir = normalize(viewDir + lightDir);

    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotH = max(dot(normal, halfDir), 0.0);
    float LdotH = max(dot(lightDir, halfDir), 0.0);

    // Diffuse with custom normal for softer look
    vec3 diffNormal = mix(normal, vNormal, 0.3);
    float diffuse = max(dot(diffNormal, lightDir), 0.0);

    // SSS for sclera
    float sssStrength = uUseSSS ? uSssStrength * (1.0 - irisAlpha * 0.5) : 0.0;
    diffuse = mix(diffuse, diffuse * 0.5 + 0.5, sssStrength);

    // Specular (GGX)
    float roughness = clamp(uRoughness, 0.01, 1.0);
    vec3 F0 = vec3(0.04 * uSpecular * uSpecular);

    float D = DistributionGGX(NdotH, roughness);
    float G = GeometryGGX(NdotL, NdotV, roughness);
    vec3 F = FresnelSchlick(LdotH, F0);

    vec3 specular = max(NdotL * D * G * F, vec3(0.0));

    // Combine
    vec3 lightColor = uLightColor * uLightIntensity;
    vec3 color = albedo * diffuse * lightColor / PI;
    color += specular * lightColor;
    color += albedo * uAmbientColor;

    // Tone mapping
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
}
