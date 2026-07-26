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
let applicants = []; // массив получателей: [{ type: 'self'|'child', data: {...}, photoPath: null }]
let childrenList = []; // список детей из БД (для выбора)
let workRows = []; // массив записей о работе (для таблицы)
let militaryInfo = { hasMilitary: false, number: '', office: '', category: '', vus: '' };
let selectedVisaType = null;
let hasActiveApp = false;

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
// Загрузка профиля пользователя
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

// ============================================================
// Проверка активного заявления
// ============================================================
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
// Загрузка детей пользователя (из таблицы children)
// ============================================================
async function loadChildren() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase
        .from('children')
        .select('id, surname, name, patronymic, date_of_birth, place_of_birth, gender, personal_code')
        .eq('parent_id', session.user.id);
    if (error) {
        console.error('Ошибка загрузки детей:', error);
        return;
    }
    childrenList = data;
}

// ============================================================
// Управление шагами
// ============================================================
function getNextStep(step) {
    // Динамический переход в зависимости от выбора
    switch (step) {
        case 1: return 2;
        case 2: {
            const recipient = document.querySelector('input[name="recipient"]:checked');
            if (!recipient) return 2;
            if (recipient.value === 'self') return 3; // только себе -> сразу инфо о себе, пропускаем детей
            else return 3; // если с детьми, всё равно сначала инфо о себе
        }
        case 3: {
            const recipient = document.querySelector('input[name="recipient"]:checked');
            if (!recipient) return 3;
            if (recipient.value === 'self') return 5; // только себе -> работа
            else return 4; // с детьми -> дети
        }
        case 4: return 5;
        case 5: return 6;
        case 6: return 7;
        case 7: return 8;
        case 8: return 9;
        case 9: return 10;
        default: return step + 1;
    }
}

function getPrevStep(step) {
    switch (step) {
        case 2: return 1;
        case 3: return 2;
        case 4: {
            const recipient = document.querySelector('input[name="recipient"]:checked');
            if (recipient && recipient.value === 'self') return 2; // если только себе, назад на шаг 2
            return 3;
        }
        case 5: {
            const recipient = document.querySelector('input[name="recipient"]:checked');
            if (recipient && (recipient.value === 'self_children' || recipient.value === 'children_only')) return 4;
            return 3;
        }
        case 6: return 5;
        case 7: return 6;
        case 8: return 7;
        case 9: return 8;
        case 10: return 9;
        default: return step - 1;
    }
}

function goToStep(step) {
    if (step < 1 || step > 10) return;

    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    const targetStep = document.querySelector(`.step-content[data-step="${step}"]`);
    if (targetStep) targetStep.classList.remove('hidden');
    currentStep = step;

    // Обработка шагов с динамическим содержимым
    if (step === 3) {
        renderApplicantInfo();
    }
    if (step === 4) {
        renderChildrenStep();
    }
    if (step === 5) {
        renderWorkTable();
    }
    if (step === 8) {
        renderPhotosStep();
    }
    if (step === 9) {
        prepareSummary();
    }
}

// ============================================================
// Шаг 3: Информация о заявителе
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
// Шаг 4: Дети
// ============================================================
function renderChildrenStep() {
    const container = document.getElementById('childrenList');
    // Показываем список уже добавленных детей (applicants, где type === 'child')
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

    // Обработка удаления
    document.querySelectorAll('.remove-child').forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            applicants = applicants.filter((_, i) => i !== idx);
            renderChildrenStep();
        });
    });
}

