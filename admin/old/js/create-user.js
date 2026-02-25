import { 
    auth, 
    db,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    serverTimestamp 
} from './firebase-config.js';

// Показываем email админа
auth.onAuthStateChanged((user) => {
    if (user && user.email === 'sfsru@admin.su') {
        document.getElementById('userEmail').textContent = user.email;
    }
});

// Кнопка выхода
document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await auth.signOut();
    window.location.href = 'index.html';
});

// Обработка формы
document.getElementById('createUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    const messageDiv = document.getElementById('formMessage');
    
    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';
        submitBtn.disabled = true;
        
        const userData = {
            lastName: document.getElementById('lastName').value.trim(),
            firstName: document.getElementById('firstName').value.trim(),
            middleName: document.getElementById('middleName').value.trim(),
            birthDate: document.getElementById('birthDate').value,
            birthPlace: document.getElementById('birthPlace').value.trim(),
            personalCode: document.getElementById('personalCode').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim() || null,
            address: {
                street: document.getElementById('address').value.trim() || null,
                city: document.getElementById('city').value.trim() || null,
                postalCode: document.getElementById('postalCode').value.trim() || null
            },
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.email,
            status: 'active',
            lastUpdated: serverTimestamp()
        };
        
        // ВАЛИДАЦИЯ
        const errors = [];
        
        // Проверка обязательных полей
        if (!userData.lastName) errors.push('Фамилия обязательна');
        if (!userData.firstName) errors.push('Имя обязательно');
        if (!userData.birthDate) errors.push('Дата рождения обязательна');
        if (!userData.birthPlace) errors.push('Место рождения обязательно');
        if (!userData.personalCode) errors.push('Личный код обязателен');
        if (!userData.email) errors.push('Email обязателен');
        
        // Проверка формата личного кода
        const personalCodeRegex = /^\d{4}-\d{4}$/;
        if (!personalCodeRegex.test(userData.personalCode)) {
            errors.push('Неверный формат личного кода. Используйте формат: XXXX-XXXX (8 цифр, например: 1234-5678)');
        }
        
        // Email валидация
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userData.email)) {
            errors.push('Неверный формат email');
        }
        
        // Если есть ошибки - выбрасываем исключение
        if (errors.length > 0) {
            throw new Error(errors.join('. '));
        }
        
        // Проверка уникальности личного кода
        const usersQuery = query(
            collection(db, 'users'),
            where('personalCode', '==', userData.personalCode)
        );
        
        const existing = await getDocs(usersQuery);
        if (!existing.empty) {
            throw new Error('Пользователь с таким личным кодом уже существует');
        }
        
        // Проверка уникальности email
        const emailQuery = query(
            collection(db, 'users'),
            where('email', '==', userData.email)
        );
        
        const existingEmail = await getDocs(emailQuery);
        if (!existingEmail.empty) {
            throw new Error('Пользователь с таким email уже существует');
        }
        
        // Сохраняем в Firestore
        const docRef = await addDoc(collection(db, 'users'), userData);
        
        // Логируем создание
        await addDoc(collection(db, 'admin_logs'), {
            action: 'user_created',
            personalCode: userData.personalCode,
            email: userData.email,
            adminEmail: auth.currentUser.email,
            timestamp: serverTimestamp()
        });
        
        // Показываем успешное сообщение
        showMessage('success', `
            <div style="padding: 15px;">
                <h4 style="color: #155724; margin-bottom: 10px;">
                    <i class="fas fa-check-circle" style="color: #28a745;"></i> Пользователь успешно создан!
                </h4>
                <div style="background: #d4edda; padding: 10px; border-radius: 5px;">
                    <p><strong>ID в системе:</strong> ${docRef.id}</p>
                    <p><strong>Личный код:</strong> <code>${userData.personalCode}</code></p>
                    <p><strong>ФИО:</strong> ${userData.lastName} ${userData.firstName} ${userData.middleName || ''}</p>
                    <p><strong>Email:</strong> ${userData.email}</p>
                </div>
                <p style="margin-top: 10px;">Теперь вы можете добавить документы для этого пользователя.</p>
            </div>
        `);
        
        // Очищаем форму через 5 секунд
        setTimeout(() => {
            document.getElementById('createUserForm').reset();
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            messageDiv.style.display = 'none';
        }, 5000);
        
    } catch (error) {
        console.error('Ошибка создания:', error);
        showMessage('error', `
            <div style="padding: 15px;">
                <h4 style="color: #721c24; margin-bottom: 10px;">
                    <i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i> Ошибка создания пользователя
                </h4>
                <div style="background: #f8d7da; padding: 10px; border-radius: 5px;">
                    <p>${error.message}</p>
                </div>
            </div>
        `);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

// Функция отображения сообщений
function showMessage(type, html) {
    const messageDiv = document.getElementById('formMessage');
    messageDiv.className = `alert alert-${type}`;
    messageDiv.innerHTML = html;
    messageDiv.style.display = 'block';
    
    // Прокручиваем к сообщению
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}