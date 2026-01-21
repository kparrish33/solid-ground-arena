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
    const mobileAdvanceMs = parseInt(
      carousel.dataset.mobileAdvance || "4500",
      10,
    );
    const desktopSpeed = parseFloat(carousel.dataset.desktopSpeed || "0.45"); // px per frame-ish scaled below

    // Original (real) cards are those present at load
    const originalCards = qsa(".sga-card", track);
    const originalCount = originalCards.length;

    // Make sure cards are anchors (whole-card clickable requirement)
    // If someone accidentally uses divs later, this prevents silent failures.
    originalCards.forEach((card) => {
      if (card.tagName !== "A") {
        console.warn(
          "Carousel card is not an <a>. Whole-card click requires anchor.",
          card,
        );
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
      const target = cards.find(
        (c) => parseInt(c.dataset.originalIndex || "0", 10) === originalIdx,
      );
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

    /* ---------------------------
    3) Desktop Helpers
  --------------------------- */
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
        loopWidth = firstSet.reduce(
          (sum, el) => sum + el.getBoundingClientRect().width,
          0,
        );

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
        { passive: true },
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
   4) Main DOM Ready
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

  // 5. Feather icons
  if (window.feather) feather.replace();

  // 6. Mobile menu toggle
  const menuBtn = qs("#menu-btn");
  const mobileMenu = qs("#mobile-menu");

  function setIcon(isOpen) {
    if (!menuBtn) return;
    menuBtn.innerHTML = isOpen
      ? '<i data-feather="x"></i>'
      : '<i data-feather="menu"></i>';
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

  // 7. Auto-update footer year
  const yearSpan = qs("#year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // 8. Highlight active nav link
  const currentPage = window.location.pathname.split("/").pop();
  qsa(".nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) link.classList.add("text-[#5fbcff]");
  });

  // 9. Form animation on scroll
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
      { threshold: 0.15 },
    );
    observer.observe(formSection);
  }

  // 10. Thank-you message logic (contact form)
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
          thankYou.textContent = "Thanks! Your message has been sent.";
        } else {
          thankYou.classList.remove("hidden");
          thankYou.classList.add("text-red-500");
          thankYou.textContent = "Oops! Something went wrong.";
        }
      });
    });
  }

  // 11. Facility Event Form submission feedback
  const facilityForm = qs("#eventApplicationForm");
  const facilityThankYou = qs("#thankYouMsg");
  if (facilityForm && facilityThankYou) {
    facilityForm.addEventListener("submit", function (e) {
      e.preventDefault();
      facilityForm.reset();
      facilityThankYou.classList.remove("hidden");
    });
  }

  // 12. Expanding Stripes on Hover Animation
  qsa(".stripe-container").forEach((stripe) => {
    stripe.addEventListener("mouseenter", () => {
      stripe.style.transform = "skewY(-12deg) scale(1.02)";
    });
    stripe.addEventListener("mouseleave", () => {
      stripe.style.transform = "skewY(-12deg)";
    });
  });

  // 13. Livestream Auto-Detection & Glow Animation (FULL REWRITE)
  (function initLivestreamBadge() {
    const LIVE_PORTAL_URL = "https://impactenvi.watch.pixellot.tv/";
    const LIVE_LIST_URL = "https://impactenvi.watch.pixellot.tv/api/event/list";
    const POLL_MS = 90000;

    let liveEventUrl = LIVE_PORTAL_URL;
    let pollId = null;

    function getEls() {
      return {
        cards: document.querySelectorAll("#livestreamCard"),
        inlineBadges: document.querySelectorAll("#liveBadge"),
      };
    }

    function showUI() {
      const { cards, inlineBadges } = getEls();

      cards.forEach((card) => card.classList.add("livestream-glow"));

      inlineBadges.forEach((badge) => {
        badge.classList.remove("hidden");
        badge.classList.add("flex");
      });

      if (window.feather) feather.replace();
    }

    function hideUI() {
      const { card, inlineBadge } = getEls();

      if (card) card.classList.remove("livestream-glow");

      if (inlineBadge) {
        inlineBadge.classList.add("hidden");
        inlineBadge.classList.remove("flex", "opacity-100");
      }
    }

    async function fetchLiveEvent() {
      const payload = {
        page: 0,
        size: 20,
        next: true,
        count: false,
        filters: { status: "live" },
        isHomePage: true,
      };

      const res = await fetch(LIVE_LIST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const entries = data?.content?.entries || [];
      return entries[0] || null; // filtered to live, so first is enough
    }

    async function checkLivestream() {
      try {
        console.log("[LIVE] check start");

        const liveEvent = await fetchLiveEvent();
        console.log("[LIVE] result:", liveEvent ? liveEvent.status : "none");

        if (liveEvent) {
          const eventId = liveEvent.event_id || liveEvent._id;
          liveEventUrl = eventId
            ? `https://impactenvi.watch.pixellot.tv/events/${eventId}`
            : LIVE_PORTAL_URL;

          showUI();
        } else {
          liveEventUrl = LIVE_PORTAL_URL;

          // If you want the badges to disappear when not live, uncomment:
          // hideUI();
        }
      } catch (err) {
        console.warn("[LIVE] check failed:", err);
      }
    }

    function wireClicksOnce() {
      const { floatingBadge, closeBtn } = getEls();

      if (floatingBadge && !floatingBadge.dataset.liveWired) {
        floatingBadge.dataset.liveWired = "1";

        floatingBadge.addEventListener("click", () => {
          window.open(liveEventUrl || LIVE_PORTAL_URL, "_blank");
        });
      }

      if (closeBtn && !closeBtn.dataset.liveWired) {
        closeBtn.dataset.liveWired = "1";

        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const { floatingBadge: fb } = getEls();
          if (fb) fb.classList.add("hidden");
        });
      }
    }

    function start() {
      console.log("[LIVE] script init");

      wireClicksOnce();
      checkLivestream();

      if (pollId) clearInterval(pollId);
      pollId = setInterval(() => {
        wireClicksOnce(); // in case DOM is injected later
        checkLivestream();
      }, POLL_MS);
    }

    // Start after DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  })();

  // HOME-only popup: delay before showing + one-time fade-in per "go live"
(function homeLivePopup() {
  const path = window.location.pathname.replace(/\/+$/, "");
  const isHome = path === "" || path === "/" || path.endsWith("/index.html");
  if (!isHome) return;

  const badge = document.getElementById("liveBadgePopup");
  const closeBtn = document.getElementById("dismissLiveBadgePopup");
  if (!badge) return;

  const DISMISS_KEY = "liveBadgePopupDismissed";

  // tweak these
  const SHOW_DELAY_MS = 6000;   // <-- delay before showing after LIVE
  const POLL_MS = 2000;         // UI check interval (no API calls)

  let prevLive = false;
  let showTimer = null;

  function isLive() {
    // Mirrors your existing live UI state
    return !!document.querySelector("#livestreamCard.livestream-glow");
  }

  function hardHide() {
    // cancel any pending delayed show
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }

    badge.classList.add("hidden");
    badge.classList.remove("flex");

    // reset to invisible for next fade-in
    badge.classList.add("opacity-0");
    badge.classList.remove("opacity-100");
  }

  function fadeInOnce() {
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    // ensure it's displayed but still transparent first
    badge.classList.remove("hidden");
    badge.classList.add("flex");

    // next frame → fade to visible
    requestAnimationFrame(() => {
      badge.classList.remove("opacity-0");
      badge.classList.add("opacity-100");
    });
  }

  function scheduleShow() {
    if (showTimer) return; // already scheduled
    showTimer = setTimeout(() => {
      showTimer = null;
      // only show if still live at the moment delay finishes
      if (isLive()) fadeInOnce();
    }, SHOW_DELAY_MS);
  }

  function tick() {
    const liveNow = isLive();

    // LIVE just started (edge: false -> true)
    if (liveNow && !prevLive) {
      scheduleShow(); // delay, then fade in once
    }

    // LIVE ended (true -> false)
    if (!liveNow && prevLive) {
      hardHide();
    }

    // If not live and badge is somehow visible, keep it hidden
    if (!liveNow) {
      // (don’t re-hide constantly; hardHide already does it on transition)
    }

    prevLive = liveNow;
  }

  // Dismiss button
  closeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    sessionStorage.setItem(DISMISS_KEY, "1");
    hardHide();
  });

  // Clicking badge opens stream portal (or change URL)
  badge.addEventListener("click", () => {
    window.open("https://impactenvi.watch.pixellot.tv/", "_blank");
  });

  // init: start hidden
  hardHide();
  tick();
  setInterval(tick, POLL_MS);
})();

  // 14. Smooth Scroll
  const SCROLL_OFFSET = -500;
  qsa('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (!targetId || targetId === "#") return;

      const targetEl = qs(targetId);
      if (!targetEl) return;

      e.preventDefault();
      const y =
        targetEl.getBoundingClientRect().top +
        window.pageYOffset -
        SCROLL_OFFSET;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  });

  // 15. Mobile Dropdown Logic
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

  // 16. Delayed CTA show (if present)
  const delayedCTA = qs("#delayed-cta");
  if (delayedCTA) {
    setTimeout(() => delayedCTA.classList.add("show-cta"), 2500);
  }

  // ✅ Init the unified carousels LAST (so layout is stable)
  initCarousels();

  // ✅ DOTS CLICK (horizontal-only) — works with duplicated cards, no scrollIntoView
  (function wireCarouselDotsHorizontalOnly() {
    document.querySelectorAll("[data-carousel]").forEach((carousel) => {
      const viewport = carousel.querySelector(".sga-viewport");
      const track = carousel.querySelector(".sga-track");
      const dotsWrap = carousel.querySelector(".sga-dots");
      if (!viewport || !track || !dotsWrap) return;

      function centerCard(card) {
        const left =
          card.offsetLeft - (viewport.clientWidth - card.offsetWidth) / 2;
        viewport.scrollTo({ left, behavior: "smooth" });
      }

      function getMiddleDuplicate(originalIdx) {
        const cards = Array.from(track.querySelectorAll(".sga-card")).filter(
          (c) => {
            const v =
              c.getAttribute("data-original-index") ?? c.dataset.originalIndex;
            return Number(v) === Number(originalIdx);
          },
        );

        if (!cards.length) return null;

        // Choose the MIDDLE copy (index ≈ cards.length / 2)
        return cards[Math.floor(cards.length / 2)];
      }

      dotsWrap.onclick = (e) => {
        const btn = e.target.closest(".sga-dot");
        if (!btn) return;

        e.preventDefault();

        // Determine the intended index
        const idx =
          btn.dataset.index != null
            ? Number(btn.dataset.index)
            : Array.from(dotsWrap.children).indexOf(btn);

        if (idx < 0) return;

        const target = getMiddleDuplicate(idx);
        if (!target) return;

        centerCard(target);
      };
    });
  })();

  // Feather icons again (in case cards were cloned)
  if (window.feather) feather.replace();
});

