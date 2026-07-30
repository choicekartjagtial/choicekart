// ============================================
// CHOICE KART Admin - Products CRUD
// ============================================
// Handles product listing, search, filter, add/edit/delete.
// Uses categoriesCache from categories.js for dropdown population.
// Depends on: db (supabase-config.js), utils.js, categories.js

let productsCurrentPage = 1;
let _productsFiltersInjected = false;

function _injectProductFilters() {
    if (_productsFiltersInjected) return;
    _productsFiltersInjected = true;
    const toolbar = document.querySelector('#sec-products .toolbar');
    if (!toolbar) return;

    // Insert filter row after the toolbar
    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    filterRow.id = 'productFilters';
    filterRow.innerHTML = `
        <input type="number" id="productPriceMin" placeholder="Min Price" style="width:100px;">
        <input type="number" id="productPriceMax" placeholder="Max Price" style="width:100px;">
        <select id="productStockFilter" style="width:auto;">
            <option value="">All Stock</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
        </select>
        <input type="text" id="productBrandFilter" placeholder="Brand" style="width:120px;">
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="productFeaturedFilter" style="width:16px;height:16px;accent-color:var(--primary);">
            Featured only
        </label>
    `;
    toolbar.insertAdjacentElement('afterend', filterRow);

    // Attach filter event listeners
    ['productPriceMin','productPriceMax','productBrandFilter'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => { productsCurrentPage = 1; _triggerProductLoad(); });
    });
    document.getElementById('productStockFilter').addEventListener('change', () => { productsCurrentPage = 1; _triggerProductLoad(); });
    document.getElementById('productFeaturedFilter').addEventListener('change', () => { productsCurrentPage = 1; _triggerProductLoad(); });
}

function _triggerProductLoad() {
    loadProducts(
        document.getElementById('productSearch').value,
        document.getElementById('productCategoryFilter').value,
        productsCurrentPage
    );
}

// ===== LOAD PRODUCTS =====
async function loadProducts(search = '', categoryFilter = '', page = 1) {
    if (!db) return;
    _injectProductFilters();
    productsCurrentPage = page;

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = db
        .from('products')
        .select('*, categories(name)', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (categoryFilter) query = query.eq('category_id', categoryFilter);
    if (search) query = query.ilike('name', `%${search}%`);

    // Advanced filters
    const priceMin = document.getElementById('productPriceMin')?.value;
    const priceMax = document.getElementById('productPriceMax')?.value;
    const stockFilter = document.getElementById('productStockFilter')?.value;
    const brandFilter = document.getElementById('productBrandFilter')?.value?.trim();
    const featuredOnly = document.getElementById('productFeaturedFilter')?.checked;

    if (priceMin) query = query.gte('selling_price', parseFloat(priceMin));
    if (priceMax) query = query.lte('selling_price', parseFloat(priceMax));
    if (stockFilter === 'out_of_stock') query = query.lte('stock_qty', 0);
    if (stockFilter === 'low_stock') query = query.gt('stock_qty', 0).lte('stock_qty', 10);
    if (stockFilter === 'in_stock') query = query.gt('stock_qty', 10);
    if (brandFilter) query = query.ilike('brand', `%${brandFilter}%`);
    if (featuredOnly) query = query.eq('is_featured', true);

    query = query.range(from, to);

    const { data: products, error, count } = await query;

    if (error) { showToast(error.message, 'error'); return; }

    // Ensure categories are loaded for dropdowns
    if (categoriesCache.length === 0) {
        const { data } = await db.from('categories').select('*').order('sort_order');
        categoriesCache = data || [];
        updateCategoryDropdowns();
    }

    const tbody = document.getElementById('productsTable');
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-box-open"></i><h4>No products yet. Add your first product!</h4></div></td></tr>';
        renderPagination('productsPagination', 0, page, PAGE_SIZE, () => {});
        return;
    }

    tbody.innerHTML = products.map(p => {
        // Calculate discount percentage from MRP vs selling price
        const discount = p.mrp > p.selling_price
            ? Math.round((1 - p.selling_price / p.mrp) * 100)
            : 0;
        // Stock bar color: red if out, yellow if low, green if healthy
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

    renderPagination('productsPagination', count, page, PAGE_SIZE, (newPage) => {
        loadProducts(
            document.getElementById('productSearch').value,
            document.getElementById('productCategoryFilter').value,
            newPage
        );
    });
}

// ===== PRODUCT SEARCH & FILTER =====
document.getElementById('productSearch').addEventListener('input', (e) => {
    productsCurrentPage = 1;
    loadProducts(e.target.value, document.getElementById('productCategoryFilter').value, 1);
});

document.getElementById('productCategoryFilter').addEventListener('change', (e) => {
    productsCurrentPage = 1;
    loadProducts(document.getElementById('productSearch').value, e.target.value, 1);
});

// ===== SUBCATEGORY DROPDOWN IN PRODUCT FORM =====
// When a category is selected, load its subcategories into the dropdown
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

// ===== ADD PRODUCT BUTTON =====
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

// ===== SAVE PRODUCT (create or update) =====
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
        name: toTitleCase(name),
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
        brand: toTitleCase(document.getElementById('productBrand').value.trim()) || null,
        barcode: document.getElementById('productBarcode').value.trim() || null, // auto-generated below if empty on insert
        gst_percent: parseFloat(document.getElementById('productGST').value) || 0,
        image_url: document.getElementById('productImageUrl').value.trim() || null,
        is_featured: document.getElementById('productFeatured').value === 'true'
    };

    // Auto-generate barcode for new products without one (CK00001 format)
    if (!id && !data.barcode) {
        const { count } = await db.from('products').select('id', { count: 'exact', head: true });
        data.barcode = 'CK' + String((count || 0) + 1).padStart(5, '0');
    }

    let error;
    if (id) {
        ({ error } = await db.from('products').update(data).eq('id', id));
    } else {
        ({ error } = await db.from('products').insert(data));
    }

    if (error) { showToast(error.message, 'error'); return; }
    showToast(id ? 'Product updated!' : `Product added! Barcode: ${data.barcode}`);
    closeModal('productModal');
    loadProducts('', '', 1);
});

// ===== EDIT PRODUCT =====
window.editProduct = async function(id) {
    const { data: p, error } = await db.from('products').select('*').eq('id', id).single();
    if (error || !p) { showToast('Product not found', 'error'); return; }

    document.getElementById('productId').value = p.id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productNameTe').value = p.name_te || '';
    document.getElementById('productCategory').value = p.category_id;

    // Trigger subcategory load, then set the value after a short delay
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

// ===== DELETE PRODUCT =====
// ===== GENERATE BARCODE =====
// Auto-generates a store barcode (CK00001 format) for the product
window.generateBarcode = async function() {
    const field = document.getElementById('productBarcode');
    if (field.value.trim()) {
        const ok = await toastConfirm('Barcode already exists. Replace?', 'Yes, Replace');
        if (!ok) return;
    }
    const { count } = await db.from('products').select('id', { count: 'exact', head: true });
    const code = 'CK' + String((count || 0) + 1).padStart(5, '0');
    field.value = code;
    showToast('Barcode generated: ' + code);
};

window.deleteProduct = async function(id) {
    if (!await toastConfirm('Delete this product?')) return;
    const { error } = await db.from('products').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Product deleted!');
    loadProducts('', '', productsCurrentPage);
};
