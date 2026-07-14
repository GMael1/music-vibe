import * as THREE from 'three';
import { createJourneyUniforms, FULLSCREEN_VERTEX_SHADER } from './JourneyUniforms.js';

export function getObsidianOrganismMaterial() {
  const uniforms = createJourneyUniforms();
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FULLSCREEN_VERTEX_SHADER,
    fragmentShader: `
      uniform float uTime;
      uniform float uJourney;
      uniform float uBass;
      uniform float uMid;
      uniform float uTreble;
      uniform float uSpectralLow;
      uniform float uSpectralMid;
      uniform float uSpectralHigh;
      uniform float uLevel;
      uniform float uOnset;
      uniform float uTrance;
      uniform float uCosmic;
      uniform float uOpacity;
      uniform float uAspect;
      varying vec2 vUv;

      const float TAU = 6.28318530718;

      mat2 rotate2d(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat2(c, -s, s, c);
      }

      float smoothMin(float a, float b, float amount) {
        float h = clamp(0.5 + 0.5 * (b - a) / amount, 0.0, 1.0);
        return mix(b, a, h) - amount * h * (1.0 - h);
      }

      float torusSdf(vec3 p, vec2 radii) {
        vec2 q = vec2(length(p.xz) - radii.x, p.y);
        return length(q) - radii.y;
      }

      float frontTorusSdf(vec3 p, vec2 radii) {
        vec2 q = vec2(length(p.xy) - radii.x, p.z);
        return length(q) - radii.y;
      }

      float organism(vec3 p) {
        float slow = uTime * (0.12 + uTrance * 0.18);
        float scale = 0.72;
        p *= scale;
        p.xy = rotate2d(slow * 0.38 + uJourney * 0.05) * p.xy;
        float major = 0.69 + uSpectralLow * 0.12;
        float tube = 0.135 + uBass * 0.06;
        float field = frontTorusSdf(p, vec2(major, tube));

        vec3 tiltedA = p;
        tiltedA.yz = rotate2d(1.05 + sin(slow) * 0.12) * tiltedA.yz;
        tiltedA.xy = rotate2d(0.42) * tiltedA.xy;
        field = smoothMin(field, frontTorusSdf(tiltedA, vec2(major * 0.88, tube * 0.92)), 0.085);

        vec3 tiltedB = p;
        tiltedB.xz = rotate2d(1.12 + cos(slow * 0.7) * 0.1) * tiltedB.xz;
        tiltedB.xy = rotate2d(-0.48) * tiltedB.xy;
        field = smoothMin(field, torusSdf(tiltedB, vec2(major * 0.82, tube * 0.86)), 0.075);

        for (int index = 0; index < 3; index++) {
          float fi = float(index);
          float phase = fi * 2.094 + slow;
          vec3 center = vec3(
            cos(phase) * (0.48 + uMid * 0.08),
            sin(phase * 1.7 + uJourney) * 0.38,
            sin(phase) * 0.18
          );
          float sphere = length(p - center) - (0.16 + sin(phase * 2.1) * 0.028);
          field = smoothMin(field, sphere, 0.07 + uTrance * 0.045);
        }
        float ripple = sin(p.x * 7.0 + p.y * 6.0 + p.z * 5.0 - slow * 3.0)
          * uSpectralMid * 0.022;
        return (field + ripple) / scale;
      }

      vec3 normalAt(vec3 p) {
        vec2 e = vec2(0.003, 0.0);
        float d = organism(p);
        return normalize(vec3(
          organism(p + e.xyy) - d,
          organism(p + e.yxy) - d,
          organism(p + e.yyx) - d
        ));
      }

      vec3 cosmicPalette(float t) {
        return 0.5 + 0.5 * cos(TAU * (t + vec3(0.02, 0.35, 0.68)));
      }

      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        uv.x *= uAspect;
        vec3 rayOrigin = vec3(0.0, 0.0, 2.65);
        vec3 rayDirection = normalize(vec3(uv, -1.85));
        float distanceTravelled = 0.0;
        float distanceToSurface = 0.0;
        bool hit = false;

        for (int stepIndex = 0; stepIndex < 52; stepIndex++) {
          vec3 point = rayOrigin + rayDirection * distanceTravelled;
          distanceToSurface = organism(point);
          if (distanceToSurface < 0.002) {
            hit = true;
            break;
          }
          distanceTravelled += distanceToSurface * 0.72;
          if (distanceTravelled > 5.0) break;
        }

        vec3 color = vec3(0.00035, 0.0005, 0.00045);
        float gate = smoothstep(0.008, 0.17, uLevel);
        if (hit) {
          vec3 point = rayOrigin + rayDirection * distanceTravelled;
          vec3 normal = normalAt(point);
          vec3 lightDirection = normalize(vec3(-0.6, 0.72, 0.8));
          vec3 halfVector = normalize(lightDirection - rayDirection);
          float diffuse = max(dot(normal, lightDirection), 0.0);
          float specular = pow(max(dot(normal, halfVector), 0.0), 78.0);
          float rim = pow(1.0 - max(dot(normal, -rayDirection), 0.0), 2.5);
          float engraving = pow(0.5 + 0.5 * sin(
            point.x * (12.0 + uMid * 9.0)
            + point.y * 9.0 - point.z * 11.0 + uJourney * 2.0), 13.0);
          vec3 earth = mix(vec3(0.12, 0.028, 0.008), vec3(0.82, 0.38, 0.05), engraving);
          vec3 cosmic = cosmicPalette(engraving + point.y * 0.18 + uJourney * 0.03);
          vec3 emission = mix(earth, cosmic, uCosmic);
          color += vec3(0.006, 0.009, 0.008) * (0.5 + diffuse * 1.15) * gate;
          color += emission * engraving * gate * (0.09 + uSpectralMid * 0.36);
          color += emission * diffuse * gate * 0.025;
          color += mix(vec3(0.5, 0.32, 0.11), cosmic, uCosmic)
            * rim * gate * (0.025 + uSpectralHigh * 0.16);
          color += vec3(0.85, 0.92, 0.88) * specular * gate
            * (0.045 + uTreble * 0.38);
          color += emission * uOnset * rim * gate * 0.12;
        }
        float haze = exp(-length(uv) * 2.8) * gate * 0.006;
        color += mix(vec3(0.08, 0.025, 0.006), vec3(0.08, 0.02, 0.16), uCosmic) * haze;
        gl_FragColor = vec4(color, uOpacity);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  return { material, uniforms, geometry: new THREE.PlaneGeometry(1, 1) };
}
