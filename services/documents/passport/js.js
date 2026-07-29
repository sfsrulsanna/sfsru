import { supabase } from '../../../js/supabase-config.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

let currentStep = 1;
let userProfile = null;
let userPersonalCode = null;
let applicationNumber = null;
let photoPath = null;
let selectedMvdId = null;
let mvdList = [];
let formData = {
    reason: null,
    reasonDetails: null,
    newData: {},
    phone: '',
    email: '',
    registrationAddress: '',
    actualAddress: ''
};
let hasActiveApp = false;
let isLostReason = false;

function generateApplicationNumber() {
    const digits = Math.floor(100000000 + Math.random() * 900000000);
    return `P-${digits}`;
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
    formData.phone = data.phone || '';
    formData.email = data.email || '';
    return true;
}

async function checkActiveApplication() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { data, error } = await supabase
        .schema('services')
        .from('passport')
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

async function loadMvd() {
    const { data, error } = await supabase
        .from('mvd')
        .select('*')
        .order('name');
    if (error) throw error;
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

// ===== Новая функция загрузки адресов =====
async function loadUserAddresses() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data, error } = await supabase
        .from('addresses')
        .select('permanent_registration, actual_residence')
        .eq('user_id', session.user.id)
        .single();
    if (error) {
        console.warn('Не удалось загрузить адреса:', error);
        return null;
    }
    return data;
}

// ===== Сбор выбранных штампов =====
function collectStamps() {
    const checks = document.querySelectorAll('.stamp-item input[type="checkbox"]:checked:not([disabled])');
    return Array.from(checks).map(cb => cb.value).filter(Boolean);
}

// ===== Обновлённые функции переходов =====
function getNextStep(step) {
    switch (step) {
        case 1: return 2;
        case 2: return 3;
        case 3: return isLostReason ? 3 : 4;
        case 4:
            if (['name_changed', 'appearance', 'error'].includes(formData.reason)) return 5;
            else if (formData.reason === 'first_14') return 6;
            else return 7;
        case 5: return formData.reason === 'name_changed' ? 6 : 7;
        case 6: return 7;
        case 7: return 8;
        case 8: return 9;          // контакты → штампы
        case 9: return 10;         // штампы → фото
        case 10: return 11;        // фото → МВД
        case 11: return 12;        // МВД → проверка
        case 12: return 13;        // проверка → завершение
        default: return step + 1;
    }
}

function getPrevStep(step) {
    switch (step) {
        case 2: return 1;
        case 3: return 2;
        case 4: return 3;
        case 5: return 4;
        case 6: return (['name_changed', 'appearance', 'error'].includes(formData.reason)) ? 5 : 4;
        case 7: return (formData.reason === 'name_changed' || formData.reason === 'first_14') ? 6 : (['name_changed', 'appearance', 'error'].includes(formData.reason) ? 5 : 4);
        case 8: return 7;
        case 9: return 8;          // штампы → контакты
        case 10: return 9;         // фото → штампы
        case 11: return 10;        // МВД → фото
        case 12: return 11;        // проверка → МВД
        case 13: return 12;        // завершение → проверка
        default: return step - 1;
    }
}

