// admin/certificates/js/book.js
import { supabase } from '../../../js/supabase-config.js';
import { requireAdmin, CERTIFICATE_TABLES, getTypeInfo, formatDate, escapeHTML } from './certificates-common.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!await requireAdmin()) return;

    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    const typeInfo = getTypeInfo(type);
    if (!type || !typeInfo) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('recordsContainer').innerHTML = '<p class="error">Неверный тип книги</p>';
        return;
    }

    document.getElementById('bookTitle').textContent = `Записи книги: ${typeInfo.title}`;
    document.getElementById('bookDescription').textContent = `Все актовые записи типа «${typeInfo.title}».`;

    const loading = document.getElementById('loading');
    const container = document.getElementById('recordsContainer');

    try {
        const { data, error } = await supabase
            .schema('documents_certificates')
            .from(typeInfo.table)
            .select('*')
            .order('registry_act_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        loading.style.display = 'none';

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="no-data">В этой книге пока нет записей.</p>';
            return;
        }

        // Формируем таблицу
        let html = '<table class="records-table"><thead><tr>';
        html += '<th>ID</th>';
        if (typeInfo.hasTwoCodes) {
            html += '<th>Муж (личный код)</th><th>Жена (личный код)</th>';
        } else {
            html += '<th>Владелец (личный код)</th>';
        }
        html += '<th>Серия/номер</th><th>Дата актовой записи</th><th>Статус</th><th>Действие</th></tr></thead><tbody>';

        data.forEach(rec => {
            const statusClass = `badge-${rec.status}`;
            const statusLabel = rec.status === 'verified' ? 'Подтверждено' :
                                rec.status === 'oncheck' ? 'На проверке' :
                                rec.status === 'rejected' ? 'Отклонено' : 'Архивный';
            const actDate = rec.registry_act_date ? formatDate(rec.registry_act_date) : '—';
            const number = rec.certificate_series_number || '—';

            html += '<tr>';
            html += `<td>${escapeHTML(rec.id)}</td>`;
            if (typeInfo.hasTwoCodes) {
                html += `<td>${escapeHTML(rec.husband_personal_code || '—')}</td>`;
                html += `<td>${escapeHTML(rec.wife_personal_code || '—')}</td>`;
            } else {
                html += `<td>${escapeHTML(rec.personal_code || '—')}</td>`;
            }
            html += `<td>${escapeHTML(number)}</td>`;
            html += `<td>${actDate}</td>`;
            html += `<td><span class="badge-status ${statusClass}">${statusLabel}</span></td>`;
            html += `<td><a href="record.html?type=${type}&id=${rec.id}" class="btn-small">Просмотр</a></td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (err) {
        loading.style.display = 'none';
        container.innerHTML = `<p class="error">Ошибка: ${escapeHTML(err.message)}</p>`;
    }
});