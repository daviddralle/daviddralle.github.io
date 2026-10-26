import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../field-sites/rancho/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const context = { localStorage: { getItem: () => null }, console };
vm.runInNewContext(script.slice(0, script.indexOf('    const historyState')) + '\nthis.windowRain = recentRainWindow;', context);
const calculate = context.windowRain;
const latest = Date.parse('2026-10-26T10:00:00-07:00');
const point = (hoursAgo, rain) => ({ t: new Date(latest - hoursAgo * 3600000).toISOString(), rain_in: rain });
const data = (points) => ({ current: { timestamp: new Date(latest).toISOString() }, live_7d: points });

test('each window accumulates only its own observations, even across midnight', () => {
  const input = data([point(170, 50), point(100, 4), point(60, 3), point(30, 2), point(10, 1), point(0, .25), point(-1, 100)]);
  for (const [range, expected] of [['24h', 1.25], ['48h', 3.25], ['72h', 6.25], ['7d', 10.25]]) {
    const result = calculate(input, range);
    assert.equal(result.total, expected);
    assert.equal(result.points.at(-1).rain_cumulative_in, expected);
  }
  assert.equal(input.live_7d[0].rain_cumulative_in, undefined, 'source data remains unchanged');
});

test('exact window boundaries are included and out-of-window observations excluded', () => {
  for (const [range, hours] of [['24h', 24], ['48h', 48], ['72h', 72], ['7d', 168]]) {
    assert.equal(calculate(data([point(hours + .001, 9), point(hours, .1), point(0, .2)]), range).total, .3);
  }
});

test('missing and invalid rainfall remain unknown rather than appearing dry', () => {
  for (const points of [[], [point(0, null)], [point(0, -1)], [point(0, 'bad')]]) {
    assert.equal(calculate(data(points), '24h').total, null);
  }
  const result = calculate(data([point(1, .1), point(.5, null), point(0, .2)]), '24h');
  assert.equal(result.total, .3);
  assert.equal(result.points[1].rain_cumulative_in, null);
  assert.equal(result.incomplete, true);
});

test('complete dry records display zero; gaps and truncated coverage are flagged', () => {
  const points = Array.from({ length: 97 }, (_, i) => point(24 - i / 4, 0));
  const complete = calculate(data(points), '24h');
  assert.equal(complete.total, 0);
  assert.equal(complete.incomplete, false);
  assert.equal(calculate(data(points.slice(1, -1)), '24h').incomplete, false, 'normal quarter-hour edge alignment');
  assert.equal(calculate(data(points.slice(2)), '24h').incomplete, true);
  assert.equal(calculate(data(points.filter((_, i) => i !== 50)), '24h').incomplete, true);
});

test('unsorted samples yield chronological, nondecreasing accumulation', () => {
  const result = calculate(data([point(0, .1), point(2, .1), point(1, .1)]), '24h');
  assert.equal(JSON.stringify(result.points.map(p => p.rain_cumulative_in)), '[0.1,0.2,0.3]');
});
