import { supabase } from '../../../js/supabase-config.js';
import { requireAdmin } from '../../certificates/js/certificates-common.js';

let currentPassportId = null; // для редактирования
let sortField = 'created_at';
let sortDirection = 'desc';
let allData = [];

// Маппинг статусов
const statusMap = {
    'verified': 'Подтверждено',
    'oncheck': 'На проверке',
    'rejected': 'Отклонено',
    'archived': 'Архивный'
};

// Загрузка данных
async function loadPassports() {
    const loading = document.getElementById('loading');
    const tbody = document.getElementById('tableBody');
    loading.style.display = 'block';

    const { data, error } = await supabase
        .schema('documents')
        .from('passport')
        .select('id, surname, name, patronymic, series_number, personal_code, status')
        .order(sortField, { ascending: sortDirection === 'asc' });

    if (error) {
        console.error('Ошибка загрузки:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error">Ошибка: ${error.message}</td></tr>`;
        loading.style.display = 'none';
        return;
    }

    allData = data || [];
    renderTable();
    loading.style.display = 'none';
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (allData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">Нет записей</td></tr>';
        return;
    }

    tbody.innerHTML = allData.map(item => {
        const fullName = `${item.surname || ''} ${item.name || ''} ${item.patronymic || ''}`.trim() || '—';
        const statusClass = `status-${item.status}`;
        const statusText = statusMap[item.status] || item.status;
        return `
            <tr>
                <td>${escapeHTML(fullName)}</td>
                <td>${escapeHTML(item.series_number || '—')}</td>
                <td>${escapeHTML(item.personal_code || '—')}</td>
                <td><span class="status-badge ${statusClass}">${escapeHTML(statusText)}</span></td>
                <td>
                    <button class="btn-view" data-id="${item.id}">Подробнее</button>
                </td>
            </tr>
        `;
    }).join('');

    // Добавляем обработчики на кнопки "Подробнее"
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', () => viewPassport(btn.dataset.id));
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
        // Обновляем иконки
        document.querySelectorAll('th i').forEach(i => i.className = 'fas fa-sort');
        th.querySelector('i').className = `fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'}`;
        loadPassports();
    });
});

// Просмотр паспорта
async function viewPassport(id) {
    currentPassportId = id;
    document.getElementById('viewModal').classList.add('active');
    document.getElementById('viewLoading').style.display = 'block';
    document.getElementById('passportContent').style.display = 'none';
    document.getElementById('extraSections').innerHTML = '';

    const { data, error } = await supabase
        .schema('documents')
        .from('passport')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        alert('Ошибка загрузки данных');
        closeViewModal();
        return;
    }

    // Используем функцию рендера из пользовательского скрипта (адаптированную)
    renderPassportInModal(data);
}

