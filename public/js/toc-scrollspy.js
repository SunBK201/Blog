(function () {
  // The script only runs on pages where the TOC block exists.
  const toc = document.querySelector('.toc #TableOfContents');
  if (!toc) return;

  // Collect TOC anchor links and map them to real heading elements in the article.
  const links = Array.from(toc.querySelectorAll('a[href^="#"]'));
  const linkById = new Map();

  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#')) continue;

    const id = decodeURIComponent(href.slice(1));
    const target = document.getElementById(id);
    if (target) linkById.set(id, link);
  }

  const headings = Array.from(linkById.keys())
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!headings.length) return;

  let ticking = false;

  // Toggle the active class so CSS can highlight the current TOC item.
  function setActive(activeId) {
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const id = href.startsWith('#') ? decodeURIComponent(href.slice(1)) : '';
      link.classList.toggle('active', id === activeId);
    }
  }

  // Choose the section closest to the reading focus area (about 30% from top).
  function updateActive() {
    const marker = window.innerHeight * 0.30;
    let activeId = headings[0].id;

    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= marker) {
        activeId = heading.id;
      } else {
        break;
      }
    }

    // Keep the final heading active when the reader reaches the page bottom.
    if ((window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 2)) {
      activeId = headings[headings.length - 1].id;
    }

    setActive(activeId);
    ticking = false;
  }

  // Coalesce frequent scroll events into one repaint-safe update.
  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateActive);
    }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('hashchange', requestUpdate);
  requestUpdate();
})();
