export function smoothScrollTo(selector) {
  if (typeof window === 'undefined') return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = prefersReduced ? 'auto' : 'smooth';

  if (!selector || selector === '#top') {
    window.scrollTo({ top: 0, behavior });
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return;
  }

  const target = document.querySelector(selector);
  if (!target) return;

  target.scrollIntoView({ behavior, block: 'start' });
  window.history.replaceState(null, '', selector);
}
