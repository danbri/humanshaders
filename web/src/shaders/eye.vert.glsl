// HumanShaders Web - Eye Vertex Shader
// Port of Godot eye_shader.gdshader

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;
varying mat3 vTBN;
varying vec3 vViewDirTangent;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    // Compute TBN matrix
    vec3 T = normalize(normalMatrix * tangent.xyz);
    vec3 N = vNormal;
    vec3 B = normalize(cross(N, T)) * tangent.w;
    vTBN = mat3(T, B, N);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;

    // View direction in tangent space (for parallax)
    vec3 viewDir = normalize(-mvPosition.xyz);
    vViewDirTangent = normalize(transpose(vTBN) * viewDir);

    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    gl_Position = projectionMatrix * mvPosition;
}
