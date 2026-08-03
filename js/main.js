// ===== CHOICE KART - Premium Grocery Store =====
// Connected to Supabase for live product data

// ===== STATE =====
let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem('choicekart_cart')) || [];

// Delivery charge settings (loaded from admin delivery_charges table)
let _deliveryFreeAbove = 0; // 0 means no free delivery threshold set
let _deliveryDefaultCharge = 0; // 0 means free delivery

// Fallback images & category icons
const CATEGORY_ICONS = {
    'grocery': 'fas fa-shopping-basket',
    'fruits': 'fas fa-apple-alt',
    'vegetables': 'fas fa-carrot',
    'dairy': 'fas fa-cheese',
    'snacks': 'fas fa-cookie-bite',
    'beverages': 'fas fa-mug-hot',
    'household': 'fas fa-home',
    'personal care': 'fas fa-pump-soap',
    'bakery': 'fas fa-bread-slice',
    'frozen': 'fas fa-snowflake',
    'baby care': 'fas fa-baby',
    'pet care': 'fas fa-paw'
};

const PLACEHOLDER_IMG = 'assets/images/logo.jpeg';

// ===== LOAD BANNERS FROM SUPABASE =====
// Banners are added AFTER the default hero slide and auto-scroll together.
// Default hero is always slide 0. Admin banners are slides 1, 2, 3...
async function loadBanners() {
    const { data: banners, error } = await db
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .eq('position', 'home')
        .order('sort_order');

    if (error || !banners || banners.length === 0) return; // Keep default hero only

    const slider = document.getElementById('banner-slider');
    const dots = document.getElementById('banner-dots');

    // Add dot for default hero (slide 0)
    const heroDot = document.createElement('button');
    heroDot.className = 'banner-dot active';
    heroDot.onclick = () => goToBanner(0);
    dots.appendChild(heroDot);

    // Add admin banner slides after the default hero
    banners.forEach((b, i) => {
        const slide = document.createElement('div');
        slide.className = 'banner-slide image-banner';
        // Use object-fit: contain to prevent cropping — full image visible
        const imgTag = `<img src="${b.image_url}" alt="${b.title}" loading="lazy" style="object-fit:${b.fit || 'contain'};">`;
        slide.innerHTML = b.link_url
            ? `<a href="${b.link_url}">${imgTag}</a>`
            : `<div class="image-banner-wrap">${imgTag}</div>`;
        slider.appendChild(slide);

        // Add dot for this banner
        const dot = document.createElement('button');
        dot.className = 'banner-dot';
        dot.onclick = () => goToBanner(i + 1); // +1 because default hero is slide 0
        dots.appendChild(dot);
    });

    // Auto-scroll all slides (hero + banners) every 5 seconds
    const totalSlides = banners.length + 1; // +1 for default hero
    let current = 0;
    setInterval(() => {
        current = (current + 1) % totalSlides;
        goToBanner(current);
    }, 5000);
}

function goToBanner(index) {
    const allSlides = document.querySelectorAll('.banner-slide');
    const allDots = document.querySelectorAll('.banner-dot');

    allSlides.forEach((s, i) => {
        s.classList.toggle('active', i === index);
    });
    allDots.forEach((d, i) => d.classList.toggle('active', i === index));
}

// ===== LOAD DATA FROM SUPABASE =====
async function loadCategories() {
    const { data, error } = await db
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

    if (error) { console.error('Categories load error:', error); return; }
    categories = data || [];

    // Render category nav
    renderCategoryNav();
    // Render categories grid
    renderCategoriesGrid();
}

// Website product pagination
const PRODUCTS_PER_PAGE = 20;
let currentProductPage = 1;
let totalProductCount = 0;
let currentCategoryFilter = 'all';
let currentSubcategoryFilter = null;

// Load delivery charge slabs from admin delivery_charges table
// All values come from what admin sets — no hardcoded amounts
// ===== LOAD OFFERS FROM SUPABASE =====
const OFFER_STYLES = {
    mega: 'linear-gradient(135deg, #C62828, #EF5350)',
    savings: 'linear-gradient(135deg, #0D47A1, #42A5F5)',
    delivery: 'linear-gradient(135deg, #1B5E20, #4CAF50)',
    festive: 'linear-gradient(135deg, #E65100, #FF9800)',
    flash: 'linear-gradient(135deg, #4A148C, #AB47BC)'
};

