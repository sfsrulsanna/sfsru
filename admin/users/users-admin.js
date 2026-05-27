import { supabase } from '../../js/supabase-config.js';
import { requireAdmin } from '../certificates/js/certificates-common.js';

let currentUserId = null;
let sortField = 'surname';
let sortDirection = 'asc';
let allUsers = [];
let searchTerm = '';

// Загрузка пользователей
async function loadUsers() {
    const loading = document.getElementById('loading');
    const tableContainer = document.getElementById('tableContainer');
    loading.style.display = 'block';
    tableContainer.style.display = 'none';

    const { data, error } = await supabase
        .from('users')
        .select('id, surname, name, patronymic, personal_code, email, phone, date_of_birth, place_of_birth, gender, role, account_type, phone_status, email_status, surname_status, name_status, patronymic_status, date_of_birth_status, place_of_birth_status')
        .order('surname', { ascending: true });

    if (error) {
        console.error('Ошибка загрузки:', error);
        document.getElementById('tableBody').innerHTML = 
            '<tr><td colspan="14" class="error">Ошибка: ' + error.message + '</td></tr>';
        loading.style.display = 'none';
        tableContainer.style.display = 'block';
        return;
    }

    allUsers = data || [];
    sortUsers();
    applySearch();
    loading.style.display = 'none';
    tableContainer.style.display = 'block';
}

function sortUsers() {
    allUsers.sort((a, b) => {
        let aVal = a[sortField] || '';
        let bVal = b[sortField] || '';
        if (sortField === 'surname') {
            aVal = `${a.surname} ${a.name}`;
            bVal = `${b.surname} ${b.name}`;
        }
        if (sortDirection === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });
}

function applySearch() {
    let filtered = allUsers;
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = allUsers.filter(user => {
            const fullName = `${user.surname} ${user.name} ${user.patronymic}`.toLowerCase();
            return fullName.includes(term) ||
                   (user.personal_code && user.personal_code.toLowerCase().includes(term)) ||
                   (user.email && user.email.toLowerCase().includes(term)) ||
                   (user.phone && user.phone.toLowerCase().includes(term));
        });
    }
    renderTable(filtered);
}

function getStatusIcon(status) {
    if (status === 'verified') return '✅';
    if (status === 'oncheck') return '⏳';
    if (status === 'rejected') return '❌';
    return '⚠️';
}

function renderTable(users) {
    const tbody = document.getElementById('tableBody');
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="no-data">Нет пользователей</td></tr>';
        return;
    }

    let rows = '';
    for (const user of users) {
        const fullName = `${user.surname || ''} ${user.name || ''} ${user.patronymic || ''}`.trim() || '—';
        const roleClass = user.role === 'admin' ? 'admin' : '';
        const genderLabel = user.gender === 'male' ? 'М' : (user.gender === 'female' ? 'Ж' : '—');
        const birthDate = formatDate(user.date_of_birth);
        const accountTypeLabel = user.account_type || 'Упрощённая';
        
        // Статусы
        const fioStatus = (user.surname_status === 'verified' && user.name_status === 'verified' && (user.patronymic_status === 'verified' || !user.patronymic)) ? 'verified' :
                          (user.surname_status === 'rejected' || user.name_status === 'rejected' || user.patronymic_status === 'rejected') ? 'rejected' :
                          (user.surname_status === 'oncheck' || user.name_status === 'oncheck' || user.patronymic_status === 'oncheck') ? 'oncheck' : 'not_verified';
        const birthStatus = (user.date_of_birth_status === 'verified' && user.place_of_birth_status === 'verified') ? 'verified' :
                            (user.date_of_birth_status === 'rejected' || user.place_of_birth_status === 'rejected') ? 'rejected' :
                            (user.date_of_birth_status === 'oncheck' || user.place_of_birth_status === 'oncheck') ? 'oncheck' : 'not_verified';
        
        rows += `
            <tr>
                <td>${escapeHTML(fullName)}</td>
                <td>${escapeHTML(user.personal_code || '—')}</td>
                <td>${escapeHTML(user.email || '—')}</td>
                <td>${escapeHTML(user.phone || '—')}</td>
                <td>${birthDate}</td>
                <td>${genderLabel}</td>
                <td><span class="role-badge ${roleClass}">${escapeHTML(user.role || 'user')}</span></td>
                <td>${escapeHTML(accountTypeLabel)}</td>
                <td>${getStatusIcon(fioStatus)}</td>
                <td>${getStatusIcon(birthStatus)}</td>
                <td>${getStatusIcon(user.phone_status)}</td>
                <td>${getStatusIcon(user.email_status)}</td>
                <td>
                    <button class="btn-edit" data-id="${user.id}">Редактировать</button>
                    <button class="btn-delete" data-id="${user.id}">Удалить</button>
                 </td>
            </tr>
        `;
    }
    tbody.innerHTML = rows;

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editUser(btn.dataset.id));
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteUser(btn.dataset.id));
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
        sortUsers();
        applySearch();
    });
});

