// 1. Logo flip animation
function flipLogo() {
  const logo = document.querySelector("nav img");
  if (logo) {
    logo.style.transition = "transform 0.5s ease";
    logo.style.transform = "rotateY(360deg)";
    setTimeout(() => {
      logo.style.transform = "rotateY(0)";
    }, 500);
  }
}

// 2. Wait until DOM is ready for the rest
document.addEventListener("DOMContentLoaded", function () {
  // a. Flip logo on page load
  flipLogo();

  // b. Flip logo when Home is clicked
  const homeLink = document.getElementById("home-link");
  if (homeLink) {
    homeLink.addEventListener("click", function (e) {
      e.preventDefault(); // stop immediate nav
      flipLogo();

      setTimeout(() => {
        window.location.href = homeLink.getAttribute("href");
      }, 600); // delay for animation
    });
  }

  // C. Feather icons
  if (window.feather) feather.replace();

  // 3. Mobile menu toggle
  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  function setIcon(isOpen) {
    menuBtn.innerHTML = isOpen
      ? '<i data-feather="x"></i>'
      : '<i data-feather="menu"></i>';
    feather.replace();
    menuBtn.setAttribute("aria-expanded", String(isOpen));
  }

  if (menuBtn && mobileMenu) {
    setIcon(false);
    menuBtn.addEventListener("click", () => {
      const isNowHidden = mobileMenu.classList.toggle("hidden");
      setIcon(!isNowHidden);
    });
  }

  // 4. Auto-update footer year
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // 5. Highlight active nav link
  const currentPage = window.location.pathname.split("/").pop();
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) {
      link.classList.add("text-[#5fbcff]");
    }
  });

  // 6. Form animation on scroll
  const formSection = document.querySelector("#contact-form .animate-slide-up");
  if (formSection) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("slide-up-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(formSection);
  }

  // 7. Thank-you message logic
  const form = document.getElementById("contactForm");
  const thankYou = document.getElementById("thankYouMessage");

  if (form && thankYou) {
    form.addEventListener("submit", function (e) {
      e.preventDefault(); // Prevent default browser submission
      const data = new FormData(form);

      fetch(form.action, {
        method: form.method,
        body: data,
        headers: { Accept: "application/json" },
      }).then((response) => {
        if (response.ok) {
          form.reset();
          thankYou.classList.remove("hidden");
          thankYou.classList.remove("text-red-500");
          thankYou.textContent = "Thanks! Your message has been sent. 🛼";
        } else {
          thankYou.textContent = "Oops! Something went wrong.";
          thankYou.classList.remove("hidden");
          thankYou.classList.add("text-red-500");
        }
      });
    });
  }

  // 8. Toggle tournament detail rows
  function toggleDetails(button) {
    const row = button.closest("tr");
    const nextRow = row.nextElementSibling;
    const isHidden = nextRow.classList.contains("hidden");
    nextRow.classList.toggle("hidden");
    button.innerHTML = isHidden ? "▲" : "▼";
  }
  window.toggleDetails = toggleDetails;
});

// 9. Facility Event Form submission feedback
const facilityForm = document.getElementById("eventApplicationForm");
const facilityThankYou = document.getElementById("thankYouMsg");

if (facilityForm && facilityThankYou) {
  facilityForm.addEventListener("submit", function (e) {
    e.preventDefault();
    facilityForm.reset();
    facilityThankYou.classList.remove("hidden");
  });
}

// 10. Expanding Stripes on Hover Animation
const stripes = document.querySelectorAll(".stripe-container");

stripes.forEach((stripe) => {
  stripe.addEventListener("mouseenter", () => {
    stripe.style.transform = "skewY(-12deg) scale(1.02)";
  });

  stripe.addEventListener("mouseleave", () => {
    stripe.style.transform = "skewY(-12deg)";
  });
});

// 11. Livestream Auto-Detection & Glow Animation
const card = document.getElementById("livestreamCard");
const inlineBadge = document.getElementById("liveBadge");
const floatingBadge = document.getElementById("floatingLiveBadge");
const closeBtn = document.getElementById("closeLiveBadge");

// Placeholder livestream check URL (we'll update this once we know the real one)
const LIVE_CHECK_URL = "https://impactenvi.watch.pixellot.tv/";

// Automatically checks if livestream is active
async function checkLivestream() {
  try {
    // Lightweight request (Pixellot will not allow us to read content due to CORS)
    await fetch(LIVE_CHECK_URL, { method: "HEAD", mode: "no-cors" });

    // TEMP LOGIC — We will replace this when we get the real API endpoint
    const isLive = true;

    if (isLive) {
      showLivestreamUI();
    }
  } catch (err) {
    console.warn("Livestream check error:", err);
  }
}

