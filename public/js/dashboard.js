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

    let roleText = 'Citizen';
    let icon = '🧑';
    const activeRole = currentUser.role ? currentUser.role.toUpperCase() : '';

    if (activeRole === 'ADMIN') {
        roleText = 'System Administrator';
        icon = '🛠️';
    } else if (activeRole === 'CLERK') {
        roleText = 'Registry Clerk';
        icon = '📝';
    } else if (activeRole === 'JUDGE') {
        roleText = 'Honorable Judge';
        icon = '⚖️';
    }

    document.getElementById('sidebar-role').textContent = roleText;
    const avatar = document.getElementById('sidebar-avatar');
    avatar.textContent = icon;

    // Hide all role-specific classes by default
    document.querySelectorAll('.role-citizen, .role-staff, .role-admin, .role-clerk, .role-judge').forEach(el => el.classList.add('hidden'));

    const isStaff = ['ADMIN', 'CLERK', 'JUDGE'].includes(activeRole);
    if (isStaff) {
        avatar.classList.add('admin-user');

        // Show all Staff items
        document.querySelectorAll('.role-staff').forEach(el => el.classList.remove('hidden'));

        if (activeRole === 'ADMIN') {
            document.querySelectorAll('.role-admin').forEach(el => el.classList.remove('hidden'));
            document.getElementById('nav-all-complaints').innerHTML = '<span>📁</span> All Complaints';
            document.getElementById('workspace-title').textContent = 'System Overview';
        } else if (activeRole === 'CLERK') {
            document.querySelectorAll('.role-clerk').forEach(el => el.classList.remove('hidden'));
            document.getElementById('nav-all-complaints').innerHTML = '<span>📁</span> Registry Intake';
            document.getElementById('workspace-title').textContent = 'Registry Overview';
        } else if (activeRole === 'JUDGE') {
            document.querySelectorAll('.role-judge').forEach(el => el.classList.remove('hidden'));
            document.getElementById('nav-all-complaints').innerHTML = '<span>⚖️</span> My Caseload';
            document.getElementById('workspace-title').textContent = 'Judicial Overview';
        }
    } else {
        // Show Citizen items
        document.querySelectorAll('.role-citizen').forEach(el => el.classList.remove('hidden'));
    }

    // Load stats & tickets
    refreshDashboardData();
}

// Fetch stats and lists
async function refreshDashboardData() {
    const isStaff = ['ADMIN', 'admin', 'CLERK', 'JUDGE'].includes(currentUser?.role);
    if (isStaff) {
        await loadAdminStats();
    } else {
        await calculateComplainantMetrics();
    }
    await loadComplaintsList();
}

