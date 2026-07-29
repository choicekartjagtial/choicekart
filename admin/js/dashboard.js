// ============================================
// CHOICE KART Admin - Dashboard Stats
// ============================================
// Loads and displays the main dashboard: product/order/customer counts,
// low stock alerts, recent orders table, and pending orders badge.
// Depends on: db (supabase-config.js), utils.js

async function loadDashboard() {
    if (!db) return;

    // Fetch counts for products, orders, and customers in parallel
    const [products, orders, customers] = await Promise.all([
        db.from('products').select('id, stock_qty, low_stock_threshold', { count: 'exact' }),
        db.from('orders').select('id', { count: 'exact' }),
        db.from('customers').select('id', { count: 'exact' })
    ]);

    // Update stat cards
    document.getElementById('statProducts').textContent = products.count || 0;
    document.getElementById('statOrders').textContent = orders.count || 0;
    document.getElementById('statCustomers').textContent = customers.count || 0;

    // Calculate low stock items (stock at or below threshold)
    const lowStock = (products.data || []).filter(p => p.stock_qty <= p.low_stock_threshold).length;
    document.getElementById('statLowStock').textContent = lowStock;

    // Fetch 5 most recent orders with customer info for the table
    const { data: recentOrders } = await db
        .from('orders')
        .select('*, customers(name, phone)')
        .order('created_at', { ascending: false })
        .limit(5);

    const tbody = document.getElementById('recentOrdersTable');
    if (recentOrders && recentOrders.length > 0) {
        tbody.innerHTML = recentOrders.map(o => `
            <tr>
                <td><strong>${o.order_number}</strong></td>
                <td>${o.customers?.name || o.customers?.phone || '-'}</td>
                <td>${formatCurrency(o.total)}</td>
                <td><span class="badge-status badge-${o.status === 'delivered' ? 'active' : o.status === 'cancelled' ? 'inactive' : 'low-stock'}">${o.status}</span></td>
                <td>${formatDate(o.created_at)}</td>
            </tr>
        `).join('');
    }

    // Show pending orders count as a badge on the Orders nav item
    const { count: pendingCount } = await db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed']);
    const badge = document.getElementById('pendingOrdersBadge');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline';
    }
}
