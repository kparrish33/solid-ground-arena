/* ---------------------------
   0) Small utilities
--------------------------- */
function qs(sel, root = document) {
  return root.querySelector(sel);
}
function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function rafThrottle(fn) {
  let ticking = false;
  return (...args) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      fn(...args);
    });
  };
}

/* ---------------------------
   1) Logo flip animation
--------------------------- */
function flipLogo() {
  const logo = qs("nav img");
  if (!logo) return;

  logo.style.transition = "transform 0.5s ease";
  logo.style.transform = "rotateY(360deg)";

  setTimeout(() => {
    logo.style.transform = "rotateY(0)";
  }, 500);
}

/* ---------------------------
   2) Carousel Engine (shared)
   Markup expected:

   <div class="sga-carousel sga-carousel--home" data-carousel data-breakpoint="900" data-mobile-advance="4500" data-desktop-speed="0.45">
     <div class="sga-viewport">
       <div class="sga-track">
         <a class="sga-card event-card" href="..." target="_blank" rel="noopener">...</a>
         ...
       </div>
     </div>
     <div class="sga-dots" aria-label="Carousel pagination"></div>
   </div>

   Notes:
   - Desktop uses JS-driven infinite translate loop (no keyframes)
   - Mobile uses native scroll + snap; JS only updates dots + active + auto-advance
--------------------------- */
function initCarousels() {
  const carousels = qsa("[data-carousel]");
  if (!carousels.length) return;

  carousels.forEach((carousel) => {
    const viewport = qs(".sga-viewport", carousel);
    const track = qs(".sga-track", carousel);
    const dots = qs(".sga-dots", carousel);
    if (!viewport || !track) return;

    const breakpoint = parseInt(carousel.dataset.breakpoint || "900", 10);
    const mobileAdvanceMs = parseInt(carousel.dataset.mobileAdvance || "4500", 10);
    const desktopSpeed = parseFloat(carousel.dataset.desktopSpeed || "0.45"); // px per frame-ish scaled below

    // Original (real) cards are those present at load
    const originalCards = qsa(".sga-card", track);
    const originalCount = originalCards.length;

    // Make sure cards are anchors (whole-card clickable requirement)
    // If someone accidentally uses divs later, this prevents silent failures.
    originalCards.forEach((card) => {
      if (card.tagName !== "A") {
        console.warn("Carousel card is not an <a>. Whole-card click requires anchor.", card);
      }
    });

    // State
    let mode = null; // "desktop" | "mobile"
    let paused = false;

    // Desktop loop state
    let x = 0;
    let rafId = null;
    let loopWidth = 0;

    // Mobile state
    let mobileTimer = null;
    let touchActive = false;
    let lastActiveIndex = 0;

    /* ---------- Dots ---------- */
    function buildDots() {
      if (!dots) return;
      dots.innerHTML = "";

      for (let i = 0; i < originalCount; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sga-dot";
        b.setAttribute("aria-label", `Go to slide ${i + 1}`);
        b.addEventListener("click", () => scrollToIndex(i));
        dots.appendChild(b);
      }
      setActiveDot(0);
    }

    function setActiveDot(idx) {
      if (!dots) return;
      const btns = qsa(".sga-dot", dots);
      btns.forEach((b, i) => b.classList.toggle("is-active", i === idx));
    }

    /* ---------- Mobile helpers ---------- */
    function getCardWidthStep() {
      const cards = qsa(".sga-card", track);
      if (cards.length < 2) return cards[0]?.getBoundingClientRect().width || 0;

      const r0 = cards[0].getBoundingClientRect();
      const r1 = cards[1].getBoundingClientRect();
      const diff = r1.left - r0.left;
      return diff > 0 ? diff : r0.width;
    }

    function getNearestIndexToCenter() {
      const cards = qsa(".sga-card", track);
      if (!cards.length) return 0;

      const vpRect = viewport.getBoundingClientRect();
      const vpCenter = vpRect.left + vpRect.width / 2;

      let bestI = 0;
      let bestD = Infinity;

      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const c = r.left + r.width / 2;
        const d = Math.abs(c - vpCenter);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      });

      // Convert from duplicated list index -> original index
      return bestI % originalCount;
    }

    function updateMobileActive() {
      const cards = qsa(".sga-card", track);
      if (!cards.length) return;

      const activeOriginalIndex = getNearestIndexToCenter();
      lastActiveIndex = activeOriginalIndex;

      // Visual emphasis: only centered card emphasized (mobile only)
      cards.forEach((card) => {
        const idx = parseInt(card.dataset.originalIndex || "0", 10);
        card.classList.toggle("is-active", idx === activeOriginalIndex);
        card.classList.toggle("is-dim", idx !== activeOriginalIndex);
      });

      setActiveDot(activeOriginalIndex);
    }

    function scrollToIndex(originalIdx) {
      // Find the first matching card in the current DOM (works even if we duplicated)
      const cards = qsa(".sga-card", track);
      const target = cards.find((c) => parseInt(c.dataset.originalIndex || "0", 10) === originalIdx);
      if (!target) return;

      // Center it
      const left =
        target.offsetLeft - (viewport.clientWidth - target.clientWidth) / 2;

      viewport.scrollTo({ left, behavior: "smooth" });
    }

    function startMobileAutoAdvance() {
      stopMobileAutoAdvance();
      if (mobileAdvanceMs <= 0) return;

      mobileTimer = window.setInterval(() => {
        if (touchActive) return;
        const next = (lastActiveIndex + 1) % originalCount;
        scrollToIndex(next);
      }, mobileAdvanceMs);
    }

    function stopMobileAutoAdvance() {
      if (!mobileTimer) return;
      window.clearInterval(mobileTimer);
      mobileTimer = null;
    }

    /* ---------- Desktop helpers ---------- */
    function ensureDesktopLoop() {
      // Build duplicates ONCE so we can loop seamlessly
      // Desktop loop uses transform translateX; duplicates are necessary.
      // We'll rebuild from originals every time we enter desktop to avoid drift.
      track.innerHTML = "";
      originalCards.forEach((card, i) => {
        const c = card.cloneNode(true);
        c.dataset.originalIndex = String(i);
        track.appendChild(c);
      });
      originalCards.forEach((card, i) => {
        const c = card.cloneNode(true);
        c.dataset.originalIndex = String(i);
        track.appendChild(c);
      });

      // Measure width of first set (loop length)
      // Must wait a frame to ensure layout is ready.
      requestAnimationFrame(() => {
        const cards = qsa(".sga-card", track);
        const firstSet = cards.slice(0, originalCount);
        loopWidth = firstSet.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);

        // Include gap between cards (flex gap)
        // Easiest reliable method: measure offset between first two cards
        if (firstSet.length >= 2) {
          const a = firstSet[0].getBoundingClientRect();
          const b = firstSet[1].getBoundingClientRect();
          const gap = Math.max(0, b.left - a.right);
          loopWidth += gap * (originalCount - 1);
        }

        // Reset translate
        x = 0;
        track.style.transform = "translate3d(0,0,0)";
      });
    }

    function startDesktopLoop() {
      stopDesktopLoop();
      paused = false;

      const speedPxPerFrame = desktopSpeed; // tuned via data-desktop-speed
      const step = () => {
        if (!paused) {
          x -= speedPxPerFrame;
          if (Math.abs(x) >= loopWidth && loopWidth > 0) {
            // Wrap back seamlessly
            x += loopWidth;
          }
          track.style.transform = `translate3d(${x}px, 0, 0)`;
        }
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    }

    function stopDesktopLoop() {
      if (!rafId) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    /* ---------- Mode switch ---------- */
    function enterMobile() {
      if (mode === "mobile") return;
      mode = "mobile";

      // Stop desktop loop
      stopDesktopLoop();
      track.style.transform = "none";

      // Mobile should be native scroll; no duplicates needed, but we DO want looping feel.
      // We keep a 3x list so user can swipe a bit without "end", and auto-advance stays smooth.
      track.innerHTML = "";
      for (let rep = 0; rep < 3; rep++) {
        originalCards.forEach((card, i) => {
          const c = card.cloneNode(true);
          c.dataset.originalIndex = String(i);
          track.appendChild(c);
        });
      }

      // Build dots once
      buildDots();

      // Set up scroll listener to update active + dots
      viewport.addEventListener(
        "scroll",
        rafThrottle(() => updateMobileActive()),
        { passive: true }
      );

      // Touch / pointer pause
      const onTouchStart = () => {
        touchActive = true;
        stopMobileAutoAdvance();
      };
      const onTouchEnd = () => {
        touchActive = false;
        startMobileAutoAdvance();
      };

      viewport.addEventListener("touchstart", onTouchStart, { passive: true });
      viewport.addEventListener("touchend", onTouchEnd, { passive: true });
      viewport.addEventListener("pointerdown", onTouchStart, { passive: true });
      viewport.addEventListener("pointerup", onTouchEnd, { passive: true });
      viewport.addEventListener("pointercancel", onTouchEnd, { passive: true });

      // Center the first card nicely
      requestAnimationFrame(() => {
        scrollToIndex(0);
        updateMobileActive();
        startMobileAutoAdvance();
      });
    }

    function enterDesktop() {
      if (mode === "desktop") return;
      mode = "desktop";

      stopMobileAutoAdvance();
      touchActive = false;

      // Desktop uses overflow hidden and transforms
      ensureDesktopLoop();
      startDesktopLoop();

      // Pause on hover (desktop only)
      carousel.addEventListener("mouseenter", () => (paused = true));
      carousel.addEventListener("mouseleave", () => (paused = false));
    }

    function setModeFromWidth() {
      const w = window.innerWidth;
      if (w < breakpoint) enterMobile();
      else enterDesktop();
    }

    // Init with mode + rebuild on resize
    setModeFromWidth();
    window.addEventListener("resize", rafThrottle(setModeFromWidth));
  });
}

