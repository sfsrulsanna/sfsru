(function() {
    const SUPABASE_URL = 'https://qeewwoklmjysactfhrum.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // ваш ключ
    const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const authSection = document.getElementById('authSection');
    const form = document.getElementById('agentForm');
    const messageDiv = document.getElementById('message');

    // Проверка авторизации и прав администратора
    async function checkAdmin() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '../../../login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return false;
        }

        // Проверяем роль admin в таблице users
        const { data: userData, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

        if (error || !userData || userData.role !== 'admin') {
            alert('У вас нет прав доступа к этой странице.');
            window.location.href = '../../../index.html';
            return false;
        }

        // Отображаем информацию о пользователе
        authSection.innerHTML = `
            <span>${session.user.email}</span>
            <button class="btn-logout" id="logoutBtn">Выйти</button>
        `;
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.reload();
        });

        return true;
    }

    // Обработка отправки формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageDiv.style.display = 'none';

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Обработка полей со списками (domain, email, phone_number)
        ['domain', 'email', 'phone_number'].forEach(field => {
            if (data[field]) {
                data[field] = data[field].split(',').map(s => s.trim()).filter(s => s);
            } else {
                data[field] = null;
            }
        });

        // Пустые строки заменяем на null
        Object.keys(data).forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        // Вставка в таблицу registry.foreign_agents
        const { error } = await supabase
            .from('registry.foreign_agents')
            .insert([data]);

        if (error) {
            messageDiv.textContent = 'Ошибка: ' + error.message;
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
        } else {
            messageDiv.textContent = 'Запись успешно добавлена!';
            messageDiv.className = 'message success';
            messageDiv.style.display = 'block';
            form.reset();
        }
    });

    // Инициализация
    checkAdmin();
})();