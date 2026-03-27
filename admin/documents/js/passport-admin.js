import { supabase } from '../../../js/supabase-config.js';
import { requireAdmin } from '../../certificates/js/certificates-common.js';

let currentPassportId = null;
let sortField = 'surname'; // по умолчанию сортировка по фамилии
let sortDirection = 'asc';
let allData = [];

const statusMap = {
    'verified': 'Подтверждено',
    'oncheck': 'На проверке',
    'rejected': 'Отклонено',
    'archived': 'Архивный'
};

// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadPassports() {
    const loading = document.getElementById('loading');
    const tbody = document.getElementById('tableBody');
    loading.style.display = 'block';

    const orderField = sortField === 'full_name' ? 'surname' : sortField;
    const { data, error } = await supabase
        .schema('documents')
        .from('passport')
        .select('id, surname, name, patronymic, series_number, personal_code, status')
        .order(orderField, { ascending: sortDirection === 'asc' });

    if (error) {
        console.error('Ошибка загрузки:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="error">Ошибка: ${error.message}</td></tr>`;
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
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Нет записей</td></tr>';
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
                    <button class="btn-delete" data-id="${item.id}">Удалить</button>
                </td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', () => viewPassport(btn.dataset.id));
    });
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editPassport(btn.dataset.id));
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deletePassport(btn.dataset.id));
    });
}

// ==================== СОРТИРОВКА ====================
document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        let field = th.dataset.sort;
        if (field === 'full_name') field = 'surname';
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

// ==================== УДАЛЕНИЕ ПАСПОРТА ====================
async function deletePassport(id) {
    if (!confirm('Вы уверены, что хотите удалить этот паспорт? Это действие необратимо.')) return;

    try {
        // Получаем личный код для удаления фото
        const { data: passport, error: fetchError } = await supabase
            .schema('documents')
            .from('passport')
            .select('personal_code')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // Удаляем запись
        const { error: deleteError } = await supabase
            .schema('documents')
            .from('passport')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        // Пытаемся удалить фото
        if (passport && passport.personal_code) {
            const filePath = `passport/${encodeURIComponent(passport.personal_code)}/photo.jpg`;
            await supabase.storage.from('documents-files').remove([filePath]);
        }

        alert('Паспорт успешно удалён');
        loadPassports();

        if (currentPassportId === id) {
            closeViewModal();
            closeEditModal();
        }
    } catch (err) {
        console.error('Ошибка удаления:', err);
        alert('Ошибка удаления: ' + err.message);
    }
}

// ==================== ПРОСМОТР ПАСПОРТА ====================
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