// Поиск
document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    applySearch();
});

// Открытие модалки с формой
async function openEditModal(user = null) {
    currentUserId = user?.id || null;
    const title = currentUserId ? 'Редактирование пользователя' : 'Добавление пользователя';
    document.getElementById('modalTitle').textContent = title;

    let userData = user;
    if (currentUserId && !userData) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUserId)
            .single();
        if (!error && data) userData = data;
    }

    const html = `
        <div class="form-group">
            <label>Фамилия *</label>
            <input type="text" id="surname" class="form-input" value="${escapeHTML(userData?.surname || '')}" required>
            <select id="surname_status" class="form-input" style="margin-top:0.3rem;">
                <option value="not_verified" ${userData?.surname_status === 'not_verified' ? 'selected' : ''}>Не подтверждён</option>
                <option value="oncheck" ${userData?.surname_status === 'oncheck' ? 'selected' : ''}>На проверке</option>
                <option value="verified" ${userData?.surname_status === 'verified' ? 'selected' : ''}>Подтверждён</option>
                <option value="rejected" ${userData?.surname_status === 'rejected' ? 'selected' : ''}>Отклонён</option>
            </select>
        </div>
        <div class="form-group">
            <label>Имя *</label>
            <input type="text" id="name" class="form-input" value="${escapeHTML(userData?.name || '')}" required>
            <select id="name_status" class="form-input" style="margin-top:0.3rem;">
                <option value="not_verified" ${userData?.name_status === 'not_verified' ? 'selected' : ''}>Не подтверждён</option>
                <option value="oncheck" ${userData?.name_status === 'oncheck' ? 'selected' : ''}>На проверке</option>
                <option value="verified" ${userData?.name_status === 'verified' ? 'selected' : ''}>Подтверждён</option>
                <option value="rejected" ${userData?.name_status === 'rejected' ? 'selected' : ''}>Отклонён</option>
            </select>
        </div>
        <div class="form-group">
            <label>Отчество</label>
            <input type="text" id="patronymic" class="form-input" value="${escapeHTML(userData?.patronymic || '')}">
            <select id="patronymic_status" class="form-input" style="margin-top:0.3rem;">
                <option value="not_verified" ${userData?.patronymic_status === 'not_verified' ? 'selected' : ''}>Не подтверждён</option>
                <option value="oncheck" ${userData?.patronymic_status === 'oncheck' ? 'selected' : ''}>На проверке</option>
                <option value="verified" ${userData?.patronymic_status === 'verified' ? 'selected' : ''}>Подтверждён</option>
                <option value="rejected" ${userData?.patronymic_status === 'rejected' ? 'selected' : ''}>Отклонён</option>
            </select>
        </div>
        <div class="form-group">
            <label>Личный код *</label>
            <input type="text" id="personal_code" class="form-input" value="${escapeHTML(userData?.personal_code || '')}" required>
        </div>
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" class="form-input" value="${escapeHTML(userData?.email || '')}">
            <select id="email_status" class="form-input" style="margin-top:0.3rem;">
                <option value="not_verified" ${userData?.email_status === 'not_verified' ? 'selected' : ''}>Не подтверждён</option>
                <option value="oncheck" ${userData?.email_status === 'oncheck' ? 'selected' : ''}>На проверке</option>
                <option value="verified" ${userData?.email_status === 'verified' ? 'selected' : ''}>Подтверждён</option>
                <option value="rejected" ${userData?.email_status === 'rejected' ? 'selected' : ''}>Отклонён</option>
            </select>
        </div>
        <div class="form-group">
            <label>Телефон</label>
            <input type="tel" id="phone" class="form-input" value="${escapeHTML(userData?.phone || '')}">
            <select id="phone_status" class="form-input" style="margin-top:0.3rem;">
                <option value="not_verified" ${userData?.phone_status === 'not_verified' ? 'selected' : ''}>Не подтверждён</option>
                <option value="oncheck" ${userData?.phone_status === 'oncheck' ? 'selected' : ''}>На проверке</option>
                <option value="verified" ${userData?.phone_status === 'verified' ? 'selected' : ''}>Подтверждён</option>
                <option value="rejected" ${userData?.phone_status === 'rejected' ? 'selected' : ''}>Отклонён</option>
            </select>
        </div>
        <div class="form-group">
            <label>Дата рождения</label>
            <input type="date" id="date_of_birth" class="form-input" value="${userData?.date_of_birth || ''}">
            <select id="date_of_birth_status" class="form-input" style="margin-top:0.3rem;">
                <option value="not_verified" ${userData?.date_of_birth_status === 'not_verified' ? 'selected' : ''}>Не подтверждён</option>
                <option value="oncheck" ${userData?.date_of_birth_status === 'oncheck' ? 'selected' : ''}>На проверке</option>
                <option value="verified" ${userData?.date_of_birth_status === 'verified' ? 'selected' : ''}>Подтверждён</option>
                <option value="rejected" ${userData?.date_of_birth_status === 'rejected' ? 'selected' : ''}>Отклонён</option>
            </select>
        </div>
        <div class="form-group">
            <label>Место рождения</label>
            <input type="text" id="place_of_birth" class="form-input" value="${escapeHTML(userData?.place_of_birth || '')}">
            <select id="place_of_birth_status" class="form-input" style="margin-top:0.3rem;">
                <option value="not_verified" ${userData?.place_of_birth_status === 'not_verified' ? 'selected' : ''}>Не подтверждён</option>
                <option value="oncheck" ${userData?.place_of_birth_status === 'oncheck' ? 'selected' : ''}>На проверке</option>
                <option value="verified" ${userData?.place_of_birth_status === 'verified' ? 'selected' : ''}>Подтверждён</option>
                <option value="rejected" ${userData?.place_of_birth_status === 'rejected' ? 'selected' : ''}>Отклонён</option>
            </select>
        </div>
        <div class="form-group">
            <label>Пол</label>
            <select id="gender" class="form-input">
                <option value="male" ${userData?.gender === 'male' ? 'selected' : ''}>Мужской</option>
                <option value="female" ${userData?.gender === 'female' ? 'selected' : ''}>Женский</option>
            </select>
        </div>
        <div class="form-group">
            <label>Роль</label>
            <select id="role" class="form-input">
                <option value="user" ${userData?.role === 'user' ? 'selected' : ''}>Пользователь</option>
                <option value="admin" ${userData?.role === 'admin' ? 'selected' : ''}>Администратор</option>
            </select>
        </div>
        <div class="form-group">
            <label>Тип учётной записи</label>
            <select id="account_type" class="form-input">
                <option value="Упрощённая" ${userData?.account_type === 'Упрощённая' ? 'selected' : ''}>Упрощённая</option>
                <option value="Стандартная" ${userData?.account_type === 'Стандартная' ? 'selected' : ''}>Стандартная</option>
                <option value="Подтверждённая" ${userData?.account_type === 'Подтверждённая' ? 'selected' : ''}>Подтверждённая</option>
            </select>
        </div>
    `;

    document.getElementById('editModalBody').innerHTML = html;
    document.getElementById('editModal').classList.add('active');
}