function goToStep(step) {
    if (step < 1 || step > 13) return;

    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    const targetStep = document.querySelector(`.step-content[data-step="${step}"]`);
    if (targetStep) targetStep.classList.remove('hidden');
    currentStep = step;

    if (step === 3) {
        const normalContent = document.getElementById('step3NormalContent');
        const lostBlock = document.getElementById('lostMessage');
        const nextBtn = document.getElementById('step3NextBtn');
        if (isLostReason) {
            normalContent.classList.add('hidden');
            lostBlock.classList.remove('hidden');
            nextBtn.disabled = true;
        } else {
            normalContent.classList.remove('hidden');
            lostBlock.classList.add('hidden');
            nextBtn.disabled = false;
        }

        let price = 300;
        if (formData.reason === 'lost' || formData.reason === 'damaged') {
            price = 1500;
        } else if (formData.reason === 'citizenship') {
            price = 0;
        }
        const priceSpan = document.getElementById('priceDisplay');
        priceSpan.textContent = price === 0 ? 'Бесплатно' : price + ' ₽';
    }

    if (step === 4) {
        renderProfileData();
    }

    if (step === 5) {
        document.getElementById('newSurname').value = formData.newData.surname || '';
        document.getElementById('newName').value = formData.newData.name || '';
        document.getElementById('newPatronymic').value = formData.newData.patronymic || '';
        document.getElementById('newBirthDate').value = formData.newData.birth_date || '';
        document.getElementById('newBirthPlace').value = formData.newData.birth_place || '';
    }

    if (step === 6) {
        const birthStatic = document.getElementById('birthCertificateStatic');
        const typeSelector = document.getElementById('certificateTypeSelector');

        if (formData.reason === 'first_14') {
            birthStatic.classList.remove('hidden');
            typeSelector.classList.add('hidden');
        } else {
            birthStatic.classList.add('hidden');
            typeSelector.classList.remove('hidden');
        }

        if (formData.reasonDetails) {
            document.getElementById('certificateNumber').value = formData.reasonDetails.number || '';
            document.getElementById('certificateDate').value = formData.reasonDetails.date || '';
            document.getElementById('certificateIssuedBy').value = formData.reasonDetails.issuedBy || '';
            if (formData.reason === 'name_changed') {
                document.getElementById('certificateType').value = formData.reasonDetails.type || 'marriage';
            }
        } else {
            document.getElementById('certificateNumber').value = '';
            document.getElementById('certificateDate').value = '';
            document.getElementById('certificateIssuedBy').value = '';
            if (formData.reason === 'name_changed') {
                document.getElementById('certificateType').value = 'marriage';
            }
        }
    }

    // ===== Шаг 7: загрузка адресов и плашка =====
    if (step === 7) {
        // Загружаем адреса из таблицы addresses
        loadUserAddresses().then(addresses => {
            if (addresses) {
                document.getElementById('registration_address').value = addresses.permanent_registration || '';
                document.getElementById('actual_address').value = addresses.actual_residence || '';
            }
        });

        // Добавляем плашку, если ещё не добавлена
        const container = document.querySelector('.step-content[data-step="7"]');
        let note = container.querySelector('.address-note');
        if (!note) {
            note = document.createElement('div');
            note.className = 'alert alert-warning address-note';
            note.innerHTML = '<i class="fas fa-info-circle"></i> Если адрес указан неверно, измените его в разделе <a href="../../../profile/addresses.html" target="_blank">Адреса</a> личного кабинета.';
            container.insertBefore(note, container.querySelector('.navigation'));
        }
    }

    if (step === 8) {
        document.getElementById('phone').value = formData.phone;
        document.getElementById('email').value = formData.email;
    }

    if (step === 10) {
        const nextBtn = document.getElementById('step10NextBtn');
        nextBtn.disabled = !photoPath;
        if (photoPath) {
            document.getElementById('fileList').innerHTML = '<i class="fas fa-check-circle" style="color:#28a745;"></i> Фото загружено';
        }
    }

    if (step === 12) {
        prepareSummary();
    }
}

async function validateStep(step) {
    switch (step) {
        case 2: {
            const reason = document.querySelector('input[name="reason"]:checked');
            if (!reason) {
                showError('Выберите причину оформления');
                return false;
            }
            formData.reason = reason.value;
            isLostReason = (reason.value === 'lost');
            break;
        }
        case 3: {
            if (isLostReason) {
                showError('Для утери паспорта онлайн-подача недоступна');
                return false;
            }
            break;
        }
        case 5: {
            const surname = document.getElementById('newSurname').value.trim();
            const name = document.getElementById('newName').value.trim();
            const patronymic = document.getElementById('newPatronymic').value.trim();
            const birthDate = document.getElementById('newBirthDate').value;
            const birthPlace = document.getElementById('newBirthPlace').value.trim();
            if (!surname && !name && !patronymic && !birthDate && !birthPlace) {
                showError('Заполните хотя бы одно поле новых данных. Если данные не изменились, укажите текущие значения.');
                return false;
            }
            break;
        }
        case 6: {
            const certNumber = document.getElementById('certificateNumber').value.trim();
            const certDate = document.getElementById('certificateDate').value;
            const certIssued = document.getElementById('certificateIssuedBy').value.trim();

            if (!certNumber || !certDate || !certIssued) {
                showError('Заполните все поля свидетельства');
                return false;
            }

            if (formData.reason === 'first_14') {
                formData.reasonDetails = {
                    type: 'birth_certificate',
                    number: certNumber,
                    date: certDate,
                    issuedBy: certIssued
                };
            } else if (formData.reason === 'name_changed') {
                formData.reasonDetails = {
                    type: document.getElementById('certificateType').value,
                    number: certNumber,
                    date: certDate,
                    issuedBy: certIssued
                };
            }
            break;
        }
        case 7: {
            const regAddr = document.getElementById('registration_address').value.trim();
            if (!regAddr) {
                showError('Введите адрес постоянной регистрации');
                return false;
            }
            formData.registrationAddress = regAddr;
            formData.actualAddress = document.getElementById('actual_address').value.trim() || regAddr;
            break;
        }
        case 8: {
            const phone = document.getElementById('phone').value.trim();
            const email = document.getElementById('email').value.trim();
            if (!phone || !email) {
                showError('Заполните телефон и email');
                return false;
            }
            formData.phone = phone;
            formData.email = email;
            break;
        }
        case 10: {
            if (!photoPath) {
                showError('Сначала загрузите фото');
                return false;
            }
            break;
        }
        case 11: {
            if (!selectedMvdId) {
                showError('Выберите отделение МВД');
                return false;
            }
            break;
        }
    }
    return true;
}

