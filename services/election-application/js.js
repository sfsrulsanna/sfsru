import { supabase } from '../../../js/supabase-config.js';

// ============================================================
// Глобальные переменные
// ============================================================
let currentStep = 1;
let userProfile = null;
let userPersonalCode = null;
let applicationNumber = null;
let selectedElectionId = null;
let selectedApplicationType = null; // 'candidate_registration', 'observer_registration', 'voter_change'
let selectedVoterChangeType = null; // 'change_polling_station', 'electronic_voting', 'refuse_voting'
let selectedPollingStationId = null;
let photoPath = null;
let electionsList = [];
let pollingStationsList = [];
let hasActiveApp = false;

// ============================================================
// Вспомогательные функции
// ============================================================
function generateApplicationNumber() {
    const digits = Math.floor(100000000 + Math.random() * 900000000);
    return `CEC-${digits}`;
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
// Проверка активного обращения
// ============================================================
async function checkActiveApplication() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { data, error } = await supabase
        .schema('votes')
        .from('applications')
        .select('id')
        .eq('user_id', session.user.id)
        .in('status', ['submitted', 'under_review'])
        .maybeSingle();
    if (error) {
        console.error('Ошибка проверки обращений:', error);
        return false;
    }
    return !!data;
}

// ============================================================
// Загрузка активных голосований
// ============================================================
async function loadElections() {
    const { data, error } = await supabase
        .schema('votes')
        .from('elections')
        .select('id, title, type, scope, territory, start_date, end_date, status')
        .eq('status', 'active')
        .order('start_date', { ascending: true });
    if (error) {
        console.error('Ошибка загрузки голосований:', error);
        return;
    }
    electionsList = data || [];
    renderElections();
}

function renderElections() {
    const container = document.getElementById('electionsList');
    if (!electionsList.length) {
        container.innerHTML = '<p class="no-data">Нет активных голосований</p>';
        return;
    }
    const typeMap = { election: 'Выборы', referendum: 'Референдум', poll: 'Опрос' };
    const scopeMap = { federal: 'Федеральные', regional: 'Региональные', local: 'Местные' };
    let html = '<div class="radio-group">';
    electionsList.forEach(el => {
        const label = `${typeMap[el.type] || el.type} — ${el.title} (${scopeMap[el.scope] || el.scope}, ${el.territory})`;
        html += `<label><input type="radio" name="election" value="${el.id}"> ${label}</label>`;
    });
    html += '</div>';
    container.innerHTML = html;

    // Подсветка выбора
    document.querySelectorAll('#electionsList input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('#electionsList label').forEach(l => l.classList.remove('selected'));
            e.target.closest('label').classList.add('selected');
            selectedElectionId = e.target.value;
        });
    });
}

// ============================================================
// Загрузка участков (для избирателя)
// ============================================================
async function loadPollingStations() {
    // Здесь можно загрузить из справочника участков, но пока заглушка
    // Для примера – создадим тестовые данные
    pollingStationsList = [
        { id: '1', name: 'Участок №1, ул. Ленина, д. 10' },
        { id: '2', name: 'Участок №2, ул. Советская, д. 5' },
        { id: '3', name: 'Участок №3, пр. Мира, д. 20' }
    ];
    renderPollingStations();
}

function renderPollingStations() {
    const container = document.getElementById('pollingStationsList');
    if (!pollingStationsList.length) {
        container.innerHTML = '<p class="no-data">Нет доступных участков</p>';
        return;
    }
    let html = '<div class="radio-group">';
    pollingStationsList.forEach(ps => {
        html += `<label><input type="radio" name="pollingStation" value="${ps.id}"> ${ps.name}</label>`;
    });
    html += '</div>';
    container.innerHTML = html;

    document.querySelectorAll('#pollingStationsList input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('#pollingStationsList label').forEach(l => l.classList.remove('selected'));
            e.target.closest('label').classList.add('selected');
            selectedPollingStationId = e.target.value;
        });
    });
}

