import { supabase } from '../../../js/supabase-config.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================
// Глобальные переменные
// ============================================================
let currentStep = 1;
let userProfile = null;
let userPersonalCode = null;
let applicationNumber = null;
let selectedPassportType = null;
let selectedRecipient = null;
let includeChildren = null; // 'yes' или 'no' для небиометрического
let applicants = []; // массив получателей: [{ type: 'self'|'child', data: {...}, photoPath: null }]
let childrenList = []; // список детей из БД (для выбора)
let workRows = [];
let selectedVisaType = null;
let selectedMvdId = null;
let mvdList = [];
let hasActiveApp = false;
let photoPaths = {};

// ============================================================
// Вспомогательные функции
// ============================================================
function generateApplicationNumber() {
    const digits = Math.floor(100000000 + Math.random() * 900000000);
    return `FP-${digits}`;
}

function showError(msg) {
    const errDiv = document.getElementById('errorMessage');
    errDiv.textContent = msg;
    errDiv.classList.remove('hidden');
    setTimeout(() => errDiv.classList.add('hidden'), 5000);
}

function showSuccess(msg) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = msg;
    successDiv.classList.remove('hidden');
    setTimeout(() => successDiv.classList.add('hidden'), 5000);
}

// ============================================================
// Загрузка профиля и проверка активного заявления
// ============================================================
async function loadUserProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../../../login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return false;
    }
    const { data, error } = await supabase
        .from('users')
        .select('personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender, phone, email')
        .eq('id', session.user.id)
        .single();
    if (error) {
        console.error('Ошибка загрузки профиля:', error);
        return false;
    }
    userProfile = data;
    userPersonalCode = data.personal_code;
    return true;
}

async function checkActiveApplication() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { data, error } = await supabase
        .schema('services')
        .from('foreign_passport')
        .select('id')
        .eq('user_id', session.user.id)
        .in('status', ['submitted', 'processing'])
        .maybeSingle();
    if (error) {
        console.error('Ошибка проверки заявлений:', error);
        return false;
    }
    return !!data;
}

// ============================================================
// Загрузка детей из public.children (RLS)
// ============================================================
async function loadChildren() {
    const { data, error } = await supabase
        .from('children')
        .select('child_personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender')
        .order('surname');
    if (error) {
        console.error('Ошибка загрузки детей:', error);
        return;
    }
    childrenList = data.map(child => ({
        personal_code: child.child_personal_code,
        surname: child.surname,
        name: child.name,
        patronymic: child.patronymic,
        date_of_birth: child.date_of_birth,
        place_of_birth: child.place_of_birth,
        gender: child.gender
    }));
}

// ============================================================
// Загрузка списка МВД
// ============================================================
async function loadMvd() {
    const { data, error } = await supabase
        .from('mvd')
        .select('*')
        .order('name');
    if (error) {
        console.error('Ошибка загрузки отделений МВД:', error);
        return;
    }
    mvdList = data;
    renderMvdList();
}

