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
            entry.target.classList.remove("opacity-0");
            entry.target.classList.add("opacity-100");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
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

// 12.Upcoming Events Carousel Scroll
const eventsCarousel = document.getElementById("eventsCarousel");
const eventsPrev = document.getElementById("eventsPrev");
const eventsNext = document.getElementById("eventsNext");

if (eventsCarousel && eventsPrev && eventsNext) {
  const scrollAmount = 340; // roughly one card width

  eventsPrev.addEventListener("click", () => {
    eventsCarousel.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  });

  eventsNext.addEventListener("click", () => {
    eventsCarousel.scrollBy({ left: scrollAmount, behavior: "smooth" });
  });
}
