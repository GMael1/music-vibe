import assert from 'node:assert/strict';
import test from 'node:test';
import { getLivingMandalaMaterial } from '../src/visualizers/LivingMandala.js';

test('builds the mandala from anchored kaleidoscopic shape fields', () => {
  const { material, geometry } = getLivingMandalaMaterial();
  const shader = material.fragmentShader;

  assert.match(shader, /kaleidoscopeFold/);
  assert.match(shader, /motifDistance/);
  assert.match(shader, /lensDistance/);
  assert.match(shader, /anchorInner/);
  assert.match(shader, /anchorMiddle/);
  assert.match(shader, /anchorOuter/);
  assert.doesNotMatch(shader, /gl_FragCoord/);

  geometry.dispose();
  material.dispose();
});