// Display UI changes when stream is live
function showLivestreamUI() {
  if (card) {
    card.classList.add("livestream-glow");
  }

  if (inlineBadge) {
    inlineBadge.classList.remove("opacity-0");
    inlineBadge.classList.add("opacity-100");
  }

  if (floatingBadge) {
    floatingBadge.classList.remove("hidden");
    floatingBadge.classList.add("flex");
  }
}

// Floating badge opens livestream page
if (floatingBadge) {
  floatingBadge.addEventListener("click", () => {
    window.open("https://impactenvi.watch.pixellot.tv/", "_blank");
  });
}

// Close floating badge without triggering open
if (closeBtn && floatingBadge) {
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    floatingBadge.classList.add("hidden");
  });
}

// Run check on load + every 60 seconds
checkLivestream();
setInterval(checkLivestream, 60000);

// Feather icons
feather.replace();

// 12.Smooth Scroll
const SCROLL_OFFSET = -500;

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const targetId = this.getAttribute("href");
    if (!targetId || targetId === "#") return;

    const targetEl = document.querySelector(targetId);
    if (!targetEl) return;

    e.preventDefault();

    const y =
      targetEl.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET;

    window.scrollTo({
      top: y,
      behavior: "smooth",
    });
  });
});

// 13. Upcoming Events Carousel Scroll - one-direction infinite loop w/ centered highlight
document.addEventListener("DOMContentLoaded", () => {
  const track = document.getElementById("eventsTrack");
  const nextBtn = document.getElementById("nextBtn");

  if (!track || !nextBtn) return;

  function getStep() {
    const cards = track.querySelectorAll(".event-card");
    if (cards.length < 2) return cards[0].getBoundingClientRect().width;

    const r0 = cards[0].getBoundingClientRect();
    const r1 = cards[1].getBoundingClientRect();
    const diff = r1.left - r0.left;
    return diff > 0 ? diff : r0.width;
  }

  let step = getStep();
  window.addEventListener("resize", () => {
    step = getStep();
  });

  /* -----------------------------
     HIGHLIGHT CENTER CARD
  ----------------------------- */
  function updateActiveCard() {
    const cards = Array.from(track.children);

    // Assuming 3 visible cards at a time → center = index 1
    const centerIndex = 2;

    cards.forEach((card, i) => {
      card.classList.remove("active", "dim");
      if (i === centerIndex) {
        card.classList.add("active");
      } else {
        card.classList.add("dim");
      }
    });
  }

  updateActiveCard(); // initial

  /* -----------------------------
     SLIDE + LOOP
  ----------------------------- */
  nextBtn.addEventListener("click", () => {
    if (!step) return;

    track.style.transition = "transform 0.4s ease";
    track.style.transform = `translateX(-${step}px)`;

    const onTransitionEnd = () => {
      track.style.transition = "none";

      // Move the first card to the end
      const firstCard = track.firstElementChild;
      if (firstCard) track.appendChild(firstCard);

      // Reset track position
      track.style.transform = "translateX(0)";

      updateActiveCard(); // <-- apply new center highlight
    };

    track.addEventListener("transitionend", onTransitionEnd, { once: true });
  });
});

// --- Mobile Swipe Support ---
let startX = 0;
let endX = 0;
const swipeTrack = document.getElementById("eventsTrack");

swipeTrack.addEventListener("touchstart", (e) => {
  startX = e.touches[0].clientX;
});

swipeTrack.addEventListener("touchmove", (e) => {
  endX = e.touches[0].clientX;
});

swipeTrack.addEventListener("touchend", () => {
  const diff = startX - endX;

  // Minimum swipe distance so small taps don't trigger
  const swipeThreshold = 50;

  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      // Swiped Left → go forward
      nextBtn.click();
    }
    // If you add a left arrow later, enable this:
    // else {
    //     prevBtn.click();
    // }
  }

  startX = 0;
  endX = 0;
});

// 14. Mobile Dropdown Logic
document.querySelectorAll(".mobile-dropdown").forEach((dropdown) => {
  const btn = dropdown.querySelector("button");
  const submenu = dropdown.querySelector(".submenu");
  const arrow = dropdown.querySelector(".arrow");

  btn.addEventListener("click", () => {
    submenu.classList.toggle("hidden");
    arrow.classList.toggle("rotate-180");
  });
});
