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

    // Populate country dropdowns
    const countries = ["Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Côte d'Ivoire", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini (fmr. Swaziland)", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Holy See", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"];
    const compCountry = document.getElementById('comp-complainant-country');
    const respCountry = document.getElementById('comp-respondent-country');
    if (compCountry && respCountry) {
        countries.forEach(c => {
            compCountry.add(new Option(c, c));
            respCountry.add(new Option(c, c));
        });
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

        // Hide wizard on main dashboard view by default
        const wizardForm = document.getElementById('file-complaint-section');
        const workspace = document.querySelector('.complaints-workspace');
        if (wizardForm) wizardForm.style.display = 'none';
        if (workspace) workspace.style.gridTemplateColumns = '1fr';
    }

    // Load stats & tickets
    refreshDashboardData();

    // Start polling for notifications if Staff
    if (isStaff) {
        startNotificationPolling();
    }
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
        // metric-total-val shows permanent "ever filed" count from the append-only ledger
        document.getElementById('metric-total-val').textContent = stats.summary.totalFiled ?? stats.summary.total;
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

// (duplicate calculateComplainantMetrics removed — using correct version above)

// Fetch lists of complaints matching filter requirements
async function loadComplaintsList() {
    const container = document.getElementById('complaints-list');
    const searchVal = document.getElementById('search-input').value;
    const categoryVal = document.getElementById('filter-category').value;
    const statusVal = document.getElementById('filter-status').value;
    const regionVal = document.getElementById('filter-region') ? document.getElementById('filter-region').value : '';

    container.innerHTML = '<div class="no-complaints">Filtering issues database...</div>';

    try {
        // Construct query parameters
        const params = new URLSearchParams();
        if (searchVal) params.append('search', searchVal);
        if (categoryVal) params.append('category', categoryVal);
        if (statusVal) params.append('status', statusVal);
        if (regionVal) params.append('region', regionVal);

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
        container.innerHTML = `<div class="no-complaints error">Failed to synchronize logs from system API: ${error.message}</div>`;
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
        const orders = data.orders || [];

        // Populates fields
        document.getElementById('inspect-title-text').textContent = c.title;
        document.getElementById('inspect-ref-id').textContent = `#${c.id}`;
        document.getElementById('inspect-category').textContent = c.category;
        document.getElementById('inspect-court-name').textContent = c.court_name;
        document.getElementById('inspect-court-address').textContent = c.court_address || '';
        document.getElementById('inspect-case-number').textContent = c.case_number;
        document.getElementById('inspect-parties').textContent = c.parties || 'N/A';
        document.getElementById('inspect-hearing-date').textContent = c.hearing_date || 'N/A';
        document.getElementById('inspect-complainant').textContent = `${c.complainant_name} (${c.complainant_email})`;
        document.getElementById('inspect-date').textContent = formatDate(c.created_at);
        document.getElementById('inspect-desc-text').textContent = c.description;

        // Complainant Location/Contact
        document.getElementById('inspect-comp-phone').textContent = c.complainant_phone || 'None provided';
        document.getElementById('inspect-comp-location').textContent = [c.complainant_kebele ? `Kebele ${c.complainant_kebele}` : null, c.complainant_woreda, c.complainant_region, c.complainant_country].filter(Boolean).join(', ') || 'N/A';
        document.getElementById('inspect-comp-language').textContent = c.complainant_language || 'N/A';

        // Respondent Location/Contact
        const respContactList = [];
        if (c.respondent_phone) respContactList.push(c.respondent_phone);
        if (c.respondent_email) respContactList.push(c.respondent_email);
        document.getElementById('inspect-resp-contact').textContent = respContactList.length > 0 ? respContactList.join(' | ') : 'None provided';
        document.getElementById('inspect-resp-location').textContent = [c.respondent_kebele ? `Kebele ${c.respondent_kebele}` : null, c.respondent_woreda, c.respondent_region, c.respondent_country].filter(Boolean).join(', ') || 'N/A';
        document.getElementById('inspect-resp-language').textContent = c.respondent_language || 'N/A';

        const staffLangRow = document.getElementById('inspector-staff-language-row');
        if (staffLangRow) {
            if (c.clerk_language || c.judge_language || ['admin', 'ADMIN', 'CLERK', 'JUDGE'].includes(currentUser?.role)) {
                staffLangRow.style.display = 'flex';
                document.getElementById('inspect-clerk-language').textContent = c.clerk_language || 'Not set';
                document.getElementById('inspect-judge-language').textContent = c.judge_language || 'Not set';
            } else {
                staffLangRow.style.display = 'none';
            }
        }

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

        // National ID links (staff only: Clerk, Judge, Admin)
        const isStaffViewer = currentUser && ['ADMIN', 'admin', 'CLERK', 'JUDGE'].includes(currentUser.role);
        const nationalIdContainer = document.getElementById('inspect-national-id-container');
        const complainantIdRow = document.getElementById('inspect-complainant-id-row');
        const respondentIdRow = document.getElementById('inspect-respondent-id-row');
        if (nationalIdContainer && isStaffViewer) {
            nationalIdContainer.classList.remove('hidden');
            if (c.complainant_national_id) {
                complainantIdRow.classList.remove('hidden');
                document.getElementById('inspect-complainant-id-link').href = `/api/complaints/${c.id}/complainant_national_id`;
            } else {
                complainantIdRow.classList.add('hidden');
            }
            if (c.respondent_national_id) {
                respondentIdRow.classList.remove('hidden');
                document.getElementById('inspect-respondent-id-link').href = `/api/complaints/${c.id}/respondent_national_id`;
            } else {
                respondentIdRow.classList.add('hidden');
            }
        } else if (nationalIdContainer) {
            nationalIdContainer.classList.add('hidden');
        }

        // Show citizen edit button if eligible
        if (currentUser && currentUser.role === 'CITIZEN' && c.user_id === currentUser.id && (c.status === 'Filed' || c.status === 'Pending')) {
            document.getElementById('citizen-edit-btn').classList.remove('hidden');
        } else if (document.getElementById('citizen-edit-btn')) {
            document.getElementById('citizen-edit-btn').classList.add('hidden');
        }

        // Show Clerk "Serve Notice" button if not yet served
        const serveBtn = document.getElementById('clerk-serve-btn');
        if (serveBtn) {
            const roleUpper = (currentUser?.role || '').toUpperCase();
            const isClerkOrAdmin = ['CLERK', 'ADMIN'].includes(roleUpper);
            if (isClerkOrAdmin && !c.is_served) {
                serveBtn.classList.remove('hidden');
            } else {
                serveBtn.classList.add('hidden');
            }
        }

        // Render Orders & Judgments
        const ordersContainer = document.getElementById('inspect-orders');
        if (ordersContainer) {
            if (orders && orders.length > 0) {
                document.getElementById('inspector-orders-section').classList.remove('hidden');
                ordersContainer.innerHTML = orders.map(o => `
                    <div style="background:var(--bg-main, #15171e); border-left:3px solid var(--primary, #7c69ef); padding:0.75rem; border-radius:6px;">
                        <div style="font-weight:600; font-size:0.95rem; margin-bottom:0.25rem;">${escapeHTML(o.order_type)}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.4rem;">${formatDate(o.created_at)} — Judge: ${escapeHTML(o.judge_name)}</div>
                        <div style="font-size:0.88rem; color:var(--text-main);">${escapeHTML(o.order_details)}</div>
                    </div>
                `).join('');
            } else {
                document.getElementById('inspector-orders-section').classList.add('hidden');
                ordersContainer.innerHTML = '';
            }
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

    const result = await Swal.fire({
        title: 'Delete Complaint?',
        text: "Are you sure you want to permanently delete this complaint? This cannot be undone.",
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#ff4d4f',
        cancelButtonColor: '#3a3a4a',
        confirmButtonText: 'Yes, delete it'
    });

    if (!result.isConfirmed) return;

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

        let extraFields = '';
        if (currentUser.role === 'CLERK') {
            extraFields = `<input id="swal-clerk-lang" class="swal2-input" placeholder="Clerk Language (Oromic, English, Amharic)" value="${c.clerk_language || ''}">`;
        } else if (currentUser.role === 'JUDGE') {
            extraFields = `<input id="swal-judge-lang" class="swal2-input" placeholder="Judge Language (Oromic, English, Amharic)" value="${c.judge_language || ''}">`;
        }

        const { value: formValues } = await Swal.fire({
            title: 'Edit Complaint Details',
            html:
                `<input id="swal-title" class="swal2-input" placeholder="Title" value="${escapeHTML(c.title || '')}">` +
                `<select id="swal-category" class="swal2-input">
                    <option value="Civil" ${c.category === 'Civil' ? 'selected' : ''}>Civil</option>
                    <option value="Criminal" ${c.category === 'Criminal' ? 'selected' : ''}>Criminal</option>
                    <option value="Family" ${c.category === 'Family' ? 'selected' : ''}>Family</option>
                    <option value="Administrative" ${c.category === 'Administrative' ? 'selected' : ''}>Administrative</option>
                    <option value="Other" ${c.category === 'Other' ? 'selected' : ''}>Other</option>
                </select>` +
                `<select id="swal-priority" class="swal2-input">
                    <option value="Low" ${c.priority === 'Low' ? 'selected' : ''}>Low Priority</option>
                    <option value="Medium" ${c.priority === 'Medium' ? 'selected' : ''}>Medium Priority</option>
                    <option value="High" ${c.priority === 'High' ? 'selected' : ''}>High Priority</option>
                </select>` +
                `<textarea id="swal-desc" class="swal2-textarea" placeholder="Description">${escapeHTML(c.description || '')}</textarea>` +
                extraFields,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Save Changes',
            preConfirm: () => {
                return {
                    title: document.getElementById('swal-title').value,
                    category: document.getElementById('swal-category').value,
                    priority: document.getElementById('swal-priority').value,
                    description: document.getElementById('swal-desc').value,
                    clerk_language: document.getElementById('swal-clerk-lang') ? document.getElementById('swal-clerk-lang').value : (c.clerk_language || ''),
                    judge_language: document.getElementById('swal-judge-lang') ? document.getElementById('swal-judge-lang').value : (c.judge_language || '')
                }
            }
        });

        if (!formValues || !formValues.title) return;

        // Send update to server
        await apiRequest(`/api/complaints/${currentComplaintId}`, {
            method: 'PATCH',
            body: JSON.stringify(formValues)
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
    const courtAddress = document.getElementById('comp-court-address').value;
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
    const complainantKebele = document.getElementById('comp-complainant-kebele')?.value || '';
    const complainantLanguage = document.getElementById('comp-complainant-language')?.value || '';

    const respondentPhone = document.getElementById('comp-respondent-phone').value;
    const respondentEmail = document.getElementById('comp-respondent-email').value;
    const respondentCountry = document.getElementById('comp-respondent-country').value;
    const respondentRegion = document.getElementById('comp-respondent-region').value;
    const respondentWoreda = document.getElementById('comp-respondent-woreda').value;
    const respondentKebele = document.getElementById('comp-respondent-kebele')?.value || '';
    const respondentLanguage = document.getElementById('comp-respondent-language')?.value || '';

    const fileInput = document.getElementById('comp-attachment');
    const certInput = document.getElementById('comp-low-income-cert');
    const nationalIdInput = document.getElementById('comp-national-id');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (!nationalIdInput || !nationalIdInput.files || nationalIdInput.files.length === 0) {
        showToast('National ID attachment is required. Please upload your National ID.', true);
        nextWizardStep(4);
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('court_name', courtName);
    formData.append('court_address', courtAddress);
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
    formData.append('complainant_kebele', complainantKebele);
    formData.append('complainant_language', complainantLanguage);

    formData.append('respondent_phone', respondentPhone);
    formData.append('respondent_email', respondentEmail);
    formData.append('respondent_country', respondentCountry);
    formData.append('respondent_region', respondentRegion);
    formData.append('respondent_woreda', respondentWoreda);
    formData.append('respondent_kebele', respondentKebele);
    formData.append('respondent_language', respondentLanguage);

    formData.append('national_id', nationalIdInput.files[0]);

    if (fileInput.files.length > 0) {
        formData.append('attachment', fileInput.files[0]);
    }

    if (certInput && certInput.files && certInput.files.length > 0) {
        formData.append('low_income_cert', certInput.files[0]);
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
function fileSelectedNotify(input, infoId = 'file-name-info', textId = 'upload-instruction') {
    const info = document.getElementById(infoId);
    const textVal = document.getElementById(textId);

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

    // Reset visibility of main columns
    const listContainer = document.querySelector('.list-section');
    const wizardForm = document.getElementById('file-complaint-section');
    const workspace = document.querySelector('.complaints-workspace');

    if (listContainer) listContainer.style.display = 'block';
    if (wizardForm) wizardForm.style.display = 'none';
    if (workspace) workspace.style.gridTemplateColumns = '1.6fr 1fr';

    if (tab === 'dashboard') {
        document.getElementById('nav-dashboard')?.classList.add('active');
        statusFilter.value = '';
        titleEl.textContent = 'Overview';

        document.getElementById('metrics-panel').classList.remove('hidden');
        if (isStaff) {
            document.getElementById('admin-charts-section').classList.remove('hidden');
        } else {
            // Hide the wizard on the dashboard view for citizens
            if (wizardForm) {
                wizardForm.style.display = 'none';
            }
            if (workspace) {
                workspace.style.gridTemplateColumns = '1fr';
            }
        }
    } else if (tab === 'complaints') {
        document.getElementById('nav-all-complaints')?.classList.add('active');

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

        // Make the list take full width, hide wizard
        if (workspace) workspace.style.gridTemplateColumns = '1fr';

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'new' && (!isStaff)) {
        document.getElementById('nav-new-complaint')?.classList.add('active');
        titleEl.textContent = 'Submit New Ticket';

        document.getElementById('metrics-panel').classList.add('hidden');

        // Hide the list, show the wizard full width
        if (listContainer) listContainer.style.display = 'none';
        if (workspace) workspace.style.gridTemplateColumns = '1fr';
        if (wizardForm) {
            wizardForm.style.display = 'block';
            wizardForm.classList.remove('hidden');
        }
    }

    loadComplaintsList();
}

// Sync mobile bottom nav active state
function setMobNavActive(activeId) {
    document.querySelectorAll('.mob-nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(activeId);
    if (activeBtn) activeBtn.classList.add('active');
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
            // Use replace() so the dashboard is removed from browser history.
            // The back button will NOT be able to return to this page after logout.
            window.location.replace('/');
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

        const { value: formValues } = await Swal.fire({
            title: 'Edit Complaint',
            html:
                `<input id="swal-title" class="swal2-input" placeholder="Title" value="${escapeHTML(c.title || '')}">` +
                `<select id="swal-category" class="swal2-input">
                    <option value="Civil" ${c.category === 'Civil' ? 'selected' : ''}>Civil</option>
                    <option value="Criminal" ${c.category === 'Criminal' ? 'selected' : ''}>Criminal</option>
                    <option value="Family" ${c.category === 'Family' ? 'selected' : ''}>Family</option>
                    <option value="Administrative" ${c.category === 'Administrative' ? 'selected' : ''}>Administrative</option>
                    <option value="Other" ${c.category === 'Other' ? 'selected' : ''}>Other</option>
                </select>` +
                `<textarea id="swal-desc" class="swal2-textarea" placeholder="Description">${escapeHTML(c.description || '')}</textarea>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Save Changes',
            preConfirm: () => {
                return {
                    title: document.getElementById('swal-title').value,
                    category: document.getElementById('swal-category').value,
                    description: document.getElementById('swal-desc').value
                }
            }
        });

        if (!formValues || !formValues.title) return;

        await apiRequest(`/api/complaints/${currentComplaintId}`, {
            method: 'PATCH',
            body: JSON.stringify(formValues)
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

    const { value: formValues } = await Swal.fire({
        title: 'Schedule Hearing',
        html:
            '<input id="swal-type" class="swal2-input" placeholder="Hearing Type (Preliminary, etc.)" value="Preliminary">' +
            '<input id="swal-date" type="date" class="swal2-input" value="' + new Date().toISOString().split('T')[0] + '">' +
            '<input id="swal-time" type="time" class="swal2-input" value="10:00">' +
            '<input id="swal-judge" class="swal2-input" placeholder="Judge Name">' +
            '<input id="swal-court" class="swal2-input" placeholder="Courtroom">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Schedule',
        preConfirm: () => {
            return {
                hearing_type: document.getElementById('swal-type').value,
                session_date: document.getElementById('swal-date').value,
                session_time: document.getElementById('swal-time').value,
                judge_name: document.getElementById('swal-judge').value,
                courtroom: document.getElementById('swal-court').value
            }
        }
    });

    if (!formValues || !formValues.hearing_type) return;

    try {
        await apiRequest('/api/clerk/schedule', {
            method: 'POST',
            body: JSON.stringify({
                complaint_id: currentComplaintId,
                ...formValues
            })
        });
        showToast('Hearing scheduled successfully.');
        await openDetailsInspector(currentComplaintId);
        await refreshDashboardData();
    } catch (err) {
        showToast(err.message || 'Failed to schedule hearing.', true);
    }
}

async function serveComplaint() {
    if (!currentComplaintId) return;

    const result = await Swal.fire({
        title: 'Serve Complaint?',
        text: "Are you sure you want to officially serve this complaint to the respondent? They will be notified immediately via SMS/Email.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3fb950',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, serve notice'
    });

    if (!result.isConfirmed) return;

    try {
        await apiRequest('/api/clerk/serve', {
            method: 'POST',
            body: JSON.stringify({ complaint_id: currentComplaintId })
        });
        showToast('Complaint successfully served to respondent.');
        await openDetailsInspector(currentComplaintId);
        await refreshDashboardData();
    } catch (err) {
        showToast(err.message || 'Failed to serve complaint.', true);
    }
}

// ===== Delete Complaint (Admin only) =====
async function deleteComplaintAPI() {
    if (!currentComplaintId) return;
    if (!confirm('Are you sure you want to completely delete this complaint? This cannot be undone.')) {
        return;
    }

    try {
        await apiRequest(`/api/complaints/${currentComplaintId}`, {
            method: 'DELETE'
        });
        showToast('Complaint deleted successfully', false);
        closeDetailsInspector();
        await refreshDashboardData();
    } catch (err) {
        showToast(err.message || 'Failed to delete complaint', true);
    }
}


// State variables for the AI SMS modal judgment flow
let _pendingJudgmentData = null;

async function openIssueJudgment() {
    if (!currentComplaintId) return;

    const { value: formValues } = await Swal.fire({
        title: 'Issue Judgment / Order',
        html:
            '<select id="swal-order-type" class="swal2-input">' +
            '<option value="Final Judgment">Final Judgment</option>' +
            '<option value="Interim Order">Interim Order</option>' +
            '<option value="Dismissal">Dismissal</option>' +
            '<option value="Settlement">Settlement</option>' +
            '<option value="Appeal">Appeal</option>' +
            '</select>' +
            '<textarea id="swal-order-details" class="swal2-textarea" placeholder="Enter Order/Judgment Details here..." style="width: 80%; height: 120px;"></textarea>' +
            '<div style="text-align: left; padding: 10px 20px;">' +
            '<label><input type="checkbox" id="swal-status-update" checked> Mark this case as Resolved / Closed after issuing judgment</label>' +
            '</div>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Preview & Send',
        preConfirm: () => {
            const details = document.getElementById('swal-order-details').value;
            if (!details) {
                Swal.showValidationMessage('Order details cannot be empty');
            }
            return {
                order_type: document.getElementById('swal-order-type').value,
                order_details: details,
                statusUpdate: document.getElementById('swal-status-update').checked
            }
        }
    });

    if (!formValues || !formValues.order_details) return;

    const status = formValues.statusUpdate ? 'Resolved' : null;
    const { order_type, order_details } = formValues;

    // Store pending judgment data
    _pendingJudgmentData = { complaint_id: currentComplaintId, order_type, order_details, status };

    // Show the AI SMS Preview modal
    const modal = document.getElementById('ai-sms-modal');
    const phoneEl = document.getElementById('ai-sms-phone');
    const recipientEl = document.getElementById('ai-sms-recipient-name');
    const smsTextEl = document.getElementById('ai-sms-text');
    const charCountEl = document.getElementById('ai-sms-char-count');
    const aiBadge = document.getElementById('ai-sms-ai-badge');
    const noPhoneNote = document.getElementById('ai-sms-no-phone-note');
    const confirmBtn = document.getElementById('ai-sms-confirm-btn');

    // Show modal with loading state
    smsTextEl.value = '⏳ Generating AI message...';
    smsTextEl.disabled = true;
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Generating...';
    noPhoneNote.style.display = 'none';
    aiBadge.style.display = 'none';
    modal.style.display = 'flex';

    try {
        const params = new URLSearchParams({
            complaint_id: currentComplaintId,
            order_type,
            order_details
        });
        const preview = await apiRequest(`/api/judge/sms-preview?${params.toString()}`);

        if (!preview.phone || !preview.sms) {
            // No phone number — show warning but allow judgment
            noPhoneNote.style.display = 'block';
            phoneEl.textContent = 'N/A';
            recipientEl.textContent = '';
            smsTextEl.value = '';
            smsTextEl.disabled = true;
            confirmBtn.textContent = '⚖️ Confirm Judgment (No SMS)';
        } else {
            phoneEl.textContent = preview.phone;
            recipientEl.textContent = preview.respondent || '';
            smsTextEl.value = preview.sms;
            smsTextEl.disabled = false;
            charCountEl.textContent = preview.sms.length;
            if (preview.aiGenerated) {
                aiBadge.style.display = 'inline-block';
            }
            confirmBtn.textContent = '⚖️ Confirm & Send SMS';
        }
    } catch (err) {
        smsTextEl.value = 'Failed to generate preview. The judgment will still be saved.';
        confirmBtn.textContent = '⚖️ Confirm Judgment';
    }

    smsTextEl.oninput = () => {
        charCountEl.textContent = smsTextEl.value.length;
    };

    smsTextEl.disabled = false;
    confirmBtn.disabled = false;
}

function cancelAiSmsModal() {
    const modal = document.getElementById('ai-sms-modal');
    modal.style.display = 'none';
    _pendingJudgmentData = null;
}

async function confirmJudgmentWithSms() {
    if (!_pendingJudgmentData) return;

    const confirmBtn = document.getElementById('ai-sms-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Saving...';

    // Get the exact text the judge reviewed/edited
    const custom_sms_text = document.getElementById('ai-sms-text').value;

    try {
        await apiRequest('/api/judge/adjudicate', {
            method: 'POST',
            body: JSON.stringify({
                ..._pendingJudgmentData,
                custom_sms_text
            })
        });

        // Close modal
        document.getElementById('ai-sms-modal').style.display = 'none';
        _pendingJudgmentData = null;

        showToast('✅ Judgment issued. AI SMS dispatched to respondent.');
        await openDetailsInspector(currentComplaintId);
        await refreshDashboardData();
    } catch (err) {
        showToast(err.message || 'Failed to issue judgment.', true);
        confirmBtn.disabled = false;
        confirmBtn.textContent = '⚖️ Confirm & Send SMS';
    }
}

async function openConfidentialNotes() {
    if (!currentComplaintId) return;

    const result = await Swal.fire({
        title: 'Confidential Notes',
        text: 'What would you like to do?',
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Write New Note',
        denyButtonText: 'View Past Notes'
    });

    if (result.isConfirmed) {
        const { value: note_text } = await Swal.fire({
            title: 'New Confidential Note',
            input: 'textarea',
            inputPlaceholder: 'Enter your private note here...',
            showCancelButton: true
        });

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
    } else if (result.isDenied) {
        // Attempt to view past notes
        try {
            const notes = await apiRequest(`/api/judge/notes/${currentComplaintId}`);
            if (notes.length === 0) {
                Swal.fire('No Notes', 'No confidential case notes found.', 'info');
            } else {
                const formatted = notes.map(n => `<b>${formatDate(n.created_at)}</b><br/>${escapeHTML(n.note_text)}`).join('<hr/>');
                Swal.fire({
                    title: 'Confidential Notes',
                    html: `<div style="text-align:left;max-height:400px;overflow-y:auto;font-size:0.9rem;">${formatted}</div>`,
                    width: '600px'
                });
            }
        } catch (err) {
            showToast('Only Judges have access to confidential notes.', true);
        }
    }
}

// ── Virtual Hearing (Jitsi Meet) ──
let jitsiApi = null;

function openVirtualHearing(caseId) {
    if (!caseId) return;
    document.getElementById('jitsi-overlay').classList.remove('hidden');
    document.getElementById('jitsi-panel').classList.remove('hidden');
    document.getElementById('jitsi-panel').style.display = 'flex';
    document.getElementById('jitsi-overlay').style.display = 'block';

    if (jitsiApi) jitsiApi.dispose();

    const domain = 'meet.jit.si';
    const options = {
        roomName: 'CCMS_Hearing_Case_' + caseId + '_JusticeConnect',
        width: '100%',
        height: '100%',
        parentNode: document.querySelector('#jitsi-container'),
        userInfo: {
            displayName: currentUser ? currentUser.username : 'Participant'
        },
        configOverwrite: { prejoinPageEnabled: false },
        interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false }
    };
    jitsiApi = new JitsiMeetExternalAPI(domain, options);
}

function closeJitsiModal() {
    document.getElementById('jitsi-overlay').style.display = 'none';
    document.getElementById('jitsi-panel').style.display = 'none';
    document.getElementById('jitsi-overlay').classList.add('hidden');
    document.getElementById('jitsi-panel').classList.add('hidden');

    if (jitsiApi) {
        jitsiApi.dispose();
        jitsiApi = null;
    }
}

// ── In-App Notifications ──
let notifPollTimer = null;

function startNotificationPolling() {
    fetchNotifications();
    if (notifPollTimer) clearInterval(notifPollTimer);
    notifPollTimer = setInterval(fetchNotifications, 15000);
}

async function fetchNotifications() {
    try {
        const notifications = await apiRequest('/api/notifications');
        const unreadBadge = document.getElementById('unread-count');
        const notifList = document.getElementById('notif-list');

        const unreadCount = notifications.filter(n => !n.is_read).length;
        if (unreadCount > 0) {
            unreadBadge.textContent = unreadCount;
            unreadBadge.style.display = 'block';
        } else {
            unreadBadge.style.display = 'none';
        }

        if (notifications.length === 0) {
            notifList.innerHTML = '<div style="padding:15px; font-size:0.85rem; color:var(--text-muted); text-align:center;">No new notifications</div>';
            return;
        }

        notifList.innerHTML = notifications.map(n => `
            <div onclick="handleNotificationClick(${n.id}, ${n.complaint_id}, ${n.is_read})" style="padding:10px 15px; border-bottom:1px solid var(--border); cursor:pointer; background:${n.is_read ? 'transparent' : 'rgba(255, 255, 255, 0.05)'}; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.85rem;">
                    <div style="font-weight:${n.is_read ? '400' : '600'}; color:var(--text-main); margin-bottom:4px;">${escapeHTML(n.message)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${formatDate(n.created_at)}</div>
                </div>
                ${!n.is_read ? '<div style="width:8px; height:8px; border-radius:50%; background:red;"></div>' : ''}
            </div>
        `).join('');
    } catch (e) {
        console.warn('Failed to fetch notifications', e);
    }
}

function toggleNotifications(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('notif-dropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// Close dropdown if clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notif-dropdown');
    const container = document.getElementById('notification-bell-container');
    if (dropdown && container && !container.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

async function handleNotificationClick(notifId, complaintId, isRead) {
    document.getElementById('notif-dropdown').style.display = 'none';

    // Mark as read if not already
    if (!isRead) {
        try {
            await apiRequest('/api/notifications/' + notifId + '/read', { method: 'PATCH' });
            fetchNotifications(); // refresh badge
        } catch (e) { console.error('Could not mark read', e); }
    }

    // Switch to complaints list and open it
    switchNav('complaints');
    setTimeout(() => {
        openDetailsInspector(complaintId);
    }, 200);
}
