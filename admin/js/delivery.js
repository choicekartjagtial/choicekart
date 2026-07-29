// ============================================
// CHOICE KART Admin - Delivery Boys & Delivery Charges
// ============================================
// CRUD for delivery boys and delivery charge slabs.
// Depends on: db (supabase-config.js), utils.js

// ===== LOAD DELIVERY BOYS =====
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

// ===== ADD DELIVERY BOY BUTTON =====
document.getElementById('addDeliveryBoyBtn').addEventListener('click', () => {
    document.getElementById('deliveryBoyForm').reset();
    document.getElementById('deliveryBoyId').value = '';
    document.getElementById('deliveryBoyModalTitle').textContent = 'Add Delivery Boy';
    openModal('deliveryBoyModal');
});

// ===== SAVE DELIVERY BOY (create or update) =====
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

// ===== EDIT DELIVERY BOY =====
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

// ===== DELETE DELIVERY BOY =====
window.deleteDeliveryBoy = async function(id) {
    if (!confirm('Delete this delivery boy?')) return;
    const { error } = await db.from('delivery_boys').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Delivery boy deleted!');
    loadDeliveryBoys();
};

// ===== LOAD DELIVERY CHARGES =====
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

// ===== DELETE DELIVERY CHARGE =====
window.deleteDeliveryCharge = async function(id) {
    if (!confirm('Delete this delivery charge slab?')) return;
    const { error } = await db.from('delivery_charges').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Deleted!');
    loadDeliveryCharges();
};

// ===== ADD DELIVERY CHARGE BUTTON =====
document.getElementById('addDeliveryChargeBtn').addEventListener('click', () => {
    document.getElementById('deliveryChargeForm').reset();
    openModal('deliveryChargeModal');
});

// ===== SAVE DELIVERY CHARGE =====
document.getElementById('saveDeliveryChargeBtn').addEventListener('click', async () => {
    const minDist = parseFloat(document.getElementById('dcMinDistance').value);
    const maxDist = parseFloat(document.getElementById('dcMaxDistance').value);
    const charge = parseFloat(document.getElementById('dcCharge').value);

    if (isNaN(minDist) || isNaN(maxDist) || isNaN(charge)) {
        showToast('Please fill all required fields', 'error'); return;
    }
    if (minDist >= maxDist) {
        showToast('Max distance must be greater than min distance', 'error'); return;
    }

    const { error } = await db.from('delivery_charges').insert({
        min_distance_km: minDist,
        max_distance_km: maxDist,
        charge,
        free_above_amount: parseFloat(document.getElementById('dcFreeAbove').value) || null
    });

    if (error) { showToast(error.message, 'error'); return; }
    showToast('Delivery charge slab added!');
    closeModal('deliveryChargeModal');
    loadDeliveryCharges();
});
