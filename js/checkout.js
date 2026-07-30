// ============================================
// CHOICE KART — Checkout Flow
// Address → Payment → Order Confirmation
// ============================================
// Dependencies: db, getCustomer(), isLoggedIn(), cart (from main.js),
//               showToast(), getCartTotal(), getCartSavings(), getCartCount()
//
// Flow:
//   1. Auth check → if not logged in, open login modal first
//   2. Step 1: Delivery address (or pickup)
//   3. Step 2: Order summary + payment method (COD / Razorpay)
//   4. Step 3: Order confirmation
// ============================================

// ===== CHECKOUT STATE =====
let checkoutStep = 1;
let selectedAddress = null;   // { address, pincode, landmark, city, state }
let isPickup = false;
let deliveryCharge = 0;
let razorpayKeyId = '';       // Loaded from store_settings
let codEnabled = true;        // COD toggle from store_settings

// Store coordinates (Jagtial)
const STORE_LAT = 18.7915;
const STORE_LNG = 78.9126;

// ===== OPEN CHECKOUT =====
/**
 * Entry point — called from "Proceed to Checkout" button.
 * Checks auth, then opens the checkout modal.
 */
function openCheckout() {
    // Check if cart is empty
    if (getCartCount() === 0) {
        showToast('Your cart is empty. Add some products first!', 'error');
        return;
    }

    // Check if logged in
    if (!isLoggedIn()) {
        window._pendingCheckout = true; // Flag to open checkout after login
        openLoginModal();
        return;
    }

    // Close cart sidebar first
    closeCart();

    // Reset state
    checkoutStep = 1;
    selectedAddress = null;
    isPickup = false;
    deliveryCharge = 0;

    // Load payment settings
    loadPaymentSettings();

    // Show checkout modal
    document.getElementById('checkout-overlay').classList.add('active');
    document.getElementById('checkout-modal').classList.add('active');
    document.body.style.overflow = 'hidden';

    renderCheckoutStep();
}

/** Close checkout modal */
function closeCheckoutModal() {
    document.getElementById('checkout-overlay').classList.remove('active');
    document.getElementById('checkout-modal').classList.remove('active');
    document.body.style.overflow = '';
}

/** Load payment settings from store_settings */
async function loadPaymentSettings() {
    const { data } = await db.from('store_settings').select('key, value')
        .in('key', ['razorpay_key_id', 'cod_enabled']);
    if (data) {
        data.forEach(s => {
            if (s.key === 'razorpay_key_id') razorpayKeyId = s.value || '';
            if (s.key === 'cod_enabled') codEnabled = s.value !== 'false';
        });
    }
}

// ===== RENDER CHECKOUT STEPS =====
function renderCheckoutStep() {
    const body = document.getElementById('checkout-body');
    const title = document.getElementById('checkout-title');
    const progress = document.getElementById('checkout-progress');
    const backBtn = document.getElementById('checkout-back');

    // Progress bar
    const steps = ['Address', 'Payment', 'Confirmation'];
    progress.innerHTML = steps.map((s, i) => `
        <div class="cp-step ${i + 1 <= checkoutStep ? 'active' : ''} ${i + 1 < checkoutStep ? 'done' : ''}">
            <div class="cp-dot">${i + 1 < checkoutStep ? '<i class="fas fa-check"></i>' : i + 1}</div>
            <span>${s}</span>
        </div>
        ${i < steps.length - 1 ? '<div class="cp-line ' + (i + 1 < checkoutStep ? 'active' : '') + '"></div>' : ''}
    `).join('');

    // Back button visibility
    backBtn.style.display = checkoutStep > 1 && checkoutStep < 3 ? 'block' : 'none';
    backBtn.onclick = () => { checkoutStep--; renderCheckoutStep(); };

    if (checkoutStep === 1) {
        title.textContent = 'Delivery Address';
        renderAddressStep(body);
    } else if (checkoutStep === 2) {
        title.textContent = 'Order Summary & Payment';
        renderPaymentStep(body);
    } else if (checkoutStep === 3) {
        title.textContent = 'Order Confirmed!';
        renderConfirmation(body);
    }
}

