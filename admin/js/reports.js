// ============================================
// CHOICE KART Admin - Sales & Revenue Analytics
// ============================================
// Loads sales reports by period (today, week, month, year, custom).
// Shows revenue stats, payment breakdown, order types, top products,
// daily breakdown, and CSV export.
// Depends on: db (supabase-config.js), utils.js

// ===== LOAD REPORTS =====
async function loadReports() {
    if (!db) return;

    const period = document.getElementById('reportPeriod').value;
    let fromDate, toDate = new Date();
    toDate.setHours(23, 59, 59, 999);

    // Calculate date range based on selected period
    const now = new Date();
    switch (period) {
        case 'today':
            fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'yesterday':
            fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            break;
        case 'week':
            fromDate = new Date(now); fromDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'year':
            fromDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'custom':
            const f = document.getElementById('reportDateFrom').value;
            const t = document.getElementById('reportDateTo').value;
            if (!f || !t) { showToast('Select date range', 'error'); return; }
            fromDate = new Date(f);
            toDate = new Date(t); toDate.setHours(23, 59, 59, 999);
            break;
    }

    // Fetch orders in date range (excluding cancelled)
    const { data: orders, error } = await db
        .from('orders')
        .select('*, order_items(product_name, quantity, selling_price, total)')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString())
        .in('status', ['delivered', 'confirmed', 'preparing', 'out_for_delivery', 'pending']);

    if (error) { showToast(error.message, 'error'); return; }

    const allOrders = orders || [];
    // Revenue calculations use only delivered orders
    const deliveredOrders = allOrders.filter(o => o.status === 'delivered');

    // ===== Revenue stat cards =====
    const totalRevenue = deliveredOrders.reduce((t, o) => t + Number(o.total), 0);
    const totalOrders = deliveredOrders.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalDiscount = deliveredOrders.reduce((t, o) => t + Number(o.discount || 0), 0);

    document.getElementById('reportRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('reportOrderCount').textContent = totalOrders;
    document.getElementById('reportAvgOrder').textContent = formatCurrency(avgOrder);
    document.getElementById('reportDiscount').textContent = formatCurrency(totalDiscount);

    // ===== Payment methods breakdown =====
    const paymentMap = {};
    deliveredOrders.forEach(o => {
        const method = o.payment_method.toUpperCase();
        paymentMap[method] = (paymentMap[method] || 0) + Number(o.total);
    });

    const paymentEl = document.getElementById('reportPaymentMethods');
    if (Object.keys(paymentMap).length === 0) {
        paymentEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No data</p>';
    } else {
        paymentEl.innerHTML = Object.entries(paymentMap).map(([method, amount]) => `
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
                <span><i class="fas fa-${method === 'COD' ? 'money-bill-wave' : method === 'UPI' ? 'mobile-alt' : 'credit-card'}" style="color:var(--primary);margin-right:8px;"></i>${method}</span>
                <strong>${formatCurrency(amount)}</strong>
            </div>
        `).join('');
    }

    // ===== Order types: online vs in-store POS =====
    const onlineOrders = deliveredOrders.filter(o => o.notes !== 'In-store POS billing');
    const inStoreOrders = deliveredOrders.filter(o => o.notes === 'In-store POS billing');
    const onlineRevenue = onlineOrders.reduce((t, o) => t + Number(o.total), 0);
    const inStoreRevenue = inStoreOrders.reduce((t, o) => t + Number(o.total), 0);

    document.getElementById('reportOrderTypes').innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);">
            <span><i class="fas fa-globe" style="color:var(--info);margin-right:8px;"></i>Online Orders</span>
            <div><strong>${onlineOrders.length}</strong> orders &middot; <strong>${formatCurrency(onlineRevenue)}</strong></div>
        </div>
        <div style="display:flex;justify-content:space-between;padding:12px 0;">
            <span><i class="fas fa-store" style="color:var(--accent);margin-right:8px;"></i>In-Store POS</span>
            <div><strong>${inStoreOrders.length}</strong> orders &middot; <strong>${formatCurrency(inStoreRevenue)}</strong></div>
        </div>
    `;

    // ===== Top selling products (by revenue) =====
    const productSales = {};
    deliveredOrders.forEach(o => {
        (o.order_items || []).forEach(item => {
            const name = item.product_name;
            if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0 };
            productSales[name].qty += item.quantity;
            productSales[name].revenue += Number(item.total);
        });
    });

    const topProducts = Object.entries(productSales)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10);

    const topProdsEl = document.getElementById('reportTopProducts');
    if (topProducts.length === 0) {
        topProdsEl.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">No sales data</td></tr>';
    } else {
        topProdsEl.innerHTML = topProducts.map(([name, data], i) => `
            <tr>
                <td><strong>${i + 1}.</strong> ${name}</td>
                <td>${data.qty}</td>
                <td>${formatCurrency(data.revenue)}</td>
            </tr>
        `).join('');
    }

    // ===== Daily revenue breakdown =====
    const dailyMap = {};
    deliveredOrders.forEach(o => {
        const day = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        if (!dailyMap[day]) dailyMap[day] = { orders: 0, revenue: 0 };
        dailyMap[day].orders += 1;
        dailyMap[day].revenue += Number(o.total);
    });

    const dailyEl = document.getElementById('reportDailyBreakdown');
    const dailyEntries = Object.entries(dailyMap).reverse();
    if (dailyEntries.length === 0) {
        dailyEl.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">No data</td></tr>';
    } else {
        dailyEl.innerHTML = dailyEntries.map(([date, data]) => `
            <tr>
                <td>${date}</td>
                <td>${data.orders}</td>
                <td><strong>${formatCurrency(data.revenue)}</strong></td>
            </tr>
        `).join('');
    }
}

// ===== PERIOD SELECTOR =====
// Show/hide custom date range inputs when "Custom Range" is selected
document.getElementById('reportPeriod').addEventListener('change', (e) => {
    const isCustom = e.target.value === 'custom';
    document.getElementById('reportDateFrom').style.display = isCustom ? '' : 'none';
    document.getElementById('reportDateTo').style.display = isCustom ? '' : 'none';
    if (!isCustom) loadReports();
});

// ===== REFRESH BUTTON =====
document.getElementById('reportRefreshBtn').addEventListener('click', () => loadReports());

// ===== EXPORT CSV =====
// Downloads delivered orders as a CSV file
document.getElementById('reportExportBtn').addEventListener('click', async () => {
    const period = document.getElementById('reportPeriod').value;
    let fromDate, toDate = new Date();
    const now = new Date();
    switch (period) {
        case 'today': fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case 'week': fromDate = new Date(now); fromDate.setDate(now.getDate() - 7); break;
        case 'month': fromDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'year': fromDate = new Date(now.getFullYear(), 0, 1); break;
        default: fromDate = new Date(now); fromDate.setDate(now.getDate() - 7);
    }

    const { data: orders } = await db
        .from('orders')
        .select('order_number, total, discount, payment_method, status, notes, created_at')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString())
        .eq('status', 'delivered');

    if (!orders || orders.length === 0) { showToast('No data to export', 'error'); return; }

    // Build CSV content and trigger download
    const csv = 'Order #,Total,Discount,Payment,Type,Date\n' +
        orders.map(o => `${o.order_number},${o.total},${o.discount || 0},${o.payment_method},${o.notes === 'In-store POS billing' ? 'In-Store' : 'Online'},${new Date(o.created_at).toLocaleDateString('en-IN')}`).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `choicekart-sales-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported!');
});