// Модальное окно для добавления ребёнка (упрощённо – через prompt, но в реальном проекте лучше использовать форму)
document.getElementById('addChildBtn').addEventListener('click', () => {
    // Простой вариант: предложить выбрать из списка детей или ввести вручную
    // Для демонстрации используем prompt
    const choice = confirm('Добавить ребёнка из списка? (OK – из списка, Отмена – вручную)');
    if (choice) {
        // Выбор из списка
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
        // Добавляем в applicants
        applicants.push({
            type: 'child',
            data: {
                personal_code: child.personal_code || null,
                surname: child.surname,
                name: child.name,
                patronymic: child.patronymic,
                date_of_birth: child.date_of_birth,
                place_of_birth: child.place_of_birth || '',
                gender: child.gender || 'male',
                // можно добавить другие поля
            },
            photoPath: null
        });
        renderChildrenStep();
    } else {
        // Ручной ввод
        const surname = prompt('Введите фамилию ребёнка:');
        if (!surname) return;
        const name = prompt('Введите имя ребёнка:');
        if (!name) return;
        const patronymic = prompt('Введите отчество ребёнка:') || '';
        const birthDate = prompt('Введите дату рождения (ГГГГ-ММ-ДД):');
        if (!birthDate) return;
        const birthPlace = prompt('Введите место рождения:') || '';
        const gender = confirm('Пол: OK – мужской, Отмена – женский') ? 'male' : 'female';
        // Добавляем
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
// Шаг 5: Работа (таблица за 10 лет)
// ============================================================
function renderWorkTable() {
    const container = document.getElementById('workTableContainer');
    if (workRows.length === 0) {
        // Добавим одну пустую строку для примера
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

    // Обработка удаления строк
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

    // Сохранение изменений в workRows при вводе
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
// Шаг 6: Воинский учёт
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
// Шаг 7: Вид паспорта
// ============================================================
// (обработка выбора через радио, сохраняется в selectedVisaType)

// ============================================================
// Шаг 8: Фото для каждого получателя
// ============================================================
function renderPhotosStep() {
    const container = document.getElementById('photosContainer');
    // Получатели: заявитель (self) + дети (child)
    const allApplicants = [];
    // Добавляем заявителя, если выбран "себе" или "себе и детям"
    const recipient = document.querySelector('input[name="recipient"]:checked');
    if (recipient && (recipient.value === 'self' || recipient.value === 'self_children')) {
        allApplicants.push({ type: 'self', label: 'Заявитель', data: userProfile, photoPath: null });
    }
    // Добавляем детей
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

    // Навешиваем обработчики для загрузки
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
                // Показать предпросмотр
                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewDiv = area.parentElement.querySelector('.photo-preview');
                    const img = previewDiv.querySelector('img');
                    img.src = e.target.result;
                    previewDiv.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
                // Обновить список файлов
                const fileList = area.parentElement.querySelector('.file-list');
                fileList.innerHTML = `<i class="fas fa-check-circle" style="color:#28a745;"></i> ${file.name}`;
                // Проверить, все ли фото загружены
                checkAllPhotosUploaded();
            }
        });
    });
}

// Хранилище путей фото для каждого получателя (индекс в allApplicants)
let photoPaths = {};

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
    // дети
    const childCount = applicants.filter(a => a.type === 'child').length;
    for (let i = 0; i < childCount; i++) {
        total++;
        const idx = (recipient && (recipient.value === 'self' || recipient.value === 'self_children')) ? i + 1 : i;
        if (photoPaths[idx]) uploaded++;
    }
    const nextBtn = document.getElementById('step8NextBtn');
    if (total > 0 && uploaded === total) {
        nextBtn.disabled = false;
    } else {
        nextBtn.disabled = true;
    }
}