// ===== STEP 1: ADDRESS =====
async function renderAddressStep(container) {
    const customer = getCustomer();
    const savedAddresses = customer?.addresses || [];

    // Load service areas for pincode validation
    const { data: serviceAreas } = await db.from('service_areas').select('pincode, area_name').eq('is_active', true);
    const validPincodes = (serviceAreas || []).map(s => s.pincode);

    let html = '';

    // Saved addresses
    if (savedAddresses.length > 0) {
        html += `<div style="margin-bottom:20px;">
            <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#374151;">Saved Addresses</h4>
            ${savedAddresses.map((addr, i) => `
                <div class="checkout-address-card ${selectedAddress === addr ? 'selected' : ''}" onclick="selectSavedAddress(${i})">
                    <div style="font-weight:600;font-size:14px;">${addr.address}</div>
                    <div style="font-size:12px;color:#6B7280;margin-top:4px;">
                        ${addr.landmark ? addr.landmark + ', ' : ''}${addr.city || 'Jagtial'} - ${addr.pincode}
                    </div>
                </div>
            `).join('')}
        </div>`;
    }

    // New address form
    html += `
        <div style="margin-bottom:16px;">
            <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;color:#374151;">
                ${savedAddresses.length > 0 ? 'Or Add New Address' : 'Enter Delivery Address'}
            </h4>
            <textarea id="checkoutAddress" placeholder="Full address (house no, street, area...)"
                style="width:100%;padding:12px;border:2px solid #E5E7EB;border-radius:12px;font-size:14px;font-family:inherit;resize:vertical;min-height:70px;outline:none;"
                onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#E5E7EB'"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Pincode *</label>
                <input type="text" id="checkoutPincode" maxlength="6" placeholder="6-digit pincode"
                    style="width:100%;padding:12px;border:2px solid #E5E7EB;border-radius:12px;font-size:14px;font-family:inherit;outline:none;"
                    onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#E5E7EB'">
            </div>
            <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Landmark</label>
                <input type="text" id="checkoutLandmark" placeholder="Near..."
                    style="width:100%;padding:12px;border:2px solid #E5E7EB;border-radius:12px;font-size:14px;font-family:inherit;outline:none;"
                    onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#E5E7EB'">
            </div>
        </div>
        <div id="deliveryStatus" style="margin-bottom:16px;"></div>
    `;

    // Pickup option
    html += `
        <div style="border-top:1px solid #E5E7EB;padding-top:16px;margin-bottom:20px;">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;font-weight:500;">
                <input type="checkbox" id="pickupToggle" onchange="togglePickup()" style="width:18px;height:18px;accent-color:#059669;">
                <i class="fas fa-store" style="color:#059669;"></i>
                Pick up from store (no delivery charge)
            </label>
            <p style="font-size:12px;color:#6B7280;margin-top:6px;margin-left:34px;">
                Jagtial, Telangana | Mon-Sat: 9AM - 7PM
            </p>
        </div>
    `;

    // Continue button
    html += `
        <button onclick="submitAddress()" id="addressContinueBtn"
            style="width:100%;padding:14px;background:linear-gradient(135deg,#059669,#10B981);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;">
            Continue to Payment <i class="fas fa-arrow-right"></i>
        </button>
    `;

    container.innerHTML = html;

    // Store valid pincodes for validation
    window._validPincodes = validPincodes;
}

/** Select a saved address */
window.selectSavedAddress = function(index) {
    const customer = getCustomer();
    const addr = customer?.addresses?.[index];
    if (!addr) return;

    selectedAddress = addr;
    isPickup = false;

    // Highlight selected
    document.querySelectorAll('.checkout-address-card').forEach((c, i) => {
        c.classList.toggle('selected', i === index);
    });

    // Calculate delivery charge for this pincode
    checkPincodeDelivery(addr.pincode);
};

/** Toggle pickup mode */
window.togglePickup = function() {
    isPickup = document.getElementById('pickupToggle').checked;
    const statusDiv = document.getElementById('deliveryStatus');
    if (isPickup) {
        deliveryCharge = 0;
        statusDiv.innerHTML = `
            <div style="background:#ECFDF5;border:1px solid #A7F3D0;padding:12px;border-radius:10px;display:flex;align-items:center;gap:10px;">
                <i class="fas fa-check-circle" style="color:#059669;font-size:18px;"></i>
                <div>
                    <div style="font-weight:600;font-size:13px;color:#065F46;">Pickup selected — No delivery charge</div>
                    <div style="font-size:12px;color:#6B7280;">We'll pack your items. Pick up when ready!</div>
                </div>
            </div>
        `;
    } else {
        statusDiv.innerHTML = '';
    }
};

