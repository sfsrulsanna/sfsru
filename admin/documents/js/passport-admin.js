import { supabase } from '../../../js/supabase-config.js';
import { requireAdmin } from '../../certificates/js/certificates-common.js';

let currentPassportId = null;
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
                    <button class="btn-edit" data-id="${item.id}">Редактировать</button>
                </td>
            </tr>
        `;
    }).join('');

    // Обработчики
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', () => viewPassport(btn.dataset.id));
    });
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editPassport(btn.dataset.id));
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

    renderPassportInModal(data);
}

// Рендер паспорта в модалке просмотра
function renderPassportInModal(data) {
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

    // Дополнительные секции
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
    if (data.is_military_obligated !== undefined) {
        extraHtml += `
            <h3 class="section-title"><i class="fas fa-shield-alt"></i> Военная обязанность</h3>
            <div class="info-table">
                <table>
                    <thead><tr><th>Военнообязанный</th><th>Военный билет</th></tr></thead>
                    <tbody>
                        <tr><td>${data.is_military_obligated ? 'Да' : 'Нет'}</td><td>${escapeHTML(data.military_idn || '—')}</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    }
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

    // QR и штрихкод
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

// Редактирование паспорта
async function editPassport(id) {
    currentPassportId = id;
    document.getElementById('editModalTitle').textContent = 'Редактирование паспорта';
    document.getElementById('editModalBody').innerHTML = '<div class="loading">Загрузка...</div>';
    document.getElementById('editModal').classList.add('active');

    const { data, error } = await supabase
        .schema('documents')
        .from('passport')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        alert('Ошибка загрузки данных');
        closeEditModal();
        return;
    }

    renderEditForm(data);
}

