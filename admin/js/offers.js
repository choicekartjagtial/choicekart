// ============================================
// CHOICE KART Admin - Deals & Offers Management
// ============================================
// CRUD for website offers/deals section.
// Depends on: db (supabase-config.js), utils.js

const OFFER_STYLE_LABELS = {
    mega: '🔴 Mega',
    savings: '🔵 Savings',
    delivery: '🟢 Delivery',
    festive: '🟠 Festive',
    flash: '🟣 Flash'
};

// ===== LOAD OFFERS =====
async function loadOffers() {
    if (!db) return;

    const { data, error } = await db.from('offers').select('*').order('sort_order');
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('offersTable');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-fire"></i><h4>No offers yet. Add your first deal!</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(o => `
        <tr>
            <td>
                <strong>${o.title}</strong>
                ${o.subtitle ? `<div style="font-size:11px;color:var(--text-muted);">${o.subtitle}</div>` : ''}
                ${o.coupon_code ? `<div style="font-size:11px;color:var(--primary);font-weight:600;">Code: ${o.coupon_code}</div>` : ''}
            </td>
            <td><strong>${o.offer_value}</strong></td>
            <td>${OFFER_STYLE_LABELS[o.style] || o.style}</td>
            <td>${o.sort_order}</td>
            <td><span class="badge-status ${o.is_active ? 'badge-active' : 'badge-inactive'}">${o.is_active ? 'Active' : 'Inactive'}</span></td>
            <td style="white-space:nowrap;">
                <button class="btn btn-outline btn-sm" onclick="editOffer('${o.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteOffer('${o.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// ===== ADD OFFER =====
document.getElementById('addOfferBtn').addEventListener('click', async () => {
    document.getElementById('offerForm').reset();
    document.getElementById('offerId').value = '';
    document.getElementById('offerImageUrl').value = '';
    document.getElementById('offerImagePreview').style.display = 'none';
    document.getElementById('offerModalTitle').textContent = 'Add Offer';

    // Auto-set sort order to max + 1
    const { data } = await db.from('offers').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    const nextOrder = (data && data.length > 0) ? data[0].sort_order + 1 : 1;
    document.getElementById('offerSortOrder').value = nextOrder;
    document.getElementById('offerSortHint').textContent = `(current max: ${nextOrder - 1})`;

    openModal('offerModal');
});

// ===== EDIT OFFER =====
window.editOffer = async function(id) {
    const { data: o } = await db.from('offers').select('*').eq('id', id).single();
    if (!o) return;
    document.getElementById('offerId').value = o.id;
    document.getElementById('offerTitle').value = o.title;
    document.getElementById('offerSubtitle').value = o.subtitle || '';
    document.getElementById('offerValue').value = o.offer_value;
    document.getElementById('offerDescription').value = o.description || '';
    document.getElementById('offerCouponCode').value = o.coupon_code || '';
    document.getElementById('offerLinkUrl').value = o.link_url || '';
    document.getElementById('offerStyle').value = o.style;
    document.getElementById('offerSortOrder').value = o.sort_order || 0;
    document.getElementById('offerImageUrl').value = o.image_url || '';
    const preview = document.getElementById('offerImagePreview');
    if (o.image_url) { preview.src = imgPath(o.image_url); preview.style.display = 'block'; }
    else { preview.style.display = 'none'; }
    document.getElementById('offerSortHint').textContent = '';
    document.getElementById('offerModalTitle').textContent = 'Edit Offer';
    openModal('offerModal');
};

// ===== SAVE OFFER =====
document.getElementById('saveOfferBtn').addEventListener('click', async () => {
    const id = document.getElementById('offerId').value;
    const title = document.getElementById('offerTitle').value.trim();
    const offerValue = document.getElementById('offerValue').value.trim();

    if (!title || !offerValue) { showToast('Title and offer value are required', 'error'); return; }

    const data = {
        title,
        subtitle: document.getElementById('offerSubtitle').value.trim() || null,
        offer_value: offerValue,
        description: document.getElementById('offerDescription').value.trim() || null,
        coupon_code: document.getElementById('offerCouponCode').value.trim().toUpperCase() || null,
        link_url: document.getElementById('offerLinkUrl').value.trim() || null,
        style: document.getElementById('offerStyle').value,
        sort_order: parseInt(document.getElementById('offerSortOrder').value) || 0,
        image_url: document.getElementById('offerImageUrl').value.trim() || null
    };

    let error;
    if (id) {
        ({ error } = await db.from('offers').update(data).eq('id', id));
    } else {
        ({ error } = await db.from('offers').insert(data));
    }

    if (error) { showToast(error.message, 'error'); return; }
    showToast(id ? 'Offer updated!' : 'Offer added!');
    closeModal('offerModal');
    loadOffers();
});

// ===== OFFER IMAGE UPLOAD =====
document.getElementById('offerImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('offerImagePreview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    showToast('Uploading offer image...', 'warning');
    const url = await uploadImage(file, 'offers');
    if (url) {
        document.getElementById('offerImageUrl').value = url;
        showToast('Image uploaded!');
    } else {
        showToast('Upload failed', 'error');
    }
});

// ===== DELETE OFFER =====
window.deleteOffer = async function(id) {
    if (!await toastConfirm('Delete this offer?')) return;
    const { error } = await db.from('offers').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Offer deleted!');
    loadOffers();
};
