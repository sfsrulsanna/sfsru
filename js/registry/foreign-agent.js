// foreign-agent.js — Реестр иностранных агентов (физические и юридические лица)
import { supabase } from '../../../js/supabase-config.js';

// -------------------- КОНФИГУРАЦИЯ --------------------
const AGENTS_TABLE_INDIVIDUAL = 'foreign_agents';       // физические лица
const AGENTS_TABLE_LEGAL = 'foreign_agents_org';        // юридические лица
const LOGIN_PAGE = '../../login.html';

// -------------------- DOM ЭЛЕМЕНТЫ --------------------
const authSection = document.getElementById('authSection');
const accessMessageDiv = document.getElementById('accessMessage');
const tableWrapper = document.getElementById('tableWrapper');
const agentsTbody = document.getElementById('agentsTbody');
const tableHeader = document.getElementById('tableHeader');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');

let currentType = 'individual'; // 'individual' или 'legal'
let currentData = [];

// -------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ --------------------
function escapeHTML(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function linkifyList(text, type) {
    if (!text || text === '—' || text.trim() === '') return '—';
    let items = text.split(',').map(s => s.trim()).filter(s => s !== '');
    let linkedItems = items.map(item => {
        if (type === 'url') {
            let url = item;
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
            return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item)}</a>`;
        } else if (type === 'email') {
            return `<a href="mailto:${escapeHTML(item)}">${escapeHTML(item)}</a>`;
        } else if (type === 'phone') {
            let cleaned = item.replace(/[^\d+]/g, '');
            return `<a href="tel:${escapeHTML(cleaned)}">${escapeHTML(item)}</a>`;
        } else {
            if (item.includes('@') && !item.startsWith('http')) {
                return `<a href="mailto:${escapeHTML(item)}">${escapeHTML(item)}</a>`;
            }
            if (/^[\+]?[\d\s\(\)\-]{5,}$/.test(item.replace(/\s/g, ''))) {
                let cleaned = item.replace(/[^\d+]/g, '');
                return `<a href="tel:${escapeHTML(cleaned)}">${escapeHTML(item)}</a>`;
            }
            if (/^https?:\/\//i.test(item)) {
                return `<a href="${escapeHTML(item)}" target="_blank">${escapeHTML(item)}</a>`;
            }
            return escapeHTML(item);
        }
    });
    return linkedItems.join(', ');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('ru-RU');
    } catch {
        return dateStr;
    }
}

function showMessage(text, type = 'info') {
    if (!accessMessageDiv) return;
    accessMessageDiv.textContent = text;
    accessMessageDiv.className = `access-message ${type}`;
    accessMessageDiv.style.display = 'block';
}
function hideMessage() {
    if (accessMessageDiv) accessMessageDiv.style.display = 'none';
}

// -------------------- ЗАГРУЗКА ДАННЫХ --------------------
async function loadData() {
    const tableName = currentType === 'individual' ? AGENTS_TABLE_INDIVIDUAL : AGENTS_TABLE_LEGAL;
    const { data, error } = await supabase
        .schema('registry')
        .from(tableName)
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Ошибка загрузки данных:', error);
        showMessage('Не удалось загрузить данные реестра.', 'error');
        return null;
    }
    return data || [];
}

// -------------------- ОТРИСОВКА ТАБЛИЦЫ --------------------
function renderTable(agents) {
    if (!agents || agents.length === 0) {
        agentsTbody.innerHTML = '<tr><td colspan="100%">Нет записей</td></tr>';
        tableWrapper.style.display = 'block';
        showMessage('В реестре пока нет записей.', 'info');
        return;
    }

    let headers = [];
    if (currentType === 'individual') {
        headers = [
            '№ п/п', 'ФИО', 'Псевдоним', 'Основания', 'Дата включения', 'Дата исключения'
        ];
    } else {
        headers = [
            '№ п/п', 'Краткое название', 'Полное наименование', 'ИНН', 'Основания', 'Дата включения', 'Дата исключения'
        ];
    }

    tableHeader.innerHTML = `<tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr>`;

    agentsTbody.innerHTML = agents.map(agent => {
        const serialNumber = agent.serial_number || agent.id; // fallback на случай отсутствия
        let rowCells = [];
        rowCells.push(`<td>${serialNumber}</td>`);
        if (currentType === 'individual') {
            rowCells.push(`<td>${escapeHTML(agent.full_name || '')}</td>`);
            rowCells.push(`<td>${escapeHTML(agent.alias || '')}</td>`);
            rowCells.push(`<td>${escapeHTML(agent.reason || '')}</td>`);
            rowCells.push(`<td>${formatDate(agent.inclusion_date)}</td>`);
            rowCells.push(`<td>${formatDate(agent.exclusion_date)}</td>`);
        } else {
            rowCells.push(`<td>${escapeHTML(agent.org_short_name || '')}</td>`);
            rowCells.push(`<td>${escapeHTML(agent.org_name || '')}</td>`);
            rowCells.push(`<td>${escapeHTML(agent.inn || '')}</td>`);
            rowCells.push(`<td>${escapeHTML(agent.reason || '')}</td>`);
            rowCells.push(`<td>${formatDate(agent.inclusion_date)}</td>`);
            rowCells.push(`<td>${formatDate(agent.exclusion_date)}</td>`);
        }
        return `<tr data-agent-id="${agent.id}">${rowCells.join('')}</tr>`;
    }).join('');

    tableWrapper.style.display = 'block';
    hideMessage();

    // Обработчики кликов на строки
    document.querySelectorAll('#agentsTbody tr').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.getAttribute('data-agent-id');
            const agent = currentData.find(a => a.id === id);
            if (agent) openModal(agent);
        });
    });
}

// -------------------- МОДАЛЬНОЕ ОКНО --------------------
function openModal(agent) {
    let fields = [];
    if (currentType === 'individual') {
        fields = [
            { label: 'ФИО', value: agent.full_name || '—' },
            { label: 'Псевдоним', value: agent.alias || '—' },
            { label: 'Основания для включения', value: agent.reason || '—' },
            { label: 'Дата включения в реестр', value: formatDate(agent.inclusion_date) },
            { label: 'Дата исключения из реестра', value: formatDate(agent.exclusion_date) },
            { label: 'Доменное имя информационного ресурса', value: linkifyList(agent.domain || '—', 'url') },
            { label: 'Тип иностранного агента', value: agent.type || '—' },
            { label: 'ИНН', value: agent.inn || '—' },
            { label: 'НСС (при наличии)', value: agent.nss || '—' },
            { label: 'Дата рождения', value: agent.birth_date || '—' },
            { label: 'Электронная почта', value: linkifyList(agent.email || '—', 'email') },
            { label: 'Номер телефона', value: linkifyList(agent.phone_number || '—', 'phone') },
            { label: 'Номер специального счета', value: agent.account_number || '—' },
            { label: 'Наименование и местонахождение банка', value: agent.bank_name || '—' },
            { label: 'БИК уполномоченного банка', value: agent.bic || '—' },
            { label: 'Номер корреспондентского счета', value: agent.corr_account || '—' },
            { label: 'Дата открытия специального счета', value: formatDate(agent.account_open_date) },
            { label: 'Дополнительные данные', value: agent.more || '—' }
        ];
    } else {
        fields = [
            { label: 'Краткое название организации', value: agent.org_short_name || '—' },
            { label: 'Полное наименование организации', value: agent.org_name || '—' },
            { label: 'ИНН', value: agent.inn || '—' },
            { label: 'ОГРН', value: agent.ogrn || '—' },
            { label: 'Дата образования организации', value: formatDate(agent.establishment_date) },
            { label: 'Руководитель организации', value: agent.head || '—' },
            { label: 'Участники организации', value: agent.participants || '—' },
            { label: 'Основания для включения', value: agent.reason || '—' },
            { label: 'Дата включения в реестр', value: formatDate(agent.inclusion_date) },
            { label: 'Дата исключения из реестра', value: formatDate(agent.exclusion_date) },
            { label: 'Доменное имя информационного ресурса', value: linkifyList(agent.domain || '—', 'url') },
            { label: 'Тип иностранного агента', value: agent.type || '—' },
            { label: 'Адрес (место нахождения)', value: agent.address || '—' },
            { label: 'Электронная почта', value: linkifyList(agent.email || '—', 'email') },
            { label: 'Номер телефона', value: linkifyList(agent.phone_number || '—', 'phone') },
            { label: 'Номер специального счета', value: agent.account_number || '—' },
            { label: 'Наименование и местонахождение банка', value: agent.bank_name || '—' },
            { label: 'БИК уполномоченного банка', value: agent.bic || '—' },
            { label: 'Номер корреспондентского счета', value: agent.corr_account || '—' },
            { label: 'Дата открытия специального счета', value: formatDate(agent.account_open_date) },
            { label: 'Дополнительные данные', value: agent.more || '—' }
        ];
    }

    modalTitle.textContent = currentType === 'individual' 
        ? (agent.full_name || 'Информация о лице')
        : (agent.org_name || 'Информация об организации');

    modalContent.innerHTML = fields.map(f => `
        <div class="info-row">
            <div class="info-label">${escapeHTML(f.label)}</div>
            <div class="info-value">${f.value}</div>
        </div>
    `).join('');

    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// -------------------- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК --------------------
async function switchType(type) {
    if (type === currentType) return;
    currentType = type;
    document.querySelectorAll('.tab').forEach(tab => {
        if (tab.dataset.type === type) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    tableWrapper.style.display = 'none';
    agentsTbody.innerHTML = '';
    showMessage('Загрузка...', 'info');
    const data = await loadData();
    if (data !== null) {
        currentData = data;
        renderTable(currentData);
    } else {
        showMessage('Ошибка загрузки данных', 'error');
    }
}

// -------------------- ПРОВЕРКА ДОСТУПА (ПАСПОРТ) --------------------
async function checkAccess(session) {
    if (!session) return false;
    const user = session.user;

    let personalCode = user.user_metadata?.personal_code || user.app_metadata?.personal_code;
    if (!personalCode) {
        const { data: userData, error } = await supabase
            .from('users')
            .select('personal_code')
            .eq('id', user.id)
            .maybeSingle();
        if (!error && userData?.personal_code) {
            personalCode = userData.personal_code;
        }
    }

    if (!personalCode) {
        console.error('personal_code не найден');
        showMessage('Не удалось определить ваш personal_code. Обратитесь в поддержку.', 'error');
        return false;
    }

    const { data: passport, error } = await supabase
        .schema('documents')
        .from('passport')
        .select('status')
        .eq('personal_code', personalCode)
        .eq('status', 'verified')
        .maybeSingle();

    if (error) {
        console.error('Ошибка при проверке паспорта:', error);
        showMessage('Ошибка при проверке паспорта. Попробуйте позже.', 'error');
        return false;
    }
    return !!passport;
}

// -------------------- БЛОК АВТОРИЗАЦИИ --------------------
function renderAuthSection(session) {
    if (!authSection) return;
    if (session) {
        const user = session.user;
        authSection.innerHTML = `
            <div class="user-info">
                <span class="user-email">${escapeHTML(user.email)}</span>
                <button class="logout-btn" id="logoutBtn">Выйти</button>
            </div>
        `;
        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            await supabase.auth.signOut();
        });
    } else {
        const currentPath = window.location.pathname;
        authSection.innerHTML = `<a href="${LOGIN_PAGE}?redirect=${encodeURIComponent(currentPath)}" class="auth-button">Войти</a>`;
    }
}

// -------------------- ИНИЦИАЛИЗАЦИЯ --------------------
async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    renderAuthSection(session);

    if (!session) {
        showMessage('Для доступа к реестру необходимо авторизоваться.', 'error');
        return;
    }

    const hasAccess = await checkAccess(session);
    if (!hasAccess) {
        showMessage('У вас нет подтвержденного паспорта гражданина СФСРЮ. Доступ запрещён.', 'error');
        return;
    }

    const data = await loadData();
    if (data !== null) {
        currentData = data;
        renderTable(currentData);
    }

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchType(tab.dataset.type));
    });

    supabase.auth.onAuthStateChange((event, session) => {
        renderAuthSection(session);
        if (event === 'SIGNED_OUT') {
            showMessage('Для доступа к реестру необходимо авторизоваться.', 'error');
            tableWrapper.style.display = 'none';
            agentsTbody.innerHTML = '';
        } else if (event === 'SIGNED_IN') {
            window.location.reload();
        }
    });
}

// -------------------- ОБРАБОТЧИКИ --------------------
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
});

const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');
const menuOverlay = document.getElementById('menuOverlay');
if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        menuOverlay.classList.toggle('active');
        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : 'auto';
    });
}
if (menuOverlay) {
    menuOverlay.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        navMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    });
}

init();