// 17. PDF filename display
const birthdayPdfInput = document.getElementById("birthdayPdf");
const birthdayPdfName = document.getElementById("birthdayPdfName");
const birthdayPdfForm = document.getElementById("birthdayPdfForm");
const birthdayPdfMsg = document.getElementById("birthdayPdfMsg");
const birthdayPdfErr = document.getElementById("birthdayPdfErr")

if (birthdayPdfInput) {
  birthdayPdfInput.addEventListener("change", () => {
    if (birthdayPdfInput.files[0]) {
      birthdayPdfName.textContent = `Attached: ${birthdayPdfInput.files[0].name}`;
      birthdayPdfName.classList.remove("hidden");
    }

    // hide error once user selects a file
    if (birthdayPdfErr) birthdayPdfErr.classList.add("hidden");
  });
}

if (birthdayPdfForm) {
  birthdayPdfForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // --- mobile-safe PDF validation ---
    if (birthdayPdfErr) {
      birthdayPdfErr.textContent = "";
      birthdayPdfErr.classList.add("hidden");
    }

    const file =
      birthdayPdfInput && birthdayPdfInput.files && birthdayPdfInput.files[0];

    if (!file) {
      if (birthdayPdfErr) {
        birthdayPdfErr.textContent =
          "Please upload your completed PDF before submitting.";
        birthdayPdfErr.classList.remove("hidden");
      } else {
        birthdayPdfForm.reportValidity();
      }
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      (file.name && file.name.toLowerCase().endsWith(".pdf"));

    if (!isPdf) {
      if (birthdayPdfErr) {
        birthdayPdfErr.textContent =
          "That file isn’t a PDF. Please upload a .pdf file.";
        birthdayPdfErr.classList.remove("hidden");
      }
      return;
    }

    // ===== existing submit logic (unchanged) =====
    birthdayPdfMsg.textContent = "Submitting...";
    birthdayPdfMsg.classList.remove("hidden");

    const res = await fetch(birthdayPdfForm.action, {
      method: "POST",
      body: new FormData(birthdayPdfForm),
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      birthdayPdfForm.reset();
      birthdayPdfName.classList.add("hidden");
      if (birthdayPdfErr) birthdayPdfErr.classList.add("hidden");
      birthdayPdfMsg.textContent = "Thanks! Your PDF was submitted.";
    } else {
      birthdayPdfMsg.textContent = "Something went wrong.";
    }
  });
}

