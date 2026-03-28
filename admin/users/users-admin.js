import { supabase } from '../../js/supabase-config.js';
import { requireAdmin } from '../certificates/js/certificates-common.js';

let currentUserId = null;
let sortField = 'surname';
let sortDirection = 'asc';
let allUsers = [];
let searchTerm = '';

async function loadUsers() {
    const loading = document.getElementById('loading');
    const tableContainer = document.getElementById('tableContainer');
    loading.style.display = 'block';
    tableContainer.style.display = 'none';

    // Используем RPC-функцию для получения всех пользователей (только для админов)
    const { data, error } = await supabase.rpc('get_all_users');

    if (error) {
        console.error('Ошибка загрузки:', error);
        document.getElementById('tableBody').innerHTML = ` 
            <td colspan="7" class="error">Ошибка: ${error.message}</td>
        `;
        loading.style.display = 'none';
        tableContainer.style.display = 'block';
        return;
    }

    allUsers = data || [];
    // Сортировка вручную, так как RPC возвращает JSONB массив
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
                   (user.email && user.email.toLowerCase().includes(term));
        });
    }
    renderTable(filtered);
}

function renderTable(users) {
    const tbody = document.getElementById('tableBody');
    if (users.length === 0) {
        tbody.innerHTML = ' 
            <td colspan="7" class="no-data">Нет пользователей</td>
        ';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const fullName = `${user.surname || ''} ${user.name || ''} ${user.patronymic || ''}`.trim() || '—';
        const roleClass = user.role === 'admin' ? 'admin' : '';
        const genderLabel = user.gender === 'male' ? 'М' : (user.gender === 'female' ? 'Ж' : '—');
        const birthDate = formatDate(user.date_of_birth);
        return `
             <tr>
                 <td>${escapeHTML(fullName)}</td>
                 <td>${escapeHTML(user.personal_code || '—')}</td>
                 <td>${escapeHTML(user.email || '—')}</td>
                 <td>${birthDate}</td>
                 <td>${genderLabel}</td>
                 <td><span class="role-badge ${roleClass}">${escapeHTML(user.role || 'user')}</span></td>
                 <td>
                    <button class="btn-edit" data-id="${user.id}">Редактировать</button>
                    <button class="btn-delete" data-id="${user.id}">Удалить</button>
                 </td>
             </tr>
        `;
    }).join('');

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editUser(btn.dataset.id));
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteUser(btn.dataset.id));
    });
}

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

document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    applySearch();
});

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
                <option value="male" ${user?.gender === 'male' ? 'selected' : ''}>Мужской</option>
                <option value="female" ${user?.gender === 'female' ? 'selected' : ''}>Женский</option>
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

document.getElementById('addBtn').addEventListener('click', () => openEditModal(null));

async function editUser(id) {
    const { data, error } = await supabase.rpc('get_user_by_id', { user_id: id });
    if (error || !data) {
        alert('Ошибка загрузки данных пользователя');
        return;
    }
    openEditModal(data);
}

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

    // Если редактируем существующего, передаём id
    if (currentUserId) {
        formData.id = currentUserId;
    }

    const { data, error } = await supabase.rpc('upsert_user', { user_data: formData });

    if (error) {
        alert('Ошибка сохранения: ' + error.message);
        console.error(error);
    } else {
        closeEditModal();
        loadUsers();
    }
}

async function deleteUser(id) {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя? Это действие необратимо.')) return;

    const { error } = await supabase.rpc('delete_user', { user_id: id });

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
        .replace(/'/g, '&#039;');
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