// ============================================
// CHOICE KART Admin - Authentication & Session
// ============================================
// Handles login form submission, session persistence via localStorage,
// logout, password visibility toggle, and role-based access control.
// Depends on: db (supabase-config.js), utils.js

// ===== PASSWORD TOGGLE =====
// Called from HTML onclick on the eye icon in the login form
window.togglePassword = function() {
    const input = document.getElementById('loginPassword');
    const icon = document.getElementById('passToggleIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
};

// ===== LOGIN FORM SUBMISSION =====
// Uses simple table-based auth (admin_users table), not Supabase Auth
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    errorEl.style.display = 'none';
    loginBtn.classList.add('loading');

    if (!db) {
        errorEl.textContent = 'Database connection failed. Please refresh the page.';
        errorEl.style.display = 'block';
        loginBtn.classList.remove('loading');
        return;
    }

    try {
        // Check admin_users table for matching email + password
        const { data: admin, error } = await db
            .from('admin_users')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .eq('is_active', true)
            .single();

        if (error || !admin) {
            throw new Error('Invalid email or password');
        }

        // Save session in localStorage for persistence across page reloads
        localStorage.setItem('ck_admin', JSON.stringify({
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role
        }));

        // Update header with admin info
        document.getElementById('adminName').textContent = admin.name;
        document.getElementById('adminRole').textContent = admin.role.charAt(0).toUpperCase() + admin.role.slice(1);

        // Switch from login page to dashboard
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'flex';
        applyRolePermissions(admin.role);
        loadDashboard();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
        loginBtn.classList.remove('loading');
    }
});

// ===== SESSION CHECK =====
// Called on page load to restore previous login session
function checkSession() {
    const saved = localStorage.getItem('ck_admin');
    if (saved) {
        try {
            const admin = JSON.parse(saved);
            document.getElementById('adminName').textContent = admin.name;
            document.getElementById('adminRole').textContent = admin.role.charAt(0).toUpperCase() + admin.role.slice(1);
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'flex';
            applyRolePermissions(admin.role);
            loadDashboard();
        } catch (e) {
            localStorage.removeItem('ck_admin');
        }
    }
}

// ===== ROLE-BASED ACCESS CONTROL =====
// Owner: full access
// Manager: everything except staff management and store settings
// Staff: only billing, products (view), orders (view)
function applyRolePermissions(role) {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const navSections = document.querySelectorAll('.nav-section');

    // Define which sidebar sections each role can see
    const roleAccess = {
        owner: ['dashboard', 'products', 'categories', 'orders', 'customers',
                'online-orders', 'delivery-boys', 'delivery-charges',
                'coupons', 'banners', 'billing', 'reports', 'staff', 'service-areas', 'settings'],
        manager: ['dashboard', 'products', 'categories', 'orders', 'customers',
                  'online-orders', 'delivery-boys', 'delivery-charges',
                  'coupons', 'banners', 'billing', 'reports'],
        staff: ['dashboard', 'products', 'orders', 'online-orders', 'billing']
    };

    const allowed = roleAccess[role] || roleAccess.staff;

    // Show/hide nav items based on role
    navItems.forEach(item => {
        const section = item.dataset.section;
        if (allowed.includes(section)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });

    // Hide nav section headers if ALL items under them are hidden
    navSections.forEach(header => {
        let next = header.nextElementSibling;
        let anyVisible = false;
        while (next && !next.classList.contains('nav-section')) {
            if (next.classList.contains('nav-item') && next.style.display !== 'none') {
                anyVisible = true;
            }
            next = next.nextElementSibling;
        }
        header.style.display = anyVisible ? '' : 'none';
    });
}

// Restore session on page load
checkSession();

// ===== LOGOUT =====
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('ck_admin');
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginForm').reset();
});
