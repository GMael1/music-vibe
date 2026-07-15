import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSerpentFieldConfig,
  getJourneyDynamics,
  getLayerMaskConfig,
  serpentLanesHaveClearance,
} from '../src/visualizers/VisualDynamics.js';

test('makes meditative motion substantially calmer while retaining a response', () => {
  const meditative = getJourneyDynamics(0);
  const ecstatic = getJourneyDynamics(1);

  assert.ok(meditative.motionScale > 0);
  assert.ok(ecstatic.motionScale > meditative.motionScale * 8);
  assert.ok(meditative.audioAttack < ecstatic.audioAttack);
  assert.ok(meditative.onsetScale < ecstatic.onsetScale);
});

test('uses soft spatial masks instead of rectangular layer transforms', () => {
  const background = getLayerMaskConfig('background');
  const center = getLayerMaskConfig('center');
  const corner = getLayerMaskConfig('top-left');

  assert.ok(background.radius > 4);
  assert.deepEqual(center.anchor, [0.5, 0.5]);
  assert.ok(center.feather > 0.3);
  assert.ok(corner.anchor[0] < 0.5 && corner.anchor[1] > 0.5);
});

test('creates deterministic parallel serpent corridors with permanent clearance', () => {
  const first = createSerpentFieldConfig(1234);
  const second = createSerpentFieldConfig(1234);

  assert.deepEqual(first, second);
  assert.equal(serpentLanesHaveClearance(first), true);
  assert.ok(first.lanes.every(lane => lane.direction === -1 || lane.direction === 1));
  assert.ok(new Set(first.lanes.map(lane => lane.speed)).size > 1);
});
