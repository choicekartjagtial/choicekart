// ============================================
// CHOICE KART Admin - Customers List
// ============================================
// Displays customer list with search. Read-only view of customer data.
// Depends on: db (supabase-config.js), utils.js

// ===== LOAD CUSTOMERS =====
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

// ===== CUSTOMER SEARCH =====
document.getElementById('customerSearch').addEventListener('input', (e) => {
    loadCustomers(e.target.value);
});
