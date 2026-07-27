import { supabase } from '../../../js/supabase-config.js';

// ============================================================
// Глобальные переменные
// ============================================================
let currentStep = 1;
let userProfile = null;
let userPersonalCode = null;
let applicationNumber = null;
let selectedPurpose = null; // 'candidate', 'observer', 'voter'
let selectedElectionId = null; // новое
let selectedVoterGoal = null; // 'change_polling_station', 'electronic_voting', 'refuse_voting'
let selectedPollingStationId = null;
let pollingStations = [];
let elections = [];
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
        .schema('votes')
        .from('applications')
        .select('id')
        .eq('user_id', session.user.id)
        .in('status', ['submitted', 'under_review'])
        .maybeSingle();
    if (error) {
        console.error('Ошибка проверки заявлений:', error);
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
        .select('id, title, type, scope, territory, start_date, end_date')
        .eq('status', 'active')
        .order('start_date', { ascending: true });
    if (error) {
        console.error('Ошибка загрузки голосований:', error);
        // Заглушка для демонстрации
        elections = [
            { id: 'e1', title: 'Выборы президента СФСРЮ 2026', type: 'election', scope: 'federal', territory: 'Вся территория' },
            { id: 'e2', title: 'Референдум по конституции', type: 'referendum', scope: 'federal', territory: 'Вся территория' }
        ];
        renderElections();
        return;
    }
    elections = data || [];
    renderElections();
}

function renderElections() {
    const container = document.getElementById('electionsList');
    container.innerHTML = '';
    if (elections.length === 0) {
        container.innerHTML = '<p class="no-data">Нет активных голосований</p>';
        return;
    }
    const typeMap = { election: 'Выборы', referendum: 'Референдум', poll: 'Опрос' };
    const scopeMap = { federal: 'Федеральные', regional: 'Региональные', local: 'Местные' };
    elections.forEach(el => {
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'election';
        radio.value = el.id;
        radio.id = `e-${el.id}`;
        radio.style.display = 'none';

        const card = document.createElement('div');
        card.className = 'mvd-card';
        card.setAttribute('data-id', el.id);
        card.innerHTML = `
            <h4><i class="fas fa-vote-yea" style="margin-right:0.5rem; color:#7b091a;"></i> ${el.title}</h4>
            <p>${typeMap[el.type] || el.type} • ${scopeMap[el.scope] || el.scope} • ${el.territory}</p>
            <small>${new Date(el.start_date).toLocaleDateString('ru-RU')} – ${new Date(el.end_date).toLocaleDateString('ru-RU')}</small>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.mvd-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            radio.checked = true;
            selectedElectionId = el.id;
            document.getElementById('step2_5NextBtn').disabled = false;
        });

        container.appendChild(radio);
        container.appendChild(card);
    });
}

// ============================================================
// Загрузка участков для голосования
// ============================================================
async function loadPollingStations() {
    const { data, error } = await supabase
        .schema('addresses')
        .from('polling_stations')
        .select('*')
        .order('name');
    if (error) {
        console.error('Ошибка загрузки участков:', error);
        // Заглушка для демонстрации
        pollingStations = [
            { id: '1', name: 'Участок №1', address: 'г. Поповск, ул. Ленина, д. 1' },
            { id: '2', name: 'Участок №2', address: 'г. Поповск, ул. Советская, д. 10' },
            { id: '3', name: 'Участок №3', address: 'г. Поповск, ул. Мира, д. 5' }
        ];
        renderPollingStations();
        return;
    }
    pollingStations = data || [];
    renderPollingStations();
}

function renderPollingStations() {
    const container = document.getElementById('pollingStationsList');
    container.innerHTML = '';
    pollingStations.forEach(ps => {
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'pollingStation';
        radio.value = ps.id;
        radio.id = `ps-${ps.id}`;
        radio.style.display = 'none';

        const card = document.createElement('div');
        card.className = 'mvd-card';
        card.setAttribute('data-id', ps.id);
        card.innerHTML = `
            <h4><i class="fas fa-map-pin" style="margin-right:0.5rem; color:#7b091a;"></i>${ps.name}</h4>
            <p>${ps.address}</p>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.mvd-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
            radio.checked = true;
            selectedPollingStationId = ps.id;
            document.getElementById('step5VoterNextBtn').disabled = false;
        });

        container.appendChild(radio);
        container.appendChild(card);
    });
}

