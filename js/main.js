// Cart utilities
function getCart() {
  try { return JSON.parse(localStorage.getItem('noir-cart')) || []; }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('noir-cart', JSON.stringify(cart));
}

function updateCartCount() {
  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('#cart-count').forEach(el => {
    el.textContent = total;
    el.style.display = total > 0 ? 'inline-flex' : 'none';
  });
}

function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  const cart = getCart();
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty += 1;
  else cart.push({ ...product, qty: 1 });
  saveCart(cart);
  updateCartCount();
  showToast(`${product.name} added to cart!`);
}

// Toast notification
function showToast(msg) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// Product card renderer
function productCard(p) {
  return `
    <div class="product-card" onclick="window.location='product.html?id=${p.id}'">
      <div class="product-img" style="background:${p.bg};">
        <div class="product-icon">${p.icon}</div>
        ${p.badge ? `<div class="product-badge">${p.badge}</div>` : ''}
        <button class="quick-add" onclick="event.stopPropagation(); addToCart(${p.id})">+ Add to Cart</button>
      </div>
      <div class="product-info">
        <p class="product-cat">${p.category}</p>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-price">₹${p.price.toLocaleString()}</p>
      </div>
    </div>
  `;
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
});
