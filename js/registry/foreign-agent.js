(function() {
    "use strict";

    if (typeof supabase === 'undefined') {
        console.error('Библиотека Supabase не загружена. Подключите её перед этим скриптом.');
        return;
    }

    // -------------------- КОНФИГУРАЦИЯ --------------------
	const SUPABASE_URL = 'https://qeewwoklmjysactfhrum.supabase.co';
	const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZXd3b2tsbWp5c2FjdGZocnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTI2MTEsImV4cCI6MjA4NjQ4ODYxMX0.gWzqku1cS08v17kfJHJbOWbm-DRpzwQ9omlQsKxc96A';
    const AGENTS_TABLE = 'registry_agents';
    const LOGIN_PAGE = '../../login.html';

    // -------------------- ИНИЦИАЛИЗАЦИЯ КЛИЕНТА --------------------
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // -------------------- DOM ЭЛЕМЕНТЫ --------------------
    const authBlock = document.getElementById('authBlock');
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

    // -------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ --------------------
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
        if (item.includes('@') && !item.startsWith('http')) {
            return `<a href="mailto:${escapeHTML(item)}">${escapeHTML(item)}</a>`;
        }
        if (/^[\+]?[\d\s\(\)\-]{5,}$/.test(item.replace(/\s/g, ''))) {
            let cleaned = item.replace(/[^\d+]/g, '');
            return `<a href="tel:${escapeHTML(cleaned)}">${escapeHTML(item)}</a>`;
        }
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
                if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
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

    // -------------------- УПРАВЛЕНИЕ СООБЩЕНИЯМИ --------------------
    function showMessage(text, type = 'info') {
        if (!accessMessageDiv) return;
        accessMessageDiv.textContent = text;
        accessMessageDiv.className = `access-message ${type}`;
        accessMessageDiv.style.display = 'block';
    }

    function hideMessage() {
        if (accessMessageDiv) accessMessageDiv.style.display = 'none';
    }

    // -------------------- ОТРИСОВКА БЛОКА АВТОРИЗАЦИИ --------------------
    function renderAuthBlock(session) {
        if (!authBlock) return;
        if (session) {
            const user = session.user;
            authBlock.innerHTML = `
                <span class="user-email">${escapeHTML(user.email)}</span>
                <button class="auth-button" id="logoutButton">Выйти</button>
            `;
            document.getElementById('logoutButton')?.addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
            });
        } else {
            authBlock.innerHTML = `<a href="${LOGIN_PAGE}" class="auth-button">Войти</a>`;
        }
    }

    // -------------------- ПРОВЕРКА ДОСТУПА (ПАСПОРТ) --------------------
    async function checkAccess(session) {
        if (!session) {
            console.log('Нет сессии');
            return false;
        }
        const user = session.user;
        console.log('Проверка паспорта для пользователя:', id);

        const { data: passport, error } = await supabaseClient
            .from('document_passport')
            .select('status')
            .eq('id', id)
            .eq('status', 'verified')
            .maybeSingle();

        if (error) {
            console.error('Ошибка при проверке паспорта:', error);
            return false;
        }
        console.log('Результат проверки паспорта:', passport);
        return !!passport;
    }

    // -------------------- ЗАГРУЗКА ДАННЫХ ИЗ ТАБЛИЦЫ --------------------
    async function loadAgents() {
        console.log('Загрузка данных из таблицы', AGENTS_TABLE);
        const { data, error } = await supabaseClient
            .from(AGENTS_TABLE)
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            console.error('Ошибка загрузки данных:', error);
            return null;
        }
        console.log('Загружено записей:', data?.length);
        return data || [];
    }

    // -------------------- ОТРИСОВКА ТАБЛИЦЫ --------------------
    function renderTable(agents) {
        if (!agentsTbody || !tableWrapper) return;
        agentsTbody.innerHTML = '';
        if (!agents || agents.length === 0) {
            showMessage('В реестре пока нет записей.', 'info');
            tableWrapper.style.display = 'none';
            return;
        }
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
        hideMessage();
    }

    // -------------------- ОТКРЫТИЕ МОДАЛЬНОГО ОКНА --------------------
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

    // -------------------- ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ --------------------
    async function init() {
        console.log('Инициализация страницы...');
        
        // Диагностика: проверим, есть ли ключи в localStorage
        console.log('Ключи localStorage:', Object.keys(localStorage));

        // Пытаемся получить сессию
        let { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            console.error('Ошибка получения сессии:', sessionError);
        }

        // Если сессии нет, пробуем обновить (может быть, есть refresh token)
        if (!session) {
            console.log('Сессия не найдена, пробуем обновить...');
            const { data, error: refreshError } = await supabaseClient.auth.refreshSession();
            if (refreshError) {
                console.error('Ошибка обновления сессии:', refreshError);
            } else {
                session = data.session;
                console.log('Сессия обновлена:', session);
            }
        } else {
            console.log('Сессия получена:', session);
        }

        renderAuthBlock(session);

        // Проверяем доступ
        const hasAccess = await checkAccess(session);
        if (!hasAccess) {
            if (session) {
                showMessage('У вас нет подтвержденного паспорта гражданина СФСРЮ. Доступ запрещён.', 'error');
            } else {
                showMessage('Для доступа к реестру необходимо авторизоваться.', 'error');
            }
            tableWrapper.style.display = 'none';
            return;
        }

        // Загружаем данные
        const agents = await loadAgents();
        if (agents === null) {
            showMessage('Не удалось загрузить данные реестра.', 'error');
            return;
        }
        renderTable(agents);

        // Подписка на изменения авторизации
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth event:', event);
            renderAuthBlock(session);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                const hasAccess = await checkAccess(session);
                if (hasAccess) {
                    const agents = await loadAgents();
                    renderTable(agents);
                } else {
                    showMessage('У вас нет подтвержденного паспорта.', 'error');
                    tableWrapper.style.display = 'none';
                    agentsTbody.innerHTML = '';
                }
            } else if (event === 'SIGNED_OUT') {
                showMessage('Для доступа к реестру необходимо авторизоваться.', 'error');
                tableWrapper.style.display = 'none';
                agentsTbody.innerHTML = '';
            }
        });
    }

    // -------------------- ОБРАБОТЧИКИ МОДАЛЬНОГО ОКНА --------------------
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeModal();
        }
    });

    // -------------------- МОБИЛЬНОЕ МЕНЮ --------------------
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

    // -------------------- ЗАПУСК --------------------
    init();
})();