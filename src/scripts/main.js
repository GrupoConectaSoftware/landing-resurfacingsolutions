// Shared reveal system powered by the Web Animations API. Components stay
// Tailwind-only and no view-level CSS is needed.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    const elements = [...section.querySelectorAll('h1, h2, h3, p, article, figure')]
      .filter((element) => !element.closest('nav'));

    elements.forEach((element, index) => {
      const variant = element.matches('article, figure')
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