function renderPassportInModal(data) {
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
    if (data.residences?.length) {
        extraHtml += `<h3 class="section-title"><i class="fas fa-home"></i> История регистрации</h3>
            <div class="info-table"><table><thead><tr><th>Адрес</th><th>Дата регистрации</th><th>Дата снятия</th><th>Тип жилья</th></tr></thead>
            <tbody>${data.residences.map(r => `<tr><td>${escapeHTML(r.address)}</td><td>${formatDate(r.registrationDate)}</td><td>${formatDate(r.deregistrationDate)}</td><td>${escapeHTML(r.housingType)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    if (data.marital_statuses?.length) {
        extraHtml += `<h3 class="section-title"><i class="fas fa-heart"></i> Семейное положение</h3>
            <div class="info-table"><table><thead><tr><th>Статус</th><th>Дата изменения</th><th>ФИО супруга</th><th>Номер акта</th></tr></thead>
            <tbody>${data.marital_statuses.map(m => `<tr><td>${escapeHTML(m.status)}</td><td>${formatDate(m.changeDate)}</td><td>${escapeHTML(m.spouseName)}</td><td>${escapeHTML(m.actNumber)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    if (data.is_military_obligated !== undefined) {
        extraHtml += `<h3 class="section-title"><i class="fas fa-shield-alt"></i> Военная обязанность</h3>
            <div class="info-table"><table><thead><tr><th>Военнообязанный</th><th>Военный билет</th></tr></thead>
            <tbody><tr><td>${data.is_military_obligated ? 'Да' : 'Нет'}</td><td>${escapeHTML(data.military_idn || '—')}</td></tr></tbody></table></div>`;
    }
    if (data.previous_passports?.length) {
        extraHtml += `<h3 class="section-title"><i class="fas fa-history"></i> Ранее выданные паспорта</h3>
            <div class="info-table"><table><thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th><th>Причина замены</th></tr></thead>
            <tbody>${data.previous_passports.map(p => `<tr><td>${escapeHTML(p.seriesNumber)}</td><td>${formatDate(p.issueDate)}</td><td>${escapeHTML(p.issuedBy)}</td><td>${escapeHTML(p.reason)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    if (data.previous_foreign_passports?.length) {
        extraHtml += `<h3 class="section-title"><i class="fas fa-passport"></i> Ранее выданные заграничные паспорта</h3>
            <div class="info-table"><table><thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th></tr></thead>
            <tbody>${data.previous_foreign_passports.map(p => `<tr><td>${escapeHTML(p.seriesNumber)}</td><td>${formatDate(p.issueDate)}</td><td>${escapeHTML(p.issuedBy)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    if (data.previous_id_cards?.length) {
        extraHtml += `<h3 class="section-title"><i class="fas fa-id-card"></i> Ранее выданные ID-карты</h3>
            <div class="info-table"><table><thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th></tr></thead>
            <tbody>${data.previous_id_cards.map(p => `<tr><td>${escapeHTML(p.seriesNumber)}</td><td>${formatDate(p.issueDate)}</td><td>${escapeHTML(p.issuedBy)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    document.getElementById('extraSections').innerHTML = extraHtml;
    document.getElementById('extraSections').style.display = extraHtml ? 'block' : 'none';

    const personalCode = data.personal_code || '';
    if (personalCode) {
        new QRCode(document.getElementById('passportQrCode'), {
            text: `https://e-pass-sfsru.web.app/${personalCode}/`,
            width: 80, height: 80,
            colorDark: '#000', colorLight: '#fff',
            correctLevel: QRCode.CorrectLevel.L
        });
        const signedUrl = await getSignedUrl(personalCode);
        if (signedUrl) document.getElementById('passportAvatar').src = signedUrl;
    }

    const seriesNumber = (data.series_number || '').replace(/\s/g, '');
    if (seriesNumber.length >= 6) {
        try {
            JsBarcode("#passportBarcode", seriesNumber, { format: "CODE128", displayValue: false, height: 50, margin: 0 });
        } catch(e) {}
    }

    document.getElementById('viewLoading').style.display = 'none';
}

async function getSignedUrl(personalCode) {
    try {
        const { data, error } = await supabase.storage
            .from('documents-files')
            .createSignedUrl(`passport/${encodeURIComponent(personalCode)}/photo.jpg`, 3600);
        if (error) throw error;
        return data.signedUrl;
    } catch(e) {
        return null;
    }
}

// ==================== РЕДАКТИРОВАНИЕ / ДОБАВЛЕНИЕ ====================
document.getElementById('addBtn').addEventListener('click', () => {
    currentPassportId = null;
    document.getElementById('editModalTitle').textContent = 'Добавление паспорта';
    renderEditForm({});
    document.getElementById('editModal').classList.add('active');
});

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
            ${generateFormFields(formData)}
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

    renderResidencesSection(formData.residences);
    renderMaritalSection(formData.marital_statuses);
    renderPrevPassportsSection(formData.previous_passports);
    renderPrevForeignSection(formData.previous_foreign_passports);
    renderPrevIdCardsSection(formData.previous_id_cards);

    document.getElementById('addResidenceBtn').addEventListener('click', addResidenceBlock);
    document.getElementById('addMaritalBtn').addEventListener('click', addMaritalBlock);
    document.getElementById('addPrevPassportBtn').addEventListener('click', addPrevPassportBlock);
    document.getElementById('addPrevForeignBtn').addEventListener('click', addPrevForeignBlock);
    document.getElementById('addPrevIdCardBtn').addEventListener('click', addPrevIdCardBlock);

    addStatusButton();
}

function generateFormFields(data) {
    return `
        <div class="form-group"><label>Фамилия</label><input type="text" id="surname" class="form-input" value="${escapeHTML(data.surname)}"></div>
        <div class="form-group"><label>Имя</label><input type="text" id="name" class="form-input" value="${escapeHTML(data.name)}"></div>
        <div class="form-group"><label>Отчество</label><input type="text" id="patronymic" class="form-input" value="${escapeHTML(data.patronymic)}"></div>
        <div class="form-group"><label>Дата рождения</label><input type="date" id="birth_date" class="form-input" value="${data.birth_date}"></div>
        <div class="form-group"><label>Место рождения</label><input type="text" id="birth_place" class="form-input" value="${escapeHTML(data.birth_place)}"></div>
        <div class="form-group"><label>Пол</label><select id="gender" class="form-input"><option value="Мужской" ${data.gender === 'Мужской' ? 'selected' : ''}>Мужской</option><option value="Женский" ${data.gender === 'Женский' ? 'selected' : ''}>Женский</option></select></div>
        <div class="form-group"><label>Кем выдан</label><input type="text" id="issued_by" class="form-input" value="${escapeHTML(data.issued_by)}"></div>
        <div class="form-group"><label>Дата выдачи</label><input type="date" id="issue_date" class="form-input" value="${data.issue_date}"></div>
        <div class="form-group"><label>Дата окончания действия</label><input type="date" id="expiry_date" class="form-input" value="${data.expiry_date}"></div>
        <div class="form-group"><label>Код подразделения</label><input type="text" id="department_code" class="form-input" value="${escapeHTML(data.department_code)}"></div>
        <div class="form-group"><label>Серия и номер</label><input type="text" id="series_number" class="form-input" value="${escapeHTML(data.series_number)}"></div>
        <div class="form-group"><label>Личный код</label><input type="text" id="personal_code" class="form-input" value="${escapeHTML(data.personal_code)}"></div>
    `;
}

// ==================== ФУНКЦИИ РЕНДЕРА СЕКЦИЙ ====================
function renderResidencesSection(items) {
    const container = document.getElementById('residencesContainer');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const block = createRecordBlock('residences', index, `
            <div class="form-group"><label>Адрес</label><input type="text" class="form-input residence-address" value="${escapeHTML(item.address || '')}"></div>
            <div class="form-group"><label>Дата регистрации</label><input type="date" class="form-input residence-reg" value="${item.registrationDate || ''}"></div>
            <div class="form-group"><label>Дата снятия</label><input type="date" class="form-input residence-dereg" value="${item.deregistrationDate || ''}"></div>
            <div class="form-group"><label>Тип жилья</label><input type="text" class="form-input residence-type" value="${escapeHTML(item.housingType || '')}"></div>
        `);
        container.appendChild(block);
    });
    attachRemoveHandlers('residences');
}

function renderMaritalSection(items) {
    const container = document.getElementById('maritalContainer');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const block = createRecordBlock('marital', index, `
            <div class="form-group"><label>Статус</label>
                <select class="form-input marital-status">
                    <option value="Не состоит в зарегистрированном браке" ${item.status === 'Не состоит в зарегистрированном браке' ? 'selected' : ''}>Не состоит в зарегистрированном браке</option>
                    <option value="В браке" ${item.status === 'В браке' ? 'selected' : ''}>В браке</option>
                    <option value="В разводе" ${item.status === 'В разводе' ? 'selected' : ''}>В разводе</option>
                    <option value="Вдовец/Вдова" ${item.status === 'Вдовец/Вдова' ? 'selected' : ''}>Вдовец/Вдова</option>
                </select>
            </div>
            <div class="form-group"><label>Дата изменения</label><input type="date" class="form-input marital-date" value="${item.changeDate || ''}"></div>
            <div class="form-group"><label>ФИО супруга</label><input type="text" class="form-input marital-spouse" value="${escapeHTML(item.spouseName || '')}"></div>
            <div class="form-group"><label>Номер акта</label><input type="text" class="form-input marital-act" value="${escapeHTML(item.actNumber || '')}"></div>
        `);
        container.appendChild(block);
    });
    attachRemoveHandlers('marital');
}

function renderPrevPassportsSection(items) {
    const container = document.getElementById('prevPassportsContainer');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const block = createRecordBlock('prevPassports', index, `
            <div class="form-group"><label>Серия и номер</label><input type="text" class="form-input passport-series" value="${escapeHTML(item.seriesNumber || '')}"></div>
            <div class="form-group"><label>Дата выдачи</label><input type="date" class="form-input passport-date" value="${item.issueDate || ''}"></div>
            <div class="form-group"><label>Кем выдан</label><input type="text" class="form-input passport-issued" value="${escapeHTML(item.issuedBy || '')}"></div>
            <div class="form-group"><label>Причина замены</label><input type="text" class="form-input passport-reason" value="${escapeHTML(item.reason || '')}"></div>
        `);
        container.appendChild(block);
    });
    attachRemoveHandlers('prevPassports');
}

function renderPrevForeignSection(items) {
    const container = document.getElementById('prevForeignContainer');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const block = createRecordBlock('prevForeign', index, `
            <div class="form-group"><label>Серия и номер</label><input type="text" class="form-input foreign-series" value="${escapeHTML(item.seriesNumber || '')}"></div>
            <div class="form-group"><label>Дата выдачи</label><input type="date" class="form-input foreign-date" value="${item.issueDate || ''}"></div>
            <div class="form-group"><label>Кем выдан</label><input type="text" class="form-input foreign-issued" value="${escapeHTML(item.issuedBy || '')}"></div>
        `);
        container.appendChild(block);
    });
    attachRemoveHandlers('prevForeign');
}

function renderPrevIdCardsSection(items) {
    const container = document.getElementById('prevIdCardsContainer');
    container.innerHTML = '';
    items.forEach((item, index) => {
        const block = createRecordBlock('prevIdCards', index, `
            <div class="form-group"><label>Серия и номер</label><input type="text" class="form-input idcard-series" value="${escapeHTML(item.seriesNumber || '')}"></div>
            <div class="form-group"><label>Дата выдачи</label><input type="date" class="form-input idcard-date" value="${item.issueDate || ''}"></div>
            <div class="form-group"><label>Кем выдан</label><input type="text" class="form-input idcard-issued" value="${escapeHTML(item.issuedBy || '')}"></div>
        `);
        container.appendChild(block);
    });
    attachRemoveHandlers('prevIdCards');
}

function createRecordBlock(section, index, content) {
    const div = document.createElement('div');
    div.className = 'record-block';
    div.innerHTML = `<button type="button" class="btn-remove" data-section="${section}" data-index="${index}">×</button>${content}`;
    return div;
}

function attachRemoveHandlers(section) {
    document.querySelectorAll(`.btn-remove[data-section="${section}"]`).forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.record-block').remove();
        });
    });
}

