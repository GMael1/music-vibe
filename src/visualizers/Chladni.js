import * as THREE from 'three';

export function getChladniMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uFreq: { value: 0 },
    uFreqHigh: { value: 0 },
    uHue: { value: 0 }
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
    
    // Smooth noise function for fluid
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    
    float getHeight(vec2 uv) {
      float n = 2.0 + uFreq * 6.0;
      float m = 3.0 + uFreqHigh * 6.0;
      
      // Map uv to pos space, say from -1.5 to 1.5
      vec2 p = (uv * 2.0 - 1.0) * 1.5;
      
      float chladni = cos(n * 3.1415 * p.x) * cos(m * 3.1415 * p.y) - cos(m * 3.1415 * p.x) * cos(n * 3.1415 * p.y);
      float plateHeight = abs(chladni);
      
      float fluid = snoise(p * 2.0 + uTime * 0.5) * 0.2;
      fluid += snoise(p * 5.0 - uTime * 0.3) * 0.1;
      
      float amplitude = 0.3 + uFreq * 0.6;
      return (plateHeight * 0.5 + fluid) * amplitude;
    }
    
    vec3 getNormal(vec2 uv) {
      float eps = 0.005; // sampling distance
      float h0 = getHeight(uv);
      float h1 = getHeight(uv + vec2(eps, 0.0));
      float h2 = getHeight(uv + vec2(0.0, eps));
      
      // Calculate tangents
      vec3 dX = vec3(eps, 0.0, h1 - h0);
      vec3 dY = vec3(0.0, eps, h2 - h0);
      return normalize(cross(dX, dY));
    }
    
    void main() {
      float height = getHeight(vUv);
      vec3 normal = getNormal(vUv);
      
      // Pseudo world position for lighting
      vec3 worldPos = vec3(vUv * 2.0 - 1.0, height);
      
      // Lighting setup
      vec3 lightDir = normalize(vec3(1.0, 1.5, 0.5));
      vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0)); // Ortho camera looks straight down Z
      vec3 halfVector = normalize(lightDir + viewDir);
      
      // Ambient
      vec3 ambient = vec3(0.02, 0.05, 0.1);
      
      // Diffuse
      float diff = max(dot(normal, lightDir), 0.0);
      
      // Specular (shiny liquid)
      float spec = pow(max(dot(normal, halfVector), 0.0), 64.0);
      
      // Fluid colors shifting from deep blue to glowing pink/orange based on normal and frequency
      vec3 baseColor = mix(vec3(0.1, 0.2, 0.6), vec3(0.9, 0.3, 0.5), normal.y * 0.5 + 0.5);
      baseColor = mix(baseColor, vec3(0.1, 0.9, 0.8), uFreqHigh * 0.5);
      
      // Height-based coloring (valleys vs peaks)
      vec3 heightColor = mix(vec3(0.0, 0.0, 0.1), baseColor, smoothstep(-0.2, 0.4, height));
      
      vec3 finalColor = ambient + heightColor * diff + vec3(1.0) * spec * (0.3 + uFreq * 0.7);
      
      // Add a fresnel glow for that modern 3D look
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
      finalColor += vec3(0.5, 0.8, 1.0) * fresnel * (0.2 + uFreq * 0.4);
      
      // Smooth fade out at the edges so it takes up the screen elegantly
      float dist = length(vUv * 2.0 - 1.0);
      float alpha = smoothstep(1.0, 0.95, dist); // Crisp, anti-aliased edge
      
      finalColor = hueShift(finalColor, uHue);

      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide
  });

  // Since we compute height per-pixel in the fragment shader, we only need 1 quad! Infinite resolution!
  const geometry = new THREE.PlaneGeometry(3, 3, 1, 1);

  return { material, uniforms, geometry };
}
