// ============================================
// CHOICE KART Admin - POS Billing System
// ============================================
// In-store point-of-sale billing: product search, cart management,
// coupon application, sale completion, stock updates, and receipt printing.
// Depends on: db (supabase-config.js), utils.js, images.js

// Billing state
let billingCart = [];
let billingCoupon = null;
let billingDefaultGST = 0; // Fallback GST from store settings

/**
 * Initialize the billing section (called when navigating to billing).
 * Loads default GST from store settings.
 */
async function initBilling() {
    // Load default GST from store settings
    const { data } = await db.from('store_settings').select('value').eq('key', 'default_gst_percent').single();
    billingDefaultGST = Number(data?.value) || 0;
    renderBillingCart();
}

// ===== PRODUCT SEARCH FOR BILLING =====
// Searches by name, barcode, or brand with live results dropdown
document.getElementById('billingSearch').addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    const resultsDiv = document.getElementById('billingSearchResults');

    // Require at least 2 characters to search
    if (query.length < 2) {
        resultsDiv.style.display = 'none';
        return;
    }

    const { data: products } = await db
        .from('products')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,barcode.ilike.%${query}%,brand.ilike.%${query}%`)
        .limit(10);

    if (!products || products.length === 0) {
        resultsDiv.innerHTML = '<div style="padding:12px;color:var(--text-muted);text-align:center;">No products found</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    resultsDiv.innerHTML = products.map(p => `
        <div style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);"
             onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='white'"
             onclick="addToBilling('${p.id}')">
            ${p.image_url ? `<img src="${imgPath(p.image_url)}" style="width:36px;height:36px;border-radius:4px;object-fit:cover;">` : ''}
            <div style="flex:1;">
                <div style="font-weight:500;font-size:13px;">${p.name}</div>
                <div style="font-size:11px;color:var(--text-muted);">${p.brand || ''} · ${p.unit_value} ${p.unit} · Stock: ${p.stock_qty}</div>
            </div>
            <div style="font-weight:600;color:var(--primary);">${formatCurrency(p.selling_price)}</div>
        </div>
    `).join('');
    resultsDiv.style.display = 'block';
});

// Close search results dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#billingSearch') && !e.target.closest('#billingSearchResults')) {
        document.getElementById('billingSearchResults').style.display = 'none';
    }
});

// ===== ADD PRODUCT TO BILLING CART =====
// Increments qty if product already in cart, otherwise adds it
window.addToBilling = async function(productId) {
    const existing = billingCart.find(i => i.id === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        const { data: p } = await db.from('products').select('*').eq('id', productId).single();
        if (!p) return;
        billingCart.push({
            id: p.id,
            name: p.name,
            brand: p.brand,
            mrp: Number(p.mrp),
            price: Number(p.selling_price),
            gst_percent: Number(p.gst_percent) || billingDefaultGST,
            qty: 1,
            unit: p.unit,
            unit_value: p.unit_value
        });
    }

    document.getElementById('billingSearch').value = '';
    document.getElementById('billingSearchResults').style.display = 'none';
    renderBillingCart();
};

// ===== UPDATE ITEM QUANTITY =====
// change: +1 or -1. Removes item if qty drops to 0.
window.updateBillingQty = function(productId, change) {
    const item = billingCart.find(i => i.id === productId);
    if (!item) return;
    item.qty += change;
    if (item.qty <= 0) {
        billingCart = billingCart.filter(i => i.id !== productId);
    }
    renderBillingCart();
};

// ===== REMOVE ITEM FROM CART =====
window.removeBillingItem = function(productId) {
    billingCart = billingCart.filter(i => i.id !== productId);
    renderBillingCart();
};

// ===== RENDER BILLING CART =====
// Renders the items table and calculates subtotal, discount, GST, grand total
function renderBillingCart() {
    const tbody = document.getElementById('billingItems');

    if (billingCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">Search and add products to start billing</td></tr>';
        document.getElementById('billingSubtotal').textContent = '₹0';
        document.getElementById('billingDiscount').textContent = '-₹0';
        document.getElementById('billingGST').textContent = '₹0';
        document.getElementById('billingTotal').textContent = '₹0';
        return;
    }

    tbody.innerHTML = billingCart.map(item => `
        <tr>
            <td>
                <strong>${item.name}</strong>
                <div style="font-size:11px;color:var(--text-muted);">${item.brand || ''} · ${item.unit_value} ${item.unit}</div>
            </td>
            <td>${formatCurrency(item.price)}</td>
            <td>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button class="btn btn-outline btn-sm" onclick="updateBillingQty('${item.id}', -1)" style="width:28px;height:28px;padding:0;">−</button>
                    <span style="min-width:24px;text-align:center;font-weight:600;">${item.qty}</span>
                    <button class="btn btn-outline btn-sm" onclick="updateBillingQty('${item.id}', 1)" style="width:28px;height:28px;padding:0;">+</button>
                </div>
            </td>
            <td><strong>${formatCurrency(item.price * item.qty)}</strong></td>
            <td><button class="btn btn-danger btn-sm btn-icon" onclick="removeBillingItem('${item.id}')"><i class="fas fa-times"></i></button></td>
        </tr>
    `).join('');

    // Calculate totals
    const subtotal = billingCart.reduce((t, i) => t + i.mrp * i.qty, 0);        // Total at MRP
    const sellingTotal = billingCart.reduce((t, i) => t + i.price * i.qty, 0);   // Total at selling price
    let discount = subtotal - sellingTotal; // MRP discount

    // Apply coupon discount on top of MRP discount
    let couponDiscount = 0;
    if (billingCoupon) {
        if (billingCoupon.discount_type === 'percentage') {
            couponDiscount = sellingTotal * billingCoupon.discount_value / 100;
            if (billingCoupon.max_discount) couponDiscount = Math.min(couponDiscount, billingCoupon.max_discount);
        } else {
            couponDiscount = billingCoupon.discount_value;
        }
        discount += couponDiscount;
    }

    const afterDiscount = sellingTotal - couponDiscount;
    const gst = billingCart.reduce((t, i) => t + (i.price * i.qty * i.gst_percent / 100), 0);
    const cgst = gst / 2;
    const sgst = gst / 2;
    const grandTotal = afterDiscount + gst;

    document.getElementById('billingSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('billingDiscount').textContent = '-' + formatCurrency(discount);
    document.getElementById('billingGST').textContent = `${formatCurrency(gst)} (CGST ${formatCurrency(cgst)} + SGST ${formatCurrency(sgst)})`;
    document.getElementById('billingTotal').textContent = formatCurrency(grandTotal);
}

// ===== COMPLETE SALE =====
// Creates an order record, order items, updates stock, and clears the cart
document.getElementById('billingPayBtn').addEventListener('click', async () => {
    if (billingCart.length === 0) {
        showToast('Add products to the bill first', 'error');
        return;
    }

    const sellingTotal = billingCart.reduce((t, i) => t + i.price * i.qty, 0);
    const gst = billingCart.reduce((t, i) => t + (i.price * i.qty * i.gst_percent / 100), 0);
    let discount = billingCart.reduce((t, i) => t + (i.mrp - i.price) * i.qty, 0);

    // Add coupon discount
    let couponDiscount = 0;
    if (billingCoupon) {
        if (billingCoupon.discount_type === 'percentage') {
            couponDiscount = sellingTotal * billingCoupon.discount_value / 100;
            if (billingCoupon.max_discount) couponDiscount = Math.min(couponDiscount, billingCoupon.max_discount);
        } else {
            couponDiscount = billingCoupon.discount_value;
        }
        discount += couponDiscount;
    }

    const grandTotal = (sellingTotal - couponDiscount) + gst;

    // Create or find customer record based on phone number
    let customerId = null;
    const phone = document.getElementById('billingCustomerPhone').value.trim();
    if (phone) {
        const { data: existing } = await db.from('customers').select('id').eq('phone', phone).single();
        if (existing) {
            customerId = existing.id;
        } else {
            const { data: newCust } = await db.from('customers').insert({ phone, name: 'Walk-in' }).select('id').single();
            if (newCust) customerId = newCust.id;
        }
    } else {
        // Use a generic "walk-in" customer for no-phone sales
        const { data: walkin } = await db.from('customers').select('id').eq('phone', '0000000000').single();
        if (walkin) {
            customerId = walkin.id;
        } else {
            const { data: newWalkin } = await db.from('customers').insert({ phone: '0000000000', name: 'Walk-in Customer' }).select('id').single();
            if (newWalkin) customerId = newWalkin.id;
        }
    }

    if (!customerId) {
        showToast('Could not create customer record', 'error');
        return;
    }

    // Create the order (marked as delivered immediately for POS)
    const { data: order, error: orderErr } = await db.from('orders').insert({
        customer_id: customerId,
        status: 'delivered',
        payment_method: 'cod',
        payment_status: 'paid',
        delivery_address: { type: 'in-store' },
        subtotal: sellingTotal,
        discount: discount,
        gst_amount: gst,
        total: grandTotal,
        delivered_at: new Date().toISOString(),
        coupon_code: billingCoupon ? billingCoupon.code : null,
        notes: 'In-store POS billing'
    }).select('*').single();

    if (orderErr) {
        showToast('Error creating order: ' + orderErr.message, 'error');
        return;
    }

    // Increment coupon usage counter if a coupon was applied
    if (billingCoupon) {
        await db.from('coupons').update({ used_count: billingCoupon.used_count + 1 }).eq('id', billingCoupon.id);
    }

    // Insert order line items
    const items = billingCart.map(i => ({
        order_id: order.id,
        product_id: i.id,
        product_name: i.name,
        quantity: i.qty,
        unit: i.unit,
        unit_value: i.unit_value,
        mrp: i.mrp,
        selling_price: i.price,
        gst_percent: i.gst_percent,
        total: i.price * i.qty
    }));

    await db.from('order_items').insert(items);

    // Decrement stock for each product sold
    for (const item of billingCart) {
        await db.rpc('', {}).catch(() => {}); // skip if no RPC
        const { data: prod } = await db.from('products').select('stock_qty').eq('id', item.id).single();
        if (prod) {
            await db.from('products').update({ stock_qty: Math.max(0, prod.stock_qty - item.qty) }).eq('id', item.id);
        }
    }

    showToast(`Sale completed! Order #${order.order_number} — Total: ${formatCurrency(grandTotal)}`);

    // Reset billing state
    billingCart = [];
    billingCoupon = null;
    document.getElementById('billingCustomerPhone').value = '';
    document.getElementById('billingCoupon').value = '';
    document.getElementById('billingCouponStatus').innerHTML = '';
    renderBillingCart();
});

