import { 
    auth, 
    db,
    collection,
    getDocs,
    query,
    where,
    serverTimestamp,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    orderBy
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
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
});

// ==================== ОСНОВНЫЕ ПЕРЕМЕННЫЕ ====================

let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const usersPerPage = 10;

// ==================== ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ ====================

async function loadUsers() {
    try {
        console.log('Начинаем загрузку пользователей...');
        
        // Получаем всех пользователей
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        
        console.log('Получено пользователей:', querySnapshot.size);
        
        allUsers = [];
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            const createdAt = userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date();
            
            allUsers.push({
                id: doc.id,
                ...userData,
                createdAt: createdAt
            });
        });
        
        // Сортируем по дате создания (новые сначала)
        allUsers.sort((a, b) => b.createdAt - a.createdAt);
        
        filteredUsers = [...allUsers];
        updateUserCount();
        renderUsers();
        updateStatistics();
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        document.getElementById('usersTableBody').innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #dc3545;">
                    <i class="fas fa-exclamation-triangle"></i> Ошибка загрузки данных: ${error.message}
                </td>
            </tr>
        `;
    }
}

// ==================== РЕДАКТИРОВАНИЕ ПОЛЬЗОВАТЕЛЕЙ ====================

// Функция редактирования пользователя
window.editUser = async function(userId) {
    try {
        console.log('Редактирование пользователя ID:', userId);
        
        // Получаем данные пользователя
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            alert('Пользователь не найден');
            return;
        }
        
        const userData = userDoc.data();
        
        // Показываем простую форму редактирования
        showEditForm(userId, userData);
        
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        alert('Ошибка загрузки данных пользователя: ' + error.message);
    }
};

// Показать форму редактирования
function showEditForm(userId, userData) {
    // Создаем модальное окно
    const modalHTML = `
        <div id="editModal" style="
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(0,0,0,0.5); 
            z-index: 1000; 
            display: flex; 
            align-items: center; 
            justify-content: center;
        ">
            <div style="
                background: white; 
                padding: 20px; 
                border-radius: 10px; 
                width: 90%; 
                max-width: 600px; 
                max-height: 90vh; 
                overflow-y: auto;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;"><i class="fas fa-user-edit"></i> Редактирование пользователя</h3>
                    <button onclick="closeEditModal()" style="
                        background: none; 
                        border: none; 
                        font-size: 24px; 
                        cursor: pointer; 
                        color: #666;
                    ">&times;</button>
                </div>
                
                <form id="editUserForm">
                    <div id="editMessage" style="display: none; margin-bottom: 15px; padding: 10px; border-radius: 5px;"></div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <label>Фамилия *</label>
                            <input type="text" id="editLastName" class="form-control" value="${userData.lastName || ''}" required>
                        </div>
                        
                        <div>
                            <label>Имя *</label>
                            <input type="text" id="editFirstName" class="form-control" value="${userData.firstName || ''}" required>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label>Отчество</label>
                        <input type="text" id="editMiddleName" class="form-control" value="${userData.middleName || ''}">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <label>Дата рождения *</label>
                            <input type="date" id="editBirthDate" class="form-control" value="${userData.birthDate || ''}" required>
                        </div>
                        
                        <div>
                            <label>Место рождения *</label>
                            <input type="text" id="editBirthPlace" class="form-control" value="${userData.birthPlace || ''}" required>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <label>Личный код *</label>
                            <input type="text" id="editPersonalCode" class="form-control" 
                                   value="${userData.personalCode || ''}" 
                                   pattern="\\d{4}-\\d{4}"
                                   placeholder="XXXX-XXXX" required>
                            <small style="color: #666; font-size: 12px;">Формат: XXXX-XXXX</small>
                        </div>
                        
                        <div>
                            <label>Email *</label>
                            <input type="email" id="editEmail" class="form-control" value="${userData.email || ''}" required>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label>Телефон</label>
                        <input type="tel" id="editPhone" class="form-control" value="${userData.phone || ''}">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label>Статус</label>
                        <select id="editStatus" class="form-control">
                            <option value="active" ${userData.status === 'active' ? 'selected' : ''}>Активен</option>
                            <option value="inactive" ${userData.status === 'inactive' ? 'selected' : ''}>Неактивен</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label>Примечания</label>
                        <textarea id="editNotes" class="form-control" rows="3">${userData.notes || ''}</textarea>
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button type="button" onclick="closeEditModal()" class="btn btn-secondary">
                            <i class="fas fa-times"></i> Отмена
                        </button>
                        <button type="button" onclick="saveUserChanges('${userId}')" class="btn btn-primary">
                            <i class="fas fa-save"></i> Сохранить
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Удаляем существующее модальное окно
    const existingModal = document.getElementById('editModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Добавляем новое
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Закрыть модальное окно
window.closeEditModal = function() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.remove();
    }
};