async function loadOffers() {
    const { data: offers, error } = await db
        .from('offers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

    const grid = document.getElementById('offers-grid');
    if (!grid) return;

    if (error || !offers || offers.length === 0) {
        // No offers in DB — show default offers (light pastel style)
        grid.innerHTML = `
            <div class="offer-card-v2 oc-warm">
                <div class="oc-text">
                    <span class="oc-tag">Limited Time</span>
                    <h3>Fresh Deals<br>Every Day</h3>
                    <p>Save big on fresh fruits, vegetables &amp; daily essentials</p>
                    <div class="oc-value">Up to <strong>30% OFF</strong></div>
                    <a href="#products-section" class="oc-btn green"><i class="fas fa-shopping-bag"></i> Shop Now</a>
                </div>
            </div>
            <div class="offer-card-v2 oc-blue">
                <div class="oc-text">
                    <span class="oc-tag"><i class="fas fa-truck"></i> Free Delivery</span>
                    <h3>Free Doorstep<br>Delivery</h3>
                    <p>On all orders within Jagtial city limits</p>
                    <div class="oc-value">₹<strong>0</strong> Delivery</div>
                    <a href="#products-section" class="oc-btn blue"><i class="fas fa-truck"></i> Order Now</a>
                </div>
            </div>
            <div class="offer-card-v2 oc-green">
                <div class="oc-text">
                    <span class="oc-tag"><i class="fas fa-bolt"></i> Express</span>
                    <h3>30-Minute<br>Delivery</h3>
                    <p>Lightning-fast delivery across Jagtial</p>
                    <div class="oc-value">⚡ <strong>30 MIN</strong></div>
                    <a href="#products-section" class="oc-btn green"><i class="fas fa-bolt"></i> Shop Now</a>
                </div>
            </div>
        `;
        return;
    }

    grid.innerHTML = offers.map(o => {
        if (o.image_url) {
            // Image-based offer card
            return `
                <a href="${o.link_url || '#products-section'}" class="offer-card offer-image-card" style="padding:0;overflow:hidden;">
                    <img src="${o.image_url}" alt="${o.title}" style="width:100%;height:100%;object-fit:cover;display:block;min-height:160px;" loading="lazy">
                </a>
            `;
        }
        // Text-based colored card
        return `
            <div class="offer-card" style="background:${OFFER_STYLES[o.style] || OFFER_STYLES.mega};">
                <span class="offer-label">${o.subtitle || o.style.toUpperCase()}</span>
                <h3>${o.title}</h3>
                ${o.description ? `<p>${o.description}</p>` : ''}
                <div class="offer-value">${o.offer_value}</div>
                <a href="${o.link_url || '#products-section'}" class="offer-btn">
                    <i class="fas fa-shopping-bag"></i> ${o.coupon_code ? 'Use Code: ' + o.coupon_code : 'Shop Now'}
                </a>
            </div>
        `;
    }).join('');
}

async function loadDeliverySettings() {
    const { data: slabs } = await db
        .from('delivery_charges')
        .select('*')
        .eq('is_active', true)
        .order('min_distance_km');

    if (!slabs || slabs.length === 0) return;

    // Find the highest free_above_amount across all slabs (that's the threshold)
    // Find the applicable delivery charge (use the slab with free_above_amount)
    for (const slab of slabs) {
        if (slab.free_above_amount && Number(slab.free_above_amount) > 0) {
            _deliveryFreeAbove = Number(slab.free_above_amount);
            _deliveryDefaultCharge = Number(slab.charge);
            break;
        }
    }

    // If no slab has free_above_amount, use the most common non-zero charge
    if (_deliveryDefaultCharge === 0 && _deliveryFreeAbove === 0) {
        const nonFreeSlabs = slabs.filter(s => Number(s.charge) > 0);
        if (nonFreeSlabs.length > 0) {
            _deliveryDefaultCharge = Number(nonFreeSlabs[0].charge);
        }
    }
}

async function loadProducts() {
    // Load first page — recently modified/added first
    const { data, error, count } = await db
        .from('products')
        .select('*, categories(name, slug)', { count: 'exact' })
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .range(0, PRODUCTS_PER_PAGE - 1);

    if (error) { console.error('Products load error:', error); return; }
    totalProductCount = count || 0;
    currentProductPage = 1;
    currentCategoryFilter = 'all';

    products = mapProducts(data);
    renderProducts('all');
}

/** Load a specific page of products */
async function loadProductPage(page) {
    currentProductPage = page;
    const from = (page - 1) * PRODUCTS_PER_PAGE;
    const to = from + PRODUCTS_PER_PAGE - 1;

    let query = db
        .from('products')
        .select('*, categories(name, slug)', { count: 'exact' })
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

    if (currentSubcategoryFilter) {
        query = query.eq('subcategory_id', currentSubcategoryFilter);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) { console.error('Load page error:', error); return; }

    totalProductCount = count || 0;
    products = mapProducts(data);
    renderProducts(currentCategoryFilter);
}

/** Title Case helper — "aashirvaad WHOLE wheat" → "Aashirvaad Whole Wheat" */
function toTitleCase(text) {
    if (!text) return '';
    const minor = ['of','and','the','in','on','at','to','for','with','a','an'];
    return text.trim().split(/\s+/).map((w, i) => {
        const l = w.toLowerCase();
        return (i > 0 && minor.includes(l)) ? l : l.charAt(0).toUpperCase() + l.slice(1);
    }).join(' ');
}

/** Map Supabase product rows to frontend format */
function mapProducts(data) {
    return (data || []).map(p => ({
        id: p.id,
        name: toTitleCase(p.name),
        brand: toTitleCase(p.brand) || '',
        price: Number(p.selling_price),
        originalPrice: Number(p.mrp),
        discount: p.mrp > p.selling_price ? Math.round((1 - p.selling_price / p.mrp) * 100) : 0,
        weight: (p.unit_value || 1) + ' ' + (p.unit || 'piece'),
        category: p.categories?.slug || '',
        category_id: p.category_id,
        subcategory_id: p.subcategory_id || null,
        image: p.image_url || PLACEHOLDER_IMG,
        is_featured: p.is_featured
    }));
}

// ===== RENDER CATEGORY NAV =====
function renderCategoryNav() {
    const container = document.getElementById('category-nav-container');
    if (!container) return;

    // Keep the All Categories button and the All link
    const offersLink = container.querySelector('.offers-link');
    const allCatBtn = container.querySelector('.all-categories');
    const allLink = container.querySelector('a.active');

    // Build category links
    const catLinks = categories.map(c => {
        const iconClass = CATEGORY_ICONS[c.slug] || 'fas fa-tag';
        return `<a href="#" onclick="filterByCategory('${c.slug}', this); return false;"><i class="${iconClass}"></i> ${c.name}</a>`;
    }).join('');

    container.innerHTML = '';
    if (allCatBtn) container.appendChild(allCatBtn);
    if (allLink) container.appendChild(allLink);
    container.insertAdjacentHTML('beforeend', catLinks);
    if (offersLink) container.appendChild(offersLink);
}

// ===== LOAD SUBCATEGORIES =====
async function loadSubcategories() {
    const { data: subcats } = await db
        .from('subcategories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
    window._allSubcats = subcats || [];
}

// ===== RENDER CATEGORIES GRID =====
async function renderCategoriesGrid() {
    // Load subcategories (needed for mega menu even if grid is absent)
    await loadSubcategories();

    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    if (categories.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#9CA3AF;grid-column:1/-1;">Categories coming soon!</p>';
        return;
    }

    // Get product counts per category
    const { data: prodCounts } = await db
        .from('products')
        .select('category_id')
        .eq('is_active', true);

    const countMap = {};
    (prodCounts || []).forEach(p => {
        countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
    });

    grid.innerHTML = categories.map(c => {
        const count = countMap[c.id] || 0;
        return `
            <div class="category-card" data-category="${c.slug}" data-category-id="${c.id}">
                <div class="category-icon">
                    ${c.image_url
                        ? `<img src="${c.image_url}" alt="${c.name}" loading="lazy" decoding="async">`
                        : `<i class="${CATEGORY_ICONS[c.slug] || 'fas fa-tag'}" style="font-size:36px;color:var(--primary);"></i>`
                    }
                </div>
                <h4>${c.name}</h4>
                <span class="category-count">${count > 0 ? count + ' Products' : 'Coming Soon'}</span>
            </div>
        `;
    }).join('');

    // Re-attach click handlers
    grid.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            const cat = card.dataset.category;
            const catId = card.dataset.categoryId;
            if (cat) {
                filterByCategory(cat);
                showSubcategoryStrip(catId, cat);
            }
        });
    });

    // Show subcategory strip for a selected category (BigBasket-style)
    function showSubcategoryStrip(categoryId, categorySlug) {
        let strip = document.getElementById('subcategory-strip');
        if (!strip) {
            strip = document.createElement('div');
            strip.id = 'subcategory-strip';
            strip.className = 'subcategory-strip';
            grid.parentNode.insertBefore(strip, grid.nextSibling);
        }
        const subs = (window._allSubcats || []).filter(s => s.category_id === categoryId);
        if (subs.length === 0) {
            strip.style.display = 'none';
            return;
        }
        strip.style.display = 'flex';
        strip.innerHTML = `<span class="sub-strip-item active" data-sub="all">All</span>` +
            subs.map(s => `<span class="sub-strip-item" data-sub="${s.id}">${s.name}</span>`).join('');

        strip.querySelectorAll('.sub-strip-item').forEach(item => {
            item.addEventListener('click', () => {
                strip.querySelectorAll('.sub-strip-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                const subId = item.dataset.sub;
                if (subId === 'all') {
                    currentSubcategoryFilter = null;
                } else {
                    currentSubcategoryFilter = subId;
                }
                // Reload from Supabase with subcategory filter
                loadProductPage(1);
            });
        });
    }
}

