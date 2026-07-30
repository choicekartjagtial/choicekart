// ============================================
// CHOICE KART Admin - Customers List
// ============================================
// Displays customer list with search. Read-only view of customer data.
// Depends on: db (supabase-config.js), utils.js

let customersCurrentPage = 1;
let _customersFiltersInjected = false;

function _injectCustomerFilters() {
    if (_customersFiltersInjected) return;
    _customersFiltersInjected = true;
    const toolbar = document.querySelector('#sec-customers .toolbar');
    if (!toolbar) return;

    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    filterRow.innerHTML = `
        <input type="date" id="customerDateFrom" title="Joined from">
        <input type="date" id="customerDateTo" title="Joined to">
        <select id="customerStatusFilter" style="width:auto;">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
        </select>
    `;
    toolbar.insertAdjacentElement('afterend', filterRow);

    ['customerDateFrom','customerDateTo'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => { customersCurrentPage = 1; _triggerCustomerLoad(); });
    });
    document.getElementById('customerStatusFilter').addEventListener('change', () => { customersCurrentPage = 1; _triggerCustomerLoad(); });
}

function _triggerCustomerLoad() {
    loadCustomers(document.getElementById('customerSearch').value, customersCurrentPage);
}

// ===== LOAD CUSTOMERS =====
async function loadCustomers(search = '', page = 1) {
    if (!db) return;
    _injectCustomerFilters();
    customersCurrentPage = page;

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = db.from('customers').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

    // Advanced filters
    const dateFrom = document.getElementById('customerDateFrom')?.value;
    const dateTo = document.getElementById('customerDateTo')?.value;
    const statusFilter = document.getElementById('customerStatusFilter')?.value;

    if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
    if (statusFilter === 'active') query = query.eq('is_active', true);
    if (statusFilter === 'inactive') query = query.eq('is_active', false);

    query = query.range(from, to);

    const { data: customers, error, count } = await query;
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('customersTable');
    if (!customers || customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-users"></i><h4>No customers yet</h4></div></td></tr>';
        renderPagination('customersPagination', 0, page, PAGE_SIZE, () => {});
        return;
    }

    // Bulk actions bar (owner only)
    renderBulkActions('customersBulk', 'customersTable', {
        onDelete: async () => {
            const ids = getSelectedIds('customersTable');
            if (!ids.length) { showToast('Select customers first', 'error'); return; }
            if (!await toastConfirm(`Delete ${ids.length} customer(s)? Their order history will remain.`)) return;
            for (const id of ids) { await db.from('customers').delete().eq('id', id); }
            showToast(`${ids.length} customer(s) deleted`);
            _triggerCustomerLoad();
        },
        onExportCSV: () => {
            const ids = getSelectedIds('customersTable');
            if (!ids.length) { showToast('Select customers to export', 'error'); return; }
            exportCustomersData('csv', ids);
        },
        onExportExcel: () => {
            const ids = getSelectedIds('customersTable');
            if (!ids.length) { showToast('Select customers to export', 'error'); return; }
            exportCustomersData('excel', ids);
        }
    });

    tbody.innerHTML = customers.map(c => `
        <tr>
            ${isOwner() ? `<td><input type="checkbox" class="row-checkbox" value="${c.id}" onchange="updateBulkCount('customersTable')" style="width:16px;height:16px;accent-color:var(--primary);"></td>` : ''}
            <td><strong>${c.name || '-'}</strong></td>
            <td>${c.phone}</td>
            <td>${c.email || '-'}</td>
            <td>-</td>
            <td>${formatDate(c.created_at)}</td>
            <td><span class="badge-status ${c.is_active ? 'badge-active' : 'badge-inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
        </tr>
    `).join('');

    renderPagination('customersPagination', count, page, PAGE_SIZE, (newPage) => {
        loadCustomers(document.getElementById('customerSearch').value, newPage);
    });
}

// ===== EXPORT CUSTOMERS =====
async function exportCustomersData(format, ids) {
    const { data: customers } = await db.from('customers').select('*').in('id', ids);
    if (!customers?.length) { showToast('No data', 'error'); return; }
    const today = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
        const csv = 'Name,Phone,Email,Active,Joined\n' +
            customers.map(c => `${c.name || '-'},${c.phone},${c.email || '-'},${c.is_active},${new Date(c.created_at).toLocaleDateString('en-IN')}`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `customers-${today}.csv`; a.click();
        showToast(`Exported ${customers.length} customers`);
    } else {
        let html = `<html><head><meta charset="UTF-8"><style>td,th{border:1px solid #ccc;padding:4px 8px;font-size:11px;}th{background:#059669;color:white;}</style></head><body>
        <h2>Choice Kart Customers (${today})</h2><table>
        <tr><th>Name</th><th>Phone</th><th>Email</th><th>Active</th><th>Joined</th><th>Addresses</th></tr>`;
        customers.forEach(c => {
            const addrs = (c.addresses || []).map(a => a.address).join('; ');
            html += `<tr><td>${c.name || '-'}</td><td>${c.phone}</td><td>${c.email || '-'}</td><td>${c.is_active ? 'Yes' : 'No'}</td><td>${new Date(c.created_at).toLocaleDateString('en-IN')}</td><td>${addrs || '-'}</td></tr>`;
        });
        html += '</table></body></html>';
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `customers-${today}.xls`; a.click();
        showToast(`Exported ${customers.length} customers`);
    }
}

// ===== CUSTOMER SEARCH =====
document.getElementById('customerSearch').addEventListener('input', (e) => {
    customersCurrentPage = 1;
    loadCustomers(e.target.value, 1);
});
