import { supabase } from '../../../supabase-config.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

let currentStep = 1;
const totalSteps = 9; // 1..9 (шаг 9 – финальный)
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

// Генерация номера заявления: П-XXXXXXXXX (9 случайных цифр)
function generateApplicationNumber() {
    const digits = Math.floor(100000000 + Math.random() * 900000000);
    return `П-${digits}`;
}

// Загрузка профиля пользователя
async function loadUserProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../../../login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return false;
    }
    const { data, error } = await supabase
        .from('users')
        .select('personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender')
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

// Загрузка списка отделений МВД
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

// Обновление индикатора шагов
function updateSteps() {
    document.querySelectorAll('.step-item').forEach((el, index) => {
        const step = index + 1;
        el.classList.toggle('active', step === currentStep);
        el.classList.toggle('completed', step < currentStep);
    });
}

// Переключение шага
function goToStep(step) {
    if (step < 1 || step > totalSteps) return;
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    document.querySelector(`.step-content[data-step="${step}"]`).classList.remove('hidden');
    currentStep = step;
    updateSteps();
}

// Валидация текущего шага перед переходом
async function validateStep(step) {
    switch (step) {
        case 2:
            const reason = document.querySelector('input[name="reason"]:checked');
            if (!reason) {
                showError('Выберите причину оформления');
                return false;
            }
            formData.reason = reason.value;
            if (reason.value === 'name_changed') {
                // Проверим заполнение полей свидетельства
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

// Загрузка фото
async function uploadPhoto(file) {
    if (!file) return;
    if (file.size > 1024 * 1024) {
        showError('Фото должно быть не более 1 МБ');
        return false;
    }
    if (file.type !== 'image/jpeg') {
        showError('Только JPG формат');
        return false;
    }
    // Генерируем номер заявления при первой загрузке
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

// Отображение данных профиля на шаге 4
function renderProfileData() {
    const container = document.getElementById('profileData');
    const reason = formData.reason;
    let html = `<table class="summary-table"><tr><th>Личный код</th><td>${userProfile.personal_code}</td></tr>`;
    html += `<tr><th>ФИО</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Дата рождения</th><td>${new Date(userProfile.date_of_birth).toLocaleDateString('ru-RU')}</td></tr>`;
    html += `<tr><th>Место рождения</th><td>${userProfile.place_of_birth || '—'}</td></tr>`;
    html += `<tr><th>Пол</th><td>${userProfile.gender}</td></tr>`;
    html += '</table>';

    // Если причина связана с изменением данных, покажем поля для ввода новых
    if (reason === 'name_changed' || reason === '14_20_45' || reason === 'appearance' || reason === 'error') {
        document.getElementById('newDataFields').classList.remove('hidden');
    } else {
        document.getElementById('newDataFields').classList.add('hidden');
    }
    container.innerHTML = html;
}

// Сбор данных для отображения на шаге 8
function prepareSummary() {
    let html = '<table class="summary-table">';
    html += `<tr><th>Номер заявления</th><td>${applicationNumber}</td></tr>`;
    html += `<tr><th>Причина</th><td>${document.querySelector('input[name="reason"]:checked')?.parentElement?.textContent?.trim() || formData.reason}</td></tr>`;
    if (formData.reasonDetails) {
        html += `<tr><th>Данные свидетельства</th><td>${formData.reasonDetails.type}, №${formData.reasonDetails.number} от ${formData.reasonDetails.date}, ${formData.reasonDetails.issuedBy}</td></tr>`;
    }
    html += `<tr><th>Личный код</th><td>${userProfile.personal_code}</td></tr>`;
    html += `<tr><th>ФИО</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    if (document.getElementById('newDataFields').classList.contains('hidden') === false) {
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

// Генерация PDF
async function generatePDF() {
    const doc = new jsPDF();
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
    if (document.getElementById('newDataFields').classList.contains('hidden') === false) {
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

// Отправка заявления в БД
async function submitApplication() {
    const reasonText = document.querySelector('input[name="reason"]:checked')?.parentElement?.textContent?.trim() || formData.reason;
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
        status: 'pending'
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

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    if (!await loadUserProfile()) return;

    // Загружаем отделения МВД для шага 7
    try {
        await loadMvd();
    } catch (e) {
        console.error('Ошибка загрузки отделений', e);
    }

    // Навигация
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (await validateStep(currentStep)) {
                // Особые действия при переходе
                if (currentStep === 3) {
                    // Обновляем цену в зависимости от причины
                    const reason = formData.reason;
                    const price = (reason === 'lost' || reason === 'damaged') ? 2000 : 300;
                    document.getElementById('priceDisplay').textContent = price;
                }
                if (currentStep === 4) {
                    renderProfileData();
                }
                if (currentStep === 8) {
                    prepareSummary();
                }
                goToStep(currentStep + 1);
            }
        });
    });

    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', () => goToStep(currentStep - 1));
    });

    // Показ дополнительных полей при выборе "Изменилось ФИО"
    document.querySelectorAll('input[name="reason"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const details = document.getElementById('reasonDetails');
            if (e.target.value === 'name_changed') {
                details.classList.remove('hidden');
            } else {
                details.classList.add('hidden');
            }
        });
    });

    // Загрузка фото
    document.getElementById('uploadPhotoBtn').addEventListener('click', async () => {
        const fileInput = document.getElementById('photoUpload');
        if (!fileInput.files.length) {
            showError('Выберите файл');
            return;
        }
        const success = await uploadPhoto(fileInput.files[0]);
        if (success) {
            // Показываем превью
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('previewImg').src = e.target.result;
                document.getElementById('photoPreview').classList.remove('hidden');
            };
            reader.readAsDataURL(fileInput.files[0]);
            // Переходим на следующий шаг
            goToStep(currentStep + 1);
        }
    });

    // Отправка заявления
    document.getElementById('submitApplication').addEventListener('click', async () => {
        // Сначала сгенерируем PDF
        await generatePDF();
        const success = await submitApplication();
        if (success) {
            document.getElementById('applicationNumber').textContent = applicationNumber;
            goToStep(9);
        }
    });
});