// ===== CART =====
function saveCart() {
    localStorage.setItem('choicekart_cart', JSON.stringify(cart));
    updateCartUI();
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    saveCart();
    showToast(product.name + ' added to cart!');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
}

function updateQty(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    item.qty += change;
    if (item.qty <= 0) removeFromCart(productId);
    else saveCart();
}

function getCartTotal() { return cart.reduce((t, i) => t + i.price * i.qty, 0); }
function getCartCount() { return cart.reduce((c, i) => c + i.qty, 0); }
function getCartSavings() { return cart.reduce((t, i) => t + (i.originalPrice - i.price) * i.qty, 0); }

// ===== CART COUPON =====
let cartCoupon = null; // { code, discount_type, discount_value, min_order_amount, max_discount }
let cartCouponDiscount = 0;

/** Apply coupon code in cart */
async function applyCartCoupon() {
    const input = document.getElementById('cartCouponInput');
    const status = document.getElementById('cartCouponStatus');
    const code = input.value.trim().toUpperCase();

    if (!code) { status.innerHTML = '<span style="color:#EF4444;">Enter a coupon code</span>'; return; }

    // Look up coupon in database
    const { data: coupon, error } = await db
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

    if (error || !coupon) {
        cartCoupon = null;
        cartCouponDiscount = 0;
        status.innerHTML = '<span style="color:#EF4444;"><i class="fas fa-times-circle"></i> Invalid coupon code</span>';
        updateCartUI();
        return;
    }

    // Check expiry
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
        status.innerHTML = '<span style="color:#EF4444;"><i class="fas fa-times-circle"></i> Coupon has expired</span>';
        return;
    }

    // Check min order amount
    const subtotal = getCartTotal();
    if (coupon.min_order_amount && subtotal < Number(coupon.min_order_amount)) {
        status.innerHTML = `<span style="color:#EF4444;"><i class="fas fa-times-circle"></i> Min order ₹${Number(coupon.min_order_amount).toLocaleString('en-IN')} required</span>`;
        return;
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        status.innerHTML = '<span style="color:#EF4444;"><i class="fas fa-times-circle"></i> Coupon usage limit reached</span>';
        return;
    }

    // Valid — calculate discount
    cartCoupon = coupon;
    if (coupon.discount_type === 'percentage') {
        cartCouponDiscount = subtotal * Number(coupon.discount_value) / 100;
        if (coupon.max_discount) cartCouponDiscount = Math.min(cartCouponDiscount, Number(coupon.max_discount));
    } else {
        cartCouponDiscount = Number(coupon.discount_value);
    }

    const discountText = coupon.discount_type === 'percentage'
        ? `${coupon.discount_value}% off` + (coupon.max_discount ? ` (max ₹${coupon.max_discount})` : '')
        : `₹${coupon.discount_value} off`;

    status.innerHTML = `
        <span style="color:#059669;"><i class="fas fa-check-circle"></i> <strong>${code}</strong> applied — ${discountText}!</span>
        <span onclick="removeCartCoupon()" style="color:#EF4444;cursor:pointer;margin-left:8px;font-size:11px;"><i class="fas fa-times"></i> Remove</span>
    `;

    updateCartUI();
}

