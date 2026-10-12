// Starts the public page: reads window.PORTFOLIO (from data/portfolio.js), applies the
// theme and renders. With ?preview in the URL it instead waits for content from the
// editor, which embeds this page in an iframe.
(function () {
  'use strict';

  const PF = window.PF;
  const mount = document.getElementById('app');
  const preview = new URLSearchParams(location.search).has('preview');
  const THEME_KEY = 'portfolio-theme';

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function applyTheme(id) {
    const theme = PF.themeById(id);
    document.documentElement.dataset.theme = theme.id;
    document.documentElement.style.colorScheme = theme.mode;
  }

  // Visitors can try other themes; their choice is remembered on their device only.
  function themeSelect(data) {
    if (!data.site.allowThemeSwitch) return null;
    const select = PF.h('select', { class: 'theme-select', 'aria-label': 'Theme' },
      PF.THEMES.map((t) => PF.h('option', { value: t.id }, t.name)));
    select.value = document.documentElement.dataset.theme;
    select.addEventListener('change', () => {
      applyTheme(select.value);
      if (!preview) try { localStorage.setItem(THEME_KEY, select.value); } catch (e) { /* private mode */ }
    });
    return PF.h('label', { class: 'theme-picker' }, PF.h('span', { class: 'sr-only' }, 'Theme'), select);
  }

  function updateHead(data) {
    const p = data.profile;
    document.title = data.site.title || [p.name, p.headline].filter(Boolean).join(' · ') || 'Portfolio';
    const description = data.site.description || p.tagline || '';
    const meta = document.querySelector('meta[name="description"]');
    if (meta && description) meta.setAttribute('content', description.replace(/[*`[\]]/g, ''));
  }

  function render(data, media) {
    PF.setMediaOverrides(media);
    const visitorTheme = !preview && data.site.allowThemeSwitch ? storedTheme() : null;
    applyTheme(visitorTheme || data.site.theme);
    updateHead(data);
    return PF.renderPage(mount, data, { preview, themeSelect: themeSelect(data) });
  }

  if (preview) {
    // Only the page that embeds us (the editor) may send content.
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent || !event.data || event.data.type !== 'portfolio-preview') return;
      const scroll = window.scrollY;
      render(PF.normalize(event.data.content), event.data.media);
      window.scrollTo(0, scroll);
      if (event.data.scrollTo) {
        const target = document.getElementById(event.data.scrollTo);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    window.parent.postMessage({ type: 'portfolio-preview-ready' }, '*');
    return;
  }

  if (!window.PORTFOLIO) {
    mount.replaceChildren(PF.h('p', { class: 'load-error' }, 'Could not load data/portfolio.js.'));
    return;
  }
  const page = render(PF.normalize(window.PORTFOLIO));
  const openFromHash = () => {
    if (location.hash.startsWith('#project-')) page.openProjectById(decodeURIComponent(location.hash.slice(9)));
  };
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();
