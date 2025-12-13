// HumanShaders Web - Eye Wetness Vertex Shader
// Screen-space wet surface effect

varying vec2 vUv;
varying vec4 vScreenPosition;

void main() {
    vUv = uv;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Store screen position for screen texture sampling
    vScreenPosition = gl_Position;
}