function addResidenceBlock() { addGenericBlock('residencesContainer', 'residences', residenceBlockHTML); }
function addMaritalBlock() { addGenericBlock('maritalContainer', 'marital', maritalBlockHTML); }
function addPrevPassportBlock() { addGenericBlock('prevPassportsContainer', 'prevPassports', prevPassportBlockHTML); }
function addPrevForeignBlock() { addGenericBlock('prevForeignContainer', 'prevForeign', prevForeignBlockHTML); }
function addPrevIdCardBlock() { addGenericBlock('prevIdCardsContainer', 'prevIdCards', prevIdCardBlockHTML); }

function addGenericBlock(containerId, section, htmlGenerator) {
    const container = document.getElementById(containerId);
    const block = createRecordBlock(section, Date.now(), htmlGenerator());
    container.appendChild(block);
    attachRemoveHandlers(section);
}

function residenceBlockHTML() {
    return `<div class="form-group"><label>Адрес</label><input type="text" class="form-input residence-address"></div>
            <div class="form-group"><label>Дата регистрации</label><input type="date" class="form-input residence-reg"></div>
            <div class="form-group"><label>Дата снятия</label><input type="date" class="form-input residence-dereg"></div>
            <div class="form-group"><label>Тип жилья</label><input type="text" class="form-input residence-type"></div>`;
}
function maritalBlockHTML() {
    return `<div class="form-group"><label>Статус</label><select class="form-input marital-status"><option value="Не состоит в зарегистрированном браке">Не состоит в зарегистрированном браке</option><option value="В браке">В браке</option><option value="В разводе">В разводе</option><option value="Вдовец/Вдова">Вдовец/Вдова</option></select></div>
            <div class="form-group"><label>Дата изменения</label><input type="date" class="form-input marital-date"></div>
            <div class="form-group"><label>ФИО супруга</label><input type="text" class="form-input marital-spouse"></div>
            <div class="form-group"><label>Номер акта</label><input type="text" class="form-input marital-act"></div>`;
}
function prevPassportBlockHTML() {
    return `<div class="form-group"><label>Серия и номер</label><input type="text" class="form-input passport-series"></div>
            <div class="form-group"><label>Дата выдачи</label><input type="date" class="form-input passport-date"></div>
            <div class="form-group"><label>Кем выдан</label><input type="text" class="form-input passport-issued"></div>
            <div class="form-group"><label>Причина замены</label><input type="text" class="form-input passport-reason"></div>`;
}
function prevForeignBlockHTML() {
    return `<div class="form-group"><label>Серия и номер</label><input type="text" class="form-input foreign-series"></div>
            <div class="form-group"><label>Дата выдачи</label><input type="date" class="form-input foreign-date"></div>
            <div class="form-group"><label>Кем выдан</label><input type="text" class="form-input foreign-issued"></div>`;
}
function prevIdCardBlockHTML() {
    return `<div class="form-group"><label>Серия и номер</label><input type="text" class="form-input idcard-series"></div>
            <div class="form-group"><label>Дата выдачи</label><input type="date" class="form-input idcard-date"></div>
            <div class="form-group"><label>Кем выдан</label><input type="text" class="form-input idcard-issued"></div>`;
}