function renderMvdList() {
    const container = document.getElementById('mvdList');
    container.innerHTML = '';
    mvdList.forEach(mvd => {
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'mvd';
        radio.value = mvd.id;
        radio.id = `mvd-${mvd.id}`;
        radio.classList.add('mvd-radio');
        radio.style.display = 'none';

        const card = document.createElement('div');
        card.className = 'mvd-card';
        card.setAttribute('data-id', mvd.id);
        card.innerHTML = `
            <h4><i class="fas fa-map-marker-alt" style="margin-right:0.5rem; color:#7b091a;"></i>${mvd.name}</h4>
            <p>${mvd.address}</p>
            <small>${mvd.working_hours || ''}</small>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.mvd-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
            radio.checked = true;
            selectedMvdId = mvd.id;
        });

        container.appendChild(radio);
        container.appendChild(card);
    });
}

// ============================================================
// Управление шагами (исправленная нумерация)
// ============================================================
function getNextStep(step) {
    const passportType = document.querySelector('input[name="passportType"]:checked');
    const recipient = document.querySelector('input[name="recipient"]:checked');
    const isNonBiometric = passportType && passportType.value === 'nonbiometric';
    const hasChildren = recipient && (recipient.value === 'self_children' || recipient.value === 'children_only');

    switch (step) {
        case 1: return 2;
        case 2: return 3;
        case 3: return 4;
        case 4: {
            if (hasChildren) return 5;
            else return 6;
        }
        case 5: return 6;
        case 6: return 7;
        case 7: {
            if (isNonBiometric && hasChildren) return 8;
            else return 9;
        }
        case 8: return 9;
        case 9: return 10;
        case 10: return 11;
        case 11: return 12;
        case 12: return 13;
        default: return step + 1;
    }
}

function getPrevStep(step) {
    const passportType = document.querySelector('input[name="passportType"]:checked');
    const recipient = document.querySelector('input[name="recipient"]:checked');
    const isNonBiometric = passportType && passportType.value === 'nonbiometric';
    const hasChildren = recipient && (recipient.value === 'self_children' || recipient.value === 'children_only');

    switch (step) {
        case 2: return 1;
        case 3: return 2;
        case 4: return 3;
        case 5: return 4;
        case 6: {
            if (hasChildren) return 5;
            else return 4;
        }
        case 7: return 6;
        case 8: return 7;
        case 9: {
            if (isNonBiometric && hasChildren) return 8;
            else return 7;
        }
        case 10: return 9;
        case 11: return 10;
        case 12: return 11;
        case 13: return 12;
        default: return step - 1;
    }
}

function goToStep(step) {
    if (step < 1 || step > 13) return;

    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    const targetStep = document.querySelector(`.step-content[data-step="${step}"]`);
    if (targetStep) targetStep.classList.remove('hidden');
    currentStep = step;

    if (step === 4) renderApplicantInfo();
    if (step === 5) renderChildrenStep();
    if (step === 6) renderWorkTable();
    if (step === 10) renderPhotosStep();
    if (step === 11 && mvdList.length === 0) loadMvd();
    if (step === 12) prepareSummary();
}

// ============================================================
// Шаг 4: Информация о заявителе
// ============================================================
function renderApplicantInfo() {
    const container = document.getElementById('applicantData');
    if (!userProfile) return;
    let html = `<table class="summary-table">`;
    html += `<tr><th>Личный код</th><td>${userProfile.personal_code || '—'}</td></tr>`;
    html += `<tr><th>ФИО</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Дата рождения</th><td>${new Date(userProfile.date_of_birth).toLocaleDateString('ru-RU')}</td></tr>`;
    html += `<tr><th>Место рождения</th><td>${userProfile.place_of_birth || '—'}</td></tr>`;
    html += `<tr><th>Пол</th><td>${userProfile.gender === 'male' ? 'Мужской' : 'Женский'}</td></tr>`;
    html += '</table>';
    container.innerHTML = html;
}

// ============================================================
// Шаг 5: Дети
// ============================================================
function renderChildrenStep() {
    const container = document.getElementById('childrenList');
    const childrenApplicants = applicants.filter(a => a.type === 'child');
    if (childrenApplicants.length === 0) {
        container.innerHTML = '<p>Дети ещё не добавлены. Нажмите кнопку "Добавить ребёнка".</p>';
        return;
    }
    let html = '';
    childrenApplicants.forEach((child, index) => {
        html += `<div class="child-card" data-index="${index}">`;
        html += `<div class="child-header"><strong>${child.data.surname} ${child.data.name} ${child.data.patronymic}</strong>`;
        html += `<span class="remove-child" data-index="${index}"><i class="fas fa-trash"></i></span></div>`;
        html += `<p>Дата рождения: ${new Date(child.data.date_of_birth).toLocaleDateString('ru-RU')}</p>`;
        html += `<p>Место рождения: ${child.data.place_of_birth || '—'}</p>`;
        html += `</div>`;
    });
    container.innerHTML = html;

    document.querySelectorAll('.remove-child').forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            applicants = applicants.filter((_, i) => i !== idx);
            renderChildrenStep();
        });
    });
}

document.getElementById('addChildBtn').addEventListener('click', () => {
    const choice = confirm('Добавить ребёнка из списка? (OK – из списка, Отмена – вручную)');
    if (choice) {
        if (childrenList.length === 0) {
            alert('У вас нет добавленных детей. Сначала добавьте детей в личном кабинете.');
            return;
        }
        const options = childrenList.map((c, i) => `${i+1}. ${c.surname} ${c.name} ${c.patronymic}`).join('\n');
        const selected = prompt(`Выберите ребёнка (введите номер):\n${options}`);
        const idx = parseInt(selected) - 1;
        if (isNaN(idx) || idx < 0 || idx >= childrenList.length) {
            alert('Неверный выбор.');
            return;
        }
        const child = childrenList[idx];
        applicants.push({
            type: 'child',
            data: {
                personal_code: child.personal_code,
                surname: child.surname,
                name: child.name,
                patronymic: child.patronymic,
                date_of_birth: child.date_of_birth,
                place_of_birth: child.place_of_birth || '',
                gender: child.gender || 'male',
            },
            photoPath: null
        });
        renderChildrenStep();
    } else {
        const surname = prompt('Введите фамилию ребёнка:');
        if (!surname) return;
        const name = prompt('Введите имя ребёнка:');
        if (!name) return;
        const patronymic = prompt('Введите отчество ребёнка:') || '';
        const birthDate = prompt('Введите дату рождения (ГГГГ-ММ-ДД):');
        if (!birthDate) return;
        const birthPlace = prompt('Введите место рождения:') || '';
        const gender = confirm('Пол: OK – мужской, Отмена – женский') ? 'male' : 'female';
        applicants.push({
            type: 'child',
            data: {
                personal_code: null,
                surname,
                name,
                patronymic,
                date_of_birth: birthDate,
                place_of_birth: birthPlace,
                gender
            },
            photoPath: null
        });
        renderChildrenStep();
    }
});

// ============================================================
// Шаг 6: Работа (таблица за 10 лет)
// ============================================================
function renderWorkTable() {
    const container = document.getElementById('workTableContainer');
    if (workRows.length === 0) {
        workRows.push({ org: '', position: '', start: '', end: '' });
    }
    let html = `<table class="work-table"><thead><tr><th>Организация</th><th>Должность</th><th>Дата начала</th><th>Дата окончания</th><th></th></tr></thead><tbody>`;
    workRows.forEach((row, index) => {
        html += `<tr data-index="${index}">`;
        html += `<td><input type="text" class="form-control" value="${row.org}" data-field="org" /></td>`;
        html += `<td><input type="text" class="form-control" value="${row.position}" data-field="position" /></td>`;
        html += `<td><input type="date" class="form-control" value="${row.start}" data-field="start" /></td>`;
        html += `<td><input type="date" class="form-control" value="${row.end}" data-field="end" /></td>`;
        html += `<td><span class="remove-row" data-index="${index}"><i class="fas fa-times"></i></span></td>`;
        html += `</tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;

    document.querySelectorAll('.remove-row').forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            if (workRows.length > 1) {
                workRows.splice(idx, 1);
                renderWorkTable();
            } else {
                alert('Должна быть хотя бы одна запись.');
            }
        });
    });

    container.querySelectorAll('input[data-field]').forEach(input => {
        input.addEventListener('input', (e) => {
            const tr = e.currentTarget.closest('tr');
            const idx = parseInt(tr.dataset.index);
            const field = e.currentTarget.dataset.field;
            workRows[idx][field] = e.currentTarget.value;
        });
    });
}