// ============================================================
// Шаг 9: Подтверждение
// ============================================================
function prepareSummary() {
    // Собираем все данные для отображения
    const recipient = document.querySelector('input[name="recipient"]:checked');
    const passportType = document.querySelector('input[name="passportType"]:checked');
    const visaType = document.querySelector('input[name="visaType"]:checked');

    let html = '<table class="summary-table">';
    html += `<tr><th>Тип паспорта</th><td>${passportType ? (passportType.value === 'biometric' ? 'Биометрический' : 'Небиометрический') : '—'}</td></tr>`;
    html += `<tr><th>Кому</th><td>${recipient ? (recipient.value === 'self' ? 'Только себе' : recipient.value === 'self_children' ? 'Себе и детям' : 'Только детям') : '—'}</td></tr>`;
    html += `<tr><th>Заявитель</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Личный код заявителя</th><td>${userProfile.personal_code}</td></tr>`;

    // Дети
    const childrenApplicants = applicants.filter(a => a.type === 'child');
    if (childrenApplicants.length > 0) {
        html += `<tr><th>Дети</th><td>`;
        childrenApplicants.forEach((child, i) => {
            html += `${i+1}. ${child.data.surname} ${child.data.name} ${child.data.patronymic} (${new Date(child.data.date_of_birth).toLocaleDateString('ru-RU')})<br>`;
        });
        html += `</td></tr>`;
    }

    // Работа
    html += `<tr><th>Место работы</th><td>${document.getElementById('workOrg').value || '—'}</td></tr>`;
    html += `<tr><th>Должность</th><td>${document.getElementById('workPosition').value || '—'}</td></tr>`;
    // Таблица работы
    if (workRows.length > 0) {
        html += `<tr><th>Трудовая деятельность (10 лет)</th><td>`;
        workRows.forEach(row => {
            if (row.org) html += `${row.org} (${row.position}) ${row.start} - ${row.end || 'по н.в.'}<br>`;
        });
        html += `</td></tr>`;
    }

    // Воинский учёт
    const milStatus = document.getElementById('militaryStatus').value;
    if (milStatus === 'yes') {
        html += `<tr><th>Воинский учёт</th><td>Номер: ${document.getElementById('militaryNumber').value || '—'}, Военкомат: ${document.getElementById('militaryOffice').value || '—'}, Категория: ${document.getElementById('militaryCategory').value || '—'}, ВУС: ${document.getElementById('militaryVUS').value || '—'}</td></tr>`;
    } else {
        html += `<tr><th>Воинский учёт</th><td>Нет</td></tr>`;
    }

    // Вид паспорта
    html += `<tr><th>Вид паспорта</th><td>${visaType ? (visaType.value === 'civil' ? 'Общегражданский' : visaType.value === 'diplomatic' ? 'Дипломатический' : 'Служебный') : '—'}</td></tr>`;

    // Фото
    const totalPhotos = Object.keys(photoPaths).length;
    html += `<tr><th>Фото</th><td>Загружено ${totalPhotos} фото</td></tr>`;

    html += '</table>';
    document.getElementById('summary').innerHTML = html;
}

