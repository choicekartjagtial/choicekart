// ============================================
// CHOICE KART — Customer Authentication
// Phone OTP Login System
// ============================================
// Dependencies: db (from inline Supabase script), showToast (from main.js)
//
// Flow:
//   1. Customer enters 10-digit phone → requestOTP()
//   2. 4-digit code generated, stored in otp_codes table, shown on screen (MVP)
//   3. Customer enters code → verifyOTP()
//   4. Customer record found/created in customers table
//   5. Session saved to localStorage as 'ck_customer'
// ============================================

// ===== SESSION STORAGE KEY =====
const CK_CUSTOMER_KEY = 'ck_customer';

// ===== SESSION HELPERS =====

/**
 * Get current logged-in customer or null
 * @returns {Object|null} { id, phone, name, addresses }
 */
function getCustomer() {
    try {
        const saved = localStorage.getItem(CK_CUSTOMER_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
}

/** Check if customer is logged in */
function isLoggedIn() {
    return getCustomer() !== null;
}

/** Save customer session */
function saveCustomerSession(customer) {
    localStorage.setItem(CK_CUSTOMER_KEY, JSON.stringify({
        id: customer.id,
        phone: customer.phone,
        name: customer.name || '',
        addresses: customer.addresses || []
    }));
    updateAuthUI();
}

/** Clear customer session */
function customerLogout() {
    localStorage.removeItem(CK_CUSTOMER_KEY);
    updateAuthUI();
    showToast('Logged out successfully');
}

// ===== UPDATE HEADER UI =====
/** Toggle Login/Account button in header based on session */
function updateAuthUI() {
    const customer = getCustomer();
    // Find the auth button by id (more reliable than onclick selector)
    const loginBtn = document.getElementById('authHeaderBtn');
    if (!loginBtn) return;

    if (customer) {
        // Show account info instead of Login
        loginBtn.innerHTML = `
            <i class="fas fa-user-circle"></i>
            <span>${customer.name || customer.phone}</span>
        `;
        loginBtn.setAttribute('onclick', 'openAccountMenu(); return false;');
    } else {
        // Show Login
        loginBtn.innerHTML = `
            <i class="fas fa-user-circle"></i>
            <span>Login</span>
        `;
        loginBtn.setAttribute('onclick', 'openLoginModal(); return false;');
    }
}

// ===== ACCOUNT MENU (simple dropdown) =====
function openAccountMenu() {
    const customer = getCustomer();
    if (!customer) { openLoginModal(); return; }

    // Toggle account dropdown
    let menu = document.getElementById('account-dropdown');
    if (menu) { menu.remove(); return; }

    menu = document.createElement('div');
    menu.id = 'account-dropdown';
    menu.style.cssText = 'position:fixed;top:70px;right:20px;background:white;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.15);padding:16px;z-index:2000;min-width:220px;animation:fadeIn 0.2s ease;';
    menu.innerHTML = `
        <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${customer.name || 'Customer'}</div>
        <div style="font-size:13px;color:#6B7280;margin-bottom:16px;">${customer.phone}</div>
        <div style="border-top:1px solid #E5E7EB;padding-top:12px;">
            <button onclick="customerLogout(); document.getElementById('account-dropdown')?.remove();"
                    style="width:100%;padding:10px;background:#FEE2E2;color:#EF4444;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        </div>
    `;
    document.body.appendChild(menu);

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!menu.contains(e.target) && !e.target.closest('.header-action')) {
                menu.remove();
                document.removeEventListener('click', handler);
            }
        });
    }, 100);
}

// ===== LOGIN MODAL =====
// State for OTP flow
let otpPhone = '';
let otpStep = 1; // 1=phone, 2=otp, 3=name (new customer)

