import { supabase } from '../../js/supabase-config.js';
import { requireAdmin } from '../certificates/js/certificates-common.js';

let currentAddressId = null;
let sortField = 'personal_code';
let sortDirection = 'asc';
let allAddresses = [];
let searchTerm = '';
let typeFilter = '';
let statusFilter = '';
let verificationFilter = '';
let usersMap = {}; // для подстановки ФИО по personal_code

// Загрузка адресов
async function loadAddresses() {
    const loading = document.getElementById('loading');
    const tableContainer = document.getElementById('tableContainer');
    loading.style.display = 'block';
    tableContainer.style.display = 'none';

    // Загружаем всех пользователей для отображения ФИО
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('personal_code, surname, name, patronymic');
    if (!usersError && users) {
        usersMap = {};
        users.forEach(u => {
            usersMap[u.personal_code] = `${u.surname} ${u.name} ${u.patronymic || ''}`.trim();
        });
    }

    const { data, error } = await supabase
        .schema('addresses')
        .from('addresses')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Ошибка загрузки:', error);
        document.getElementById('tableBody').innerHTML = 
            '<tr><td colspan="9" class="error">Ошибка: ' + error.message + '</td></tr>';
        loading.style.display = 'none';
        tableContainer.style.display = 'block';
        return;
    }

    allAddresses = data || [];
    applyFiltersAndSort();
    loading.style.display = 'none';
    tableContainer.style.display = 'block';
}

function applyFiltersAndSort() {
    let filtered = allAddresses;

    // Поиск
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(addr => {
            const fullName = usersMap[addr.personal_code] || '';
            return addr.address.toLowerCase().includes(term) ||
                   addr.personal_code.toLowerCase().includes(term) ||
                   fullName.toLowerCase().includes(term);
        });
    }

    // Фильтры
    if (typeFilter) filtered = filtered.filter(addr => addr.type === typeFilter);
    if (statusFilter) filtered = filtered.filter(addr => addr.status === statusFilter);
    if (verificationFilter) filtered = filtered.filter(addr => addr.verification_status === verificationFilter);

    // Сортировка
    filtered.sort((a, b) => {
        let aVal, bVal;
        if (sortField === 'full_name') {
            aVal = usersMap[a.personal_code] || '';
            bVal = usersMap[b.personal_code] || '';
        } else if (sortField === 'type') {
            const typeMap = { registration: 'Постоянная', temporary: 'Временная', actual: 'Фактическое' };
            aVal = typeMap[a.type] || a.type;
            bVal = typeMap[b.type] || b.type;
        } else {
            aVal = a[sortField] || '';
            bVal = b[sortField] || '';
        }
        if (sortDirection === 'asc') return aVal.localeCompare(bVal);
        else return bVal.localeCompare(aVal);
    });

    renderTable(filtered);
}

function getVerificationBadge(status) {
    const map = {
        verified: { label: 'Подтверждено', class: 'badge-verified' },
        oncheck: { label: 'На проверке', class: 'badge-oncheck' },
        rejected: { label: 'Отклонено', class: 'badge-rejected' }
    };
    const info = map[status] || map.oncheck;
    return `<span class="status-badge ${info.class}">${info.label}</span>`;
}

function getStatusBadge(status) {
    if (status === 'active') return `<span class="status-badge badge-oncheck">Активный</span>`;
    if (status === 'archived') return `<span class="status-badge badge-archived">Архивный</span>`;
    return status;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    } catch { return dateStr; }
}

function renderTable(addresses) {
    const tbody = document.getElementById('tableBody');
    if (addresses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">Нет адресов</td></tr>';
        return;
    }

    let rows = '';
    for (const addr of addresses) {
        const fullName = usersMap[addr.personal_code] || '—';
        const typeMap = {
            registration: 'Постоянная регистрация',
            temporary: 'Временная регистрация',
            actual: 'Фактическое проживание'
        };
        const typeLabel = typeMap[addr.type] || addr.type;
        const isArchived = addr.status === 'archived';

        rows += `
            <tr>
                <td>${escapeHTML(addr.personal_code)}</td>
                <td>${escapeHTML(fullName)}</td>
                <td>${escapeHTML(typeLabel)}</td>
                <td>${escapeHTML(addr.address)}</td>
                <td>${formatDate(addr.start_date)}</td>
                <td>${formatDate(addr.end_date)}</td>
                <td>${getStatusBadge(addr.status)}</td>
                <td>${isArchived ? '—' : getVerificationBadge(addr.verification_status)}</td>
                <td>
                    <button class="btn-edit" data-id="${addr.id}">Редактировать</button>
                    ${!isArchived ? `<button class="btn-archive" data-id="${addr.id}">Архивировать</button>` : ''}
                    <button class="btn-delete" data-id="${addr.id}">Удалить</button>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = rows;

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

// Сортировка
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
        th.querySelector('i').className = `fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'}`;
        applyFiltersAndSort();
    });
});

// Фильтры и поиск
document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    applyFiltersAndSort();
});
document.getElementById('typeFilter').addEventListener('change', (e) => {
    typeFilter = e.target.value;
    applyFiltersAndSort();
});
document.getElementById('statusFilter').addEventListener('change', (e) => {
    statusFilter = e.target.value;
    applyFiltersAndSort();
});
document.getElementById('verificationFilter').addEventListener('change', (e) => {
    verificationFilter = e.target.value;
    applyFiltersAndSort();
});