// ===== APPLY COUPON IN BILLING =====
// Validates coupon code, checks min order and usage limits
document.getElementById('billingApplyCoupon').addEventListener('click', async () => {
    const code = document.getElementById('billingCoupon').value.trim().toUpperCase();
    const statusEl = document.getElementById('billingCouponStatus');

    if (!code) { statusEl.innerHTML = '<span style="color:var(--danger);">Enter a coupon code</span>'; return; }

    const { data: coupon, error } = await db
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

    if (error || !coupon) {
        billingCoupon = null;
        statusEl.innerHTML = '<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Invalid coupon code</span>';
        renderBillingCart();
        return;
    }

    // Check minimum order amount
    const sellingTotal = billingCart.reduce((t, i) => t + i.price * i.qty, 0);
    if (coupon.min_order_amount && sellingTotal < coupon.min_order_amount) {
        statusEl.innerHTML = `<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Min order ${formatCurrency(coupon.min_order_amount)} required</span>`;
        return;
    }

    // Check if coupon has reached its usage limit
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        statusEl.innerHTML = '<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Coupon usage limit reached</span>';
        return;
    }

    billingCoupon = coupon;
    const discountText = coupon.discount_type === 'percentage' ? coupon.discount_value + '% off' : formatCurrency(coupon.discount_value) + ' off';
    statusEl.innerHTML = `<span style="color:var(--success);"><i class="fas fa-check-circle"></i> ${code} applied — ${discountText}!</span>`;
    renderBillingCart();
});

