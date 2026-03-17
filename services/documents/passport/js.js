import { supabase } from '../../../js/supabase-config.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ========== Глобальные переменные ==========
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
let isLostReason = false;

// ========== Вспомогательные функции ==========
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

// ========== Загрузка данных пользователя ==========
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

// ========== Проверка активного заявления ==========
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

// ========== Загрузка списка отделений МВД ==========
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
        // Создаём скрытую радио-кнопку
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'mvd';
        radio.value = mvd.id;
        radio.id = `mvd-${mvd.id}`;
        radio.classList.add('mvd-radio');
        
        // Создаём карточку
        const card = document.createElement('div');
        card.className = 'mvd-card';
        card.setAttribute('data-id', mvd.id);
        card.innerHTML = `
            <h4>${mvd.name}</h4>
            <p>${mvd.address}</p>
            <small>${mvd.working_hours || ''}</small>
        `;
        
        // При клике на карточку выбираем радио и обновляем выделение
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

// ========== Управление шагами ==========
function updateSteps() {
    document.querySelectorAll('.step-item').forEach((el, index) => {
        const step = index + 1;
        el.classList.toggle('active', step === currentStep);
        el.classList.toggle('completed', step < currentStep);
    });
}

function goToStep(step) {
    if (step < 1 || step > totalSteps) return;
    
    // Скрываем все шаги
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    // Показываем нужный
    const targetStep = document.querySelector(`.step-content[data-step="${step}"]`);
    if (targetStep) targetStep.classList.remove('hidden');
    currentStep = step;
    updateSteps();

    // Специфическая логика при переходе на шаг 3
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
    }

    // При переходе на шаг 4 отображаем данные профиля
    if (step === 4) {
        renderProfileData();
    }

    // При переходе на шаг 5 заполняем контакты
    if (step === 5) {
        document.getElementById('phone').value = formData.phone;
        document.getElementById('email').value = formData.email;
    }

    // При переходе на шаг 8 готовим сводку
    if (step === 8) {
        prepareSummary();
    }
}

// ========== Валидация шагов ==========
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
        }
        case 3: {
            // Если причина утеря, переход запрещён (кнопка уже disabled)
            if (isLostReason) {
                showError('Для утери паспорта онлайн-подача недоступна');
                return false;
            }
            break;
        }
        case 5: {
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
        case 6: {
            if (!photoPath) {
                showError('Сначала загрузите фото');
                return false;
            }
            break;
        }
        case 7: {
            if (!selectedMvdId) {
                showError('Выберите отделение МВД');
                return false;
            }
            break;
        }
    }
    return true;
}

// ========== Загрузка фото с индикатором ==========
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

    // Показываем прогресс
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

    // Имитация прогресса (Supabase Storage не даёт onUploadProgress, поэтому показываем спиннер)
    // Можно использовать XMLHttpRequest с подписанным URL, но для простоты оставим так
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
    return true;
}

// ========== Отображение данных профиля ==========
function renderProfileData() {
    const container = document.getElementById('profileData');
    const reason = formData.reason;
    let html = `<table class="summary-table">`;
    html += `<tr><th>Личный код</th><td>${userProfile.personal_code || '—'}</td></tr>`;
    html += `<tr><th>ФИО</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Дата рождения</th><td>${new Date(userProfile.date_of_birth).toLocaleDateString('ru-RU')}</td></tr>`;
    html += `<tr><th>Место рождения</th><td>${userProfile.place_of_birth || '—'}</td></tr>`;
    html += `<tr><th>Пол</th><td>${userProfile.gender === 'male' ? 'Мужской' : 'Женский'}</td></tr>`;
    html += '</table>';

    if (reason === 'name_changed' || reason === 'appearance' || reason === 'error') {
        document.getElementById('newDataFields').classList.remove('hidden');
    } else {
        document.getElementById('newDataFields').classList.add('hidden');
    }
    container.innerHTML = html;
}