// ============================================================
// Управление шагами
// ============================================================
function getNextStep(step) {
    const type = document.querySelector('input[name="applicationType"]:checked');

    switch (step) {
        case 1: return 2;
        case 2: {
            if (!type) return 2;
            return 3;
        }
        case 3: {
            if (!selectedElectionId) return 3;
            return 4;
        }
        case 4: {
            if (!type) return 4;
            if (type.value === 'candidate_registration') return 5;
            if (type.value === 'observer_registration') return 6;
            if (type.value === 'voter_change') return 7;
            return 4;
        }
        case 5: {
            // Кандидат – проверка партийной номинации
            const nominated = document.getElementById('partyNominated');
            if (nominated && nominated.value === 'no') {
                // Если партия не выдвинула – остаёмся на шаге 5 (с предупреждением)
                // Но мы разрешаем переход, так как в интерфейсе уже показано предупреждение
                // и пользователь должен собрать подписи
                return 9; // переход на загрузку фото
            }
            return 9;
        }
        case 6: {
            // Наблюдатель – после партии сразу финал
            return 10;
        }
        case 7: {
            // Избиратель – выбор цели внутри
            const voterType = document.querySelector('input[name="voterChangeType"]:checked');
            if (!voterType) return 7;
            if (voterType.value === 'change_polling_station') return 8;
            if (voterType.value === 'electronic_voting') return 10;
            if (voterType.value === 'refuse_voting') return 10;
            return 7;
        }
        case 8: {
            if (!selectedPollingStationId) return 8;
            return 10;
        }
        case 9: {
            if (!photoPath) return 9;
            return 10;
        }
        case 10: return 11;
        default: return step + 1;
    }
}

function getPrevStep(step) {
    const type = document.querySelector('input[name="applicationType"]:checked');

    switch (step) {
        case 2: return 1;
        case 3: return 2;
        case 4: return 3;
        case 5: return 4;
        case 6: return 4;
        case 7: return 4;
        case 8: return 7;
        case 9: {
            if (type && type.value === 'candidate_registration') return 5;
            return 4;
        }
        case 10: {
            if (type && type.value === 'candidate_registration') return 9;
            if (type && type.value === 'observer_registration') return 6;
            if (type && type.value === 'voter_change') {
                const voterType = document.querySelector('input[name="voterChangeType"]:checked');
                if (voterType && voterType.value === 'change_polling_station') return 8;
                return 7;
            }
            return 4;
        }
        case 11: return 10;
        default: return step - 1;
    }
}

function goToStep(step) {
    if (step < 1 || step > 11) return;

    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    const targetStep = document.querySelector(`.step-content[data-step="${step}"]`);
    if (targetStep) targetStep.classList.remove('hidden');
    currentStep = step;

    if (step === 4) renderProfileData();
    if (step === 5) updatePartyFields();
    if (step === 6) updateObserverPartyFields();
    if (step === 9) {
        const nextBtn = document.getElementById('step9NextBtn');
        nextBtn.disabled = !photoPath;
        if (photoPath) {
            document.getElementById('fileList').innerHTML = '<i class="fas fa-check-circle" style="color:#28a745;"></i> Фото загружено';
        }
    }
    if (step === 10) prepareSummary();
}