/* ---------------------------
   3) Main DOM Ready
--------------------------- */
document.addEventListener("DOMContentLoaded", function () {
  // Flip logo on page load
  flipLogo();

  // Flip logo when Home is clicked (if present)
  const homeLink = qs("#home-link");
  if (homeLink) {
    homeLink.addEventListener("click", function (e) {
      e.preventDefault();
      flipLogo();
      setTimeout(() => {
        window.location.href = homeLink.getAttribute("href");
      }, 600);
    });
  }

  // 4. Feather icons
  if (window.feather) feather.replace();

  // 5. Mobile menu toggle
  const menuBtn = qs("#menu-btn");
  const mobileMenu = qs("#mobile-menu");

  function setIcon(isOpen) {
    if (!menuBtn) return;
    menuBtn.innerHTML = isOpen ? '<i data-feather="x"></i>' : '<i data-feather="menu"></i>';
    if (window.feather) feather.replace();
    menuBtn.setAttribute("aria-expanded", String(isOpen));
  }

  if (menuBtn && mobileMenu) {
    setIcon(false);
    menuBtn.addEventListener("click", () => {
      const isNowHidden = mobileMenu.classList.toggle("hidden");
      setIcon(!isNowHidden);
    });
  }

  // 6. Auto-update footer year
  const yearSpan = qs("#year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // 7. Highlight active nav link
  const currentPage = window.location.pathname.split("/").pop();
  qsa(".nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) link.classList.add("text-[#5fbcff]");
  });

  // 8. Form animation on scroll
  const formSection = qs("#contact-form .animate-slide-up");
  if (formSection) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("slide-up-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(formSection);
  }

  // 9. Thank-you message logic (contact form)
  const form = qs("#contactForm");
  const thankYou = qs("#thankYouMessage");

  if (form && thankYou) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const data = new FormData(form);

      fetch(form.action, {
        method: form.method,
        body: data,
        headers: { Accept: "application/json" },
      }).then((response) => {
        if (response.ok) {
          form.reset();
          thankYou.classList.remove("hidden", "text-red-500");
          thankYou.textContent = "Thanks! Your message has been sent. 🛼";
        } else {
          thankYou.classList.remove("hidden");
          thankYou.classList.add("text-red-500");
          thankYou.textContent = "Oops! Something went wrong.";
        }
      });
    });
  }

  // 10. Facility Event Form submission feedback
  const facilityForm = qs("#eventApplicationForm");
  const facilityThankYou = qs("#thankYouMsg");
  if (facilityForm && facilityThankYou) {
    facilityForm.addEventListener("submit", function (e) {
      e.preventDefault();
      facilityForm.reset();
      facilityThankYou.classList.remove("hidden");
    });
  }

  // 10. Expanding Stripes on Hover Animation
  qsa(".stripe-container").forEach((stripe) => {
    stripe.addEventListener("mouseenter", () => {
      stripe.style.transform = "skewY(-12deg) scale(1.02)";
    });
    stripe.addEventListener("mouseleave", () => {
      stripe.style.transform = "skewY(-12deg)";
    });
  });

  // 11. Livestream Auto-Detection & Glow Animation
  const card = qs("#livestreamCard");
  const inlineBadge = qs("#liveBadge");
  const floatingBadge = qs("#floatingLiveBadge");
  const closeBtn = qs("#closeLiveBadge");

  const LIVE_CHECK_URL = "https://impactenvi.watch.pixellot.tv/";

  async function checkLivestream() {
    try {
      await fetch(LIVE_CHECK_URL, { method: "HEAD", mode: "no-cors" });
      const isLive = true; // placeholder
      if (isLive) showLivestreamUI();
    } catch (err) {
      console.warn("Livestream check error:", err);
    }
  }

  function showLivestreamUI() {
    if (card) card.classList.add("livestream-glow");
    if (inlineBadge) {
      inlineBadge.classList.remove("opacity-0");
      inlineBadge.classList.add("opacity-100");
    }
    if (floatingBadge) {
      floatingBadge.classList.remove("hidden");
      floatingBadge.classList.add("flex");
    }
  }

  if (floatingBadge) {
    floatingBadge.addEventListener("click", () => {
      window.open(LIVE_CHECK_URL, "_blank");
    });
  }

  if (closeBtn && floatingBadge) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      floatingBadge.classList.add("hidden");
    });
  }

  checkLivestream();
  setInterval(checkLivestream, 60000);

  // 12. Smooth Scroll
  const SCROLL_OFFSET = -500;
  qsa('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (!targetId || targetId === "#") return;

      const targetEl = qs(targetId);
      if (!targetEl) return;

      e.preventDefault();
      const y = targetEl.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  });

  // 13. Mobile Dropdown Logic
  qsa(".mobile-dropdown").forEach((dropdown) => {
    const btn = qs("button", dropdown);
    const submenu = qs(".submenu", dropdown);
    const arrow = qs(".arrow", dropdown);
    if (!btn || !submenu || !arrow) return;

    btn.addEventListener("click", () => {
      submenu.classList.toggle("hidden");
      arrow.classList.toggle("rotate-180");
    });
  });

  // 14. Delayed CTA show (if present)
  const delayedCTA = qs("#delayed-cta");
  if (delayedCTA) {
    setTimeout(() => delayedCTA.classList.add("show-cta"), 2500);
  }

  // ✅ Init the unified carousels LAST (so layout is stable)
  initCarousels();

  // Feather icons again (in case cards were cloned)
  if (window.feather) feather.replace();
});

  // 16. Clickable dots + active-dot sync for any .sga-carousel
  // (works for homepage + neon, uses data-dots container)
  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const viewport = carousel.querySelector(".sga-viewport");
    const track = carousel.querySelector(".sga-track");
    const dotsWrap = carousel.querySelector("[data-dots]");

    if (!viewport || !track || !dotsWrap) return;

    const cards = Array.from(track.children).filter((el) => el.nodeType === 1);
    if (!cards.length) return;

    // If you duplicated cards for looping, dots should represent the first half.
    // If not duplicated, this still works (dotCount becomes full length).
    let dotCount = cards.length;
    if (cards.length >= 2 && cards.length % 2 === 0) {
      dotCount = cards.length / 2;
    }

    dotsWrap.innerHTML = "";
    const dots = [];

    const scrollToIndex = (i) => {
      const target = cards[i];
      if (!target) return;

      const left =
        target.offsetLeft - (viewport.clientWidth - target.clientWidth) / 2;

      viewport.scrollTo({ left, behavior: "smooth" });
    };

    for (let i = 0; i < dotCount; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sga-dot" + (i === 0 ? " is-active" : "");
      btn.setAttribute("aria-label", `Go to slide ${i + 1}`);
      btn.addEventListener("click", () => scrollToIndex(i));

      dotsWrap.appendChild(btn);
      dots.push(btn);
    }

    // Update active dot based on the card nearest center
    let rafId = null;

    const updateActiveDot = () => {
      rafId = null;

      const centerX = viewport.scrollLeft + viewport.clientWidth / 2;

      let bestIndex = 0;
      let bestDist = Infinity;

      for (let i = 0; i < dotCount; i++) {
        const c = cards[i];
        if (!c) continue;

        const cCenter = c.offsetLeft + c.clientWidth / 2;
        const dist = Math.abs(cCenter - centerX);

        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }

      dots.forEach((d, idx) => d.classList.toggle("is-active", idx === bestIndex));
    };

    viewport.addEventListener("scroll", () => {
      if (rafId) return;
      rafId = requestAnimationFrame(updateActiveDot);
    });

    // Run once on load
    updateActiveDot();
  });