/** Check if pincode is serviceable and get delivery charge */
async function checkPincodeDelivery(pincode) {
    const statusDiv = document.getElementById('deliveryStatus');
    if (!pincode || pincode.length !== 6) {
        statusDiv.innerHTML = '';
        return;
    }

    const validPincodes = window._validPincodes || [];

    if (validPincodes.length > 0 && !validPincodes.includes(pincode)) {
        // Not serviceable
        deliveryCharge = 0;
        statusDiv.innerHTML = `
            <div style="background:#FEF2F2;border:1px solid #FECACA;padding:12px;border-radius:10px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <i class="fas fa-exclamation-circle" style="color:#EF4444;font-size:18px;"></i>
                    <span style="font-weight:600;font-size:13px;color:#991B1B;">Delivery not available for this pincode</span>
                </div>
                <p style="font-size:12px;color:#6B7280;margin-bottom:8px;">We currently deliver only within Jagtial and nearby areas.</p>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:500;color:#059669;">
                    <input type="checkbox" onchange="document.getElementById('pickupToggle').checked=true;togglePickup();" style="accent-color:#059669;">
                    Pick up from store instead?
                </label>
            </div>
        `;
        return;
    }

    // Serviceable — get delivery charge from slabs
    const { data: slabs } = await db.from('delivery_charges').select('*').eq('is_active', true).order('min_distance_km');

    if (slabs && slabs.length > 0) {
        // Find applicable charge based on pincode proximity
        const mainPincodes = ['505327', '505326']; // Jagtial main — uses first slab
        if (mainPincodes.includes(pincode)) {
            deliveryCharge = Number(slabs[0].charge);
        } else {
            deliveryCharge = slabs.length > 1 ? Number(slabs[1].charge) : Number(slabs[0].charge);
        }

        // Check free_above_amount from all slabs — if cart total exceeds any, delivery is free
        const cartTotal = getCartTotal();
        for (const slab of slabs) {
            if (slab.free_above_amount && Number(slab.free_above_amount) > 0 && cartTotal >= Number(slab.free_above_amount)) {
                deliveryCharge = 0;
                break;
            }
        }
    } else {
        // No slabs configured in admin — free delivery
        deliveryCharge = 0;
    }

    const chargeText = deliveryCharge === 0 ? 'FREE Delivery!' : `Delivery charge: ₹${deliveryCharge}`;
    const chargeColor = deliveryCharge === 0 ? '#059669' : '#F59E0B';

    statusDiv.innerHTML = `
        <div style="background:#ECFDF5;border:1px solid #A7F3D0;padding:12px;border-radius:10px;display:flex;align-items:center;gap:10px;">
            <i class="fas fa-check-circle" style="color:#059669;font-size:18px;"></i>
            <div>
                <div style="font-weight:600;font-size:13px;color:#065F46;">Delivery available!</div>
                <div style="font-size:13px;color:${chargeColor};font-weight:600;">${chargeText}</div>
            </div>
        </div>
    `;
}

