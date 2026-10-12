// The in-browser editor. Works on a copy of the content, autosaves it as a draft in
// this browser, shows a live preview, and publishes via download or the GitHub API.
(function () {
  'use strict';

  const PF = window.PF;
  const h = PF.h;
  const DRAFT_KEY = 'portfolio-draft';
  const TOKEN_KEY = 'portfolio-github-token';
  const RICH_HELP = 'Blank line = new paragraph · "- " at line start = bullet · **bold** · [link text](https://…)';

  let published;       // content from data/portfolio.js
  let publishedHash;
  let content;         // the working copy everything edits
  let meta;            // { base, savedAt, publishedAt } stored with the draft
  let files = [];      // local files not yet on GitHub: [{ path, blob, published }]
  const objectUrls = {};
  let currentTab = 'profile';
  let memoryToken = '';
  let uid = 0;

  const $ = (sel) => document.querySelector(sel);
  const clone = (v) => JSON.parse(JSON.stringify(v));

  function hash(text) {
    let x = 5381;
    for (let i = 0; i < text.length; i++) x = ((x * 33) ^ text.charCodeAt(i)) >>> 0;
    return x.toString(16);
  }
  const contentHash = (c) => hash(JSON.stringify(PF.normalize(clone(c))));

  // ---------- draft + preview ----------

  let saveTimer = null;
  let previewTimer = null;

  function changed() {
    clearTimeout(saveTimer);
    clearTimeout(previewTimer);
    saveTimer = setTimeout(saveDraft, 300);
    previewTimer = setTimeout(() => sendPreview(), 200);
    setStatus('Saving…');
  }

  function saveDraft() {
    meta.savedAt = Date.now();
    writeDraft();
  }

  // Stores the draft without marking it as edited (used after publish or discard).
  function writeDraft() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ content, meta }));
      updateStatus();
    } catch (e) {
      setStatus('Could not save the draft in this browser (storage full or private mode). Download your content from Publish.', true);
    }
  }

  function setStatus(text, warn) {
    const el = $('#ed-status');
    el.textContent = text;
    el.classList.toggle('warn', !!warn);
  }

  function pendingFiles() {
    const used = referencedPaths();
    return files.filter((f) => !f.published && used.has(f.path));
  }

  function updateStatus() {
    const pending = pendingFiles().length;
    const unpublished = meta.savedAt > meta.publishedAt;
    const parts = [meta.savedAt ? 'Draft saved in this browser' : 'Showing the published version'];
    if (unpublished) parts.push('not published yet');
    if (pending) parts.push(pending + ' new file' + (pending > 1 ? 's' : '') + ' to upload');
    setStatus(parts.join(' · '));
    const badge = $('#tab-publish .ed-dot');
    if (badge) badge.hidden = !(unpublished || pending);
  }

  function sendPreview(scrollTo) {
    const frame = $('#preview-frame');
    if (!frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'portfolio-preview', content: clone(content), media: objectUrls, scrollTo }, '*');
  }

  window.addEventListener('message', (event) => {
    if (event.source === $('#preview-frame').contentWindow && event.data && event.data.type === 'portfolio-preview-ready') sendPreview();
  });

  // Every file path the content points at (avatar, résumé, project media).
  function referencedPaths() {
    const paths = new Set([content.profile.avatar, content.profile.resume]);
    content.projects.forEach((p) => p.media.forEach((m) => { paths.add(m.src); if (m.poster) paths.add(m.poster); }));
    return paths;
  }

  function toast(text, warn) {
    const el = h('div', { class: 'ed-toast' + (warn ? ' warn' : ''), role: 'status' }, text);
    document.body.append(el);
    setTimeout(() => el.remove(), warn ? 7000 : 3500);
  }

  async function addUpload(file) {
    const result = await PF.mediaStore.addFile(file);
    files.push({ path: result.path, blob: result.blob, published: false });
    objectUrls[result.path] = URL.createObjectURL(result.blob);
    PF.setMediaOverrides(objectUrls);
    if (result.blob.size < result.originalSize * 0.8) {
      toast('Resized ' + file.name + ' from ' + kb(result.originalSize) + ' to ' + kb(result.blob.size) + '.');
    }
    return result.path;
  }

  const kb = (bytes) => (bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.ceil(bytes / 1024) + ' KB');
  const resolve = (src) => objectUrls[src] || PF.safeUrl(src);

  // ---------- form fields ----------

  const toLines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);
  const pairs = {
    links: {
      format: (arr) => arr.map((l) => (l.label ? l.label + ' | ' + (l.url || '') : l.url || '')).join('\n'),
      parse: (text) => toLines(text).map((line) => {
        const parts = line.split('|').map((s) => s.trim());
        return parts.length > 1 ? { label: parts[0], url: parts.slice(1).join('|').trim() } : { label: '', url: parts[0] };
      }),
    },
    skills: {
      format: (arr) => arr.map((s) => (s.level ? s.name + ' | ' + s.level : s.name)).join('\n'),
      parse: (text) => toLines(text).map((line) => {
        const [name, level] = line.split('|').map((s) => s.trim());
        const n = parseInt(level, 10);
        return n >= 1 && n <= 5 ? { name, level: n } : { name };
      }),
    },
  };

  // spec: { key, label, type, help, placeholder, options, rows, accept }
  function field(obj, spec, after) {
    const id = 'f' + (++uid);
    const set = (value) => { obj[spec.key] = value; changed(); if (after) after(); };
    const helpText = [spec.help, spec.type === 'rich' ? RICH_HELP : ''].filter(Boolean).join(' ');
    const help = helpText ? h('p', { class: 'ed-help' }, helpText) : null;
    const label = h('label', { for: id }, spec.label);
    let control;

    switch (spec.type) {
      case 'checkbox':
        control = h('input', { type: 'checkbox', id });
        control.checked = !!obj[spec.key];
        control.addEventListener('change', () => set(control.checked));
        return h('div', { class: 'ed-field ed-check' }, control, label, help);
      case 'select':
        control = h('select', { id }, spec.options.map((o) => h('option', { value: o.value }, o.label)));
        control.value = obj[spec.key] || spec.options[0].value;
        control.addEventListener('change', () => set(control.value));
        break;
      case 'textarea':
      case 'rich':
        control = h('textarea', { id, rows: spec.rows || 4, placeholder: spec.placeholder });
        control.value = obj[spec.key] || '';
        control.addEventListener('input', () => set(control.value));
        break;
      case 'tags':
        control = h('input', { id, type: 'text', placeholder: spec.placeholder || 'Comma, separated, tags' });
        control.value = (obj[spec.key] || []).join(', ');
        control.addEventListener('input', () => set(control.value.split(',').map((s) => s.trim()).filter(Boolean)));
        break;
      case 'lines':
        control = h('textarea', { id, rows: spec.rows || 4, placeholder: spec.placeholder || 'One per line' });
        control.value = (obj[spec.key] || []).join('\n');
        control.addEventListener('input', () => set(toLines(control.value)));
        break;
      case 'links':
      case 'skills':
        control = h('textarea', { id, rows: spec.rows || 4, placeholder: spec.placeholder });
        control.value = pairs[spec.type].format(obj[spec.key] || []);
        control.addEventListener('input', () => set(pairs[spec.type].parse(control.value)));
        break;
      case 'image':
      case 'file':
        control = uploadControl(obj, spec, id, set);
        break;
      default:
        control = h('input', { id, type: spec.type || 'text', placeholder: spec.placeholder, autocomplete: 'off' });
        control.value = obj[spec.key] || '';
        control.addEventListener('input', () => set(control.value.trim() === '' ? '' : control.value));
    }
    return h('div', { class: 'ed-field' + (spec.wide ? ' wide' : '') }, label, control, help);
  }

  // Text box for a path or URL, plus an Upload button that stores the file locally.
  function uploadControl(obj, spec, id, set) {
    const input = h('input', { id, type: 'text', placeholder: spec.placeholder || 'Upload, or paste a URL' });
    input.value = obj[spec.key] || '';
    const thumb = spec.type === 'image' ? h('img', { class: 'ed-thumb', alt: '' }) : null;
    const refresh = () => {
      if (!thumb) return;
      thumb.hidden = !input.value;
      if (input.value) thumb.src = resolve(input.value);
    };
    const picker = h('input', { type: 'file', accept: spec.accept || '*/*', hidden: true });
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      picker.value = '';
      if (!file) return;
      try {
        input.value = await addUpload(file);
        set(input.value);
        refresh();
      } catch (e) { toast(e.message, true); }
    });
    input.addEventListener('input', () => { set(input.value.trim()); refresh(); });
    refresh();
    return h('div', { class: 'ed-upload' }, thumb, input, picker,
      h('button', { type: 'button', class: 'ed-btn', onclick: () => picker.click() }, 'Upload…'),
      h('button', { type: 'button', class: 'ed-btn ghost', title: 'Clear', onclick: () => { input.value = ''; set(''); refresh(); } }, 'Clear'));
  }

  function fieldGrid(obj, specs, after) {
    return h('div', { class: 'ed-grid' }, specs.map((s) => field(obj, s, after)));
  }

  function toolButton(text, label, disabled, action) {
    return h('button', {
      type: 'button', class: 'ed-tool', title: label, 'aria-label': label, disabled,
      onclick: (e) => { e.preventDefault(); e.stopPropagation(); action(); },
    }, text);
  }

  // Editable list of objects (experience, projects, …) with add, delete and reorder.
  function listEditor(arr, opts) {
    const wrap = h('div', { class: 'ed-list' });
    function move(i, step) {
      const j = i + step;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      changed();
      draw(j);
    }
    function draw(openIndex) {
      wrap.replaceChildren();
      arr.forEach((item, i) => {
        const title = h('span', { class: 'ed-item-title' }, opts.title(item) || 'Untitled');
        const hiddenBadge = h('span', { class: 'ed-badge' }, 'Hidden');
        hiddenBadge.hidden = !item.hidden;
        const refresh = () => { title.textContent = opts.title(item) || 'Untitled'; hiddenBadge.hidden = !item.hidden; };
        const body = h('div', { class: 'ed-item-body' }, fieldGrid(item, opts.fields, refresh), opts.extra ? opts.extra(item) : null);
        wrap.append(h('details', { class: 'ed-item', open: i === openIndex },
          h('summary', {}, title, hiddenBadge, h('span', { class: 'ed-item-tools' },
            toolButton('↑', 'Move up', i === 0, () => move(i, -1)),
            toolButton('↓', 'Move down', i === arr.length - 1, () => move(i, 1)),
            toolButton('✕', 'Delete', false, () => {
              if (!confirm('Delete "' + (opts.title(item) || 'this item') + '"?')) return;
              arr.splice(i, 1);
              changed();
              draw(-1);
            }))),
          body));
      });
      wrap.append(h('button', {
        type: 'button', class: 'ed-btn add',
        onclick: () => { arr.push(opts.create()); changed(); draw(arr.length - 1); },
      }, '+ ' + opts.addLabel));
    }
    draw(arr.length === 1 ? 0 : -1);
    return wrap;
  }

  // Images, videos and YouTube links of one project.
  function mediaEditor(project) {
    const wrap = h('div', { class: 'ed-media' });
    const picker = h('input', { type: 'file', accept: 'image/*,video/*', multiple: true, hidden: true });
    picker.addEventListener('change', async () => {
      const picked = [...picker.files];
      picker.value = '';
      for (const file of picked) {
        try {
          const path = await addUpload(file);
          project.media.push({ type: file.type.startsWith('video/') ? 'video' : 'image', src: path, caption: '' });
        } catch (e) { toast(e.message, true); }
      }
      changed();
      draw();
    });

    function thumbFor(m) {
      const kind = PF.mediaKind(m);
      if (kind === 'youtube') {
        const id = PF.youtubeId(m.src);
        return id ? h('img', { src: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg', alt: '' }) : h('span', { class: 'ed-thumb-bad' }, 'Bad link');
      }
      if (kind === 'video') {
        const v = h('video', { muted: true, preload: 'metadata' });
        v.src = resolve(m.src) + '#t=0.5';
        return v;
      }
      return h('img', { src: resolve(m.src), alt: '' });
    }

    function draw() {
      const items = project.media.map((m, i) => {
        const kindLabel = { image: 'Image', video: 'Video', youtube: 'YouTube' }[PF.mediaKind(m)];
        const caption = h('input', { type: 'text', placeholder: 'Caption (optional)', 'aria-label': 'Caption' });
        caption.value = m.caption || '';
        caption.addEventListener('input', () => { m.caption = caption.value; changed(); });
        const cover = h('input', { type: 'checkbox', 'aria-label': 'Use as card cover' });
        cover.checked = !!m.cover;
        cover.addEventListener('change', () => {
          project.media.forEach((other) => { delete other.cover; });
          if (cover.checked) m.cover = true;
          changed();
          draw();
        });
        return h('li', { class: 'ed-media-item' },
          h('div', { class: 'ed-media-thumb' }, thumbFor(m), h('span', { class: 'ed-kind' }, kindLabel)),
          h('div', { class: 'ed-media-fields' },
            h('p', { class: 'ed-media-src', title: m.src }, m.src),
            caption,
            h('label', { class: 'ed-inline' }, cover, ' Card cover'),
            h('span', { class: 'ed-item-tools' },
              toolButton('←', 'Move earlier', i === 0, () => { [project.media[i - 1], project.media[i]] = [project.media[i], project.media[i - 1]]; changed(); draw(); }),
              toolButton('→', 'Move later', i === project.media.length - 1, () => { [project.media[i + 1], project.media[i]] = [project.media[i], project.media[i + 1]]; changed(); draw(); }),
              toolButton('✕', 'Remove', false, () => { project.media.splice(i, 1); changed(); draw(); }))));
      });

      const urlInput = h('input', { type: 'url', placeholder: 'Paste a YouTube link, or an image/video URL', 'aria-label': 'Media link' });
      const addUrl = () => {
        const url = urlInput.value.trim();
        if (!url) return;
        if (!PF.safeUrl(url)) { toast('That link is not allowed.', true); return; }
        const kind = PF.mediaKind({ src: url });
        if (kind === 'youtube' && !PF.youtubeId(url)) { toast('Could not find a video ID in that YouTube link.', true); return; }
        project.media.push({ type: kind, src: url, caption: '' });
        changed();
        draw();
      };
      urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } });

      wrap.replaceChildren(
        h('p', { class: 'ed-label' }, 'Images & videos'),
        items.length ? h('ul', { class: 'ed-media-list' }, items) : h('p', { class: 'ed-help' }, 'No media yet. The first item is the card cover unless you tick another.'),
        h('div', { class: 'ed-media-add' },
          h('button', { type: 'button', class: 'ed-btn', onclick: () => picker.click() }, 'Upload images or videos…'),
          picker,
          h('div', { class: 'ed-url-row' }, urlInput, h('button', { type: 'button', class: 'ed-btn', onclick: addUrl }, 'Add link'))),
        h('p', { class: 'ed-help' }, 'Photos are resized automatically. Videos up to ' + PF.mediaStore.MAX_VIDEO_MB + ' MB can be uploaded; for longer clips use YouTube.'));
    }
    draw();
    return wrap;
  }

  // ---------- tabs ----------

  const STAGE_OPTIONS = [{ value: 'now', label: 'Now' }, { value: 'next', label: 'Next' }, { value: 'future', label: 'Future' }];
  const ICON_OPTIONS = PF.FOCUS_ICONS.map((id) => ({ value: id, label: { ugv: 'Ground robot (UGV)', uav: 'Drone (UAV)', usv: 'Boat (USV)', arm: 'Robot arm', chip: 'Electronics', code: 'Software' }[id] }));

  function card(title, intro, ...body) {
    return h('section', { class: 'ed-card' }, h('h2', {}, title), intro ? h('p', { class: 'ed-intro' }, intro) : null, ...body);
  }

  const TABS = [
    { id: 'site', label: 'Theme & layout', render: renderSiteTab },
    { id: 'profile', label: 'Profile', scroll: 'top', render: renderProfileTab },
    { id: 'about', label: 'About & focus', scroll: 'about', render: renderAboutTab },
    { id: 'skills', label: 'Skills', scroll: 'skills', render: renderSkillsTab },
    { id: 'experience', label: 'Experience', scroll: 'experience', render: renderExperienceTab },
    { id: 'projects', label: 'Projects', scroll: 'projects', render: renderProjectsTab },
    { id: 'education', label: 'Education', scroll: 'education', render: renderEducationTab },
    { id: 'publish', label: 'Publish', render: renderPublishTab },
  ];

  function renderSiteTab() {
    const themeGrid = h('div', { class: 'ed-themes', role: 'radiogroup', 'aria-label': 'Theme' });
    const drawThemes = () => themeGrid.replaceChildren(...PF.THEMES.map((t) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(content.site.theme === t.id),
      class: 'ed-theme' + (content.site.theme === t.id ? ' selected' : ''),
      onclick: () => { content.site.theme = t.id; changed(); drawThemes(); },
    },
    h('span', { class: 'ed-swatch', 'data-theme': t.id },
      h('span', { class: 'sw-title' }, 'Aa'), h('span', { class: 'sw-accent' }), h('span', { class: 'sw-line' }), h('span', { class: 'sw-line short' })),
    h('span', { class: 'ed-theme-name' }, t.name, h('small', {}, t.note)))));
    drawThemes();

    // Section order and visibility.
    const order = content.site.sections.concat(PF.SECTION_IDS.filter((id) => !content.site.sections.includes(id)));
    const visible = new Set(content.site.sections);
    const list = h('ol', { class: 'ed-sections' });
    const apply = () => { content.site.sections = order.filter((id) => visible.has(id)); changed(); };
    const drawSections = () => list.replaceChildren(...order.map((id, i) => {
      const box = h('input', { type: 'checkbox', id: 'sec-' + id });
      box.checked = visible.has(id);
      box.addEventListener('change', () => { if (box.checked) visible.add(id); else visible.delete(id); apply(); });
      const swap = (j) => { [order[i], order[j]] = [order[j], order[i]]; apply(); drawSections(); };
      return h('li', {}, box, h('label', { for: 'sec-' + id }, PF.SECTIONS.find((s) => s.id === id).label),
        h('span', { class: 'ed-item-tools' },
          toolButton('↑', 'Move up', i === 0, () => swap(i - 1)),
          toolButton('↓', 'Move down', i === order.length - 1, () => swap(i + 1))));
    }));
    drawSections();

    return [
      card('Theme', 'Pick the look of your site. The preview updates as you click.', themeGrid,
        fieldGrid(content.site, [
          { key: 'allowThemeSwitch', label: 'Let visitors switch themes', type: 'checkbox', help: 'Adds a theme menu to the top bar. Your choice above stays the default.' },
          { key: 'showSkillLevels', label: 'Show skill levels (1 to 5)', type: 'checkbox', help: 'Shows a small meter next to each skill that has a level.' },
        ])),
      card('Sections', 'Untick a section to hide it. Empty sections are hidden automatically.', list),
      card('Search & sharing', null, fieldGrid(content.site, [
        { key: 'title', label: 'Browser tab title', placeholder: 'Your Name · Robotics Engineer', wide: true },
        { key: 'description', label: 'Short description (for search engines)', type: 'textarea', rows: 2, wide: true },
        { key: 'sourceUrl', label: 'Link to this site\'s source code (optional)', type: 'url', placeholder: 'https://github.com/you/your-repo', wide: true },
      ])),
    ];
  }

  function renderProfileTab() {
    return [
      card('Profile', 'The top of your page.', fieldGrid(content.profile, [
        { key: 'name', label: 'Full name' },
        { key: 'headline', label: 'Headline', placeholder: 'Mechatronics Engineer · Robotics & UGV' },
        { key: 'tagline', label: 'One or two sentences about what you do', type: 'textarea', rows: 3, wide: true, help: 'Use **bold** to highlight a word.' },
        { key: 'status', label: 'Status line', placeholder: 'Open to robotics roles', help: 'Shown with a green dot. Leave empty to hide.' },
        { key: 'location', label: 'Location', placeholder: 'Kuala Lumpur, Malaysia' },
        { key: 'avatar', label: 'Profile photo', type: 'image', accept: 'image/*', wide: true, help: 'Square photos look best. Leave empty to show your initials.' },
      ])),
      card('Contact', 'Shown in the hero and in the Contact section.', fieldGrid(content.profile, [
        { key: 'email', label: 'Email', type: 'email', help: 'Public on your site. Leave empty to hide.' },
        { key: 'resume', label: 'Résumé / CV file', type: 'file', accept: 'application/pdf', help: 'Upload a PDF or paste a link. Adds a "Résumé" button.' },
        { key: 'links', label: 'Links', type: 'links', rows: 4, wide: true, placeholder: 'GitHub | https://github.com/you\nLinkedIn | https://www.linkedin.com/in/you\nYouTube | https://www.youtube.com/@you', help: 'One per line: Label | URL. GitHub, LinkedIn and YouTube get their own icons.' },
        { key: 'contactNote', label: 'Contact message', type: 'textarea', rows: 2, wide: true },
      ])),
    ];
  }

  function renderAboutTab() {
    return [
      card('About me', null, fieldGrid(content, [
        { key: 'about', label: 'About text', type: 'rich', rows: 10, wide: true },
      ])),
      card('Focus areas', 'Your roadmap: what you do now and where you are heading next.', listEditor(content.focus, {
        title: (f) => f.title,
        addLabel: 'Add focus area',
        create: () => ({ title: '', stage: 'next', icon: 'uav', description: '', topics: [] }),
        fields: [
          { key: 'title', label: 'Title', placeholder: 'Unmanned Aerial Vehicles' },
          { key: 'stage', label: 'Stage', type: 'select', options: STAGE_OPTIONS },
          { key: 'icon', label: 'Icon', type: 'select', options: ICON_OPTIONS },
          { key: 'description', label: 'Description', type: 'textarea', rows: 3, wide: true },
          { key: 'topics', label: 'Topics', type: 'tags', wide: true },
          { key: 'hidden', label: 'Hidden', type: 'checkbox' },
        ],
      })),
    ];
  }

  function renderSkillsTab() {
    return [card('Skills', 'Group your skills. Add "| 1-5" after a skill to give it a level (shown only if skill levels are on in Theme & layout).',
      listEditor(content.skills, {
        title: (g) => g.group,
        addLabel: 'Add skill group',
        create: () => ({ group: '', items: [] }),
        fields: [
          { key: 'group', label: 'Group name', placeholder: 'Robotics' },
          { key: 'hidden', label: 'Hidden', type: 'checkbox' },
          { key: 'items', label: 'Skills', type: 'skills', rows: 6, wide: true, placeholder: 'ROS 2 (Jazzy) | 4\nNav2 | 3\nGazebo', help: 'One per line: Skill | level (level is optional).' },
        ],
      }))];
  }

  function renderExperienceTab() {
    return [card('Experience', 'Newest first on the site, sorted by date automatically.', listEditor(content.experience, {
      title: (e) => [e.role, e.org].filter(Boolean).join(' · '),
      addLabel: 'Add job or internship',
      create: () => ({ role: '', org: '', type: 'Full time', location: '', start: '', end: '', current: false, summary: '', highlights: [], tags: [] }),
      fields: [
        { key: 'role', label: 'Role', placeholder: 'Robotics Engineer' },
        { key: 'org', label: 'Company / organisation' },
        { key: 'type', label: 'Type', placeholder: 'Full time, Internship…' },
        { key: 'location', label: 'Location' },
        { key: 'start', label: 'Start', placeholder: 'YYYY-MM', help: 'e.g. 2025-07' },
        { key: 'end', label: 'End', placeholder: 'YYYY-MM' },
        { key: 'current', label: 'I work here now', type: 'checkbox' },
        { key: 'hidden', label: 'Hidden', type: 'checkbox' },
        { key: 'orgUrl', label: 'Company website', type: 'url', wide: true },
        { key: 'summary', label: 'Summary', type: 'rich', rows: 3, wide: true },
        { key: 'highlights', label: 'Highlights', type: 'lines', rows: 4, wide: true, placeholder: 'One achievement per line, ideally with a number' },
        { key: 'tags', label: 'Tools & skills used', type: 'tags', wide: true },
      ],
    }))];
  }

  function renderProjectsTab() {
    return [card('Projects', 'Featured projects show first and larger. Hidden ones stay in your draft but not on the site.', listEditor(content.projects, {
      title: (p) => p.title,
      addLabel: 'Add project',
      create: () => ({ id: '', title: '', summary: '', description: '', tags: [], date: '', role: '', featured: false, hidden: false, icon: 'ugv', links: [], media: [] }),
      fields: [
        { key: 'title', label: 'Title' },
        { key: 'date', label: 'Date', placeholder: 'YYYY-MM' },
        { key: 'role', label: 'Your role', placeholder: 'Solo project, Team lead…' },
        { key: 'tags', label: 'Tags', type: 'tags', help: 'Visitors can filter projects by tag.' },
        { key: 'featured', label: 'Featured', type: 'checkbox' },
        { key: 'hidden', label: 'Hidden', type: 'checkbox' },
        { key: 'summary', label: 'Card summary (one or two sentences)', type: 'textarea', rows: 2, wide: true },
        { key: 'description', label: 'Full description (shown when the card is opened)', type: 'rich', rows: 8, wide: true },
        { key: 'links', label: 'Links', type: 'links', rows: 3, wide: true, placeholder: 'Source code | https://github.com/you/project\nDemo video | https://youtu.be/…', help: 'One per line: Label | URL.' },
        { key: 'icon', label: 'Icon when there is no image', type: 'select', options: ICON_OPTIONS },
        { key: 'id', label: 'Share link name', placeholder: 'ugv-navigation', help: 'Gives the project its own link: yoursite/#project-<name>.' },
      ],
      extra: (project) => mediaEditor(project),
    }))];
  }

  function renderEducationTab() {
    return [
      card('Education', null, listEditor(content.education, {
        title: (e) => [e.qualification, e.school].filter(Boolean).join(' · '),
        addLabel: 'Add education',
        create: () => ({ qualification: '', school: '', location: '', start: '', end: '', grade: '', details: [] }),
        fields: [
          { key: 'qualification', label: 'Qualification', placeholder: 'Bachelor of Engineering (Mechatronics)' },
          { key: 'school', label: 'University / school' },
          { key: 'start', label: 'Start', placeholder: 'YYYY' },
          { key: 'end', label: 'End', placeholder: 'YYYY' },
          { key: 'location', label: 'Location' },
          { key: 'grade', label: 'Result', placeholder: 'CGPA 3.6 / First Class' },
          { key: 'details', label: 'Details', type: 'lines', rows: 3, wide: true, placeholder: 'Final year project: …' },
          { key: 'hidden', label: 'Hidden', type: 'checkbox' },
        ],
      })),
      card('Certifications', null, listEditor(content.certifications, {
        title: (c) => c.name,
        addLabel: 'Add certification',
        create: () => ({ name: '', issuer: '', date: '', url: '' }),
        fields: [
          { key: 'name', label: 'Name' },
          { key: 'issuer', label: 'Issuer' },
          { key: 'date', label: 'Date', placeholder: 'YYYY-MM' },
          { key: 'url', label: 'Credential link', type: 'url' },
          { key: 'hidden', label: 'Hidden', type: 'checkbox' },
        ],
      })),
    ];
  }

  function savedToken() {
    try { return localStorage.getItem(TOKEN_KEY) || memoryToken; } catch (e) { return memoryToken; }
  }

  function renderPublishTab() {
    const pending = pendingFiles();
    const settings = content.site.publish;
    const log = h('ol', { class: 'ed-log' });
    const token = h('input', { type: 'password', id: 'gh-token', autocomplete: 'off', placeholder: 'github_pat_…' });
    token.value = savedToken();
    const remember = h('input', { type: 'checkbox', id: 'gh-remember' });
    try { remember.checked = !!localStorage.getItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    const publishBtn = h('button', { type: 'button', class: 'ed-btn primary' }, 'Publish to GitHub');

    publishBtn.addEventListener('click', async () => {
      memoryToken = token.value.trim();
      if (saveTimer) saveDraft(); // flush the last edit so it counts as published
      try {
        if (remember.checked) localStorage.setItem(TOKEN_KEY, memoryToken); else localStorage.removeItem(TOKEN_KEY);
      } catch (e) { /* private mode: keep it in memory only */ }
      publishBtn.disabled = true;
      log.replaceChildren();
      const say = (text, cls) => log.append(h('li', { class: cls || '' }, text));
      try {
        const toUpload = pendingFiles();
        const commitsUrl = await PF.publish.publishToGitHub(Object.assign({ token: memoryToken }, settings), PF.serializeContent(content), toUpload, say);
        for (const f of toUpload) {
          f.published = true;
          await PF.mediaStore.putFile({ path: f.path, blob: f.blob, type: f.blob.type, size: f.blob.size, added: Date.now(), published: true });
        }
        published = clone(content);
        publishedHash = contentHash(content);
        meta.publishedAt = Date.now();
        meta.base = publishedHash;
        writeDraft();
        say('');
        log.lastChild.append(h('a', { href: commitsUrl, target: '_blank', rel: 'noopener' }, 'See the commits on GitHub'));
      } catch (e) {
        say(e.message, 'error');
      } finally {
        publishBtn.disabled = false;
      }
    });

    const fileRows = pending.map((f) => h('li', {}, h('code', {}, f.path), ' ', h('span', { class: 'ed-help' }, kb(f.blob.size)), ' ',
      h('button', { type: 'button', class: 'ed-btn small', onclick: () => PF.publish.downloadBlob(f.blob, f.path.split('/').pop()) }, 'Download')));

    const importer = h('input', { type: 'file', accept: '.js,.json,application/json,text/javascript', hidden: true });
    importer.addEventListener('change', async () => {
      const file = importer.files[0];
      importer.value = '';
      if (!file) return;
      try {
        const imported = PF.parseContent(await file.text());
        if (!confirm('Replace everything in the editor with ' + file.name + '?')) return;
        content = imported;
        changed();
        showTab(currentTab);
        toast('Imported ' + file.name + '.');
      } catch (e) { toast('Could not read that file: ' + e.message, true); }
    });

    return [
      card('Publish to GitHub', 'Saves your content and new files straight to your GitHub repo. GitHub Pages then updates the live site, usually within a minute or two.',
        fieldGrid(settings, [
          { key: 'owner', label: 'GitHub username', placeholder: 'MuhamadMursyied' },
          { key: 'repo', label: 'Repository', placeholder: 'portfolio' },
          { key: 'branch', label: 'Branch', placeholder: 'main' },
        ]),
        h('div', { class: 'ed-field wide' }, h('label', { for: 'gh-token' }, 'GitHub token'), token,
          h('p', { class: 'ed-help' }, 'Create one at ',
            h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'GitHub → Fine-grained tokens'),
            ': choose "Only select repositories" and pick this repo, then under Repository permissions set Contents to "Read and write". The token is sent only to api.github.com.')),
        h('div', { class: 'ed-field ed-check' }, remember, h('label', { for: 'gh-remember' }, 'Remember the token in this browser'),
          h('p', { class: 'ed-help' }, 'Only tick this on your own computer.')),
        h('div', { class: 'ed-actions' }, publishBtn),
        log),
      card('Or upload the files yourself', 'No token needed. Download the files, then upload them on github.com.',
        h('div', { class: 'ed-actions' },
          h('button', { type: 'button', class: 'ed-btn', onclick: () => PF.publish.downloadBlob(new Blob([PF.serializeContent(content)], { type: 'text/javascript' }), 'portfolio.js') }, 'Download portfolio.js')),
        fileRows.length ? [h('p', { class: 'ed-label' }, 'New files'), h('ul', { class: 'ed-files' }, fileRows)] : h('p', { class: 'ed-help' }, 'No new images or videos to upload.'),
        h('ol', { class: 'ed-steps' },
          h('li', {}, 'In your repo on github.com, open the ', h('code', {}, 'data'), ' folder, choose Add file → Upload files, drop in portfolio.js and commit.'),
          fileRows.length ? h('li', {}, 'Open the ', h('code', {}, 'media'), ' folder and upload the new files the same way. Keep their names exactly as downloaded.') : null)),
      card('Backup & restore', 'Your draft lives in this browser only. Download portfolio.js now and then as a backup.',
        h('div', { class: 'ed-actions' },
          h('button', { type: 'button', class: 'ed-btn', onclick: () => importer.click() }, 'Import portfolio.js or .json…'), importer,
          h('button', {
            type: 'button', class: 'ed-btn danger',
            onclick: () => {
              if (!confirm('Throw away your draft and load the published content?')) return;
              content = clone(published);
              meta = { base: publishedHash, savedAt: 0, publishedAt: 0 };
              writeDraft();
              sendPreview();
              showTab(currentTab);
            },
          }, 'Discard draft'))),
    ];
  }

  function showTab(id) {
    currentTab = id;
    const tab = TABS.find((t) => t.id === id) || TABS[1];
    document.querySelectorAll('.ed-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    const form = $('#ed-form');
    form.replaceChildren(conflictBanner(), ...[].concat(tab.render()));
    form.scrollTop = 0;
    if (tab.scroll) sendPreview(tab.scroll);
    updateStatus();
  }

  // Shown when data/portfolio.js changed elsewhere while this browser had unpublished edits.
  function conflictBanner() {
    if (meta.base === publishedHash) return '';
    if (meta.savedAt <= meta.publishedAt) {
      return h('div', { class: 'ed-banner' }, h('p', {}, 'You published recently. The live site may take a few minutes to show it; you are editing your latest version.'));
    }
    return h('div', { class: 'ed-banner' },
      h('p', {}, 'The published portfolio changed since this draft was started (perhaps edited on another device). Which version do you want to keep editing?'),
      h('div', { class: 'ed-actions' },
        h('button', {
          type: 'button', class: 'ed-btn',
          onclick: () => { content = clone(published); meta = { base: publishedHash, savedAt: 0, publishedAt: 0 }; writeDraft(); sendPreview(); showTab(currentTab); },
        }, 'Use the published version'),
        h('button', { type: 'button', class: 'ed-btn', onclick: () => { meta.base = publishedHash; writeDraft(); showTab(currentTab); } }, 'Keep my draft')));
  }

  // Render the preview at a real desktop (or phone) width and scale it down to fit,
  // so "Desktop" shows the desktop layout even in a narrow panel.
  function fitPreview() {
    const wrap = $('.ed-frame-wrap');
    const frame = $('#preview-frame');
    const width = $('.ed-preview').dataset.device === 'phone' ? 390 : 1280;
    const scale = Math.min(1, wrap.clientWidth / width);
    frame.style.width = width + 'px';
    frame.style.height = (wrap.clientHeight / scale) + 'px';
    frame.style.transform = 'scale(' + scale + ')';
    frame.style.left = Math.max(0, (wrap.clientWidth - width * scale) / 2) + 'px';
  }

  // ---------- start ----------

  async function start() {
    published = PF.normalize(clone(window.PORTFOLIO || PF.blankPortfolio()));
    publishedHash = contentHash(published);

    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { draft = null; }
    if (draft && draft.content && draft.meta) {
      content = PF.normalize(draft.content);
      meta = draft.meta;
      // Nothing unpublished here, so quietly follow the newer published version, unless
      // this browser published moments ago and GitHub Pages is still deploying it.
      const deploying = Date.now() - meta.publishedAt < 15 * 60 * 1000;
      if (meta.base !== publishedHash && meta.savedAt <= meta.publishedAt && !deploying) {
        content = clone(published);
        meta = { base: publishedHash, savedAt: 0, publishedAt: 0 };
      }
    } else {
      content = clone(published);
      meta = { base: publishedHash, savedAt: 0, publishedAt: 0 };
    }

    try {
      const records = await PF.mediaStore.getAllFiles();
      const used = referencedPaths();
      for (const r of records) {
        // Drop files that are already on GitHub or no longer used, after a day.
        if ((r.published || !used.has(r.path)) && Date.now() - r.added > 86400000) { PF.mediaStore.deleteFile(r.path); continue; }
        files.push({ path: r.path, blob: r.blob, published: r.published });
        objectUrls[r.path] = URL.createObjectURL(r.blob);
      }
    } catch (e) {
      toast('This browser blocks local file storage, so uploads will not be kept between visits.', true);
    }
    PF.setMediaOverrides(objectUrls);

    $('.ed-tabs').replaceChildren(...TABS.map((t) => h('button', {
      type: 'button', role: 'tab', id: 'tab-' + t.id, 'data-tab': t.id,
      onclick: () => { showTab(t.id); document.body.classList.remove('show-preview'); },
    }, t.label, t.id === 'publish' ? h('span', { class: 'ed-dot', hidden: true }) : null)));

    document.querySelectorAll('button[data-device]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('button[data-device]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('.ed-preview').dataset.device = b.dataset.device;
      fitPreview();
    }));
    new ResizeObserver(fitPreview).observe($('.ed-frame-wrap'));
    $('#toggle-preview').addEventListener('click', () => document.body.classList.toggle('show-preview'));

    $('#preview-frame').src = 'index.html?preview';
    showTab('profile');
  }

  // Load the content file fresh (no cache) so the editor always starts from what is live.
  const script = document.createElement('script');
  script.src = 'data/portfolio.js?t=' + Date.now();
  script.onload = start;
  script.onerror = start;
  document.head.append(script);
})();
