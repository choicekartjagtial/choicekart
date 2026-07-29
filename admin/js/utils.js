// ============================================
// CHOICE KART Admin - Shared Utilities
// ============================================
// Common helper functions used across all admin modules.
// These are available globally and referenced by other files.

/**
 * Convert text to a URL-friendly slug.
 * Strips special chars, replaces spaces/underscores with hyphens.
 */
function slugify(text) {
    return text.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Format a date string to Indian locale (e.g. "28 Jul 2026").
 * Returns '-' if the input is falsy.
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

/**
 * Format a number as Indian Rupee currency (e.g. "₹1,200").
 * Defaults to 0 if amount is falsy.
 */
function formatCurrency(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

/**
 * Show a toast notification at the bottom-right of the screen.
 * @param {string} message - Text to display
 * @param {'success'|'error'|'warning'} type - Toast type (controls icon + color)
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'exclamation-triangle';
    toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
    container.appendChild(toast);
    // Auto-remove after 3.5 seconds
    setTimeout(() => toast.remove(), 3500);
}

/**
 * Open a modal by adding the 'active' class to its overlay.
 * @param {string} id - The DOM id of the modal overlay
 */
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

/**
 * Close a modal by removing the 'active' class from its overlay.
 * @param {string} id - The DOM id of the modal overlay
 */
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Make closeModal available for HTML onclick attributes
window.closeModal = closeModal;

/**
 * Resolve an image path. If the URL is absolute (http), return as-is.
 * Otherwise prefix with '../' for relative asset paths.
 */
function imgPath(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return '../' + url;
}
