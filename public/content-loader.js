/**
 * content-loader.js
 * Fetches the editable website content from /api/content and applies it
 * to the page — overriding static HTML defaults with admin-edited values.
 *
 * For simple text: updates [data-editable] elements.
 * For lists: fully rebuilds the doctors grid, services grid, and testimonials.
 */

(function () {
  'use strict';

  // IntersectionObserver for scroll-reveal (shared with rebuilt sections)
  let revealObserver;

  function initRevealObserver() {
    if (revealObserver) return;
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
  }

  function observeReveals(container) {
    if (!revealObserver) return;
    container.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
  }

  // ── Apply flat text overrides ────────────────────────────────
  function applyText(textObj) {
    if (!textObj) return;
    Object.entries(textObj).forEach(([key, value]) => {
      document.querySelectorAll(`[data-editable="${key}"]`).forEach((el) => {
        // Preserve child SVG elements (e.g., btn-secondary arrow)
        const svgs = Array.from(el.querySelectorAll('svg'));
        el.innerHTML = value;
        svgs.forEach((svg) => el.appendChild(svg));
      });
    });
  }

  // ── Apply image overrides ────────────────────────────────────
  function applyImages(imagesObj) {
    if (!imagesObj) return;
    if (imagesObj.logo) {
      document.querySelectorAll('.nav-logo-icon, [data-editable-img="hero-logo"]').forEach((img) => {
        if (img.tagName === 'IMG') img.src = imagesObj.logo;
      });
      // Footer logo
      document.querySelectorAll('footer .nav-logo img').forEach((img) => {
        if (img.tagName === 'IMG') img.src = imagesObj.logo;
      });
    }
    // About section image
    if (imagesObj['about-image']) {
      var wrap = document.querySelector('.about-image-wrap');
      if (wrap) {
        var img = document.createElement('img');
        img.src = imagesObj['about-image'];
        img.alt = 'About our clinic';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;z-index:2;border-radius:12px;';
        wrap.style.position = 'relative';
        wrap.appendChild(img);
      }
    }
    // About section value card icons
    for (var vi = 1; vi <= 3; vi++) {
      if (imagesObj['about-val-icon-' + vi]) {
        var valIcons = document.querySelectorAll('.about-value');
        if (valIcons[vi - 1]) {
          var svgEl = valIcons[vi - 1].querySelector('.about-value-icon');
          if (svgEl) {
            var iconImg = document.createElement('img');
            iconImg.src = imagesObj['about-val-icon-' + vi];
            iconImg.alt = 'Value icon';
            iconImg.style.cssText = 'width:36px;height:36px;flex-shrink:0;object-fit:contain;';
            svgEl.parentNode.replaceChild(iconImg, svgEl);
          }
        }
      }
    }
    // Featured doctor photo
    if (imagesObj['feature-photo']) {
      var drWrap = document.querySelector('.dr-avatar-large');
      if (drWrap) {
        var drImg = document.createElement('img');
        drImg.src = imagesObj['feature-photo'];
        drImg.alt = 'Featured doctor';
        drImg.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;z-index:2;border-radius:12px;';
        drWrap.style.position = 'relative';
        drWrap.appendChild(drImg);
      }
    }
  }

  // ── Rebuild doctors grid ─────────────────────────────────────
  function rebuildDoctors(doctors) {
    if (!doctors || !doctors.length) return;
    const grid = document.querySelector('.doctors-grid');
    if (!grid) return;

    const gradients = [
      'linear-gradient(135deg, #152c3a 0%, #a3745b 100%)',
      'linear-gradient(135deg, #26505f 0%, #a3745b 100%)',
      'linear-gradient(135deg, #6e4a32 0%, #26505f 100%)',
      'linear-gradient(135deg, #1b3848 0%, #8b5e44 100%)',
      'linear-gradient(135deg, #26505f 0%, #c49a7e 100%)',
    ];
    const delays = ['', 'reveal-delay-1', 'reveal-delay-2', 'reveal-delay-3', 'reveal-delay-4'];

    grid.innerHTML = doctors.map((doc, i) => {
      const gradient = gradients[i % gradients.length];
      const delay = delays[i] || '';
      const avatarContent = doc.photo
        ? `<img src="${doc.photo}" alt="${doc.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;position:absolute;inset:0;" />`
        : `<svg class="doctor-avatar-svg" viewBox="0 0 100 120" fill="none">
            <circle cx="50" cy="38" r="28" fill="rgba(255,255,255,0.15)"/>
            <ellipse cx="50" cy="35" rx="14" ry="16" fill="rgba(255,255,255,0.3)"/>
            <path d="M20 80 C20 60 35 55 50 55 C65 55 80 60 80 80 L80 120 L20 120Z" fill="rgba(255,255,255,0.15)"/>
            <path d="M38 75 C38 72 42 70 45 72 C48 74 46 78 44 80" stroke="#a3745b" stroke-width="2" fill="none" stroke-linecap="round"/>
            <circle cx="57" cy="78" r="3" fill="#a3745b" opacity="0.7"/>
          </svg>`;
      const id = doc.id || '';
      return `
        <div class="doctor-card reveal ${delay}">
          <div class="doctor-avatar" style="background:${gradient};position:relative;">
            ${avatarContent}
            <div class="doctor-avatar-ring"></div>
          </div>
          <div class="doctor-info">
            <h3 data-editable="${id}-name">${doc.name}</h3>
            <div class="doctor-title" data-editable="${id}-title">${doc.title}</div>
          </div>
        </div>`;
    }).join('');

    observeReveals(grid);

    // Re-apply current language to newly built doctor elements
    if (typeof window.__reapplyLanguage === 'function') {
      window.__reapplyLanguage();
    }
  }

  // ── Rebuild services grid ────────────────────────────────────
  function rebuildServices(services) {
    if (!services || !services.length) return;
    const grid = document.querySelector('.services-grid');
    if (!grid) return;

    grid.innerHTML = services.map((svc) => {
      const id = svc.id || '';
      const iconHTML = svc.icon
        ? `<img class="svc-icon" src="${svc.icon}" alt="${svc.title}" />`
        : `<svg class="svc-icon-svg" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="34" fill="rgba(163,116,91,0.25)" stroke="rgba(163,116,91,0.4)" stroke-width="1.5"/>
            <path d="M40 22v16M40 38l10 10M40 38l-10 10" stroke="#a3745b" stroke-width="2.5" stroke-linecap="round"/>
          </svg>`;
      const bulletsHTML = (svc.bullets || []).map((b) => `<li>${b}</li>`).join('');
      return `
        <div class="service-card reveal">
          <div class="svc-default">
            ${iconHTML}
            <h3 data-translate="${id}-title">${svc.title}</h3>
          </div>
          <div class="svc-overlay">
            <div class="svc-overlay-inner">
              <h3 data-translate="${id}-title">${svc.title}</h3>
              <p data-translate="${id}-desc">${svc.description || ''}</p>
              <ul class="svc-overlay-bullets" data-translate="${id}-bullets">${bulletsHTML}</ul>
              <a href="#contact" class="svc-cta">Book Appointment
                <svg class="svc-cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>
          </div>
        </div>`;
    }).join('');

    // Re-attach touch reveal listeners
    grid.querySelectorAll('.service-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (!matchMedia('(hover: hover)').matches) {
          e.preventDefault();
          card.classList.toggle('revealed');
          grid.querySelectorAll('.service-card').forEach((c) => {
            if (c !== card) c.classList.remove('revealed');
          });
        }
      });
    });

    observeReveals(grid);

    // Re-apply current language to newly built service elements
    if (typeof window.__reapplyLanguage === 'function') {
      window.__reapplyLanguage();
    }
  }

  // ── Rebuild testimonials ─────────────────────────────────────
  function rebuildTestimonials(testimonials) {
    if (!testimonials || !testimonials.length) return;
    const track = document.querySelector('.testimonials-track');
    if (!track) return;

    track.innerHTML = testimonials.map((t, i) => {
      const idx = i + 1;
      return `
      <div class="testimonial-card">
        <div class="testimonial-stars">
          <span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span>
        </div>
        <p class="testimonial-text" data-editable="review-${idx}-text">${t.text}</p>
        <div class="testimonial-author">
          <div class="author-avatar" data-editable="review-${idx}-avatar">${t.avatar || (t.author || '').substring(0, 2).toUpperCase()}</div>
          <div>
            <div class="author-name" data-editable="review-${idx}-name">${t.author}</div>
            <div class="author-tag" data-editable="review-${idx}-tag">${t.tag}</div>
          </div>
        </div>
      </div>`;
    }).join('');

    // Re-apply current language to newly built testimonial elements
    if (typeof window.__reapplyLanguage === 'function') {
      window.__reapplyLanguage();
    }
  }

  // ── Apply contact / footer info ──────────────────────────────
  function applyContactInfo(text) {
    if (!text) return;
    // Contact section phone link
    const contactPhoneLink = document.getElementById('contact-phone-link');
    if (contactPhoneLink && text['contact-phone']) {
      contactPhoneLink.textContent = text['contact-phone'];
      contactPhoneLink.href = 'tel:' + text['contact-phone'].replace(/\D/g, '');
    }
    // Contact section address
    const contactAddr = document.getElementById('contact-address-text');
    if (contactAddr && text['contact-address'] && text['contact-city']) {
      contactAddr.innerHTML = text['contact-address'] + '<br/>' + text['contact-city'];
    } else if (contactAddr && text['contact-address']) {
      contactAddr.innerHTML = text['contact-address'];
    }

    // Footer phone hrefs (text updated by applyText via data-editable="footer-phone")
    if (text['footer-phone']) {
      document.querySelectorAll('[data-editable="footer-phone"]').forEach((a) => {
        if (a.tagName === 'A') a.href = 'tel:' + text['footer-phone'].replace(/\D/g, '');
      });
    }
    // Footer email href
    if (text['footer-email']) {
      document.querySelectorAll('[data-editable="footer-email"]').forEach((a) => {
        if (a.tagName === 'A') a.href = 'mailto:' + text['footer-email'];
      });
    }
    // Emergency banner phone link
    const emergencyPhoneLinks = document.querySelectorAll('.emergency-phone');
    if (text['emergency-phone']) {
      emergencyPhoneLinks.forEach((a) => {
        a.textContent = text['emergency-phone'];
        if (a.tagName === 'A') a.href = 'tel:' + text['emergency-phone'].replace(/\D/g, '');
      });
    }
    // Hours emergency line
    const hoursEmergency = document.querySelector('[data-editable="hours-emergency"]');
    if (hoursEmergency && text['hours-emergency']) {
      hoursEmergency.textContent = text['hours-emergency'];
    }
    // Nav phone
    const navPhone = document.querySelector('.nav-phone');
    if (navPhone && text['contact-phone']) {
      navPhone.textContent = '☎ ' + text['contact-phone'];
      navPhone.href = 'tel:' + text['contact-phone'].replace(/\D/g, '');
    }
    const mobileMenuPhone = document.querySelector('.mobile-menu-phone');
    if (mobileMenuPhone && text['contact-phone']) {
      mobileMenuPhone.textContent = '☎ ' + text['contact-phone'];
      mobileMenuPhone.href = 'tel:' + text['contact-phone'].replace(/\D/g, '');
    }
    // Promise / hours btn phone references
    const promiseBtn = document.querySelector('[data-editable="promise-btn"]');
    if (promiseBtn && text['promise-btn']) promiseBtn.textContent = text['promise-btn'];
  }

  // ── Main ─────────────────────────────────────────────────────
  async function loadContent() {
    try {
      initRevealObserver();

      const res = await fetch('/api/content');
      if (!res.ok) return;
      const content = await res.json();

      if (content.text) {
        applyText(content.text);
        applyContactInfo(content.text);
      }
      if (content.images) {
        applyImages(content.images);
      }
      if (content.doctors && content.doctors.length) {
        rebuildDoctors(content.doctors);
      }
      if (content.services && content.services.length) {
        rebuildServices(content.services);
      }
      if (content.testimonials && content.testimonials.length) {
        rebuildTestimonials(content.testimonials);
      }
    } catch {
      // Silent fail — static HTML defaults remain visible
    }
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadContent);
  } else {
    loadContent();
  }
})();