// ========== Подготовка сводки ==========
function prepareSummary() {
    let html = '<table class="summary-table">';
    html += `<tr><th>Номер заявления</th><td>${applicationNumber}</td></tr>`;
    const reasonText = document.querySelector('input[name="reason"]:checked')?.parentElement?.textContent?.trim() || formData.reason;
    html += `<tr><th>Причина</th><td>${reasonText}</td></tr>`;
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
    const mvdName = mvdList.find(m => m.id === selectedMvdId)?.name || '—';
    html += `<tr><th>Отделение МВД</th><td>${mvdName}</td></tr>`;
    html += `<tr><th>Фото</th><td>загружено</td></tr>`;
    html += '</table>';
    document.getElementById('summary').innerHTML = html;
}

// ========== Генерация PDF ==========
async function generatePDF() {
    const doc = new jsPDF();
    
    // Для корректного отображения кириллицы используем встроенный шрифт 'times' (поддерживает кириллицу)
    doc.setFont('times', 'normal');
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
        startY: 40,
        head: [data[0]],
        body: data.slice(1),
        theme: 'grid',
        styles: { fontSize: 10, font: 'times' },
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

// ========== Отправка заявления ==========
async function submitApplication() {
    const newData = {};
    if (!document.getElementById('newDataFields').classList.contains('hidden')) {
        newData.surname = document.getElementById('newSurname').value;
        newData.name = document.getElementById('newName').value;
        newData.patronymic = document.getElementById('newPatronymic').value;
        newData.birth_date = document.getElementById('newBirthDate').value;
        newData.birth_place = document.getElementById('newBirthPlace').value;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../../../login.html';
        return false;
    }

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

// ========== Инициализация ==========
document.addEventListener('DOMContentLoaded', async () => {
    // Загружаем профиль
    if (!await loadUserProfile()) return;

    // Проверяем активное заявление
    hasActiveApp = await checkActiveApplication();
    const activeWarning = document.getElementById('activeApplicationWarning');
    const formContainer = document.getElementById('applicationForm');

    if (hasActiveApp) {
        activeWarning.classList.remove('hidden');
        formContainer.classList.add('hidden');
        return; // Выходим, не инициализируем остальное
    } else {
        activeWarning.classList.add('hidden');
        formContainer.classList.remove('hidden');
    }

    // Загружаем отделения МВД
    try {
        await loadMvd();
    } catch (e) {
        console.error('Ошибка загрузки отделений', e);
        showError('Не удалось загрузить список отделений МВД');
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
            if (files.length) {
                fileInput.files = files;
                // Активируем кнопку загрузки
                document.getElementById('uploadPhotoBtn').disabled = false;
            }
        });
    }

    // При выборе файла через input активируем кнопку
    fileInput.addEventListener('change', () => {
        document.getElementById('uploadPhotoBtn').disabled = !fileInput.files.length;
    });

    // Обработчики навигации
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (await validateStep(currentStep)) {
                // Если шаг 3 и причина утеря – не переходим (кнопка disabled)
                if (currentStep === 3 && isLostReason) return;
                
                // Обновляем цену на шаге 3 перед переходом
                if (currentStep === 3) {
                    const price = (formData.reason === 'lost' || formData.reason === 'damaged') ? 2000 : 300;
                    document.getElementById('priceDisplay').textContent = price;
                }
                goToStep(currentStep + 1);
            }
        });
    });

    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', () => goToStep(currentStep - 1));
    });

    // При изменении радио-кнопок причины
    document.querySelectorAll('input[name="reason"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const details = document.getElementById('reasonDetails');
            details.classList.toggle('hidden', e.target.value !== 'name_changed');
            isLostReason = (e.target.value === 'lost');
        });
    });

    // Загрузка фото
    document.getElementById('uploadPhotoBtn').addEventListener('click', async () => {
        const fileInput = document.getElementById('photoUpload');
        if (!fileInput.files.length) {
            showError('Выберите файл');
            return;
        }
        // Деактивируем кнопку на время загрузки
        const btn = document.getElementById('uploadPhotoBtn');
        btn.disabled = true;
        const success = await uploadPhoto(fileInput.files[0]);
        btn.disabled = false;
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
        const btn = document.getElementById('submitApplication');
        btn.disabled = true;
        btn.textContent = 'Отправка...';
        
        await generatePDF();
        const success = await submitApplication();
        
        btn.disabled = false;
        btn.textContent = 'Отправить заявление';
        
        if (success) {
            document.getElementById('applicationNumber').textContent = applicationNumber;
            goToStep(9);
        }
    });

    // Стартуем с шага 1
    goToStep(1);
});