// Сохранить изменения
window.saveUserChanges = async function(userId) {
    try {
        // Получаем элементы формы
        const lastName = document.getElementById('editLastName').value.trim();
        const firstName = document.getElementById('editFirstName').value.trim();
        const middleName = document.getElementById('editMiddleName').value.trim();
        const birthDate = document.getElementById('editBirthDate').value;
        const birthPlace = document.getElementById('editBirthPlace').value.trim();
        const personalCode = document.getElementById('editPersonalCode').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const status = document.getElementById('editStatus').value;
        const notes = document.getElementById('editNotes').value.trim();
        
        const messageDiv = document.getElementById('editMessage');
        
        // Валидация
        if (!lastName || !firstName || !birthDate || !birthPlace || !personalCode || !email) {
            showEditMessage('error', 'Заполните все обязательные поля');
            return;
        }
        
        // Проверка формата личного кода
        const personalCodeRegex = /^\d{4}-\d{4}$/;
        if (!personalCodeRegex.test(personalCode)) {
            showEditMessage('error', 'Неверный формат личного кода. Используйте формат: XXXX-XXXX');
            return;
        }
        
        // Подготавливаем данные для обновления
        const updateData = {
            lastName,
            firstName,
            middleName: middleName || null,
            birthDate,
            birthPlace,
            personalCode,
            email,
            phone: phone || null,
            status,
            notes: notes || null,
            lastUpdated: serverTimestamp(),
            updatedBy: auth.currentUser.email
        };
        
        // Обновляем в Firestore
        await updateDoc(doc(db, 'users', userId), updateData);
        
        // Логируем действие
        await addDoc(collection(db, 'admin_logs'), {
            action: 'user_updated',
            userId: userId,
            personalCode: personalCode,
            adminEmail: auth.currentUser.email,
            timestamp: serverTimestamp(),
            changes: Object.keys(updateData)
        });
        
        // Показываем успешное сообщение
        showEditMessage('success', 'Изменения успешно сохранены!');
        
        // Обновляем список пользователей через 2 секунды
        setTimeout(() => {
            closeEditModal();
            loadUsers();
        }, 2000);
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showEditMessage('error', 'Ошибка сохранения: ' + error.message);
    }
};

// Показать сообщение в форме редактирования
function showEditMessage(type, text) {
    const messageDiv = document.getElementById('editMessage');
    messageDiv.textContent = text;
    messageDiv.className = `alert alert-${type}`;
    messageDiv.style.display = 'block';
    
    // Прокручиваем к сообщению
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ==================== ОСТАЛЬНЫЕ ФУНКЦИИ ====================

// Проверяем, нужно ли открыть редактирование при загрузке
document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    
    // Поиск
    document.getElementById('searchInput')?.addEventListener('input', searchUsers);
    document.getElementById('statusFilter')?.addEventListener('change', searchUsers);
    
    // Кнопка обновления
    document.getElementById('refreshBtn')?.addEventListener('click', loadUsers);
    
    // Пагинация
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderUsers();
        }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
        if (currentPage < Math.ceil(filteredUsers.length / usersPerPage)) {
            currentPage++;
            renderUsers();
        }
    });
    
    // Экспорт
    document.getElementById('exportBtn')?.addEventListener('click', exportUsers);
});

// Поиск пользователей
function searchUsers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredUsers = allUsers.filter(user => {
        // Поиск по ФИО, личному коду и email
        const fullName = `${user.lastName} ${user.firstName} ${user.middleName || ''}`.toLowerCase();
        const matchesSearch = !searchTerm || 
            fullName.includes(searchTerm) ||
            (user.personalCode && user.personalCode.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm));
        
        // Фильтр по статусу
        const matchesStatus = !statusFilter || user.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    currentPage = 1;
    updateUserCount();
    renderUsers();
}

