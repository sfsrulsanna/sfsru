import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

const ADMIN_EMAIL = 'sfsru@admin.su';

// На странице входа проверяем, не вошел ли уже админ
auth.onAuthStateChanged((user) => {
    if (user && user.email === ADMIN_EMAIL) {
        // Если уже вошел - на дашборд
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 100);
    }
});

// Обработка формы входа
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('errorMessage');
            
            try {
                // Пробуем войти
                await signInWithEmailAndPassword(auth, email, password);
                
                // Проверяем email
                const user = auth.currentUser;
                if (user.email === ADMIN_EMAIL) {
                    window.location.href = 'dashboard.html';
                } else {
                    throw new Error('Доступ только для администратора');
                }
                
            } catch (error) {
                console.log('Ошибка входа:', error.code);
                
                let message = 'Ошибка входа';
                if (error.code === 'auth/user-not-found') {
                    message = 'Пользователь не найден. Создайте sfsru@admin.su в Firebase Console.';
                } else if (error.code === 'auth/wrong-password') {
                    message = 'Неверный пароль';
                } else if (error.code === 'auth/invalid-email') {
                    message = 'Неверный формат email';
                }
                
                if (errorDiv) {
                    errorDiv.textContent = message;
                    errorDiv.style.display = 'block';
                } else {
                    alert(message);
                }
            }
        });
    }
});