// Theme list. The look of each theme lives in css/themes.css under [data-theme="id"].
// To add a theme: add a block there and one line here.
(function (root) {
  'use strict';

  const THEMES = [
    { id: 'midnight', name: 'Midnight', mode: 'dark', note: 'Deep navy with a cyan accent' },
    { id: 'blueprint', name: 'Blueprint', mode: 'dark', note: 'Engineering drawing grid, mono headings' },
    { id: 'terminal', name: 'Terminal', mode: 'dark', note: 'Green phosphor console' },
    { id: 'carbon', name: 'Carbon', mode: 'dark', note: 'Industrial graphite and safety orange' },
    { id: 'aurora', name: 'Aurora', mode: 'dark', note: 'Violet and teal glow' },
    { id: 'clean', name: 'Clean', mode: 'light', note: 'White, blue accent, no fuss' },
    { id: 'paper', name: 'Paper', mode: 'light', note: 'Editorial serif on warm paper' },
    { id: 'sand', name: 'Sand', mode: 'light', note: 'Soft desert tones' },
    { id: 'forest', name: 'Forest', mode: 'light', note: 'Field-robotics green' },
    { id: 'mono', name: 'Mono', mode: 'light', note: 'Black on white, sharp corners' },
  ];

  const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

  root.PF = Object.assign(root.PF || {}, { THEMES, themeById });
})(window);