// ============================================================
// Генерация PDF (с плейсхолдером для шрифта)
// ============================================================
async function generatePDF() {
    const doc = new jsPDF();
    // Шрифт PT Sans (base64 вставлен, но для краткости здесь ...)
    // Полный base64 шрифта можно скопировать из другого проекта.
    const fontBase64 = '...'; // здесь будет полный base64 шрифта
    doc.addFileToVFS('PT_Sans.ttf', fontBase64);
    doc.addFont('PT_Sans.ttf', 'PT Sans', 'normal');
    doc.setFont('PT Sans');
    doc.setLanguage('ru');

    doc.setFontSize(16);
    doc.text('Заявление на заграничный паспорт СФСРЮ', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Номер заявления: ${applicationNumber}`, 10, 30);

    const recipient = document.querySelector('input[name="recipient"]:checked');
    const passportType = document.querySelector('input[name="passportType"]:checked');
    const visaType = document.querySelector('input[name="visaType"]:checked');

    const data = [
        ['Поле', 'Значение'],
        ['Тип паспорта', passportType ? (passportType.value === 'biometric' ? 'Биометрический' : 'Небиометрический') : '—'],
        ['Кому', recipient ? (recipient.value === 'self' ? 'Только себе' : recipient.value === 'self_children' ? 'Себе и детям' : 'Только детям') : '—'],
        ['Заявитель', `${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}`],
        ['Личный код заявителя', userProfile.personal_code],
    ];

    const childrenApplicants = applicants.filter(a => a.type === 'child');
    if (childrenApplicants.length > 0) {
        let childrenStr = '';
        childrenApplicants.forEach((child, i) => {
            childrenStr += `${i+1}. ${child.data.surname} ${child.data.name} ${child.data.patronymic} (${new Date(child.data.date_of_birth).toLocaleDateString('ru-RU')}) `;
        });
        data.push(['Дети', childrenStr]);
    }

    data.push(['Место работы', document.getElementById('workOrg').value || '—']);
    data.push(['Должность', document.getElementById('workPosition').value || '—']);
    // Таблица работы
    let workStr = '';
    workRows.forEach(row => {
        if (row.org) workStr += `${row.org} (${row.position}) ${row.start} - ${row.end || 'по н.в.'}\n`;
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
// Отправка заявления
// ============================================================
async function submitApplication() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../../../login.html';
        return false;
    }

    // Собираем данные
    const passportType = document.querySelector('input[name="passportType"]:checked');
    const recipient = document.querySelector('input[name="recipient"]:checked');
    const visaType = document.querySelector('input[name="visaType"]:checked');

    // Формируем массив получателей (applicants)
    const applicantsData = [];
    // Заявитель, если выбран "себе" или "себе и детям"
    if (recipient && (recipient.value === 'self' || recipient.value === 'self_children')) {
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
    // Дети
    const childrenApplicants = applicants.filter(a => a.type === 'child');
    childrenApplicants.forEach((child, idx) => {
        const photoIdx = (recipient && (recipient.value === 'self' || recipient.value === 'self_children')) ? idx + 1 : idx;
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

    // Основная запись в foreign_passport
    const payload = {
        application_number: applicationNumber,
        user_id: session.user.id,
        passport_type: passportType ? passportType.value : null,
        recipient_type: recipient ? recipient.value : null,
        visa_type: visaType ? visaType.value : null,
        work_info: workInfo,
        military_info: militaryInfoData,
        status: 'submitted',
        service_type: 'foreign_passport',
        applicants: applicantsData // сохраним как JSONB для истории, но также запишем в отдельную таблицу
    };

    // Вставляем в основную таблицу
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

    // Сохраняем каждого получателя в foreign_passport_applicants
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

    // Запись истории статусов
    const historyPayload = {
        passport_id: inserted.id,
        status: 'submitted',
        created_at: new Date().toISOString(),
        attachments: [pdfPath] // путь к PDF
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
// Инициализация при загрузке страницы
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

    // Обработка выбора радио (подсветка)
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
    // Подсветить уже выбранные
    document.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
        const label = radio.closest('label');
        if (label) label.classList.add('selected');
    });

    // Навигация
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', async () => {
            // Валидация шага
            if (currentStep === 1) {
                const selected = document.querySelector('input[name="passportType"]:checked');
                if (!selected) { showError('Выберите тип паспорта'); return; }
                selectedPassportType = selected.value;
            }
            if (currentStep === 2) {
                const selected = document.querySelector('input[name="recipient"]:checked');
                if (!selected) { showError('Выберите, кому оформляется паспорт'); return; }
                selectedRecipient = selected.value;
                // Если выбрано "только себе", очищаем детей
                if (selected.value === 'self') {
                    applicants = applicants.filter(a => a.type !== 'child');
                }
            }
            if (currentStep === 7) {
                const selected = document.querySelector('input[name="visaType"]:checked');
                if (!selected) { showError('Выберите вид паспорта'); return; }
                selectedVisaType = selected.value;
            }
            if (currentStep === 8) {
                // Проверка загрузки всех фото уже сделана через disabled кнопки
                const nextBtn = document.getElementById('step8NextBtn');
                if (nextBtn.disabled) {
                    showError('Загрузите фото для всех получателей');
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

    // Отправка
    document.getElementById('submitApplication').addEventListener('click', async () => {
        const btn = document.getElementById('submitApplication');
        btn.disabled = true;
        btn.textContent = 'Отправка...';

        // Генерируем PDF
        const pdfPath = await generatePDF();

        const success = await submitApplication();

        btn.disabled = false;
        btn.textContent = 'Отправить заявление';

        if (success) {
            document.getElementById('applicationNumber').textContent = applicationNumber;
            document.getElementById('gotoServiceLink').href = `../../../personal-profile/services/service-view.html?id=${applicationNumber}`;
            goToStep(10);
        }
    });

    // Начало с шага 1
    goToStep(1);
});