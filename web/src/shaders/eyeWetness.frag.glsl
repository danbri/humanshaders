// HumanShaders Web - Eye Wetness Fragment Shader
// Port of Godot vshader_eye_wetness.tres
// Creates a wet film effect over the eye using screen-space blur

precision highp float;

uniform sampler2D uScreenTexture;
uniform vec2 uResolution;
uniform float uRoughness;
uniform float uShadow;
uniform vec3 uShadowColor;
uniform bool uUseMicroDetail;
uniform sampler2D uMicroDetailMap;
uniform float uMicroDetailSize;

varying vec2 vUv;
varying vec4 vScreenPosition;

void main() {
    // Convert clip space to screen UV
    vec2 screenUv = (vScreenPosition.xy / vScreenPosition.w) * 0.5 + 0.5;

    // Calculate blur amount based on roughness (mipmap level approximation)
    float blurLevel = clamp(uRoughness * 10.0, 2.0, 10.0);

    // Sample screen texture with blur (using manual box blur for WebGL compatibility)
    vec2 texelSize = 1.0 / uResolution;
    float blurRadius = blurLevel * 0.5;

    vec3 blurredColor = vec3(0.0);
    float totalWeight = 0.0;

    // 5x5 blur kernel
    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize * blurRadius;
            float weight = 1.0 - length(vec2(x, y)) / 3.0;
            blurredColor += texture2D(uScreenTexture, screenUv + offset).rgb * weight;
            totalWeight += weight;
        }
    }
    blurredColor /= totalWeight;

    // Apply shadow/tint
    vec3 tintedColor = blurredColor * uShadowColor;
    vec3 color = mix(blurredColor, tintedColor, uShadow);

    // Micro-detail modulation for specular variation
    float specularMod = 0.5;
    if (uUseMicroDetail) {
        vec2 microUv = vUv * uMicroDetailSize;
        float microDetail = texture2D(uMicroDetailMap, microUv).r;
        specularMod = microDetail * microDetail * 2.0;
        specularMod = clamp(specularMod, 0.0, 1.0);
    }

    // Calculate alpha based on vertex color (passed from geometry)
    // For now use a simple fresnel-like falloff
    float alpha = 1.0 - uShadow;

    // Output as emission-style overlay
    gl_FragColor = vec4(color * (1.0 - uShadow), alpha);
}
