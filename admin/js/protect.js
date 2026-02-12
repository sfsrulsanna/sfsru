import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

const ADMIN_EMAIL = 'sfsru@admin.su';

// ЕДИНСТВЕННАЯ ПРОВЕРКА - ВСТАВИТЬ В НАЧАЛО ВСЕХ ЗАЩИЩЕННЫХ СТРАНИЦ
onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== ADMIN_EMAIL) {
        // Сохраняем текущую страницу, чтобы вернуться после входа
        if (window.location.pathname !== '/admin/index.html') {
            sessionStorage.setItem('redirect_url', window.location.pathname);
        }
        window.location.href = 'index.html';
    }
});