function collectEditFormData() {
    return {
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
        is_military_obligated: document.getElementById('is_military_obligated')?.checked || false,
        military_idn: document.getElementById('military_idn')?.value.trim() || '',
        residences: collectArray('#residencesContainer', ['residence-address', 'residence-reg', 'residence-dereg', 'residence-type'], ['address', 'registrationDate', 'deregistrationDate', 'housingType']),
        marital_statuses: collectArray('#maritalContainer', ['marital-status', 'marital-date', 'marital-spouse', 'marital-act'], ['status', 'changeDate', 'spouseName', 'actNumber']),
        previous_passports: collectArray('#prevPassportsContainer', ['passport-series', 'passport-date', 'passport-issued', 'passport-reason'], ['seriesNumber', 'issueDate', 'issuedBy', 'reason']),
        previous_foreign_passports: collectArray('#prevForeignContainer', ['foreign-series', 'foreign-date', 'foreign-issued'], ['seriesNumber', 'issueDate', 'issuedBy']),
        previous_id_cards: collectArray('#prevIdCardsContainer', ['idcard-series', 'idcard-date', 'idcard-issued'], ['seriesNumber', 'issueDate', 'issuedBy'])
    };
}

function collectArray(containerSelector, classNames, keys) {
    const items = [];
    document.querySelectorAll(`${containerSelector} .record-block`).forEach(block => {
        const obj = {};
        classNames.forEach((cls, idx) => {
            const val = block.querySelector(`.${cls}`)?.value;
            obj[keys[idx]] = (cls.includes('date') && val) ? val : (val?.trim() || '');
        });
        items.push(obj);
    });
    return items;
}

