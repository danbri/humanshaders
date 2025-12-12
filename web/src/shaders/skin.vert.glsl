// HumanShaders Web - Skin Vertex Shader
// Standalone vertex shader for skin rendering

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;
varying mat3 vTBN;

attribute vec4 tangent;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    // Compute TBN matrix for normal mapping
    vec3 T = normalize(normalMatrix * tangent.xyz);
    vec3 N = vNormal;
    vec3 B = normalize(cross(N, T)) * tangent.w;
    vTBN = mat3(T, B, N);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;

    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    gl_Position = projectionMatrix * mvPosition;
}
