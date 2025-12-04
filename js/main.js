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