// 18. ONLINE FORM
const birthdayOnlineForm = qs("#birthdayOnlineForm");
const birthdayOnlineMsg = qs("#birthdayOnlineMsg");

if (birthdayOnlineForm && birthdayOnlineMsg) {
  birthdayOnlineForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // show browser bubbles for missing required fields
    if (!birthdayOnlineForm.checkValidity()) {
      birthdayOnlineForm.reportValidity();
      return;
    }

    birthdayOnlineMsg.classList.remove("hidden", "text-red-500");
    birthdayOnlineMsg.textContent = "Submitting...";

    try {
      const res = await fetch(birthdayOnlineForm.action, {
        method: "POST",
        body: new FormData(birthdayOnlineForm),
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        birthdayOnlineForm.reset();
        birthdayOnlineMsg.classList.remove("text-red-500");
        birthdayOnlineMsg.textContent =
          "Thank you! Your request has been submitted.";
      } else {
        birthdayOnlineMsg.classList.add("text-red-500");
        birthdayOnlineMsg.textContent = "Oops! Something went wrong.";
      }
    } catch (err) {
      birthdayOnlineMsg.classList.add("text-red-500");
      birthdayOnlineMsg.textContent = "Network error — please try again.";
    }
  });
}

// 19. ===== Facility ONLINE form (AJAX submit, no redirect) =====
const facilityOnlineForm = qs("#facilityOnlineForm");
const facilityOnlineMsg = qs("#facilityOnlineMsg");

