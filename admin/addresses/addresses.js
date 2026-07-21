import { supabase } from '../../js/supabase-config.js';

const SCHEMA = 'addresses';

const loadingEl = document.getElementById('loading');
const tableWrapper = document.getElementById('tableWrapper');
const tableBody = document.getElementById('tableBody');
const noDataEl = document.getElementById('noData');
const userFilter = document.getElementById('userFilter');
const applyFilterBtn = document.getElementById('applyFilter');
const resetFilterBtn = document.getElementById('resetFilter');
const addNewBtn = document.getElementById('addNewBtn');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const addressForm = document.getElementById('addressForm');
const editId = document.getElementById('editId');
const editType = document.getElementById('editType');
const userIdInput = document.getElementById('userId');
const addressType = document.getElementById('addressType');
const addressInput = document.getElementById('address');
const regionSelect = document.getElementById('regionId'); // может быть null
const statusSelect = document.getElementById('status');
const dateFields = document.getElementById('dateFields');
const userSuggestions = document.getElementById('userSuggestions');

let allAddresses = [];
let allUsers = [];
let allRegions = [];
let currentFilter = '';

async function checkAdmin() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        alert('Необходимо авторизоваться');
        window.location.href = '../../login.html';
        return false;
    }
    const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (roleError || !userData || userData.role !== 'admin') {
        alert('У вас нет прав администратора');
        window.location.href = '../../profile.html';
        return false;
    }
    return true;
}

async function loadUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('id, email');
    if (error) {
        console.error('Ошибка загрузки пользователей:', error);
        return [];
    }
    return data || [];
}

async function loadRegions() {
    const { data, error } = await supabase
        .schema(SCHEMA)
        .from('regions')
        .select('id, name')
        .order('name');
    if (error) {
        console.error('Ошибка загрузки регионов:', error);
        return [];
    }
    return data || [];
}

async function loadAddresses() {
    const { data, error } = await supabase
        .schema(SCHEMA)
        .from('all_addresses')
        .select('*');
    if (error) {
        console.error('Ошибка загрузки адресов:', error);
        return [];
    }
    return data || [];
}

function getUserEmail(userId) {
    const user = allUsers.find(u => u.id === userId);
    return user ? user.email : userId;
}

function getRegionName(regionId) {
    if (!regionId) return '—';
    const region = allRegions.find(r => r.id === regionId);
    return region ? region.name : 'Неизвестный регион';
}

