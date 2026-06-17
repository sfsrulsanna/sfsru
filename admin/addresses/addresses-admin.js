import { supabase } from '../../js/supabase-config.js';
import { requireAdmin } from '../certificates/js/certificates-common.js';

let allAddresses = [];
let sortField = 'created_at';
let sortDirection = 'desc';
let filterType = '';
let filterStatus = '';
let filterVerification = '';
let searchTerm = '';

// DOM элементы
const loadingDiv = document.getElementById('loading');
const tableContainer = document.getElementById('tableContainer');
const tbody = document.getElementById('tableBody');
const filterTypeEl = document.getElementById('filterType');
const filterStatusEl = document.getElementById('filterStatus');
const filterVerificationEl = document.getElementById('filterVerification');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');

// Загрузка всех адресов (админ видит все)
async function loadAddresses() {
    loadingDiv.style.display = 'block';
    tableContainer.style.display = 'none';

    const { data, error } = await supabase
        .schema('addresses')
        .from('addresses')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Ошибка загрузки:', error);
        tbody.innerHTML = `<tr><td colspan="9" class="error">Ошибка: ${error.message}</td></tr>`;
        loadingDiv.style.display = 'none';
        tableContainer.style.display = 'block';
        return;
    }

    allAddresses = data || [];
    applyFiltersAndSort();
    loadingDiv.style.display = 'none';
    tableContainer.style.display = 'block';
}

// Фильтрация, поиск и сортировка
function applyFiltersAndSort() {
    let filtered = [...allAddresses];

    // Фильтр по типу
    if (filterType) {
        filtered = filtered.filter(a => a.type === filterType);
    }
    // Фильтр по статусу
    if (filterStatus) {
        filtered = filtered.filter(a => a.status === filterStatus);
    }
    // Фильтр по верификации
    if (filterVerification) {
        filtered = filtered.filter(a => a.verification_status === filterVerification);
    }
    // Поиск по личному коду или адресу
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(a =>
            (a.personal_code && a.personal_code.toLowerCase().includes(term)) ||
            (a.address && a.address.toLowerCase().includes(term))
        );
    }

    // Сортировка
    filtered.sort((a, b) => {
        let aVal = a[sortField] || '';
        let bVal = b[sortField] || '';
        if (sortField === 'id') {
            aVal = a.id;
            bVal = b.id;
        }
        if (sortField === 'type') {
            const map = { registration: 0, temporary: 1, actual: 2 };
            aVal = map[a.type] ?? 3;
            bVal = map[b.type] ?? 3;
        }
        if (sortField === 'status') {
            const map = { active: 0, archived: 1 };
            aVal = map[a.status] ?? 2;
            bVal = map[b.status] ?? 2;
        }
        if (sortField === 'verification_status') {
            const map = { verified: 0, oncheck: 1, rejected: 2 };
            aVal = map[a.verification_status] ?? 3;
            bVal = map[b.verification_status] ?? 3;
        }
        if (typeof aVal === 'string') {
            return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
    });

    renderTable(filtered);
}

function renderTable(addresses) {
    if (addresses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Нет адресов</td></tr>';
        return;
    }

    let rows = '';
    for (const addr of addresses) {
        const typeMap = {
            registration: 'Постоянная',
            temporary: 'Временная',
            actual: 'Фактическое'
        };
        const typeLabel = typeMap[addr.type] || addr.type;
        const typeClass = `type-${addr.type}`;

        const statusLabel = addr.status === 'active' ? 'Активный' : 'Архивный';
        const statusClass = addr.status === 'active' ? 'badge-active' : 'badge-archived';

        const verificationMap = {
            verified: 'Подтверждено',
            oncheck: 'На проверке',
            rejected: 'Отклонено'
        };
        const verificationLabel = verificationMap[addr.verification_status] || addr.verification_status || '—';
        const verificationClass = addr.verification_status ? `badge-${addr.verification_status}` : '';

        const startDate = addr.start_date ? formatDate(addr.start_date) : '—';
        const endDate = addr.end_date ? formatDate(addr.end_date) : '—';

        rows += `
            <tr>
                <td>${addr.id}</td>
                <td><strong>${escapeHTML(addr.personal_code)}</strong></td>
                <td><span class="type-badge ${typeClass}">${typeLabel}</span></td>
                <td>${escapeHTML(addr.address)}</td>
                <td>${startDate}</td>
                <td>${endDate}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td><span class="status-badge ${verificationClass}">${verificationLabel}</span></td>
                <td>
                    <button class="btn-edit" data-id="${addr.id}">✏️</button>
                    ${addr.status === 'active' ? `<button class="btn-archive" data-id="${addr.id}">📦</button>` : ''}
                    <button class="btn-delete" data-id="${addr.id}">🗑️</button>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = rows;

    // Обработчики кнопок
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editAddress(btn.dataset.id));
    });
    document.querySelectorAll('.btn-archive').forEach(btn => {
        btn.addEventListener('click', () => archiveAddress(btn.dataset.id));
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteAddress(btn.dataset.id));
    });
}

// Форматирование даты
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    } catch {
        return dateStr;
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- Сортировка по заголовкам ---
document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'asc';
        }
        document.querySelectorAll('th i').forEach(i => i.className = 'fas fa-sort');
        const icon = th.querySelector('i');
        icon.className = `fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'}`;
        applyFiltersAndSort();
    });
});