// ===== CLEAR BILLING =====
document.getElementById('billingClearBtn').addEventListener('click', async () => {
    if (billingCart.length > 0 && !await toastConfirm('Clear all items from the bill?', 'Yes, Clear')) return;
    billingCart = [];
    billingCoupon = null;
    document.getElementById('billingCustomerPhone').value = '';
    document.getElementById('billingCoupon').value = '';
    document.getElementById('billingCouponStatus').innerHTML = '';
    renderBillingCart();
});

// ===== PRINT BILL =====
// Generates a thermal-printer-friendly receipt in a popup window
document.getElementById('billingPrintBtn').addEventListener('click', () => {
    if (billingCart.length === 0) {
        showToast('Add products first', 'error');
        return;
    }

    const sellingTotal = billingCart.reduce((t, i) => t + i.price * i.qty, 0);
    const gst = billingCart.reduce((t, i) => t + (i.price * i.qty * i.gst_percent / 100), 0);
    const discount = billingCart.reduce((t, i) => t + (i.mrp - i.price) * i.qty, 0);

    const printContent = `
        <html><head><style>
            body { font-family: monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 10px; }
            h2 { text-align: center; margin: 0; } .sub { text-align: center; font-size: 10px; color: #666; }
            hr { border: 1px dashed #000; } table { width: 100%; border-collapse: collapse; }
            td { padding: 3px 0; font-size: 11px; } .right { text-align: right; }
            .total { font-size: 14px; font-weight: bold; border-top: 2px solid #000; padding-top: 5px; }
        </style></head><body>
        <h2>CHOICE KART</h2>
        <p class="sub">Smart Choice, Better Life<br>Jagtial, Telangana | Ph: 9666991993</p>
        <hr>
        <p>Date: ${new Date().toLocaleString('en-IN')}</p>
        <hr>
        <table>
            <tr><td><b>Item</b></td><td class="right"><b>Qty</b></td><td class="right"><b>Amount</b></td></tr>
            ${billingCart.map(i => `<tr><td>${i.name}</td><td class="right">${i.qty}</td><td class="right">₹${(i.price * i.qty).toFixed(2)}</td></tr>`).join('')}
        </table>
        <hr>
        <table>
            <tr><td>Subtotal</td><td class="right">₹${sellingTotal.toFixed(2)}</td></tr>
            ${discount > 0 ? `<tr><td>Discount</td><td class="right">-₹${discount.toFixed(2)}</td></tr>` : ''}
            ${gst > 0 ? `<tr><td>GST</td><td class="right">₹${gst.toFixed(2)}</td></tr>` : ''}
            <tr class="total"><td><b>TOTAL</b></td><td class="right"><b>₹${(sellingTotal + gst).toFixed(2)}</b></td></tr>
        </table>
        <hr>
        <p class="sub">Thank you for shopping at Choice Kart!<br>Visit us again.</p>
        </body></html>
    `;

    const printWindow = window.open('', '_blank', 'width=350,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
});
