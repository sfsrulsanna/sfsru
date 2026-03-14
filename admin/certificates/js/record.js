// admin/certificates/js/record.js
import { supabase } from '../../../js/supabase-config.js';
import { requireAdmin, CERTIFICATE_TABLES, getTypeInfo, formatDate, escapeHTML } from './certificates-common.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!await requireAdmin()) return;

    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    const id = urlParams.get('id');
    const typeInfo = getTypeInfo(type);

    if (!type || !id || !typeInfo) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Неверные параметры';
        return;
    }

    // Устанавливаем ссылку "Назад"
    document.getElementById('backLink').href = `book.html?type=${type}`;

    try {
        const { data, error } = await supabase
            .schema('documents_certificates')
            .from(typeInfo.table)
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) throw error || new Error('Запись не найдена');

        document.getElementById('loading').style.display = 'none';
        const display = document.getElementById('recordDisplay');
        display.style.display = 'block';
        document.getElementById('recordTitle').textContent = `Запись № ${data.certificate_series_number || data.id}`;

        // Формируем таблицу всех полей
        let html = '<table class="details-table"><tbody>';

        // Для брака/развода добавим специальный заголовок
        if (type === 'marriage' || type === 'divorce') {
            html += `<tr class="spouse-section"><th colspan="2">Сведения о супругах</th></tr>`;
        }

        // Перебираем все поля записи
        Object.entries(data).forEach(([key, value]) => {
            // Пропустим служебные или пустые (можно показывать все)
            let displayValue = value;
            if (value === null || value === undefined) displayValue = '—';
            else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) displayValue = formatDate(value);
            else if (typeof value === 'object') displayValue = JSON.stringify(value);
            else displayValue = String(value);

            // Для marriage/divorce выделим поля мужа и жены
            if (type === 'marriage' || type === 'divorce') {
                if (key.startsWith('husband_')) {
                    html += `<tr><th>${escapeHTML(key)} (он)</th><td>${escapeHTML(displayValue)}</td></tr>`;
                } else if (key.startsWith('wife_')) {
                    html += `<tr><th>${escapeHTML(key)} (она)</th><td>${escapeHTML(displayValue)}</td></tr>`;
                } else {
                    html += `<tr><th>${escapeHTML(key)}</th><td>${escapeHTML(displayValue)}</td></tr>`;
                }
            } else {
                html += `<tr><th>${escapeHTML(key)}</th><td>${escapeHTML(displayValue)}</td></tr>`;
            }
        });

        html += '</tbody></table>';
        display.innerHTML = html;

    } catch (err) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = err.message;
    }
});