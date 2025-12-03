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

// 10. Animate scroll for video
(function () {
  // Recompute how tall the scroller section must be so the sticky video
  // can stay fixed until it reaches the #video-stop section.
  function sizeVideoScroller() {
    const scroller = document.getElementById("video-scroller");
    const stop = document.getElementById("video-stop");
    if (!scroller || !stop) return; // page might not have the video hero

    // Distance from the top of the page to each element
    const scrollerTop = scroller.getBoundingClientRect().top + window.scrollY;
    const stopTop = stop.getBoundingClientRect().top + window.scrollY;

    // Height needed so that the sticky video remains fixed until #video-stop
    const neededHeight = Math.max(window.innerHeight, stopTop - scrollerTop);
    scroller.style.minHeight = neededHeight + "px";
  }

  // Optional: smooth scroll for in-page anchors (e.g., links to #video-stop)
  function wireSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const id = link.getAttribute("href");
        const el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY,
          behavior: "smooth",
        });
      });
    });
  }

  function init() {
    sizeVideoScroller();
    wireSmoothAnchors();

    // Recompute on resize, orientation change, and after assets load
    window.addEventListener("resize", sizeVideoScroller);
    window.addEventListener("orientationchange", sizeVideoScroller);
    window.addEventListener("load", sizeVideoScroller);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();