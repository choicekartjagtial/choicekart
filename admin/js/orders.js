// ============================================
// CHOICE KART Admin - Orders & Online Orders
// ============================================
// Handles order listing, status updates, search/filter,
// online orders with delivery assignment, and order detail view.
// Depends on: db (supabase-config.js), utils.js

// ===== LOAD ORDERS (All orders) =====
async function loadOrders(search = '', statusFilter = '') {
    if (!db) return;

    let query = db
        .from('orders')
        .select('*, customers(name, phone), order_items(id)')
        .order('created_at', { ascending: false });

    if (statusFilter) query = query.eq('status', statusFilter);
    if (search) query = query.or(`order_number.ilike.%${search}%`);

    const { data: orders, error } = await query;
    if (error) { showToast(error.message, 'error'); return; }

    const tbody = document.getElementById('ordersTable');
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-inbox"></i><h4>No orders found</h4></div></td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(o => `
        <tr>
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
    loadOrders(e.target.value, document.getElementById('orderStatusFilter').value);
});
document.getElementById('orderStatusFilter').addEventListener('change', (e) => {
    loadOrders(document.getElementById('orderSearch').value, e.target.value);
});

// ===== LOAD ONLINE ORDERS =====
// Shows only non-POS orders with delivery assignment capability
async function loadOnlineOrders(search = '', statusFilter = 'pending') {
    if (!db) return;

    let query = db
        .from('orders')
        .select('*, customers(name, phone), delivery_boys(name, phone)')
        .neq('notes', 'In-store POS billing')
        .order('created_at', { ascending: false });

    if (statusFilter) query = query.eq('status', statusFilter);
    if (search) query = query.or(`order_number.ilike.%${search}%`);

    const { data: orders, error } = await query;
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
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const addr = o.delivery_address || {};
        const addrText = addr.address || addr.area || addr.type || '-';
        return `
        <tr>
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
                <select class="form-control" style="padding:4px 8px;font-size:12px;width:auto;" onchange="assignDeliveryBoy('${o.id}', this.value)">
                    <option value="">-- Assign --</option>
                    ${dboyOptions}
                </select>
                ${o.delivery_boys ? `<div style="font-size:11px;color:var(--success);margin-top:4px;"><i class="fas fa-check-circle"></i> ${o.delivery_boys.name}</div>` : ''}
            </td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="viewOrderDetails('${o.id}')" title="View Details"><i class="fas fa-eye"></i></button>
            </td>
        </tr>
        `;
    }).join('');
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
        document.getElementById('onlineOrderStatusFilter').value
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
        document.getElementById('onlineOrderStatusFilter').value
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

// ===== ONLINE ORDERS SEARCH & FILTER =====
document.getElementById('onlineOrderSearch').addEventListener('input', (e) => {
    loadOnlineOrders(e.target.value, document.getElementById('onlineOrderStatusFilter').value);
});
document.getElementById('onlineOrderStatusFilter').addEventListener('change', (e) => {
    loadOnlineOrders(document.getElementById('onlineOrderSearch').value, e.target.value);
});