// Рендер пользователей
function renderUsers() {
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const pageUsers = filteredUsers.slice(startIndex, endIndex);
    
    const tbody = document.getElementById('usersTableBody');
    
    if (pageUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px;">
                    <i class="fas fa-user-slash"></i> Пользователи не найдены
                </td>
            </tr>
        `;
    } else {
        let html = '';
        
        pageUsers.forEach(user => {
            const fullName = `${user.lastName} ${user.firstName} ${user.middleName || ''}`.trim();
            const birthDate = user.birthDate ? new Date(user.birthDate).toLocaleDateString('ru-RU') : 'Не указана';
            const regDate = user.createdAt ? user.createdAt.toLocaleDateString('ru-RU') : 'Не указана';
            
            html += `
                <tr>
                    <td><strong>${fullName}</strong></td>
                    <td><code>${user.personalCode || 'Не указан'}</code></td>
                    <td>${user.email || 'Не указан'}</td>
                    <td>${birthDate}</td>
                    <td>${regDate}</td>
                    <td>
                        <span class="${user.status === 'active' ? 'status-active' : 'status-inactive'}">
                            ${user.status === 'active' ? 'Активен' : 'Неактивен'}
                        </span>
                    </td>
                    <td>${user.documentCount || 0}</td>
                    <td>
                        <div class="user-actions">
                            <button onclick="viewUserDetails('${user.id}')" class="btn btn-secondary btn-sm" title="Просмотр">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button onclick="editUser('${user.id}')" class="btn btn-primary btn-sm" title="Редактировать">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="addDocumentForUser('${user.id}', '${user.personalCode}')" class="btn btn-success btn-sm" title="Добавить документ">
                                <i class="fas fa-file-medical"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    updatePagination();
}

// Просмотр деталей пользователя
window.viewUserDetails = async function(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            alert('Пользователь не найден');
            return;
        }
        
        const user = userDoc.data();
        const fullName = `${user.lastName} ${user.firstName} ${user.middleName || ''}`.trim();
        const birthDate = user.birthDate ? new Date(user.birthDate).toLocaleDateString('ru-RU') : 'Не указана';
        const regDate = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('ru-RU') : 'Не указана';
        
        alert(`
            Детальная информация:
            
            ФИО: ${fullName}
            Личный код: ${user.personalCode}
            Email: ${user.email || 'Не указан'}
            Телефон: ${user.phone || 'Не указан'}
            Дата рождения: ${birthDate}
            Место рождения: ${user.birthPlace || 'Не указано'}
            Статус: ${user.status === 'active' ? 'Активен' : 'Неактивен'}
            Дата регистрации: ${regDate}
            Зарегистрировал: ${user.createdBy || 'Система'}
        `);
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        alert('Ошибка загрузки информации о пользователе');
    }
};

// Добавить документ для пользователя
window.addDocumentForUser = function(userId, personalCode) {
    sessionStorage.setItem('selectedPersonalCode', personalCode);
    window.location.href = 'add-document.html';
};

// Обновление статистики
function updateStatistics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayUsers = allUsers.filter(user => {
        const userDate = new Date(user.createdAt);
        userDate.setHours(0, 0, 0, 0);
        return userDate.getTime() === today.getTime();
    }).length;
    
    const activeUsers = allUsers.filter(user => user.status === 'active').length;
    
    document.getElementById('totalUsers').textContent = allUsers.length;
    document.getElementById('activeUsers').textContent = activeUsers;
    document.getElementById('todayUsers').textContent = todayUsers;
    updateUserCount();
}

// Обновление счетчика
function updateUserCount() {
    document.getElementById('userCount').textContent = `Найдено: ${filteredUsers.length} пользователей`;
}

// Обновление пагинации
function updatePagination() {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    
    document.getElementById('pageInfo').textContent = `Страница ${currentPage} из ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
}

// Экспорт пользователей
function exportUsers() {
    if (filteredUsers.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }
    
    // Заголовки CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Фамилия,Имя,Отчество,Личный код,Email,Телефон,Дата рождения,Статус\n";
    
    // Данные
    filteredUsers.forEach(user => {
        const row = [
            `"${user.lastName}"`,
            `"${user.firstName}"`,
            `"${user.middleName || ''}"`,
            `"${user.personalCode}"`,
            `"${user.email || ''}"`,
            `"${user.phone || ''}"`,
            `"${user.birthDate || ''}"`,
            `"${user.status}"`
        ].join(',');
        
        csvContent += row + "\n";
    });
    
    // Создание ссылки для скачивания
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `users_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`Экспортировано ${filteredUsers.length} пользователей`);
}

