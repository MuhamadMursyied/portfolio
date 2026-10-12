// Shared helpers for the site and the editor: content defaults, dates, URLs,
// media detection and reading/writing the content file.
// Plain script (no modules) so the site also works when opened from file://.
// In Node it exports the same functions for the unit tests.
(function (root) {
  'use strict';

  const SECTIONS = [
    { id: 'about', label: 'About' },
    { id: 'focus', label: 'Focus' },
    { id: 'skills', label: 'Skills' },
    { id: 'experience', label: 'Experience' },
    { id: 'projects', label: 'Projects' },
    { id: 'education', label: 'Education' },
    { id: 'contact', label: 'Contact' },
  ];
  const SECTION_IDS = SECTIONS.map((s) => s.id);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function blankPortfolio() {
    return {
      site: {
        title: '',
        description: '',
        theme: 'midnight',
        allowThemeSwitch: true,
        showSkillLevels: false,
        sections: SECTION_IDS.slice(),
        publish: { owner: '', repo: '', branch: 'main' },
      },
      profile: {
        name: '', headline: '', tagline: '', status: '', location: '',
        email: '', avatar: '', resume: '', contactNote: '', links: [],
      },
      about: '',
      focus: [],
      skills: [],
      experience: [],
      projects: [],
      education: [],
      certifications: [],
    };
  }

  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const asArray = (v) => (Array.isArray(v) ? v : []);
  const asString = (v) => (v === undefined || v === null ? '' : String(v));

  // Fill in anything missing so the renderer and editor never need null checks.
  // Unknown keys are kept, so hand-added fields survive a round trip through the editor.
  function normalize(input) {
    const data = isObject(input) ? input : {};
    const base = blankPortfolio();
    const site = Object.assign({}, base.site, isObject(data.site) ? data.site : {});
    site.publish = Object.assign({}, base.site.publish, isObject(site.publish) ? site.publish : {});
    const sections = asArray(site.sections).filter((id, i, all) => SECTION_IDS.includes(id) && all.indexOf(id) === i);
    site.sections = Array.isArray(site.sections) ? sections : SECTION_IDS.slice();

    const profile = Object.assign({}, base.profile, isObject(data.profile) ? data.profile : {});
    profile.links = asArray(profile.links).filter(isObject);

    const list = (key, fix) => asArray(data[key]).filter(isObject).map((item) => (fix ? fix(Object.assign({}, item)) : Object.assign({}, item)));

    return Object.assign({}, data, {
      site,
      profile,
      about: asString(data.about),
      focus: list('focus', (f) => Object.assign(f, { topics: asArray(f.topics).map(asString) })),
      skills: list('skills', (g) => Object.assign(g, {
        items: asArray(g.items).map((it) => (isObject(it) ? it : { name: asString(it) })).filter((it) => asString(it.name).trim()),
      })),
      experience: list('experience', (e) => Object.assign(e, { highlights: asArray(e.highlights).map(asString), tags: asArray(e.tags).map(asString) })),
      projects: list('projects', (p) => Object.assign(p, {
        tags: asArray(p.tags).map(asString),
        links: asArray(p.links).filter(isObject),
        media: asArray(p.media).filter((m) => isObject(m) && asString(m.src).trim()),
      })),
      education: list('education', (e) => Object.assign(e, { details: asArray(e.details).map(asString) })),
      certifications: list('certifications'),
    });
  }

  // "2024-03" -> "Mar 2024", "2024" -> "2024". Anything else is shown as typed.
  function formatMonth(value) {
    const text = asString(value).trim();
    const m = /^(\d{4})-(\d{1,2})$/.exec(text);
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return MONTHS[Number(m[2]) - 1] + ' ' + m[1];
    return text;
  }

  function formatRange(start, end, current) {
    const from = formatMonth(start);
    const to = current ? 'Present' : formatMonth(end);
    if (from && to && from !== to) return from + ' – ' + to;
    return from || to;
  }

  // Sort key for "YYYY-MM" / "YYYY" strings; current roles count as the newest.
  function dateKey(value, current) {
    if (current) return '9999-99';
    const text = asString(value).trim();
    const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(text);
    return m ? m[1] + '-' + String(m[2] || '0').padStart(2, '0') : '';
  }

  // Only allow link schemes that cannot run script. Relative paths are fine.
  function safeUrl(url) {
    const text = asString(url).trim();
    if (!text) return '';
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(text);
    if (!scheme) return text;
    return ['http', 'https', 'mailto', 'tel', 'blob'].includes(scheme[1].toLowerCase()) ? text : '';
  }

  function youtubeId(url) {
    const text = asString(url).trim();
    const patterns = [
      /youtu\.be\/([\w-]{11})/,
      /youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)([\w-]{11})/,
    ];
    for (const re of patterns) {
      const m = re.exec(text);
      if (m) return m[1];
    }
    return /^[\w-]{11}$/.test(text) ? text : '';
  }

  // Media type from the item, falling back to the file extension or URL.
  function mediaKind(item) {
    const type = asString(item && item.type).toLowerCase();
    if (['image', 'video', 'youtube'].includes(type)) return type;
    const src = asString(item && item.src).toLowerCase();
    if (/youtu\.?be/.test(src)) return 'youtube';
    if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/.test(src)) return 'video';
    return 'image';
  }

  function slugify(text) {
    return asString(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  function initials(name) {
    const parts = asString(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  // Pick an icon name for a link from its URL.
  function linkIcon(url) {
    const text = asString(url).toLowerCase();
    if (text.startsWith('mailto:')) return 'mail';
    if (text.includes('github.com')) return 'github';
    if (text.includes('linkedin.com')) return 'linkedin';
    if (text.includes('youtube.com') || text.includes('youtu.be')) return 'youtube';
    return 'link';
  }

  // Projects in display order: featured first, then newest first. Hidden ones are dropped.
  function visibleProjects(projects) {
    return asArray(projects)
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => !p.hidden)
      .sort((a, b) => (Number(!!b.p.featured) - Number(!!a.p.featured))
        || dateKey(b.p.date).localeCompare(dateKey(a.p.date))
        || a.index - b.index)
      .map(({ p }) => p);
  }

  // Tags across all visible projects, most used first.
  function projectTags(projects, limit) {
    const counts = new Map();
    visibleProjects(projects).forEach((p) => p.tags.forEach((t) => {
      const tag = t.trim();
      if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
    }));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit || 12).map(([tag]) => tag);
  }

  // The content file is JavaScript (so it loads from file:// too) holding one JSON object.
  const FILE_HEADER = '// Portfolio content. Edit it with editor.html, or by hand: everything after\n'
    + '// "window.PORTFOLIO = " must stay valid JSON.\n';

  function serializeContent(data) {
    return FILE_HEADER + 'window.PORTFOLIO = ' + JSON.stringify(data, null, 2) + ';\n';
  }

  // Accepts the .js content file or plain JSON.
  function parseContent(text) {
    const source = asString(text);
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('No portfolio data found in this file.');
    return normalize(JSON.parse(source.slice(start, end + 1)));
  }

  const PF = {
    SECTIONS, SECTION_IDS, blankPortfolio, normalize, formatMonth, formatRange, dateKey,
    safeUrl, youtubeId, mediaKind, slugify, initials, linkIcon, visibleProjects, projectTags,
    serializeContent, parseContent,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PF;
  else root.PF = Object.assign(root.PF || {}, PF);
})(typeof window !== 'undefined' ? window : globalThis);
