import { supabase } from '../../../js/supabase-config.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Подключение кириллического шрифта (замените base64 на ваш)
// Пример: можно использовать стандартный шрифт 'times', но он не поддерживает кириллицу.
// Ниже приведён вариант с подключением PT Sans (нужно добавить файл).
// Для простоты пока оставим стандартный, но с установкой языка.
// Более надёжно: добавить шрифт через API.
// Инструкция по подключению шрифта будет дана отдельно.

let currentStep = 1;
const totalSteps = 9;
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
    email: ''
};
let hasActiveApp = false;
let isLostReason = false; // флаг для утери

function generateApplicationNumber() {
    const digits = Math.floor(100000000 + Math.random() * 900000000);
    return `P-${digits}`;
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
        const div = document.createElement('div');
        div.className = 'mvd-item';
        div.dataset.id = mvd.id;
        div.innerHTML = `<strong>${mvd.name}</strong><br>${mvd.address}<br><small>${mvd.working_hours || ''}</small>`;
        div.addEventListener('click', () => {
            document.querySelectorAll('.mvd-item').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            selectedMvdId = mvd.id;
        });
        container.appendChild(div);
    });
}

function updateSteps() {
    document.querySelectorAll('.step-item').forEach((el, index) => {
        const step = index + 1;
        el.classList.toggle('active', step === currentStep);
        el.classList.toggle('completed', step < currentStep);
    });
}

function goToStep(step) {
    if (step < 1 || step > totalSteps) return;
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    document.querySelector(`.step-content[data-step="${step}"]`).classList.remove('hidden');
    currentStep = step;
    updateSteps();

    if (step === 3) {
        const lostMsg = document.getElementById('lostMessage');
        const nextBtn = document.querySelector('.step-content[data-step="3"] .next-step');
        if (isLostReason) {
            lostMsg.classList.remove('hidden');
            if (nextBtn) nextBtn.disabled = true;
        } else {
            lostMsg.classList.add('hidden');
            if (nextBtn) nextBtn.disabled = false;
        }
    }

    if (step === 4) {
        renderProfileData();
    }
    if (step === 5) {
        document.getElementById('phone').value = formData.phone;
        document.getElementById('email').value = formData.email;
    }
    if (step === 8) {
        prepareSummary();
    }
}

async function validateStep(step) {
    switch (step) {
        case 2:
            const reason = document.querySelector('input[name="reason"]:checked');
            if (!reason) {
                showError('Выберите причину оформления');
                return false;
            }
            // Если утеря – запоминаем, но переход на следующий шаг разрешаем
            formData.reason = reason.value;
            if (reason.value === 'name_changed') {
                const certNumber = document.getElementById('certificateNumber').value.trim();
                const certDate = document.getElementById('certificateDate').value;
                const certIssued = document.getElementById('certificateIssuedBy').value.trim();
                if (!certNumber || !certDate || !certIssued) {
                    showError('Заполните все поля свидетельства');
                    return false;
                }
                formData.reasonDetails = {
                    type: document.getElementById('nameChangeReason').value,
                    number: certNumber,
                    date: certDate,
                    issuedBy: certIssued
                };
            }
            break;
        case 5:
            const phone = document.getElementById('phone').value.trim();
            const email = document.getElementById('email').value.trim();
            if (!phone || !email) {
                showError('Заполните телефон и email');
                return false;
            }
            formData.phone = phone;
            formData.email = email;
            break;
        case 6:
            if (!photoPath) {
                showError('Сначала загрузите фото');
                return false;
            }
            break;
        case 7:
            if (!selectedMvdId) {
                showError('Выберите отделение МВД');
                return false;
            }
            break;
    }
    return true;
}

function showError(msg) {
    const errDiv = document.getElementById('errorMessage');
    errDiv.textContent = msg;
    errDiv.classList.remove('hidden');
    setTimeout(() => errDiv.classList.add('hidden'), 5000);
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
    if (!applicationNumber) {
        applicationNumber = generateApplicationNumber();
    }
    const filePath = `passport/${applicationNumber}/photo.jpg`;
    const { error } = await supabase.storage
        .from('services-files')
        .upload(filePath, file, { upsert: false });
    if (error) {
        showError('Ошибка загрузки фото: ' + error.message);
        return false;
    }
    photoPath = filePath;
    return true;
}

