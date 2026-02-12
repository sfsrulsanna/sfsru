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
    deleteDoc,
    getDoc
} from './firebase-config.js';

// Глобальные переменные
let foundUser = null;
let existingDocuments = [];
let currentDocumentId = null;
let generatedCodes = {};

// Показываем email админа
auth.onAuthStateChanged((user) => {
    if (user && user.email === 'sfsru@admin.su') {
        const emailElement = document.getElementById('userEmail') || document.getElementById('adminEmail');
        if (emailElement) {
            emailElement.textContent = user.email;
        }
    }
});

// Кнопка выхода
document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await auth.signOut();
    window.location.href = 'index.html';
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Автозаполнение личного кода
    const personalCodeInput = document.getElementById('personalCode');
    if (personalCodeInput) {
        const savedCode = sessionStorage.getItem('selectedPersonalCode');
        if (savedCode) {
            personalCodeInput.value = savedCode;
            setTimeout(() => {
                searchUser();
            }, 100);
            sessionStorage.removeItem('selectedPersonalCode');
        }
        
        // Поиск при нажатии Enter
        personalCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchUser();
            }
        });
    }
    
    // Кнопка поиска
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchUser);
    }
    
    // Изменение типа документа
    const docTypeSelect = document.getElementById('documentType');
    if (docTypeSelect) {
        docTypeSelect.addEventListener('change', function() {
            showDocumentForm(this.value);
        });
    }
    
    // Кнопка сохранения документа
    const saveBtn = document.getElementById('saveDocumentBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveDocument);
    }
    
    // Кнопки быстрого доступа
    document.querySelectorAll('[data-doc-type]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const docType = this.getAttribute('data-doc-type');
            document.getElementById('documentType').value = docType;
            document.getElementById('documentType').dispatchEvent(new Event('change'));
            document.getElementById('documentCard').scrollIntoView({ behavior: 'smooth' });
        });
    });
});

// ПОИСК ПОЛЬЗОВАТЕЛЯ
async function searchUser() {
    const personalCode = document.getElementById('personalCode').value.trim();
    const messageDiv = document.getElementById('formMessage');
    const userInfoDiv = document.getElementById('userInfo');
    const searchBtn = document.getElementById('searchBtn');
    const documentCard = document.getElementById('documentCard');
    const existingDocsDiv = document.getElementById('existingDocuments');
    
    // Очищаем предыдущие сообщения
    messageDiv.style.display = 'none';
    userInfoDiv.style.display = 'none';
    existingDocsDiv.style.display = 'none';
    if (documentCard) documentCard.style.display = 'none';
    currentDocumentId = null;
    generatedCodes = {};
    
    if (!personalCode) {
        showMessage('error', 'Введите личный код пользователя');
        return;
    }
    
    try {
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Поиск...';
        searchBtn.disabled = true;
        
        // Ищем пользователя по личному коду
        const usersQuery = query(
            collection(db, 'users'),
            where('personalCode', '==', personalCode)
        );
        
        const querySnapshot = await getDocs(usersQuery);
        
        if (querySnapshot.empty) {
            showMessage('error', `❌ Пользователь с личным кодом <strong>${personalCode}</strong> не найден`);
            foundUser = null;
        } else {
            const userDoc = querySnapshot.docs[0];
            foundUser = {
                id: userDoc.id,
                ...userDoc.data()
            };
            
            // Показываем информацию о пользователе
            displayUserInfo(foundUser);
            userInfoDiv.style.display = 'block';
            if (documentCard) documentCard.style.display = 'block';
            
            // Загружаем существующие документы пользователя
            await loadExistingDocuments(foundUser.id);
            
            showMessage('success', `✅ Пользователь найден: <strong>${foundUser.lastName} ${foundUser.firstName}</strong>`);
            
            // Сбрасываем выбор типа документа
            const docTypeSelect = document.getElementById('documentType');
            if (docTypeSelect) {
                docTypeSelect.value = '';
                docTypeSelect.dispatchEvent(new Event('change'));
            }
        }
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
        showMessage('error', `Ошибка при поиске пользователя: ${error.message}`);
    } finally {
        searchBtn.innerHTML = '<i class="fas fa-search"></i> Найти';
        searchBtn.disabled = false;
    }
}

