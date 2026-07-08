let currentUser = null;
let currentComplaintId = null;
let activeNavTab = 'dashboard';
let searchTimeout = null;
let remarkPollTimer = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuthSession(false);
    if (currentUser) {
        setupDashboardView();
    }
});

// Configure UI components based on authenticated user role
function setupDashboardView() {
    // Update sidebar info
    document.getElementById('sidebar-username').textContent = currentUser.username;
    document.getElementById('sidebar-role').textContent = currentUser.role === 'admin' ? 'Staff / Admin' : 'Customer';

    const avatar = document.getElementById('sidebar-avatar');
    if (currentUser.role === 'admin') {
        avatar.classList.add('admin-user');
        avatar.textContent = '🛠️';

        // Toggle Admin specific views
        document.getElementById('file-complaint-section').classList.add('hidden');
        document.getElementById('admin-charts-section').classList.remove('hidden');
        document.getElementById('admin-actions-controls').classList.remove('hidden');
    } else {
        avatar.textContent = '🧑';

        // Toggle Complainant specific views
        document.getElementById('file-complaint-section').classList.remove('hidden');
        document.getElementById('admin-charts-section').classList.add('hidden');
        document.getElementById('admin-actions-controls').classList.add('hidden');

        // Unhide complainant layout items
        document.querySelectorAll('.complainant-only').forEach(el => el.classList.remove('hidden'));
    }

    // Load stats & tickets
    refreshDashboardData();
}

// Fetch stats and lists
async function refreshDashboardData() {
    if (currentUser.role === 'admin') {
        await loadAdminStats();
    } else {
        // Complainants compile metrics locally from their specific tickets list return
        await calculateComplainantMetrics();
    }
    await loadComplaintsList();
}

// Load statistics from Admin API endpoints
async function loadAdminStats() {
    try {
        const stats = await apiRequest('/api/admin/stats');

        // Populate cards
        document.getElementById('metric-total-val').textContent = stats.summary.total;
        document.getElementById('metric-pending-val').textContent = stats.summary.pending;
        document.getElementById('metric-progress-val').textContent = stats.summary.inProgress;
        document.getElementById('metric-resolved-val').textContent = stats.summary.resolved;

        // Render category visual progress chart
        renderCategoryAnalytics(stats.categoryBreakdown, stats.summary.total);

        // Render priority statistics list
        renderPriorityAnalytics(stats.priorityBreakdown);
    } catch (error) {
        showToast('Failed to load admin dashboard stats', true);
    }
}

// Render dynamic visual charts for Categories
function renderCategoryAnalytics(breakdown, total) {
    const container = document.getElementById('category-chart-list');
    container.innerHTML = '';

    if (!breakdown || breakdown.length === 0) {
        container.innerHTML = `<span style="color:var(--text-muted); font-size: 0.85rem;">No ticket distribution data.</span>`;
        return;
    }

    const categoryColors = {
        Civil: 'bar-teal',
        Criminal: 'bar-purple',
        Family: 'bar-amber',
        Administrative: 'bar-red',
        Other: 'bar-green'
    };

    breakdown.forEach(item => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        const colorClass = categoryColors[item.category] || 'bar-teal';

        const row = document.createElement('div');
        row.className = 'bar-row';
        row.innerHTML = `
      <div class="bar-labels">
        <span class="bar-name">${item.category}</span>
        <span>${item.count} items (${pct}%)</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${colorClass}" style="width: ${pct}%"></div>
      </div>
    `;
        container.appendChild(row);
    });
}

// Render priority chips summaries
function renderPriorityAnalytics(breakdown) {
    const container = document.getElementById('priority-chart-list');
    container.innerHTML = '';

    if (!breakdown || breakdown.length === 0) {
        container.innerHTML = `<span style="color:var(--text-muted); font-size:0.85rem;">No priority records.</span>`;
        return;
    }

    const badges = {
        Low: 'prio-low-badge',
        Medium: 'prio-med-badge',
        High: 'prio-high-badge'
    };

    breakdown.forEach(item => {
        const badgeClass = badges[item.priority] || 'prio-med-badge';

        const row = document.createElement('div');
        row.className = 'priority-list-item';
        row.innerHTML = `
      <span class="priority-pill ${badgeClass}">${item.priority} Impact</span>
      <span style="font-weight:600; font-size:0.95rem;">${item.count} tickets</span>
    `;
        container.appendChild(row);
    });
}

