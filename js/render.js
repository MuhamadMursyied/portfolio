// Builds the portfolio page from the content object. Everything is created with
// DOM calls and textContent, so content text can never inject markup.
(function (root) {
  'use strict';

  const PF = root.PF;

  // Editor preview swaps in local files that are not uploaded yet: { "media/x.webp": "blob:..." }.
  let mediaOverrides = {};
  const setMediaOverrides = (map) => { mediaOverrides = map || {}; };
  const resolveSrc = (src) => mediaOverrides[src] || PF.safeUrl(src);

  // h('a', { class: 'btn', href: url }, 'text', childNode)
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === false) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else if (key === 'href' || key === 'src') el.setAttribute(key, key === 'src' ? resolveSrc(value) : PF.safeUrl(value));
      else el.setAttribute(key, value === true ? '' : value);
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false || child === '') return;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  }

  const isExternal = (url) => /^https?:\/\//i.test(url);
  function linkAttrs(url) {
    return isExternal(url) ? { href: url, target: '_blank', rel: 'noopener' } : { href: url };
  }

  // Inline formatting: **bold**, *italic*, `code` and [text](url).
  function inline(text) {
    const out = [];
    const re = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      if (m[1]) out.push(h('strong', {}, m[1]));
      else if (m[2]) out.push(h('em', {}, m[2]));
      else if (m[3]) out.push(h('code', {}, m[3]));
      else out.push(PF.safeUrl(m[5]) ? h('a', linkAttrs(m[5]), m[4]) : m[4]);
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  // Block formatting: blank line = new paragraph, lines starting with "- " = bullet list.
  function richText(text, className) {
    const wrap = h('div', { class: 'rich ' + (className || '') });
    String(text || '').trim().split(/\n\s*\n/).forEach((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return;
      if (lines.every((l) => /^[-*•]\s+/.test(l))) {
        wrap.append(h('ul', {}, lines.map((l) => h('li', {}, inline(l.replace(/^[-*•]\s+/, ''))))));
      } else {
        const p = h('p');
        lines.forEach((l, i) => { if (i) p.append(h('br')); p.append(...inline(l)); });
        wrap.append(p);
      }
    });
    return wrap;
  }

  const tagList = (tags, className) => {
    const clean = (tags || []).map((t) => String(t).trim()).filter(Boolean);
    return clean.length ? h('ul', { class: 'tags ' + (className || '') }, clean.map((t) => h('li', {}, t))) : null;
  };

  function section(id, title, kicker, ...body) {
    return h('section', { class: 'section section-' + id, id, 'aria-labelledby': id + '-title' },
      h('div', { class: 'container' },
        h('header', { class: 'section-head' },
          kicker ? h('p', { class: 'kicker' }, kicker) : null,
          h('h2', { id: id + '-title' }, title)),
        ...body));
  }

  // ---------- media ----------

  function youtubeThumb(item) {
    const id = PF.youtubeId(item.src);
    return id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '';
  }

  // Thumbnail for cards and the gallery strip.
  function mediaThumb(item, alt) {
    const kind = PF.mediaKind(item);
    if (kind === 'image') return h('img', { src: item.src, alt: alt || item.caption || '', loading: 'lazy', decoding: 'async' });
    if (kind === 'youtube') return h('img', { src: item.poster || youtubeThumb(item), alt: alt || item.caption || 'Video', loading: 'lazy' });
    if (item.poster) return h('img', { src: item.poster, alt: alt || item.caption || 'Video', loading: 'lazy' });
    const video = h('video', { muted: true, playsinline: true, preload: 'metadata', 'aria-label': alt || item.caption || 'Video' });
    video.src = resolveSrc(item.src) + '#t=0.5'; // show a frame instead of black
    return video;
  }

  // Full-size viewer used in the project dialog.
  function mediaFull(item, title) {
    const kind = PF.mediaKind(item);
    if (kind === 'youtube') {
      const id = PF.youtubeId(item.src);
      if (!id) return h('p', { class: 'media-error' }, 'This YouTube link could not be read.');
      return h('iframe', {
        src: 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0',
        title: item.caption || title || 'YouTube video',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: true, loading: 'lazy', referrerpolicy: 'strict-origin-when-cross-origin',
      });
    }
    if (kind === 'video') return h('video', { src: item.src, controls: true, playsinline: true, preload: 'metadata', poster: item.poster ? resolveSrc(item.poster) : null });
    return h('img', { src: item.src, alt: item.caption || title || '' });
  }

  // ---------- sections ----------

  function renderNav(data, sections, themeSelect) {
    const p = data.profile;
    const links = sections.filter((s) => s.el).map((s) => h('a', { href: '#' + s.id }, s.label));
    const toggle = h('button', { class: 'nav-toggle', type: 'button', 'aria-expanded': 'false', 'aria-label': 'Menu' }, h('span'), h('span'), h('span'));
    const menu = h('div', { class: 'nav-menu' }, links, themeSelect);
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('open', open);
    });
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) { toggle.setAttribute('aria-expanded', 'false'); menu.classList.remove('open'); }
    });
    return h('nav', { class: 'topnav', 'aria-label': 'Main' },
      h('div', { class: 'container nav-inner' },
        h('a', { class: 'brand', href: '#top' }, h('span', { class: 'brand-mark' }, PF.initials(p.name)), h('span', { class: 'brand-name' }, p.name || 'Portfolio')),
        toggle, menu));
  }

  function renderHero(data) {
    const p = data.profile;
    const avatar = p.avatar
      ? h('img', { class: 'avatar', src: p.avatar, alt: p.name })
      : h('div', { class: 'avatar avatar-initials', 'aria-hidden': 'true' }, PF.initials(p.name));
    const actions = [];
    if (data.site.sections.includes('projects') && PF.visibleProjects(data.projects).length) {
      actions.push(h('a', { class: 'btn primary', href: '#projects' }, 'View projects'));
    }
    if (p.email) actions.push(h('a', { class: 'btn', href: 'mailto:' + p.email }, PF.icon('mail'), 'Email me'));
    if (p.resume) actions.push(h('a', Object.assign({ class: 'btn' }, linkAttrs(p.resume), { href: resolveSrc(p.resume) }), PF.icon('download'), 'Résumé'));
    const socials = p.links.filter((l) => PF.safeUrl(l.url)).map((l) =>
      h('a', Object.assign({ class: 'icon-link', title: l.label, 'aria-label': l.label }, linkAttrs(l.url)), PF.icon(PF.linkIcon(l.url))));

    return h('header', { class: 'hero', id: 'top' },
      h('div', { class: 'container hero-inner' },
        h('div', { class: 'hero-text' },
          p.status ? h('p', { class: 'status' }, h('span', { class: 'status-dot' }), p.status) : null,
          h('h1', {}, p.name || 'Your name'),
          p.headline ? h('p', { class: 'headline' }, p.headline) : null,
          p.tagline ? h('p', { class: 'tagline' }, inline(p.tagline)) : null,
          p.location ? h('p', { class: 'location' }, PF.icon('pin'), p.location) : null,
          actions.length || socials.length ? h('div', { class: 'hero-actions' }, actions, socials.length ? h('div', { class: 'socials' }, socials) : null) : null),
        h('div', { class: 'hero-visual' }, avatar)));
  }

  function renderAbout(data) {
    if (!data.about.trim()) return null;
    return section('about', 'About me', 'Who I am', richText(data.about, 'about-text'));
  }

  const STAGES = { now: 'Now', next: 'Next', future: 'Future' };

  function renderFocus(data) {
    const items = data.focus.filter((f) => !f.hidden && (f.title || '').trim());
    if (!items.length) return null;
    return section('focus', 'Where I am heading', 'Focus areas',
      h('ol', { class: 'focus-track' }, items.map((f) => h('li', { class: 'focus-card stage-' + (f.stage || 'now') },
        h('div', { class: 'focus-top' },
          h('span', { class: 'focus-icon' }, PF.icon(f.icon || 'ugv')),
          h('span', { class: 'stage-badge' }, STAGES[f.stage] || STAGES.now)),
        h('h3', {}, f.title),
        f.description ? richText(f.description) : null,
        tagList(f.topics)))));
  }

  function renderSkills(data) {
    const groups = data.skills.filter((g) => !g.hidden && g.items.length);
    if (!groups.length) return null;
    const showLevels = !!data.site.showSkillLevels;
    return section('skills', 'Skills', 'What I work with',
      h('div', { class: 'skill-grid' }, groups.map((g) => h('article', { class: 'skill-group' },
        h('h3', {}, g.group || 'Skills'),
        h('ul', { class: showLevels ? 'skill-list levels' : 'skill-list' }, g.items.map((s) => {
          const level = Math.max(0, Math.min(5, Number(s.level) || 0));
          return h('li', {},
            h('span', { class: 'skill-name' }, s.name),
            showLevels && level ? h('span', { class: 'meter', role: 'img', 'aria-label': level + ' out of 5' },
              [1, 2, 3, 4, 5].map((n) => h('i', { class: n <= level ? 'on' : '' }))) : null);
        }))))));
  }

  function renderExperience(data) {
    const items = data.experience.filter((e) => !e.hidden && (e.role || e.org))
      .map((e, index) => ({ e, index }))
      .sort((a, b) => PF.dateKey(b.e.end, b.e.current).localeCompare(PF.dateKey(a.e.end, a.e.current))
        || PF.dateKey(b.e.start).localeCompare(PF.dateKey(a.e.start)) || a.index - b.index)
      .map(({ e }) => e);
    if (!items.length) return null;
    return section('experience', 'Experience', 'Where I have worked',
      h('ol', { class: 'timeline' }, items.map((e) => h('li', { class: 'timeline-item' + (e.current ? ' current' : '') },
        h('p', { class: 'when' }, PF.formatRange(e.start, e.end, e.current)),
        h('div', { class: 'timeline-body' },
          h('h3', {}, e.role || e.org,
            e.role && e.org ? h('span', { class: 'org' }, ' · ',
              e.orgUrl ? h('a', linkAttrs(e.orgUrl), e.org) : e.org) : null),
          e.location || e.type ? h('p', { class: 'muted small' }, [e.type, e.location].filter(Boolean).join(' · ')) : null,
          e.summary ? richText(e.summary) : null,
          e.highlights.filter((x) => x.trim()).length ? h('ul', { class: 'highlights' }, e.highlights.filter((x) => x.trim()).map((x) => h('li', {}, inline(x)))) : null,
          tagList(e.tags, 'small'))))));
  }

  function projectCard(project, open) {
    const cover = project.media.find((m) => m.cover) || project.media[0];
    const kind = cover ? PF.mediaKind(cover) : null;
    const videos = project.media.filter((m) => PF.mediaKind(m) !== 'image').length;
    return h('li', { class: 'project-card' + (project.featured ? ' featured' : ''), 'data-tags': project.tags.join('|') },
      h('button', { type: 'button', class: 'project-open', onclick: () => open(project), 'aria-label': 'Open ' + project.title },
        h('div', { class: 'project-cover' + (cover ? '' : ' empty') },
          cover ? mediaThumb(cover, project.title) : PF.icon(project.icon || 'code', 'cover-icon'),
          kind && kind !== 'image' ? h('span', { class: 'play-badge' }, PF.icon('play')) : null,
          project.media.length > 1 ? h('span', { class: 'count-badge' }, PF.icon('image'), String(project.media.length)) : null,
          project.featured ? h('span', { class: 'featured-badge' }, 'Featured') : null),
        h('div', { class: 'project-body' },
          h('h3', {}, project.title || 'Untitled project'),
          project.date || project.role ? h('p', { class: 'muted small' }, [PF.formatMonth(project.date), project.role].filter(Boolean).join(' · ')) : null,
          project.summary ? h('p', { class: 'summary' }, project.summary) : null,
          tagList(project.tags, 'small'),
          videos ? h('span', { class: 'sr-only' }, 'Includes video') : null)));
  }

  function renderProjects(data, open) {
    const projects = PF.visibleProjects(data.projects);
    if (!projects.length) return null;
    const grid = h('ul', { class: 'project-grid' }, projects.map((p) => projectCard(p, open)));
    const tags = PF.projectTags(data.projects, 10);
    let filter = null;
    if (tags.length > 1 && projects.length > 2) {
      const chips = ['All'].concat(tags).map((tag) => h('button', {
        type: 'button', class: 'chip' + (tag === 'All' ? ' active' : ''), 'aria-pressed': String(tag === 'All'),
        onclick: (e) => {
          filter.querySelectorAll('.chip').forEach((c) => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
          e.currentTarget.classList.add('active');
          e.currentTarget.setAttribute('aria-pressed', 'true');
          grid.querySelectorAll('.project-card').forEach((card) => {
            card.hidden = tag !== 'All' && !card.dataset.tags.split('|').includes(tag);
          });
        },
      }, tag));
      filter = h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter projects by tag' }, chips);
    }
    return section('projects', 'Projects', 'Things I have built', filter, grid);
  }

  function renderEducation(data) {
    const edu = data.education.filter((e) => !e.hidden && (e.qualification || e.school));
    const certs = data.certifications.filter((c) => !c.hidden && c.name);
    if (!edu.length && !certs.length) return null;
    return section('education', certs.length && edu.length ? 'Education & certifications' : (edu.length ? 'Education' : 'Certifications'), 'Learning',
      h('div', { class: 'edu-grid' },
        edu.map((e) => h('article', { class: 'edu-card' },
          h('p', { class: 'when' }, PF.formatRange(e.start, e.end, false)),
          h('h3', {}, e.qualification || e.school),
          e.qualification && e.school ? h('p', { class: 'org' }, e.school, e.location ? ' · ' + e.location : '') : null,
          e.grade ? h('p', { class: 'muted small' }, e.grade) : null,
          e.details.filter((x) => x.trim()).length ? h('ul', { class: 'highlights' }, e.details.filter((x) => x.trim()).map((x) => h('li', {}, inline(x)))) : null)),
        certs.length ? h('article', { class: 'edu-card certs' },
          h('h3', {}, 'Certifications'),
          h('ul', { class: 'cert-list' }, certs.map((c) => h('li', {},
            c.url ? h('a', linkAttrs(c.url), c.name) : h('span', {}, c.name),
            h('span', { class: 'muted small' }, [c.issuer, PF.formatMonth(c.date)].filter(Boolean).join(' · ')))))) : null));
  }

  function renderContact(data) {
    const p = data.profile;
    const links = p.links.filter((l) => PF.safeUrl(l.url));
    if (!p.email && !links.length && !p.contactNote) return null;
    return section('contact', 'Get in touch', 'Contact',
      h('div', { class: 'contact-box' },
        p.contactNote ? richText(p.contactNote, 'contact-note') : null,
        h('div', { class: 'contact-actions' },
          p.email ? h('a', { class: 'btn primary', href: 'mailto:' + p.email }, PF.icon('mail'), p.email) : null,
          links.map((l) => h('a', Object.assign({ class: 'btn' }, linkAttrs(l.url)), PF.icon(PF.linkIcon(l.url)), l.label || l.url)))));
  }

  // ---------- project dialog ----------

  function openProject(dialog, project) {
    let index = Math.max(0, project.media.findIndex((m) => m.cover));
    const stage = h('div', { class: 'gallery-stage' });
    const caption = h('p', { class: 'gallery-caption muted small' });
    const strip = project.media.length > 1 ? h('div', { class: 'gallery-strip' }) : null;

    function show(i) {
      if (!project.media.length) return;
      index = (i + project.media.length) % project.media.length;
      const item = project.media[index];
      stage.replaceChildren(mediaFull(item, project.title));
      caption.textContent = item.caption || '';
      if (strip) strip.querySelectorAll('button').forEach((b, n) => b.classList.toggle('active', n === index));
    }

    if (strip) {
      project.media.forEach((m, i) => strip.append(h('button', { type: 'button', 'aria-label': 'Show item ' + (i + 1), onclick: () => show(i) },
        mediaThumb(m, ''), PF.mediaKind(m) !== 'image' ? h('span', { class: 'play-badge small' }, PF.icon('play')) : null)));
    }

    const nav = project.media.length > 1 ? [
      h('button', { type: 'button', class: 'gallery-nav prev', 'aria-label': 'Previous', onclick: () => show(index - 1) }, PF.icon('left')),
      h('button', { type: 'button', class: 'gallery-nav next', 'aria-label': 'Next', onclick: () => show(index + 1) }, PF.icon('right')),
    ] : [];

    const links = project.links.filter((l) => PF.safeUrl(l.url));
    dialog.replaceChildren(h('div', { class: 'dialog-inner' },
      h('button', { type: 'button', class: 'dialog-close', 'aria-label': 'Close', onclick: () => dialog.close() }, PF.icon('close')),
      project.media.length ? h('div', { class: 'gallery' }, h('div', { class: 'gallery-frame' }, stage, nav), caption, strip) : null,
      h('div', { class: 'dialog-body' },
        h('h2', {}, project.title),
        project.date || project.role ? h('p', { class: 'muted' }, [PF.formatMonth(project.date), project.role].filter(Boolean).join(' · ')) : null,
        tagList(project.tags),
        project.description ? richText(project.description) : (project.summary ? h('p', {}, project.summary) : null),
        links.length ? h('div', { class: 'dialog-links' }, links.map((l) =>
          h('a', Object.assign({ class: 'btn' }, linkAttrs(l.url)), PF.icon(PF.linkIcon(l.url)), l.label || 'Link'))) : null)));

    dialog.onkeydown = (e) => {
      if (e.target.closest('input, textarea, video, iframe')) return;
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
    };
    show(index);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('.dialog-close').focus();
  }

  // ---------- page ----------

  // Renders the whole page into `mount`. Returns { openProjectById } for deep links.
  function renderPage(mount, data, options) {
    const opts = options || {};
    const dialog = h('dialog', { class: 'project-dialog', 'aria-label': 'Project details' });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      dialog.replaceChildren(); // stops any playing video
      if (location.hash.startsWith('#project-') && !opts.preview) history.replaceState(null, '', location.pathname + location.search);
    });
    const open = (project) => {
      if (!opts.preview) history.replaceState(null, '', '#project-' + (project.id || PF.slugify(project.title)));
      openProject(dialog, project);
    };

    const builders = {
      about: renderAbout, focus: renderFocus, skills: renderSkills, experience: renderExperience,
      projects: (d) => renderProjects(d, open), education: renderEducation, contact: renderContact,
    };
    const sections = data.site.sections.map((id) => ({
      id, label: (PF.SECTIONS.find((s) => s.id === id) || {}).label, el: builders[id](data),
    }));

    const year = new Date().getFullYear();
    mount.replaceChildren(
      h('a', { class: 'skip-link', href: '#main' }, 'Skip to content'),
      renderNav(data, sections, opts.themeSelect || null),
      h('main', { id: 'main' }, renderHero(data), sections.map((s) => s.el)),
      h('footer', { class: 'site-footer' }, h('div', { class: 'container' },
        h('p', {}, '© ' + year + ' ' + (data.profile.name || ''),
          data.site.sourceUrl ? [h('span', { class: 'muted' }, ' · '), h('a', linkAttrs(data.site.sourceUrl), 'Source on GitHub')] : null))),
      dialog);

    return {
      openProjectById(id) {
        const project = PF.visibleProjects(data.projects).find((p) => (p.id || PF.slugify(p.title)) === id);
        if (project) openProject(dialog, project);
      },
    };
  }

  root.PF = Object.assign(root.PF || {}, { h, renderPage, setMediaOverrides, richText });
})(window);