document.getElementById('addWorkRowBtn').addEventListener('click', () => {
    workRows.push({ org: '', position: '', start: '', end: '' });
    renderWorkTable();
});

// ============================================================
// Шаг 7: Воинский учёт
// ============================================================
document.getElementById('militaryStatus').addEventListener('change', (e) => {
    const fields = document.getElementById('militaryFields');
    if (e.target.value === 'yes') {
        fields.classList.remove('hidden');
    } else {
        fields.classList.add('hidden');
    }
});

// ============================================================
// Шаг 10: Фото для каждого получателя
// ============================================================
function renderPhotosStep() {
    const container = document.getElementById('photosContainer');
    const allApplicants = [];
    const recipient = document.querySelector('input[name="recipient"]:checked');
    if (recipient && (recipient.value === 'self' || recipient.value === 'self_children')) {
        allApplicants.push({ type: 'self', label: 'Заявитель', data: userProfile, photoPath: null });
    }
    applicants.filter(a => a.type === 'child').forEach((child, idx) => {
        allApplicants.push({ type: 'child', label: `Ребёнок ${idx+1}`, data: child.data, photoPath: child.photoPath });
    });

    if (allApplicants.length === 0) {
        container.innerHTML = '<p>Нет получателей для загрузки фото.</p>';
        return;
    }

    let html = '';
    allApplicants.forEach((app, index) => {
        html += `<div class="photo-upload-block" data-index="${index}">`;
        html += `<h4>${app.label}: ${app.data.surname} ${app.data.name}</h4>`;
        html += `<div class="upload-area" data-index="${index}">`;
        html += `<i class="fas fa-cloud-upload-alt"></i>`;
        html += `<p>Перетащите файл сюда или нажмите для выбора</p>`;
        html += `<input type="file" accept=".jpg,.jpeg" style="display: none;" data-index="${index}" />`;
        html += `</div>`;
        html += `<div class="photo-preview hidden" data-index="${index}">`;
        html += `<img src="#" alt="Предпросмотр" />`;
        html += `</div>`;
        html += `<div class="file-list" data-index="${index}"></div>`;
        html += `</div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.upload-area').forEach(area => {
        const idx = parseInt(area.dataset.index);
        const fileInput = area.querySelector('input[type="file"]');
        area.addEventListener('click', () => fileInput.click());
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.style.background = '#e9ecef';
        });
        area.addEventListener('dragleave', () => {
            area.style.background = '#fafafa';
        });
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.style.background = '#fafafa';
            const files = e.dataTransfer.files;
            if (files.length) {
                fileInput.files = files;
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        });

        fileInput.addEventListener('change', async () => {
            if (!fileInput.files.length) return;
            const file = fileInput.files[0];
            const success = await uploadPhotoForApplicant(idx, file);
            if (success) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewDiv = area.parentElement.querySelector('.photo-preview');
                    const img = previewDiv.querySelector('img');
                    img.src = e.target.result;
                    previewDiv.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
                const fileList = area.parentElement.querySelector('.file-list');
                fileList.innerHTML = `<i class="fas fa-check-circle" style="color:#28a745;"></i> ${file.name}`;
                checkAllPhotosUploaded();
            }
        });
    });
}

async function uploadPhotoForApplicant(index, file) {
    if (!file) return false;
    if (file.size > 1024 * 1024) {
        showError('Фото должно быть не более 1 МБ');
        return false;
    }
    if (file.type !== 'image/jpeg') {
        showError('Только JPG формат');
        return false;
    }

    if (!applicationNumber) {
        applicationNumber = generateApplicationNumber();
    }
    const filePath = `foreign_passport/${applicationNumber}/photo_${index}.jpg`;

    const { error } = await supabase.storage
        .from('services-files')
        .upload(filePath, file, { upsert: false });

    if (error) {
        showError('Ошибка загрузки фото: ' + error.message);
        return false;
    }

    photoPaths[index] = filePath;
    return true;
}

function checkAllPhotosUploaded() {
    const recipient = document.querySelector('input[name="recipient"]:checked');
    let total = 0;
    let uploaded = 0;
    if (recipient && (recipient.value === 'self' || recipient.value === 'self_children')) {
        total++;
        if (photoPaths[0]) uploaded++;
    }
    const childCount = applicants.filter(a => a.type === 'child').length;
    for (let i = 0; i < childCount; i++) {
        total++;
        const idx = (recipient && (recipient.value === 'self' || recipient.value === 'self_children')) ? i + 1 : i;
        if (photoPaths[idx]) uploaded++;
    }
    const nextBtn = document.getElementById('step10NextBtn');
    if (total > 0 && uploaded === total) {
        nextBtn.disabled = false;
    } else {
        nextBtn.disabled = true;
    }
}

// ============================================================
// Шаг 12: Подтверждение
// ============================================================
function prepareSummary() {
    const recipient = document.querySelector('input[name="recipient"]:checked');
    const passportType = document.querySelector('input[name="passportType"]:checked');
    const visaType = document.querySelector('input[name="visaType"]:checked');
    const include = document.querySelector('input[name="includeChildren"]:checked');

    let html = '<table class="summary-table">';
    html += `<tr><th>Тип паспорта</th><td>${passportType ? (passportType.value === 'biometric' ? 'Биометрический' : 'Небиометрический') : '—'}</td></tr>`;
    html += `<tr><th>Кому</th><td>${recipient ? (recipient.value === 'self' ? 'Только себе' : recipient.value === 'self_children' ? 'Себе и детям' : 'Только детям') : '—'}</td></tr>`;
    if (passportType && passportType.value === 'nonbiometric' && recipient && (recipient.value !== 'self')) {
        html += `<tr><th>Вписывать детей в паспорт родителя</th><td>${include ? (include.value === 'yes' ? 'Да' : 'Нет') : '—'}</td></tr>`;
    }
    html += `<tr><th>Заявитель</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Личный код заявителя</th><td>${userProfile.personal_code}</td></tr>`;

    const childrenApplicants = applicants.filter(a => a.type === 'child');
    if (childrenApplicants.length > 0) {
        html += `<tr><th>Дети</th><td>`;
        childrenApplicants.forEach((child, i) => {
            html += `${i+1}. ${child.data.surname} ${child.data.name} ${child.data.patronymic} (${new Date(child.data.date_of_birth).toLocaleDateString('ru-RU')})`;
            if (child.data.place_of_birth) html += `, м.р. ${child.data.place_of_birth}`;
            html += `<br>`;
        });
        html += `</td></tr>`;
    }

    html += `<tr><th>Место работы</th><td>${document.getElementById('workOrg').value || '—'}</td></tr>`;
    html += `<tr><th>Должность</th><td>${document.getElementById('workPosition').value || '—'}</td></tr>`;
    if (workRows.length > 0) {
        html += `<tr><th>Трудовая деятельность (10 лет)</th><td>`;
        workRows.forEach(row => {
            if (row.org) html += `${row.org} (${row.position}) ${row.start} - ${row.end || 'по н.в.'}<br>`;
        });
        html += `</td></tr>`;
    }

    const milStatus = document.getElementById('militaryStatus').value;
    if (milStatus === 'yes') {
        html += `<tr><th>Воинский учёт</th><td>Номер: ${document.getElementById('militaryNumber').value || '—'}, Военкомат: ${document.getElementById('militaryOffice').value || '—'}, Категория: ${document.getElementById('militaryCategory').value || '—'}, ВУС: ${document.getElementById('militaryVUS').value || '—'}</td></tr>`;
    } else {
        html += `<tr><th>Воинский учёт</th><td>Нет</td></tr>`;
    }

    html += `<tr><th>Вид паспорта</th><td>${visaType ? (visaType.value === 'civil' ? 'Общегражданский' : visaType.value === 'diplomatic' ? 'Дипломатический' : 'Служебный') : '—'}</td></tr>`;
    const totalPhotos = Object.keys(photoPaths).length;
    html += `<tr><th>Фото</th><td>Загружено ${totalPhotos} фото</td></tr>`;
    const mvdName = mvdList.find(m => m.id === selectedMvdId)?.name || '—';
    html += `<tr><th>Отделение МВД</th><td>${mvdName}</td></tr>`;
    html += '</table>';
    document.getElementById('summary').innerHTML = html;
}

// ============================================================
// Генерация PDF (с загрузкой шрифта из интернета)
// ============================================================
async function generatePDF() {
    const doc = new jsPDF();
    
    // Попытка загрузить PT Sans из интернета (заменяем base64 на fetch)
    try {
        const fontUrl = 'https://cdn.jsdelivr.net/gh/Paratype/PT_Sans@1.1/PT_Sans-Web-Regular.ttf';
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error('Не удалось загрузить шрифт');
        const arrayBuffer = await response.arrayBuffer();
        // Преобразуем ArrayBuffer в base64
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const fontBase64 = btoa(binary);
        doc.addFileToVFS('PT_Sans.ttf', fontBase64);
        doc.addFont('PT_Sans.ttf', 'PT Sans', 'normal');
        doc.setFont('PT Sans');
    } catch (e) {
        console.warn('Не удалось загрузить PT Sans, используем helvetica с транслитерацией');
        doc.setFont('helvetica');
    }
    
    doc.setLanguage('ru');

    doc.setFontSize(16);
    doc.text('Заявление на заграничный паспорт СФСРЮ', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Номер заявления: ${applicationNumber}`, 10, 30);

    const recipient = document.querySelector('input[name="recipient"]:checked');
    const passportType = document.querySelector('input[name="passportType"]:checked');
    const visaType = document.querySelector('input[name="visaType"]:checked');
    const include = document.querySelector('input[name="includeChildren"]:checked');

    const data = [
        ['Поле', 'Значение'],
        ['Тип паспорта', passportType ? (passportType.value === 'biometric' ? 'Биометрический' : 'Небиометрический') : '—'],
        ['Кому', recipient ? (recipient.value === 'self' ? 'Только себе' : recipient.value === 'self_children' ? 'Себе и детям' : 'Только детям') : '—'],
    ];

    if (passportType && passportType.value === 'nonbiometric' && 
        recipient && (recipient.value === 'self_children' || recipient.value === 'children_only')) {
        data.push(['Вписывать детей в паспорт родителя', include ? (include.value === 'yes' ? 'Да' : 'Нет') : '—']);
    }

    data.push(['Заявитель', `${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}`]);
    data.push(['Личный код заявителя', userProfile.personal_code]);
    data.push(['Дата рождения заявителя', new Date(userProfile.date_of_birth).toLocaleDateString('ru-RU')]);
    data.push(['Место рождения заявителя', userProfile.place_of_birth || '—']);

    const childrenApplicants = applicants.filter(a => a.type === 'child');
    if (childrenApplicants.length > 0) {
        let childrenStr = '';
        childrenApplicants.forEach((child, i) => {
            childrenStr += `${i+1}. ${child.data.surname} ${child.data.name} ${child.data.patronymic} (${new Date(child.data.date_of_birth).toLocaleDateString('ru-RU')})`;
            if (child.data.place_of_birth) childrenStr += `, м.р. ${child.data.place_of_birth}`;
            childrenStr += '\n';
        });
        data.push(['Дети', childrenStr.trim()]);
    }

    data.push(['Место работы (учебы)', document.getElementById('workOrg').value || '—']);
    data.push(['Должность (специальность)', document.getElementById('workPosition').value || '—']);
    
    let workStr = '';
    workRows.forEach(row => {
        if (row.org) {
            workStr += `${row.org}`;
            if (row.position) workStr += ` (${row.position})`;
            if (row.start) workStr += ` с ${row.start}`;
            if (row.end) workStr += ` по ${row.end}`;
            else if (row.start) workStr += ` по настоящее время`;
            workStr += '\n';
        }
    });
    data.push(['Трудовая деятельность (10 лет)', workStr || '—']);

    const milStatus = document.getElementById('militaryStatus').value;
    if (milStatus === 'yes') {
        data.push(['Воинский учёт', `Номер: ${document.getElementById('militaryNumber').value || '—'}, Военкомат: ${document.getElementById('militaryOffice').value || '—'}, Категория: ${document.getElementById('militaryCategory').value || '—'}, ВУС: ${document.getElementById('militaryVUS').value || '—'}`]);
    } else {
        data.push(['Воинский учёт', 'Нет']);
    }

    data.push(['Вид паспорта', visaType ? (visaType.value === 'civil' ? 'Общегражданский' : visaType.value === 'diplomatic' ? 'Дипломатический' : 'Служебный') : '—']);
    data.push(['Количество фото', Object.keys(photoPaths).length]);
    
    const mvd = mvdList.find(m => m.id === selectedMvdId);
    data.push(['Отделение МВД', mvd ? `${mvd.name} (${mvd.address})` : '—']);
    data.push(['Дата подачи заявления', new Date().toLocaleDateString('ru-RU')]);

    autoTable(doc, {
        startY: 40,
        head: [data[0]],
        body: data.slice(1),
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [123, 9, 26] }
    });

    const pdfBlob = doc.output('blob');
    const pdfPath = `foreign_passport/${applicationNumber}/statement.pdf`;
    const { error } = await supabase.storage
        .from('services-files')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf' });
    
    if (error) {
        console.error('Ошибка сохранения PDF:', error);
        showError('Не удалось сохранить PDF, но заявление отправлено.');
    }
    
    return pdfPath;
}

