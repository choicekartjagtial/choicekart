// ============================================
// CHOICE KART Admin - Store Settings & Service Areas
// ============================================
// Loads/saves store settings (key-value pairs in store_settings table)
// and manages service area pincodes.
// Depends on: db (supabase-config.js), utils.js

// ===== LOAD STORE SETTINGS =====
async function loadSettings() {
    if (!db) return;

    const { data, error } = await db.from('store_settings').select('*');
    if (error) { showToast(error.message, 'error'); return; }
    if (!data) return;

    // Convert array of {key, value} rows into a lookup object
    const settings = {};
    data.forEach(s => settings[s.key] = s.value);

    // Populate form fields
    document.getElementById('setStoreName').value = settings.store_name || '';
    document.getElementById('setStorePhone').value = settings.store_phone || '';
    document.getElementById('setStoreEmail').value = settings.store_email || '';
    document.getElementById('setStoreAddress').value = settings.store_address || '';
    document.getElementById('setMinOrder').value = settings.min_order_amount || '';
    document.getElementById('setOpenTime').value = settings.opening_time || '';
    document.getElementById('setCloseTime').value = settings.closing_time || '';
    document.getElementById('setDeliveryRadius').value = settings.delivery_radius_km || '';
    document.getElementById('setGST').value = settings.gst_number || '';

    // GST settings
    document.getElementById('setDefaultGST').value = settings.default_gst_percent || '';
    document.getElementById('setGSTIN').value = settings.gstin_number || '';

    // Payment options
    document.getElementById('setCODEnabled').checked = settings.cod_enabled !== 'false'; // default true
    document.getElementById('setRazorpayKeyId').value = settings.razorpay_key_id || '';
    document.getElementById('setRazorpayKeySecret').value = settings.razorpay_key_secret || '';
}

// ===== SAVE STORE SETTINGS =====
// Upserts each setting as a key-value pair
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
        gst_number: document.getElementById('setGST').value,
        default_gst_percent: document.getElementById('setDefaultGST').value || '0',
        gstin_number: document.getElementById('setGSTIN').value,
        cod_enabled: document.getElementById('setCODEnabled').checked ? 'true' : 'false',
        razorpay_key_id: document.getElementById('setRazorpayKeyId').value,
        razorpay_key_secret: document.getElementById('setRazorpayKeySecret').value
    };

    // Upsert each setting individually
    for (const [key, value] of Object.entries(settingsMap)) {
        await db.from('store_settings').upsert({ key, value }, { onConflict: 'key' });
    }

    showToast('Settings saved!');
});

// ===== LOAD SERVICE AREAS =====
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

// ===== DELETE SERVICE AREA =====
window.deleteServiceArea = async function(id) {
    if (!await toastConfirm('Delete this service area?')) return;
    const { error } = await db.from('service_areas').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Service area deleted!');
    loadServiceAreas();
};

// ===== ADD SERVICE AREA BUTTON =====
document.getElementById('addServiceAreaBtn').addEventListener('click', () => {
    document.getElementById('serviceAreaForm').reset();
    // Default city and state for Jagtial, Telangana
    document.getElementById('serviceAreaCity').value = 'Jagtial';
    document.getElementById('serviceAreaState').value = 'Telangana';
    openModal('serviceAreaModal');
});

// ===== SAVE SERVICE AREA =====
document.getElementById('saveServiceAreaBtn').addEventListener('click', async () => {
    const pincode = document.getElementById('serviceAreaPincode').value.trim();
    const areaName = document.getElementById('serviceAreaName').value.trim();
    if (!pincode || !areaName) { showToast('Pincode and area name are required', 'error'); return; }

    const { error } = await db.from('service_areas').insert({
        pincode,
        area_name: areaName,
        city: document.getElementById('serviceAreaCity').value.trim() || 'Jagtial',
        state: document.getElementById('serviceAreaState').value.trim() || 'Telangana'
    });

    if (error) { showToast(error.message, 'error'); return; }
    showToast('Service area added!');
    closeModal('serviceAreaModal');
    loadServiceAreas();
});