// Просмотр документов пользователя
window.viewUserDocuments = async function(userId, personalCode) {
    try {
        const docsQuery = query(
            collection(db, 'documents'),
            where('userId', '==', userId)
        );
        
        const querySnapshot = await getDocs(docsQuery);
        const documents = [];
        
        querySnapshot.forEach(doc => {
            documents.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        let html = `
            <div style="padding: 20px;">
                <h3 style="color: #0d47a1; margin-bottom: 20px;">
                    <i class="fas fa-files"></i> Документы пользователя
                </h3>
                <div style="color: #666; margin-bottom: 20px;">
                    Личный код: <strong>${personalCode}</strong>
                </div>
        `;
        
        if (documents.length === 0) {
            html += `
                <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px;">
                    <i class="fas fa-folder-open fa-3x" style="color: #6c757d; margin-bottom: 20px;"></i>
                    <p style="color: #6c757d; font-size: 18px;">Документов не найдено</p>
                </div>
            `;
        } else {
            html += '<div style="display: grid; gap: 15px;">';
            
            documents.forEach(doc => {
                const docTypeNames = {
                    'passport': 'Паспорт',
                    'foreign_passport': 'Загранпаспорт',
                    'inn': 'ИНН',
                    'nss': 'НСС',
                    'driver_license': 'Водительские права'
                };
                
                const docName = docTypeNames[doc.documentType] || doc.documentType;
                const createDate = doc.createdAt?.toDate ? doc.createdAt.toDate().toLocaleDateString('ru-RU') : 'Не указано';
                const statusColor = doc.status === 'active' ? '#28a745' : doc.status === 'inactive' ? '#dc3545' : '#6c757d';
                const statusText = doc.status === 'active' ? 'Активен' : doc.status === 'inactive' ? 'Деактивирован' : doc.status;
                
                html += `
                    <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #ddd; border-left: 4px solid ${statusColor};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin: 0 0 5px 0; font-size: 16px;">
                                    ${docName}
                                    <span style="font-size: 12px; padding: 2px 8px; border-radius: 12px; background: ${statusColor}; color: white; margin-left: 10px;">
                                        ${statusText}
                                    </span>
                                    ${doc.blacklisted ? '<span style="font-size: 11px; background: #000; color: white; padding: 2px 6px; border-radius: 10px; margin-left: 5px;">Черный список</span>' : ''}
                                </h4>
                                <div style="font-size: 12px; color: #666;">
                                    <span>Добавлен: ${createDate}</span>
                                    ${doc.data?.seriesNumber ? ` | Серия/номер: ${doc.data.seriesNumber}` : ''}
                                    ${doc.data?.documentNumber ? ` | Номер: ${doc.data.documentNumber}` : ''}
                                </div>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button onclick="editDocumentFromUsersPage('${doc.id}')" class="btn btn-primary btn-sm">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="viewDocumentFromUsersPage('${doc.id}')" class="btn btn-secondary btn-sm">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
        }
        
        html += '</div>';
        
        // Показываем в модальном окне
        const modalHtml = `
            <div id="documentsModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; width: 90%; max-width: 800px; max-height: 80vh; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
                    <div style="background: var(--primary-color); color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0;">Документы пользователя</h4>
                        <button onclick="closeDocumentsModal()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">&times;</button>
                    </div>
                    <div style="padding: 20px; max-height: calc(80vh - 60px); overflow-y: auto;">
                        ${html}
                    </div>
                </div>
            </div>
        `;
        
        // Удаляем существующий модальный окно
        const existingModal = document.getElementById('documentsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
    } catch (error) {
        console.error('Ошибка загрузки документов:', error);
        alert('Ошибка загрузки документов: ' + error.message);
    }
};

window.closeDocumentsModal = function() {
    const modal = document.getElementById('documentsModal');
    if (modal) {
        modal.remove();
    }
};

window.editDocumentFromUsersPage = function(documentId) {
    sessionStorage.setItem('editDocumentId', documentId);
    window.location.href = 'add-document.html';
};

window.viewDocumentFromUsersPage = function(documentId) {
    viewDocumentDetails(documentId);
};