// --- Фильтры и поиск ---
filterTypeEl.addEventListener('change', () => {
    filterType = filterTypeEl.value;
    applyFiltersAndSort();
});
filterStatusEl.addEventListener('change', () => {
    filterStatus = filterStatusEl.value;
    applyFiltersAndSort();
});
filterVerificationEl.addEventListener('change', () => {
    filterVerification = filterVerificationEl.value;
    applyFiltersAndSort();
});
searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value;
    applyFiltersAndSort();
});
refreshBtn.addEventListener('click', loadAddresses);

// --- Редактирование адреса ---
let currentAddressId = null;

function openEditModal(address = null) {
    currentAddressId = address?.id || null;
    const title = currentAddressId ? 'Редактирование адреса' : 'Добавление адреса';
    document.getElementById('modalTitle').textContent = title;

    const html = `
        <div class="form-group">
            <label>Личный код *</label>
            <input type="text" id="editPersonalCode" class="form-input" value="${escapeHTML(address?.personal_code || '')}" required>
        </div>
        <div class="form-group">
            <label>Тип *</label>
            <select id="editType" class="form-input">
                <option value="registration" ${address?.type === 'registration' ? 'selected' : ''}>Постоянная регистрация</option>
                <option value="temporary" ${address?.type === 'temporary' ? 'selected' : ''}>Временная регистрация</option>
                <option value="actual" ${address?.type === 'actual' ? 'selected' : ''}>Фактическое проживание</option>
            </select>
        </div>
        <div class="form-group">
            <label>Адрес *</label>
            <input type="text" id="editAddress" class="form-input" value="${escapeHTML(address?.address || '')}" required>
        </div>
        <div class="form-group">
            <label>Дата начала</label>
            <input type="date" id="editStartDate" class="form-input" value="${address?.start_date || ''}">
        </div>
        <div class="form-group">
            <label>Дата окончания</label>
            <input type="date" id="editEndDate" class="form-input" value="${address?.end_date || ''}">
        </div>
        <div class="form-group">
            <label>Статус</label>
            <select id="editStatus" class="form-input">
                <option value="active" ${address?.status === 'active' ? 'selected' : ''}>Активный</option>
                <option value="archived" ${address?.status === 'archived' ? 'selected' : ''}>Архивный</option>
            </select>
        </div>
        <div class="form-group">
            <label>Статус верификации</label>
            <select id="editVerification" class="form-input">
                <option value="verified" ${address?.verification_status === 'verified' ? 'selected' : ''}>Подтверждено</option>
                <option value="oncheck" ${address?.verification_status === 'oncheck' ? 'selected' : ''}>На проверке</option>
                <option value="rejected" ${address?.verification_status === 'rejected' ? 'selected' : ''}>Отклонено</option>
            </select>
        </div>
    `;
    document.getElementById('editModalBody').innerHTML = html;
    document.getElementById('editModal').classList.add('active');
}

window.closeEditModal = () => {
    document.getElementById('editModal').classList.remove('active');
};

async function editAddress(id) {
    const { data, error } = await supabase
        .schema('addresses')
        .from('addresses')
        .select('*')
        .eq('id', id)
        .single();
    if (error || !data) {
        alert('Ошибка загрузки адреса');
        return;
    }
    openEditModal(data);
}

// Сохранение (обновление)
document.getElementById('saveAddressBtn').addEventListener('click', async () => {
    const personalCode = document.getElementById('editPersonalCode')?.value.trim();
    const type = document.getElementById('editType')?.value;
    const address = document.getElementById('editAddress')?.value.trim();
    const startDate = document.getElementById('editStartDate')?.value || null;
    const endDate = document.getElementById('editEndDate')?.value || null;
    const status = document.getElementById('editStatus')?.value;
    const verification = document.getElementById('editVerification')?.value;

    if (!personalCode || !address || !type) {
        alert('Заполните обязательные поля: личный код, адрес, тип');
        return;
    }

    const payload = {
        personal_code: personalCode,
        type,
        address,
        start_date: startDate,
        end_date: endDate,
        status,
        verification_status: verification
    };

    let result;
    if (currentAddressId) {
        result = await supabase
            .schema('addresses')
            .from('addresses')
            .update(payload)
            .eq('id', currentAddressId);
    } else {
        // Добавление (для админа — можно добавить любой адрес)
        result = await supabase
            .schema('addresses')
            .from('addresses')
            .insert(payload);
    }

    if (result.error) {
        alert('Ошибка сохранения: ' + result.error.message);
        console.error(result.error);
    } else {
        closeEditModal();
        loadAddresses();
    }
});

// --- Архивация (при архивации ставим дату окончания = сегодня) ---
async function archiveAddress(id) {
    if (!confirm('Архивировать этот адрес? Будет установлена дата окончания — сегодня.')) return;

    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
        .schema('addresses')
        .from('addresses')
        .update({ status: 'archived', end_date: today })
        .eq('id', id);

    if (error) {
        alert('Ошибка архивации: ' + error.message);
    } else {
        loadAddresses();
    }
}

// --- Удаление ---
async function deleteAddress(id) {
    if (!confirm('Вы уверены, что хотите удалить этот адрес? Действие необратимо.')) return;

    const { error } = await supabase
        .schema('addresses')
        .from('addresses')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Ошибка удаления: ' + error.message);
    } else {
        loadAddresses();
    }
}

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!await requireAdmin()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
        document.getElementById('adminEmail').textContent = user.email;
    }

    await loadAddresses();

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../../login.html';
    });
});