/** Open login modal and show phone input step */
function openLoginModal() {
    // If already logged in, show account menu instead
    if (isLoggedIn()) { openAccountMenu(); return; }

    otpStep = 1;
    otpPhone = '';
    renderLoginStep();

    document.getElementById('login-overlay').classList.add('active');
    document.getElementById('login-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
    document.getElementById('login-overlay').classList.remove('active');
    document.getElementById('login-modal').classList.remove('active');
    document.body.style.overflow = '';
}

/** Render the current login step inside the modal */
function renderLoginStep() {
    const container = document.getElementById('login-steps');
    if (!container) return;

    if (otpStep === 1) {
        // Step 1: Phone number input
        container.innerHTML = `
            <h3 style="font-size:20px;font-weight:700;margin-bottom:4px;">Login / Sign Up</h3>
            <p style="font-size:14px;color:#6B7280;margin-bottom:24px;">Enter your phone number to continue</p>
            <div style="position:relative;margin-bottom:20px;">
                <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#6B7280;font-size:14px;font-weight:600;">+91</span>
                <input type="tel" id="otpPhoneInput" maxlength="10" placeholder="Enter 10-digit number"
                    style="width:100%;padding:14px 14px 14px 50px;border:2px solid #E5E7EB;border-radius:12px;font-size:16px;font-family:inherit;outline:none;transition:border 0.3s;"
                    onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#E5E7EB'">
            </div>
            <button onclick="requestOTP()" id="sendOtpBtn"
                style="width:100%;padding:14px;background:linear-gradient(135deg,#059669,#10B981);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;">
                Send OTP
            </button>
            <p style="font-size:11px;color:#9CA3AF;margin-top:16px;text-align:center;">
                By continuing, you agree to our Terms of Service
            </p>
        `;
        setTimeout(() => document.getElementById('otpPhoneInput')?.focus(), 200);
    } else if (otpStep === 2) {
        // Step 2: OTP input
        container.innerHTML = `
            <h3 style="font-size:20px;font-weight:700;margin-bottom:4px;">Verify OTP</h3>
            <p style="font-size:14px;color:#6B7280;margin-bottom:24px;">Enter the 4-digit code sent to +91 ${otpPhone}</p>
            <div style="display:flex;gap:12px;justify-content:center;margin-bottom:24px;" id="otpDigits">
                <input type="text" maxlength="1" class="otp-digit" data-idx="0" style="width:52px;height:56px;text-align:center;font-size:22px;font-weight:700;border:2px solid #E5E7EB;border-radius:12px;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#E5E7EB'">
                <input type="text" maxlength="1" class="otp-digit" data-idx="1" style="width:52px;height:56px;text-align:center;font-size:22px;font-weight:700;border:2px solid #E5E7EB;border-radius:12px;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#E5E7EB'">
                <input type="text" maxlength="1" class="otp-digit" data-idx="2" style="width:52px;height:56px;text-align:center;font-size:22px;font-weight:700;border:2px solid #E5E7EB;border-radius:12px;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#E5E7EB'">
                <input type="text" maxlength="1" class="otp-digit" data-idx="3" style="width:52px;height:56px;text-align:center;font-size:22px;font-weight:700;border:2px solid #E5E7EB;border-radius:12px;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#E5E7EB'">
            </div>
            <button onclick="verifyOTP()" id="verifyOtpBtn"
                style="width:100%;padding:14px;background:linear-gradient(135deg,#059669,#10B981);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;">
                Verify & Login
            </button>
            <p style="font-size:13px;color:#6B7280;margin-top:16px;text-align:center;">
                Didn't receive? <a href="#" onclick="requestOTP(); return false;" style="color:#059669;font-weight:600;">Resend OTP</a>
            </p>
            <p style="font-size:12px;color:#9CA3AF;margin-top:8px;text-align:center;cursor:pointer;" onclick="otpStep=1;renderLoginStep();">
                <i class="fas fa-arrow-left"></i> Change number
            </p>
        `;
        // Auto-focus first digit and setup auto-advance
        setTimeout(() => {
            const digits = document.querySelectorAll('.otp-digit');
            digits[0]?.focus();
            digits.forEach((input, i) => {
                input.addEventListener('input', (e) => {
                    if (e.target.value && i < 3) digits[i + 1].focus();
                });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && i > 0) digits[i - 1].focus();
                });
            });
        }, 200);
    } else if (otpStep === 3) {
        // Step 3: Name input (for new customers)
        container.innerHTML = `
            <h3 style="font-size:20px;font-weight:700;margin-bottom:4px;">Almost Done!</h3>
            <p style="font-size:14px;color:#6B7280;margin-bottom:24px;">What should we call you?</p>
            <input type="text" id="customerNameInput" placeholder="Enter your name"
                style="width:100%;padding:14px;border:2px solid #E5E7EB;border-radius:12px;font-size:15px;font-family:inherit;outline:none;margin-bottom:20px;"
                onfocus="this.style.borderColor='#059669'" onblur="this.style.borderColor='#E5E7EB'">
            <button onclick="saveCustomerName()"
                style="width:100%;padding:14px;background:linear-gradient(135deg,#059669,#10B981);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;">
                Continue
            </button>
        `;
        setTimeout(() => document.getElementById('customerNameInput')?.focus(), 200);
    }
}