// ============================================================
// Управление шагами (динамическая нумерация)
// ============================================================
function getNextStep(step) {
    const purpose = document.querySelector('input[name="purpose"]:checked');
    const voterGoal = document.querySelector('input[name="voterGoal"]:checked');

    switch (step) {
        case 1: return 2;
        case 2: {
            if (!purpose) return 2;
            selectedPurpose = purpose.value;
            return '2.5'; // новый шаг выбора голосования
        }
        case '2.5': {
            if (!selectedElectionId) return '2.5';
            return 3;
        }
        case 3: {
            if (selectedPurpose === 'candidate') return 4;
            if (selectedPurpose === 'observer') return '4-observer';
            if (selectedPurpose === 'voter') return '4-voter';
            return 6;
        }
        case 4: {
            const hasParty = document.querySelector('input[name="hasParty"]:checked');
            if (!hasParty) return 4;
            return 5;
        }
        case 5: {
            return 6;
        }
        case '4-observer': return 6;
        case '4-voter': {
            if (!voterGoal) return '4-voter';
            selectedVoterGoal = voterGoal.value;
            if (selectedVoterGoal === 'change_polling_station') return '5-voter';
            return 6;
        }
        case '5-voter': {
            if (!selectedPollingStationId) return '5-voter';
            return 6;
        }
        case 6: return 7;
        default: return step + 1;
    }
}

function getPrevStep(step) {
    switch (step) {
        case 2: return 1;
        case '2.5': return 2;
        case 3: return '2.5';
        case 4: return 3;
        case 5: return 4;
        case 6: {
            if (selectedPurpose === 'candidate') return 5;
            if (selectedPurpose === 'observer') return '4-observer';
            if (selectedPurpose === 'voter') {
                if (selectedVoterGoal === 'change_polling_station') return '5-voter';
                return '4-voter';
            }
            return 3;
        }
        case 7: return 6;
        default: return step - 1;
    }
}

function goToStep(step) {
    // Преобразуем строковые шаги в числовые для DOM
    let numericStep = step;
    if (step === '4-observer') numericStep = 4;
    else if (step === '4-voter') numericStep = 4;
    else if (step === '5-voter') numericStep = 5;
    else if (step === '2.5') numericStep = 2.5;

    // Скрываем все шаги
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));

    // Показываем нужный шаг
    let targetSelector;
    if (step === '4-observer') targetSelector = '.step-content[data-step="4-observer"]';
    else if (step === '4-voter') targetSelector = '.step-content[data-step="4-voter"]';
    else if (step === '5-voter') targetSelector = '.step-content[data-step="5-voter"]';
    else if (step === '2.5') targetSelector = '.step-content[data-step="2.5"]';
    else targetSelector = `.step-content[data-step="${numericStep}"]`;

    const targetStep = document.querySelector(targetSelector);
    if (targetStep) targetStep.classList.remove('hidden');
    currentStep = step;

    // Обработка шагов с динамическим содержимым
    if (step === 3) renderProfileData();
    if (step === '2.5' && elections.length === 0) loadElections();
    if (step === 4 && selectedPurpose === 'candidate') {
        document.querySelectorAll('input[name="hasParty"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const partyField = document.getElementById('partyField');
                if (e.target.value === 'yes') {
                    partyField.classList.remove('hidden');
                } else {
                    partyField.classList.add('hidden');
                }
            });
        });
    }
    if (step === 5 && selectedPurpose === 'candidate') {
        document.querySelectorAll('input[name="nominated"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const warning = document.getElementById('noNominationWarning');
                if (e.target.value === 'no') {
                    warning.classList.remove('hidden');
                } else {
                    warning.classList.add('hidden');
                }
            });
        });
    }
    if (step === '4-voter') {
        // Обработка выбора цели
        document.querySelectorAll('input[name="voterGoal"]').forEach(radio => {
            radio.addEventListener('change', () => {
                // Ничего не делаем, переход по кнопке Далее
            });
        });
    }
    if (step === '5-voter') {
        if (pollingStations.length === 0) loadPollingStations();
    }
    if (step === 6) prepareSummary();
}

