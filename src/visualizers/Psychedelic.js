import * as THREE from 'three';

export function getPsychedelicMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uFreq: { value: 0 },
    uFreqHigh: { value: 0 },
    uHue: { value: 0 },
  };

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uFreq;
    uniform float uFreqHigh;
    uniform float uHue;
    varying vec2 vUv;
    
    vec3 hueShift(vec3 color, float hue) {
        const vec3 k = vec3(0.57735, 0.57735, 0.57735);
        float cosAngle = cos(hue);
        return vec3(color * cosAngle + cross(k, color) * sin(hue) + k * dot(k, color) * (1.0 - cosAngle));
    }

    // Domain warping & FBM helpers
    mat2 rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
    }

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        for (int i = 0; i < 5; ++i) {
            v += a * noise(p);
            p = rot(0.5) * p * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }

    vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
        return a + b*cos( 6.28318*(c*t+d) );
    }

    void main() {
      vec2 uv = vUv * 2.0 - 1.0;
      uv.x *= 16.0/9.0; // Rough aspect ratio correction
      
      vec2 uv0 = uv;
      
      // Domain warping driven by audio
      vec2 q = vec2(0.);
      q.x = fbm( uv + 0.00*uTime);
      q.y = fbm( uv + vec2(1.0));

      vec2 r = vec2(0.);
      r.x = fbm( uv + 1.0*q + vec2(1.7,9.2)+ 0.15*uTime );
      r.y = fbm( uv + 1.0*q + vec2(8.3,2.8)+ 0.126*uTime );
      
      // Add audio reactivity to the warping
      r += (uFreq * 0.2) * sin(uTime * 2.0 + length(uv0) * 10.0);

      float f = fbm(uv + r);
      
      // Color palette
      vec3 colA = vec3(0.5, 0.5, 0.5);
      vec3 colB = vec3(0.5, 0.5, 0.5);
      vec3 colC = vec3(1.0, 1.0, 1.0);
      vec3 colD = vec3(0.263,0.416,0.557); // Blueish
      
      // Shift palette based on high frequencies
      float colOffset = f * 2.0 + uTime * 0.4 + (uFreqHigh * 1.5);
      vec3 color = palette(colOffset, colA, colB, colC, colD);
      
      color = mix(color, vec3(0.1, 0.0, 0.2), clamp(length(q), 0.0, 1.0));
      color = mix(color, vec3(1.0, 0.5, 0.0), clamp(length(r.x), 0.0, 1.0) * (uFreq * 1.5));
      
      // Apply hue shift
      color = hueShift(color, uHue);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
  });

  const geometry = new THREE.PlaneGeometry(1, 1);

  return { material, uniforms, geometry };
}