// Client side accumulator for Complainant specific dashboard
async function calculateComplainantMetrics() {
    try {
        const list = await apiRequest('/api/complaints');

        const counts = { total: 0, pending: 0, progress: 0, resolved: 0 };
        counts.total = list.length;

        list.forEach(c => {
            if (c.status === 'Pending') counts.pending++;
            else if (c.status === 'In Progress') counts.progress++;
            else if (c.status === 'Resolved') counts.resolved++;
        });

        document.getElementById('metric-total-val').textContent = counts.total;
        document.getElementById('metric-pending-val').textContent = counts.pending;
        document.getElementById('metric-progress-val').textContent = counts.progress;
        document.getElementById('metric-resolved-val').textContent = counts.resolved;
    } catch (error) {
        console.error('Local counter compile error:', error);
    }
}

// Fetch lists of complaints matching filter requirements
async function loadComplaintsList() {
    const container = document.getElementById('complaints-list');
    const searchVal = document.getElementById('search-input').value;
    const categoryVal = document.getElementById('filter-category').value;
    const statusVal = document.getElementById('filter-status').value;

    container.innerHTML = '<div class="no-complaints">Filtering issues database...</div>';

    try {
        // Construct query parameters
        const params = new URLSearchParams();
        if (searchVal) params.append('search', searchVal);
        if (categoryVal) params.append('category', categoryVal);
        if (statusVal) params.append('status', statusVal);

        const data = await apiRequest(`/api/complaints?${params.toString()}`);

        container.innerHTML = '';
        if (data.length === 0) {
            container.innerHTML = '<div class="no-complaints">No complaints match your active filter search.</div>';
            return;
        }

        data.forEach(item => {
            // Map statuses & priorities
            let statusClass = 'status-pending-badge';
            if (item.status === 'In Progress') statusClass = 'status-progress-badge';
            else if (item.status === 'Resolved') statusClass = 'status-resolved-badge';

            let prioClass = 'prio-med-badge';
            if (item.priority === 'Low') prioClass = 'prio-low-badge';
            else if (item.priority === 'High') prioClass = 'prio-high-badge';

            const card = document.createElement('div');
            card.className = 'complaint-item-card';
            card.onclick = () => openDetailsInspector(item.id);

            // Admin controls visible per-card for quick actions
            const adminControls = (currentUser && currentUser.role === 'admin') ? `
                            <div class="card-admin-actions">
                                <button class="tiny-btn" onclick="event.stopPropagation(); adminReject(${item.id})">Reject</button>
                                <button class="tiny-btn" onclick="event.stopPropagation(); adminEdit(${item.id})">Edit</button>
                                <button class="tiny-btn" onclick="event.stopPropagation(); adminDelete(${item.id})">Delete</button>
                            </div>
                        ` : '';

            card.innerHTML = `
        <div class="complaint-item-details">
          <div class="complaint-item-title">${escapeHTML(item.title)}</div>
          <div class="complaint-item-descr">${escapeHTML(item.description)}</div>
          <div class="complaint-item-meta">
            <span>Ref: #${item.id}</span>
            <span>•</span>
            <span class="badge-category">${item.category}</span>
            <span>•</span>
            <span>By: <b>${escapeHTML(item.complainant_name || 'Anonymous')}</b></span>
            <span>•</span>
            <span>${formatDate(item.created_at)}</span>
          </div>
        </div>
        <div class="complaint-item-badges">
          <span class="status-badge ${statusClass}">${item.status}</span>
          <span class="priority-pill ${prioClass}">${item.priority}</span>
        </div>
                            ${adminControls}
                        `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = '<div class="no-complaints error">Failed to synchronize logs from system API.</div>';
    }
}

// Open inspection panel drawer with details and interactive comments
async function openDetailsInspector(id) {
    currentComplaintId = id;
    const pane = document.getElementById('details-pane');

    try {
        const data = await apiRequest(`/api/complaints/${id}`);
        const c = data.complaint;
        const remarks = data.remarks;

        // Populates fields
        document.getElementById('inspect-title-text').textContent = c.title;
        document.getElementById('inspect-ref-id').textContent = `#${c.id}`;
        document.getElementById('inspect-category').textContent = c.category;
        document.getElementById('inspect-court-name').textContent = c.court_name;
        document.getElementById('inspect-case-number').textContent = c.case_number;
        document.getElementById('inspect-parties').textContent = c.parties || 'N/A';
        document.getElementById('inspect-hearing-date').textContent = c.hearing_date || 'N/A';
        document.getElementById('inspect-complainant').textContent = `${c.complainant_name} (${c.complainant_email})`;
        document.getElementById('inspect-date').textContent = formatDate(c.created_at);
        document.getElementById('inspect-desc-text').textContent = c.description;

        // Status badge class mapping
        const statusEl = document.getElementById('inspect-status-badge');
        statusEl.className = 'status-badge';
        statusEl.textContent = c.status;
        if (c.status === 'Pending') statusEl.classList.add('status-pending-badge');
        else if (c.status === 'In Progress') statusEl.classList.add('status-progress-badge');
        else if (c.status === 'Resolved') statusEl.classList.add('status-resolved-badge');

        // Priority pill class mapping
        const prioEl = document.getElementById('inspect-priority-pill');
        prioEl.className = 'priority-pill';
        prioEl.textContent = c.priority;
        if (c.priority === 'Low') prioEl.classList.add('prio-low-badge');
        else if (c.priority === 'Medium') prioEl.classList.add('prio-med-badge');
        else if (c.priority === 'High') prioEl.classList.add('prio-high-badge');

        // Attachments link check
        const docContainer = document.getElementById('inspect-attachment-container');
        if (c.attachment_path) {
            docContainer.classList.remove('hidden');
            document.getElementById('inspect-attachment-link').href = `/api/complaints/${c.id}/attachment`;
        } else {
            docContainer.classList.add('hidden');
        }

        // Load timeline chat logs
        renderTimelineRemarks(remarks);

        // Slide open the side drawer
        pane.classList.add('open');
        startRemarkPolling();
    } catch (error) {
        showToast('Unable to inspect specified ticket details', true);
    }
}

// Close drawer
function closeDetailsInspector() {
    document.getElementById('details-pane').classList.remove('open');
    currentComplaintId = null;
    stopRemarkPolling();
}

function startRemarkPolling() {
    stopRemarkPolling();
    if (!currentComplaintId) return;
    remarkPollTimer = setInterval(async () => {
        if (!currentComplaintId) return;
        try {
            const data = await apiRequest(`/api/complaints/${currentComplaintId}`);
            renderTimelineRemarks(data.remarks);
        } catch (error) {
            console.error('Chat poll failed:', error);
        }
    }, 8000);
}

function stopRemarkPolling() {
    if (remarkPollTimer) {
        clearInterval(remarkPollTimer);
        remarkPollTimer = null;
    }
}

// Open About modal (shared simple modal)
function openAboutModal() {
    // If modal markup exists on page, show it; otherwise navigate to /about.html
    const modal = document.getElementById('about-modal');
    if (modal) {
        modal.classList.add('open');
    } else {
        window.location.href = '/about.html';
    }
}

// Render dynamic timeline remark list items
function renderTimelineRemarks(remarks) {
    const container = document.getElementById('remarks-timeline');
    container.innerHTML = '';

    if (!remarks || remarks.length === 0) {
        container.innerHTML = '<div class="timeline-empty">No remarks posted on this ticket yet.</div>';
        return;
    }

    remarks.forEach(r => {
        const bubble = document.createElement('div');
        bubble.className = 'remark-bubble';
        if (r.role === 'admin') {
            bubble.classList.add('admin-comment');
        }

        bubble.innerHTML = `
      <div class="remark-header">
        <span class="remark-author">${escapeHTML(r.username)} <span style="font-weight:normal; opacity:0.65; font-size:10px;">(${r.role})</span></span>
        <span class="remark-time">${formatDate(r.created_at)}</span>
      </div>
      <div class="remark-body">${escapeHTML(r.remark)}</div>
    `;
        container.appendChild(bubble);
    });

    // Scroll to bottom of remarks container
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

// Post feedback comments
async function handlePostRemark(event) {
    event.preventDefault();
    const remarkBox = document.getElementById('remark-textarea');
    const remarkStr = remarkBox.value;

    if (!currentComplaintId || !remarkStr.trim()) return;

    try {
        const data = await apiRequest(`/api/complaints/${currentComplaintId}/remarks`, {
            method: 'POST',
            body: JSON.stringify({ remark: remarkStr })
        });

        remarkBox.value = '';

        // Re-fetch details to fetch updated list & scroll timeline
        await openDetailsInspector(currentComplaintId);
        showToast('Remark submitted successfully.');
    } catch (error) {
        showToast(error.message || 'Failed to submit comment feedback', true);
    }
}

// Update ticket status (Admin Only)
async function updateStatusAPI(newStatus) {
    if (!currentComplaintId) return;

    try {
        await apiRequest(`/api/complaints/${currentComplaintId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });

        showToast(`Status updated to: ${newStatus}`);

        // Refresh Inspector Details View
        await openDetailsInspector(currentComplaintId);

        // Refresh background metrics and list
        await refreshDashboardData();
    } catch (error) {
        showToast(error.message || 'State modification denied', true);
    }
}

// Admin: Delete complaint (with confirmation)
async function deleteComplaintAPI() {
    if (!currentComplaintId) return;
    if (!confirm('Are you sure you want to permanently delete this complaint? This cannot be undone.')) return;

    try {
        await apiRequest(`/api/complaints/${currentComplaintId}`, { method: 'DELETE' });
        showToast('Complaint deleted successfully.');
        closeDetailsInspector();
        await refreshDashboardData();
    } catch (error) {
        showToast(error.message || 'Failed to delete complaint', true);
    }
}

// Admin: Open a simple edit prompt flow to update core fields
async function openEditComplaint() {
    if (!currentComplaintId) return;

    try {
        const data = await apiRequest(`/api/complaints/${currentComplaintId}`);
        const c = data.complaint;

        const title = prompt('Edit Title:', c.title);
        if (title === null) return; // cancelled

        const category = prompt('Edit Category (Civil, Criminal, Family, Administrative, Other):', c.category);
        if (category === null) return;

        const priority = prompt('Edit Priority (Low, Medium, High):', c.priority);
        if (priority === null) return;

        const description = prompt('Edit Description:', c.description);
        if (description === null) return;

        // Send update to server
        await apiRequest(`/api/complaints/${currentComplaintId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title, category, priority, description })
        });

        showToast('Complaint updated successfully.');
        await openDetailsInspector(currentComplaintId);
        await refreshDashboardData();
    } catch (error) {
        showToast(error.message || 'Failed to update complaint', true);
    }
}

// File Ticket submission using FormData for attachments handling
async function handleFileComplaint(event) {
    event.preventDefault();

    const title = document.getElementById('comp-title').value;
    const category = document.getElementById('comp-category').value;
    const priority = document.getElementById('comp-priority').value;
    const description = document.getElementById('comp-description').value;
    const courtName = document.getElementById('comp-court-name').value;
    const caseNumber = document.getElementById('comp-case-number').value;
    const parties = document.getElementById('comp-parties').value;
    const hearingDate = document.getElementById('comp-hearing-date').value;
    const fileInput = document.getElementById('comp-attachment');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('priority', priority);
    formData.append('description', description);
    formData.append('court_name', courtName);
    formData.append('case_number', caseNumber);
    formData.append('parties', parties);
    formData.append('hearing_date', hearingDate);

    if (fileInput.files.length > 0) {
        formData.append('attachment', fileInput.files[0]);
    }

    try {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');

        await apiRequest('/api/complaints', {
            method: 'POST',
            body: formData
        });

        showToast('Complaint filed. Team notified!');

        // reset form fields
        event.target.reset();
        document.getElementById('file-name-info').classList.add('hidden');
        document.getElementById('upload-instruction').textContent = 'Drop files here or click to upload';

        // Reload list and counters
        await refreshDashboardData();
    } catch (error) {
        showToast(error.message || 'Failed to submit concern ticket.', true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
}

// Inform complainant which file is selected in styling wrapper
function fileSelectedNotify(input) {
    const info = document.getElementById('file-name-info');
    const textVal = document.getElementById('upload-instruction');

    if (input.files.length > 0) {
        const filename = input.files[0].name;
        info.textContent = `Attached: ${filename}`;
        info.classList.remove('hidden');
        textVal.textContent = 'Change selected file';
    } else {
        info.classList.add('hidden');
        textVal.textContent = 'Drop files here or click to upload';
    }
}

// Sidebar Navigation filter links switching
function switchNav(tab) {
    activeNavTab = tab;

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(el => el.classList.remove('active'));

    const statusFilter = document.getElementById('filter-status');
    const titleEl = document.getElementById('workspace-title');

    if (tab === 'dashboard') {
        document.getElementById('nav-dashboard').classList.add('active');
        statusFilter.value = '';
        titleEl.textContent = 'Overview';
    } else if (tab === 'complaints') {
        document.getElementById('nav-all-complaints').classList.add('active');
        statusFilter.value = '';
        titleEl.textContent = 'Total Active Complaints';
    } else if (tab === 'new' && currentUser.role === 'complainant') {
        document.getElementById('nav-new-complaint').classList.add('active');
        titleEl.textContent = 'Submit New Ticket';
        // Scroll directly to the form
        document.getElementById('file-complaint-section').scrollIntoView({ behavior: 'smooth' });
    }

    loadComplaintsList();
}

// Trigger query inputs searching with debouncing delay
function triggerSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadComplaintsList();
    }, 350);
}

