(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const logoWrap = document.getElementById("logoWrap");
  const logo = document.getElementById("logo");
  const iconInsta = document.getElementById("iconInsta");
  const iconWhats = document.getElementById("iconWhats");
  const navBg = document.getElementById("navBg");

  const heroTitle = document.getElementById("heroTitle");
  const ytFrame = document.getElementById("workVideo");
  const localVideo = document.getElementById("localVideo");

  if (!logoWrap || !logo) return;

  const start = { top: 90, w: 255, h: 79 };
  const end = { top: 30, w: 120, h: 37 };
  const scrollLimit = 300;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  let ticking = false;
  let iconsVisible = false;

  function setIcons(visible) {
    if (visible === iconsVisible) return;
    iconsVisible = visible;

    [iconInsta, iconWhats].forEach((el) => {
      if (!el) return;
      el.classList.toggle("opacity-0", !visible);
      el.classList.toggle("translate-y-2", !visible);
      el.classList.toggle("opacity-100", visible);
      el.classList.toggle("translate-y-0", visible);
    });
  }

  function setNavBg(visible) {
    if (!navBg) return;
    navBg.classList.toggle("opacity-0", !visible);
    navBg.classList.toggle("opacity-100", visible);
  }

  function updateNav() {
    const raw = window.scrollY / scrollLimit;
    const t = clamp01(raw);
    const p = easeOut(t);

    const y = lerp(start.top, end.top, p);
    logoWrap.style.transform = `translate3d(-50%, ${y}px, 0)`;
    logo.style.width = `${lerp(start.w, end.w, p)}px`;
    logo.style.height = `${lerp(start.h, end.h, p)}px`;


    setIcons(t >= 1);
    setNavBg(window.scrollY > scrollLimit);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateNav();
      if (!prefersReduced) updateParallax();
      ticking = false;
    });
  }

  // Subtle parallax for hero title
  function updateParallax() {
    if (!heroTitle) return;
    const y = Math.min(120, window.scrollY * 0.12);
    heroTitle.style.transform = `translate3d(0, ${y}px, 0)`;
    heroTitle.style.willChange = "transform";
  }

  // Reveal on enter
  function initReveal() {
    const els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const delay = Number(el.getAttribute("data-reveal-delay") || 0);
          setTimeout(() => el.classList.add("is-visible"), delay);
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    els.forEach((el) => io.observe(el));
  }

  // YouTube autoplay when visible
  function initYouTubeAutoplay() {
    if (!ytFrame) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          try {
            ytFrame.contentWindow.postMessage(
              '{"event":"command","func":"playVideo","args":""}',
              "*"
            );
          } catch {}
        });
      },
      { threshold: 0.6 }
    );

    io.observe(ytFrame);
  }

  // Local video play/pause when visible
  function initLocalVideo() {
  const localVideo = document.getElementById("localVideo");
  if (!localVideo) return;

  // Helps some browsers allow autoplay once metadata is ready
  const tryPlay = () => localVideo.play().catch(() => {});

  if (localVideo.readyState >= 2) {
    tryPlay();
  } else {
    localVideo.addEventListener("loadedmetadata", tryPlay, { once: true });
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          tryPlay();
        } else {
          localVideo.pause();
        }
      }
    },
    { threshold: 0.35 } // 0.6 can be too strict on mobile
  );

  io.observe(localVideo);
}

document.addEventListener("DOMContentLoaded", () => {
  initLocalVideo();
});

  updateNav();
  if (!prefersReduced) updateParallax();
  window.addEventListener("scroll", onScroll, { passive: true });

  initReveal();
  initYouTubeAutoplay();
  initLocalVideo();
})();

(() => {
  const root = document.getElementById("particles");
  const header = document.getElementById("nav");
  if (!root || !header) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  root.appendChild(canvas);

  let w = 0, h = 0, dpr = 1;
  let raf = 0;

  const cfg = {
    count: 38,        // particles amount
    speed: 0.22,      // drift speed
    linkDist: 120,    // line distance
    radius: 1.2,      // dot radius
  };

  const particles = [];

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function resize() {
    const rect = header.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);

    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // rebuild particles for new size
    particles.length = 0;
    for (let i = 0; i < cfg.count; i++) {
      particles.push({
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-cfg.speed, cfg.speed),
        vy: rand(-cfg.speed, cfg.speed),
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // dots
    ctx.fillStyle = "rgba(235,245,238,0.75)";
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      // wrap
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, cfg.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);

        if (dist < cfg.linkDist) {
          const alpha = 1 - dist / cfg.linkDist;
          ctx.strokeStyle = `rgba(235,245,238,${alpha * 0.22})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(draw);
  }

  // Recalc on resize
  const ro = new ResizeObserver(() => {
    resize();
  });
  ro.observe(header);

  resize();
  draw();

  // cleanup if needed
  window.addEventListener("beforeunload", () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  });
})();

const titles = document.querySelectorAll("[data-title]");
titles.forEach((t) => t.classList.add("title-wipe"));

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;

    const el = e.target;
    const delay = Number(el.getAttribute("data-delay") || 0);

    setTimeout(() => {
      el.classList.add("is-wiping");

      // Reveal text when the wipe is already covering most of it
      setTimeout(() => {
        el.classList.add("is-revealed");
      }, 520); // <-- if you want later, increase to 600
    }, delay);

    io.unobserve(el);
  });
}, { threshold: 0.6 });

titles.forEach((t, i) => {
  if (!t.hasAttribute("data-delay")) t.setAttribute("data-delay", String(i * 120));
  io.observe(t);
});