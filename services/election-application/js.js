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
// let photoPath = null; // УДАЛЕНО
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
            // Раньше здесь был переход на шаг 9 (фото), теперь сразу на 10 (подтверждение)
            return 10;
        }
        case 6: {
            // Наблюдатель – после партии сразу финал
            return 10;
        }
        case 7: {
            const voterType = document.querySelector('input[name="voterChangeType"]:checked');
            if (!voterType) return 7;
            if (voterType.value === 'change_polling_station') return 8;
            else return 10; // electronic_voting или refuse_voting → сразу на подтверждение
        }
        case 8: {
            if (!selectedPollingStationId) return 8;
            return 10;
        }
        // Шаг 9 удален
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
        // Шаг 9 удален
        case 10: {
            if (type && type.value === 'candidate_registration') return 5;
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
    
    // Удалена логика для шага 9 (фото)
    
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
    html += `</table>`;
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
// Шаг 9: Фото (УДАЛЕНО ВЕСЬ БЛОК)
// ============================================================

// ============================================================
// Шаг 10: Подтверждение
// ============================================================
function prepareSummary() {
    const type = document.querySelector('input[name="applicationType"]:checked');
    const election = electionsList.find(e => e.id === selectedElectionId);

    // Определяем финальный тип для отображения
    let displayType = '';
    let displayDetails = [];

    if (type && type.value === 'candidate_registration') {
        displayType = 'Регистрация кандидата';
        const membership = document.getElementById('partyMembership').value;
        if (membership === 'yes') {
            displayDetails.push(`Партия: ${document.getElementById('partyName').value || '—'}`);
            const nominated = document.getElementById('partyNominated').value;
            if (nominated === 'no') {
                displayDetails.push('Требуется сбор 10 подписей');
            } else {
                displayDetails.push('Выдвинут партией');
            }
        } else {
            displayDetails.push('Самовыдвижение');
        }
        // Удалена проверка photoPath
    } else if (type && type.value === 'observer_registration') {
        displayType = 'Регистрация наблюдателя';
        const membership = document.getElementById('observerPartyMembership').value;
        if (membership === 'yes') {
            displayDetails.push(`Партия: ${document.getElementById('observerPartyName').value || '—'}`);
        } else {
            displayDetails.push('Независимый наблюдатель');
        }
    } else if (type && type.value === 'voter_change') {
        const voterType = document.querySelector('input[name="voterChangeType"]:checked');
        if (voterType) {
            switch (voterType.value) {
                case 'change_polling_station':
                    displayType = 'Смена участка голосования';
                    const station = pollingStationsList.find(ps => ps.id === selectedPollingStationId);
                    displayDetails.push(`Новый участок: ${station ? station.name : '—'}`);
                    break;
                case 'electronic_voting':
                    displayType = 'Электронное голосование';
                    displayDetails.push('Учётная запись должна быть подтверждена');
                    break;
                case 'refuse_voting':
                    displayType = 'Отказ от голосования';
                    break;
                default:
                    displayType = 'Изменение способа голосования';
            }
        }
    }

    let html = '<table class="summary-table">';
    html += `<tr><th>Цель обращения</th><td>${displayType || '—'}</td></tr>`;
    html += `<tr><th>Голосование</th><td>${election ? election.title : '—'}</td></tr>`;
    html += `<tr><th>Заявитель</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Личный код</th><td>${userProfile.personal_code}</td></tr>`;
    
    if (displayDetails.length) {
        html += `<tr><th>Дополнительно</th><td><ul>${displayDetails.map(d => `<li>${d}</li>`).join('')}</ul></td></tr>`;
    }
    html += '</table>';
    document.getElementById('summary').innerHTML = html;
}

// ============================================================
// Отправка заявления (ИСПРАВЛЕННАЯ ВЕРСИЯ)
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

    // Определяем финальный тип и данные для БД
    let finalType = type.value;
    let dataPayload = {};

    if (type.value === 'candidate_registration') {
        dataPayload.party_membership = document.getElementById('partyMembership').value === 'yes';
        if (dataPayload.party_membership) {
            dataPayload.party_name = document.getElementById('partyName').value.trim();
            dataPayload.party_nominated = document.getElementById('partyNominated').value === 'yes';
        }
        // Удалено: dataPayload.photo_path = photoPath;
        finalType = 'candidate_registration';
    }

    if (type.value === 'observer_registration') {
        dataPayload.party_membership = document.getElementById('observerPartyMembership').value === 'yes';
        if (dataPayload.party_membership) {
            dataPayload.party_name = document.getElementById('observerPartyName').value.trim();
        }
        finalType = 'observer_registration';
    }

    if (type.value === 'voter_change') {
        const voterType = document.querySelector('input[name="voterChangeType"]:checked');
        if (!voterType) {
            showError('Выберите действие');
            return false;
        }
        const changeType = voterType.value;
        if (changeType === 'electronic_voting') {
            finalType = 'remote_voting_request';
            dataPayload.voting_method = 'electronic';
        } else if (changeType === 'change_polling_station') {
            finalType = 'change_polling_station';
            if (!selectedPollingStationId) {
                showError('Выберите участок');
                return false;
            }
            dataPayload.new_polling_station_id = selectedPollingStationId;
        } else if (changeType === 'refuse_voting') {
            finalType = 'other';
            dataPayload.reason = 'Отказ от голосования';
        } else {
            // fallback
            finalType = 'other';
            dataPayload.voter_change_type = changeType;
        }
    }

    // Собираем финальный payload
    const payload = {
        user_id: session.user.id,
        election_id: selectedElectionId,
        type: finalType,
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

    // Удален блок сохранения файла в application_files

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