/** Remove applied coupon */
function removeCartCoupon() {
    cartCoupon = null;
    cartCouponDiscount = 0;
    document.getElementById('cartCouponInput').value = '';
    document.getElementById('cartCouponStatus').innerHTML = '';
    updateCartUI();
}

// ===== UPDATE CART UI =====
function updateCartUI() {
    const count = getCartCount();
    document.querySelectorAll('.cart-badge').forEach(b => {
        b.textContent = count;
        b.style.display = count > 0 ? 'flex' : 'none';
    });

    const cartItems = document.getElementById('cart-items');
    const cartEmpty = document.getElementById('cart-empty');
    const cartFooter = document.getElementById('cart-footer');
    const cartCount = document.getElementById('cart-count');
    if (!cartItems) return;
    if (cartCount) cartCount.textContent = count;

    if (cart.length === 0) {
        cartItems.innerHTML = '';
        if (cartEmpty) cartEmpty.style.display = 'flex';
        if (cartFooter) cartFooter.style.display = 'none';
        // Reset all product card buttons back to "Add to Cart"
        document.querySelectorAll('.product-card').forEach(card => {
            const addBtn = card.querySelector('.add-btn');
            const qtyCtrl = card.querySelector('.qty-controls');
            if (addBtn) addBtn.style.display = 'flex';
            if (qtyCtrl) qtyCtrl.classList.remove('active');
        });
        // Show popular products in empty cart
        const emptyProds = document.getElementById('cart-empty-products');
        if (emptyProds) {
            const popular = products.filter(p => p.discount > 0).slice(0, 4);
            emptyProds.innerHTML = '<h4><i class="fas fa-fire" style="color:#E53935;"></i> Today\'s Popular Picks</h4>' +
                popular.map(p => `
                    <div class="cart-empty-product" onclick="addToCart('${p.id}')">
                        <img src="${p.image}" alt="${p.name}">
                        <div class="cep-info">
                            <div class="cep-name">${p.name}</div>
                            <div class="cep-price">\u20B9${p.price} <span style="text-decoration:line-through;color:#999;font-weight:400;font-size:11px;">\u20B9${p.originalPrice}</span></div>
                        </div>
                        <button class="cep-add" onclick="event.stopPropagation(); addToCart('${p.id}')">+ Add</button>
                    </div>
                `).join('');
        }
        return;
    }

    if (cartEmpty) cartEmpty.style.display = 'none';
    if (cartFooter) cartFooter.style.display = 'block';

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-image">
                <img src="${item.image}" alt="${item.name}">
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">\u20B9${item.price} \u00D7 ${item.qty} = \u20B9${(item.price * item.qty).toLocaleString('en-IN')}</div>
            </div>
            <div class="cart-item-qty">
                <button onclick="updateQty('${item.id}', -1)">\u2212</button>
                <span>${item.qty}</span>
                <button onclick="updateQty('${item.id}', 1)">+</button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" title="Remove">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');

    const cartTotal = getCartTotal();
    document.querySelectorAll('.cart-total-amount').forEach(el => {
        el.textContent = '\u20B9' + cartTotal.toLocaleString('en-IN');
    });
    const savings = document.getElementById('cart-savings');
    if (savings) savings.textContent = '\u20B9' + getCartSavings().toLocaleString('en-IN');

    // Free delivery bar — uses loaded delivery slabs from DB
    const freeBar = document.getElementById('freeDeliveryBar');
    const freeAbove = _deliveryFreeAbove; // loaded from DB on init
    const defaultCharge = _deliveryDefaultCharge;

    if (freeBar) {
        if (freeAbove > 0 && cartTotal < freeAbove) {
            const remaining = freeAbove - cartTotal;
            const progress = Math.min(100, (cartTotal / freeAbove) * 100);
            freeBar.innerHTML = `
                <div style="background:#FEF3C7;border-radius:10px;padding:10px 14px;">
                    <div style="font-size:13px;font-weight:600;color:#92400E;margin-bottom:6px;">
                        <i class="fas fa-truck"></i> Add ₹${remaining.toLocaleString('en-IN')} more for <span style="color:#059669;">FREE delivery!</span>
                    </div>
                    <div style="background:#E5E7EB;border-radius:4px;height:6px;overflow:hidden;">
                        <div style="background:linear-gradient(90deg,#F59E0B,#059669);height:100%;border-radius:4px;width:${progress}%;transition:width 0.3s;"></div>
                    </div>
                </div>`;
        } else if (freeAbove > 0) {
            freeBar.innerHTML = `
                <div style="background:#ECFDF5;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:8px;">
                    <i class="fas fa-check-circle" style="color:#059669;font-size:16px;"></i>
                    <span style="font-size:13px;font-weight:600;color:#065F46;">You get FREE delivery!</span>
                </div>`;
        } else {
            freeBar.innerHTML = '';
        }
    }

    // Delivery charge — free if above threshold, else use DB charge
    const deliveryCharge = (freeAbove > 0 && cartTotal >= freeAbove) ? 0 : defaultCharge;
    const deliveryEl = document.getElementById('cart-delivery');
    if (deliveryEl) {
        deliveryEl.textContent = deliveryCharge === 0 ? 'FREE' : '₹' + deliveryCharge;
        deliveryEl.style.color = deliveryCharge === 0 ? '#059669' : '#F59E0B';
    }

    // Coupon discount row
    const couponRow = document.getElementById('cartCouponRow');
    const couponDiscountEl = document.getElementById('cart-coupon-discount');
    if (couponRow && couponDiscountEl) {
        if (cartCoupon && cartCouponDiscount > 0) {
            couponRow.style.display = 'flex';
            couponDiscountEl.textContent = '-₹' + cartCouponDiscount.toLocaleString('en-IN');
        } else {
            couponRow.style.display = 'none';
        }
    }

    // Final total (subtotal - coupon + delivery)
    const finalTotal = cartTotal - cartCouponDiscount + deliveryCharge;
    const finalTotalEl = document.getElementById('cart-final-total');
    if (finalTotalEl) {
        finalTotalEl.textContent = '₹' + Math.max(0, finalTotal).toLocaleString('en-IN');
    }

    // Update product card buttons
    document.querySelectorAll('.product-card').forEach(card => {
        const id = card.dataset.id;
        const cartItem = cart.find(i => i.id === id);
        const addBtn = card.querySelector('.add-btn');
        const qtyCtrl = card.querySelector('.qty-controls');
        const qtySpan = card.querySelector('.qty-value');
        if (cartItem && addBtn && qtyCtrl) {
            addBtn.style.display = 'none';
            qtyCtrl.classList.add('active');
            if (qtySpan) qtySpan.textContent = cartItem.qty;
        } else if (addBtn && qtyCtrl) {
            addBtn.style.display = 'flex';
            qtyCtrl.classList.remove('active');
        }
    });
}