function renderTable(addresses) {
    tableBody.innerHTML = '';
    if (!addresses || addresses.length === 0) {
        noDataEl.style.display = 'block';
        tableWrapper.style.display = 'none';
        return;
    }
    noDataEl.style.display = 'none';
    tableWrapper.style.display = 'block';

    addresses.forEach(addr => {
        const tr = document.createElement('tr');
        const typeLabel = {
            permanent: 'Постоянная',
            temporary: 'Временная',
            actual: 'Фактическая'
        }[addr.type] || addr.type;

        let regDate = addr.registration_date || '—';
        let startDate = addr.start_date || '—';
        let endDate = addr.end_date || '—';
        if (addr.type === 'permanent') {
            regDate = addr.registration_date || '—';
            startDate = '—';
            endDate = '—';
        } else if (addr.type === 'temporary') {
            regDate = '—';
            startDate = addr.start_date || '—';
            endDate = addr.end_date || '—';
        } else if (addr.type === 'actual') {
            regDate = '—';
            startDate = '—';
            endDate = '—';
        }

        const statusClass = addr.status || 'pending';
        const statusLabel = {
            verified: 'Подтверждено',
            pending: 'На проверке',
            rejected: 'Отклонено',
            archived: 'Архивный'
        }[statusClass] || statusClass;

        const regionName = getRegionName(addr.region_id);

        tr.innerHTML = `
            <td>${addr.id.substring(0, 8)}</td>
            <td>${getUserEmail(addr.user_id)}</td>
            <td>${typeLabel}</td>
            <td>${addr.address || '—'}</td>
            <td>${regDate}</td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td>${regionName}</td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td class="actions">
                <button class="btn btn-edit" data-id="${addr.id}" data-type="${addr.type}">Редактировать</button>
                <button class="btn btn-danger" data-id="${addr.id}" data-type="${addr.type}">Удалить</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            openEditModal(id, type);
        });
    });
    document.querySelectorAll('.btn-danger').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            if (confirm('Удалить адрес?')) deleteAddress(id, type);
        });
    });
}

function openAddModal() {
    modalTitle.textContent = 'Добавление адреса';
    addressForm.reset();
    editId.value = '';
    editType.value = '';
    userIdInput.value = '';
    userSuggestions.style.display = 'none';
    dateFields.innerHTML = '';
    if (regionSelect) regionSelect.value = '';
    generateDateFields('permanent');
    modal.classList.add('active');
}

async function openEditModal(id, type) {
    modalTitle.textContent = 'Редактирование адреса';
    const addr = allAddresses.find(a => a.id === id && a.type === type);
    if (!addr) return;

    editId.value = id;
    editType.value = type;
    userIdInput.value = getUserEmail(addr.user_id);
    addressType.value = type;
    addressInput.value = addr.address || '';
    statusSelect.value = addr.status || 'pending';
    if (regionSelect) regionSelect.value = addr.region_id || '';
    generateDateFields(type, addr);
    modal.classList.add('active');
}

function generateDateFields(type, data = {}) {
    dateFields.innerHTML = '';
    if (type === 'permanent') {
        dateFields.innerHTML = `
            <div class="form-group">
                <label for="registrationDate">Дата регистрации</label>
                <input type="date" id="registrationDate" value="${data.registration_date || ''}" />
            </div>
        `;
    } else if (type === 'temporary') {
        dateFields.innerHTML = `
            <div class="form-group">
                <label for="startDate">Дата начала</label>
                <input type="date" id="startDate" value="${data.start_date || ''}" required />
            </div>
            <div class="form-group">
                <label for="endDate">Дата окончания</label>
                <input type="date" id="endDate" value="${data.end_date || ''}" required />
            </div>
        `;
    } else if (type === 'actual') {
        dateFields.innerHTML = '';
    }
}

function closeModal() {
    modal.classList.remove('active');
}

async function searchUsers(query) {
    if (!query || query.length < 2) {
        userSuggestions.style.display = 'none';
        return;
    }
    const filtered = allUsers.filter(u => u.email.toLowerCase().includes(query.toLowerCase()));
    if (filtered.length === 0) {
        userSuggestions.style.display = 'none';
        return;
    }
    userSuggestions.innerHTML = '';
    filtered.forEach(u => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = u.email;
        div.addEventListener('click', () => {
            userIdInput.value = u.email;
            userIdInput.dataset.userId = u.id;
            userSuggestions.style.display = 'none';
        });
        userSuggestions.appendChild(div);
    });
    userSuggestions.style.display = 'block';
}

async function saveAddress(event) {
    event.preventDefault();

    const email = userIdInput.value.trim();
    const user = allUsers.find(u => u.email === email);
    if (!user) {
        alert('Пользователь с таким email не найден');
        return;
    }
    const userId = user.id;

    const type = addressType.value;
    const address = addressInput.value.trim();
    const status = statusSelect.value;
    const regionId = regionSelect && regionSelect.value ? parseInt(regionSelect.value) : null;

    const payload = {
        user_id: userId,
        address,
        status,
        region_id: regionId,
    };

    if (type === 'permanent') {
        const regDate = document.getElementById('registrationDate')?.value;
        if (!regDate) { alert('Укажите дату регистрации'); return; }
        payload.registration_date = regDate;
    } else if (type === 'temporary') {
        const start = document.getElementById('startDate')?.value;
        const end = document.getElementById('endDate')?.value;
        if (!start || !end) { alert('Укажите даты начала и окончания'); return; }
        if (new Date(start) > new Date(end)) { alert('Дата начала не может быть позже даты окончания'); return; }
        payload.start_date = start;
        payload.end_date = end;
    }

    const editIdVal = editId.value;
    const editTypeVal = editType.value;

    let result;
    if (editIdVal && editTypeVal) {
        const tableName = getTableName(editTypeVal);
        result = await supabase
            .schema(SCHEMA)
            .from(tableName)
            .update(payload)
            .eq('id', editIdVal);
    } else {
        const tableName = getTableName(type);
        result = await supabase
            .schema(SCHEMA)
            .from(tableName)
            .insert([payload]);
    }

    if (result.error) {
        alert('Ошибка сохранения: ' + result.error.message);
        console.error(result.error);
        return;
    }

    alert('Успешно сохранено!');
    closeModal();
    loadData();
}

function getTableName(type) {
    const map = {
        permanent: 'permanent_registration',
        temporary: 'temporary_registration',
        actual: 'actual_residence'
    };
    return map[type] || type;
}

async function deleteAddress(id, type) {
    const tableName = getTableName(type);
    const { error } = await supabase
        .schema(SCHEMA)
        .from(tableName)
        .delete()
        .eq('id', id);
    if (error) {
        alert('Ошибка удаления: ' + error.message);
        return;
    }
    alert('Адрес удалён');
    loadData();
}

async function loadData() {
    loadingEl.style.display = 'block';
    tableWrapper.style.display = 'none';
    noDataEl.style.display = 'none';

    allUsers = await loadUsers();
    allRegions = await loadRegions();
    allAddresses = await loadAddresses();

    // Заполняем селект регионов, если элемент существует
    if (regionSelect) {
        regionSelect.innerHTML = '<option value="">Не указан</option>' +
            allRegions.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    } else {
        console.warn('Элемент #regionId не найден в DOM');
    }

    let filtered = allAddresses;
    const filterText = currentFilter.trim().toLowerCase();
    if (filterText) {
        const userIds = allUsers
            .filter(u => u.email.toLowerCase().includes(filterText))
            .map(u => u.id);
        filtered = allAddresses.filter(a => userIds.includes(a.user_id));
    }

    renderTable(filtered);
    loadingEl.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkAdmin();
    if (!isAdmin) return;

    await loadData();

    applyFilterBtn.addEventListener('click', () => {
        currentFilter = userFilter.value;
        loadData();
    });
    resetFilterBtn.addEventListener('click', () => {
        userFilter.value = '';
        currentFilter = '';
        loadData();
    });
    userFilter.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') applyFilterBtn.click();
    });

    addNewBtn.addEventListener('click', openAddModal);

    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    addressType.addEventListener('change', () => {
        const type = addressType.value;
        generateDateFields(type);
    });

    userIdInput.addEventListener('input', () => {
        const query = userIdInput.value.trim();
        searchUsers(query);
    });
    document.addEventListener('click', () => {
        userSuggestions.style.display = 'none';
    });

    addressForm.addEventListener('submit', saveAddress);
});