// ============================================================
// Отправка заявления (исправленная версия с проверками)
// ============================================================
async function submitApplication() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../../../login.html';
        return false;
    }

    // Считываем значения из формы
    const passportType = document.querySelector('input[name="passportType"]:checked');
    const recipient = document.querySelector('input[name="recipient"]:checked');
    const visaType = document.querySelector('input[name="visaType"]:checked');
    const include = document.querySelector('input[name="includeChildren"]:checked');

    // === ВАЛИДАЦИЯ ===
    if (!passportType) {
        showError('Выберите тип паспорта');
        return false;
    }
    if (!recipient) {
        showError('Выберите, кому оформляется паспорт');
        return false;
    }
    if (!visaType) {
        showError('Выберите вид паспорта');
        return false;
    }
    // Для небиометрического паспорта и если выбраны дети, нужно указать, вписывать ли их
    if (passportType.value === 'nonbiometric' && 
        (recipient.value === 'self_children' || recipient.value === 'children_only')) {
        if (!include) {
            showError('Укажите, нужно ли вписывать детей в паспорт родителя');
            return false;
        }
    }

    // Формируем данные получателей
    const applicantsData = [];
    if (recipient.value === 'self' || recipient.value === 'self_children') {
        applicantsData.push({
            personal_code: userPersonalCode,
            surname: userProfile.surname,
            name: userProfile.name,
            patronymic: userProfile.patronymic,
            date_of_birth: userProfile.date_of_birth,
            place_of_birth: userProfile.place_of_birth || '',
            gender: userProfile.gender,
            photo_path: photoPaths[0] || null,
            is_applicant: true
        });
    }

    const childrenApplicants = applicants.filter(a => a.type === 'child');
    childrenApplicants.forEach((child, idx) => {
        const photoIdx = (recipient.value === 'self' || recipient.value === 'self_children') ? idx + 1 : idx;
        applicantsData.push({
            personal_code: child.data.personal_code || null,
            surname: child.data.surname,
            name: child.data.name,
            patronymic: child.data.patronymic,
            date_of_birth: child.data.date_of_birth,
            place_of_birth: child.data.place_of_birth || '',
            gender: child.data.gender || 'male',
            photo_path: photoPaths[photoIdx] || null,
            is_applicant: false
        });
    });

    // Сведения о работе
    const workInfo = {
        organization: document.getElementById('workOrg').value || '',
        position: document.getElementById('workPosition').value || '',
        start_date: document.getElementById('workStart').value || null,
        end_date: document.getElementById('workEnd').value || null,
        work_history: workRows
    };

    // Воинский учёт
    const militaryInfoData = {
        has_military: document.getElementById('militaryStatus').value === 'yes',
        number: document.getElementById('militaryNumber').value || '',
        office: document.getElementById('militaryOffice').value || '',
        category: document.getElementById('militaryCategory').value || '',
        vus: document.getElementById('militaryVUS').value || ''
    };

    // Основной payload – все поля обязательные (кроме personal_code, если он nullable)
    const payload = {
        application_number: applicationNumber,
        user_id: session.user.id,
        personal_code: userPersonalCode,
        passport_type: passportType.value,      // теперь точно не null
        recipient_type: recipient.value,
        visa_type: visaType.value,
        include_children_in_parent: (passportType.value === 'nonbiometric' && include) ? (include.value === 'yes') : false,
        work_info: workInfo,
        military_info: militaryInfoData,
        mvd_id: selectedMvdId,
        status: 'submitted',
        service_type: 'foreign_passport'
    };

    console.log('Отправка payload:', payload);

    // Вставка в основную таблицу
    const { data: inserted, error } = await supabase
        .schema('services')
        .from('foreign_passport')
        .insert(payload)
        .select('id')
        .single();

    if (error) {
        showError('Ошибка отправки заявления: ' + error.message);
        return false;
    }

    // Сохраняем получателей
    for (const app of applicantsData) {
        const appPayload = {
            passport_id: inserted.id,
            personal_code: app.personal_code,
            surname: app.surname,
            name: app.name,
            patronymic: app.patronymic,
            date_of_birth: app.date_of_birth,
            place_of_birth: app.place_of_birth,
            gender: app.gender,
            photo_path: app.photo_path,
            is_applicant: app.is_applicant
        };
        const { error: appError } = await supabase
            .schema('services')
            .from('foreign_passport_applicants')
            .insert(appPayload);
        if (appError) {
            console.error('Ошибка сохранения получателя:', appError);
            showError('Заявление создано, но не все получатели сохранены.');
        }
    }

    // Генерируем PDF
    const pdfPath = await generatePDF();

    // Запись в историю статусов
    const historyPayload = {
        passport_id: inserted.id,
        status: 'submitted',
        created_at: new Date().toISOString(),
        attachments: [pdfPath]
    };
    const { error: historyError } = await supabase
        .schema('services')
        .from('foreign_passport_status_history')
        .insert(historyPayload);
    if (historyError) {
        console.error('Ошибка записи в историю:', historyError);
    }

    return true;
}