function renderPassportInModal(data) {
    // Копируем логику из renderPassport, но убираем кнопки редактирования/замены
    // и добавляем в модальное окно
    const statusText = getStatusLabel(data.status);
    const statusClass = getStatusClass(data.status);

    document.documentElement.style.setProperty('--primary-red', '#7b091a');

    const html = `
        <div class="passport-template">
            <div class="passport-header">
                <div class="country-name">СФСР ЮЛЬСАННА</div>
                <div class="document-type">ПАСПОРТ</div>
            </div>
            <div class="passport-content">
                <div class="data-field">
                    <div class="field-label">Серия и номер</div>
                    <div class="field-value series-number">${escapeHTML(data.series_number || '—')}</div>
                </div>
                <div class="data-field">
                    <div class="field-label">Дата выдачи</div>
                    <div class="field-value">${formatDate(data.issue_date)}</div>
                </div>
                <div class="data-field">
                    <div class="field-label">Срок действия</div>
                    <div class="field-value">${formatDate(data.expiry_date)}</div>
                </div>
                <div class="data-field">
                    <div class="field-label">Кем выдан</div>
                    <div class="field-value">${escapeHTML(data.issued_by || '—')}</div>
                </div>
                <div class="data-field">
                    <div class="field-label">Код подразделения</div>
                    <div class="field-value">${escapeHTML(data.department_code || '—')}</div>
                </div>
                <div class="data-field">
                    <div class="field-label">Личный код</div>
                    <div class="field-value">${escapeHTML(data.personal_code || '—')}</div>
                </div>

                <div class="passport-divider"></div>

                <div class="passport-lower">
                    <div class="photo-barcode-section">
                        <div class="passport-photo-container">
                            <img id="passportAvatar" src="../../images/default-avatar.png" alt="Фото" class="passport-photo" />
                        </div>
                        <div class="barcode-container">
                            <svg id="passportBarcode" class="barcode"></svg>
                        </div>
                        <div style="text-align: center; margin-top: 15px;">
                            <div id="passportQrCode" style="display: inline-block; width: 80px; height: 80px;"></div>
                        </div>
                    </div>

                    <div class="fio-section">
                        <div class="data-field">
                            <div class="field-label">Фамилия</div>
                            <div class="field-value">${escapeHTML(data.surname || '—')}</div>
                        </div>
                        <div class="data-field">
                            <div class="field-label">Имя</div>
                            <div class="field-value">${escapeHTML(data.name || '—')}</div>
                        </div>
                        <div class="data-field">
                            <div class="field-label">Отчество</div>
                            <div class="field-value">${escapeHTML(data.patronymic || '—')}</div>
                        </div>
                        <div class="data-field">
                            <div class="field-label">Пол</div>
                            <div class="field-value">${escapeHTML(data.gender || '—')}</div>
                        </div>
                        <div class="data-field">
                            <div class="field-label">Дата рождения</div>
                            <div class="field-value">${formatDate(data.birth_date)}</div>
                        </div>
                        <div class="data-field">
                            <div class="field-label">Место рождения</div>
                            <div class="field-value">${escapeHTML(data.birth_place || '—')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('passportContent').innerHTML = html;
    document.getElementById('passportContent').style.display = 'block';

    // Генерация дополнительных секций
    let extraHtml = '';
    if (data.residences && data.residences.length) {
        extraHtml += `
            <h3 class="section-title"><i class="fas fa-home"></i> История регистрации</h3>
            <div class="info-table">
                <table>
                    <thead><tr><th>Адрес</th><th>Дата регистрации</th><th>Дата снятия</th><th>Тип жилья</th></tr></thead>
                    <tbody>
                        ${data.residences.map(r => `<tr><td>${escapeHTML(r.address)}</td><td>${formatDate(r.registrationDate)}</td><td>${formatDate(r.deregistrationDate)}</td><td>${escapeHTML(r.housingType)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    if (data.marital_statuses && data.marital_statuses.length) {
        extraHtml += `
            <h3 class="section-title"><i class="fas fa-heart"></i> Семейное положение</h3>
            <div class="info-table">
                <table>
                    <thead><tr><th>Статус</th><th>Дата изменения</th><th>ФИО супруга</th><th>Номер акта</th></tr></thead>
                    <tbody>
                        ${data.marital_statuses.map(m => `<tr><td>${escapeHTML(m.status)}</td><td>${formatDate(m.changeDate)}</td><td>${escapeHTML(m.spouseName)}</td><td>${escapeHTML(m.actNumber)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    // ... аналогично для других массивов
    if (data.previous_passports && data.previous_passports.length) {
        extraHtml += `
            <h3 class="section-title"><i class="fas fa-history"></i> Ранее выданные паспорта</h3>
            <div class="info-table">
                <table>
                    <thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th><th>Причина замены</th></tr></thead>
                    <tbody>
                        ${data.previous_passports.map(p => `<tr><td>${escapeHTML(p.seriesNumber)}</td><td>${formatDate(p.issueDate)}</td><td>${escapeHTML(p.issuedBy)}</td><td>${escapeHTML(p.reason)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    if (data.previous_foreign_passports && data.previous_foreign_passports.length) {
        extraHtml += `
            <h3 class="section-title"><i class="fas fa-passport"></i> Ранее выданные заграничные паспорта</h3>
            <div class="info-table">
                <table>
                    <thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th></tr></thead>
                    <tbody>
                        ${data.previous_foreign_passports.map(p => `<tr><td>${escapeHTML(p.seriesNumber)}</td><td>${formatDate(p.issueDate)}</td><td>${escapeHTML(p.issuedBy)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    if (data.previous_id_cards && data.previous_id_cards.length) {
        extraHtml += `
            <h3 class="section-title"><i class="fas fa-id-card"></i> Ранее выданные ID-карты</h3>
            <div class="info-table">
                <table>
                    <thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th></tr></thead>
                    <tbody>
                        ${data.previous_id_cards.map(p => `<tr><td>${escapeHTML(p.seriesNumber)}</td><td>${formatDate(p.issueDate)}</td><td>${escapeHTML(p.issuedBy)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    document.getElementById('extraSections').innerHTML = extraHtml;
    document.getElementById('extraSections').style.display = extraHtml ? 'block' : 'none';

    // Генерация QR и штрихкода
    const personalCode = data.personal_code || '';
    const qrContainer = document.getElementById('passportQrCode');
    if (qrContainer && personalCode) {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: `https://e-pass-sfsru.web.app/${personalCode}/`,
            width: 80,
            height: 80,
            colorDark: '#000',
            colorLight: '#fff',
            correctLevel: QRCode.CorrectLevel.L
        });
    }

    const seriesNumber = (data.series_number || '').replace(/\s/g, '');
    if (seriesNumber && seriesNumber.length >= 6) {
        try {
            JsBarcode("#passportBarcode", seriesNumber, {
                format: "CODE128",
                displayValue: false,
                height: 50,
                margin: 0
            });
        } catch (e) { console.warn('Barcode error', e); }
    }

    // Загрузка фото
    const avatarImg = document.getElementById('passportAvatar');
    if (personalCode) {
        getSignedUrl(personalCode).then(url => {
            if (url) avatarImg.src = url;
        });
    }

    document.getElementById('viewLoading').style.display = 'none';
}

// Получение подписанной ссылки на фото
async function getSignedUrl(personalCode) {
    try {
        const filePath = `passport/${encodeURIComponent(personalCode)}/photo.jpg`;
        const { data, error } = await supabase.storage
            .from('documents-files')
            .createSignedUrl(filePath, 3600);
        if (error) throw error;
        return data.signedUrl;
    } catch (e) {
        console.warn('Фото не найдено:', e.message);
        return null;
    }
}

// Закрытие модалок
window.closeViewModal = () => {
    document.getElementById('viewModal').classList.remove('active');
};

window.closeEditModal = () => {
    document.getElementById('editModal').classList.remove('active');
};

// Открытие формы добавления
document.getElementById('addBtn').addEventListener('click', () => {
    currentPassportId = null;
    document.getElementById('editModalTitle').textContent = 'Добавление паспорта';
    renderEditForm({});
    document.getElementById('editModal').classList.add('active');
});

// Рендер формы редактирования/добавления (упрощённая версия)
function renderEditForm(data) {
    const formHtml = `
        <div class="form-section">
            <h4>Основные данные</h4>
            <div class="form-group">
                <label>Фамилия</label>
                <input type="text" id="surname" class="form-input" value="${escapeHTML(data.surname || '')}">
            </div>
            <div class="form-group">
                <label>Имя</label>
                <input type="text" id="name" class="form-input" value="${escapeHTML(data.name || '')}">
            </div>
            <div class="form-group">
                <label>Отчество</label>
                <input type="text" id="patronymic" class="form-input" value="${escapeHTML(data.patronymic || '')}">
            </div>
            <div class="form-group">
                <label>Дата рождения</label>
                <input type="date" id="birth_date" class="form-input" value="${data.birth_date || ''}">
            </div>
            <div class="form-group">
                <label>Место рождения</label>
                <input type="text" id="birth_place" class="form-input" value="${escapeHTML(data.birth_place || '')}">
            </div>
            <div class="form-group">
                <label>Пол</label>
                <select id="gender" class="form-input">
                    <option value="Мужской" ${data.gender === 'Мужской' ? 'selected' : ''}>Мужской</option>
                    <option value="Женский" ${data.gender === 'Женский' ? 'selected' : ''}>Женский</option>
                </select>
            </div>
            <div class="form-group">
                <label>Кем выдан</label>
                <input type="text" id="issued_by" class="form-input" value="${escapeHTML(data.issued_by || '')}">
            </div>
            <div class="form-group">
                <label>Дата выдачи</label>
                <input type="date" id="issue_date" class="form-input" value="${data.issue_date || ''}">
            </div>
            <div class="form-group">
                <label>Дата окончания действия</label>
                <input type="date" id="expiry_date" class="form-input" value="${data.expiry_date || ''}">
            </div>
            <div class="form-group">
                <label>Код подразделения</label>
                <input type="text" id="department_code" class="form-input" value="${escapeHTML(data.department_code || '')}">
            </div>
            <div class="form-group">
                <label>Серия и номер</label>
                <input type="text" id="series_number" class="form-input" value="${escapeHTML(data.series_number || '')}">
            </div>
            <div class="form-group">
                <label>Личный код</label>
                <input type="text" id="personal_code" class="form-input" value="${escapeHTML(data.personal_code || '')}">
            </div>
        </div>
        <!-- Здесь можно добавить секции для массивов (residences, marital_statuses и т.д.), но для простоты пока опустим -->
    `;
    document.getElementById('editModalBody').innerHTML = formHtml;
}

// Сохранение паспорта
document.getElementById('savePassportBtn').addEventListener('click', async () => {
    const formData = {
        surname: document.getElementById('surname')?.value.trim() || '',
        name: document.getElementById('name')?.value.trim() || '',
        patronymic: document.getElementById('patronymic')?.value.trim() || '',
        birth_date: document.getElementById('birth_date')?.value || null,
        birth_place: document.getElementById('birth_place')?.value.trim() || '',
        gender: document.getElementById('gender')?.value || '',
        issued_by: document.getElementById('issued_by')?.value.trim() || '',
        issue_date: document.getElementById('issue_date')?.value || null,
        expiry_date: document.getElementById('expiry_date')?.value || null,
        department_code: document.getElementById('department_code')?.value.trim() || '',
        series_number: document.getElementById('series_number')?.value.trim() || '',
        personal_code: document.getElementById('personal_code')?.value.trim() || '',
        status: 'oncheck',
        updated_at: new Date().toISOString()
    };

    if (!formData.series_number) {
        alert('Серия и номер обязательны');
        return;
    }

    let result;
    if (currentPassportId) {
        result = await supabase
            .schema('documents')
            .from('passport')
            .update(formData)
            .eq('id', currentPassportId);
    } else {
        formData.created_at = new Date().toISOString();
        result = await supabase
            .schema('documents')
            .from('passport')
            .insert([formData])
            .select();
    }

    if (result.error) {
        alert('Ошибка сохранения: ' + result.error.message);
    } else {
        closeEditModal();
        loadPassports();
    }
});

// Вспомогательные функции
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ru-RU');
    } catch {
        return dateStr;
    }
}

function getStatusLabel(status) {
    const labels = {
        'verified': 'Подтверждено',
        'oncheck': 'На проверке',
        'rejected': 'Отклонено',
        'archived': 'Архивный'
    };
    return labels[status] || status;
}

function getStatusClass(status) {
    return `status-${status}`;
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    if (!await requireAdmin()) return;

    await loadPassports();

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../../login.html';
    });
});