if (facilityOnlineForm && facilityOnlineMsg) {
  facilityOnlineForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!facilityOnlineForm.checkValidity()) {
      facilityOnlineForm.reportValidity();
      return;
    }

    facilityOnlineMsg.classList.remove("hidden", "text-red-500");
    facilityOnlineMsg.textContent = "Submitting...";

    try {
      const res = await fetch(facilityOnlineForm.action, {
        method: "POST",
        body: new FormData(facilityOnlineForm),
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        facilityOnlineForm.reset();
        facilityOnlineMsg.classList.remove("text-red-500");
        facilityOnlineMsg.textContent =
          "Thank you! Your request has been submitted.";
      } else {
        facilityOnlineMsg.classList.add("text-red-500");
        facilityOnlineMsg.textContent = "Oops! Something went wrong.";
      }
    } catch (err) {
      facilityOnlineMsg.classList.add("text-red-500");
      facilityOnlineMsg.textContent = "Network error — please try again.";
    }
  });
}

// 20. ===== Facility PDF filename display =====
const facilityPdfInput = qs("#facilityPdf");
const facilityPdfName = qs("#facilityPdfName");

if (facilityPdfInput && facilityPdfName) {
  facilityPdfInput.addEventListener("change", () => {
    const file = facilityPdfInput.files && facilityPdfInput.files[0];
    if (file) {
      facilityPdfName.textContent = `Attached: ${file.name}`;
      facilityPdfName.classList.remove("hidden");
    } else {
      facilityPdfName.textContent = "";
      facilityPdfName.classList.add("hidden");
    }
  });
}

