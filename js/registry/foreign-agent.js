// Весь код обёрнут в IIFE, чтобы избежать конфликтов с глобальными переменными
(function() {
    "use strict";

    // Проверяем, загружена ли библиотека Supabase
    if (typeof supabase === 'undefined') {
        console.error('Библиотека Supabase не загружена. Подключите её перед этим скриптом.');
        return;
    }

    // --- Конфигурация ---
    const SUPABASE_URL = 'https://your-project.supabase.co'; // Замените на ваш URL
    const SUPABASE_ANON_KEY = 'your-anon-key';               // Замените на ваш anon key
    const AGENTS_TABLE = 'registry_agents';

    // --- Инициализация клиента Supabase ---
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- DOM элементы ---
    const accessMessageDiv = document.getElementById('accessMessage');
    const tableWrapper = document.getElementById('tableWrapper');
    const agentsTbody = document.getElementById('agentsTbody');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalClose = document.getElementById('modalClose');

    // Элементы модального окна
    const modalFullName = document.getElementById('modalFullName');
    const modalAlias = document.getElementById('modalAlias');
    const modalReason = document.getElementById('modalReason');
    const modalInclusionDate = document.getElementById('modalInclusionDate');
    const modalExclusionDate = document.getElementById('modalExclusionDate');
    const modalDomain = document.getElementById('modalDomain');
    const modalType = document.getElementById('modalType');
    const modalINN = document.getElementById('modalINN');
    const modalNSS = document.getElementById('modalNSS');
    const modalBirthDate = document.getElementById('modalBirthDate');
    const modalEmail = document.getElementById('modalEmail');
    const modalPhoneNumber = document.getElementById('modalPhoneNumber');
    const modalAccountNumber = document.getElementById('modalAccountNumber');
    const modalBankName = document.getElementById('modalBankName');
    const modalBIC = document.getElementById('modalBIC');
    const modalCorrAccount = document.getElementById('modalCorrAccount');
    const modalAccountOpenDate = document.getElementById('modalAccountOpenDate');
    const modalMore = document.getElementById('modalMore');

    // --- Вспомогательные функции ---
    function escapeHTML(unsafe) {
        return unsafe.replace(/[&<>"]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            if (m === '"') return '&quot;';
            return m;
        });
    }

    function autoLinkifyItem(item) {
        // email
        if (item.includes('@') && !item.startsWith('http')) {
            return `<a href="mailto:${escapeHTML(item)}">${escapeHTML(item)}</a>`;
        }
        // телефон
        if (/^[\+]?[\d\s\(\)\-]{5,}$/.test(item.replace(/\s/g, ''))) {
            let cleaned = item.replace(/[^\d+]/g, '');
            return `<a href="tel:${escapeHTML(cleaned)}">${escapeHTML(item)}</a>`;
        }
        // URL
        let url = item;
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item)}</a>`;
    }

    function linkifyList(text, type) {
        if (!text || text === '—' || text.trim() === '') return '—';
        let items = text.split(',').map(s => s.trim()).filter(s => s !== '');
        let linkedItems = items.map(item => {
            if (type === 'url') {
                let url = item;
                if (!/^https?:\/\//i.test(url)) {
                    url = 'https://' + url;
                }
                return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item)}</a>`;
            } else if (type === 'email') {
                return `<a href="mailto:${escapeHTML(item)}">${escapeHTML(item)}</a>`;
            } else if (type === 'phone') {
                let cleaned = item.replace(/[^\d+]/g, '');
                return `<a href="tel:${escapeHTML(cleaned)}">${escapeHTML(item)}</a>`;
            } else {
                return autoLinkifyItem(item);
            }
        });
        return linkedItems.join(', ');
    }

    // --- Управление сообщениями ---
    function showMessage(text, type = 'info') {
        accessMessageDiv.textContent = text;
        accessMessageDiv.className = `access-message ${type}`;
        accessMessageDiv.style.display = 'block';
    }

    function hideMessage() {
        accessMessageDiv.style.display = 'none';
    }

    // --- Проверка доступа ---
    async function checkAccess() {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !session) {
            showMessage('Для доступа к реестру необходимо авторизоваться.', 'error');
            return false;
        }

        const user = session.user;

        const { data: passport, error: passportError } = await supabaseClient
            .from('document_passport')
            .select('status')
            .eq('user_id', user.id)
            .eq('status', 'verified')
            .maybeSingle();

        if (passportError) {
            console.error('Ошибка при проверке паспорта:', passportError);
            showMessage('Ошибка при проверке паспорта. Попробуйте позже.', 'error');
            return false;
        }

        if (!passport) {
            showMessage('У вас нет подтвержденного паспорта гражданина СФСРЮ. Доступ запрещён.', 'error');
            return false;
        }

        hideMessage();
        return true;
    }

    // --- Загрузка данных ---
    async function loadAgents() {
        const { data: agents, error } = await supabaseClient
            .from(AGENTS_TABLE)
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Ошибка загрузки данных:', error);
            showMessage('Не удалось загрузить данные реестра.', 'error');
            return [];
        }

        return agents || [];
    }

    // --- Отрисовка таблицы ---
    function renderTable(agents) {
        agentsTbody.innerHTML = '';

        agents.forEach((agent, index) => {
            const row = document.createElement('tr');
            row.setAttribute('data-agent-id', agent.id);

            const inclusionDate = agent.inclusion_date ? new Date(agent.inclusion_date).toLocaleDateString('ru-RU') : '—';
            const exclusionDate = agent.exclusion_date ? new Date(agent.exclusion_date).toLocaleDateString('ru-RU') : '—';

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHTML(agent.full_name || '')}</td>
                <td>${escapeHTML(agent.alias || '')}</td>
                <td>${escapeHTML(agent.reason || '')}</td>
                <td>${inclusionDate}</td>
                <td>${exclusionDate}</td>
            `;

            row.addEventListener('click', () => openModal(agent));

            agentsTbody.appendChild(row);
        });

        tableWrapper.style.display = 'block';
    }

    // --- Открытие модального окна ---
    function openModal(agent) {
        modalFullName.textContent = agent.full_name || '—';
        modalAlias.textContent = agent.alias || '—';
        modalReason.textContent = agent.reason || '—';
        modalInclusionDate.textContent = agent.inclusion_date ? new Date(agent.inclusion_date).toLocaleDateString('ru-RU') : '—';
        modalExclusionDate.textContent = agent.exclusion_date ? new Date(agent.exclusion_date).toLocaleDateString('ru-RU') : '—';
        modalDomain.innerHTML = linkifyList(agent.domain || '—', 'url');
        modalType.textContent = agent.type || '—';
        modalINN.textContent = agent.inn || '—';
        modalNSS.textContent = agent.nss || '—';
        modalBirthDate.textContent = agent.birth_date || '—';
        modalEmail.innerHTML = linkifyList(agent.email || '—', 'email');
        modalPhoneNumber.innerHTML = linkifyList(agent.phone_number || '—', 'phone');
        modalAccountNumber.textContent = agent.account_number || '—';
        modalBankName.textContent = agent.bank_name || '—';
        modalBIC.textContent = agent.bic || '—';
        modalCorrAccount.textContent = agent.corr_account || '—';
        modalAccountOpenDate.textContent = agent.account_open_date ? new Date(agent.account_open_date).toLocaleDateString('ru-RU') : '—';
        modalMore.textContent = agent.more || '—';

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    // --- Инициализация ---
    async function initPage() {
        const hasAccess = await checkAccess();
        if (!hasAccess) return;

        const agents = await loadAgents();
        if (agents.length > 0) {
            renderTable(agents);
        } else {
            showMessage('В реестре пока нет записей.', 'info');
        }
    }

    // --- Обработчики событий ---
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeModal();
        }
    });

    // Мобильное меню
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

    // Запуск
    initPage();
})();