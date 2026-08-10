const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

const orderForm = document.querySelector('#order-form');
if (orderForm) {
  const status = orderForm.querySelector('.form-status');
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = orderForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    status.textContent = 'Αποστολή...';
    try {
      const res = await fetch('https://formsubmit.co/ajax/kava.oldtom@gmail.com', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(orderForm)
      });
      if (res.ok) {
        status.textContent = '✓ Η παραγγελία σας στάλθηκε! Θα επικοινωνήσουμε μαζί σας για επιβεβαίωση.';
        orderForm.reset();
      } else {
        status.textContent = 'Κάτι πήγε στραβά. Δοκιμάστε ξανά ή καλέστε μας στο 216 600 8008.';
      }
    } catch (err) {
      status.textContent = 'Κάτι πήγε στραβά. Δοκιμάστε ξανά ή καλέστε μας στο 216 600 8008.';
    }
    submitBtn.disabled = false;
  });
}

const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('active');
    menuToggle.setAttribute('aria-expanded', isOpen);
  });
  document.querySelectorAll('.nav-links a').forEach(link => link.addEventListener('click', () => {
    navLinks.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');
  }));
}
