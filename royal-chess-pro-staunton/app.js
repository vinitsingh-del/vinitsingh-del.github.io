
(() => {
  const toast = document.createElement('div');
  toast.className = 'site-toast';
  document.body.appendChild(toast);
  let toastTimer;
  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.14 });
  document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));

  const onScroll = () => document.documentElement.style.setProperty('--hero-shift', Math.min(window.scrollY * 0.09, 62) + 'px');
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menu = document.querySelector('.site-nav');
  document.querySelector('.mobile-menu')?.addEventListener('click', () => menu?.classList.toggle('is-open'));
  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => menu.classList.remove('is-open')));

  const heroImage = document.querySelector('.hero-product');
  document.querySelectorAll('.gallery-thumb').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.gallery-thumb').forEach((item) => {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      const image = button.querySelector('img');
      if (heroImage && image) heroImage.src = image.src;
    });
  });

  let quantity = 1;
  let cartCount = 0;
  const output = document.querySelector('.stepper output');
  const stepButtons = document.querySelectorAll('.stepper button');
  const updateQuantity = () => {
    if (output) output.textContent = String(quantity);
    const total = new Intl.NumberFormat('en-IN').format(28400 * quantity);
    const heroAdd = document.querySelector('.buy-panel .add-button');
    if (heroAdd) heroAdd.textContent = 'Add to bag · ₹' + total;
  };
  stepButtons[0]?.addEventListener('click', () => { quantity = Math.max(1, quantity - 1); updateQuantity(); });
  stepButtons[1]?.addEventListener('click', () => { quantity += 1; updateQuantity(); });

  const addToBag = () => {
    cartCount += quantity;
    const bagCount = document.querySelector('.bag-button b');
    if (bagCount) bagCount.textContent = String(cartCount).padStart(2, '0');
    showToast(quantity + ' handcrafted set' + (quantity > 1 ? 's' : '') + ' reserved in your bag');
  };
  document.querySelectorAll('.add-button, .bag-button').forEach((button) => button.addEventListener('click', addToBag));

  document.querySelectorAll('.offer-card button').forEach((button) => {
    button.addEventListener('click', async () => {
      const code = button.textContent.includes('KING25') ? 'KING25' : 'STORE15';
      try { await navigator.clipboard.writeText(code); } catch (_) {}
      button.textContent = 'Copied';
      showToast(code + ' copied');
      setTimeout(() => button.textContent = code + ' · Copy', 1600);
    });
  });
})();