/** Validate and submit address, move to payment step */
async function submitAddress() {
    if (isPickup) {
        selectedAddress = {
            address: 'Pickup from Choice Kart Store',
            pincode: '505327',
            landmark: '',
            city: 'Jagtial',
            state: 'Telangana'
        };
        deliveryCharge = 0;
        checkoutStep = 2;
        renderCheckoutStep();
        return;
    }

    // If no saved address selected, use form fields
    if (!selectedAddress) {
        const address = document.getElementById('checkoutAddress')?.value.trim();
        const pincode = document.getElementById('checkoutPincode')?.value.trim();
        const landmark = document.getElementById('checkoutLandmark')?.value.trim();

        if (!address) { showToast('Please enter your delivery address', 'error'); return; }
        if (!pincode || pincode.length !== 6) { showToast('Please enter a valid 6-digit pincode', 'error'); return; }

        // Check serviceability
        const validPincodes = window._validPincodes || [];
        if (validPincodes.length > 0 && !validPincodes.includes(pincode)) {
            showToast('Delivery not available for this pincode. Try pickup option.', 'error');
            return;
        }

        selectedAddress = { address, pincode, landmark, city: 'Jagtial', state: 'Telangana' };

        // Calculate delivery charge
        await checkPincodeDelivery(pincode);

        // Save address to customer record
        const customer = getCustomer();
        if (customer) {
            const addresses = customer.addresses || [];
            // Check if this address already exists
            const exists = addresses.some(a => a.pincode === pincode && a.address === address);
            if (!exists) {
                addresses.push(selectedAddress);
                await db.from('customers').update({ addresses }).eq('id', customer.id);
                // Update local session
                customer.addresses = addresses;
                saveCustomerSession(customer);
            }
        }
    }

    checkoutStep = 2;
    renderCheckoutStep();
}

// ===== STEP 2: PAYMENT =====
function renderPaymentStep(container) {
    const subtotal = getCartTotal();
    const savings = getCartSavings();
    const total = subtotal + deliveryCharge;

    let html = `
        <!-- Order Summary -->
        <div style="background:#F9FAFB;border-radius:12px;padding:16px;margin-bottom:20px;">
            <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;">Order Summary</h4>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;">
                <div style="display:flex;justify-content:space-between;">
                    <span style="color:#6B7280;">Items (${getCartCount()})</span>
                    <span>₹${subtotal.toLocaleString('en-IN')}</span>
                </div>
                ${savings > 0 ? `<div style="display:flex;justify-content:space-between;color:#059669;">
                    <span>You Save</span>
                    <span>-₹${savings.toLocaleString('en-IN')}</span>
                </div>` : ''}
                <div style="display:flex;justify-content:space-between;">
                    <span style="color:#6B7280;">${isPickup ? 'Pickup' : 'Delivery'}</span>
                    <span style="color:${deliveryCharge === 0 ? '#059669' : 'inherit'};font-weight:600;">
                        ${deliveryCharge === 0 ? 'FREE' : '₹' + deliveryCharge}
                    </span>
                </div>
                <div style="border-top:1px solid #E5E7EB;padding-top:8px;margin-top:4px;display:flex;justify-content:space-between;font-size:16px;font-weight:700;">
                    <span>Total</span>
                    <span style="color:#059669;">₹${total.toLocaleString('en-IN')}</span>
                </div>
            </div>
        </div>

        <!-- Delivery Address -->
        <div style="background:#F9FAFB;border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h4 style="font-size:14px;font-weight:600;">${isPickup ? 'Pickup' : 'Deliver to'}</h4>
                <span onclick="checkoutStep=1;renderCheckoutStep();" style="color:#059669;font-size:12px;cursor:pointer;font-weight:600;">Change</span>
            </div>
            <div style="font-size:13px;color:#4B5563;">
                <i class="fas fa-${isPickup ? 'store' : 'map-marker-alt'}" style="color:#059669;margin-right:6px;"></i>
                ${selectedAddress.address}${selectedAddress.landmark ? ', ' + selectedAddress.landmark : ''} - ${selectedAddress.pincode}
            </div>
        </div>

        <!-- Payment Methods -->
        <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;">Select Payment Method</h4>
    `;

    // Determine default payment method
    const defaultMethod = codEnabled ? 'cod' : (razorpayKeyId ? 'online' : 'cod');

    // COD option (only if enabled in admin settings)
    if (codEnabled) {
        html += `
        <div class="checkout-payment-card ${defaultMethod === 'cod' ? 'selected' : ''}" onclick="selectPaymentMethod('cod', this)">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:44px;height:44px;background:#FEF3C7;border-radius:12px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-money-bill-wave" style="color:#F59E0B;font-size:18px;"></i>
                </div>
                <div>
                    <div style="font-weight:600;font-size:14px;">Cash on Delivery</div>
                    <div style="font-size:12px;color:#6B7280;">Pay when your order arrives</div>
                </div>
            </div>
            <i class="fas fa-${defaultMethod === 'cod' ? 'check-circle' : 'circle'}" style="color:${defaultMethod === 'cod' ? '#059669' : '#D1D5DB'};font-size:18px;"></i>
        </div>
        `;
    }

    // Online payment option
    if (razorpayKeyId) {
        html += `
            <div class="checkout-payment-card ${defaultMethod === 'online' ? 'selected' : ''}" onclick="selectPaymentMethod('online', this)">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:44px;height:44px;background:#DBEAFE;border-radius:12px;display:flex;align-items:center;justify-content:center;">
                        <i class="fas fa-credit-card" style="color:#3B82F6;font-size:18px;"></i>
                    </div>
                    <div>
                        <div style="font-weight:600;font-size:14px;">Pay Online</div>
                        <div style="font-size:12px;color:#6B7280;">UPI, Cards, Net Banking</div>
                    </div>
                </div>
                <i class="fas fa-${defaultMethod === 'online' ? 'check-circle' : 'circle'}" style="color:${defaultMethod === 'online' ? '#059669' : '#D1D5DB'};font-size:18px;"></i>
            </div>
        `;
    } else {
        // Payment gateway not configured — show Coming Soon
        html += `
            <div class="checkout-payment-card" style="opacity:0.6;cursor:default;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:44px;height:44px;background:#DBEAFE;border-radius:12px;display:flex;align-items:center;justify-content:center;">
                        <i class="fas fa-credit-card" style="color:#3B82F6;font-size:18px;"></i>
                    </div>
                    <div>
                        <div style="font-weight:600;font-size:14px;">Pay Online</div>
                        <div style="font-size:12px;color:#6B7280;">UPI, Cards, Net Banking</div>
                    </div>
                </div>
                <span style="font-size:10px;font-weight:700;color:#F59E0B;background:#FEF3C7;padding:3px 10px;border-radius:20px;">COMING SOON</span>
            </div>
        `;
    }

    html += `
        <input type="hidden" id="selectedPaymentMethod" value="${defaultMethod}">

        <button onclick="placeOrder()" id="placeOrderBtn"
            style="width:100%;padding:15px;background:linear-gradient(135deg,#059669,#10B981);color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:20px;box-shadow:0 4px 14px rgba(5,150,105,0.3);">
            ${isPickup ? 'Confirm Pickup Order' : 'Place Order'} — ₹${total.toLocaleString('en-IN')}
        </button>
    `;

    container.innerHTML = html;
}

