// ============================================
// CHOICE KART - Admin Dashboard JavaScript
// ============================================

// ===== STATE =====
let currentSection = 'dashboard';
let categoriesCache = [];
let subcategoriesCache = [];

// ===== UTILITY FUNCTIONS =====
function slugify(text) {
    return text.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function formatCurrency(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'exclamation-triangle';
    toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function imgPath(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return '../' + url;
}

// ===== AUTH / LOGIN (Simple table-based, no Supabase Auth) =====
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.style.display = 'none';

    if (!db) {
        errorEl.textContent = 'Database connection failed. Please refresh the page.';
        errorEl.style.display = 'block';
        return;
    }

    try {
        // Check admin_users table for matching email + password
        const { data: admin, error } = await db
            .from('admin_users')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .eq('is_active', true)
            .single();

        if (error || !admin) {
            throw new Error('Invalid email or password');
        }

        // Save session in localStorage
        localStorage.setItem('ck_admin', JSON.stringify({
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role
        }));

        document.getElementById('adminName').textContent = admin.name;
        document.getElementById('adminRole').textContent = admin.role.charAt(0).toUpperCase() + admin.role.slice(1);

        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'flex';
        loadDashboard();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
    }
});

// Check existing session on page load
function checkSession() {
    const saved = localStorage.getItem('ck_admin');
    if (saved) {
        try {
            const admin = JSON.parse(saved);
            document.getElementById('adminName').textContent = admin.name;
            document.getElementById('adminRole').textContent = admin.role.charAt(0).toUpperCase() + admin.role.slice(1);
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'flex';
            loadDashboard();
        } catch (e) {
            localStorage.removeItem('ck_admin');
        }
    }
}

// Check session on load
checkSession();

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('ck_admin');
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginForm').reset();
});

// ===== NAVIGATION =====
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const section = item.dataset.section;
        if (!section) return;

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`sec-${section}`).classList.add('active');

        document.getElementById('pageTitle').textContent = item.textContent.trim();
        currentSection = section;

        // Load data for section
        switch (section) {
            case 'dashboard': loadDashboard(); break;
            case 'products': loadProducts(); break;
            case 'categories': loadCategories(); loadSubcategories(); break;
            case 'orders': loadOrders(); break;
            case 'customers': loadCustomers(); break;
            case 'delivery-boys': loadDeliveryBoys(); break;
            case 'delivery-charges': loadDeliveryCharges(); break;
            case 'coupons': loadCoupons(); break;
            case 'banners': loadBanners(); break;
            case 'service-areas': loadServiceAreas(); break;
            case 'settings': loadSettings(); break;
            case 'staff': loadStaff(); break;
            case 'billing': initBilling(); break;
        }

        // Close sidebar on mobile
        document.getElementById('sidebar').classList.remove('open');
    });
});

// Mobile menu toggle
document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// ===== DASHBOARD =====
async function loadDashboard() {
    if (!db) return;

    const [products, orders, customers] = await Promise.all([
        db.from('products').select('id, stock_qty, low_stock_threshold', { count: 'exact' }),
        db.from('orders').select('id', { count: 'exact' }),
        db.from('customers').select('id', { count: 'exact' })
    ]);

    document.getElementById('statProducts').textContent = products.count || 0;
    document.getElementById('statOrders').textContent = orders.count || 0;
    document.getElementById('statCustomers').textContent = customers.count || 0;

    // Low stock count
    const lowStock = (products.data || []).filter(p => p.stock_qty <= p.low_stock_threshold).length;
    document.getElementById('statLowStock').textContent = lowStock;

    // Recent orders
    const { data: recentOrders } = await db
        .from('orders')
        .select('*, customers(name, phone)')
        .order('created_at', { ascending: false })
        .limit(5);

    const tbody = document.getElementById('recentOrdersTable');
    if (recentOrders && recentOrders.length > 0) {
        tbody.innerHTML = recentOrders.map(o => `
            <tr>
                <td><strong>${o.order_number}</strong></td>
                <td>${o.customers?.name || o.customers?.phone || '-'}</td>
                <td>${formatCurrency(o.total)}</td>
                <td><span class="badge-status badge-${o.status === 'delivered' ? 'active' : o.status === 'cancelled' ? 'inactive' : 'low-stock'}">${o.status}</span></td>
                <td>${formatDate(o.created_at)}</td>
            </tr>
        `).join('');
    }

    // Pending orders badge
    const { count: pendingCount } = await db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed']);
    const badge = document.getElementById('pendingOrdersBadge');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline';
    }
}

