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
  assert.match(shader, /tunnelRadius/);
  assert.match(shader, /tunnelPhase/);
  assert.doesNotMatch(shader, /shellIndex/);
  assert.match(shader, /edgeImmersion/);
  assert.match(shader, /uShapeShift/);
  assert.match(shader, /crystalDistance/);
  assert.match(shader, /rosetteDistance/);
  assert.match(shader, /prismaticVeil/);
  assert.match(shader, /kaleidoscopeMembrane/);
  assert.match(shader, /psychedelicContour/);
  assert.doesNotMatch(shader, /gl_FragCoord/);

  geometry.dispose();
  material.dispose();
});
