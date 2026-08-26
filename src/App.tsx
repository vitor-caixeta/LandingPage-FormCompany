import { useEffect, useRef, useState, type CSSProperties } from "react";

const reelLinks = [
  "/videos/final-explosao-web.m4v",
  "/videos/correndo-n1-web.m4v",
  "/videos/final-form-web.m4v",
  "/videos/trends-form-web.m4v",
  "/videos/clara-web.m4v",
];

const archiveItems = [
  [
    "Identity",
    "2026",
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1000&q=85",
  ],
  [
    "Motion",
    "2026",
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85",
  ],
  [
    "Campaign",
    "2025",
    "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1000&q=85",
  ],
  [
    "Editorial",
    "2025",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1000&q=85",
  ],
  [
    "Launch",
    "2025",
    "https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=1000&q=85",
  ],
] as const;

function ReelCard({ url, index }: { url: string; index: number }) {
  return (
    <article className={`reel-card reel-${index + 1}`}>
      <video
        className="reel-video"
        src={url}
        aria-label={`Vídeo ${index + 1} da Form`}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      />
    </article>
  );
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

function backOut(value: number) {
  const amount = 1.28;
  const shifted = value - 1;

  return (
    1 +
    (amount + 1) * shifted ** 3 +
    amount * shifted ** 2
  );
}

function SocialSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const fanRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [spread, setSpread] = useState(360);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    let previousProgress = -1;
    let previousSpread = -1;

    const update = () => {
      const section = sectionRef.current;
      const fan = fanRef.current;

      if (!section || !fan) return;

      const sectionRect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const naturalFanBottom =
        sectionRect.top + fan.offsetTop + fan.offsetHeight;

      const nextProgress = clamp(
        (viewportHeight - naturalFanBottom) /
          (viewportHeight * 0.20),
      );

      const cardWidth = window.innerWidth <= 760 ? 164 : 224;
      const safeWidth = Math.max(0, section.clientWidth - cardWidth - 24);
      const nextSpread = Math.min(safeWidth / 2, window.innerWidth <= 760 ? 158 : 258);

      if (Math.abs(nextProgress - previousProgress) > 0.002) {
        previousProgress = nextProgress;
        setProgress(nextProgress);
      }

      if (Math.abs(nextSpread - previousSpread) > 1) {
        previousSpread = nextSpread;
        setSpread(nextSpread);
      }
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();

    window.addEventListener("scroll", scheduleUpdate, {
      passive: true,
    });

    window.addEventListener("resize", scheduleUpdate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  const center = (reelLinks.length - 1) / 2;
  const cardProgress = clamp((progress - 0.16) / 0.84);
  const isActive = progress > 0.08;

  return (
    <section
      ref={sectionRef}
      className={`socials${isActive ? " fan-active" : ""}`}
      id="socials"
    >
      <h2 aria-label="Vídeos Produzidos" data-reveal="title">
        <span className="social-title-line">
          <strong>Vídeos</strong>
        </span>

        <span className="social-title-line">
          <em>Produzidos</em>
        </span>
      </h2>

      <div
        ref={fanRef}
        className={`reel-fan${
          activeIndex !== null ? " has-active-card" : ""
        }`}
        onPointerMove={(event) => {
          if (cardProgress <= 0.82) return;

          const bounds =
            event.currentTarget.getBoundingClientRect();

          const pointerPosition = clamp(
            (event.clientX - bounds.left) / bounds.width,
          );

          const nextIndex = Math.round(
            pointerPosition * (reelLinks.length - 1),
          );

          if (nextIndex !== activeIndex) {
            setActiveIndex(nextIndex);
          }
        }}
        onPointerLeave={() => setActiveIndex(null)}
      >
        {reelLinks.map((url, index) => {
          const normalized = (index - center) / center;
          const delay =
            (reelLinks.length - 1 - index) * 0.048;

          const localProgress = clamp(
            (cardProgress - delay) / (1 - delay),
          );

          const eased = backOut(localProgress);
          const finalX = normalized * spread;
          const finalY =
            Math.abs(normalized) ** 1.65 * 48;

          const finalRotate = normalized * 16;

          const finalScale =
            1 - Math.abs(normalized) * 0.22;

          const isHovered = activeIndex === index;

          const hoverDirection =
            activeIndex === null || index === activeIndex
              ? 0
              : Math.sign(index - activeIndex);

          const hoverShift =
            hoverDirection *
            (52 -
              Math.abs(index - activeIndex!) * 4);

          const x =
            finalX * eased +
            (cardProgress > 0.82 ? hoverShift : 0);

          const y =
            132 +
            (finalY - 132) * eased -
            (isHovered ? 34 : 0);

          const rotate =
            finalRotate * eased * (isHovered ? 0 : 1);

          const scale =
            0.92 +
            (finalScale - 0.92) * eased +
            (isHovered ? 0.12 : 0);

          const cardStyle = {
            transform: `translate3d(calc(-50% + ${x}px), ${y}px, ${
              isHovered ? 55 : 0
            }px) rotate(${rotate}deg) scale(${scale})`,
            zIndex: isHovered
              ? 30
              : Math.round(
                  10 - Math.abs(index - center),
                ),
            pointerEvents:
              localProgress > 0.3 ? "auto" : "none",
          } as CSSProperties;

          return (
            <div
              className={`reel-motion-shell${
                isHovered ? " is-active" : ""
              }`}
              style={cardStyle}
              key={url}
              role="group"
              tabIndex={0}
              aria-label={`Reel ${index + 1} da Form`}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
            >
              <ReelCard url={url} index={index} />
            </div>
          );
        })}
      </div>

      <p className="social-follow">
        <span>SIGA A FORM NO INSTAGRAM</span>
      </p>

      <nav
        className="social-nav"
        aria-label="Redes sociais"
      >
        <a
          href="https://www.instagram.com/formcompany_"
          target="_blank"
          rel="noreferrer"
        >
          Instagram
        </a>
      </nav>
    </section>
  );
}

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

export default function Home() {
  const [isFooterVisible, setIsFooterVisible] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-reveal]",
      ),
    );

    root.classList.add("motion-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;

          if (entry.isIntersecting) {
            target.classList.add("is-visible");
            if (target.dataset.revealOnce !== "false") {
              observer.unobserve(target);
            }
          } else if (target.dataset.revealOnce === "false") {
            target.classList.remove("is-visible");
          }
        });
      },
      {
        threshold: 0.25,
        rootMargin: "0px",
      },
    );

    elements.forEach((element) =>
      observer.observe(element),
    );

    return () => {
      observer.disconnect();
      root.classList.remove("motion-ready");
    };
  }, []);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = footer.getBoundingClientRect();
        setIsFooterVisible(bounds.top <= window.innerHeight - 24 && bounds.bottom > 0);
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <main>
      <a
        className={`floating-whatsapp${isFooterVisible ? " is-hidden" : ""}`}
        href="https://wa.me/64993251835"
        target="_blank"
        rel="noreferrer"
        aria-label="Entrar em contato pelo WhatsApp"
      >
        <span aria-hidden="true">✦</span>
        Entre em contato
      </a>

      <section className="hero" id="top">
        <div className="hero-frame">
          <img className="hero-image" src="/hero-botanical.png" alt="Figura vestida de preto coberta por flores vermelhas" />
          <div className="hero-shade" />

          <div className="hero-brand" data-reveal="left">
            <img src="/LogoForm.png" alt="Form Company" />
          </div>

          <div className="hero-copy" data-reveal="right">
            <h1>Ideias que<br />ganham forma</h1>
            <p>Estratégia, identidade e conteúdo para criar marcas que se movem.</p>
          </div>
        </div>
      </section>

      <section
        className="manifesto"
        id="manifesto"
      >
        {/* Colocar logo da Form aqui. */}

        <p
          className="manifesto-copy"
          data-reveal="words"
        >
          dando forma a <em>ideias</em>. Construindo uma{" "}
          <em>marca</em> que cresce.
        </p>
      </section>

      <section
        className="archive"
        id="archive"
      >
        <div
          className="archive-heading"
          data-reveal="rise"
        >
          <span>Arquivo visual</span>

          <h2>
            FORM
            <br />
            <em>Serviços</em>
          </h2>

          <p>
            Uma seleção de identidades, campanhas e
            momentos que ajudaram a construir a nossa
            linguagem.
          </p>
        </div>

        <div className="archive-rail">
          {archiveItems.map(
            ([title, year, src], index) => (
              <article
                className="archive-card"
                key={title}
                data-reveal={index % 2 ? "left" : "right"}
                style={{ "--reveal-delay": `${index * 70}ms` } as CSSProperties}
              >
                <span>0{index + 1}</span>

                <img
                  src={src}
                  alt={`Imagem provisória do projeto ${title}`}
                />

                <div>
                  <h3>{title}</h3>
                  <small>{year}</small>
                </div>
              </article>
            ),
          )}
        </div>

        <a
          className="archive-link"
          href="#archive"
          data-reveal="scale"
        >
          Ver todos os projetos
          <ArrowIcon />
        </a>
      </section>

      <SocialSection />

      <footer id="contact">
        <div className="footer-panel" data-reveal="footer">
          <img
            src="/LogoForm.png"
            alt="Logo Form"
            className="footer-logo"
          />

          <h2 data-reveal="words">
            SEMPRE <em>EM MOVIMENTO.</em>
          </h2>

          <img
            src="/photoFooter.png"
            alt="Retrato da Form no rodapé"
            className="footer-portrait"
            data-reveal="rise"
          />

          <nav
            className="footer-pages"
            aria-label="Páginas"
            data-reveal="right"
          >
            <small>Páginas</small>
            <a href="#top">Home</a>
            <a href="#archive">Work</a>
            <a href="#archive">Archive</a>
            <a href="#socials">Socials</a>
          </nav>

          <nav
            className="footer-social"
            aria-label="Redes sociais do rodapé"
            data-reveal="left"
          >
            <small>Follow on</small>

            <a
              href="https://www.instagram.com/formcompany_"
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
          </nav>

          <a
            className="contact-button"
            href="https://wa.me/64993251835"
          >
            Entre em Contato
            <ArrowIcon />
          </a>
        </div>

        <div className="footer-legal">
          <span>
            © 2026 Form. All rights reserved
          </span>

          <span>
            Privacy policy &nbsp;&nbsp; Terms
          </span>
        </div>
      </footer>
    </main>
  );
}