// ===== RENDER PRODUCTS =====
function renderProductCard(product) {
    return `
        <div class="product-card" data-id="${product.id}">
            <div class="product-image">
                ${product.discount > 0 ? `<span class="product-discount">${product.discount}% OFF</span>` : ''}
                <span class="delivery-badge"><i class="fas fa-bolt"></i> 30 MIN</span>
                <img src="${product.image}" alt="${product.name}" loading="lazy" decoding="async" onerror="this.src='${PLACEHOLDER_IMG}'">
            </div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-weight">${product.weight}</div>
                <div class="product-price-row">
                    <div class="product-price">
                        <span class="price-current">\u20B9${product.price}</span>
                        ${product.originalPrice > product.price ? `<span class="price-original">\u20B9${product.originalPrice}</span>` : ''}
                    </div>
                    <button class="add-btn" onclick="addToCart('${product.id}')"><i class="fas fa-plus"></i></button>
                </div>
                <div class="qty-controls">
                    <button onclick="updateQty('${product.id}', -1)">\u2212</button>
                    <span class="qty-value">1</span>
                    <button onclick="updateQty('${product.id}', 1)">+</button>
                </div>
            </div>
        </div>
    `;
}

function renderProducts(filterCategory = 'all', append = false) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    currentCategoryFilter = filterCategory;

    let filtered = filterCategory === 'all'
        ? products
        : products.filter(p => p.category === filterCategory);

    // Apply subcategory filter if set
    if (currentSubcategoryFilter) {
        filtered = filtered.filter(p => p.subcategory_id === currentSubcategoryFilter);
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:#9CA3AF;"><i class="fas fa-box-open" style="font-size:52px;margin-bottom:20px;display:block;"></i><p style="font-size:18px;font-weight:600;color:#5A5D72;margin-bottom:8px;">No products available yet</p><p style="font-size:14px;">Products will appear here once added by admin.</p></div>';
        return;
    }

    grid.innerHTML = filtered.map(renderProductCard).join('');

    // Remove old pagination
    document.getElementById('websiteProductPagination')?.remove();

    // Render numbered pagination if needed
    const totalPages = Math.ceil(totalProductCount / PRODUCTS_PER_PAGE);
    if (totalPages > 1) {
        const pagDiv = document.createElement('div');
        pagDiv.id = 'websiteProductPagination';
        pagDiv.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:6px;padding:24px 0;flex-wrap:wrap;';

        let pagHtml = '';

        // Previous button
        pagHtml += `<button onclick="loadProductPage(${currentProductPage - 1})" ${currentProductPage <= 1 ? 'disabled' : ''}
            style="padding:8px 14px;border:1.5px solid #E5E7EB;border-radius:10px;background:white;font-size:13px;cursor:pointer;font-family:inherit;${currentProductPage <= 1 ? 'opacity:0.4;cursor:default;' : ''}">
            <i class="fas fa-chevron-left"></i> Prev
        </button>`;

        // Page numbers (show max 7 pages with ellipsis)
        const maxVisible = 7;
        let startPage = Math.max(1, currentProductPage - 3);
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

        if (startPage > 1) {
            pagHtml += `<button onclick="loadProductPage(1)" style="padding:8px 12px;border:1.5px solid #E5E7EB;border-radius:10px;background:white;font-size:13px;cursor:pointer;font-family:inherit;">1</button>`;
            if (startPage > 2) pagHtml += `<span style="color:#9CA3AF;font-size:13px;">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === currentProductPage;
            pagHtml += `<button onclick="loadProductPage(${i})"
                style="padding:8px 12px;border:1.5px solid ${isActive ? '#059669' : '#E5E7EB'};border-radius:10px;background:${isActive ? '#059669' : 'white'};color:${isActive ? 'white' : '#374151'};font-size:13px;font-weight:${isActive ? '700' : '500'};cursor:pointer;font-family:inherit;">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) pagHtml += `<span style="color:#9CA3AF;font-size:13px;">...</span>`;
            pagHtml += `<button onclick="loadProductPage(${totalPages})" style="padding:8px 12px;border:1.5px solid #E5E7EB;border-radius:10px;background:white;font-size:13px;cursor:pointer;font-family:inherit;">${totalPages}</button>`;
        }

        // Next button
        pagHtml += `<button onclick="loadProductPage(${currentProductPage + 1})" ${currentProductPage >= totalPages ? 'disabled' : ''}
            style="padding:8px 14px;border:1.5px solid #E5E7EB;border-radius:10px;background:white;font-size:13px;cursor:pointer;font-family:inherit;${currentProductPage >= totalPages ? 'opacity:0.4;cursor:default;' : ''}">
            Next <i class="fas fa-chevron-right"></i>
        </button>`;

        // Page info
        pagHtml += `<span style="font-size:12px;color:#9CA3AF;margin-left:12px;">Page ${currentProductPage} of ${totalPages} (${totalProductCount} products)</span>`;

        pagDiv.innerHTML = pagHtml;
        grid.parentNode.insertBefore(pagDiv, grid.nextSibling);
    }

    updateCartUI();
}