// Рендер формы редактирования с полными данными
function renderEditForm(data) {
    const formData = {
        id: data.id || null,
        surname: data.surname || '',
        name: data.name || '',
        patronymic: data.patronymic || '',
        birth_date: data.birth_date || '',
        birth_place: data.birth_place || '',
        gender: data.gender || 'Мужской',
        issued_by: data.issued_by || '',
        issue_date: data.issue_date || '',
        expiry_date: data.expiry_date || '',
        department_code: data.department_code || '',
        series_number: data.series_number || '',
        personal_code: data.personal_code || '',
        status: data.status || 'oncheck',
        is_military_obligated: data.is_military_obligated || false,
        military_idn: data.military_idn || '',
        residences: data.residences || [],
        marital_statuses: data.marital_statuses || [],
        previous_passports: data.previous_passports || [],
        previous_foreign_passports: data.previous_foreign_passports || [],
        previous_id_cards: data.previous_id_cards || []
    };

    const html = `
        <div class="form-section">
            <h4>Основные данные</h4>
            <div class="form-group">
                <label>Фамилия</label>
                <input type="text" id="surname" class="form-input" value="${escapeHTML(formData.surname)}">
            </div>
            <div class="form-group">
                <label>Имя</label>
                <input type="text" id="name" class="form-input" value="${escapeHTML(formData.name)}">
            </div>
            <div class="form-group">
                <label>Отчество</label>
                <input type="text" id="patronymic" class="form-input" value="${escapeHTML(formData.patronymic)}">
            </div>
            <div class="form-group">
                <label>Дата рождения</label>
                <input type="date" id="birth_date" class="form-input" value="${formData.birth_date}">
            </div>
            <div class="form-group">
                <label>Место рождения</label>
                <input type="text" id="birth_place" class="form-input" value="${escapeHTML(formData.birth_place)}">
            </div>
            <div class="form-group">
                <label>Пол</label>
                <select id="gender" class="form-input">
                    <option value="Мужской" ${formData.gender === 'Мужской' ? 'selected' : ''}>Мужской</option>
                    <option value="Женский" ${formData.gender === 'Женский' ? 'selected' : ''}>Женский</option>
                </select>
            </div>
            <div class="form-group">
                <label>Кем выдан</label>
                <input type="text" id="issued_by" class="form-input" value="${escapeHTML(formData.issued_by)}">
            </div>
            <div class="form-group">
                <label>Дата выдачи</label>
                <input type="date" id="issue_date" class="form-input" value="${formData.issue_date}">
            </div>
            <div class="form-group">
                <label>Дата окончания действия</label>
                <input type="date" id="expiry_date" class="form-input" value="${formData.expiry_date}">
            </div>
            <div class="form-group">
                <label>Код подразделения</label>
                <input type="text" id="department_code" class="form-input" value="${escapeHTML(formData.department_code)}">
            </div>
            <div class="form-group">
                <label>Серия и номер</label>
                <input type="text" id="series_number" class="form-input" value="${escapeHTML(formData.series_number)}">
            </div>
            <div class="form-group">
                <label>Личный код</label>
                <input type="text" id="personal_code" class="form-input" value="${escapeHTML(formData.personal_code)}">
            </div>
            <div class="form-group">
                <label>Статус</label>
                <select id="status" class="form-input">
                    <option value="verified" ${formData.status === 'verified' ? 'selected' : ''}>Подтверждено</option>
                    <option value="oncheck" ${formData.status === 'oncheck' ? 'selected' : ''}>На проверке</option>
                    <option value="rejected" ${formData.status === 'rejected' ? 'selected' : ''}>Отклонено</option>
                    <option value="archived" ${formData.status === 'archived' ? 'selected' : ''}>Архивный</option>
                </select>
            </div>
        </div>

        <div class="form-section">
            <h4>Военная обязанность</h4>
            <div class="form-group">
                <label><input type="checkbox" id="is_military_obligated" ${formData.is_military_obligated ? 'checked' : ''}> Военнообязанный</label>
            </div>
            <div class="form-group">
                <label>Военный билет</label>
                <input type="text" id="military_idn" class="form-input" value="${escapeHTML(formData.military_idn)}">
            </div>
        </div>

        <div class="form-section">
            <h4>Места регистрации</h4>
            <div id="residencesContainer"></div>
            <button type="button" class="btn-add-record" id="addResidenceBtn">+ Добавить адрес</button>
        </div>

        <div class="form-section">
            <h4>Семейное положение</h4>
            <div id="maritalContainer"></div>
            <button type="button" class="btn-add-record" id="addMaritalBtn">+ Добавить запись</button>
        </div>

        <div class="form-section">
            <h4>Ранее выданные паспорта</h4>
            <div id="prevPassportsContainer"></div>
            <button type="button" class="btn-add-record" id="addPrevPassportBtn">+ Добавить паспорт</button>
        </div>

        <div class="form-section">
            <h4>Ранее выданные заграничные паспорта</h4>
            <div id="prevForeignContainer"></div>
            <button type="button" class="btn-add-record" id="addPrevForeignBtn">+ Добавить</button>
        </div>

        <div class="form-section">
            <h4>Ранее выданные ID-карты</h4>
            <div id="prevIdCardsContainer"></div>
            <button type="button" class="btn-add-record" id="addPrevIdCardBtn">+ Добавить</button>
        </div>
    `;

    document.getElementById('editModalBody').innerHTML = html;

    // Заполняем динамические секции
    renderResidencesSection(formData.residences);
    renderMaritalSection(formData.marital_statuses);
    renderPrevPassportsSection(formData.previous_passports);
    renderPrevForeignSection(formData.previous_foreign_passports);
    renderPrevIdCardsSection(formData.previous_id_cards);

    // Добавляем обработчики для кнопок добавления
    document.getElementById('addResidenceBtn').addEventListener('click', () => addResidenceBlock());
    document.getElementById('addMaritalBtn').addEventListener('click', () => addMaritalBlock());
    document.getElementById('addPrevPassportBtn').addEventListener('click', () => addPrevPassportBlock());
    document.getElementById('addPrevForeignBtn').addEventListener('click', () => addPrevForeignBlock());
    document.getElementById('addPrevIdCardBtn').addEventListener('click', () => addPrevIdCardBlock());
}

