// Shared reveal system powered by the Web Animations API. Components stay
// Tailwind-only and no view-level CSS is needed.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Same-page anchors keep their context and glide below the sticky navigation.
const scrollToAnchor = (target, updateHistory = true) => {
  const element = document.querySelector(target);
  if (!element) return false;
  const header = document.querySelector('header[role="banner"]');
  const offset = header instanceof HTMLElement ? header.offsetHeight + 12 : 12;
  const top = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' });
  if (updateHistory) history.pushState(null, '', target);
  return true;
};

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return;
  const url = new URL(link.href, window.location.href);
  if (!url.hash || url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
  if (scrollToAnchor(url.hash)) event.preventDefault();
});

if (window.location.hash) {
  window.addEventListener('load', () => requestAnimationFrame(() => scrollToAnchor(window.location.hash, false)), { once: true });
}

const revealFrames = {
  up: [{ opacity: 0, transform: 'translate3d(0, 32px, 0)' }, { opacity: 1, transform: 'translate3d(0, 0, 0)' }],
  left: [{ opacity: 0, transform: 'translate3d(-38px, 0, 0)' }, { opacity: 1, transform: 'translate3d(0, 0, 0)' }],
  right: [{ opacity: 0, transform: 'translate3d(38px, 0, 0)' }, { opacity: 1, transform: 'translate3d(0, 0, 0)' }],
  scale: [{ opacity: 0, transform: 'translate3d(0, 18px, 0) scale(.96)' }, { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }]
};

const playReveal = (element, variant, delay = 0, duration = 760) => {
  if (reducedMotion || element.dataset.revealed === 'true') return;
  element.dataset.revealed = 'true';
  element.animate(revealFrames[variant] ?? revealFrames.up, {
    delay,
    duration,
    easing: 'cubic-bezier(.22, 1, .36, 1)',
    fill: 'both'
  });
};

const sectionObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const section = entry.target;
    const sectionIndex = Number(section.dataset.revealIndex || 0);
    const elements = [...section.querySelectorAll('h1, h2, h3, p, article, figure, dl > div, [data-reveal-left], [data-reveal-image], [data-reveal-background]')]
      .filter((element) => !element.closest('nav'));

    elements.forEach((element, index) => {
      const variant = element.matches('[data-reveal-background]')
        ? 'scale'
        : element.matches('[data-reveal-left]')
        ? 'left'
        : element.matches('article, figure, [data-reveal-image]')
          ? (index % 2 === 0 ? 'scale' : 'up')
          : (sectionIndex % 2 === 0 ? 'left' : 'right');
      playReveal(element, variant, Math.min(index * 75, 525));
    });
    observer.unobserve(section);
  });
}, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

document.querySelectorAll('main > section').forEach((section, index) => {
  section.dataset.revealIndex = String(index);
  sectionObserver.observe(section);
});

const siteHeader = document.querySelector('header[role="banner"]');
if (siteHeader) playReveal(siteHeader, 'up', 0, 480);

const footer = document.querySelector('footer[role="contentinfo"]');
if (footer) {
  const footerObserver = new IntersectionObserver(([entry], observer) => {
    if (!entry?.isIntersecting) return;
    const bannerCopy = footer.querySelector('#footer-banner > div:last-child');
    if (bannerCopy) playReveal(bannerCopy, 'left', 80, 900);
    footer.querySelectorAll('.grid.grid-cols-1 > *').forEach((column, index) => {
      playReveal(column, 'left', 140 + index * 130, 820);
    });
    const legal = footer.querySelector('.border-t.border-white\/20');
    if (legal) playReveal(legal, 'up', 460, 760);
    observer.disconnect();
  }, { threshold: 0.08 });
  footerObserver.observe(footer);
}
