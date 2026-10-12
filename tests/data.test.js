// Unit tests for the shared content helpers. Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const PF = require('../js/data.js');

test('normalize fills every section of an empty object', () => {
  const data = PF.normalize({});
  assert.strictEqual(data.site.theme, 'midnight');
  assert.deepStrictEqual(data.site.sections, PF.SECTION_IDS);
  assert.deepStrictEqual(data.projects, []);
  assert.strictEqual(data.profile.name, '');
});

test('normalize keeps unknown fields and drops broken entries', () => {
  const data = PF.normalize({
    custom: 42,
    site: { sections: ['projects', 'bogus', 'projects', 'about'] },
    projects: [{ title: 'A', media: [{ src: '' }, { src: 'media/a.webp' }, 'junk'] }, null],
    skills: [{ group: 'G', items: ['Python', { name: '' }, { name: 'C++', level: 3 }] }],
  });
  assert.strictEqual(data.custom, 42);
  assert.deepStrictEqual(data.site.sections, ['projects', 'about']);
  assert.strictEqual(data.projects.length, 1);
  assert.deepStrictEqual(data.projects[0].media, [{ src: 'media/a.webp' }]);
  assert.deepStrictEqual(data.skills[0].items, [{ name: 'Python' }, { name: 'C++', level: 3 }]);
});

test('normalize is stable when run twice', () => {
  const once = PF.normalize({ profile: { name: 'X' }, projects: [{ title: 'P' }] });
  assert.strictEqual(JSON.stringify(PF.normalize(JSON.parse(JSON.stringify(once)))), JSON.stringify(once));
});

test('dates format as "Mon YYYY" and ranges handle current roles', () => {
  assert.strictEqual(PF.formatMonth('2024-03'), 'Mar 2024');
  assert.strictEqual(PF.formatMonth('2024'), '2024');
  assert.strictEqual(PF.formatMonth('2024-13'), '2024-13');
  assert.strictEqual(PF.formatRange('2023-07', '2024-01'), 'Jul 2023 – Jan 2024');
  assert.strictEqual(PF.formatRange('2025-07', '', true), 'Jul 2025 – Present');
  assert.strictEqual(PF.formatRange('', '', false), '');
});

test('safeUrl blocks script links but keeps normal ones', () => {
  assert.strictEqual(PF.safeUrl('javascript:alert(1)'), '');
  assert.strictEqual(PF.safeUrl(' JavaScript:alert(1)'), '');
  assert.strictEqual(PF.safeUrl('data:text/html,hi'), '');
  assert.strictEqual(PF.safeUrl('https://github.com'), 'https://github.com');
  assert.strictEqual(PF.safeUrl('mailto:a@b.c'), 'mailto:a@b.c');
  assert.strictEqual(PF.safeUrl('media/photo.webp'), 'media/photo.webp');
});

test('YouTube IDs are read from all common link shapes', () => {
  const id = 'dQw4w9WgXcQ';
  for (const url of [
    'https://www.youtube.com/watch?v=' + id,
    'https://www.youtube.com/watch?feature=share&v=' + id,
    'https://youtu.be/' + id + '?t=10',
    'https://www.youtube.com/shorts/' + id,
    'https://www.youtube.com/embed/' + id,
    id,
  ]) assert.strictEqual(PF.youtubeId(url), id, url);
  assert.strictEqual(PF.youtubeId('https://example.com/video'), '');
});

test('media type is inferred from the link when not set', () => {
  assert.strictEqual(PF.mediaKind({ src: 'https://youtu.be/dQw4w9WgXcQ' }), 'youtube');
  assert.strictEqual(PF.mediaKind({ src: 'media/test-run.mp4' }), 'video');
  assert.strictEqual(PF.mediaKind({ src: 'media/robot.webp' }), 'image');
  assert.strictEqual(PF.mediaKind({ type: 'video', src: 'x' }), 'video');
});

test('projects show featured first, then newest, and skip hidden ones', () => {
  const list = PF.visibleProjects([
    { title: 'old', date: '2023-01', tags: [] },
    { title: 'hidden', date: '2026-01', hidden: true, tags: [] },
    { title: 'new', date: '2025-05', tags: [] },
    { title: 'star', date: '2020-01', featured: true, tags: [] },
  ]);
  assert.deepStrictEqual(list.map((p) => p.title), ['star', 'new', 'old']);
});

test('content file round-trips through serialize and parse', () => {
  const data = PF.normalize({ profile: { name: 'Robot "R2" Builder' }, about: 'Line 1\n\nLine 2' });
  const text = PF.serializeContent(data);
  assert.ok(text.includes('window.PORTFOLIO = {'));
  assert.deepStrictEqual(PF.parseContent(text), data);
  assert.deepStrictEqual(PF.parseContent(JSON.stringify(data)), data);
  assert.throws(() => PF.parseContent('nothing here'));
});

test('the shipped data/portfolio.js is valid', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'data', 'portfolio.js'), 'utf8');
  const data = PF.parseContent(text);
  assert.ok(data.profile.name);
  data.projects.forEach((p) => p.media.forEach((m) => {
    if (!/^https?:/.test(m.src)) assert.ok(fs.existsSync(path.join(__dirname, '..', m.src)), 'missing ' + m.src);
  }));
});
