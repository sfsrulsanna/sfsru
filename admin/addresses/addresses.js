import { supabase } from '../../js/supabase-config.js';

// Элементы DOM
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
const statusSelect = document.getElementById('status');
const dateFields = document.getElementById('dateFields');
const userSuggestions = document.getElementById('userSuggestions');

let allAddresses = [];
let allUsers = []; // [{id, email}]
let currentFilter = '';

// Проверка роли admin
async function checkAdmin() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        alert('Необходимо авторизоваться');
        window.location.href = '../../login.html';
        return false;
    }
    // Предполагаем, что роль хранится в user.user_metadata или app_metadata
    const role = user.app_metadata?.role || user.user_metadata?.role;
    if (role !== 'admin') {
        alert('У вас нет прав администратора');
        window.location.href = '../../profile.html';
        return false;
    }
    return true;
}

// Загрузка всех пользователей (email)
async function loadUsers() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email');
    if (error) {
        console.error('Ошибка загрузки пользователей:', error);
        return [];
    }
    return data || [];
}

// Загрузка всех адресов из view
async function loadAddresses() {
    const { data, error } = await supabase
        .from('all_addresses')
        .select('*');
    if (error) {
        console.error('Ошибка загрузки адресов:', error);
        return [];
    }
    return data || [];
}

// Получение email по user_id
function getUserEmail(userId) {
    const user = allUsers.find(u => u.id === userId);
    return user ? user.email : userId;
}

// Рендер таблицы
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

        // Определяем даты
        let regDate = addr.registration_date || '—';
        let startDate = addr.start_date || '—';
        let endDate = addr.end_date || '—';
        // Для постоянной регистрации дата регистрации - это registration_date, а start/end пустые
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

        tr.innerHTML = `
            <td>${addr.id.substring(0, 8)}</td>
            <td>${getUserEmail(addr.user_id)}</td>
            <td>${typeLabel}</td>
            <td>${addr.address || '—'}</td>
            <td>${regDate}</td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td class="actions">
                <button class="btn btn-edit" data-id="${addr.id}" data-type="${addr.type}">Редактировать</button>
                <button class="btn btn-danger" data-id="${addr.id}" data-type="${addr.type}">Удалить</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // Обработчики для кнопок
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

// Открыть модалку для добавления
function openAddModal() {
    modalTitle.textContent = 'Добавление адреса';
    addressForm.reset();
    editId.value = '';
    editType.value = '';
    userIdInput.value = '';
    document.getElementById('userSuggestions').style.display = 'none';
    dateFields.innerHTML = '';
    generateDateFields('permanent');
    modal.classList.add('active');
}

// Открыть модалку для редактирования
async function openEditModal(id, type) {
    modalTitle.textContent = 'Редактирование адреса';
    // Найдём запись в allAddresses
    const addr = allAddresses.find(a => a.id === id && a.type === type);
    if (!addr) return;

    editId.value = id;
    editType.value = type;
    userIdInput.value = getUserEmail(addr.user_id);
    addressType.value = type;
    addressInput.value = addr.address || '';
    statusSelect.value = addr.status || 'pending';

    // Генерируем поля дат в зависимости от типа
    generateDateFields(type, addr);

    modal.classList.add('active');
}

// Генерация полей дат
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
        // Нет дополнительных полей
        dateFields.innerHTML = '';
    }
}

// Закрыть модалку
function closeModal() {
    modal.classList.remove('active');
}

// Поиск пользователей по email
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

// Сохранение адреса
async function saveAddress(event) {
    event.preventDefault();

    // Получаем user_id по email
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

    // Собираем данные
    const payload = {
        user_id: userId,
        address,
        status,
    };

    // Добавляем даты в зависимости от типа
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
    // Для actual ничего дополнительно не нужно

    const editIdVal = editId.value;
    const editTypeVal = editType.value;

    let result;
    if (editIdVal && editTypeVal) {
        // Обновление
        const tableName = getTableName(editTypeVal);
        result = await supabase
            .from(tableName)
            .update(payload)
            .eq('id', editIdVal);
    } else {
        // Вставка
        const tableName = getTableName(type);
        result = await supabase
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
    loadData(); // перезагрузить таблицу
}

// Получить имя таблицы по типу
function getTableName(type) {
    const map = {
        permanent: 'permanent_registration',
        temporary: 'temporary_registration',
        actual: 'actual_residence'
    };
    return map[type] || type;
}

// Удаление адреса
async function deleteAddress(id, type) {
    const tableName = getTableName(type);
    const { error } = await supabase
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

// Основная загрузка данных
async function loadData() {
    loadingEl.style.display = 'block';
    tableWrapper.style.display = 'none';
    noDataEl.style.display = 'none';

    allUsers = await loadUsers();
    allAddresses = await loadAddresses();

    // Применяем фильтр
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

// События
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkAdmin();
    if (!isAdmin) return;

    await loadData();

    // Фильтр
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

    // Добавление
    addNewBtn.addEventListener('click', openAddModal);

    // Модалка
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Смена типа в модалке
    addressType.addEventListener('change', () => {
        const type = addressType.value;
        generateDateFields(type);
    });

    // Поиск пользователей при вводе
    userIdInput.addEventListener('input', () => {
        const query = userIdInput.value.trim();
        searchUsers(query);
    });
    document.addEventListener('click', () => {
        userSuggestions.style.display = 'none';
    });

    // Сохранение формы
    addressForm.addEventListener('submit', saveAddress);
});