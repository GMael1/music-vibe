import assert from 'node:assert/strict';
import test from 'node:test';

import { detectLocale, normalizeLocale, translate } from '../src/i18n.js';

test('normalizes supported regional language tags', () => {
  assert.equal(normalizeLocale('fr-FR'), 'fr');
  assert.equal(normalizeLocale('EN-gb'), 'en');
  assert.equal(normalizeLocale('de-DE'), null);
});

test('prefers a saved language over browser preferences', () => {
  assert.equal(detectLocale('en', ['fr-FR']), 'en');
  assert.equal(detectLocale('fr', ['en-GB']), 'fr');
});

test('uses the first supported browser language and falls back to English', () => {
  assert.equal(detectLocale(null, ['de-DE', 'fr-FR', 'en-GB']), 'fr');
  assert.equal(detectLocale(null, ['de-DE']), 'en');
});

test('translates French copy, interpolates values, and falls back to English', () => {
  assert.equal(translate('fr', 'app.masterOutput'), 'Sortie principale');
  assert.equal(
    translate('fr', 'track.remove', { name: 'Piano' }),
    'Supprimer Piano',
  );
  assert.equal(translate('de', 'app.controls'), 'Controls');
  assert.equal(
    translate('fr', 'app.cancelExportProgress', { progress: 42 }),
    'Annuler 42 %',
  );
  assert.equal(
    translate('en', 'app.offlineExportSuccess', { format: 'MP4' }),
    'High-quality MP4 exported',
  );
});
