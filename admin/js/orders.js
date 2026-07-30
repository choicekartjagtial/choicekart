// ============================================
// CHOICE KART Admin - Orders & Online Orders
// ============================================
// Handles order listing, status updates, search/filter,
// online orders with delivery assignment, and order detail view.
// Depends on: db (supabase-config.js), utils.js

let ordersCurrentPage = 1;
let onlineOrdersCurrentPage = 1;
let _ordersFiltersInjected = false;
let _onlineOrdersFiltersInjected = false;

function _injectOrderFilters() {
    if (_ordersFiltersInjected) return;
    _ordersFiltersInjected = true;
    const toolbar = document.querySelector('#sec-orders .toolbar');
    if (!toolbar) return;

    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    filterRow.innerHTML = `
        <input type="date" id="orderDateFrom" title="From date">
        <input type="date" id="orderDateTo" title="To date">
        <select id="orderPaymentFilter" style="width:auto;">
            <option value="">All Payments</option>
            <option value="cod">COD</option>
            <option value="online">Online</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
        </select>
        <input type="number" id="orderAmountMin" placeholder="Min Amount" style="width:110px;">
        <input type="number" id="orderAmountMax" placeholder="Max Amount" style="width:110px;">
    `;
    toolbar.insertAdjacentElement('afterend', filterRow);

    ['orderDateFrom','orderDateTo','orderAmountMin','orderAmountMax'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => { ordersCurrentPage = 1; _triggerOrderLoad(); });
    });
    document.getElementById('orderPaymentFilter').addEventListener('change', () => { ordersCurrentPage = 1; _triggerOrderLoad(); });
}

function _triggerOrderLoad() {
    loadOrders(
        document.getElementById('orderSearch').value,
        document.getElementById('orderStatusFilter').value,
        ordersCurrentPage
    );
}

function _injectOnlineOrderFilters() {
    if (_onlineOrdersFiltersInjected) return;
    _onlineOrdersFiltersInjected = true;
    const toolbar = document.querySelector('#sec-online-orders .toolbar');
    if (!toolbar) return;

    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    filterRow.innerHTML = `
        <input type="date" id="onlineOrderDateFrom" title="From date">
        <input type="date" id="onlineOrderDateTo" title="To date">
        <select id="onlineOrderPaymentFilter" style="width:auto;">
            <option value="">All Payments</option>
            <option value="cod">COD</option>
            <option value="online">Online</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
        </select>
        <input type="number" id="onlineOrderAmountMin" placeholder="Min Amount" style="width:110px;">
        <input type="number" id="onlineOrderAmountMax" placeholder="Max Amount" style="width:110px;">
    `;
    toolbar.insertAdjacentElement('afterend', filterRow);

    ['onlineOrderDateFrom','onlineOrderDateTo','onlineOrderAmountMin','onlineOrderAmountMax'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => { onlineOrdersCurrentPage = 1; _triggerOnlineOrderLoad(); });
    });
    document.getElementById('onlineOrderPaymentFilter').addEventListener('change', () => { onlineOrdersCurrentPage = 1; _triggerOnlineOrderLoad(); });
}

function _triggerOnlineOrderLoad() {
    loadOnlineOrders(
        document.getElementById('onlineOrderSearch').value,
        document.getElementById('onlineOrderStatusFilter').value,
        onlineOrdersCurrentPage
    );
}