// ===== CATEGORIES =====
async function loadCategories() {
    if (!db) return;

    const { data: categories, error } = await db
        .from('categories')
        .select('*')
        .order('sort_order');

    if (error) { showToast(error.message, 'error'); return; }
    categoriesCache = categories || [];

    updateCategoryDropdowns();

    const tbody = document.getElementById('categoriesTable');
    if (!categories || categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-tags"></i><h4>No categories yet. Add your first category!</h4></div></td></tr>';
        return;
    }

    const { data: products } = await db.from('products').select('category_id');
    const { data: subcats } = await db.from('subcategories').select('category_id');

    tbody.innerHTML = categories.map(c => {
        const prodCount = (products || []).filter(p => p.category_id === c.id).length;
        const subCount = (subcats || []).filter(s => s.category_id === c.id).length;
        return `
            <tr>
                <td>
                    <div class="product-cell">
                        ${c.image_url ? `<img src="${imgPath(c.image_url)}" class="product-thumb">` : '<div class="product-thumb" style="display:flex;align-items:center;justify-content:center;"><i class="fas fa-tag"></i></div>'}
                        <div>
                            <div class="product-name">${c.name}</div>
                            ${c.name_te ? `<div class="product-category">${c.name_te}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>${subCount}</td>
                <td>${prodCount}</td>
                <td><span class="badge-status ${c.is_active ? 'badge-active' : 'badge-inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="editCategory('${c.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCategory('${c.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateCategoryDropdowns() {
    const options = '<option value="">Select Category</option>' +
        categoriesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    document.getElementById('productCategory').innerHTML = options;
    document.getElementById('subcategoryParent').innerHTML = options;

    const filterOptions = '<option value="">All Categories</option>' +
        categoriesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('productCategoryFilter').innerHTML = filterOptions;
}

// Add/Edit Category
document.getElementById('addCategoryBtn').addEventListener('click', () => {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryModalTitle').textContent = 'Add Category';
    openModal('categoryModal');
});

document.getElementById('saveCategoryBtn').addEventListener('click', async () => {
    const id = document.getElementById('categoryId').value;
    const name = document.getElementById('categoryName').value.trim();
    if (!name) { showToast('Category name is required', 'error'); return; }

    const data = {
        name,
        name_te: document.getElementById('categoryNameTe').value.trim() || null,
        slug: slugify(name),
        image_url: document.getElementById('categoryImageUrl').value.trim() || null,
        sort_order: parseInt(document.getElementById('categorySortOrder').value) || 0
    };

    let error;
    if (id) {
        ({ error } = await db.from('categories').update(data).eq('id', id));
    } else {
        ({ error } = await db.from('categories').insert(data));
    }

    if (error) { showToast(error.message, 'error'); return; }
    showToast(id ? 'Category updated!' : 'Category added!');
    closeModal('categoryModal');
    loadCategories();
});

window.editCategory = async function(id) {
    const cat = categoriesCache.find(c => c.id === id);
    if (!cat) return;
    document.getElementById('categoryId').value = cat.id;
    document.getElementById('categoryName').value = cat.name;
    document.getElementById('categoryNameTe').value = cat.name_te || '';
    document.getElementById('categoryImageUrl').value = cat.image_url || '';
    document.getElementById('categorySortOrder').value = cat.sort_order || 0;
    document.getElementById('categoryModalTitle').textContent = 'Edit Category';
    openModal('categoryModal');
};

window.deleteCategory = async function(id) {
    if (!confirm('Delete this category? All subcategories under it will also be deleted.')) return;
    const { error } = await db.from('categories').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Category deleted!');
    loadCategories();
};

// ===== SUBCATEGORIES =====
async function loadSubcategories() {
    if (!db) return;

    const { data: subcategories, error } = await db
        .from('subcategories')
        .select('*, categories(name)')
        .order('sort_order');

    if (error) { showToast(error.message, 'error'); return; }
    subcategoriesCache = subcategories || [];

    const tbody = document.getElementById('subcategoriesTable');
    if (!subcategories || subcategories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><i class="fas fa-tags"></i><h4>No subcategories yet</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = subcategories.map(s => `
        <tr>
            <td><strong>${s.name}</strong>${s.name_te ? ` <span style="color:var(--text-muted);">(${s.name_te})</span>` : ''}</td>
            <td>${s.categories?.name || '-'}</td>
            <td><span class="badge-status ${s.is_active ? 'badge-active' : 'badge-inactive'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="editSubcategory('${s.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteSubcategory('${s.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('addSubcategoryBtn').addEventListener('click', () => {
    document.getElementById('subcategoryForm').reset();
    document.getElementById('subcategoryId').value = '';
    document.getElementById('subcategoryModalTitle').textContent = 'Add Subcategory';
    openModal('subcategoryModal');
});

document.getElementById('saveSubcategoryBtn').addEventListener('click', async () => {
    const id = document.getElementById('subcategoryId').value;
    const name = document.getElementById('subcategoryName').value.trim();
    const parentId = document.getElementById('subcategoryParent').value;

    if (!name || !parentId) { showToast('Name and parent category are required', 'error'); return; }

    const data = {
        name,
        name_te: document.getElementById('subcategoryNameTe').value.trim() || null,
        category_id: parentId,
        slug: slugify(name),
        sort_order: parseInt(document.getElementById('subcategorySortOrder').value) || 0
    };

    let error;
    if (id) {
        ({ error } = await db.from('subcategories').update(data).eq('id', id));
    } else {
        ({ error } = await db.from('subcategories').insert(data));
    }

    if (error) { showToast(error.message, 'error'); return; }
    showToast(id ? 'Subcategory updated!' : 'Subcategory added!');
    closeModal('subcategoryModal');
    loadSubcategories();
    loadCategories();
});

window.editSubcategory = async function(id) {
    const sub = subcategoriesCache.find(s => s.id === id);
    if (!sub) return;
    document.getElementById('subcategoryId').value = sub.id;
    document.getElementById('subcategoryName').value = sub.name;
    document.getElementById('subcategoryNameTe').value = sub.name_te || '';
    document.getElementById('subcategoryParent').value = sub.category_id;
    document.getElementById('subcategorySortOrder').value = sub.sort_order || 0;
    document.getElementById('subcategoryModalTitle').textContent = 'Edit Subcategory';
    openModal('subcategoryModal');
};

window.deleteSubcategory = async function(id) {
    if (!confirm('Delete this subcategory?')) return;
    const { error } = await db.from('subcategories').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Subcategory deleted!');
    loadSubcategories();
};

// ===== PRODUCTS =====
async function loadProducts(search = '', categoryFilter = '') {
    if (!db) return;

    let query = db
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });

    if (categoryFilter) query = query.eq('category_id', categoryFilter);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data: products, error } = await query;

    if (error) { showToast(error.message, 'error'); return; }

    if (categoriesCache.length === 0) {
        const { data } = await db.from('categories').select('*').order('sort_order');
        categoriesCache = data || [];
        updateCategoryDropdowns();
    }

    const tbody = document.getElementById('productsTable');
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-box-open"></i><h4>No products yet. Add your first product!</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = products.map(p => {
        const discount = p.mrp > p.selling_price
            ? Math.round((1 - p.selling_price / p.mrp) * 100)
            : 0;
        const stockClass = p.stock_qty <= 0 ? 'low' : p.stock_qty <= p.low_stock_threshold ? 'medium' : 'high';
        const stockPercent = Math.min(100, (p.stock_qty / Math.max(p.low_stock_threshold * 5, 1)) * 100);

        return `
            <tr>
                <td>
                    <div class="product-cell">
                        ${p.image_url ? `<img src="${imgPath(p.image_url)}" class="product-thumb" alt="${p.name}">` : '<div class="product-thumb" style="display:flex;align-items:center;justify-content:center;"><i class="fas fa-image"></i></div>'}
                        <div>
                            <div class="product-name">${p.name}</div>
                            <div class="product-category">${p.unit_value || 1} ${p.unit}${p.brand ? ' · ' + p.brand : ''}</div>
                        </div>
                    </div>
                </td>
                <td>${p.categories?.name || '-'}</td>
                <td>
                    ${p.mrp > p.selling_price ? `<span class="price-mrp">${formatCurrency(p.mrp)}</span> ` : ''}
                    <span class="price-selling">${formatCurrency(p.selling_price)}</span>
                    ${discount > 0 ? ` <span class="discount-percent">${discount}% off</span>` : ''}
                </td>
                <td>
                    <div>${p.stock_qty}</div>
                    <div class="stock-bar"><div class="stock-bar-fill ${stockClass}" style="width:${stockPercent}%"></div></div>
                </td>
                <td>
                    ${p.stock_qty <= 0
                        ? '<span class="badge-status badge-out-stock">Out of Stock</span>'
                        : p.stock_qty <= p.low_stock_threshold
                            ? '<span class="badge-status badge-low-stock">Low Stock</span>'
                            : '<span class="badge-status badge-active">In Stock</span>'}
                </td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// Product search & filter
document.getElementById('productSearch').addEventListener('input', (e) => {
    loadProducts(e.target.value, document.getElementById('productCategoryFilter').value);
});

document.getElementById('productCategoryFilter').addEventListener('change', (e) => {
    loadProducts(document.getElementById('productSearch').value, e.target.value);
});

// Load subcategories for selected category in product form
document.getElementById('productCategory').addEventListener('change', async (e) => {
    const catId = e.target.value;
    const subSelect = document.getElementById('productSubcategory');
    subSelect.innerHTML = '<option value="">Select Subcategory</option>';
    if (!catId) return;

    const { data } = await db.from('subcategories').select('*').eq('category_id', catId).order('sort_order');
    if (data) {
        subSelect.innerHTML += data.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
});

// Add Product
document.getElementById('addProductBtn').addEventListener('click', () => {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productUnitValue').value = '1';
    document.getElementById('productLowStock').value = '10';
    document.getElementById('productGST').value = '0';
    document.getElementById('productImagePreview').style.display = 'none';
    document.getElementById('productImageUrl').value = '';
    document.getElementById('productModalTitle').textContent = 'Add Product';
    openModal('productModal');
});

// Save Product
document.getElementById('saveProductBtn').addEventListener('click', async () => {
    const id = document.getElementById('productId').value;
    const name = document.getElementById('productName').value.trim();
    const categoryId = document.getElementById('productCategory').value;
    const mrp = parseFloat(document.getElementById('productMRP').value);
    const sellingPrice = parseFloat(document.getElementById('productSellingPrice').value);
    const stock = parseInt(document.getElementById('productStock').value);

    if (!name || !categoryId || isNaN(mrp) || isNaN(sellingPrice) || isNaN(stock)) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    const data = {
        name,
        name_te: document.getElementById('productNameTe').value.trim() || null,
        slug: slugify(name),
        description: document.getElementById('productDescription').value.trim() || null,
        category_id: categoryId,
        subcategory_id: document.getElementById('productSubcategory').value || null,
        mrp,
        selling_price: sellingPrice,
        stock_qty: stock,
        unit: document.getElementById('productUnit').value,
        unit_value: parseFloat(document.getElementById('productUnitValue').value) || 1,
        low_stock_threshold: parseInt(document.getElementById('productLowStock').value) || 10,
        brand: document.getElementById('productBrand').value.trim() || null,
        barcode: document.getElementById('productBarcode').value.trim() || null,
        gst_percent: parseFloat(document.getElementById('productGST').value) || 0,
        image_url: document.getElementById('productImageUrl').value.trim() || null,
        is_featured: document.getElementById('productFeatured').value === 'true'
    };

    let error;
    if (id) {
        ({ error } = await db.from('products').update(data).eq('id', id));
    } else {
        ({ error } = await db.from('products').insert(data));
    }

    if (error) { showToast(error.message, 'error'); return; }
    showToast(id ? 'Product updated!' : 'Product added!');
    closeModal('productModal');
    loadProducts();
});

window.editProduct = async function(id) {
    const { data: p, error } = await db.from('products').select('*').eq('id', id).single();
    if (error || !p) { showToast('Product not found', 'error'); return; }

    document.getElementById('productId').value = p.id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productNameTe').value = p.name_te || '';
    document.getElementById('productCategory').value = p.category_id;

    // Trigger subcategory load
    const event = new Event('change');
    document.getElementById('productCategory').dispatchEvent(event);
    setTimeout(() => {
        document.getElementById('productSubcategory').value = p.subcategory_id || '';
    }, 300);

    document.getElementById('productDescription').value = p.description || '';
    document.getElementById('productMRP').value = p.mrp;
    document.getElementById('productSellingPrice').value = p.selling_price;
    document.getElementById('productStock').value = p.stock_qty;
    document.getElementById('productUnit').value = p.unit;
    document.getElementById('productUnitValue').value = p.unit_value || 1;
    document.getElementById('productLowStock').value = p.low_stock_threshold || 10;
    document.getElementById('productBrand').value = p.brand || '';
    document.getElementById('productBarcode').value = p.barcode || '';
    document.getElementById('productGST').value = p.gst_percent || 0;
    document.getElementById('productImageUrl').value = p.image_url || '';
    const preview = document.getElementById('productImagePreview');
    if (p.image_url) {
        preview.src = imgPath(p.image_url);
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
    document.getElementById('productFeatured').value = p.is_featured ? 'true' : 'false';
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    openModal('productModal');
};

window.deleteProduct = async function(id) {
    if (!confirm('Delete this product?')) return;
    const { error } = await db.from('products').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Product deleted!');
    loadProducts();
};

// ===== ORDERS =====
async function loadOrders(search = '', statusFilter = '') {
    if (!db) return;

    let query = db
        .from('orders')
        .select('*, customers(name, phone), order_items(id)')
        .order('created_at', { ascending: false });

    if (statusFilter) query = query.eq('status', statusFilter);
    if (search) query = query.or(`order_number.ilike.%${search}%`);

    const { data: orders, error } = await query;
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('ordersTable');
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-inbox"></i><h4>No orders found</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => `
        <tr>
            <td><strong>${o.order_number}</strong></td>
            <td>${o.customers?.name || o.customers?.phone || '-'}</td>
            <td>${o.order_items?.length || 0} items</td>
            <td>${formatCurrency(o.total)}</td>
            <td>
                <span class="badge-status ${o.payment_status === 'paid' ? 'badge-active' : 'badge-low-stock'}">${o.payment_method.toUpperCase()}</span>
            </td>
            <td>
                <select class="form-control" style="padding:4px 8px;font-size:12px;width:auto;" onchange="updateOrderStatus('${o.id}', this.value)">
                    ${['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'].map(s =>
                        `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>`
                    ).join('')}
                </select>
            </td>
            <td>${formatDate(o.created_at)}</td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="viewOrder('${o.id}')"><i class="fas fa-eye"></i></button>
            </td>
        </tr>
    `).join('');
}

window.updateOrderStatus = async function(id, status) {
    const updateData = { status };
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
    if (status === 'cancelled') updateData.cancelled_at = new Date().toISOString();

    const { error } = await db.from('orders').update(updateData).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`Order ${status}!`);
};

window.viewOrder = async function(id) {
    showToast('Order detail view coming soon!', 'warning');
};

document.getElementById('orderSearch').addEventListener('input', (e) => {
    loadOrders(e.target.value, document.getElementById('orderStatusFilter').value);
});
document.getElementById('orderStatusFilter').addEventListener('change', (e) => {
    loadOrders(document.getElementById('orderSearch').value, e.target.value);
});

// ===== CUSTOMERS =====
async function loadCustomers(search = '') {
    if (!db) return;

    let query = db.from('customers').select('*').order('created_at', { ascending: false });
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

    const { data: customers, error } = await query;
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('customersTable');
    if (!customers || customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-users"></i><h4>No customers yet</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = customers.map(c => `
        <tr>
            <td><strong>${c.name || '-'}</strong></td>
            <td>${c.phone}</td>
            <td>${c.email || '-'}</td>
            <td>-</td>
            <td>${formatDate(c.created_at)}</td>
            <td><span class="badge-status ${c.is_active ? 'badge-active' : 'badge-inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
        </tr>
    `).join('');
}

document.getElementById('customerSearch').addEventListener('input', (e) => {
    loadCustomers(e.target.value);
});

// ===== DELIVERY BOYS =====
async function loadDeliveryBoys() {
    if (!db) return;

    const { data, error } = await db.from('delivery_boys').select('*').order('created_at', { ascending: false });
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('deliveryBoysTable');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-motorcycle"></i><h4>No delivery boys added</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(d => `
        <tr>
            <td><strong>${d.name}</strong></td>
            <td>${d.phone}</td>
            <td>${d.vehicle_type} ${d.vehicle_number ? '(' + d.vehicle_number + ')' : ''}</td>
            <td>${d.total_deliveries}</td>
            <td>${d.rating} ★</td>
            <td><span class="badge-status ${d.is_available ? 'badge-active' : 'badge-inactive'}">${d.is_available ? 'Available' : 'Busy'}</span></td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="editDeliveryBoy('${d.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteDeliveryBoy('${d.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('addDeliveryBoyBtn').addEventListener('click', () => {
    document.getElementById('deliveryBoyForm').reset();
    document.getElementById('deliveryBoyId').value = '';
    document.getElementById('deliveryBoyModalTitle').textContent = 'Add Delivery Boy';
    openModal('deliveryBoyModal');
});

document.getElementById('saveDeliveryBoyBtn').addEventListener('click', async () => {
    const id = document.getElementById('deliveryBoyId').value;
    const name = document.getElementById('deliveryBoyName').value.trim();
    const phone = document.getElementById('deliveryBoyPhone').value.trim();
    if (!name || !phone) { showToast('Name and phone are required', 'error'); return; }

    const data = {
        name, phone,
        vehicle_type: document.getElementById('deliveryBoyVehicle').value,
        vehicle_number: document.getElementById('deliveryBoyVehicleNo').value.trim() || null
    };

    let error;
    if (id) {
        ({ error } = await db.from('delivery_boys').update(data).eq('id', id));
    } else {
        ({ error } = await db.from('delivery_boys').insert(data));
    }

    if (error) { showToast(error.message, 'error'); return; }
    showToast(id ? 'Delivery boy updated!' : 'Delivery boy added!');
    closeModal('deliveryBoyModal');
    loadDeliveryBoys();
});

window.editDeliveryBoy = async function(id) {
    const { data: d } = await db.from('delivery_boys').select('*').eq('id', id).single();
    if (!d) return;
    document.getElementById('deliveryBoyId').value = d.id;
    document.getElementById('deliveryBoyName').value = d.name;
    document.getElementById('deliveryBoyPhone').value = d.phone;
    document.getElementById('deliveryBoyVehicle').value = d.vehicle_type;
    document.getElementById('deliveryBoyVehicleNo').value = d.vehicle_number || '';
    document.getElementById('deliveryBoyModalTitle').textContent = 'Edit Delivery Boy';
    openModal('deliveryBoyModal');
};

window.deleteDeliveryBoy = async function(id) {
    if (!confirm('Delete this delivery boy?')) return;
    const { error } = await db.from('delivery_boys').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Delivery boy deleted!');
    loadDeliveryBoys();
};

// ===== DELIVERY CHARGES =====
async function loadDeliveryCharges() {
    if (!db) return;

    const { data, error } = await db.from('delivery_charges').select('*').order('min_distance_km');
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('deliveryChargesTable');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><i class="fas fa-route"></i><h4>No delivery charge slabs</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(d => `
        <tr>
            <td><strong>${d.min_distance_km} - ${d.max_distance_km} KM</strong></td>
            <td>${d.charge === 0 ? '<span class="badge-status badge-active">FREE</span>' : formatCurrency(d.charge)}</td>
            <td>${d.free_above_amount ? formatCurrency(d.free_above_amount) : '-'}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteDeliveryCharge('${d.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.deleteDeliveryCharge = async function(id) {
    if (!confirm('Delete this delivery charge slab?')) return;
    const { error } = await db.from('delivery_charges').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Deleted!');
    loadDeliveryCharges();
};

// ===== COUPONS =====
async function loadCoupons() {
    if (!db) return;

    const { data, error } = await db.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('couponsTable');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-ticket-alt"></i><h4>No coupons yet</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(c => `
        <tr>
            <td><strong>${c.code}</strong></td>
            <td>${c.discount_type === 'percentage' ? c.discount_value + '%' : formatCurrency(c.discount_value)}</td>
            <td>${formatCurrency(c.min_order_amount)}</td>
            <td>${c.used_count}${c.usage_limit ? '/' + c.usage_limit : ''}</td>
            <td>${c.valid_until ? formatDate(c.valid_until) : 'No expiry'}</td>
            <td><span class="badge-status ${c.is_active ? 'badge-active' : 'badge-inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="editCoupon('${c.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteCoupon('${c.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('addCouponBtn').addEventListener('click', () => {
    document.getElementById('couponForm').reset();
    document.getElementById('couponId').value = '';
    document.getElementById('couponModalTitle').textContent = 'Add Coupon';
    openModal('couponModal');
});

document.getElementById('saveCouponBtn').addEventListener('click', async () => {
    const id = document.getElementById('couponId').value;
    const code = document.getElementById('couponCode').value.trim().toUpperCase();
    const discountValue = parseFloat(document.getElementById('couponValue').value);

    if (!code || isNaN(discountValue)) { showToast('Code and discount value are required', 'error'); return; }

    const data = {
        code,
        discount_type: document.getElementById('couponType').value,
        discount_value: discountValue,
        min_order_amount: parseFloat(document.getElementById('couponMinOrder').value) || 0,
        max_discount: parseFloat(document.getElementById('couponMaxDiscount').value) || null,
        usage_limit: parseInt(document.getElementById('couponUsageLimit').value) || null,
        valid_until: document.getElementById('couponValidUntil').value || null,
        description: document.getElementById('couponDescription').value.trim() || null
    };

    let error;
    if (id) {
        ({ error } = await db.from('coupons').update(data).eq('id', id));
    } else {
        ({ error } = await db.from('coupons').insert(data));
    }

    if (error) { showToast(error.message, 'error'); return; }
    showToast(id ? 'Coupon updated!' : 'Coupon added!');
    closeModal('couponModal');
    loadCoupons();
});

window.editCoupon = async function(id) {
    const { data: c } = await db.from('coupons').select('*').eq('id', id).single();
    if (!c) return;
    document.getElementById('couponId').value = c.id;
    document.getElementById('couponCode').value = c.code;
    document.getElementById('couponType').value = c.discount_type;
    document.getElementById('couponValue').value = c.discount_value;
    document.getElementById('couponMinOrder').value = c.min_order_amount || 0;
    document.getElementById('couponMaxDiscount').value = c.max_discount || '';
    document.getElementById('couponUsageLimit').value = c.usage_limit || '';
    document.getElementById('couponValidUntil').value = c.valid_until ? c.valid_until.split('T')[0] : '';
    document.getElementById('couponDescription').value = c.description || '';
    document.getElementById('couponModalTitle').textContent = 'Edit Coupon';
    openModal('couponModal');
};

window.deleteCoupon = async function(id) {
    if (!confirm('Delete this coupon?')) return;
    const { error } = await db.from('coupons').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Coupon deleted!');
    loadCoupons();
};

// ===== BANNERS =====
async function loadBanners() {
    if (!db) return;

    const { data, error } = await db.from('banners').select('*').order('sort_order');
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('bannersTable');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-images"></i><h4>No banners yet</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(b => `
        <tr>
            <td><img src="${imgPath(b.image_url)}" style="width:120px;height:60px;object-fit:cover;border-radius:6px;"></td>
            <td><strong>${b.title}</strong></td>
            <td>${b.position}</td>
            <td><span class="badge-status ${b.is_active ? 'badge-active' : 'badge-inactive'}">${b.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteBanner('${b.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.deleteBanner = async function(id) {
    if (!confirm('Delete this banner?')) return;
    const { error } = await db.from('banners').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Banner deleted!');
    loadBanners();
};

// ===== SERVICE AREAS =====
async function loadServiceAreas() {
    if (!db) return;

    const { data, error } = await db.from('service_areas').select('*').order('pincode');
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('serviceAreasTable');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-map-marked-alt"></i><h4>No service areas added</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(s => `
        <tr>
            <td><strong>${s.pincode}</strong></td>
            <td>${s.area_name}</td>
            <td>${s.city}</td>
            <td><span class="badge-status ${s.is_active ? 'badge-active' : 'badge-inactive'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteServiceArea('${s.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.deleteServiceArea = async function(id) {
    if (!confirm('Delete this service area?')) return;
    const { error } = await db.from('service_areas').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Service area deleted!');
    loadServiceAreas();
};

// ===== STORE SETTINGS =====
async function loadSettings() {
    if (!db) return;

    const { data, error } = await db.from('store_settings').select('*');
    if (error) { showToast(error.message, 'error'); return; }
    if (!data) return;

    const settings = {};
    data.forEach(s => settings[s.key] = s.value);

    document.getElementById('setStoreName').value = settings.store_name || '';
    document.getElementById('setStorePhone').value = settings.store_phone || '';
    document.getElementById('setStoreEmail').value = settings.store_email || '';
    document.getElementById('setStoreAddress').value = settings.store_address || '';
    document.getElementById('setMinOrder').value = settings.min_order_amount || '';
    document.getElementById('setOpenTime').value = settings.opening_time || '';
    document.getElementById('setCloseTime').value = settings.closing_time || '';
    document.getElementById('setDeliveryRadius').value = settings.delivery_radius_km || '';
    document.getElementById('setGST').value = settings.gst_number || '';
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const settingsMap = {
        store_name: document.getElementById('setStoreName').value,
        store_phone: document.getElementById('setStorePhone').value,
        store_email: document.getElementById('setStoreEmail').value,
        store_address: document.getElementById('setStoreAddress').value,
        min_order_amount: document.getElementById('setMinOrder').value,
        opening_time: document.getElementById('setOpenTime').value,
        closing_time: document.getElementById('setCloseTime').value,
        delivery_radius_km: document.getElementById('setDeliveryRadius').value,
        gst_number: document.getElementById('setGST').value
    };

    for (const [key, value] of Object.entries(settingsMap)) {
        await db.from('store_settings').upsert({ key, value }, { onConflict: 'key' });
    }

    showToast('Settings saved!');
});

// ===== IMAGE UPLOAD TO SUPABASE STORAGE =====
let imageUploading = false;

async function uploadImage(file, folder = 'products') {
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    imageUploading = true;

    const { data, error } = await db.storage
        .from('images')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
        });

    imageUploading = false;

    if (error) {
        console.error('Upload error:', error);
        if (error.message && error.message.includes('Bucket not found')) {
            showToast('Create a storage bucket named "images" in Supabase → Storage', 'error');
        } else if (error.message && (error.message.includes('security') || error.message.includes('policy') || error.message.includes('violates'))) {
            showToast('Storage needs upload policy. Run the SQL below in Supabase SQL Editor.', 'error');
            console.log('%c RUN THIS SQL IN SUPABASE SQL EDITOR:', 'color:red;font-weight:bold;');
            console.log(`CREATE POLICY "Allow public uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images');`);
            console.log(`CREATE POLICY "Allow public reads" ON storage.objects FOR SELECT USING (bucket_id = 'images');`);
        } else {
            showToast('Upload failed: ' + error.message, 'error');
        }
        return null;
    }

    // Get public URL
    const { data: urlData } = db.storage.from('images').getPublicUrl(data.path);
    console.log('Image uploaded:', urlData.publicUrl);
    return urlData.publicUrl;
}

// Product image upload handler
document.getElementById('productImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview immediately
    const preview = document.getElementById('productImagePreview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';

    showToast('Uploading image...', 'warning');
    const url = await uploadImage(file, 'products');
    if (url) {
        document.getElementById('productImageUrl').value = url;
        showToast('Image uploaded!');
    } else {
        showToast('Image upload failed — check console (F12) for details', 'error');
    }
});

// Category image upload handler
document.getElementById('categoryImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const preview = document.getElementById('categoryImagePreview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';

    showToast('Uploading image...', 'warning');
    const url = await uploadImage(file, 'categories');
    if (url) {
        document.getElementById('categoryImageUrl').value = url;
        showToast('Image uploaded!');
    } else {
        showToast('Image upload failed — check console (F12) for details', 'error');
    }
});

// ===== STAFF MANAGEMENT =====
async function loadStaff() {
    if (!db) return;

    const { data, error } = await db.from('admin_users').select('*').order('created_at', { ascending: false });
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('staffTable');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-user-shield"></i><h4>No staff added</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(s => `
        <tr>
            <td><strong>${s.name}</strong></td>
            <td>${s.email}</td>
            <td>${s.phone || '-'}</td>
            <td><span class="badge-status ${s.role === 'owner' ? 'badge-active' : s.role === 'manager' ? 'badge-low-stock' : 'badge-inactive'}">${s.role.charAt(0).toUpperCase() + s.role.slice(1)}</span></td>
            <td><span class="badge-status ${s.is_active ? 'badge-active' : 'badge-inactive'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="editStaff('${s.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteStaff('${s.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('addStaffBtn').addEventListener('click', () => {
    document.getElementById('staffForm').reset();
    document.getElementById('staffId').value = '';
    document.getElementById('staffModalTitle').textContent = 'Add Staff';
    openModal('staffModal');
});

document.getElementById('saveStaffBtn').addEventListener('click', async () => {
    const id = document.getElementById('staffId').value;
    const name = document.getElementById('staffName').value.trim();
    const email = document.getElementById('staffEmail').value.trim();
    const password = document.getElementById('staffPassword').value;

    if (!name || !email || (!id && !password)) {
        showToast('Name, email, and password are required', 'error');
        return;
    }

    const data = {
        name,
        email,
        phone: document.getElementById('staffPhone').value.trim() || null,
        role: document.getElementById('staffRole').value
    };

    if (password) data.password = password;

    let error;
    if (id) {
        ({ error } = await db.from('admin_users').update(data).eq('id', id));
    } else {
        data.password = password;
        ({ error } = await db.from('admin_users').insert(data));
    }

    if (error) { showToast(error.message, 'error'); return; }
    showToast(id ? 'Staff updated!' : 'Staff added!');
    closeModal('staffModal');
    loadStaff();
});

window.editStaff = async function(id) {
    const { data: s } = await db.from('admin_users').select('*').eq('id', id).single();
    if (!s) return;
    document.getElementById('staffId').value = s.id;
    document.getElementById('staffName').value = s.name;
    document.getElementById('staffEmail').value = s.email;
    document.getElementById('staffPassword').value = '';
    document.getElementById('staffPhone').value = s.phone || '';
    document.getElementById('staffRole').value = s.role;
    document.getElementById('staffModalTitle').textContent = 'Edit Staff';
    openModal('staffModal');
};

window.deleteStaff = async function(id) {
    if (!confirm('Delete this staff member? They will lose admin access.')) return;
    const { error } = await db.from('admin_users').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Staff removed!');
    loadStaff();
};

// ===== BILLING / POS =====
let billingCart = [];
let billingCoupon = null; // { code, discount_type, discount_value, max_discount }

function initBilling() {
    renderBillingCart();
}

// Search products for billing
document.getElementById('billingSearch').addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    const resultsDiv = document.getElementById('billingSearchResults');

    if (query.length < 2) {
        resultsDiv.style.display = 'none';
        return;
    }

    const { data: products } = await db
        .from('products')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,barcode.ilike.%${query}%,brand.ilike.%${query}%`)
        .limit(10);

    if (!products || products.length === 0) {
        resultsDiv.innerHTML = '<div style="padding:12px;color:var(--text-muted);text-align:center;">No products found</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    resultsDiv.innerHTML = products.map(p => `
        <div style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);"
             onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='white'"
             onclick="addToBilling('${p.id}')">
            ${p.image_url ? `<img src="${imgPath(p.image_url)}" style="width:36px;height:36px;border-radius:4px;object-fit:cover;">` : ''}
            <div style="flex:1;">
                <div style="font-weight:500;font-size:13px;">${p.name}</div>
                <div style="font-size:11px;color:var(--text-muted);">${p.brand || ''} · ${p.unit_value} ${p.unit} · Stock: ${p.stock_qty}</div>
            </div>
            <div style="font-weight:600;color:var(--primary);">${formatCurrency(p.selling_price)}</div>
        </div>
    `).join('');
    resultsDiv.style.display = 'block';
});

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#billingSearch') && !e.target.closest('#billingSearchResults')) {
        document.getElementById('billingSearchResults').style.display = 'none';
    }
});

window.addToBilling = async function(productId) {
    const existing = billingCart.find(i => i.id === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        const { data: p } = await db.from('products').select('*').eq('id', productId).single();
        if (!p) return;
        billingCart.push({
            id: p.id,
            name: p.name,
            brand: p.brand,
            mrp: Number(p.mrp),
            price: Number(p.selling_price),
            gst_percent: Number(p.gst_percent) || 0,
            qty: 1,
            unit: p.unit,
            unit_value: p.unit_value
        });
    }

    document.getElementById('billingSearch').value = '';
    document.getElementById('billingSearchResults').style.display = 'none';
    renderBillingCart();
};

window.updateBillingQty = function(productId, change) {
    const item = billingCart.find(i => i.id === productId);
    if (!item) return;
    item.qty += change;
    if (item.qty <= 0) {
        billingCart = billingCart.filter(i => i.id !== productId);
    }
    renderBillingCart();
};

window.removeBillingItem = function(productId) {
    billingCart = billingCart.filter(i => i.id !== productId);
    renderBillingCart();
};

function renderBillingCart() {
    const tbody = document.getElementById('billingItems');

    if (billingCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">Search and add products to start billing</td></tr>';
        document.getElementById('billingSubtotal').textContent = '₹0';
        document.getElementById('billingDiscount').textContent = '-₹0';
        document.getElementById('billingGST').textContent = '₹0';
        document.getElementById('billingTotal').textContent = '₹0';
        return;
    }

    tbody.innerHTML = billingCart.map(item => `
        <tr>
            <td>
                <strong>${item.name}</strong>
                <div style="font-size:11px;color:var(--text-muted);">${item.brand || ''} · ${item.unit_value} ${item.unit}</div>
            </td>
            <td>${formatCurrency(item.price)}</td>
            <td>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button class="btn btn-outline btn-sm" onclick="updateBillingQty('${item.id}', -1)" style="width:28px;height:28px;padding:0;">−</button>
                    <span style="min-width:24px;text-align:center;font-weight:600;">${item.qty}</span>
                    <button class="btn btn-outline btn-sm" onclick="updateBillingQty('${item.id}', 1)" style="width:28px;height:28px;padding:0;">+</button>
                </div>
            </td>
            <td><strong>${formatCurrency(item.price * item.qty)}</strong></td>
            <td><button class="btn btn-danger btn-sm btn-icon" onclick="removeBillingItem('${item.id}')"><i class="fas fa-times"></i></button></td>
        </tr>
    `).join('');

    // Calculate totals
    const subtotal = billingCart.reduce((t, i) => t + i.mrp * i.qty, 0);
    const sellingTotal = billingCart.reduce((t, i) => t + i.price * i.qty, 0);
    let discount = subtotal - sellingTotal;

    // Apply coupon discount
    let couponDiscount = 0;
    if (billingCoupon) {
        if (billingCoupon.discount_type === 'percentage') {
            couponDiscount = sellingTotal * billingCoupon.discount_value / 100;
            if (billingCoupon.max_discount) couponDiscount = Math.min(couponDiscount, billingCoupon.max_discount);
        } else {
            couponDiscount = billingCoupon.discount_value;
        }
        discount += couponDiscount;
    }

    const afterDiscount = sellingTotal - couponDiscount;
    const gst = billingCart.reduce((t, i) => t + (i.price * i.qty * i.gst_percent / 100), 0);
    const grandTotal = afterDiscount + gst;

    document.getElementById('billingSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('billingDiscount').textContent = '-' + formatCurrency(discount);
    document.getElementById('billingGST').textContent = formatCurrency(gst);
    document.getElementById('billingTotal').textContent = formatCurrency(grandTotal);
}

// Complete Sale
document.getElementById('billingPayBtn').addEventListener('click', async () => {
    if (billingCart.length === 0) {
        showToast('Add products to the bill first', 'error');
        return;
    }

    const sellingTotal = billingCart.reduce((t, i) => t + i.price * i.qty, 0);
    const gst = billingCart.reduce((t, i) => t + (i.price * i.qty * i.gst_percent / 100), 0);
    let discount = billingCart.reduce((t, i) => t + (i.mrp - i.price) * i.qty, 0);

    // Add coupon discount
    let couponDiscount = 0;
    if (billingCoupon) {
        if (billingCoupon.discount_type === 'percentage') {
            couponDiscount = sellingTotal * billingCoupon.discount_value / 100;
            if (billingCoupon.max_discount) couponDiscount = Math.min(couponDiscount, billingCoupon.max_discount);
        } else {
            couponDiscount = billingCoupon.discount_value;
        }
        discount += couponDiscount;
    }

    const grandTotal = (sellingTotal - couponDiscount) + gst;

    // Create a customer record if phone provided
    let customerId = null;
    const phone = document.getElementById('billingCustomerPhone').value.trim();
    if (phone) {
        const { data: existing } = await db.from('customers').select('id').eq('phone', phone).single();
        if (existing) {
            customerId = existing.id;
        } else {
            const { data: newCust } = await db.from('customers').insert({ phone, name: 'Walk-in' }).select('id').single();
            if (newCust) customerId = newCust.id;
        }
    } else {
        // Create/get walk-in customer
        const { data: walkin } = await db.from('customers').select('id').eq('phone', '0000000000').single();
        if (walkin) {
            customerId = walkin.id;
        } else {
            const { data: newWalkin } = await db.from('customers').insert({ phone: '0000000000', name: 'Walk-in Customer' }).select('id').single();
            if (newWalkin) customerId = newWalkin.id;
        }
    }

    if (!customerId) {
        showToast('Could not create customer record', 'error');
        return;
    }

    // Create order
    const { data: order, error: orderErr } = await db.from('orders').insert({
        customer_id: customerId,
        status: 'delivered',
        payment_method: 'cod',
        payment_status: 'paid',
        delivery_address: { type: 'in-store' },
        subtotal: sellingTotal,
        discount: discount,
        gst_amount: gst,
        total: grandTotal,
        delivered_at: new Date().toISOString(),
        coupon_code: billingCoupon ? billingCoupon.code : null,
        notes: 'In-store POS billing'
    }).select('*').single();

    if (orderErr) {
        showToast('Error creating order: ' + orderErr.message, 'error');
        return;
    }

    // Update coupon used_count
    if (billingCoupon) {
        await db.from('coupons').update({ used_count: billingCoupon.used_count + 1 }).eq('id', billingCoupon.id);
    }

    // Add order items
    const items = billingCart.map(i => ({
        order_id: order.id,
        product_id: i.id,
        product_name: i.name,
        quantity: i.qty,
        unit: i.unit,
        unit_value: i.unit_value,
        mrp: i.mrp,
        selling_price: i.price,
        gst_percent: i.gst_percent,
        total: i.price * i.qty
    }));

    await db.from('order_items').insert(items);

    // Update stock
    for (const item of billingCart) {
        await db.rpc('', {}).catch(() => {}); // skip if no RPC
        const { data: prod } = await db.from('products').select('stock_qty').eq('id', item.id).single();
        if (prod) {
            await db.from('products').update({ stock_qty: Math.max(0, prod.stock_qty - item.qty) }).eq('id', item.id);
        }
    }

    showToast(`Sale completed! Order #${order.order_number} — Total: ${formatCurrency(grandTotal)}`);

    // Clear cart
    billingCart = [];
    billingCoupon = null;
    document.getElementById('billingCustomerPhone').value = '';
    document.getElementById('billingCoupon').value = '';
    document.getElementById('billingCouponStatus').innerHTML = '';
    renderBillingCart();
});

// Apply Coupon in Billing
document.getElementById('billingApplyCoupon').addEventListener('click', async () => {
    const code = document.getElementById('billingCoupon').value.trim().toUpperCase();
    const statusEl = document.getElementById('billingCouponStatus');

    if (!code) { statusEl.innerHTML = '<span style="color:var(--danger);">Enter a coupon code</span>'; return; }

    const { data: coupon, error } = await db
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

    if (error || !coupon) {
        billingCoupon = null;
        statusEl.innerHTML = '<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Invalid coupon code</span>';
        renderBillingCart();
        return;
    }

    // Check min order
    const sellingTotal = billingCart.reduce((t, i) => t + i.price * i.qty, 0);
    if (coupon.min_order_amount && sellingTotal < coupon.min_order_amount) {
        statusEl.innerHTML = `<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Min order ${formatCurrency(coupon.min_order_amount)} required</span>`;
        return;
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        statusEl.innerHTML = '<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Coupon usage limit reached</span>';
        return;
    }

    billingCoupon = coupon;
    const discountText = coupon.discount_type === 'percentage' ? coupon.discount_value + '% off' : formatCurrency(coupon.discount_value) + ' off';
    statusEl.innerHTML = `<span style="color:var(--success);"><i class="fas fa-check-circle"></i> ${code} applied — ${discountText}!</span>`;
    renderBillingCart();
});

// Clear billing
document.getElementById('billingClearBtn').addEventListener('click', () => {
    if (billingCart.length > 0 && !confirm('Clear all items from the bill?')) return;
    billingCart = [];
    billingCoupon = null;
    document.getElementById('billingCustomerPhone').value = '';
    document.getElementById('billingCoupon').value = '';
    document.getElementById('billingCouponStatus').innerHTML = '';
    renderBillingCart();
});

// Print bill (basic)
document.getElementById('billingPrintBtn').addEventListener('click', () => {
    if (billingCart.length === 0) {
        showToast('Add products first', 'error');
        return;
    }

    const sellingTotal = billingCart.reduce((t, i) => t + i.price * i.qty, 0);
    const gst = billingCart.reduce((t, i) => t + (i.price * i.qty * i.gst_percent / 100), 0);
    const discount = billingCart.reduce((t, i) => t + (i.mrp - i.price) * i.qty, 0);

    const printContent = `
        <html><head><style>
            body { font-family: monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 10px; }
            h2 { text-align: center; margin: 0; } .sub { text-align: center; font-size: 10px; color: #666; }
            hr { border: 1px dashed #000; } table { width: 100%; border-collapse: collapse; }
            td { padding: 3px 0; font-size: 11px; } .right { text-align: right; }
            .total { font-size: 14px; font-weight: bold; border-top: 2px solid #000; padding-top: 5px; }
        </style></head><body>
        <h2>CHOICE KART</h2>
        <p class="sub">Smart Choice, Better Life<br>Jagtial, Telangana | Ph: 9666991993</p>
        <hr>
        <p>Date: ${new Date().toLocaleString('en-IN')}</p>
        <hr>
        <table>
            <tr><td><b>Item</b></td><td class="right"><b>Qty</b></td><td class="right"><b>Amount</b></td></tr>
            ${billingCart.map(i => `<tr><td>${i.name}</td><td class="right">${i.qty}</td><td class="right">₹${(i.price * i.qty).toFixed(2)}</td></tr>`).join('')}
        </table>
        <hr>
        <table>
            <tr><td>Subtotal</td><td class="right">₹${sellingTotal.toFixed(2)}</td></tr>
            ${discount > 0 ? `<tr><td>Discount</td><td class="right">-₹${discount.toFixed(2)}</td></tr>` : ''}
            ${gst > 0 ? `<tr><td>GST</td><td class="right">₹${gst.toFixed(2)}</td></tr>` : ''}
            <tr class="total"><td><b>TOTAL</b></td><td class="right"><b>₹${(sellingTotal + gst).toFixed(2)}</b></td></tr>
        </table>
        <hr>
        <p class="sub">Thank you for shopping at Choice Kart!<br>Visit us again.</p>
        </body></html>
    `;

    const printWindow = window.open('', '_blank', 'width=350,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
});

// Make closeModal globally available
window.closeModal = closeModal;