/** Select payment method */
window.selectPaymentMethod = function(method, el) {
    document.getElementById('selectedPaymentMethod').value = method;
    document.querySelectorAll('.checkout-payment-card').forEach(c => {
        c.classList.remove('selected');
        const icon = c.querySelector('.fa-check-circle, .fa-circle');
        if (icon) { icon.className = 'fas fa-circle'; icon.style.color = '#D1D5DB'; }
    });
    el.classList.add('selected');
    const icon = el.querySelector('.fa-check-circle, .fa-circle');
    if (icon) { icon.className = 'fas fa-check-circle'; icon.style.color = '#059669'; }
};

// ===== PLACE ORDER =====
async function placeOrder() {
    const paymentMethod = document.getElementById('selectedPaymentMethod').value;

    if (paymentMethod === 'online') {
        // Razorpay payment
        await initiateRazorpay();
    } else {
        // COD — create order directly
        await createOrder('cod', 'pending', null);
    }
}

/** Initiate Razorpay payment */
async function initiateRazorpay() {
    const total = getCartTotal() + deliveryCharge;
    const customer = getCustomer();

    // Load Razorpay script if not loaded
    if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
    }

    const options = {
        key: razorpayKeyId,
        amount: Math.round(total * 100), // Amount in paise
        currency: 'INR',
        name: 'Choice Kart',
        description: `Order of ${getCartCount()} items`,
        image: '/assets/images/logo.jpeg',
        prefill: {
            contact: customer?.phone || '',
            name: customer?.name || ''
        },
        theme: { color: '#059669' },
        handler: async function(response) {
            // Payment successful
            showToast('Payment successful!');
            await createOrder('online', 'paid', response.razorpay_payment_id);
        },
        modal: {
            ondismiss: function() {
                showToast('Payment cancelled', 'error');
            }
        }
    };

    const rzp = new Razorpay(options);
    rzp.open();
}