document.getElementById('addBtn').addEventListener('click', () => openEditModal(null));

async function editUser(id) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
    if (error || !data) {
        alert('Ошибка загрузки данных пользователя');
        return;
    }
    openEditModal(data);
}

async function saveUser() {
    const formData = {
        surname: document.getElementById('surname')?.value.trim() || '',
        surname_status: document.getElementById('surname_status')?.value || 'not_verified',
        name: document.getElementById('name')?.value.trim() || '',
        name_status: document.getElementById('name_status')?.value || 'not_verified',
        patronymic: document.getElementById('patronymic')?.value.trim() || '',
        patronymic_status: document.getElementById('patronymic_status')?.value || 'not_verified',
        personal_code: document.getElementById('personal_code')?.value.trim() || '',
        email: document.getElementById('email')?.value.trim() || null,
        email_status: document.getElementById('email_status')?.value || 'not_verified',
        phone: document.getElementById('phone')?.value.trim() || null,
        phone_status: document.getElementById('phone_status')?.value || 'not_verified',
        date_of_birth: document.getElementById('date_of_birth')?.value || null,
        date_of_birth_status: document.getElementById('date_of_birth_status')?.value || 'not_verified',
        place_of_birth: document.getElementById('place_of_birth')?.value.trim() || '',
        place_of_birth_status: document.getElementById('place_of_birth_status')?.value || 'not_verified',
        gender: document.getElementById('gender')?.value || null,
        role: document.getElementById('role')?.value || 'user',
        account_type: document.getElementById('account_type')?.value || 'Упрощённая'
    };

    if (!formData.surname || !formData.name || !formData.personal_code) {
        alert('Заполните обязательные поля: фамилия, имя, личный код');
        return;
    }

    let result;
    if (currentUserId) {
        result = await supabase
            .from('users')
            .update(formData)
            .eq('id', currentUserId);
    } else {
        result = await supabase
            .from('users')
            .insert([formData]);
    }

    if (result.error) {
        alert('Ошибка сохранения: ' + result.error.message);
        console.error(result.error);
    } else {
        closeEditModal();
        loadUsers();
    }
}

async function deleteUser(id) {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя? Это действие необратимо.')) return;

    const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Ошибка удаления: ' + error.message);
    } else {
        loadUsers();
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
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

window.closeEditModal = () => {
    document.getElementById('editModal').classList.remove('active');
};

document.getElementById('saveUserBtn').addEventListener('click', saveUser);

document.addEventListener('DOMContentLoaded', async () => {
    if (!await requireAdmin()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
        document.getElementById('adminEmail').textContent = user.email;
    }

    await loadUsers();

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../../login.html';
    });
});