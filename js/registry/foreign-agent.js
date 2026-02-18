(function() {
    "use strict";

    if (typeof supabase === 'undefined') {
        console.error('Библиотека Supabase не загружена. Подключите её перед этим скриптом.');
        return;
    }

    // -------------------- КОНФИГУРАЦИЯ --------------------
    const SUPABASE_URL = 'https://qeewwoklmjysactfhrum.supabase.co'; // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ URL ВАШЕГО ПРОЕКТА
    const SUPABASE_ANON_KEY = 'your-anon-key';                        // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ ANON KEY
    const AGENTS_TABLE = 'registry_agents';
    const LOGIN_PAGE = '../../login.html';

    // Для отладки выведем часть ключа, чтобы убедиться, что он правильный
    console.log('Supabase URL:', SUPABASE_URL);
    console.log('Supabase Anon Key (первые 10 символов):', SUPABASE_ANON_KEY.substring(0, 10) + '...');

    // -------------------- ИНИЦИАЛИЗАЦИЯ КЛИЕНТА --------------------
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // -------------------- DOM ЭЛЕМЕНТЫ --------------------
    const authBlock = document.getElementById('authBlock');
    const accessMessageDiv = document.getElementById('accessMessage');
    const tableWrapper = document.getElementById('tableWrapper');
    const agentsTbody = document.getElementById('agentsTbody');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalClose = document.getElementById('modalClose');

    // Элементы модального окна (опущены для краткости, они должны быть объявлены как в предыдущих версиях)
    // ... (полный код см. в предыдущих ответах)

    // -------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (escapeHTML, linkifyList и т.д.) --------------------
    // ... (полный код см. в предыдущих ответах)

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
                // После выхода страница перезагрузится или обновится через слушатель
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
        console.log('Проверка паспорта для пользователя:', user.id);

        const { data: passport, error } = await supabaseClient
            .from('document_passport')
            .select('status')
            .eq('user_id', user.id)
            .eq('status', 'verified')
            .maybeSingle();

        if (error) {
            console.error('Ошибка при проверке паспорта:', error);
            return false;
        }
        console.log('Результат проверки паспорта:', passport);
        return !!passport;
    }

    // -------------------- ЗАГРУЗКА ДАННЫХ --------------------
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
        // ... (полный код см. в предыдущих ответах)
        // Для краткости здесь не повторяем, но он должен быть
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    // -------------------- ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ --------------------
    async function init() {
        console.log('Инициализация страницы...');
        
        // Диагностика: ключи localStorage
        console.log('Ключи localStorage:', Object.keys(localStorage));

        // Проверим, есть ли токен в localStorage для этого проекта
        const tokenKey = Object.keys(localStorage).find(key => key.includes('sb-') && key.includes('auth-token'));
        console.log('Найден токен в localStorage:', tokenKey);

        // Пытаемся получить сессию
        let { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            console.error('Ошибка получения сессии:', sessionError);
        }

        // Если сессии нет, пробуем обновить
        if (!session) {
            console.log('Сессия не найдена, пробуем обновить...');
            const { data, error: refreshError } = await supabaseClient.auth.refreshSession();
            if (refreshError) {
                console.error('Ошибка обновления сессии:', refreshError);
                // Если не удалось обновить, возможно, токен недействителен. Покажем сообщение и предложим войти заново.
                showMessage('Сессия истекла. Пожалуйста, войдите заново.', 'error');
                // Очистим localStorage от старого токена, чтобы избежать зацикливания
                if (tokenKey) {
                    localStorage.removeItem(tokenKey);
                    console.log('Удалён старый токен из localStorage');
                }
                renderAuthBlock(null);
                tableWrapper.style.display = 'none';
                return;
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