/** Create order in database */
async function createOrder(paymentMethod, paymentStatus, paymentId) {
    const customer = getCustomer();
    if (!customer) { showToast('Please login first', 'error'); return; }

    const subtotal = getCartTotal();
    const total = subtotal + deliveryCharge;
    const discount = getCartSavings();

    // Disable button to prevent double-click
    const btn = document.getElementById('placeOrderBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Placing order...'; }

    // Insert order
    const { data: order, error: orderErr } = await db.from('orders').insert({
        customer_id: customer.id,
        status: 'pending',
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        payment_id: paymentId,
        delivery_address: selectedAddress,
        delivery_charge: deliveryCharge,
        subtotal: subtotal,
        discount: discount,
        total: total,
        is_pickup: isPickup,
        notes: isPickup ? 'Customer pickup from store' : 'Online delivery order'
    }).select('*').single();

    if (orderErr) {
        showToast('Failed to create order: ' + orderErr.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Try Again'; }
        console.error('Order error:', orderErr);
        return;
    }

    // Insert order items
    const items = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        product_image: item.image,
        quantity: item.qty,
        unit: item.weight?.split(' ')[1] || 'piece',
        unit_value: parseFloat(item.weight) || 1,
        mrp: item.originalPrice,
        selling_price: item.price,
        total: item.price * item.qty
    }));

    await db.from('order_items').insert(items);

    // Update stock for each product
    for (const item of cart) {
        const { data: prod } = await db.from('products').select('stock_qty').eq('id', item.id).single();
        if (prod) {
            await db.from('products').update({
                stock_qty: Math.max(0, prod.stock_qty - item.qty)
            }).eq('id', item.id);
        }
    }

    // Save order number for confirmation
    window._lastOrderNumber = order.order_number;
    window._lastOrderTotal = total;

    // Clear cart
    cart = [];
    saveCart();

    // Show confirmation
    checkoutStep = 3;
    renderCheckoutStep();
}

// ===== STEP 3: CONFIRMATION =====
function renderConfirmation(container) {
    const orderNumber = window._lastOrderNumber || 'CK-0000';
    const orderTotal = window._lastOrderTotal || 0;

    container.innerHTML = `
        <div style="text-align:center;padding:20px 0;">
            <div style="width:80px;height:80px;background:#ECFDF5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                <i class="fas fa-check" style="font-size:36px;color:#059669;"></i>
            </div>
            <h2 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#111827;">Order Placed!</h2>
            <p style="font-size:14px;color:#6B7280;margin-bottom:24px;">
                ${isPickup ? 'Your items will be packed and ready for pickup.' : 'Your order is being prepared and will be delivered soon.'}
            </p>

            <div style="background:#F9FAFB;border-radius:12px;padding:20px;text-align:left;margin-bottom:24px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                    <span style="font-size:13px;color:#6B7280;">Order Number</span>
                    <span style="font-weight:700;color:#059669;">${orderNumber}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                    <span style="font-size:13px;color:#6B7280;">Total Paid</span>
                    <span style="font-weight:700;">₹${orderTotal.toLocaleString('en-IN')}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span style="font-size:13px;color:#6B7280;">${isPickup ? 'Pickup' : 'Delivery'}</span>
                    <span style="font-weight:600;color:#059669;">${isPickup ? 'Ready in ~30 min' : 'Within 30-60 min'}</span>
                </div>
            </div>

            <button onclick="closeCheckoutModal()"
                style="width:100%;padding:14px;background:linear-gradient(135deg,#059669,#10B981);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;">
                <i class="fas fa-shopping-bag"></i> Continue Shopping
            </button>

            <p style="font-size:12px;color:#9CA3AF;margin-top:16px;">
                <i class="fab fa-whatsapp" style="color:#25D366;"></i>
                You'll receive order updates on WhatsApp
            </p>
        </div>
    `;

    // Hide back button on confirmation
    document.getElementById('checkout-back').style.display = 'none';
}

// ===== MAKE FUNCTIONS GLOBAL =====
window.openCheckout = openCheckout;
window.closeCheckoutModal = closeCheckoutModal;
