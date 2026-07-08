let currentChatComplaintId = null;
let currentUser = null;
let chatPollInterval = null;

window.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuthSession(false);
    if (!currentUser) return;

    await loadChatTickets();
    document.getElementById('chat-form').addEventListener('submit', handleChatSubmit);
});

async function loadChatTickets() {
    const listContainer = document.getElementById('chat-ticket-list');
    listContainer.innerHTML = '<div class="empty-list-msg">Loading tickets...</div>';

    try {
        const tickets = await apiRequest('/api/complaints');
        if (!tickets || tickets.length === 0) {
            listContainer.innerHTML = '<div class="empty-list-msg">You have no active complaints yet.</div>';
            return;
        }

        listContainer.innerHTML = '';
        tickets.forEach(ticket => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'chat-ticket-item';
            item.innerHTML = `
                <div class="chat-ticket-summary">
                    <span class="ticket-id">#${ticket.id}</span>
                    <span class="ticket-title">${escapeHTML(ticket.title)}</span>
                </div>
                <div class="ticket-meta">
                    <span class="status-badge ${ticket.status === 'Resolved' ? 'status-resolved-badge' : ticket.status === 'In Progress' ? 'status-progress-badge' : 'status-pending-badge'}">${ticket.status}</span>
                    <span class="priority-pill ${ticket.priority === 'Low' ? 'prio-low-badge' : ticket.priority === 'High' ? 'prio-high-badge' : 'prio-med-badge'}">${ticket.priority}</span>
                </div>
            `;
            item.onclick = () => selectChatTicket(ticket.id, ticket.title, ticket.status);
            listContainer.appendChild(item);
        });
    } catch (err) {
        listContainer.innerHTML = '<div class="empty-list-msg">Unable to load chat tickets.</div>';
    }
}

async function selectChatTicket(id, title, status) {
    currentChatComplaintId = id;
    document.getElementById('chat-title').textContent = `Ticket #${id}`;
    document.getElementById('chat-subtitle').textContent = title;
    const statusPill = document.getElementById('chat-status-pill');
    statusPill.textContent = status;
    statusPill.classList.remove('hidden');
    statusPill.className = `status-badge ${status === 'Resolved' ? 'status-resolved-badge' : status === 'In Progress' ? 'status-progress-badge' : 'status-pending-badge'}`;

    await refreshChatMessages();
    startChatPolling();
}

async function refreshChatMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!currentChatComplaintId) {
        messagesContainer.innerHTML = '<div class="empty-list-msg">Select a ticket to see messages.</div>';
        return;
    }

    try {
        const data = await apiRequest(`/api/complaints/${currentChatComplaintId}`);
        const remarks = data.remarks || [];
        if (remarks.length === 0) {
            messagesContainer.innerHTML = '<div class="empty-list-msg">No messages yet. Send the first one.</div>';
            return;
        }

        messagesContainer.innerHTML = '';
        remarks.forEach(remark => {
            const bubble = document.createElement('div');
            bubble.className = `chat-message-bubble ${remark.role === 'admin' ? 'chat-message-admin' : 'chat-message-user'}`;
            bubble.innerHTML = `
                <div class="chat-message-header">
                    <span>${escapeHTML(remark.username)}</span>
                    <span>${formatDate(remark.created_at)}</span>
                </div>
                <div class="chat-message-body">${escapeHTML(remark.remark)}</div>
            `;
            messagesContainer.appendChild(bubble);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (err) {
        messagesContainer.innerHTML = '<div class="empty-list-msg">Failed to load chat messages.</div>';
    }
}

async function handleChatSubmit(event) {
    event.preventDefault();
    if (!currentChatComplaintId) {
        showToast('Please select a ticket before sending a message.', true);
        return;
    }

    const input = document.getElementById('chat-message-input');
    const message = input.value.trim();
    if (!message) return;

    try {
        await apiRequest(`/api/complaints/${currentChatComplaintId}/remarks`, {
            method: 'POST',
            body: JSON.stringify({ remark: message })
        });
        input.value = '';
        await refreshChatMessages();
        showToast('Message sent successfully.');
    } catch (err) {
        showToast(err.message || 'Failed to send chat message', true);
    }
}

function startChatPolling() {
    stopChatPolling();
    if (!currentChatComplaintId) return;
    chatPollInterval = setInterval(refreshChatMessages, 8000);
}

function stopChatPolling() {
    if (chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
    }
}

window.addEventListener('beforeunload', stopChatPolling);

async function handleLogout() {
    try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (err) {
        showToast('Logout failed', true);
    }
}
