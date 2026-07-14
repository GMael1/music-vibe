import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseSerpentZone, SERPENT_ROLES } from '../src/visualizers/SerpentInfluenceRouter.js';

function circularDistance(a, b) {
  const distance = Math.abs(a - b);
  return Math.min(distance, 1 - distance);
}

test('assigns new tracks to stable well-separated serpent zones', () => {
  const zones = [];
  for (let i = 0; i < 6; i += 1) zones.push(chooseSerpentZone(zones));

  assert.equal(zones[0], 0.5);
  for (let i = 1; i < zones.length; i += 1) {
    const clearance = Math.min(...zones.slice(0, i).map(zone => circularDistance(zones[i], zone)));
    assert.ok(clearance >= 0.08);
  }
});

test('defines one automatic specialization for every supported track slot', () => {
  assert.deepEqual(SERPENT_ROLES, ['motion', 'skin', 'energy', 'light', 'atmosphere', 'accent']);
});
