export const POINT_CLOUD_VERTEX_GLSL = `
attribute vec3 aPosition;
attribute vec4 aColor;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uWorldPointSize;
uniform float uPixelSizeFactor;
uniform float uMinPointSize;
uniform float uMaxPointSize;

varying vec3 vColor;

void main(void) {
    vec4 worldPos = matrix_model * vec4(aPosition, 1.0);
    vec4 clipPos = matrix_viewProjection * worldPos;
    gl_Position = clipPos;

    float dist = max(clipPos.w, 0.0001);
    gl_PointSize = clamp((uWorldPointSize * uPixelSizeFactor) / dist, uMinPointSize, uMaxPointSize);
    vColor = aColor.rgb;
}
`;

export const POINT_CLOUD_FRAGMENT_GLSL = `
precision mediump float;
varying vec3 vColor;

void main(void) {
    vec2 coord = gl_PointCoord - vec2(0.5);
    if (dot(coord, coord) > 0.25) {
        discard;
    }
    gl_FragColor = vec4(vColor, 1.0);
}
`;