// --- Функции рендера секций ---
function renderResidencesSection(items) {
    const container = document.getElementById('residencesContainer');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const block = document.createElement('div');
        block.className = 'record-block';
        block.innerHTML = `
            <button type="button" class="btn-remove" data-index="${index}" data-section="residences">×</button>
            <div class="form-group">
                <label>Адрес</label>
                <input type="text" class="form-input residence-address" value="${escapeHTML(item.address || '')}">
            </div>
            <div class="form-group">
                <label>Дата регистрации</label>
                <input type="date" class="form-input residence-reg" value="${item.registrationDate || ''}">
            </div>
            <div class="form-group">
                <label>Дата снятия</label>
                <input type="date" class="form-input residence-dereg" value="${item.deregistrationDate || ''}">
            </div>
            <div class="form-group">
                <label>Тип жилья</label>
                <input type="text" class="form-input residence-type" value="${escapeHTML(item.housingType || '')}">
            </div>
        `;
        container.appendChild(block);
    });
    attachRemoveHandlers('residences');
}

function renderMaritalSection(items) {
    const container = document.getElementById('maritalContainer');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const block = document.createElement('div');
        block.className = 'record-block';
        block.innerHTML = `
            <button type="button" class="btn-remove" data-index="${index}" data-section="marital">×</button>
            <div class="form-group">
                <label>Статус</label>
                <select class="form-input marital-status">
                    <option value="Не состоит в зарегистрированном браке" ${item.status === 'Не состоит в зарегистрированном браке' ? 'selected' : ''}>Не состоит в зарегистрированном браке</option>
                    <option value="В браке" ${item.status === 'В браке' ? 'selected' : ''}>В браке</option>
                    <option value="В разводе" ${item.status === 'В разводе' ? 'selected' : ''}>В разводе</option>
                    <option value="Вдовец/Вдова" ${item.status === 'Вдовец/Вдова' ? 'selected' : ''}>Вдовец/Вдова</option>
                </select>
            </div>
            <div class="form-group">
                <label>Дата изменения</label>
                <input type="date" class="form-input marital-date" value="${item.changeDate || ''}">
            </div>
            <div class="form-group">
                <label>ФИО супруга</label>
                <input type="text" class="form-input marital-spouse" value="${escapeHTML(item.spouseName || '')}">
            </div>
            <div class="form-group">
                <label>Номер акта</label>
                <input type="text" class="form-input marital-act" value="${escapeHTML(item.actNumber || '')}">
            </div>
        `;
        container.appendChild(block);
    });
    attachRemoveHandlers('marital');
}

function renderPrevPassportsSection(items) {
    const container = document.getElementById('prevPassportsContainer');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const block = document.createElement('div');
        block.className = 'record-block';
        block.innerHTML = `
            <button type="button" class="btn-remove" data-index="${index}" data-section="prevPassports">×</button>
            <div class="form-group">
                <label>Серия и номер</label>
                <input type="text" class="form-input passport-series" value="${escapeHTML(item.seriesNumber || '')}">
            </div>
            <div class="form-group">
                <label>Дата выдачи</label>
                <input type="date" class="form-input passport-date" value="${item.issueDate || ''}">
            </div>
            <div class="form-group">
                <label>Кем выдан</label>
                <input type="text" class="form-input passport-issued" value="${escapeHTML(item.issuedBy || '')}">
            </div>
            <div class="form-group">
                <label>Причина замены</label>
                <input type="text" class="form-input passport-reason" value="${escapeHTML(item.reason || '')}">
            </div>
        `;
        container.appendChild(block);
    });
    attachRemoveHandlers('prevPassports');
}

function renderPrevForeignSection(items) {
    const container = document.getElementById('prevForeignContainer');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const block = document.createElement('div');
        block.className = 'record-block';
        block.innerHTML = `
            <button type="button" class="btn-remove" data-index="${index}" data-section="prevForeign">×</button>
            <div class="form-group">
                <label>Серия и номер</label>
                <input type="text" class="form-input foreign-series" value="${escapeHTML(item.seriesNumber || '')}">
            </div>
            <div class="form-group">
                <label>Дата выдачи</label>
                <input type="date" class="form-input foreign-date" value="${item.issueDate || ''}">
            </div>
            <div class="form-group">
                <label>Кем выдан</label>
                <input type="text" class="form-input foreign-issued" value="${escapeHTML(item.issuedBy || '')}">
            </div>
        `;
        container.appendChild(block);
    });
    attachRemoveHandlers('prevForeign');
}