// Clear active system session
async function handleLogout() {
    try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
        showToast('Logging out...');
        setTimeout(() => {
            window.location.href = '/';
        }, 800);
    } catch (error) {
        showToast('Failed to log out correctly', true);
    }
}

// Simple HTML escaping helper for client safety
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Per-item admin helpers used by inline card buttons
async function adminDelete(id) {
    if (!confirm('Delete this complaint permanently?')) return;
    try {
        await apiRequest(`/api/complaints/${id}`, { method: 'DELETE' });
        showToast('Complaint deleted');
        if (currentComplaintId === id) closeDetailsInspector();
        await refreshDashboardData();
    } catch (err) {
        showToast(err.message || 'Delete failed', true);
    }
}

async function adminEdit(id) {
    try {
        const data = await apiRequest(`/api/complaints/${id}`);
        const c = data.complaint;
        const title = prompt('Edit Title:', c.title);
        if (title === null) return;
        const category = prompt('Edit Category (Civil, Criminal, Family, Administrative, Other):', c.category);
        if (category === null) return;
        const priority = prompt('Edit Priority (Low, Medium, High):', c.priority);
        if (priority === null) return;
        const description = prompt('Edit Description:', c.description);
        if (description === null) return;

        await apiRequest(`/api/complaints/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ title, category, priority, description })
        });
        showToast('Complaint updated');
        if (currentComplaintId === id) await openDetailsInspector(id);
        await refreshDashboardData();
    } catch (err) {
        showToast(err.message || 'Edit failed', true);
    }
}

async function adminReject(id) {
    try {
        await apiRequest(`/api/complaints/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'Rejected' })
        });
        showToast('Complaint rejected');
        if (currentComplaintId === id) await openDetailsInspector(id);
        await refreshDashboardData();
    } catch (err) {
        showToast(err.message || 'Reject failed', true);
    }
}
