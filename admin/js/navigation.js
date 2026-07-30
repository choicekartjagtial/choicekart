// ============================================
// CHOICE KART Admin - Sidebar Navigation
// ============================================
// Handles sidebar nav item clicks, section switching (the switch/case
// that loads data for each section), and mobile menu toggle.
// Depends on: all section loader functions from other modules

// Track the currently active section
let currentSection = 'dashboard';

// ===== NAV ITEM CLICK HANDLER =====
// When a nav item is clicked, switch the active section and load its data
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const section = item.dataset.section;
        if (!section) return;

        // Update active state on nav items
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        // Show the selected section, hide all others
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`sec-${section}`).classList.add('active');

        // Update the page title in the header
        document.getElementById('pageTitle').textContent = item.textContent.trim();
        currentSection = section;

        // Load data for the selected section
        switch (section) {
            case 'dashboard': loadDashboard(); break;
            case 'products': loadProducts(); break;
            case 'categories': loadCategories(); loadSubcategories(); break;
            case 'orders': loadOrders(); break;
            case 'customers': loadCustomers(); break;
            case 'delivery-boys': loadDeliveryBoys(); break;
            case 'delivery-charges': loadDeliveryCharges(); break;
            case 'coupons': loadCoupons(); break;
            case 'banners': loadBanners(); break;
            case 'offers': loadOffers(); break;
            case 'service-areas': loadServiceAreas(); break;
            case 'settings': loadSettings(); break;
            case 'staff': loadStaff(); break;
            case 'billing': initBilling(); break;
            case 'online-orders': loadOnlineOrders(); break;
            case 'reports': loadReports(); break;
        }

        // Close sidebar on mobile after navigation
        document.getElementById('sidebar').classList.remove('open');
    });
});

// ===== MOBILE MENU TOGGLE =====
// Hamburger button toggles the sidebar open/closed on small screens
document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});