function renderPrevIdCardsSection(items) {
    const container = document.getElementById('prevIdCardsContainer');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const block = document.createElement('div');
        block.className = 'record-block';
        block.innerHTML = `
            <button type="button" class="btn-remove" data-index="${index}" data-section="prevIdCards">×</button>
            <div class="form-group">
                <label>Серия и номер</label>
                <input type="text" class="form-input idcard-series" value="${escapeHTML(item.seriesNumber || '')}">
            </div>
            <div class="form-group">
                <label>Дата выдачи</label>
                <input type="date" class="form-input idcard-date" value="${item.issueDate || ''}">
            </div>
            <div class="form-group">
                <label>Кем выдан</label>
                <input type="text" class="form-input idcard-issued" value="${escapeHTML(item.issuedBy || '')}">
            </div>
        `;
        container.appendChild(block);
    });
    attachRemoveHandlers('prevIdCards');
}

// Прикрепление обработчиков удаления
function attachRemoveHandlers(section) {
    document.querySelectorAll(`.btn-remove[data-section="${section}"]`).forEach(btn => {
        btn.addEventListener('click', (e) => {
            const block = e.target.closest('.record-block');
            block.remove();
        });
    });
}

// --- Функции добавления новых блоков ---
function addResidenceBlock() {
    const container = document.getElementById('residencesContainer');
    const block = document.createElement('div');
    block.className = 'record-block';
    block.innerHTML = `
        <button type="button" class="btn-remove" data-section="residences">×</button>
        <div class="form-group">
            <label>Адрес</label>
            <input type="text" class="form-input residence-address">
        </div>
        <div class="form-group">
            <label>Дата регистрации</label>
            <input type="date" class="form-input residence-reg">
        </div>
        <div class="form-group">
            <label>Дата снятия</label>
            <input type="date" class="form-input residence-dereg">
        </div>
        <div class="form-group">
            <label>Тип жилья</label>
            <input type="text" class="form-input residence-type">
        </div>
    `;
    container.appendChild(block);
    attachRemoveHandlers('residences');
}

function addMaritalBlock() {
    const container = document.getElementById('maritalContainer');
    const block = document.createElement('div');
    block.className = 'record-block';
    block.innerHTML = `
        <button type="button" class="btn-remove" data-section="marital">×</button>
        <div class="form-group">
            <label>Статус</label>
            <select class="form-input marital-status">
                <option value="Не состоит в зарегистрированном браке">Не состоит в зарегистрированном браке</option>
                <option value="В браке">В браке</option>
                <option value="В разводе">В разводе</option>
                <option value="Вдовец/Вдова">Вдовец/Вдова</option>
            </select>
        </div>
        <div class="form-group">
            <label>Дата изменения</label>
            <input type="date" class="form-input marital-date">
        </div>
        <div class="form-group">
            <label>ФИО супруга</label>
            <input type="text" class="form-input marital-spouse">
        </div>
        <div class="form-group">
            <label>Номер акта</label>
            <input type="text" class="form-input marital-act">
        </div>
    `;
    container.appendChild(block);
    attachRemoveHandlers('marital');
}

function addPrevPassportBlock() {
    const container = document.getElementById('prevPassportsContainer');
    const block = document.createElement('div');
    block.className = 'record-block';
    block.innerHTML = `
        <button type="button" class="btn-remove" data-section="prevPassports">×</button>
        <div class="form-group">
            <label>Серия и номер</label>
            <input type="text" class="form-input passport-series">
        </div>
        <div class="form-group">
            <label>Дата выдачи</label>
            <input type="date" class="form-input passport-date">
        </div>
        <div class="form-group">
            <label>Кем выдан</label>
            <input type="text" class="form-input passport-issued">
        </div>
        <div class="form-group">
            <label>Причина замены</label>
            <input type="text" class="form-input passport-reason">
        </div>
    `;
    container.appendChild(block);
    attachRemoveHandlers('prevPassports');
}

function addPrevForeignBlock() {
    const container = document.getElementById('prevForeignContainer');
    const block = document.createElement('div');
    block.className = 'record-block';
    block.innerHTML = `
        <button type="button" class="btn-remove" data-section="prevForeign">×</button>
        <div class="form-group">
            <label>Серия и номер</label>
            <input type="text" class="form-input foreign-series">
        </div>
        <div class="form-group">
            <label>Дата выдачи</label>
            <input type="date" class="form-input foreign-date">
        </div>
        <div class="form-group">
            <label>Кем выдан</label>
            <input type="text" class="form-input foreign-issued">
        </div>
    `;
    container.appendChild(block);
    attachRemoveHandlers('prevForeign');
}