// ============================================================
// Инициализация
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!await loadUserProfile()) return;

    hasActiveApp = await checkActiveApplication();
    const activeWarning = document.getElementById('activeApplicationWarning');
    const formContainer = document.getElementById('applicationForm');

    if (hasActiveApp) {
        activeWarning.classList.remove('hidden');
        formContainer.classList.add('hidden');
        return;
    } else {
        activeWarning.classList.add('hidden');
        formContainer.classList.remove('hidden');
        formContainer.classList.add('loaded');
    }

    await loadChildren();
    // МВД загружаем при переходе на шаг 11, но можно предзагрузить
    loadMvd();

    // Подсветка радио
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const parentLabel = e.target.closest('label');
            if (parentLabel) {
                const group = parentLabel.closest('.radio-group');
                if (group) {
                    group.querySelectorAll('label').forEach(l => l.classList.remove('selected'));
                    parentLabel.classList.add('selected');
                }
            }
        });
    });
    document.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
        const label = radio.closest('label');
        if (label) label.classList.add('selected');
    });

    // Навигация
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', async () => {
            // Валидация шагов
            if (currentStep === 2) {
                const selected = document.querySelector('input[name="passportType"]:checked');
                if (!selected) { showError('Выберите тип паспорта'); return; }
                selectedPassportType = selected.value;
            }
            if (currentStep === 3) {
                const selected = document.querySelector('input[name="recipient"]:checked');
                if (!selected) { showError('Выберите, кому оформляется паспорт'); return; }
                selectedRecipient = selected.value;
                if (selected.value === 'self') {
                    applicants = applicants.filter(a => a.type !== 'child');
                }
            }
            if (currentStep === 8) {
                const selected = document.querySelector('input[name="includeChildren"]:checked');
                if (!selected) { showError('Укажите, нужно ли вписывать детей в паспорт родителя'); return; }
                includeChildren = selected.value;
            }
            if (currentStep === 9) {
                const selected = document.querySelector('input[name="visaType"]:checked');
                if (!selected) { showError('Выберите вид паспорта'); return; }
                selectedVisaType = selected.value;
            }
            if (currentStep === 10) {
                const nextBtn = document.getElementById('step10NextBtn');
                if (nextBtn.disabled) {
                    showError('Загрузите фото для всех получателей');
                    return;
                }
            }
            if (currentStep === 11) {
                if (!selectedMvdId) {
                    showError('Выберите отделение МВД');
                    return;
                }
            }

            const next = getNextStep(currentStep);
            goToStep(next);
        });
    });

    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const prev = getPrevStep(currentStep);
            goToStep(prev);
        });
    });

    document.getElementById('submitApplication').addEventListener('click', async () => {
        const btn = document.getElementById('submitApplication');
        btn.disabled = true;
        btn.textContent = 'Отправка...';

        const success = await submitApplication();

        btn.disabled = false;
        btn.textContent = 'Отправить заявление';

        if (success) {
            document.getElementById('applicationNumber').textContent = applicationNumber;
            document.getElementById('gotoServiceLink').href = `../../../personal-profile/services/service-view.html?application_number=${applicationNumber}`;
            goToStep(13);
        }
    });

    goToStep(1);
});