// ===== LOGIN MODAL =====
function openLoginModal() {
    document.getElementById('login-overlay').classList.add('active');
    document.getElementById('login-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
    document.getElementById('login-overlay').classList.remove('active');
    document.getElementById('login-modal').classList.remove('active');
    document.body.style.overflow = '';
}

// ===== WISHLIST =====
function toggleWishlist(btn) {
    btn.classList.toggle('active');
    const icon = btn.querySelector('i');
    if (btn.classList.contains('active')) {
        icon.classList.remove('far'); icon.classList.add('fas');
        showToast('Added to Wishlist!');
    } else {
        icon.classList.remove('fas'); icon.classList.add('far');
        showToast('Removed from Wishlist');
    }
}

// ===== CART SIDEBAR =====
function openCart() {
    document.getElementById('cart-sidebar').classList.add('active');
    document.getElementById('cart-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    document.getElementById('cart-sidebar').classList.remove('active');
    document.getElementById('cart-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

// ===== TOAST =====
function showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = '<i class="fas fa-check-circle"></i> ' + message;
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(20px);background:#1A1D2E;color:white;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:500;z-index:9999;display:flex;align-items:center;gap:10px;box-shadow:0 8px 30px rgba(0,0,0,0.25);animation:toastSlide 0.4s cubic-bezier(0.4,0,0.2,1) forwards;font-family:Poppins,sans-serif;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'toastFade 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 2500);
}

const toastStyle = document.createElement('style');
toastStyle.textContent = '@keyframes toastSlide{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}@keyframes toastFade{from{transform:translateX(-50%) translateY(0);opacity:1}to{transform:translateX(-50%) translateY(20px);opacity:0}}';
document.head.appendChild(toastStyle);

// ===== SEARCH =====
function handleSearch(e) {
    if (e && e.preventDefault) e.preventDefault();
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    if (!query) { renderProducts('all'); return; }

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.brand.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );

    const grid = document.getElementById('products-grid');
    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:#9CA3AF;"><i class="fas fa-search" style="font-size:52px;margin-bottom:20px;display:block;"></i><p style="font-size:18px;font-weight:600;color:#5A5D72;margin-bottom:8px;">No products found for "' + query + '"</p><p style="font-size:14px;">Try searching for atta, rice, dal, tomato, milk...</p></div>';
    } else {
        // Temporarily swap products for rendering
        const origProducts = [...products];
        products = filtered;
        renderProducts('all');
        products = origProducts;
    }
}

// ===== CATEGORY FILTER =====
function filterByCategory(category, element) {
    document.querySelectorAll('.category-nav a:not(.all-categories)').forEach(a => a.classList.remove('active'));
    if (element) element.classList.add('active');
    currentSubcategoryFilter = null;
    renderProducts(category);
    showSubcategoryBar(category);
}

// ===== SUBCATEGORY BAR =====
function showSubcategoryBar(categorySlug) {
    const bar = document.getElementById('subcategory-bar');
    const strip = document.getElementById('subcategory-strip');
    if (!bar || !strip) return;

    // Hide bar if "all" categories or no subcategories
    if (categorySlug === 'all') {
        bar.style.display = 'none';
        return;
    }

    // Find category id from slug
    const cat = categories.find(c => c.slug === categorySlug);
    if (!cat) { bar.style.display = 'none'; return; }

    const subs = (window._allSubcats || []).filter(s => s.category_id === cat.id);
    if (subs.length === 0) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = 'block';
    strip.innerHTML = `<span class="sub-strip-label"><i class="fas fa-filter"></i> ${cat.name}:</span>` +
        `<span class="sub-strip-item active" data-sub="all">All</span>` +
        subs.map(s => `<span class="sub-strip-item" data-sub="${s.id}" data-cat-slug="${categorySlug}">${s.name}</span>`).join('');

    strip.querySelectorAll('.sub-strip-item').forEach(item => {
        item.addEventListener('click', () => {
            strip.querySelectorAll('.sub-strip-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const subId = item.dataset.sub;
            if (subId === 'all') {
                currentSubcategoryFilter = null;
            } else {
                currentSubcategoryFilter = subId;
            }
            loadProductPage(1);
        });
    });
}

// ===== MEGA MENU =====
function initMegaMenu() {
    const btn = document.getElementById('all-categories-btn');
    const menu = document.getElementById('mega-menu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        menu.classList.toggle('active');
        populateMegaMenu();
    });

    // Close mega menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
            menu.classList.remove('active');
        }
    });
}

