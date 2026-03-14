// admin/certificates/js/registry-books.js
import { supabase } from '../../../js/supabase-config.js';
import { requireAdmin, CERTIFICATE_TABLES, escapeHTML } from './certificates-common.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!await requireAdmin()) return;

    const loading = document.getElementById('loading');
    const grid = document.getElementById('booksGrid');

    try {
        // Для каждого типа получим количество записей (для отображения)
        const counts = {};
        for (const [key, info] of Object.entries(CERTIFICATE_TABLES)) {
            const { count, error } = await supabase
                .schema('documents_certificates')
                .from(info.table)
                .select('*', { count: 'exact', head: true });
            if (!error) counts[key] = count;
        }

        loading.style.display = 'none';

        // Строим карточки книг
        grid.innerHTML = Object.entries(CERTIFICATE_TABLES).map(([key, info]) => {
            const count = counts[key] !== undefined ? counts[key] : 0;
            return `
                <a href="book.html?type=${key}" class="admin-card" style="text-decoration: none; color: inherit;">
                    <div class="card-icon"><i class="fas fa-book"></i></div>
                    <h3>${escapeHTML(info.title)}</h3>
                    <p>Записей: <strong>${count}</strong></p>
                </a>
            `;
        }).join('');

    } catch (err) {
        loading.style.display = 'none';
        grid.innerHTML = `<p class="error">Ошибка загрузки: ${escapeHTML(err.message)}</p>`;
    }
});