// Загрузка существующих документов пользователя
async function loadExistingDocuments(userId) {
    try {
        const docsQuery = query(
            collection(db, 'documents'),
            where('userId', '==', userId)
        );
        
        const querySnapshot = await getDocs(docsQuery);
        existingDocuments = [];
        querySnapshot.forEach(doc => {
            existingDocuments.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        displayExistingDocuments();
        
    } catch (error) {
        console.error('Ошибка загрузки документов:', error);
    }
}

// Отображение существующих документов
function displayExistingDocuments() {
    const existingDocsDiv = document.getElementById('existingDocuments');
    
    if (existingDocuments.length === 0) {
        existingDocsDiv.style.display = 'none';
        return;
    }
    
    let html = `
        <h4><i class="fas fa-files"></i> Существующие документы (${existingDocuments.length})</h4>
        <div style="margin-top: 15px;">
    `;
    
    existingDocuments.forEach(doc => {
        const docTypeNames = {
            'passport': 'Паспорт',
            'foreign_passport': 'Загранпаспорт',
            'inn': 'ИНН',
            'nss': 'ИСС',
            'driver_license': 'Водительские права',
            'birth_certificate': 'Свидетельство о рождении'
        };
        
        const docName = docTypeNames[doc.documentType] || doc.documentType;
        const createDate = doc.createdAt?.toDate ? doc.createdAt.toDate().toLocaleDateString('ru-RU') : 'Не указано';
        const statusColor = doc.status === 'active' ? '#28a745' : doc.status === 'inactive' ? '#dc3545' : '#6c757d';
        const statusText = doc.status === 'active' ? 'Активен' : doc.status === 'inactive' ? 'Деактивирован' : doc.status;
        
        html += `
            <div style="background: white; padding: 15px; margin-bottom: 15px; border-radius: 5px; border: 1px solid #ddd; border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <strong style="font-size: 16px;">${docName}</strong>
                            <span style="font-size: 12px; padding: 2px 8px; border-radius: 12px; background: ${statusColor}; color: white;">
                                ${statusText}
                            </span>
                            ${doc.blacklisted ? '<span style="font-size: 12px; background: #000; color: white; padding: 2px 8px; border-radius: 12px;">Черный список</span>' : ''}
                        </div>
                        <div style="font-size: 12px; color: #666; margin-top: 8px;">
                            <span>Добавлен: ${createDate}</span>
                            ${doc.data?.seriesNumber ? ` | <span>Серия/номер: ${doc.data.seriesNumber}</span>` : ''}
                            ${doc.data?.documentNumber ? ` | <span>Номер: ${doc.data.documentNumber}</span>` : ''}
                            ${doc.data?.issueDate ? ` | <span>Выдан: ${new Date(doc.data.issueDate).toLocaleDateString('ru-RU')}</span>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap;">
                        <button onclick="editExistingDocument('${doc.id}', '${doc.documentType}')" class="btn btn-primary btn-sm" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="viewDocumentDetails('${doc.id}')" class="btn btn-secondary btn-sm" title="Просмотр">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="deactivateDocument('${doc.id}')" class="btn btn-warning btn-sm" title="Деактивировать" ${doc.status === 'inactive' ? 'disabled' : ''}>
                            <i class="fas fa-ban"></i>
                        </button>
                        <button onclick="deleteDocument('${doc.id}')" class="btn btn-danger btn-sm" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    existingDocsDiv.innerHTML = html;
    existingDocsDiv.style.display = 'block';
}

// Проверка существования документа определенного типа
function checkDocumentExists(documentType) {
    return existingDocuments.some(doc => 
        doc.documentType === documentType && doc.status === 'active'
    );
}

// Редактирование существующего документа
window.editExistingDocument = async function(documentId, documentType) {
    try {
        const docRef = doc(db, 'documents', documentId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            alert('Документ не найден');
            return;
        }
        
        const documentData = docSnap.data();
        currentDocumentId = documentId;
        
        // Заполняем форму данными документа
        const docTypeSelect = document.getElementById('documentType');
        docTypeSelect.value = documentType;
        docTypeSelect.dispatchEvent(new Event('change'));
        
        // Ждем немного для отрисовки формы, затем заполняем поля
        setTimeout(() => {
            fillDocumentForm(documentData);
            showMessage('info', 'Режим редактирования документа');
        }, 100);
        
    } catch (error) {
        console.error('Ошибка загрузки документа:', error);
        alert('Ошибка загрузки документа: ' + error.message);
    }
};

// Заполнение формы данными документа
function fillDocumentForm(docData) {
    // Заполняем основные поля
    const inputs = document.querySelectorAll('#documentFormContainer input[name], #documentFormContainer select[name], #documentFormContainer textarea[name]');
    
    inputs.forEach(input => {
        if (input.name && docData.data && docData.data[input.name]) {
            if (input.type === 'date') {
                const date = new Date(docData.data[input.name]);
                input.value = date.toISOString().split('T')[0];
            } else {
                input.value = docData.data[input.name];
            }
        }
    });
    
    // Обновляем текст кнопки сохранения
    const saveBtn = document.getElementById('saveDocumentBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
        saveBtn.onclick = updateDocument;
    }
}

// Деактивация документа
window.deactivateDocument = async function(documentId) {
    if (!confirm('Вы уверены, что хотите деактивировать этот документ? Документ будет добавлен в черный список.')) {
        return;
    }
    
    const reason = prompt('Укажите причину деактивации:', 'Просрочен / Утерян');
    if (reason === null) return;
    
    try {
        const docRef = doc(db, 'documents', documentId);
        await updateDoc(docRef, {
            status: 'inactive',
            blacklisted: true,
            deactivationReason: reason,
            deactivatedAt: serverTimestamp(),
            deactivatedBy: auth.currentUser.email
        });
        
        // Логируем действие
        await addDoc(collection(db, 'admin_logs'), {
            action: 'document_deactivated',
            documentId: documentId,
            reason: reason,
            adminEmail: auth.currentUser.email,
            timestamp: serverTimestamp()
        });
        
        alert('✅ Документ успешно деактивирован и добавлен в черный список');
        
        // Обновляем список документов
        if (foundUser) {
            await loadExistingDocuments(foundUser.id);
        }
        
    } catch (error) {
        console.error('Ошибка деактивации:', error);
        alert('❌ Ошибка деактивации: ' + error.message);
    }
};

// Удаление документа
window.deleteDocument = async function(documentId) {
    if (!confirm('⚠️ ВНИМАНИЕ: Вы уверены, что хотите полностью удалить этот документ?\n\nЭта операция необратима. Все данные будут удалены навсегда.')) {
        return;
    }
    
    const reason = prompt('Укажите причину удаления (для логов):', 'Ошибка ввода данных');
    if (reason === null) return;
    
    try {
        const docRef = doc(db, 'documents', documentId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const docData = docSnap.data();
            
            // Удаляем сам документ
            await deleteDoc(docRef);
            
            // Логируем действие
            await addDoc(collection(db, 'admin_logs'), {
                action: 'document_deleted',
                documentId: documentId,
                documentType: docData.documentType,
                personalCode: docData.personalCode,
                reason: reason,
                adminEmail: auth.currentUser.email,
                timestamp: serverTimestamp()
            });
            
            alert('✅ Документ полностью удален');
            
            // Обновляем список документов
            if (foundUser) {
                await loadExistingDocuments(foundUser.id);
            }
        }
        
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('❌ Ошибка удаления: ' + error.message);
    }
};

// Просмотр деталей документа
window.viewDocumentDetails = async function(documentId) {
    try {
        const docRef = doc(db, 'documents', documentId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            alert('Документ не найден');
            return;
        }
        
        const docData = docSnap.data();
        const docTypeNames = {
            'passport': 'Паспорт',
            'foreign_passport': 'Загранпаспорт',
            'inn': 'ИНН',
            'nss': 'ИСС',
            'driver_license': 'Водительские права'
        };
        
        let detailsHtml = `
            <div style="padding: 20px;">
                <h3 style="color: #0d47a1; margin-bottom: 20px;">
                    <i class="fas fa-file-alt"></i> ${docTypeNames[docData.documentType] || docData.documentType}
                </h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                    <h4><i class="fas fa-info-circle"></i> Основная информация</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                        <div><strong>Статус:</strong> ${docData.status}</div>
                        <div><strong>Личный код:</strong> ${docData.personalCode}</div>
                        <div><strong>Создан:</strong> ${docData.createdAt?.toDate ? docData.createdAt.toDate().toLocaleString('ru-RU') : 'Не указано'}</div>
                        <div><strong>Создал:</strong> ${docData.createdBy}</div>
                    </div>
                </div>
        `;
        
        // Отображаем данные документа
        if (docData.data) {
            detailsHtml += `
                <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                    <h4><i class="fas fa-database"></i> Данные документа</h4>
                    <pre style="background: white; padding: 10px; border-radius: 5px; max-height: 300px; overflow: auto;">${JSON.stringify(docData.data, null, 2)}</pre>
                </div>
            `;
        }
        
        // Отображаем фотографии
        if (docData.files && Object.keys(docData.files).length > 0) {
            detailsHtml += `
                <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                    <h4><i class="fas fa-images"></i> Загруженные файлы</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 10px;">
            `;
            
            Object.entries(docData.files).forEach(([key, fileData]) => {
                if (fileData.url) {
                    detailsHtml += `
                        <div style="text-align: center;">
                            <img src="${fileData.url}" alt="${key}" style="max-width: 100%; max-height: 150px; border: 1px solid #ddd;">
                            <div style="font-size: 12px; margin-top: 5px;">${key}</div>
                        </div>
                    `;
                }
            });
            
            detailsHtml += `</div></div>`;
        }
        
        detailsHtml += `</div>`;
        
        // Показываем в модальном окне
        showModal('Просмотр документа', detailsHtml);
        
    } catch (error) {
        console.error('Ошибка загрузки документа:', error);
        alert('Ошибка загрузки документа: ' + error.message);
    }
};

// Обновление документа
async function updateDocument() {
    if (!foundUser || !currentDocumentId) {
        showMessage('error', 'Ошибка: не найден документ для обновления');
        return;
    }
    
    const documentType = document.getElementById('documentType').value;
    if (!documentType) {
        showMessage('error', 'Выберите тип документа');
        return;
    }
    
    const saveBtn = document.getElementById('saveDocumentBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        saveBtn.disabled = true;
        
        // Собираем данные из формы
        const formData = collectFormData();
        
        // Обновляем документ
        const docRef = doc(db, 'documents', currentDocumentId);
        await updateDoc(docRef, {
            data: formData,
            lastUpdated: serverTimestamp(),
            updatedBy: auth.currentUser.email
        });
        
        // Логируем действие
        await addDoc(collection(db, 'admin_logs'), {
            action: 'document_updated',
            documentId: currentDocumentId,
            documentType: documentType,
            personalCode: foundUser.personalCode,
            adminEmail: auth.currentUser.email,
            timestamp: serverTimestamp()
        });
        
        showMessage('success', `
            <div style="background: #d4edda; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
                <h4 style="color: #155724; margin: 0 0 10px 0;">
                    <i class="fas fa-check-circle"></i> Документ успешно обновлен!
                </h4>
                <p>Создана новая версия документа.</p>
            </div>
        `);
        
        // Сбрасываем режим редактирования
        setTimeout(() => {
            currentDocumentId = null;
            document.getElementById('documentType').value = '';
            document.getElementById('documentType').dispatchEvent(new Event('change'));
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
            saveBtn.onclick = saveDocument;
            
            // Обновляем список документов
            if (foundUser) {
                loadExistingDocuments(foundUser.id);
            }
        }, 2000);
        
    } catch (error) {
        console.error('Ошибка обновления:', error);
        showMessage('error', `Ошибка обновления документа: ${error.message}`);
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// Отображение информации о пользователе
function displayUserInfo(user) {
    const userInfoDiv = document.getElementById('userInfo');
    
    const fullName = `${user.lastName} ${user.firstName} ${user.middleName || ''}`.trim();
    const birthDate = user.birthDate ? new Date(user.birthDate).toLocaleDateString('ru-RU') : 'Не указана';
    
    userInfoDiv.innerHTML = `
        <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196F3;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #0d47a1;">
                        <i class="fas fa-user-check"></i> Найден пользователь
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                        <div>
                            <strong>ФИО:</strong><br>
                            ${fullName}
                        </div>
                        <div>
                            <strong>Личный код:</strong><br>
                            <code style="background: #fff; padding: 2px 5px; border-radius: 3px;">${user.personalCode}</code>
                        </div>
                        <div>
                            <strong>Дата рождения:</strong><br>
                            ${birthDate}
                        </div>
                        <div>
                            <strong>Email:</strong><br>
                            ${user.email || 'Не указан'}
                        </div>
                        <div>
                            <strong>Место рождения:</strong><br>
                            ${user.birthPlace || 'Не указано'}
                        </div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <button onclick="editUserFromDocPage('${user.id}')" class="btn btn-primary btn-sm">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button onclick="viewUserDetails('${user.id}')" class="btn btn-secondary btn-sm">
                        <i class="fas fa-eye"></i> Подробнее
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Показать форму документа
function showDocumentForm(type) {
    const formContainer = document.getElementById('documentFormContainer');
    const saveBtn = document.getElementById('saveDocumentBtn');
    
    if (!foundUser) {
        formContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-exclamation-circle fa-3x" style="margin-bottom: 20px; color: #ff9800;"></i>
                <p>Сначала найдите пользователя по личному коду</p>
            </div>
        `;
        if (saveBtn) saveBtn.disabled = true;
        return;
    }
    
    if (!type) {
        formContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-file-alt fa-3x" style="margin-bottom: 20px;"></i>
                <p>Выберите тип документа для отображения формы</p>
            </div>
        `;
        if (saveBtn) saveBtn.disabled = true;
        return;
    }
    
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить документ';
        saveBtn.onclick = saveDocument;
    }
    
    // Проверяем наличие активного документа этого типа
    const hasActiveDoc = checkDocumentExists(type);
    
    // Получаем соответствующую форму
    const formHTML = getDocumentForm(type, hasActiveDoc);
    formContainer.innerHTML = formHTML;
}

// Получение формы документа
function getDocumentForm(type, hasExisting = false) {
    const fullName = `${foundUser.lastName} ${foundUser.firstName} ${foundUser.middleName || ''}`.trim();
    const birthDate = foundUser.birthDate || '';
    const birthPlace = foundUser.birthPlace || '';
    
    switch(type) {
        case 'passport':
            return getPassportForm(fullName, birthDate, birthPlace, hasExisting);
        case 'foreign_passport':
            return getForeignPassportForm(fullName, birthDate, birthPlace, hasExisting);
        case 'inn':
            return getINNForm(fullName, birthDate, birthPlace, hasExisting);
        default:
            return getGenericForm(type, fullName, hasExisting);
    }
}

// Форма паспорта (упрощенная версия)
function getPassportForm(fullName, birthDate, birthPlace, hasExisting = false) {
    return `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            ${currentDocumentId ? `
                <div style="background: #cce5ff; color: #004085; padding: 10px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #007bff;">
                    <i class="fas fa-edit"></i> Режим редактирования документа
                </div>
            ` : hasExisting ? `
                <div style="background: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #ffc107;">
                    <i class="fas fa-exclamation-triangle"></i> У пользователя уже есть активный паспорт
                </div>
            ` : ''}
            
            <h4><i class="fas fa-passport"></i> Паспорт гражданина</h4>
            
            <div class="form-section">
                <h5><i class="fas fa-user"></i> Основные данные</h5>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 15px 0;">
                    <div class="form-group">
                        <label>Серия и номер *</label>
                        <input type="text" name="seriesNumber" class="form-control" placeholder="12 34 567890" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Дата выдачи *</label>
                        <input type="date" name="issueDate" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Кем выдан *</label>
                        <input type="text" name="issuedBy" class="form-control" placeholder="ОУФМС России" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Код подразделения</label>
                        <input type="text" name="departmentCode" class="form-control" placeholder="123-456">
                    </div>
                </div>
            </div>
            
            <div class="form-section">
                <h5><i class="fas fa-images"></i> Фотография документа</h5>
                <div class="file-upload" onclick="document.getElementById('passportPhoto').click()" style="border: 2px dashed #ccc; padding: 20px; text-align: center; cursor: pointer; border-radius: 8px;">
                    <i class="fas fa-camera fa-2x" style="color: #666;"></i>
                    <p style="margin: 10px 0;">Нажмите для загрузки фотографии документа</p>
                    <input type="file" id="passportPhoto" accept="image/*" style="display: none;">
                    <small style="color: #666;">Формат: JPG, PNG (макс. 32 MB)</small>
                </div>
                <div id="photoPreview" style="margin-top: 10px; display: none;">
                    <img id="photoPreviewImg" src="" style="max-width: 100%; max-height: 150px; border: 1px solid #ddd;">
                </div>
            </div>
        </div>
    `;
}

// Упрощенные формы для других типов документов
function getForeignPassportForm(fullName, birthDate, birthPlace, hasExisting = false) {
    return `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h4><i class="fas fa-globe"></i> Загранпаспорт</h4>
            
            <div class="form-section">
                <h5><i class="fas fa-globe"></i> Данные загранпаспорта</h5>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 15px 0;">
                    <div class="form-group">
                        <label>Номер *</label>
                        <input type="text" name="documentNumber" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Дата выдачи *</label>
                        <input type="date" name="issueDate" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Срок действия *</label>
                        <input type="date" name="expiryDate" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Кем выдан *</label>
                        <input type="text" name="issuedBy" class="form-control" required>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getINNForm(fullName, birthDate, birthPlace, hasExisting = false) {
    return `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h4><i class="fas fa-id-card"></i> ИНН</h4>
            
            <div class="form-section">
                <h5><i class="fas fa-hashtag"></i> Данные ИНН</h5>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 15px 0;">
                    <div class="form-group">
                        <label>Номер ИНН *</label>
                        <input type="text" name="innNumber" class="form-control" placeholder="12-значный номер" pattern="[0-9]{12}" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Дата выдачи *</label>
                        <input type="date" name="issueDate" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Кем выдан *</label>
                        <input type="text" name="issuedBy" class="form-control" placeholder="Налоговая инспекция" required>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getGenericForm(type, fullName, hasExisting = false) {
    return `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h4><i class="fas fa-file-alt"></i> ${type.toUpperCase()}</h4>
            
            <div class="form-section">
                <h5><i class="fas fa-info-circle"></i> Основные данные</h5>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 15px 0;">
                    <div class="form-group">
                        <label>Номер документа *</label>
                        <input type="text" name="documentNumber" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Дата выдачи *</label>
                        <input type="date" name="issueDate" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Кем выдан *</label>
                        <input type="text" name="issuedBy" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Срок действия</label>
                        <input type="date" name="expiryDate" class="form-control">
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Сбор данных из формы
function collectFormData() {
    const formData = {};
    const inputs = document.querySelectorAll('#documentFormContainer input[name], #documentFormContainer select[name], #documentFormContainer textarea[name]');
    
    inputs.forEach(input => {
        if (input.name && input.value) {
            formData[input.name] = input.value;
        }
    });
    
    return formData;
}

// Сохранение документа (упрощенная версия)
async function saveDocument() {
    if (!foundUser) {
        showMessage('error', 'Сначала найдите пользователя');
        return;
    }
    
    const documentType = document.getElementById('documentType').value;
    if (!documentType) {
        showMessage('error', 'Выберите тип документа');
        return;
    }
    
    const saveBtn = document.getElementById('saveDocumentBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        saveBtn.disabled = true;
        
        // Собираем данные из формы
        const formData = collectFormData();
        
        // Основные данные документа
        const documentData = {
            personalCode: foundUser.personalCode,
            documentType: documentType,
            userId: foundUser.id,
            userData: {
                lastName: foundUser.lastName,
                firstName: foundUser.firstName,
                middleName: foundUser.middleName,
                birthDate: foundUser.birthDate,
                birthPlace: foundUser.birthPlace
            },
            data: formData,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.email,
            status: 'active',
            blacklisted: false,
            lastUpdated: serverTimestamp()
        };
        
        // Сохраняем в Firestore
        const docRef = await addDoc(collection(db, 'documents'), documentData);
        
        // Логируем действие
        await addDoc(collection(db, 'admin_logs'), {
            action: 'document_added',
            documentType: documentType,
            personalCode: foundUser.personalCode,
            userId: foundUser.id,
            adminEmail: auth.currentUser.email,
            timestamp: serverTimestamp(),
            documentId: docRef.id
        });
        
        showMessage('success', `
            <div style="background: #d4edda; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
                <h4 style="color: #155724; margin: 0 0 10px 0;">
                    <i class="fas fa-check-circle"></i> Документ успешно сохранен!
                </h4>
                <p><strong>Тип:</strong> ${getDocumentTypeName(documentType)}</p>
                <p><strong>Пользователь:</strong> ${foundUser.lastName} ${foundUser.firstName}</p>
                <p><strong>Личный код:</strong> ${foundUser.personalCode}</p>
            </div>
        `);
        
        // Обновляем список документов
        await loadExistingDocuments(foundUser.id);
        
        // Очищаем форму через 3 секунды
        setTimeout(() => {
            document.getElementById('documentFormContainer').innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-check-circle fa-3x" style="color: #28a745; margin-bottom: 20px;"></i>
                    <p>Документ успешно сохранен. Вы можете добавить еще один документ.</p>
                </div>
            `;
            document.getElementById('documentType').value = '';
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = true;
        }, 3000);
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showMessage('error', `
            <div style="background: #f8d7da; padding: 15px; border-radius: 5px;">
                <h4 style="color: #721c24; margin: 0 0 10px 0;">
                    <i class="fas fa-exclamation-triangle"></i> Ошибка сохранения!
                </h4>
                <p>${error.message}</p>
            </div>
        `);
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// Вспомогательные функции
function showMessage(type, html) {
    const messageDiv = document.getElementById('formMessage');
    messageDiv.className = `alert alert-${type}`;
    messageDiv.innerHTML = html;
    messageDiv.style.display = 'block';
    
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function getDocumentTypeName(type) {
    const types = {
        'passport': 'Паспорт',
        'foreign_passport': 'Загранпаспорт',
        'inn': 'ИНН',
        'nss': 'ИСС',
        'driver_license': 'Водительское удостоверение'
    };
    return types[type] || type;
}

function showModal(title, content) {
    const modalHtml = `
        <div id="documentModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; width: 90%; max-width: 800px; max-height: 90vh; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
                <div style="background: var(--primary-color); color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0;">${title}</h4>
                    <button onclick="closeModal()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                <div style="padding: 20px; max-height: calc(90vh - 60px); overflow-y: auto;">
                    ${content}
                </div>
                <div style="padding: 15px 20px; background: #f8f9fa; text-align: right; border-top: 1px solid #ddd;">
                    <button onclick="closeModal()" class="btn btn-secondary">Закрыть</button>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('documentModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.closeModal = function() {
    const modal = document.getElementById('documentModal');
    if (modal) {
        modal.remove();
    }
};

window.editUserFromDocPage = function(userId) {
    sessionStorage.setItem('editUserId', userId);
    window.location.href = 'view-users.html';
};

window.viewUserDetails = function(userId) {
    alert(`Просмотр пользователя ID: ${userId}`);
};

// Превью загруженной фотографии
document.addEventListener('change', function(e) {
    if (e.target.id === 'passportPhoto' && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const previewDiv = document.getElementById('photoPreview');
            const previewImg = document.getElementById('photoPreviewImg');
            
            previewImg.src = e.target.result;
            previewDiv.style.display = 'block';
        };
        
        reader.readAsDataURL(file);
    }
});