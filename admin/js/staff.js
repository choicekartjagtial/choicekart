// ============================================
// CHOICE KART Admin - Staff Management
// ============================================
// CRUD for admin_users (staff accounts with role assignment).
// Only accessible by the Owner role.
// Depends on: db (supabase-config.js), utils.js

// ===== LOAD STAFF =====
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

// ===== ADD STAFF BUTTON =====
document.getElementById('addStaffBtn').addEventListener('click', () => {
    document.getElementById('staffForm').reset();
    document.getElementById('staffId').value = '';
    document.getElementById('staffModalTitle').textContent = 'Add Staff';
    openModal('staffModal');
});

// ===== SAVE STAFF (create or update) =====
document.getElementById('saveStaffBtn').addEventListener('click', async () => {
    const id = document.getElementById('staffId').value;
    const name = document.getElementById('staffName').value.trim();
    const email = document.getElementById('staffEmail').value.trim();
    const password = document.getElementById('staffPassword').value;

    // Password is required only for new staff
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

    // Only include password if provided (allows editing without changing password)
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

// ===== EDIT STAFF =====
window.editStaff = async function(id) {
    const { data: s } = await db.from('admin_users').select('*').eq('id', id).single();
    if (!s) return;
    document.getElementById('staffId').value = s.id;
    document.getElementById('staffName').value = s.name;
    document.getElementById('staffEmail').value = s.email;
    document.getElementById('staffPassword').value = ''; // Don't pre-fill password
    document.getElementById('staffPhone').value = s.phone || '';
    document.getElementById('staffRole').value = s.role;
    document.getElementById('staffModalTitle').textContent = 'Edit Staff';
    openModal('staffModal');
};

// ===== DELETE STAFF =====
window.deleteStaff = async function(id) {
    if (!confirm('Delete this staff member? They will lose admin access.')) return;
    const { error } = await db.from('admin_users').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Staff removed!');
    loadStaff();
};
