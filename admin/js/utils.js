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
 * Convert text to Title Case (each word capitalized).
 * "aashirvaad WHOLE wheat atta" → "Aashirvaad Whole Wheat Atta"
 * Preserves short words like "of", "and" in lowercase (except first word).
 */
function toTitleCase(text) {
    if (!text) return '';
    const minorWords = ['of', 'and', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'a', 'an'];
    return text.trim().split(/\s+/).map((word, i) => {
        const lower = word.toLowerCase();
        if (i > 0 && minorWords.includes(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(' ');
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

/**
 * Show a toast-style confirmation dialog (replaces window.confirm).
 * Returns a Promise that resolves to true (confirm) or false (cancel).
 * @param {string} message - Question to ask
 * @param {string} confirmText - Text for confirm button (default: "Yes, Delete")
 */
function toastConfirm(message, confirmText = 'Yes, Delete') {
    return new Promise(resolve => {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast warning';
        toast.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:16px 20px;max-width:320px;';
        toast.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button class="tc-cancel" style="padding:6px 14px;border:1px solid rgba(255,255,255,0.4);background:transparent;color:white;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>
                <button class="tc-confirm" style="padding:6px 14px;border:none;background:white;color:#EF4444;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">${confirmText}</button>
            </div>
        `;
        toast.querySelector('.tc-cancel').onclick = () => { toast.remove(); resolve(false); };
        toast.querySelector('.tc-confirm').onclick = () => { toast.remove(); resolve(true); };
        container.appendChild(toast);
        // Auto-dismiss after 10 seconds (cancel)
        setTimeout(() => { if (toast.parentNode) { toast.remove(); resolve(false); } }, 10000);
    });
}

/**
 * Check if current admin user is owner.
 * @returns {boolean}
 */
function isOwner() {
    try {
        const admin = JSON.parse(localStorage.getItem('ck_admin') || '{}');
        return admin.role === 'owner';
    } catch { return false; }
}

/**
 * Render bulk action bar (select all, delete, export) — only for owners.
 * @param {string} containerId — DOM id for the bulk bar container
 * @param {string} tableId — DOM id of the table body with checkboxes
 * @param {object} callbacks — { onDelete, onExportCSV, onExportExcel }
 */
function renderBulkActions(containerId, tableId, callbacks) {
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        const table = document.getElementById(tableId);
        if (table) table.closest('.card')?.insertBefore(container, table.closest('.table-wrapper'));
    }

    if (!isOwner()) { container.innerHTML = ''; return; }

    container.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#FEF3C7;border-radius:8px;margin:0 16px 10px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;cursor:pointer;">
                <input type="checkbox" id="${containerId}_selectAll" onchange="toggleSelectAll('${tableId}', this.checked)" style="width:16px;height:16px;accent-color:var(--primary);">
                Select All
            </label>
            <span id="${containerId}_count" style="font-size:12px;color:#92400E;">0 selected</span>
            <div style="flex:1;"></div>
            ${callbacks.onDelete ? `<button onclick="bulkAction_${containerId}_delete()" style="padding:6px 14px;background:#EF4444;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;"><i class="fas fa-trash"></i> Delete Selected</button>` : ''}
            ${callbacks.onExportCSV ? `<button onclick="bulkAction_${containerId}_csv()" style="padding:6px 14px;background:white;color:#059669;border:1.5px solid #059669;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;"><i class="fas fa-file-csv"></i> CSV</button>` : ''}
            ${callbacks.onExportExcel ? `<button onclick="bulkAction_${containerId}_excel()" style="padding:6px 14px;background:white;color:#3B82F6;border:1.5px solid #3B82F6;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;"><i class="fas fa-file-excel"></i> Excel</button>` : ''}
        </div>
    `;

    // Register global callbacks
    if (callbacks.onDelete) window[`bulkAction_${containerId}_delete`] = callbacks.onDelete;
    if (callbacks.onExportCSV) window[`bulkAction_${containerId}_csv`] = callbacks.onExportCSV;
    if (callbacks.onExportExcel) window[`bulkAction_${containerId}_excel`] = callbacks.onExportExcel;
}

/** Toggle all checkboxes in a table */
window.toggleSelectAll = function(tableId, checked) {
    document.querySelectorAll(`#${tableId} .row-checkbox`).forEach(cb => cb.checked = checked);
    updateBulkCount(tableId);
};

/** Update selected count display */
function updateBulkCount(tableId) {
    const checkboxes = document.querySelectorAll(`#${tableId} .row-checkbox:checked`);
    // Find the bulk bar for this table
    const bars = document.querySelectorAll('[id$="_count"]');
    bars.forEach(bar => {
        if (bar.closest('.card')?.querySelector(`#${tableId}`)) {
            bar.textContent = checkboxes.length + ' selected';
        }
    });
}

/** Get selected row IDs from checkboxes */
function getSelectedIds(tableId) {
    return Array.from(document.querySelectorAll(`#${tableId} .row-checkbox:checked`)).map(cb => cb.value);
}

// Make closeModal available for HTML onclick attributes
window.closeModal = closeModal;

// ===== PAGINATION =====
const PAGE_SIZE = 20;

/**
 * Render pagination controls into a container.
 * @param {string} containerId - DOM id of the pagination container
 * @param {number} totalCount - Total number of items
 * @param {number} page - Current page (1-based)
 * @param {number} pageSize - Items per page
 * @param {Function} loadFn - Function to call when page changes, receives new page number
 */
function renderPagination(containerId, totalCount, page, pageSize, loadFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    html += `<button ${page <= 1 ? 'disabled' : ''} onclick="window._paginateFn_${containerId}(${page - 1})">&laquo; Prev</button>`;

    // Show page numbers with ellipsis
    const maxButtons = 5;
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

    if (startPage > 1) {
        html += `<button onclick="window._paginateFn_${containerId}(1)">1</button>`;
        if (startPage > 2) html += `<span class="page-info">...</span>`;
    }
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="${i === page ? 'active' : ''}" onclick="window._paginateFn_${containerId}(${i})">${i}</button>`;
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="page-info">...</span>`;
        html += `<button onclick="window._paginateFn_${containerId}(${totalPages})">${totalPages}</button>`;
    }

    html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="window._paginateFn_${containerId}(${page + 1})">Next &raquo;</button>`;
    html += `<span class="page-info">${totalCount} items</span>`;

    container.innerHTML = html;
    window['_paginateFn_' + containerId] = loadFn;
}

/**
 * Resolve an image path. If the URL is absolute (http), return as-is.
 * Otherwise prefix with '../' for relative asset paths.
 */
function imgPath(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return '../' + url;
}
