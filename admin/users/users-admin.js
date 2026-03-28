import { supabase } from '../../js/supabase-config.js';
import { requireAdmin } from '../certificates/js/certificates-common.js';

let currentUserId = null;        // ID редактируемого пользователя
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

    let query = supabase
        .from('users')
        .select('id, surname, name, patronymic, personal_code, email, date_of_birth, gender, role')
        .order(sortField, { ascending: sortDirection === 'asc' });

    const { data, error } = await query;

    if (error) {
        console.error('Ошибка загрузки:', error);
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="7" class="error">Ошибка: ${error.message}</td></tr>`;
        loading.style.display = 'none';
        tableContainer.style.display = 'block';
        return;
    }

    allUsers = data || [];
    applySearch();
    loading.style.display = 'none';
    tableContainer.style.display = 'block';
}

function applySearch() {
    let filtered = allUsers;
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = allUsers.filter(user => {
            const fullName = `${user.surname} ${user.name} ${user.patronymic}`.toLowerCase();
            return fullName.includes(term) ||
                   (user.personal_code && user.personal_code.toLowerCase().includes(term)) ||
                   (user.email && user.email.toLowerCase().includes(term));
        });
    }
    renderTable(filtered);
}

function renderTable(users) {
    const tbody = document.getElementById('tableBody');
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">Нет пользователей</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const fullName = `${user.surname || ''} ${user.name || ''} ${user.patronymic || ''}`.trim() || '—';
        const roleClass = user.role === 'admin' ? 'admin' : '';
        const gender = user.gender === 'Мужской' ? 'М' : (user.gender === 'Женский' ? 'Ж' : '—');
        const birthDate = formatDate(user.date_of_birth);
        return `
            <tr>
                <td>${escapeHTML(fullName)}</td>
                <td>${escapeHTML(user.personal_code || '—')}</td>
                <td>${escapeHTML(user.email || '—')}</td>
                <td>${birthDate}</td>
                <td>${gender}</td>
                <td><span class="role-badge ${roleClass}">${escapeHTML(user.role || 'user')}</span></td>
                <td>
                    <button class="btn-edit" data-id="${user.id}">Редактировать</button>
                    <button class="btn-delete" data-id="${user.id}">Удалить</button>
                </td>
            </tr>
        `;
    }).join('');

    // Навешиваем обработчики
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
        loadUsers();
    });
});

// Поиск
document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    applySearch();
});

// Форма редактирования/добавления
function openEditModal(user = null) {
    currentUserId = user?.id || null;
    const title = currentUserId ? 'Редактирование пользователя' : 'Добавление пользователя';
    document.getElementById('modalTitle').textContent = title;

    const html = `
        <div class="form-group">
            <label>Фамилия *</label>
            <input type="text" id="surname" class="form-input" value="${escapeHTML(user?.surname || '')}" required>
        </div>
        <div class="form-group">
            <label>Имя *</label>
            <input type="text" id="name" class="form-input" value="${escapeHTML(user?.name || '')}" required>
        </div>
        <div class="form-group">
            <label>Отчество</label>
            <input type="text" id="patronymic" class="form-input" value="${escapeHTML(user?.patronymic || '')}">
        </div>
        <div class="form-group">
            <label>Личный код *</label>
            <input type="text" id="personal_code" class="form-input" value="${escapeHTML(user?.personal_code || '')}" required>
        </div>
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" class="form-input" value="${escapeHTML(user?.email || '')}">
        </div>
        <div class="form-group">
            <label>Дата рождения</label>
            <input type="date" id="date_of_birth" class="form-input" value="${user?.date_of_birth || ''}">
        </div>
        <div class="form-group">
            <label>Место рождения</label>
            <input type="text" id="place_of_birth" class="form-input" value="${escapeHTML(user?.place_of_birth || '')}">
        </div>
        <div class="form-group">
            <label>Пол</label>
            <select id="gender" class="form-input">
                <option value="Мужской" ${user?.gender === 'Мужской' ? 'selected' : ''}>Мужской</option>
                <option value="Женский" ${user?.gender === 'Женский' ? 'selected' : ''}>Женский</option>
            </select>
        </div>
        <div class="form-group">
            <label>Роль</label>
            <select id="role" class="form-input">
                <option value="user" ${user?.role === 'user' ? 'selected' : ''}>Пользователь</option>
                <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Администратор</option>
            </select>
        </div>
    `;

    document.getElementById('editModalBody').innerHTML = html;
    document.getElementById('editModal').classList.add('active');
}

// Добавление нового пользователя
document.getElementById('addBtn').addEventListener('click', () => {
    openEditModal(null);
});

// Редактирование
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

// Сохранение пользователя
async function saveUser() {
    const formData = {
        surname: document.getElementById('surname')?.value.trim() || '',
        name: document.getElementById('name')?.value.trim() || '',
        patronymic: document.getElementById('patronymic')?.value.trim() || '',
        personal_code: document.getElementById('personal_code')?.value.trim() || '',
        email: document.getElementById('email')?.value.trim() || null,
        date_of_birth: document.getElementById('date_of_birth')?.value || null,
        place_of_birth: document.getElementById('place_of_birth')?.value.trim() || '',
        gender: document.getElementById('gender')?.value || null,
        role: document.getElementById('role')?.value || 'user'
    };

    if (!formData.surname || !formData.name || !formData.personal_code) {
        alert('Заполните обязательные поля: фамилия, имя, личный код');
        return;
    }

    // Проверка уникальности personal_code
    let query = supabase.from('users').select('id').eq('personal_code', formData.personal_code);
    if (currentUserId) {
        query = query.neq('id', currentUserId);
    }
    const { data: existing, error: checkError } = await query.maybeSingle();
    if (checkError) {
        console.error(checkError);
    }
    if (existing) {
        alert('Пользователь с таким личным кодом уже существует');
        return;
    }

    let result;
    if (currentUserId) {
        result = await supabase
            .from('users')
            .update(formData)
            .eq('id', currentUserId);
    } else {
        // Создаём новую запись (id не указываем – пусть Supabase сгенерирует, но у нас id должен быть тем же, что в auth? 
        // Здесь мы создаём запись без привязки к auth. ID можно сгенерировать самостоятельно (uuid).
        const newId = crypto.randomUUID();
        result = await supabase
            .from('users')
            .insert([{ ...formData, id: newId }]);
    }

    if (result.error) {
        alert('Ошибка сохранения: ' + result.error.message);
        console.error(result.error);
    } else {
        closeEditModal();
        loadUsers();
    }
}

// Удаление пользователя
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

// Вспомогательные
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
        .replace(/'/g, '&#039;');
}

window.closeEditModal = () => {
    document.getElementById('editModal').classList.remove('active');
};

document.getElementById('saveUserBtn').addEventListener('click', saveUser);

// Инициализация
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