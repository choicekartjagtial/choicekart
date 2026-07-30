// ============================================
// CHOICE KART Admin - Marketing (Coupons & Banners)
// ============================================
// CRUD for coupon codes and promotional banners.
// Banner image upload uses uploadImage() from images.js.
// Depends on: db (supabase-config.js), utils.js, images.js

let couponsCurrentPage = 1;

// ===== LOAD COUPONS =====
async function loadCoupons(page = 1) {
    if (!db) return;
    couponsCurrentPage = page;

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await db
        .from('coupons')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('couponsTable');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-ticket-alt"></i><h4>No coupons yet</h4></div></td></tr>';
        renderPagination('couponsPagination', 0, page, PAGE_SIZE, () => {});
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

    renderPagination('couponsPagination', count, page, PAGE_SIZE, (newPage) => { loadCoupons(newPage); });
}

// ===== ADD COUPON BUTTON =====
document.getElementById('addCouponBtn').addEventListener('click', () => {
    document.getElementById('couponForm').reset();
    document.getElementById('couponId').value = '';
    document.getElementById('couponModalTitle').textContent = 'Add Coupon';
    openModal('couponModal');
});

// ===== SAVE COUPON (create or update) =====
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
    loadCoupons(couponsCurrentPage);
});

// ===== EDIT COUPON =====
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

// ===== DELETE COUPON =====
window.deleteCoupon = async function(id) {
    if (!await toastConfirm('Delete this coupon?')) return;
    const { error } = await db.from('coupons').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Coupon deleted!');
    loadCoupons(couponsCurrentPage);
};

// ===== LOAD BANNERS =====
const positionLabels = { home: 'Home Page', category: 'Category', offer: 'Offers', popup: 'Popup' };

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
            <td><img src="${imgPath(b.image_url)}" style="width:140px;height:56px;object-fit:${b.fit || 'contain'};border-radius:8px;background:#F3F4F6;border:1px solid var(--border);"></td>
            <td>
                <strong>${b.title}</strong>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Fit: ${b.fit || 'contain'}</div>
            </td>
            <td><span class="badge-status badge-active">${positionLabels[b.position] || b.position}</span></td>
            <td><span class="badge-status ${b.is_active ? 'badge-active' : 'badge-inactive'}">${b.is_active ? 'Active' : 'Inactive'}</span></td>
            <td style="white-space:nowrap;">
                <button class="btn btn-outline btn-sm" onclick="editBanner('${b.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteBanner('${b.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// ===== DELETE BANNER =====
window.deleteBanner = async function(id) {
    if (!await toastConfirm('Delete this banner?')) return;
    const { error } = await db.from('banners').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Banner deleted!');
    loadBanners();
};

// ===== ADD BANNER BUTTON =====
document.getElementById('addBannerBtn').addEventListener('click', async () => {
    document.getElementById('bannerForm').reset();
    document.getElementById('bannerId').value = '';
    document.getElementById('bannerImageUrl').value = '';
    document.getElementById('bannerImagePreview').style.display = 'none';
    document.getElementById('bannerModalTitle').textContent = 'Add Banner';
    // Auto-set sort order to max + 1
    const { data } = await db.from('banners').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    const nextOrder = (data && data.length > 0) ? data[0].sort_order + 1 : 1;
    document.getElementById('bannerSortOrder').value = nextOrder;
    openModal('bannerModal');
});

// ===== EDIT BANNER =====
window.editBanner = async function(id) {
    const { data: b } = await db.from('banners').select('*').eq('id', id).single();
    if (!b) return;
    document.getElementById('bannerId').value = b.id;
    document.getElementById('bannerTitle').value = b.title;
    document.getElementById('bannerImageUrl').value = b.image_url || '';
    document.getElementById('bannerLinkUrl').value = b.link_url || '';
    document.getElementById('bannerPosition').value = b.position;
    document.getElementById('bannerSortOrder').value = b.sort_order || 0;
    document.getElementById('bannerFit').value = b.fit || 'contain';
    document.getElementById('bannerModalTitle').textContent = 'Edit Banner';
    // Show preview
    const preview = document.getElementById('bannerImagePreview');
    if (b.image_url) {
        preview.src = imgPath(b.image_url);
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
    openModal('bannerModal');
};

// ===== BANNER IMAGE UPLOAD =====
document.getElementById('bannerImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('bannerImagePreview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    showToast('Uploading banner...', 'warning');
    const url = await uploadImage(file, 'banners');
    if (url) {
        document.getElementById('bannerImageUrl').value = url;
        showToast('Banner image uploaded!');
    } else {
        showToast('Upload failed — check console', 'error');
    }
});

// ===== SAVE BANNER (insert or update) =====
document.getElementById('saveBannerBtn').addEventListener('click', async () => {
    const id = document.getElementById('bannerId').value;
    const title = document.getElementById('bannerTitle').value.trim();
    const imageUrl = document.getElementById('bannerImageUrl').value.trim();
    if (!title) { showToast('Banner title is required', 'error'); return; }
    if (!imageUrl) { showToast('Please upload a banner image', 'error'); return; }

    const data = {
        title,
        image_url: imageUrl,
        link_url: document.getElementById('bannerLinkUrl').value.trim() || null,
        position: document.getElementById('bannerPosition').value,
        sort_order: parseInt(document.getElementById('bannerSortOrder').value) || 0,
        fit: document.getElementById('bannerFit').value || 'contain'
    };

    let error;
    if (id) {
        ({ error } = await db.from('banners').update(data).eq('id', id));
    } else {
        ({ error } = await db.from('banners').insert(data));
    }

    if (error) { showToast(error.message, 'error'); return; }
    showToast(id ? 'Banner updated!' : 'Banner added!');
    closeModal('bannerModal');
    loadBanners();
});