// ===== LOAD ORDERS (All orders) =====
async function loadOrders(search = '', statusFilter = '', page = 1) {
    if (!db) return;
    _injectOrderFilters();
    ordersCurrentPage = page;

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = db
        .from('orders')
        .select('*, customers(name, phone), order_items(id)', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (statusFilter) query = query.eq('status', statusFilter);
    if (search) query = query.or(`order_number.ilike.%${search}%`);

    // Advanced filters
    const dateFrom = document.getElementById('orderDateFrom')?.value;
    const dateTo = document.getElementById('orderDateTo')?.value;
    const paymentFilter = document.getElementById('orderPaymentFilter')?.value;
    const amountMin = document.getElementById('orderAmountMin')?.value;
    const amountMax = document.getElementById('orderAmountMax')?.value;

    if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
    if (paymentFilter) query = query.eq('payment_method', paymentFilter);
    if (amountMin) query = query.gte('total', parseFloat(amountMin));
    if (amountMax) query = query.lte('total', parseFloat(amountMax));

    query = query.range(from, to);

    const { data: orders, error, count } = await query;
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('ordersTable');
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-inbox"></i><h4>No orders found</h4></div></td></tr>';
        renderPagination('ordersPagination', 0, page, PAGE_SIZE, () => {});
        return;
    }

    // Bulk actions bar (owner only)
    renderBulkActions('ordersBulk', 'ordersTable', {
        onDelete: async () => {
            const ids = getSelectedIds('ordersTable');
            if (!ids.length) { showToast('Select orders first', 'error'); return; }
            if (!await toastConfirm(`Delete ${ids.length} order(s)? This cannot be undone.`)) return;
            for (const id of ids) { await db.from('order_items').delete().eq('order_id', id); await db.from('orders').delete().eq('id', id); }
            showToast(`${ids.length} order(s) deleted`);
            _triggerOrderLoad();
        },
        onExportCSV: () => exportOrdersData('csv', 'ordersTable'),
        onExportExcel: () => exportOrdersData('excel', 'ordersTable')
    });

    tbody.innerHTML = orders.map(o => `
        <tr>
            ${isOwner() ? `<td><input type="checkbox" class="row-checkbox" value="${o.id}" onchange="updateBulkCount('ordersTable')" style="width:16px;height:16px;accent-color:var(--primary);"></td>` : ''}
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

    renderPagination('ordersPagination', count, page, PAGE_SIZE, (newPage) => {
        loadOrders(
            document.getElementById('orderSearch').value,
            document.getElementById('orderStatusFilter').value,
            newPage
        );
    });
}

// ===== UPDATE ORDER STATUS =====
// Called from the inline status dropdown on each order row
window.updateOrderStatus = async function(id, status) {
    const updateData = { status };
    // Record timestamp for delivered/cancelled
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
    if (status === 'cancelled') updateData.cancelled_at = new Date().toISOString();

    const { error } = await db.from('orders').update(updateData).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`Order ${status}!`);
};

// ===== VIEW ORDER (placeholder) =====
window.viewOrder = async function(id) {
    showToast('Order detail view coming soon!', 'warning');
};

// ===== ORDER SEARCH & FILTER =====
document.getElementById('orderSearch').addEventListener('input', (e) => {
    ordersCurrentPage = 1;
    loadOrders(e.target.value, document.getElementById('orderStatusFilter').value, 1);
});
document.getElementById('orderStatusFilter').addEventListener('change', (e) => {
    ordersCurrentPage = 1;
    loadOrders(document.getElementById('orderSearch').value, e.target.value, 1);
});

// ===== LOAD ONLINE ORDERS =====
// Shows only non-POS orders with delivery assignment capability
async function loadOnlineOrders(search = '', statusFilter = 'pending', page = 1) {
    if (!db) return;
    _injectOnlineOrderFilters();
    onlineOrdersCurrentPage = page;

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = db
        .from('orders')
        .select('*, customers(name, phone), delivery_boys(name, phone)', { count: 'exact' })
        .neq('notes', 'In-store POS billing')
        .order('created_at', { ascending: false });

    if (statusFilter) query = query.eq('status', statusFilter);
    if (search) query = query.or(`order_number.ilike.%${search}%`);

    // Advanced filters
    const dateFrom = document.getElementById('onlineOrderDateFrom')?.value;
    const dateTo = document.getElementById('onlineOrderDateTo')?.value;
    const paymentFilter = document.getElementById('onlineOrderPaymentFilter')?.value;
    const amountMin = document.getElementById('onlineOrderAmountMin')?.value;
    const amountMax = document.getElementById('onlineOrderAmountMax')?.value;

    if (dateFrom) query = query.gte('created_at', dateFrom + 'T00:00:00');
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
    if (paymentFilter) query = query.eq('payment_method', paymentFilter);
    if (amountMin) query = query.gte('total', parseFloat(amountMin));
    if (amountMax) query = query.lte('total', parseFloat(amountMax));

    query = query.range(from, to);

    const { data: orders, error, count } = await query;
    if (error) { showToast(error.message, 'error'); return; }

    // Load available delivery boys for the assignment dropdown
    const { data: dboys } = await db.from('delivery_boys').select('id, name, phone, is_available').eq('is_active', true);
    const dboyOptions = (dboys || []).map(d =>
        `<option value="${d.id}">${d.name} (${d.phone})${d.is_available ? '' : ' - Busy'}</option>`
    ).join('');

    // Update pending orders badge
    const { count: pendingCount } = await db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .neq('notes', 'In-store POS billing')
        .in('status', ['pending', 'confirmed', 'preparing']);
    const badge = document.getElementById('onlineOrdersBadge');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }

    const tbody = document.getElementById('onlineOrdersTable');
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><h4>No online orders found</h4></div></td></tr>';
        renderPagination('onlineOrdersPagination', 0, page, PAGE_SIZE, () => {});
        return;
    }

    // Bulk actions bar (owner only)
    renderBulkActions('onlineOrdersBulk', 'onlineOrdersTable', {
        onDelete: async () => {
            const ids = getSelectedIds('onlineOrdersTable');
            if (!ids.length) { showToast('Select orders first', 'error'); return; }
            if (!await toastConfirm(`Delete ${ids.length} order(s)?`)) return;
            for (const id of ids) { await db.from('order_items').delete().eq('order_id', id); await db.from('orders').delete().eq('id', id); }
            showToast(`${ids.length} order(s) deleted`);
            _triggerOnlineOrderLoad();
        },
        onExportCSV: () => exportOrdersData('csv', 'onlineOrdersTable'),
        onExportExcel: () => exportOrdersData('excel', 'onlineOrdersTable')
    });

    tbody.innerHTML = orders.map(o => {
        const addr = o.delivery_address || {};
        const addrText = addr.address || addr.area || addr.type || '-';
        return `
        <tr>
            ${isOwner() ? `<td><input type="checkbox" class="row-checkbox" value="${o.id}" onchange="updateBulkCount('onlineOrdersTable')" style="width:16px;height:16px;accent-color:var(--primary);"></td>` : ''}
            <td><strong>${o.order_number}</strong><br><span style="font-size:11px;color:var(--text-muted);">${formatDate(o.created_at)}</span></td>
            <td>
                <strong>${o.customers?.name || '-'}</strong><br>
                <span style="font-size:12px;color:var(--text-muted);">${o.customers?.phone || ''}</span>
            </td>
            <td style="max-width:180px;font-size:13px;">${addrText}</td>
            <td><strong>${formatCurrency(o.total)}</strong><br><span class="badge-status ${o.payment_status === 'paid' ? 'badge-active' : 'badge-low-stock'}">${o.payment_method.toUpperCase()}</span></td>
            <td>
                <select class="form-control" style="padding:4px 8px;font-size:12px;width:auto;" onchange="updateOnlineOrderStatus('${o.id}', this.value)">
                    ${['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'].map(s =>
                        `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>`
                    ).join('')}
                </select>
            </td>
            <td>
                ${o.delivery_boy_id && o.delivery_boys
                    ? `<div style="font-size:12px;margin-bottom:4px;">
                        <span class="badge-status badge-active"><i class="fas fa-motorcycle"></i> ${o.delivery_boys.name}</span>
                       </div>
                       <select class="form-control" style="padding:3px 6px;font-size:11px;width:auto;" onchange="assignDeliveryBoy('${o.id}', this.value)">
                           <option value="">Change delivery boy</option>
                           ${dboyOptions}
                       </select>`
                    : `<select class="form-control" style="padding:4px 8px;font-size:12px;width:auto;" onchange="assignDeliveryBoy('${o.id}', this.value)">
                           <option value="">-- Assign --</option>
                           ${dboyOptions}
                       </select>`
                }
            </td>
            <td style="white-space:nowrap;">
                <button class="btn btn-outline btn-sm" onclick="viewOrderDetails('${o.id}')" title="View"><i class="fas fa-eye"></i></button>
                <button class="btn btn-outline btn-sm" onclick="printOrderBill('${o.id}')" title="Print Bill"><i class="fas fa-print"></i></button>
            </td>
        </tr>
        `;
    }).join('');

    renderPagination('onlineOrdersPagination', count, page, PAGE_SIZE, (newPage) => {
        loadOnlineOrders(
            document.getElementById('onlineOrderSearch').value,
            document.getElementById('onlineOrderStatusFilter').value,
            newPage
        );
    });
}

// ===== UPDATE ONLINE ORDER STATUS =====
window.updateOnlineOrderStatus = async function(id, status) {
    const updateData = { status };
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
    if (status === 'cancelled') updateData.cancelled_at = new Date().toISOString();

    const { error } = await db.from('orders').update(updateData).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`Order ${status}!`);
    loadOnlineOrders(
        document.getElementById('onlineOrderSearch').value,
        document.getElementById('onlineOrderStatusFilter').value,
        onlineOrdersCurrentPage
    );
};

// ===== ASSIGN DELIVERY BOY =====
// Sets delivery_boy_id and moves order to "out_for_delivery" status
window.assignDeliveryBoy = async function(orderId, deliveryBoyId) {
    if (!deliveryBoyId) return;

    const { error } = await db.from('orders').update({
        delivery_boy_id: deliveryBoyId,
        status: 'out_for_delivery'
    }).eq('id', orderId);

    if (error) { showToast(error.message, 'error'); return; }

    // Mark delivery boy as busy so they don't get double-assigned
    await db.from('delivery_boys').update({ is_available: false }).eq('id', deliveryBoyId);

    showToast('Delivery boy assigned! Status → Out for Delivery');
    loadOnlineOrders(
        document.getElementById('onlineOrderSearch').value,
        document.getElementById('onlineOrderStatusFilter').value,
        onlineOrdersCurrentPage
    );
};

// ===== VIEW ORDER DETAILS =====
// Opens order details in a new popup window
window.viewOrderDetails = async function(id) {
    const { data: order } = await db.from('orders').select('*, customers(name, phone), order_items(*, products(name, image_url))').eq('id', id).single();
    if (!order) { showToast('Order not found', 'error'); return; }

    const items = (order.order_items || []).map(i =>
        `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>${formatCurrency(i.selling_price)}</td><td>${formatCurrency(i.total)}</td></tr>`
    ).join('');

    const detailHtml = `
        <div style="padding:20px;">
            <h3>Order #${order.order_number}</h3>
            <p><strong>Customer:</strong> ${order.customers?.name || '-'} (${order.customers?.phone || '-'})</p>
            <p><strong>Status:</strong> ${order.status} | <strong>Payment:</strong> ${order.payment_method.toUpperCase()} (${order.payment_status})</p>
            <p><strong>Date:</strong> ${formatDate(order.created_at)}</p>
            <hr style="margin:12px 0;">
            <table style="width:100%;"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${items}</tbody></table>
            <hr style="margin:12px 0;">
            <p><strong>Subtotal:</strong> ${formatCurrency(order.subtotal)} | <strong>Discount:</strong> ${formatCurrency(order.discount)} | <strong>GST:</strong> ${formatCurrency(order.gst_amount)}</p>
            <h3 style="color:var(--primary);">Total: ${formatCurrency(order.total)}</h3>
        </div>
    `;

    const win = window.open('', '_blank', 'width=500,height=600');
    win.document.write(`<html><head><title>Order ${order.order_number}</title><style>body{font-family:Poppins,sans-serif;font-size:13px;}table{width:100%;border-collapse:collapse;}th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #eee;}th{font-size:11px;text-transform:uppercase;color:#999;}h3{margin:0;}</style></head><body>${detailHtml}</body></html>`);
    win.document.close();
};

// ===== PRINT ORDER BILL =====
// Generates a printable invoice for an online order
window.printOrderBill = async function(id) {
    const { data: order } = await db
        .from('orders')
        .select('*, customers(name, phone), order_items(product_name, quantity, mrp, selling_price, total)')
        .eq('id', id).single();

    if (!order) { showToast('Order not found', 'error'); return; }

    const items = order.order_items || [];
    const addr = order.delivery_address || {};
    const addrText = order.is_pickup
        ? 'Pickup from Store'
        : `${addr.address || '-'}${addr.landmark ? ', ' + addr.landmark : ''} - ${addr.pincode || ''}`;

    const billHtml = `
        <html><head><style>
            body { font-family: monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 10px; }
            h2 { text-align: center; margin: 0 0 2px; font-size: 16px; }
            .sub { text-align: center; font-size: 10px; color: #666; margin-bottom: 8px; }
            hr { border: 1px dashed #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 2px 0; font-size: 11px; }
            .right { text-align: right; }
            .total { font-size: 14px; font-weight: bold; border-top: 2px solid #000; padding-top: 4px; }
            .info { font-size: 10px; color: #333; }
        </style></head><body>
        <h2>CHOICE KART</h2>
        <p class="sub">Smart Choice, Better Life<br>Jagtial, Telangana | Ph: 9666991993</p>
        <hr>
        <p class="info"><strong>Order:</strong> ${order.order_number}<br>
        <strong>Date:</strong> ${new Date(order.created_at).toLocaleString('en-IN')}<br>
        <strong>Customer:</strong> ${order.customers?.name || '-'} (${order.customers?.phone || '-'})<br>
        <strong>${order.is_pickup ? 'Pickup' : 'Deliver to'}:</strong> ${addrText}<br>
        <strong>Payment:</strong> ${order.payment_method.toUpperCase()} (${order.payment_status})</p>
        <hr>
        <table>
            <tr><td><b>Item</b></td><td class="right"><b>Qty</b></td><td class="right"><b>Amt</b></td></tr>
            ${items.map(i => `<tr><td>${i.product_name}</td><td class="right">${i.quantity}</td><td class="right">₹${Number(i.total).toFixed(2)}</td></tr>`).join('')}
        </table>
        <hr>
        <table>
            <tr><td>Subtotal</td><td class="right">₹${Number(order.subtotal).toFixed(2)}</td></tr>
            ${Number(order.discount) > 0 ? `<tr><td>Discount</td><td class="right">-₹${Number(order.discount).toFixed(2)}</td></tr>` : ''}
            ${Number(order.delivery_charge) > 0 ? `<tr><td>Delivery</td><td class="right">₹${Number(order.delivery_charge).toFixed(2)}</td></tr>` : ''}
            ${Number(order.gst_amount) > 0 ? `<tr><td>GST</td><td class="right">₹${Number(order.gst_amount).toFixed(2)}</td></tr>` : ''}
            <tr class="total"><td><b>TOTAL</b></td><td class="right"><b>₹${Number(order.total).toFixed(2)}</b></td></tr>
        </table>
        <hr>
        <p class="sub">Thank you for shopping at Choice Kart!<br>Visit us again.</p>
        </body></html>
    `;

    const printWindow = window.open('', '_blank', 'width=350,height=700');
    printWindow.document.write(billHtml);
    printWindow.document.close();
    printWindow.print();
};

// ===== ONLINE ORDERS SEARCH & FILTER =====
document.getElementById('onlineOrderSearch').addEventListener('input', (e) => {
    onlineOrdersCurrentPage = 1;
    loadOnlineOrders(e.target.value, document.getElementById('onlineOrderStatusFilter').value, 1);
});
document.getElementById('onlineOrderStatusFilter').addEventListener('change', (e) => {
    onlineOrdersCurrentPage = 1;
    loadOnlineOrders(document.getElementById('onlineOrderSearch').value, e.target.value, 1);
});

// ===== EXPORT ORDERS DATA (shared by orders + online orders) =====
async function exportOrdersData(format, tableId) {
    const ids = getSelectedIds(tableId);
    if (!ids.length) { showToast('Select orders to export', 'error'); return; }

    const { data: orders } = await db.from('orders')
        .select('order_number, total, subtotal, discount, gst_amount, payment_method, payment_status, is_pickup, notes, created_at, customers(name, phone), order_items(product_name, quantity, selling_price, total)')
        .in('id', ids);

    if (!orders || !orders.length) { showToast('No data found', 'error'); return; }

    const today = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
        const csv = 'Order #,Customer,Phone,Total,Discount,GST,Payment,Status,Type,Date\n' +
            orders.map(o => `${o.order_number},${o.customers?.name || '-'},${o.customers?.phone || '-'},${o.total},${o.discount || 0},${o.gst_amount || 0},${o.payment_method},${o.payment_status},${o.notes === 'In-store POS billing' ? 'POS' : 'Online'},${new Date(o.created_at).toLocaleString('en-IN')}`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `orders-${today}.csv`; a.click();
        showToast(`Exported ${orders.length} orders as CSV`);
    } else {
        let html = `<html><head><meta charset="UTF-8"><style>td,th{border:1px solid #ccc;padding:4px 8px;font-size:11px;}th{background:#059669;color:white;}</style></head><body>
        <h2>Choice Kart Orders (${today})</h2><table>
        <tr><th>Order #</th><th>Customer</th><th>Phone</th><th>Total</th><th>Discount</th><th>GST</th><th>Payment</th><th>Date</th></tr>`;
        orders.forEach(o => {
            html += `<tr><td>${o.order_number}</td><td>${o.customers?.name || '-'}</td><td>${o.customers?.phone || '-'}</td><td>${o.total}</td><td>${o.discount || 0}</td><td>${o.gst_amount || 0}</td><td>${o.payment_method}</td><td>${new Date(o.created_at).toLocaleString('en-IN')}</td></tr>`;
        });
        html += '</table></body></html>';
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `orders-${today}.xls`; a.click();
        showToast(`Exported ${orders.length} orders as Excel`);
    }
}