// ==================== ИЗМЕНЕНИЕ СТАТУСА ====================
function addStatusButton() {
    const modalFooter = document.querySelector('#editModal .modal-footer');
    modalFooter.innerHTML = `
        <button type="button" class="btn-secondary" onclick="closeEditModal()">Отмена</button>
        <button type="button" class="btn-primary" id="savePassportBtn">Сохранить</button>
    `;
    const container = document.createElement('div');
    container.style.marginBottom = '1rem';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-warning';
    btn.textContent = 'Изменить статус';
    btn.addEventListener('click', openStatusModal);
    container.appendChild(btn);
    modalFooter.insertBefore(container, modalFooter.firstChild);
}

function openStatusModal() {
    const modal = document.getElementById('statusModal');
    if (modal) {
        document.getElementById('statusComment').value = '';
        document.getElementById('statusSelect').selectedIndex = 0;
        modal.classList.add('active');
    }
}
window.closeStatusModal = () => document.getElementById('statusModal').classList.remove('active');

async function confirmStatusChange() {
    const newStatus = document.getElementById('statusSelect').value;
    const comment = document.getElementById('statusComment').value.trim();
    if (!currentPassportId) { alert('Ошибка: не выбран документ'); closeStatusModal(); return; }
    try {
        const { data: passport, error: fetchError } = await supabase
            .schema('documents')
            .from('passport')
            .select('personal_code, user_id, series_number')
            .eq('id', currentPassportId)
            .single();
        if (fetchError) throw fetchError;
        await supabase.schema('documents').from('passport').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', currentPassportId);
        let targetUserId = passport.user_id;
        if (!targetUserId && passport.personal_code) {
            const { data: userData } = await supabase.from('users').select('id').eq('personal_code', passport.personal_code).maybeSingle();
            if (userData) targetUserId = userData.id;
        }
        if (targetUserId) {
            await supabase.schema('messages').from('user_messages').insert({
                user_id: targetUserId,
                title: `Изменение статуса паспорта №${passport.series_number || ''}`,
                content: `Статус вашего паспорта изменён на "${statusMap[newStatus]}". Комментарий: ${comment || 'не указан'}`,
                type: 'status_change',
                document_type: 'passport',
                document_id: currentPassportId,
                is_read: false
            });
        }
        closeStatusModal();
        alert('Статус успешно изменён');
        window.location.reload();
    } catch (err) { alert('Ошибка: ' + err.message); }
}
document.addEventListener('click', (e) => { if (e.target.id === 'confirmStatusBtn') confirmStatusChange(); });