// ============================================================
// Шаг 3: Данные профиля
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
// Шаг 6: Подтверждение
// ============================================================
function prepareSummary() {
    let html = '<table class="summary-table">';
    html += `<tr><th>Номер заявления</th><td>${applicationNumber || generateApplicationNumber()}</td></tr>`;
    const purposeLabel = {
        candidate: 'Регистрация кандидата',
        observer: 'Регистрация наблюдателя',
        voter: 'Изменение способа голосования'
    }[selectedPurpose] || selectedPurpose;
    html += `<tr><th>Цель обращения</th><td>${purposeLabel}</td></tr>`;

    // Выбранное голосование
    const election = elections.find(e => e.id === selectedElectionId);
    html += `<tr><th>Голосование</th><td>${election ? election.title : '—'}</td></tr>`;

    html += `<tr><th>Заявитель</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Личный код</th><td>${userProfile.personal_code}</td></tr>`;

    if (selectedPurpose === 'candidate') {
        const hasParty = document.querySelector('input[name="hasParty"]:checked');
        if (hasParty && hasParty.value === 'yes') {
            const partyName = document.getElementById('partyName').value.trim() || '—';
            html += `<tr><th>Партия</th><td>${partyName}</td></tr>`;
        } else {
            html += `<tr><th>Партия</th><td>Не принадлежит</td></tr>`;
        }
        const nominated = document.querySelector('input[name="nominated"]:checked');
        if (nominated) {
            html += `<tr><th>Выдвинут партией</th><td>${nominated.value === 'yes' ? 'Да' : 'Нет'}</td></tr>`;
            if (nominated.value === 'no') {
                html += `<tr><th>Примечание</th><td>Требуется сбор 10 подписей избирателей</td></tr>`;
            }
        }
    }

    if (selectedPurpose === 'observer') {
        const party = document.getElementById('observerParty').value.trim();
        if (party) html += `<tr><th>Партия</th><td>${party}</td></tr>`;
    }

    if (selectedPurpose === 'voter') {
        const goalLabel = {
            change_polling_station: 'Изменение места голосования',
            electronic_voting: 'Голосование в электронном виде',
            refuse_voting: 'Отказ от голосования'
        }[selectedVoterGoal] || selectedVoterGoal;
        html += `<tr><th>Цель как голосующего</th><td>${goalLabel}</td></tr>`;
        if (selectedVoterGoal === 'change_polling_station') {
            const ps = pollingStations.find(p => p.id === selectedPollingStationId);
            html += `<tr><th>Новый участок</th><td>${ps ? ps.name + ' (' + ps.address + ')' : '—'}</td></tr>`;
        }
        if (selectedVoterGoal === 'electronic_voting') {
            html += `<tr><th>Примечание</th><td>Для голосования в электронном виде необходима подтверждённая учётная запись.</td></tr>`;
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

    if (!selectedElectionId) {
        showError('Выберите голосование');
        return false;
    }

    if (!applicationNumber) {
        applicationNumber = generateApplicationNumber();
    }

    // Собираем данные в зависимости от типа
    let appData = {};
    let appType = selectedPurpose;

    if (selectedPurpose === 'candidate') {
        const hasParty = document.querySelector('input[name="hasParty"]:checked');
        const nominated = document.querySelector('input[name="nominated"]:checked');
        appData = {
            full_name: `${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}`,
            personal_code: userPersonalCode,
            has_party: hasParty ? hasParty.value === 'yes' : false,
            party_name: hasParty && hasParty.value === 'yes' ? document.getElementById('partyName').value.trim() : null,
            nominated_by_party: nominated ? nominated.value === 'yes' : false
        };
        appType = 'candidate_registration';
    } else if (selectedPurpose === 'observer') {
        appData = {
            full_name: `${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}`,
            personal_code: userPersonalCode,
            party: document.getElementById('observerParty').value.trim() || null
        };
        appType = 'observer_registration';
    } else if (selectedPurpose === 'voter') {
        appData = {
            full_name: `${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}`,
            personal_code: userPersonalCode,
            goal: selectedVoterGoal,
            new_polling_station_id: selectedVoterGoal === 'change_polling_station' ? selectedPollingStationId : null
        };
        appType = 'voter_request';
    }

    // Вставка в БД
    const payload = {
        user_id: session.user.id,
        election_id: selectedElectionId,
        type: appType,
        status: 'submitted',
        data: appData,
        comment: null,
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
        showError('Ошибка отправки заявления: ' + error.message);
        return false;
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

    // Навигация "Далее"
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', async () => {
            // Валидация
            if (currentStep === 2) {
                const purpose = document.querySelector('input[name="purpose"]:checked');
                if (!purpose) {
                    showError('Выберите цель обращения');
                    return;
                }
                selectedPurpose = purpose.value;
            }
            if (currentStep === '2.5') {
                if (!selectedElectionId) {
                    showError('Выберите голосование');
                    return;
                }
            }
            if (currentStep === '4-voter') {
                const goal = document.querySelector('input[name="voterGoal"]:checked');
                if (!goal) {
                    showError('Выберите цель');
                    return;
                }
                selectedVoterGoal = goal.value;
            }
            if (currentStep === '5-voter') {
                if (!selectedPollingStationId) {
                    showError('Выберите участок');
                    return;
                }
            }

            const next = getNextStep(currentStep);
            goToStep(next);
        });
    });

    // Навигация "Назад"
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

        const success = await submitApplication();

        btn.disabled = false;
        btn.textContent = 'Отправить заявление';

        if (success) {
            document.getElementById('applicationNumber').textContent = applicationNumber;
            document.getElementById('gotoServiceLink').href = `../../../personal-profile/services/service-view.html?id=${applicationNumber}`;
            goToStep(7);
        }
    });

    goToStep(1);
});