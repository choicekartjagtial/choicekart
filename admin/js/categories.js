// ============================================
// CHOICE KART Admin - Categories & Subcategories
// ============================================
// Full CRUD for categories and subcategories.
// Manages categoriesCache and subcategoriesCache used by products.
// Depends on: db (supabase-config.js), utils.js

// Shared caches used by products and other modules
let categoriesCache = [];
let subcategoriesCache = [];
let categoriesCurrentPage = 1;
let subcategoriesCurrentPage = 1;

// ===== LOAD CATEGORIES =====
async function loadCategories(page = 1) {
    if (!db) return;
    categoriesCurrentPage = page;

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: categories, error, count } = await db
        .from('categories')
        .select('*', { count: 'exact' })
        .order('sort_order')
        .range(from, to);

    if (error) { showToast(error.message, 'error'); return; }

    // Always keep full cache for dropdowns (separate query without pagination)
    const { data: allCategories } = await db.from('categories').select('*').order('sort_order');
    categoriesCache = allCategories || [];

    // Update dropdown selects in product form and subcategory form
    updateCategoryDropdowns();

    const tbody = document.getElementById('categoriesTable');
    if (!categories || categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-tags"></i><h4>No categories yet. Add your first category!</h4></div></td></tr>';
        return;
    }

    // Count products and subcategories per category for display
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
                <td style="color:var(--text-muted);font-size:13px;">${c.sort_order || 0}</td>
                <td><span class="badge-status ${c.is_active ? 'badge-active' : 'badge-inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="editCategory('${c.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCategory('${c.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    // Only show pagination if more than PAGE_SIZE items
    if (count > PAGE_SIZE) {
        // Ensure pagination container exists
        let paginationEl = document.getElementById('categoriesPagination');
        if (!paginationEl) {
            const tableWrapper = tbody.closest('.table-wrapper') || tbody.closest('.card');
            paginationEl = document.createElement('div');
            paginationEl.id = 'categoriesPagination';
            paginationEl.className = 'pagination';
            tableWrapper.insertAdjacentElement('afterend', paginationEl);
        }
        renderPagination('categoriesPagination', count, page, PAGE_SIZE, (newPage) => { loadCategories(newPage); });
    }
}

/**
 * Update all category dropdown selects across the app.
 * Called after categories are loaded or modified.
 */
function updateCategoryDropdowns() {
    const options = '<option value="">Select Category</option>' +
        categoriesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    document.getElementById('productCategory').innerHTML = options;
    document.getElementById('subcategoryParent').innerHTML = options;

    // Filter dropdown on products page
    const filterOptions = '<option value="">All Categories</option>' +
        categoriesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('productCategoryFilter').innerHTML = filterOptions;
}

// ===== ADD CATEGORY BUTTON =====
document.getElementById('addCategoryBtn').addEventListener('click', async () => {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryModalTitle').textContent = 'Add Category';
    // Auto-set sort order to max + 1
    const maxOrder = categoriesCache.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
    document.getElementById('categorySortOrder').value = maxOrder + 1;
    openModal('categoryModal');
});

// ===== SAVE CATEGORY (create or update) =====
document.getElementById('saveCategoryBtn').addEventListener('click', async () => {
    const id = document.getElementById('categoryId').value;
    const name = document.getElementById('categoryName').value.trim();
    if (!name) { showToast('Category name is required', 'error'); return; }

    const data = {
        name: toTitleCase(name),
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
    loadCategories(categoriesCurrentPage);
});

// ===== EDIT CATEGORY =====
// Called from HTML onclick attribute
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

// ===== DELETE CATEGORY =====
window.deleteCategory = async function(id) {
    if (!await toastConfirm('Delete this category? All subcategories will also be deleted.')) return;
    const { error } = await db.from('categories').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Category deleted!');
    loadCategories(categoriesCurrentPage);
};

// ===== LOAD SUBCATEGORIES =====
async function loadSubcategories(page = 1) {
    if (!db) return;
    subcategoriesCurrentPage = page;

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: subcategories, error, count } = await db
        .from('subcategories')
        .select('*, categories(name)', { count: 'exact' })
        .order('sort_order')
        .range(from, to);

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

    // Only show pagination if more than PAGE_SIZE items
    if (count > PAGE_SIZE) {
        let paginationEl = document.getElementById('subcategoriesPagination');
        if (!paginationEl) {
            const tableWrapper = tbody.closest('.table-wrapper') || tbody.closest('.card');
            paginationEl = document.createElement('div');
            paginationEl.id = 'subcategoriesPagination';
            paginationEl.className = 'pagination';
            tableWrapper.insertAdjacentElement('afterend', paginationEl);
        }
        renderPagination('subcategoriesPagination', count, page, PAGE_SIZE, (newPage) => { loadSubcategories(newPage); });
    }
}

// ===== ADD SUBCATEGORY BUTTON =====
document.getElementById('addSubcategoryBtn').addEventListener('click', async () => {
    document.getElementById('subcategoryForm').reset();
    document.getElementById('subcategoryId').value = '';
    document.getElementById('subcategoryModalTitle').textContent = 'Add Subcategory';
    // Auto-set sort order to max + 1
    const maxOrder = subcategoriesCache.reduce((m, s) => Math.max(m, s.sort_order || 0), 0);
    document.getElementById('subcategorySortOrder').value = maxOrder + 1;
    openModal('subcategoryModal');
});

// ===== SAVE SUBCATEGORY (create or update) =====
document.getElementById('saveSubcategoryBtn').addEventListener('click', async () => {
    const id = document.getElementById('subcategoryId').value;
    const name = document.getElementById('subcategoryName').value.trim();
    const parentId = document.getElementById('subcategoryParent').value;

    if (!name || !parentId) { showToast('Name and parent category are required', 'error'); return; }

    const data = {
        name: toTitleCase(name),
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
    loadSubcategories(subcategoriesCurrentPage);
    loadCategories(categoriesCurrentPage); // Refresh category counts
});

// ===== EDIT SUBCATEGORY =====
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

// ===== DELETE SUBCATEGORY =====
window.deleteSubcategory = async function(id) {
    if (!await toastConfirm('Delete this subcategory?')) return;
    const { error } = await db.from('subcategories').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Subcategory deleted!');
    loadSubcategories(subcategoriesCurrentPage);
};
