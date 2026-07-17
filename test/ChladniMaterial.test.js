import assert from 'node:assert/strict';
import test from 'node:test';
import { getChladniMaterial } from '../src/visualizers/Chladni.js';

test('renders resonance density as a smooth liquid surface on black', () => {
  const { material, geometry } = getChladniMaterial();
  const shader = material.fragmentShader;

  assert.match(shader, /uniform vec2 uSandTexel/);
  assert.match(shader, /persistentDensity = \(/);
  assert.match(shader, /vec3 color = vec3\(0\.0\)/);
  assert.doesNotMatch(shader, /gl_FragCoord/);
  assert.doesNotMatch(shader, /liquidTexture/);

  geometry.dispose();
  material.dispose();
});
