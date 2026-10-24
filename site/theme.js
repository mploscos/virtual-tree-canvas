const key = 'vtc-site-theme';
const valid = new Set(['light', 'dark']);
let stored;
try { stored = localStorage.getItem(key); } catch { /* Storage may be unavailable. */ }
const preferred = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

function setTheme(theme, save = false) {
  const changed = document.documentElement.dataset.theme !== theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', theme === 'light' ? '#f6f9fc' : '#0b111c'
  );
  const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(theme === 'light'));
  }
  if (save) {
    try { localStorage.setItem(key, theme); } catch { /* Keep the current page usable. */ }
  }
  if (changed) window.dispatchEvent(new CustomEvent('site-theme-change', { detail: { theme } }));
}

setTheme(valid.has(stored) ? stored : preferred);
document.addEventListener('DOMContentLoaded', () => {
  setTheme(document.documentElement.dataset.theme);
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
    });
  }
});
window.addEventListener('storage', (event) => {
  if (event.key === key && valid.has(event.newValue)) setTheme(event.newValue);
});