// Compile metrics from citizen's own complaints list
async function calculateComplainantMetrics() {
    try {
        const list = await apiRequest('/api/complaints');
        const total = list.length;
        const pending = list.filter(c => c.status === 'Pending' || c.status === 'Filed').length;
        const progress = list.filter(c => c.status === 'In Progress' || c.status === 'Under Review').length;
        const resolved = list.filter(c => c.status === 'Resolved').length;

        document.getElementById('metric-total-val').textContent = total;
        document.getElementById('metric-pending-val').textContent = pending;
        document.getElementById('metric-progress-val').textContent = progress;
        document.getElementById('metric-resolved-val').textContent = resolved;
    } catch (error) {
        console.error('Failed to calculate citizen metrics:', error);
    }
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
            const isStaff = ['ADMIN', 'CLERK', 'JUDGE'].includes(currentUser?.role?.toUpperCase());
            const activeRole = currentUser?.role?.toUpperCase();

            let adminControls = '';
            if (isStaff) {
                adminControls = '<div class="card-admin-actions">';
                if (activeRole === 'ADMIN') {
                    adminControls += `
                        <button class="tiny-btn" onclick="event.stopPropagation(); adminReject(${item.id})">Reject</button>
                        <button class="tiny-btn" onclick="event.stopPropagation(); adminEdit(${item.id})">Edit</button>
                        <button class="tiny-btn" onclick="event.stopPropagation(); adminDelete(${item.id})">Delete</button>
                     `;
                } else if (activeRole === 'JUDGE') {
                    adminControls += `<button class="tiny-btn" onclick="event.stopPropagation(); openDetailsInspector(${item.id})">Adjudicate</button>`;
                } else if (activeRole === 'CLERK') {
                    adminControls += `<button class="tiny-btn" onclick="event.stopPropagation(); openDetailsInspector(${item.id})">Manage</button>`;
                }
                adminControls += '</div>';
            }

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

        // Complainant Location/Contact
        document.getElementById('inspect-comp-phone').textContent = c.complainant_phone || 'None provided';
        document.getElementById('inspect-comp-location').textContent = [c.complainant_woreda, c.complainant_region, c.complainant_country].filter(Boolean).join(', ') || 'N/A';

        // Respondent Location/Contact
        const respContactList = [];
        if (c.respondent_phone) respContactList.push(c.respondent_phone);
        if (c.respondent_email) respContactList.push(c.respondent_email);
        document.getElementById('inspect-resp-contact').textContent = respContactList.length > 0 ? respContactList.join(' | ') : 'None provided';
        document.getElementById('inspect-resp-location').textContent = [c.respondent_woreda, c.respondent_region, c.respondent_country].filter(Boolean).join(', ') || 'N/A';

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

        // Show citizen edit button if eligible
        if (currentUser && currentUser.role === 'CITIZEN' && c.user_id === currentUser.id && (c.status === 'Filed' || c.status === 'Pending')) {
            document.getElementById('citizen-edit-btn').classList.remove('hidden');
        } else if (document.getElementById('citizen-edit-btn')) {
            document.getElementById('citizen-edit-btn').classList.add('hidden');
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

// Render dynamic chat messages in the chat panel
function renderTimelineRemarks(remarks) {
    const container = document.getElementById('chat-messages-list');
    const empty = document.getElementById('chat-empty-state');
    if (!container) return;
    container.innerHTML = '';

    if (!remarks || remarks.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.id = 'chat-empty-state';
        emptyEl.style.cssText = 'text-align:center; color:var(--text-muted); font-size:0.85rem; margin:auto;';
        emptyEl.textContent = 'No messages yet. Start the conversation below.';
        container.appendChild(emptyEl);
        return;
    }

    const roleColors = {
        'ADMIN': { bg: '#ffe0b2', accent: '#e65100', label: '🛡️ Admin' },
        'admin': { bg: '#ffe0b2', accent: '#e65100', label: '🛡️ Admin' },
        'CLERK': { bg: '#e3f2fd', accent: '#0d47a1', label: '📋 Clerk' },
        'JUDGE': { bg: '#e8f5e9', accent: '#1b5e20', label: '⚖️ Judge' },
        'CITIZEN': { bg: '#f3e5f5', accent: '#6a1b9a', label: '👤 Citizen' },
    };

    remarks.forEach(r => {
        const style = roleColors[r.role] || { bg: '#f5f5f5', accent: '#333', label: r.role };
        const bubble = document.createElement('div');
        bubble.style.cssText = `
            background: ${style.bg};
            border-left: 3px solid ${style.accent};
            border-radius: 8px;
            padding: 0.5rem 0.75rem;
            max-width: 90%;
            align-self: ${['CITIZEN'].includes(r.role) ? 'flex-start' : 'flex-end'};
        `;
        bubble.innerHTML = `
            <div style="display:flex; justify-content:space-between; gap:1rem; margin-bottom:3px; font-size:0.78rem;">
                <span style="font-weight:700; color:${style.accent};">${style.label} — ${escapeHTML(r.username)}</span>
                <span style="color:#999; white-space:nowrap;">${formatDate(r.created_at)}</span>
            </div>
            <div style="font-size:0.9rem; color:#333; white-space:pre-wrap;">${escapeHTML(r.remark)}</div>
        `;
        container.appendChild(bubble);
    });

    // Scroll to bottom after render
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

// Post feedback comments (legacy form, still works if markup exists)
async function handlePostRemark(event) {
    event.preventDefault();
    const remarkBox = document.getElementById('remark-textarea');
    const remarkStr = remarkBox ? remarkBox.value : '';
    if (!currentComplaintId || !remarkStr.trim()) return;
    try {
        await apiRequest(`/api/complaints/${currentComplaintId}/remarks`, {
            method: 'POST', body: JSON.stringify({ remark: remarkStr })
        });
        if (remarkBox) remarkBox.value = '';
        await openDetailsInspector(currentComplaintId);
        showToast('Remark submitted successfully.');
    } catch (error) {
        showToast(error.message || 'Failed to submit comment feedback', true);
    }
}

// Send chat message from the new inline chat panel
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input ? input.value.trim() : '';
    if (!currentComplaintId || !msg) return;
    input.disabled = true;
    try {
        await apiRequest(`/api/complaints/${currentComplaintId}/remarks`, {
            method: 'POST',
            body: JSON.stringify({ remark: msg })
        });
        input.value = '';
        // Re-fetch and re-render
        const data = await apiRequest(`/api/complaints/${currentComplaintId}`);
        renderTimelineRemarks(data.remarks);
    } catch (error) {
        showToast(error.message || 'Failed to send message', true);
    } finally {
        input.disabled = false;
        input.focus();
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

// Step Wizard Logic
function nextWizardStep(step, currentStepToValidate = null) {
    if (currentStepToValidate !== null) {
        const currentStepEl = document.getElementById(`wizard-step-${currentStepToValidate}`);
        if (currentStepEl) {
            const inputs = currentStepEl.querySelectorAll('input, select, textarea');
            for (let input of inputs) {
                if (!input.checkValidity()) {
                    input.reportValidity();
                    return; // Stop advancing if validation fails
                }
            }
        }
    }
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`wizard-step-${i}`);
        if (stepEl) stepEl.classList.add('hidden');

        const prog = document.getElementById(`prog-${i}`);
        if (prog) {
            if (i === step) {
                prog.style.fontWeight = 'bold';
                prog.style.color = 'var(--color-primary)';
            } else {
                prog.style.fontWeight = 'normal';
                prog.style.color = 'var(--text-muted)';
            }
        }
    }
    const targetStep = document.getElementById(`wizard-step-${step}`);
    if (targetStep) targetStep.classList.remove('hidden');
}

// File Ticket submission using FormData for attachments handling
async function handleFileComplaint(event) {
    event.preventDefault();

    const title = document.getElementById('comp-title').value;
    const category = document.getElementById('comp-category').value;
    const courtName = document.getElementById('comp-court-name').value;
    const caseNumber = document.getElementById('comp-case-number').value;
    const hearingDate = document.getElementById('comp-hearing-date').value;
    const complainantName = document.getElementById('comp-complainant-name').value;
    const respondentName = document.getElementById('comp-respondent-name').value;
    const complainantAddress = document.getElementById('comp-complainant-address').value;
    const description = document.getElementById('comp-description').value;

    const complainantPhone = document.getElementById('comp-complainant-phone').value;
    const complainantCountry = document.getElementById('comp-complainant-country').value;
    const complainantRegion = document.getElementById('comp-complainant-region').value;
    const complainantWoreda = document.getElementById('comp-complainant-woreda').value;

    const respondentPhone = document.getElementById('comp-respondent-phone').value;
    const respondentEmail = document.getElementById('comp-respondent-email').value;
    const respondentCountry = document.getElementById('comp-respondent-country').value;
    const respondentRegion = document.getElementById('comp-respondent-region').value;
    const respondentWoreda = document.getElementById('comp-respondent-woreda').value;

    const fileInput = document.getElementById('comp-attachment');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('court_name', courtName);
    formData.append('case_number', caseNumber);
    formData.append('hearing_date', hearingDate);
    formData.append('complainant_name', complainantName);
    formData.append('respondent_name', respondentName);
    formData.append('complainant_address', complainantAddress);
    formData.append('description', description);

    formData.append('complainant_phone', complainantPhone);
    formData.append('complainant_country', complainantCountry);
    formData.append('complainant_region', complainantRegion);
    formData.append('complainant_woreda', complainantWoreda);

    formData.append('respondent_phone', respondentPhone);
    formData.append('respondent_email', respondentEmail);
    formData.append('respondent_country', respondentCountry);
    formData.append('respondent_region', respondentRegion);
    formData.append('respondent_woreda', respondentWoreda);

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

        // Return to wizard step 1
        nextWizardStep(1);

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
function switchNav(tab, overrideStatus = null) {
    activeNavTab = tab;

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(el => el.classList.remove('active'));

    const statusFilter = document.getElementById('filter-status');
    const titleEl = document.getElementById('workspace-title');
    const isStaff = ['ADMIN', 'admin', 'CLERK', 'JUDGE'].includes(currentUser?.role);

    if (tab === 'dashboard') {
        document.getElementById('nav-dashboard').classList.add('active');
        statusFilter.value = '';
        titleEl.textContent = 'Overview';

        document.getElementById('metrics-panel').classList.remove('hidden');
        if (isStaff) document.getElementById('admin-charts-section').classList.remove('hidden');
    } else if (tab === 'complaints') {
        document.getElementById('nav-all-complaints').classList.add('active');

        if (overrideStatus !== null) {
            statusFilter.value = overrideStatus;
        } else {
            statusFilter.value = '';
        }

        let headerText = 'Total Active Complaints';
        const activeRole = currentUser?.role || '';

        if (overrideStatus) headerText = overrideStatus + ' Complaints';
        else if (activeRole === 'CLERK') headerText = 'Registry Intake Queue';
        else if (activeRole === 'JUDGE') headerText = 'Judicial Caseload';

        titleEl.textContent = headerText;

        // Hide top metrics to give a clean "open list" view
        document.getElementById('metrics-panel').classList.add('hidden');
        document.getElementById('admin-charts-section').classList.add('hidden');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'new' && (!isStaff)) {
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

async function citizenEdit() {
    if (!currentComplaintId) return;
    try {
        const data = await apiRequest(`/api/complaints/${currentComplaintId}`);
        const c = data.complaint;
        if (c.status !== 'Filed' && c.status !== 'Pending') {
            showToast('Cannot edit complaint after it is officially accepted.', true);
            return;
        }

        const title = prompt('Edit Title:', c.title);
        if (title === null) return;
        const category = prompt('Edit Category (Civil, Criminal, Family, Administrative, Other):', c.category);
        if (category === null) return;
        const description = prompt('Edit Description:', c.description);
        if (description === null) return;

        await apiRequest(`/api/complaints/${currentComplaintId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title, category, description })
        });
        showToast('Complaint updated successfully');
        await openDetailsInspector(currentComplaintId);
        await refreshDashboardData();
    } catch (err) {
        showToast(err.message || 'Edit failed', true);
    }
}

// ==========================================
// Specialized Roles Frontend Handlers
// ==========================================

async function openScheduleHearing() {
    if (!currentComplaintId) return;

    const hearing_type = prompt('Enter Hearing Type (Preliminary, Substantive, Interim, Final, Judgment):', 'Preliminary');
    if (!hearing_type) return;

    const session_date = prompt('Enter Hearing Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!session_date) return;

    const session_time = prompt('Enter Hearing Time (e.g. 10:00 AM):');
    const judge_name = prompt('Assign Judge Name:');
    const courtroom = prompt('Enter Courtroom:');

    try {
        await apiRequest('/api/clerk/schedule', {
            method: 'POST',
            body: JSON.stringify({
                complaint_id: currentComplaintId,
                hearing_type,
                session_date,
                session_time,
                judge_name,
                courtroom
            })
        });
        showToast('Hearing scheduled successfully.');
        await openDetailsInspector(currentComplaintId);
        await refreshDashboardData();
    } catch (err) {
        showToast(err.message || 'Failed to schedule hearing.', true);
    }
}

async function openIssueJudgment() {
    if (!currentComplaintId) return;

    const order_type = prompt('Enter Order Type (Interim, Final Judgment, Dismissal, Settlement, Appeal):', 'Interim');
    if (!order_type) return;

    const order_details = prompt('Enter Order/Judgment Details:');
    if (!order_details) return;

    let statusUpdate = confirm('Would you like to automatically mark this case as Resolved / Closed?');
    const status = statusUpdate ? 'Resolved' : null;

    try {
        await apiRequest('/api/judge/adjudicate', {
            method: 'POST',
            body: JSON.stringify({
                complaint_id: currentComplaintId,
                order_type,
                order_details,
                status
            })
        });
        showToast('Judgment/Order issued successfully.');
        await openDetailsInspector(currentComplaintId);
        await refreshDashboardData();
    } catch (err) {
        showToast(err.message || 'Failed to issue judgment.', true);
    }
}

async function openConfidentialNotes() {
    if (!currentComplaintId) return;

    const isNew = confirm('Press OK to write a new confidential note. Press Cancel to ignore.');
    if (isNew) {
        const note_text = prompt('Enter your private note:');
        if (!note_text) return;
        try {
            await apiRequest('/api/judge/notes', {
                method: 'POST',
                body: JSON.stringify({ complaint_id: currentComplaintId, note_text })
            });
            showToast('Note added.');
        } catch (err) {
            showToast(err.message || 'Failed to add note.', true);
            return;
        }
    }

    // Attempt to view past notes
    try {
        const notes = await apiRequest(`/api/judge/notes/${currentComplaintId}`);
        if (notes.length === 0) {
            alert('No confidential case notes found.');
        } else {
            const formatted = notes.map(n => `[${formatDate(n.created_at)}] ${n.note_text}`).join('\n\n');
            alert(`Confidential Notes:\n\n${formatted}`);
        }
    } catch (err) {
        showToast('Only Judges have access to confidential notes.', true);
    }
}
