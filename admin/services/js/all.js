import { supabase } from '../../../js/supabase-config.js';
import { requireAdmin } from '../certificates/js/certificates-common.js';

// Маппинг статусов на русский язык
const statusMap = {
    'submitted': 'Отправлено в ведомство',
    'processing': 'В работе',
    'interim': 'Промежуточные результаты',
    'positive': 'Принято положительное решение',
    'completed': 'Результат выдан',
    'rejected': 'Отказано',
    'cancelled': 'Отменено'
};

// Маппинг причин на русский язык
const reasonMap = {
    '14_20_45': 'Исполнилось 14, 20 или 45 лет',
    'no_space': 'Закончилось место для штампов',
    'name_changed': 'Изменилось ФИО, дата или место рождения',
    'lost': 'Паспорт утерян или украден',
    'damaged': 'Паспорт стал непригодным к использованию',
    'citizenship': 'Получение гражданства СФСРЮ',
    'appearance': 'Изменилась внешность',
    'error': 'Ошибка в паспорте'
};

let allData = []; // для последующей фильтрации на клиенте

async function loadApplications(filters = {}) {
    const loading = document.getElementById('loading');
    const tbody = document.getElementById('appsTableBody');
    loading.style.display = 'block';
    tbody.innerHTML = '';

    let query = supabase
        .schema('services')
        .from('passport')
        .select('id, application_number, created_at, personal_code, reason, status')
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Ошибка загрузки:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="error">Ошибка загрузки: ${error.message}</td></tr>`;
        loading.style.display = 'none';
        return;
    }

    allData = data || [];
    applyClientFilters(filters.search);
    loading.style.display = 'none';
}

function applyClientFilters(searchTerm) {
    const tbody = document.getElementById('appsTableBody');
    let filtered = allData;

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(item =>
            (item.application_number && item.application_number.toLowerCase().includes(term)) ||
            (item.personal_code && item.personal_code.toLowerCase().includes(term))
        );
    }

    document.getElementById('totalCount').textContent = `Всего: ${filtered.length}`;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Нет записей</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(app => `
        <tr>
            <td>${app.application_number}</td>
            <td>${new Date(app.created_at).toLocaleDateString('ru-RU')}</td>
            <td>${app.personal_code || '—'}</td>
            <td>${reasonMap[app.reason] || app.reason}</td>
            <td>${statusMap[app.status] || app.status}</td>
            <td><a href="view.html?id=${app.id}" class="btn-view">Просмотр</a></td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!await requireAdmin()) return;

    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    const applyBtn = document.getElementById('applyFilters');

    // Первоначальная загрузка
    await loadApplications();

    applyBtn.addEventListener('click', () => {
        const filters = {
            status: statusFilter.value || undefined,
            search: searchInput.value.trim()
        };
        loadApplications(filters);
    });

    // Выход
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../../login.html';
    });
});