async function uploadPhoto(file) {
    if (!file) return false;
    if (file.size > 1024 * 1024) {
        showError('Фото должно быть не более 1 МБ');
        return false;
    }
    if (file.type !== 'image/jpeg') {
        showError('Только JPG формат');
        return false;
    }

    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const fileList = document.getElementById('fileList');
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    fileList.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Загрузка...';

    if (!applicationNumber) {
        applicationNumber = generateApplicationNumber();
    }
    const filePath = `passport/${applicationNumber}/photo.jpg`;

    const { error } = await supabase.storage
        .from('services-files')
        .upload(filePath, file, { upsert: false });

    if (error) {
        showError('Ошибка загрузки фото: ' + error.message);
        progressContainer.classList.add('hidden');
        return false;
    }

    photoPath = filePath;
    progressBar.style.width = '100%';
    fileList.innerHTML = '<i class="fas fa-check-circle" style="color:#28a745;"></i> ' + file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('photoPreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    return true;
}

function renderProfileData() {
    const container = document.getElementById('profileData');
    let html = `<table class="summary-table">`;
    html += `<tr><th>Личный код</th><td>${userProfile.personal_code || '—'}</td></tr>`;
    html += `<tr><th>ФИО</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Дата рождения</th><td>${new Date(userProfile.date_of_birth).toLocaleDateString('ru-RU')}</td></tr>`;
    html += `<tr><th>Место рождения</th><td>${userProfile.place_of_birth || '—'}</td></tr>`;
    html += `<tr><th>Пол</th><td>${userProfile.gender === 'male' ? 'Мужской' : 'Женский'}</td></tr>`;
    html += '</table>';
    container.innerHTML = html;
}

function prepareSummary() {
    formData.newData = {
        surname: document.getElementById('newSurname').value,
        name: document.getElementById('newName').value,
        patronymic: document.getElementById('newPatronymic').value,
        birth_date: document.getElementById('newBirthDate').value,
        birth_place: document.getElementById('newBirthPlace').value
    };

    let html = '<table class="summary-table">';
    html += `<tr><th>Номер заявления</th><td>${applicationNumber}</td></tr>`;
    const reasonText = document.querySelector('input[name="reason"]:checked')?.parentElement?.textContent?.trim() || formData.reason;
    html += `<tr><th>Причина</th><td>${reasonText}</td></tr>`;
    if (formData.reasonDetails) {
        let typeLabel = formData.reasonDetails.type;
        if (typeLabel === 'birth_certificate') typeLabel = 'Свидетельство о рождении';
        else if (typeLabel === 'marriage') typeLabel = 'Свидетельство о браке';
        else if (typeLabel === 'divorce') typeLabel = 'Свидетельство о разводе';
        else if (typeLabel === 'name_change') typeLabel = 'Свидетельство о перемене имени';
        html += `<tr><th>Данные свидетельства</th><td>${typeLabel}, №${formData.reasonDetails.number} от ${formData.reasonDetails.date}, ${formData.reasonDetails.issuedBy}</td></tr>`;
    }
    html += `<tr><th>Личный код</th><td>${userProfile.personal_code}</td></tr>`;
    html += `<tr><th>ФИО (текущее)</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;

    if (Object.values(formData.newData).some(v => v)) {
        html += `<tr><th>Новые данные</th><td>`;
        if (formData.newData.surname || formData.newData.name || formData.newData.patronymic)
            html += `ФИО: ${formData.newData.surname} ${formData.newData.name} ${formData.newData.patronymic}<br>`;
        if (formData.newData.birth_date)
            html += `Дата рождения: ${new Date(formData.newData.birth_date).toLocaleDateString('ru-RU')}<br>`;
        if (formData.newData.birth_place)
            html += `Место рождения: ${formData.newData.birth_place}`;
        html += `</td></tr>`;
    }

    html += `<tr><th>Адрес регистрации</th><td>${formData.registrationAddress}</td></tr>`;
    if (formData.actualAddress && formData.actualAddress !== formData.registrationAddress) {
        html += `<tr><th>Фактический адрес</th><td>${formData.actualAddress}</td></tr>`;
    }
    html += `<tr><th>Телефон</th><td>${formData.phone}</td></tr>`;
    html += `<tr><th>Email</th><td>${formData.email}</td></tr>`;
    const mvdName = mvdList.find(m => m.id === selectedMvdId)?.name || '—';
    html += `<tr><th>Отделение МВД</th><td>${mvdName}</td></tr>`;
    html += `<tr><th>Фото</th><td>загружено</td></tr>`;
    // Штампы
    const stamps = collectStamps();
    if (stamps.length) {
        html += `<tr><th>Выбранные штампы</th><td>${stamps.join(', ')}</td></tr>`;
    } else {
        html += `<tr><th>Выбранные штампы</th><td>Только обязательные</td></tr>`;
    }
    html += '</table>';
    document.getElementById('summary').innerHTML = html;
}

async function generatePDF() {
    const doc = new jsPDF();
    
    // Вместо реального base64 шрифта используется троеточие
    const fontBase64 = '...';
    
    doc.addFileToVFS('PT_Sans.ttf', fontBase64);
    doc.addFont('PT_Sans.ttf', 'PT Sans', 'normal');
    doc.setFont('PT Sans');
    doc.setLanguage('ru');

    doc.setFontSize(16);
    doc.text('Заявление на получение паспорта', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Номер заявления: ${applicationNumber}`, 10, 30);

    const data = [
        ['Поле', 'Значение'],
        ['Причина', document.querySelector('input[name="reason"]:checked')?.parentElement?.textContent?.trim() || formData.reason],
        ['Личный код', userProfile.personal_code],
        ['ФИО', `${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}`],
        ['Дата рождения', new Date(userProfile.date_of_birth).toLocaleDateString('ru-RU')],
        ['Место рождения', userProfile.place_of_birth || '—'],
        ['Адрес регистрации', formData.registrationAddress],
        ['Фактический адрес', formData.actualAddress || formData.registrationAddress],
        ['Телефон', formData.phone],
        ['Email', formData.email],
        ['Отделение МВД', mvdList.find(m => m.id === selectedMvdId)?.name || '—'],
    ];

    if (formData.reasonDetails) {
        let certTypeText = '';
        if (formData.reasonDetails.type === 'birth_certificate') {
            certTypeText = 'Свидетельство о рождении';
        } else if (formData.reasonDetails.type === 'marriage') {
            certTypeText = 'Свидетельство о браке';
        } else if (formData.reasonDetails.type === 'divorce') {
            certTypeText = 'Свидетельство о разводе';
        } else if (formData.reasonDetails.type === 'name_change') {
            certTypeText = 'Свидетельство о перемене имени';
        } else {
            certTypeText = formData.reasonDetails.type;
        }
        data.push(['Данные свидетельства', `${certTypeText}, №${formData.reasonDetails.number} от ${formData.reasonDetails.date}, ${formData.reasonDetails.issuedBy}`]);
    }

    if (Object.values(formData.newData).some(v => v)) {
        let newDataStr = '';
        if (formData.newData.surname || formData.newData.name || formData.newData.patronymic)
            newDataStr += `ФИО: ${formData.newData.surname} ${formData.newData.name} ${formData.newData.patronymic}\n`;
        if (formData.newData.birth_date)
            newDataStr += `Дата рождения: ${new Date(formData.newData.birth_date).toLocaleDateString('ru-RU')}\n`;
        if (formData.newData.birth_place)
            newDataStr += `Место рождения: ${formData.newData.birth_place}`;
        if (newDataStr) data.push(['Новые данные', newDataStr]);
    }

    // Штампы
    const stamps = collectStamps();
    if (stamps.length) {
        data.push(['Выбранные штампы', stamps.join(', ')]);
    } else {
        data.push(['Выбранные штампы', 'Только обязательные']);
    }

    autoTable(doc, {
        startY: 40,
        head: [data[0]],
        body: data.slice(1),
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [123, 9, 26] }
    });

    const pdfBlob = doc.output('blob');
    const pdfPath = `passport/${applicationNumber}/statement.pdf`;
    const { error } = await supabase.storage
        .from('services-files')
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf' });
    if (error) {
        console.error('Ошибка сохранения PDF:', error);
        showError('Не удалось сохранить PDF, но заявление отправлено.');
    }
}