// --- Модальное окно ---
function openEditModal(address = null) {
    currentAddressId = address?.id || null;
    const title = currentAddressId ? 'Редактирование адреса' : 'Добавление адреса';
    document.getElementById('modalTitle').textContent = title;

    // Загружаем список personal_code для выбора
    const { data: users, error } = supabase
        .from('users')
        .select('personal_code, surname, name, patronymic')
        .order('personal_code');
    // Но так как это асинхронно, сделаем внутри

    // Для простоты сделаем select динамически через fetch
    fetchPersonalCodes(address);
}

async function fetchPersonalCodes(address) {
    const { data: users, error } = await supabase
        .from('users')
        .select('personal_code, surname, name, patronymic')
        .order('personal_code');

    let options = '';
    if (users) {
        users.forEach(u => {
            const full = `${u.surname} ${u.name} ${u.patronymic || ''}`.trim();
            const selected = (address && address.personal_code === u.personal_code) ? 'selected' : '';
            options += `<option value="${u.personal_code}" ${selected}>${u.personal_code} — ${full}</option>`;
        });
    }

    const html = `
        <div class="form-group">
            <label>Личный код *</label>
            <select id="personal_code" class="form-input" required>
                ${options}
            </select>
        </div>
        <div class="form-group">
            <label>Тип адреса *</label>
            <select id="type" class="form-input" required>
                <option value="registration" ${address?.type === 'registration' ? 'selected' : ''}>Постоянная регистрация</option>
                <option value="temporary" ${address?.type === 'temporary' ? 'selected' : ''}>Временная регистрация</option>
                <option value="actual" ${address?.type === 'actual' ? 'selected' : ''}>Фактическое проживание</option>
            </select>
        </div>
        <div class="form-group">
            <label>Адрес *</label>
            <input type="text" id="address" class="form-input" value="${escapeHTML(address?.address || '')}" required>
        </div>
        <div class="form-group">
            <label>Дата начала</label>
            <input type="date" id="start_date" class="form-input" value="${address?.start_date || ''}">
        </div>
        <div class="form-group">
            <label>Дата окончания (только для временной регистрации)</label>
            <input type="date" id="end_date" class="form-input" value="${address?.end_date || ''}">
        </div>
        <div class="form-group">
            <label>Статус (active / archived)</label>
            <select id="status" class="form-input">
                <option value="active" ${address?.status === 'active' ? 'selected' : ''}>Активный</option>
                <option value="archived" ${address?.status === 'archived' ? 'selected' : ''}>Архивный</option>
            </select>
        </div>
        <div class="form-group">
            <label>Статус верификации</label>
            <select id="verification_status" class="form-input">
                <option value="verified" ${address?.verification_status === 'verified' ? 'selected' : ''}>Подтверждено</option>
                <option value="oncheck" ${address?.verification_status === 'oncheck' ? 'selected' : ''}>На проверке</option>
                <option value="rejected" ${address?.verification_status === 'rejected' ? 'selected' : ''}>Отклонено</option>
            </select>
        </div>
    `;

    document.getElementById('editModalBody').innerHTML = html;
    document.getElementById('editModal').classList.add('active');
}

document.getElementById('addBtn').addEventListener('click', () => openEditModal(null));

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}
window.closeEditModal = closeEditModal;

// --- Сохранение адреса ---
async function saveAddress() {
    const personal_code = document.getElementById('personal_code').value;
    const type = document.getElementById('type').value;
    const address = document.getElementById('address').value.trim();
    const start_date = document.getElementById('start_date').value || null;
    let end_date = document.getElementById('end_date').value || null;
    const status = document.getElementById('status').value;
    const verification_status = document.getElementById('verification_status').value;

    if (!personal_code || !type || !address) {
        alert('Заполните обязательные поля: личный код, тип, адрес');
        return;
    }

    // Если статус архивный, но end_date не указан, ставим сегодня
    if (status === 'archived' && !end_date) {
        end_date = new Date().toISOString().split('T')[0];
    }

    const payload = {
        personal_code,
        type,
        address,
        start_date,
        end_date,
        status,
        verification_status
    };

    let result;
    if (currentAddressId) {
        result = await supabase
            .schema('addresses')
            .from('addresses')
            .update(payload)
            .eq('id', currentAddressId);
    } else {
        result = await supabase
            .schema('addresses')
            .from('addresses')
            .insert([payload]);
    }

    if (result.error) {
        alert('Ошибка сохранения: ' + result.error.message);
        console.error(result.error);
    } else {
        closeEditModal();
        loadAddresses();
    }
}

document.getElementById('saveAddressBtn').addEventListener('click', saveAddress);

// --- Архивирование ---
async function archiveAddress(id) {
    if (!confirm('Архивировать этот адрес? Дата окончания будет установлена на сегодня.')) return;

    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
        .schema('addresses')
        .from('addresses')
        .update({ status: 'archived', end_date: today })
        .eq('id', id);

    if (error) {
        alert('Ошибка архивирования: ' + error.message);
    } else {
        loadAddresses();
    }
}

// --- Удаление ---
async function deleteAddress(id) {
    if (!confirm('Вы уверены, что хотите удалить этот адрес? Это действие необратимо.')) return;

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

// --- Вспомогательные ---
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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