// ============================================================
// Шаг 4: Профиль
// ============================================================
function renderProfileData() {
    const container = document.getElementById('profileData');
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
// Шаг 5: Партии для кандидата
// ============================================================
function updatePartyFields() {
    const membership = document.getElementById('partyMembership').value;
    const partyFields = document.getElementById('partyFields');
    const nominationQuestion = document.getElementById('partyNominationQuestion');
    const signatureReq = document.getElementById('signatureRequirement');

    if (membership === 'yes') {
        partyFields.classList.remove('hidden');
        nominationQuestion.classList.remove('hidden');
        // Проверяем номинацию
        const nominated = document.getElementById('partyNominated').value;
        if (nominated === 'no') {
            signatureReq.classList.remove('hidden');
        } else {
            signatureReq.classList.add('hidden');
        }
    } else {
        partyFields.classList.add('hidden');
        nominationQuestion.classList.add('hidden');
        signatureReq.classList.add('hidden');
    }
}

document.getElementById('partyMembership').addEventListener('change', updatePartyFields);
document.getElementById('partyNominated').addEventListener('change', updatePartyFields);

// ============================================================
// Шаг 6: Партии для наблюдателя
// ============================================================
function updateObserverPartyFields() {
    const membership = document.getElementById('observerPartyMembership').value;
    const fields = document.getElementById('observerPartyFields');
    if (membership === 'yes') {
        fields.classList.remove('hidden');
    } else {
        fields.classList.add('hidden');
    }
}
document.getElementById('observerPartyMembership').addEventListener('change', updateObserverPartyFields);

// ============================================================
// Шаг 9: Фото
// ============================================================
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
    const nextBtn = document.getElementById('step9NextBtn');
    nextBtn.disabled = true;
    const success = await uploadPhoto(fileInput.files[0]);
    if (success) {
        nextBtn.disabled = false;
    }
});

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
    const filePath = `election_applications/${applicationNumber}/photo.jpg`;

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