function populateMegaMenu() {
    const catsContainer = document.getElementById('mega-menu-cats');
    if (!catsContainer || catsContainer.children.length > 0) return;

    catsContainer.innerHTML = categories.map((c, i) => {
        const iconClass = CATEGORY_ICONS[c.slug] || 'fas fa-tag';
        return `<div class="mega-cat-item${i === 0 ? ' active' : ''}" data-cat-id="${c.id}" data-cat-slug="${c.slug}">
            <i class="${iconClass}"></i>
            <span>${c.name}</span>
            <i class="fas fa-chevron-right mega-cat-arrow"></i>
        </div>`;
    }).join('');

    // Show subcats for first category by default
    if (categories.length > 0) {
        showMegaSubcats(categories[0].id, categories[0].slug);
    }

    // Hover/click handlers
    catsContainer.querySelectorAll('.mega-cat-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            catsContainer.querySelectorAll('.mega-cat-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            showMegaSubcats(item.dataset.catId, item.dataset.catSlug);
        });
        item.addEventListener('click', () => {
            const menu = document.getElementById('mega-menu');
            menu.classList.remove('active');
            filterByCategory(item.dataset.catSlug);
        });
    });
}

function showMegaSubcats(categoryId, categorySlug) {
    const container = document.getElementById('mega-menu-subcats');
    if (!container) return;

    const subs = (window._allSubcats || []).filter(s => s.category_id === categoryId);

    if (subs.length === 0) {
        container.innerHTML = '<div class="mega-menu-placeholder">No subcategories available</div>';
        return;
    }

    container.innerHTML = '<div class="mega-subcats-grid">' +
        subs.map(s => `<a href="#" class="mega-subcat-item" data-sub-id="${s.id}" data-cat-slug="${categorySlug}">
            ${s.image_url ? `<img src="${s.image_url}" alt="${s.name}">` : `<i class="fas fa-tag"></i>`}
            <span>${s.name}</span>
        </a>`).join('') +
        '</div>';

    container.querySelectorAll('.mega-subcat-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const menu = document.getElementById('mega-menu');
            menu.classList.remove('active');
            currentSubcategoryFilter = item.dataset.subId;
            currentCategoryFilter = item.dataset.catSlug;
            loadProductPage(1);
        });
    });
}