// 21. ===== Facility PDF form submit (AJAX submit, no redirect) =====
const facilityPdfForm = qs("#facilityPdfForm");
const facilityPdfMsg = qs("#facilityPdfMsg");
const facilityPdfErr = qs("#facilityPdfErr");

if (facilityPdfForm && facilityPdfMsg) {
  facilityPdfForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // --- custom mobile-safe PDF validation ---
if (facilityPdfErr) {
  facilityPdfErr.textContent = "";
  facilityPdfErr.classList.add("hidden");
}

const file =
  facilityPdfInput && facilityPdfInput.files && facilityPdfInput.files[0];

if (!file) {
  if (facilityPdfErr) {
    facilityPdfErr.textContent =
      "Please upload your completed PDF before submitting.";
    facilityPdfErr.classList.remove("hidden");
  } else {
    facilityPdfForm.reportValidity();
  }
  return;
}

const isPdf =
  file.type === "application/pdf" ||
  file.name.toLowerCase().endsWith(".pdf");

if (!isPdf) {
  if (facilityPdfErr) {
    facilityPdfErr.textContent =
      "That file isn’t a PDF. Please upload a .pdf file.";
    facilityPdfErr.classList.remove("hidden");
  }
  return;
}

// keep browser validation for all other required fields
if (!facilityPdfForm.checkValidity()) {
  facilityPdfForm.reportValidity();
  return;
}

    facilityPdfMsg.classList.remove("hidden", "text-red-500");
    facilityPdfMsg.textContent = "Submitting...";

    try {
      const res = await fetch(facilityPdfForm.action, {
        method: "POST",
        body: new FormData(facilityPdfForm),
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        facilityPdfForm.reset();
        if (facilityPdfName) {
          facilityPdfName.textContent = "";
          facilityPdfName.classList.add("hidden");
        }
        facilityPdfMsg.classList.remove("text-red-500");
        facilityPdfMsg.textContent = "Thanks! Your PDF was submitted.";
      } else {
        facilityPdfMsg.classList.add("text-red-500");
        facilityPdfMsg.textContent = "Oops! Something went wrong.";
      }
    } catch (err) {
      facilityPdfMsg.classList.add("text-red-500");
      facilityPdfMsg.textContent = "Network error — please try again.";
    }
  });
}