// ============================================================
// Шаг 10: Подтверждение
// ============================================================
function prepareSummary() {
    const type = document.querySelector('input[name="applicationType"]:checked');
    const election = electionsList.find(e => e.id === selectedElectionId);
    const typeLabel = type ? (type.value === 'candidate_registration' ? 'Регистрация кандидата' :
                              type.value === 'observer_registration' ? 'Регистрация наблюдателя' :
                              'Изменение способа голосования') : '—';

    let html = '<table class="summary-table">';
    html += `<tr><th>Цель обращения</th><td>${typeLabel}</td></tr>`;
    html += `<tr><th>Голосование</th><td>${election ? election.title : '—'}</td></tr>`;
    html += `<tr><th>Заявитель</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Личный код</th><td>${userProfile.personal_code}</td></tr>`;

    if (type && type.value === 'candidate_registration') {
        const membership = document.getElementById('partyMembership').value;
        html += `<tr><th>Принадлежность к партии</th><td>${membership === 'yes' ? 'Да' : 'Нет'}</td></tr>`;
        if (membership === 'yes') {
            html += `<tr><th>Название партии</th><td>${document.getElementById('partyName').value || '—'}</td></tr>`;
            const nominated = document.getElementById('partyNominated').value;
            html += `<tr><th>Выдвинула партия</th><td>${nominated === 'yes' ? 'Да' : 'Нет'}</td></tr>`;
            if (nominated === 'no') {
                html += `<tr><th>Требуется сбор подписей</th><td>Необходимо собрать минимум 10 подписей</td></tr>`;
            }
        }
        html += `<tr><th>Фото</th><td>${photoPath ? 'Загружено' : 'Не загружено'}</td></tr>`;
    }

    if (type && type.value === 'observer_registration') {
        const membership = document.getElementById('observerPartyMembership').value;
        html += `<tr><th>Принадлежность к партии</th><td>${membership === 'yes' ? 'Да' : 'Нет'}</td></tr>`;
        if (membership === 'yes') {
            html += `<tr><th>Название партии</th><td>${document.getElementById('observerPartyName').value || '—'}</td></tr>`;
        }
    }

    if (type && type.value === 'voter_change') {
        const voterType = document.querySelector('input[name="voterChangeType"]:checked');
        const voterLabel = voterType ? (voterType.value === 'change_polling_station' ? 'Изменить участок' :
                                        voterType.value === 'electronic_voting' ? 'Электронное голосование' :
                                        'Отказ от голосования') : '—';
        html += `<tr><th>Действие</th><td>${voterLabel}</td></tr>`;
        if (voterType && voterType.value === 'change_polling_station') {
            const station = pollingStationsList.find(ps => ps.id === selectedPollingStationId);
            html += `<tr><th>Новый участок</th><td>${station ? station.name : '—'}</td></tr>`;
        }
        if (voterType && voterType.value === 'electronic_voting') {
            html += `<tr><th>Условие</th><td>Учётная запись должна быть подтверждена</td></tr>`;
        }
    }

    html += '</table>';
    document.getElementById('summary').innerHTML = html;
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

    const type = document.querySelector('input[name="applicationType"]:checked');
    if (!type) {
        showError('Выберите цель обращения');
        return false;
    }

    if (!selectedElectionId) {
        showError('Выберите голосование');
        return false;
    }

    if (!applicationNumber) {
        applicationNumber = generateApplicationNumber();
    }

    // Формируем данные в JSON
    let dataPayload = {};
    if (type.value === 'candidate_registration') {
        dataPayload.party_membership = document.getElementById('partyMembership').value === 'yes';
        if (dataPayload.party_membership) {
            dataPayload.party_name = document.getElementById('partyName').value.trim();
            dataPayload.party_nominated = document.getElementById('partyNominated').value === 'yes';
        }
        dataPayload.photo_path = photoPath;
    }

    if (type.value === 'observer_registration') {
        dataPayload.party_membership = document.getElementById('observerPartyMembership').value === 'yes';
        if (dataPayload.party_membership) {
            dataPayload.party_name = document.getElementById('observerPartyName').value.trim();
        }
    }

    if (type.value === 'voter_change') {
        const voterType = document.querySelector('input[name="voterChangeType"]:checked');
        if (!voterType) {
            showError('Выберите действие');
            return false;
        }
        dataPayload.voter_change_type = voterType.value;
        if (voterType.value === 'change_polling_station') {
            if (!selectedPollingStationId) {
                showError('Выберите участок');
                return false;
            }
            dataPayload.new_polling_station_id = selectedPollingStationId;
        }
    }

    const payload = {
        user_id: session.user.id,
        election_id: selectedElectionId,
        type: type.value,
        status: 'submitted',
        data: dataPayload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const { data: inserted, error } = await supabase
        .schema('votes')
        .from('applications')
        .insert(payload)
        .select('id')
        .single();

    if (error) {
        showError('Ошибка отправки обращения: ' + error.message);
        return false;
    }

    // Если есть фото, сохраняем в application_files
    if (photoPath) {
        const filePayload = {
            application_id: inserted.id,
            file_path: photoPath,
            file_name: 'photo.jpg'
        };
        const { error: fileError } = await supabase
            .schema('votes')
            .from('application_files')
            .insert(filePayload);
        if (fileError) {
            console.error('Ошибка сохранения файла:', fileError);
            showError('Обращение создано, но не удалось сохранить файл.');
        }
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

    await loadElections();
    await loadPollingStations();

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

    // Навигация
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (currentStep === 2) {
                const type = document.querySelector('input[name="applicationType"]:checked');
                if (!type) { showError('Выберите цель обращения'); return; }
                selectedApplicationType = type.value;
            }
            if (currentStep === 7) {
                const voterType = document.querySelector('input[name="voterChangeType"]:checked');
                if (!voterType) { showError('Выберите действие'); return; }
                selectedVoterChangeType = voterType.value;
            }
            if (currentStep === 8) {
                if (!selectedPollingStationId) { showError('Выберите участок'); return; }
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
        btn.textContent = 'Отправить обращение';

        if (success) {
            document.getElementById('applicationNumber').textContent = applicationNumber;
            document.getElementById('gotoServiceLink').href = `../../../personal-profile/services/service-view.html?id=${applicationNumber}`;
            goToStep(11);
        }
    });

    goToStep(1);
});