// ===== SCROLL EFFECTS =====
function initScrollEffects() {
    const scrollBtn = document.getElementById('scroll-top');
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (scrollBtn) scrollBtn.classList.toggle('visible', window.scrollY > 400);
        if (header) header.classList.toggle('scrolled', window.scrollY > 10);
    });
    if (scrollBtn) scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    // Load data from Supabase
    await Promise.all([loadCategories(), loadProducts(), loadBanners(), loadDeliverySettings(), loadOffers()]);

    updateCartUI();
    initScrollEffects();
    initMegaMenu();
    document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
    document.getElementById('search-form')?.addEventListener('submit', handleSearch);
    const searchInput = document.getElementById('search-input');
    let searchDebounce;
    searchInput?.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
            currentCategoryFilter = 'all';
            currentSubcategoryFilter = null;
            showSubcategoryBar('all');
            renderProducts('all');
            return;
        }
        searchDebounce = setTimeout(() => {
            handleSearch(null);
        }, 300);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeCart(); closeLoginModal(); } });

    // Mobile menu toggle
    initMobileMenu();

    // Premium enhancements
    initFadeInAnimations();
    initCounterAnimations();
    initOfferAutoRotation();
    initImageLazyLoad();
    initHeaderShrink();
    initProductImageShimmer();
});

// ===== MOBILE MENU =====
function initMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const headerActions = document.querySelector('.header-actions');
    if (!menuBtn || !headerActions) return;

    menuBtn.addEventListener('click', () => {
        headerActions.classList.toggle('mobile-open');
        const isOpen = headerActions.classList.contains('mobile-open');
        menuBtn.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });

    // Close menu when clicking an action
    headerActions.querySelectorAll('.header-action').forEach(action => {
        action.addEventListener('click', () => {
            headerActions.classList.remove('mobile-open');
            menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        });
    });
}

// ===== PREMIUM ENHANCEMENT FUNCTIONS =====

// 1. Intersection Observer for Fade-In Animations
function initFadeInAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in-up');
    if (!fadeElements.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    fadeElements.forEach(el => observer.observe(el));
}

// 2. Counter Animation - Numbers Count Up When Visible
function initCounterAnimations() {
    const counters = document.querySelectorAll('.counter-value[data-target]');
    if (!counters.length) return;

    let animated = false;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !animated) {
                animated = true;
                counters.forEach(counter => animateCounter(counter));
                observer.disconnect();
            }
        });
    }, { threshold: 0.3 });

    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(el) {
    const target = parseInt(el.dataset.target);
    const suffix = el.dataset.suffix || '+';
    const duration = 2000;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = current.toLocaleString('en-IN') + suffix;
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

// 3. Auto-Rotating Offers + Reset scroll on re-enter
function initOfferAutoRotation() {
    const offerCards = document.querySelectorAll('.offer-card');
    if (offerCards.length > 0) {
        let currentIndex = 0;
        setInterval(() => {
            offerCards.forEach(card => card.classList.remove('offer-highlight'));
            offerCards[currentIndex].classList.add('offer-highlight');
            currentIndex = (currentIndex + 1) % offerCards.length;
        }, 3000);
    }

    // Reset horizontal scroll sections to first item when they re-enter viewport
    const scrollContainers = document.querySelectorAll('.offers-grid, .trust-badges-grid, .hero-features');
    scrollContainers.forEach(container => {
        let wasVisible = true;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !wasVisible) {
                    container.scrollTo({ left: 0, behavior: 'smooth' });
                }
                wasVisible = entry.isIntersecting;
            });
        }, { threshold: 0.3 });
        observer.observe(container);
    });
}

// 4. Image Lazy Loading with Fade-In Effect
function initImageLazyLoad() {
    const images = document.querySelectorAll('.product-image img[loading="lazy"]');

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.style.opacity = '0';
                img.style.transition = 'opacity 0.5s ease';

                if (img.complete) {
                    img.style.opacity = '1';
                    const wrapper = img.closest('.product-image');
                    if (wrapper) wrapper.classList.add('loaded');
                } else {
                    img.addEventListener('load', function() {
                        img.style.opacity = '1';
                        const wrapper = img.closest('.product-image');
                        if (wrapper) wrapper.classList.add('loaded');
                    }, { once: true });
                }

                imageObserver.unobserve(img);
            }
        });
    }, { rootMargin: '100px' });

    images.forEach(img => imageObserver.observe(img));
}

// 5. Header Shrink on Scroll
function initHeaderShrink() {
    const header = document.querySelector('.header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 80) {
            header.classList.add('header-shrink');
        } else {
            header.classList.remove('header-shrink');
        }
    });
}

// 6. Product Image Shimmer
function initProductImageShimmer() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    const mutationObs = new MutationObserver(() => {
        const productImages = grid.querySelectorAll('.product-image');
        productImages.forEach(wrapper => {
            const img = wrapper.querySelector('img');
            if (!img) return;
            if (img.complete && img.naturalHeight > 0) {
                wrapper.classList.add('loaded');
            } else {
                img.addEventListener('load', () => {
                    wrapper.classList.add('loaded');
                }, { once: true });
                img.addEventListener('error', () => {
                    wrapper.classList.add('loaded');
                }, { once: true });
            }
        });
    });

    mutationObs.observe(grid, { childList: true, subtree: true });

    const existingImages = grid.querySelectorAll('.product-image');
    existingImages.forEach(wrapper => {
        const img = wrapper.querySelector('img');
        if (!img) return;
        if (img.complete && img.naturalHeight > 0) {
            wrapper.classList.add('loaded');
        } else {
            img.addEventListener('load', () => wrapper.classList.add('loaded'), { once: true });
            img.addEventListener('error', () => wrapper.classList.add('loaded'), { once: true });
        }
    });
}