function addPrevIdCardBlock() {
    const container = document.getElementById('prevIdCardsContainer');
    const block = document.createElement('div');
    block.className = 'record-block';
    block.innerHTML = `
        <button type="button" class="btn-remove" data-section="prevIdCards">×</button>
        <div class="form-group">
            <label>Серия и номер</label>
            <input type="text" class="form-input idcard-series">
        </div>
        <div class="form-group">
            <label>Дата выдачи</label>
            <input type="date" class="form-input idcard-date">
        </div>
        <div class="form-group">
            <label>Кем выдан</label>
            <input type="text" class="form-input idcard-issued">
        </div>
    `;
    container.appendChild(block);
    attachRemoveHandlers('prevIdCards');
}

// Сбор данных из формы
function collectEditFormData() {
    const data = {
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
        status: document.getElementById('status')?.value || 'oncheck',
        is_military_obligated: document.getElementById('is_military_obligated')?.checked || false,
        military_idn: document.getElementById('military_idn')?.value.trim() || '',
        residences: [],
        marital_statuses: [],
        previous_passports: [],
        previous_foreign_passports: [],
        previous_id_cards: []
    };

    // Сбор мест регистрации
    document.querySelectorAll('#residencesContainer .record-block').forEach(block => {
        data.residences.push({
            address: block.querySelector('.residence-address')?.value.trim() || '',
            registrationDate: block.querySelector('.residence-reg')?.value || null,
            deregistrationDate: block.querySelector('.residence-dereg')?.value || null,
            housingType: block.querySelector('.residence-type')?.value.trim() || ''
        });
    });

    // Сбор семейного положения
    document.querySelectorAll('#maritalContainer .record-block').forEach(block => {
        data.marital_statuses.push({
            status: block.querySelector('.marital-status')?.value || '',
            changeDate: block.querySelector('.marital-date')?.value || null,
            spouseName: block.querySelector('.marital-spouse')?.value.trim() || '',
            actNumber: block.querySelector('.marital-act')?.value.trim() || ''
        });
    });

    // Сбор ранее выданных паспортов
    document.querySelectorAll('#prevPassportsContainer .record-block').forEach(block => {
        data.previous_passports.push({
            seriesNumber: block.querySelector('.passport-series')?.value.trim() || '',
            issueDate: block.querySelector('.passport-date')?.value || null,
            issuedBy: block.querySelector('.passport-issued')?.value.trim() || '',
            reason: block.querySelector('.passport-reason')?.value.trim() || ''
        });
    });

    // Сбор ранее выданных загранпаспортов
    document.querySelectorAll('#prevForeignContainer .record-block').forEach(block => {
        data.previous_foreign_passports.push({
            seriesNumber: block.querySelector('.foreign-series')?.value.trim() || '',
            issueDate: block.querySelector('.foreign-date')?.value || null,
            issuedBy: block.querySelector('.foreign-issued')?.value.trim() || ''
        });
    });

    // Сбор ранее выданных ID-карт
    document.querySelectorAll('#prevIdCardsContainer .record-block').forEach(block => {
        data.previous_id_cards.push({
            seriesNumber: block.querySelector('.idcard-series')?.value.trim() || '',
            issueDate: block.querySelector('.idcard-date')?.value || null,
            issuedBy: block.querySelector('.idcard-issued')?.value.trim() || ''
        });
    });

    return data;
}

// Сохранение паспорта
document.getElementById('savePassportBtn').addEventListener('click', async () => {
    const formData = collectEditFormData();

    if (!formData.series_number) {
        alert('Серия и номер обязательны');
        return;
    }

    const record = {
        ...formData,
        updated_at: new Date().toISOString()
    };

    let result;
    if (currentPassportId) {
        result = await supabase
            .schema('documents')
            .from('passport')
            .update(record)
            .eq('id', currentPassportId);
    } else {
        record.created_at = new Date().toISOString();
        result = await supabase
            .schema('documents')
            .from('passport')
            .insert([record])
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