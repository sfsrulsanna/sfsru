import { supabase } from '../../../js/supabase-config.js';

// Список таблиц свидетельств
const certificateTables = [
    { table: 'documents_birth_certificate', type: 'О рождении' },
    { table: 'documents_marriage_certificate', type: 'О браке' },
    { table: 'documents_divorce_certificate', type: 'О расторжении брака' },
    { table: 'documents_adoption_certificate', type: 'Об усыновлении' }
    // добавьте другие при необходимости
];

let currentData = [];

async function loadPendingCertificates() {
    const tbody = document.getElementById('certificatesTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка...</td></tr>';

    try {
        let allRecords = [];

        for (const cert of certificateTables) {
            const { data, error } = await supabase
                .from(cert.table)
                .select('*')
                .eq('status', 'oncheck')
                .order('created_at', { ascending: false });

            if (error) {
                console.error(`Ошибка загрузки из ${cert.table}:`, error);
                continue;
            }

            if (data && data.length) {
                allRecords.push(...data.map(r => ({ ...r, certificate_type: cert.type, table_name: cert.table })));
            }
        }

        currentData = allRecords;
        renderTable(allRecords);
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" class="error">Ошибка загрузки данных</td></tr>';
    }
}

function renderTable(records) {
    const tbody = document.getElementById('certificatesTableBody');
    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">Нет записей на проверке</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(rec => `
        <tr>
            <td>${escapeHtml(rec.certificate_type)}</td>
            <td>${escapeHtml(rec.id)}</td>
            <td>${escapeHtml(rec.owner_full_name || '—')}</td>
            <td>${escapeHtml(rec.personal_code || '—')}</td>
            <td>${formatDate(rec.created_at)}</td>
            <td>
                <button class="btn-verify" data-id="${rec.id}" data-table="${rec.table_name}" data-action="verified">✅ Подтвердить</button>
                <button class="btn-reject" data-id="${rec.id}" data-table="${rec.table_name}" data-action="rejected">❌ Отклонить</button>
            </td>
            <td>
                <a href="view.html?table=${rec.table_name}&id=${rec.id}" class="btn-view">👁️ Просмотр</a>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.btn-verify, .btn-reject').forEach(btn => {
        btn.addEventListener('click', handleStatusChange);
    });
}

async function handleStatusChange(e) {
    const btn = e.target;
    const id = btn.dataset.id;
    const table = btn.dataset.table;
    const newStatus = btn.dataset.action;

    if (!confirm(`Изменить статус на "${newStatus === 'verified' ? 'Подтверждено' : 'Отклонено'}"?`)) return;

    try {
        const { error } = await supabase
            .from(table)
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        currentData = currentData.filter(r => !(r.table_name === table && r.id === id));
        renderTable(currentData);
        showNotification('Статус обновлён', 'success');
    } catch (err) {
        console.error(err);
        showNotification('Ошибка обновления статуса', 'error');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(date) {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function showNotification(msg, type) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.className = `notification ${type}`;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

document.addEventListener('DOMContentLoaded', loadPendingCertificates);