function renderProfileData() {
    const container = document.getElementById('profileData');
    const reason = formData.reason;
    let html = `<table class="summary-table"><tr><th>Личный код</th><td>${userProfile.personal_code}</td></tr>`;
    html += `<tr><th>ФИО</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Дата рождения</th><td>${new Date(userProfile.date_of_birth).toLocaleDateString('ru-RU')}</td></tr>`;
    html += `<tr><th>Место рождения</th><td>${userProfile.place_of_birth || '—'}</td></tr>`;
    html += `<tr><th>Пол</th><td>${userProfile.gender}</td></tr>`;
    html += '</table>';

    if (reason === 'name_changed' || reason === 'appearance' || reason === 'error') {
        document.getElementById('newDataFields').classList.remove('hidden');
    } else {
        document.getElementById('newDataFields').classList.add('hidden');
    }
    container.innerHTML = html;
}

function prepareSummary() {
    let html = '<table class="summary-table">';
    html += `<tr><th>Номер заявления</th><td>${applicationNumber}</td></tr>`;
    html += `<tr><th>Причина</th><td>${document.querySelector('input[name="reason"]:checked')?.parentElement?.textContent?.trim() || formData.reason}</td></tr>`;
    if (formData.reasonDetails) {
        html += `<tr><th>Данные свидетельства</th><td>${formData.reasonDetails.type}, №${formData.reasonDetails.number} от ${formData.reasonDetails.date}, ${formData.reasonDetails.issuedBy}</td></tr>`;
    }
    html += `<tr><th>Личный код</th><td>${userProfile.personal_code}</td></tr>`;
    html += `<tr><th>ФИО</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    if (!document.getElementById('newDataFields').classList.contains('hidden')) {
        const newSurname = document.getElementById('newSurname').value;
        const newName = document.getElementById('newName').value;
        const newPatr = document.getElementById('newPatronymic').value;
        const newBD = document.getElementById('newBirthDate').value;
        const newBP = document.getElementById('newBirthPlace').value;
        if (newSurname || newName || newPatr || newBD || newBP) {
            html += `<tr><th>Новые данные</th><td>`;
            if (newSurname || newName || newPatr) html += `ФИО: ${newSurname} ${newName} ${newPatr}<br>`;
            if (newBD) html += `Дата рождения: ${new Date(newBD).toLocaleDateString('ru-RU')}<br>`;
            if (newBP) html += `Место рождения: ${newBP}`;
            html += `</td></tr>`;
        }
    }
    html += `<tr><th>Телефон</th><td>${formData.phone}</td></tr>`;
    html += `<tr><th>Email</th><td>${formData.email}</td></tr>`;
    html += `<tr><th>Отделение МВД</th><td>${mvdList.find(m => m.id === selectedMvdId)?.name || '—'}</td></tr>`;
    html += `<tr><th>Фото</th><td>загружено</td></tr>`;
    html += '</table>';
    document.getElementById('summary').innerHTML = html;
}

async function generatePDF() {
    // Создаём документ с поддержкой кириллицы (предполагается, что шрифт подключен)
    const doc = new jsPDF();
    // Если вы подключили шрифт через addFont, раскомментируйте следующую строку:
    // doc.setFont('PT Sans');
    // Иначе используйте стандартный с установкой языка (может не работать)
    doc.setLanguage('ru');

    doc.setFontSize(16);
    doc.text('Заявление на получение паспорта', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Номер заявления: ${applicationNumber}`, 10, 30);
    let y = 40;

    const data = [
        ['Поле', 'Значение'],
        ['Причина', document.querySelector('input[name="reason"]:checked')?.parentElement?.textContent?.trim() || formData.reason],
        ['Личный код', userProfile.personal_code],
        ['ФИО', `${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}`],
        ['Дата рождения', new Date(userProfile.date_of_birth).toLocaleDateString('ru-RU')],
        ['Место рождения', userProfile.place_of_birth || '—'],
        ['Телефон', formData.phone],
        ['Email', formData.email],
        ['Отделение МВД', mvdList.find(m => m.id === selectedMvdId)?.name || '—'],
    ];
    if (formData.reasonDetails) {
        data.push(['Данные свидетельства', `${formData.reasonDetails.type}, №${formData.reasonDetails.number} от ${formData.reasonDetails.date}, ${formData.reasonDetails.issuedBy}`]);
    }
    if (!document.getElementById('newDataFields').classList.contains('hidden')) {
        const newSurname = document.getElementById('newSurname').value;
        const newName = document.getElementById('newName').value;
        const newPatr = document.getElementById('newPatronymic').value;
        const newBD = document.getElementById('newBirthDate').value;
        const newBP = document.getElementById('newBirthPlace').value;
        let newDataStr = '';
        if (newSurname || newName || newPatr) newDataStr += `ФИО: ${newSurname} ${newName} ${newPatr}\n`;
        if (newBD) newDataStr += `Дата рождения: ${new Date(newBD).toLocaleDateString('ru-RU')}\n`;
        if (newBP) newDataStr += `Место рождения: ${newBP}`;
        if (newDataStr) data.push(['Новые данные', newDataStr]);
    }

    autoTable(doc, {
        startY: y,
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
    const newData = {};
    if (!document.getElementById('newDataFields').classList.contains('hidden')) {
        newData.surname = document.getElementById('newSurname').value;
        newData.name = document.getElementById('newName').value;
        newData.patronymic = document.getElementById('newPatronymic').value;
        newData.birth_date = document.getElementById('newBirthDate').value;
        newData.birth_place = document.getElementById('newBirthPlace').value;
    }

const payload = {
    application_number: applicationNumber,
    user_id: (await supabase.auth.getSession()).data.session.user.id,
    personal_code: userPersonalCode,        // <-- добавлено
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
    new_personal_data: newData,
    phone: formData.phone,
    email: formData.email,
    photo_path: photoPath,
    mvd_id: selectedMvdId,
    status: 'submitted'
};

    const { error } = await supabase
        .schema('services')
        .from('passport')
        .insert(payload);

    if (error) {
        showError('Ошибка отправки заявления: ' + error.message);
        return false;
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
        formContainer.style.opacity = '0.5';
        formContainer.style.pointerEvents = 'none';
        return;
    }

    try {
        await loadMvd();
    } catch (e) {
        console.error('Ошибка загрузки отделений', e);
    }

    // Drag & drop для фото
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
            if (files.length) fileInput.files = files;
        });
    }

    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (await validateStep(currentStep)) {
                if (currentStep === 3) {
                    const reason = formData.reason;
                    const price = (reason === 'lost' || reason === 'damaged') ? 2000 : 300;
                    document.getElementById('priceDisplay').textContent = price;
                }
                goToStep(currentStep + 1);
            }
        });
    });

    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', () => goToStep(currentStep - 1));
    });

    document.querySelectorAll('input[name="reason"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const details = document.getElementById('reasonDetails');
            details.classList.toggle('hidden', e.target.value !== 'name_changed');
            isLostReason = (e.target.value === 'lost');
        });
    });

    document.getElementById('uploadPhotoBtn').addEventListener('click', async () => {
        const fileInput = document.getElementById('photoUpload');
        if (!fileInput.files.length) {
            showError('Выберите файл');
            return;
        }
        const success = await uploadPhoto(fileInput.files[0]);
        if (success) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('previewImg').src = e.target.result;
                document.getElementById('photoPreview').classList.remove('hidden');
            };
            reader.readAsDataURL(fileInput.files[0]);
            goToStep(currentStep + 1);
        }
    });

    document.getElementById('submitApplication').addEventListener('click', async () => {
        await generatePDF();
        const success = await submitApplication();
        if (success) {
            document.getElementById('applicationNumber').textContent = applicationNumber;
            goToStep(9);
        }
    });

    goToStep(1);
});