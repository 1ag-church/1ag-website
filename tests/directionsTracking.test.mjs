import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectionsTracker } from '../src/directionsTracking.mjs';

function fixture(hostname = '1ag.tv', hash = '#visit') {
  const scripts = [];
  const win = { location: { hostname, hash, search: '?gclid=example&email=private@example.com' } };
  const doc = { createElement: () => ({}), head: { appendChild: (s) => scripts.push(s) } };
  const tracker = createDirectionsTracker(win, doc);
  const events = () => (win.dataLayer || []).map(a => Array.from(a));
  const conversions = () => events().filter(a => a[0] === 'event' && a[1] === 'conversion');
  return { win, scripts, tracker, events, conversions };
}

test('opening the visit page installs one tag and records no conversion', () => {
  const f = fixture();
  assert.equal(f.tracker.initialize(), true);
  assert.equal(f.tracker.initialize(), true);
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=AW-10877264762');
  assert.equal(f.conversions().length, 0);
  const config = f.events().find(a => a[0] === 'config')[2];
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.restricted_data_processing, true);
  assert.equal(config.page_location, 'https://1ag.tv/?gclid=example#visit');
  assert.equal(config.page_referrer, '');
  assert.equal(config.send_page_view, false);
  assert.ok(!JSON.stringify(f.events()).includes('private@example.com'));
});

test('a real directions click sends the verified conversion label once per page lifetime', () => {
  const f = fixture();
  assert.equal(f.tracker.track({ isTrusted: false }), false);
  assert.equal(f.tracker.track({ isTrusted: true, defaultPrevented: true }), false);
  assert.equal(f.tracker.track({ isTrusted: true }), true);
  assert.equal(f.tracker.track({ isTrusted: true }), false);
  assert.equal(f.conversions().length, 1);
  assert.equal(f.conversions()[0][2].send_to, 'AW-10877264762/2_IeCLi-1rADEPrG18Io');
});

test('previews, staff pages, and ordinary site navigation cannot send conversions', () => {
  for (const [host, hash] of [['localhost', '#visit'], ['deploy-preview-1--1ag-website.netlify.app', '#visit'], ['1ag.tv', '#admin'], ['1ag.tv', '#home']]) {
    const f = fixture(host, hash);
    assert.equal(f.tracker.initialize(), false);
    assert.equal(f.tracker.track({ isTrusted: true }), false);
    assert.equal(f.scripts.length, 0);
    assert.equal(f.conversions().length, 0);
  }
  const f = fixture();
  f.tracker.initialize();
  f.win.location.hash = '#admin';
  assert.equal(f.tracker.track({ isTrusted: true }), false);
  assert.equal(f.conversions().length, 0);
});

test('blocked tag initialization fails safely without intercepting the directions link', () => {
  const win = { location: { hostname: '1ag.tv', hash: '#visit' } };
  const tracker = createDirectionsTracker(win, { createElement: () => { throw Error('blocked'); } });
  assert.equal(tracker.track({ isTrusted: true }), false);
});