// ==================== ПРОВЕРКА ДУБЛИКАТОВ ====================
async function checkDuplicate(formData, excludeId) {
    // Серия и номер — строгая уникальность
    if (formData.series_number) {
        let query = supabase.schema('documents').from('passport').select('id').eq('series_number', formData.series_number);
        if (excludeId) query = query.neq('id', excludeId);
        const { data: existing, error } = await query.maybeSingle();
        if (!error && existing) {
            alert('Паспорт с такой серией и номером уже существует!');
            return true;
        }
    }
    // Личный код — разрешён только если все записи с этим кодом архивные
    if (formData.personal_code) {
        let query = supabase.schema('documents').from('passport').select('status').eq('personal_code', formData.personal_code);
        if (excludeId) query = query.neq('id', excludeId);
        const { data: existing, error } = await query;
        if (!error && existing && existing.length > 0) {
            const hasActive = existing.some(p => p.status !== 'archived');
            if (hasActive) {
                alert('Невозможно добавить/изменить паспорт: у данного личного кода уже есть активный паспорт (не архивный).');
                return true;
            }
        }
    }
    return false;
}

// ==================== СОХРАНЕНИЕ ПАСПОРТА ====================
document.addEventListener('click', async (e) => {
    if (e.target.id === 'savePassportBtn') {
        const formData = collectEditFormData();
        if (!formData.series_number) { alert('Серия и номер обязательны'); return; }
        if (await checkDuplicate(formData, currentPassportId)) return;

        const record = { ...formData, status: formData.status || 'oncheck', updated_at: new Date().toISOString() };
        let result;
        if (currentPassportId) {
            result = await supabase.schema('documents').from('passport').update(record).eq('id', currentPassportId);
        } else {
            record.created_at = new Date().toISOString();
            result = await supabase.schema('documents').from('passport').insert([record]).select();
        }
        if (result.error) {
            alert('Ошибка сохранения: ' + result.error.message);
        } else {
            closeEditModal();
            loadPassports();
        }
    }
});

// ==================== ЗАГРУЗКА ФОТО ====================
document.getElementById('uploadPhotoBtn').addEventListener('click', () => document.getElementById('uploadPhotoModal').classList.add('active'));
document.getElementById('photoFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('previewImage').src = ev.target.result;
            document.getElementById('uploadPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        document.getElementById('uploadPreview').style.display = 'none';
    }
});
document.getElementById('confirmUploadBtn').addEventListener('click', async () => {
    const personalCode = document.getElementById('uploadPersonalCode').value.trim();
    const file = document.getElementById('photoFile').files[0];
    if (!personalCode) { alert('Введите личный код'); return; }
    if (!file) { alert('Выберите файл'); return; }
    const { data: existing } = await supabase.schema('documents').from('passport').select('id').eq('personal_code', personalCode).maybeSingle();
    if (!existing) { alert('Паспорт с таким личным кодом не найден'); return; }
    const { error } = await supabase.storage.from('documents-files').upload(`passport/${encodeURIComponent(personalCode)}/photo.jpg`, file, { upsert: true });
    if (error) {
        alert('Ошибка загрузки: ' + (error.message.includes('row-level security') ? 'недостаточно прав. Настройте RLS для storage.' : error.message));
    } else {
        alert('Фото успешно загружено!');
        closeUploadModal();
        if (currentPassportId) {
            const { data: curr } = await supabase.schema('documents').from('passport').select('personal_code').eq('id', currentPassportId).single();
            if (curr && curr.personal_code === personalCode) {
                const url = await getSignedUrl(personalCode);
                if (url) document.getElementById('passportAvatar').src = url;
            }
        }
    }
});

// ==================== ВСПОМОГАТЕЛЬНЫЕ ====================
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
        return c;
    });
}
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ru-RU');
    } catch { return dateStr; }
}
window.closeViewModal = () => document.getElementById('viewModal').classList.remove('active');
window.closeEditModal = () => document.getElementById('editModal').classList.remove('active');
window.closeUploadModal = () => {
    document.getElementById('uploadPhotoModal').classList.remove('active');
    document.getElementById('uploadPersonalCode').value = '';
    document.getElementById('photoFile').value = '';
    document.getElementById('uploadPreview').style.display = 'none';
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
    if (!await requireAdmin()) return;
    await loadPassports();
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../../login.html';
    });
});