// ===== OTP LOGIC =====

/** Generate and store OTP for the entered phone number */
async function requestOTP() {
    const input = document.getElementById('otpPhoneInput');
    const phone = (input ? input.value : otpPhone).replace(/\D/g, '');

    // Validate 10-digit Indian phone
    if (phone.length !== 10) {
        showToast('Please enter a valid 10-digit phone number', 'error');
        return;
    }

    otpPhone = phone;

    // Generate 4-digit OTP
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

    // Store in database
    const { error } = await db.from('otp_codes').insert({
        phone: phone,
        code: code,
        expires_at: expiresAt
    });

    if (error) {
        showToast('Failed to send OTP. Please try again.', 'error');
        console.error('OTP insert error:', error);
        return;
    }

    // Show user-friendly message (OTP not shown on screen)
    showToast('OTP sent to your mobile +91' + phone);
    // DEV ONLY: OTP logged in console for testing (remove in production)
    console.log(`%c[DEV] OTP for +91${phone}: ${code}`, 'color: #059669; font-weight: bold; font-size: 14px;');

    // Move to step 2
    otpStep = 2;
    renderLoginStep();
}

/** Verify the entered OTP against the database */
async function verifyOTP() {
    // Collect 4 digits
    const digits = document.querySelectorAll('.otp-digit');
    const code = Array.from(digits).map(d => d.value).join('');

    if (code.length !== 4) {
        showToast('Please enter the 4-digit OTP', 'error');
        return;
    }

    // Query OTP from database
    const { data: otpRecord, error } = await db
        .from('otp_codes')
        .select('*')
        .eq('phone', otpPhone)
        .eq('code', code)
        .eq('is_used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !otpRecord) {
        showToast('Invalid or expired OTP. Please try again.', 'error');
        return;
    }

    // Mark OTP as used
    await db.from('otp_codes').update({ is_used: true }).eq('id', otpRecord.id);

    // Find or create customer
    const { data: existingCustomer } = await db
        .from('customers')
        .select('*')
        .eq('phone', otpPhone)
        .single();

    if (existingCustomer) {
        // Existing customer — login
        saveCustomerSession(existingCustomer);
        showToast(`Welcome back, ${existingCustomer.name || 'Customer'}!`);
        closeLoginModal();

        // If checkout was pending, open it
        if (window._pendingCheckout) {
            window._pendingCheckout = false;
            setTimeout(() => openCheckout(), 300);
        }
    } else {
        // New customer — ask for name
        otpStep = 3;
        renderLoginStep();
    }
}

/** Save new customer name and create record */
async function saveCustomerName() {
    const name = document.getElementById('customerNameInput')?.value.trim() || 'Customer';

    const { data: newCustomer, error } = await db
        .from('customers')
        .insert({
            phone: otpPhone,
            name: name,
            addresses: []
        })
        .select('*')
        .single();

    if (error) {
        showToast('Failed to create account. Please try again.', 'error');
        console.error('Customer create error:', error);
        return;
    }

    saveCustomerSession(newCustomer);
    showToast(`Welcome to Choice Kart, ${name}!`);
    closeLoginModal();

    // If checkout was pending, open it
    if (window._pendingCheckout) {
        window._pendingCheckout = false;
        setTimeout(() => openCheckout(), 300);
    }
}

// ===== INIT =====
// Update auth UI on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
});