async function submitApplication() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../../../login.html';
        return false;
    }

    const pdfPath = `passport/${applicationNumber}/statement.pdf`;
    const attachments = [];
    if (photoPath) attachments.push(photoPath);
    attachments.push(pdfPath);

    const payload = {
        application_number: applicationNumber,
        user_id: session.user.id,
        personal_code: userPersonalCode,
        reason: formData.reason,
        reason_details: formData.reasonDetails,
        personal_data: {
            surname: userProfile.surname,
            name: userProfile.name,
            patronymic: userProfile.patronymic,
            birth_date: userProfile.date_of_birth,
            birth_place: userProfile.place_of_birth,
            gender: userProfile.gender
        },
        new_personal_data: formData.newData,
        registration_address: formData.registrationAddress,
        actual_address: formData.actualAddress || formData.registrationAddress,
        phone: formData.phone,
        email: formData.email,
        mvd_id: selectedMvdId,
        status: 'submitted',
        service_type: 'passport',
        stamps: collectStamps()   // добавлено
    };

    const { data: inserted, error } = await supabase
        .schema('services')
        .from('passport')
        .insert(payload)
        .select('id')
        .single();

    if (error) {
        showError('Ошибка отправки заявления: ' + error.message);
        return false;
    }

    const historyPayload = {
        passport_id: inserted.id,
        status: 'submitted',
        created_at: new Date().toISOString(),
        attachments: attachments
    };

    const { error: historyError } = await supabase
        .schema('services')
        .from('passport_status_history')
        .insert(historyPayload);

    if (historyError) {
        console.error('Ошибка записи в историю статусов:', historyError);
        showError('Заявление создано, но не удалось записать историю статусов.');
    }

    return true;
}

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

    try {
        await loadMvd();
    } catch (e) {
        console.error('Ошибка загрузки отделений', e);
        showError('Не удалось загрузить список отделений МВД');
    }

    // Drag & drop и авто-загрузка
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('photoUpload');
    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.background = '#e9ecef';
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.background = '#fafafa';
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.background = '#fafafa';
            const files = e.dataTransfer.files;
            if (files.length) {
                fileInput.files = files;
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        });
    }

    fileInput.addEventListener('change', async () => {
        if (!fileInput.files.length) return;
        const nextBtn = document.getElementById('step10NextBtn');
        nextBtn.disabled = true;
        const success = await uploadPhoto(fileInput.files[0]);
        if (success) {
            nextBtn.disabled = false;
        }
    });

    document.querySelectorAll('input[name="reason"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('.radio-group label').forEach(label => label.classList.remove('selected'));
            if (e.target.checked) {
                e.target.closest('label').classList.add('selected');
            }
            isLostReason = (e.target.value === 'lost');
        });
    });
    const checkedRadio = document.querySelector('input[name="reason"]:checked');
    if (checkedRadio) {
        checkedRadio.closest('label').classList.add('selected');
        isLostReason = (checkedRadio.value === 'lost');
    }

    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (await validateStep(currentStep)) {
                if (currentStep === 3 && isLostReason) return;
                const next = getNextStep(currentStep);
                goToStep(next);
            }
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

        await generatePDF();
        const success = await submitApplication();

        btn.disabled = false;
        btn.textContent = 'Отправить заявление';

        if (success) {
            document.getElementById('applicationNumber').textContent = applicationNumber;
            document.getElementById('gotoServiceLink').href = `../../../personal-profile/services/service-view.html?id=${applicationNumber}`;
            goToStep(13);
        }
    });

    goToStep(1);
});