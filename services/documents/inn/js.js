import { supabase } from '../../../js/supabase-config.js';

// ============================================================
// Глобальные переменные
// ============================================================
let currentStep = 1;
let userProfile = null;
let userPersonalCode = null;
let applicationNumber = null;
let selectedInnType = null;
let selectedFnsId = null;
let fnsList = [];
let hasActiveApp = false;

// ID услуги ИНН в каталоге (будет получен при загрузке)
let serviceId = null;

// ============================================================
// Вспомогательные функции
// ============================================================
function generateApplicationNumber() {
    const digits = Math.floor(100000000 + Math.random() * 900000000);
    return `INN-${digits}`;
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
// Проверка активного заявления на ИНН
// ============================================================
async function checkActiveApplication() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    // Сначала получим ID услуги ИНН
    const { data: catalogData, error: catalogError } = await supabase
        .schema('services')
        .from('catalog')
        .select('id')
        .eq('service_key', 'inn')
        .single();

    if (catalogError || !catalogData) {
        console.error('Ошибка получения ID услуги ИНН:', catalogError);
        return false;
    }

    serviceId = catalogData.id;

    const { data, error } = await supabase
        .schema('services')
        .from('applications')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('service_id', serviceId)
        .in('status', ['submitted', 'processing'])
        .maybeSingle();

    if (error) {
        console.error('Ошибка проверки заявлений:', error);
        return false;
    }
    return !!data;
}

// ============================================================
// Загрузка списка ФНС
// ============================================================
async function loadFnsOffices() {
    const { data, error } = await supabase
        .schema('services')
        .from('fns_offices')
        .select('*')
        .order('name');
    if (error) {
        console.error('Ошибка загрузки отделений ФНС:', error);
        return;
    }
    fnsList = data;
    renderFnsList();
}

function renderFnsList() {
    const container = document.getElementById('fnsList');
    container.innerHTML = '';
    fnsList.forEach(fns => {
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'fns';
        radio.value = fns.id;
        radio.id = `fns-${fns.id}`;
        radio.classList.add('fns-radio');
        radio.style.display = 'none';

        const card = document.createElement('div');
        card.className = 'mvd-card';
        card.setAttribute('data-id', fns.id);
        card.innerHTML = `
            <h4><i class="fas fa-building" style="margin-right:0.5rem; color:#7b091a;"></i>${fns.name}</h4>
            <p>${fns.address}</p>
            <small>${fns.working_hours || ''}</small>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.mvd-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
            radio.checked = true;
            selectedFnsId = fns.id;
        });

        container.appendChild(radio);
        container.appendChild(card);
    });
}

// ============================================================
// Управление шагами
// ============================================================
function getNextStep(step) {
    switch (step) {
        case 1: return 2;
        case 2: {
            const type = document.querySelector('input[name="innType"]:checked');
            if (!type) return 2;
            return 3;
        }
        case 3: {
            const type = document.querySelector('input[name="innType"]:checked');
            if (type && type.value === 'paper') return 4;
            else return 5; // электронный -> сразу подтверждение
        }
        case 4: return 5;
        case 5: return 6;
        default: return step + 1;
    }
}

function getPrevStep(step) {
    switch (step) {
        case 2: return 1;
        case 3: return 2;
        case 4: return 3;
        case 5: {
            const type = document.querySelector('input[name="innType"]:checked');
            if (type && type.value === 'paper') return 4;
            else return 3;
        }
        case 6: return 5;
        default: return step - 1;
    }
}

function goToStep(step) {
    if (step < 1 || step > 6) return;

    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    const targetStep = document.querySelector(`.step-content[data-step="${step}"]`);
    if (targetStep) targetStep.classList.remove('hidden');
    currentStep = step;

    if (step === 3) {
        renderProfileData();
    }
    if (step === 4) {
        if (fnsList.length === 0) loadFnsOffices();
    }
    if (step === 5) {
        prepareSummary();
    }
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
// Шаг 5: Подтверждение
// ============================================================
function prepareSummary() {
    const type = document.querySelector('input[name="innType"]:checked');
    const typeLabel = type ? (type.value === 'electronic' ? 'Электронный' : 'Бумажный') : '—';

    let html = '<table class="summary-table">';
    html += `<tr><th>Способ получения</th><td>${typeLabel}</td></tr>`;
    html += `<tr><th>Личный код</th><td>${userProfile.personal_code || '—'}</td></tr>`;
    html += `<tr><th>ФИО</th><td>${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}</td></tr>`;
    html += `<tr><th>Дата рождения</th><td>${new Date(userProfile.date_of_birth).toLocaleDateString('ru-RU')}</td></tr>`;

    if (type && type.value === 'paper') {
        const fns = fnsList.find(f => f.id === selectedFnsId);
        html += `<tr><th>Отделение ФНС</th><td>${fns ? fns.name : '—'}</td></tr>`;
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

    const type = document.querySelector('input[name="innType"]:checked');
    if (!type) {
        showError('Выберите способ получения');
        return false;
    }

    if (!applicationNumber) {
        applicationNumber = generateApplicationNumber();
    }

    // Собираем данные
    const dataPayload = {
        type: type.value,
        fns_office_id: type.value === 'paper' ? selectedFnsId : null
    };

    const payload = {
        application_number: applicationNumber,
        user_id: session.user.id,
        service_id: serviceId,
        personal_code: userPersonalCode,
        status: 'submitted',
        data: dataPayload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    // Вставляем заявку
    const { data: inserted, error: insertError } = await supabase
        .schema('services')
        .from('applications')
        .insert(payload)
        .select('id')
        .single();

    if (insertError) {
        showError('Ошибка отправки заявления: ' + insertError.message);
        return false;
    }

    // Запись в историю
    const historyPayload = {
        application_id: inserted.id,
        status: 'submitted',
        comment: 'Заявление подано через портал',
        attachments: [],
        created_by: session.user.id,
        created_at: new Date().toISOString()
    };

    const { error: historyError } = await supabase
        .schema('services')
        .from('application_status_history')
        .insert(historyPayload);

    if (historyError) {
        console.error('Ошибка записи в историю:', historyError);
        showError('Заявление создано, но не удалось записать историю статусов.');
    }

    return true;
}

// ============================================================
// Инициализация
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!await loadUserProfile()) return;

    // Проверка активного заявления (получаем serviceId внутри)
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

    // Предзагружаем список ФНС (он может понадобиться позже)
    loadFnsOffices();

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
                const type = document.querySelector('input[name="innType"]:checked');
                if (!type) {
                    showError('Выберите способ получения');
                    return;
                }
                selectedInnType = type.value;
            }
            if (currentStep === 4) {
                if (!selectedFnsId) {
                    showError('Выберите отделение ФНС');
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
            document.getElementById('gotoServiceLink').href = `../../../profile/services/service-view.html?id=${applicationNumber}`;
            goToStep(6);
        }
    });

    goToStep(1);
});