// =====================
// SHOP PAGE (HTML products + cart + mobile scroll)
// Requirements:
// - Shop page has: #productsGrid, #cartPanel, #cartItems, #cartSubtotal, #cartCount, #checkoutBtn
// - Each product card has: [data-product][data-id][data-title][data-session][data-description][data-price]
// - Each product button calls: onclick="addToCartFromHtml(this)"
// =====================
(function () {
  // --- 0) Only run on Shop page ---
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  // --- 1) Required cart UI elements ---
  const cartPanelEl = document.getElementById("cartPanel");
  const cartItemsEl = document.getElementById("cartItems");
  const cartSubtotalEl = document.getElementById("cartSubtotal");
  const cartCountEl = document.getElementById("cartCount");
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (
    !cartPanelEl ||
    !cartItemsEl ||
    !cartSubtotalEl ||
    !cartCountEl ||
    !checkoutBtn
  )
    return;

  const STORAGE_KEY = "sga_cart_v1";
  const cart = new Map(); // id -> { product, qty }
  const fmt = (n) => `$${Number(n).toFixed(2)}`;

  // --- 2) Helpers ---
  function scrollToCartOnMobile() {
    if (!window.matchMedia("(max-width: 1024px)").matches) return; // only mobile/tablet
    cartPanelEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function productFromCard(card) {
    if (!card) return null;
    const id = (card.dataset.id || "").trim();
    const title = (card.dataset.title || "").trim();
    const session = (card.dataset.session || "").trim();
    const description = (card.dataset.description || "").trim();
    const price = Number(card.dataset.price || 0);

    if (!id || !title || !price) return null;
    return { id, title, session, description, price };
  }

  function saveCart() {
    const arr = Array.from(cart.values()).map(({ product, qty }) => ({
      id: product.id,
      title: product.title,
      session: product.session,
      description: product.description,
      price: product.price,
      qty,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;

      arr.forEach((i) => {
        if (!i?.id || !i?.title || !i?.price || !i?.qty) return;
        cart.set(i.id, {
          product: {
            id: i.id,
            title: i.title,
            session: i.session || "",
            description: i.description || "",
            price: Number(i.price),
          },
          qty: Number(i.qty),
        });
      });
    } catch {
      // ignore
    }
  }

  // --- 3) Render cart UI (ONLY place this once) ---
  function renderCart() {
    const items = Array.from(cart.values());
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = items.reduce((sum, i) => sum + i.qty * i.product.price, 0);

    cartCountEl.textContent = `${count} ${count === 1 ? "item" : "items"}`;
    cartSubtotalEl.textContent = fmt(subtotal);

    if (items.length === 0) {
      cartItemsEl.innerHTML = `<p class="text-gray-500">Your cart is empty.</p>`;
      checkoutBtn.disabled = true;
      return;
    }

    checkoutBtn.disabled = false;

    cartItemsEl.innerHTML = items
      .map(({ product, qty }) => {
        const lineTotal = product.price * qty;

        return `
          <div class="border border-gray-200 rounded-2xl p-4">
            <div class="flex justify-between items-start gap-3">
              <div>
                <p class="font-semibold text-gray-900">${product.title}</p>
                <p class="text-sm text-gray-600">${product.session || ""}</p>
              </div>
              <p class="font-semibold">${fmt(lineTotal)}</p>
            </div>

            <div class="mt-3 flex items-center justify-between">
              <div class="inline-flex items-center gap-2">
                <button type="button"
                  class="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-50"
                  onclick="updateQty('${product.id}', -1)"
                  aria-label="Decrease quantity">−</button>

                <span class="min-w-[2ch] text-center font-semibold">${qty}</span>

                <button type="button"
                  class="w-9 h-9 rounded-full border border-gray-300 hover:bg-gray-50"
                  onclick="updateQty('${product.id}', 1)"
                  aria-label="Increase quantity">+</button>
              </div>

              <button type="button"
                class="text-sm underline text-gray-600 hover:text-gray-900"
                onclick="removeItem('${product.id}')">Remove</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // --- 4) Expose button handlers (inline onclick needs window.*) ---
  window.addToCartFromHtml = function (btn) {
    const card = btn?.closest?.("[data-product]");
    const product = productFromCard(card);
    if (!product) return;

    const current = cart.get(product.id);
    cart.set(product.id, { product, qty: current ? current.qty + 1 : 1 });

    saveCart();
    renderCart();
    scrollToCartOnMobile(); // ✅ mobile: jump user to cart after add
  };

  window.updateQty = function (id, delta) {
    const current = cart.get(id);
    if (!current) return;

    const next = current.qty + delta;
    if (next <= 0) cart.delete(id);
    else cart.set(id, { product: current.product, qty: next });

    saveCart();
    renderCart();
  };

  window.removeItem = function (id) {
    cart.delete(id);
    saveCart();
    renderCart();
  };

  // --- 5) Auto-add from URL (?add=PRODUCT_ID) ---
  function autoAddFromUrlOnce() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("add");
    if (!id) return;

    const card = document.querySelector(
      `[data-product][data-id="${CSS.escape(id)}"]`,
    );
    const product = productFromCard(card);
    if (!product) return;

    const current = cart.get(product.id);
    cart.set(product.id, { product, qty: current ? current.qty + 1 : 1 });

    saveCart();
    renderCart();
    scrollToCartOnMobile(); // ✅ mobile: jump to cart on deep link too

    // clean URL so refresh doesn't keep re-adding
    params.delete("add");
    const next = params.toString();
    history.replaceState(
      {},
      "",
      window.location.pathname + (next ? `?${next}` : ""),
    );
  }

  // --- 6) Checkout button ---
  checkoutBtn.addEventListener("click", () => {
    saveCart();
    window.location.href = "/checkout.html";
  });

  // --- 7) Start ---
  loadCart();
  renderCart();
  autoAddFromUrlOnce();
})();