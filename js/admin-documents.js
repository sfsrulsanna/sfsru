// Субтипы документов
const documentSubtypes = {
    'Свидетельство': [
        'о браке',
        'о рождении', 
        'о разводе',
        'о перемене имени',
        'об усыновлении (удочерении)',
        'о смерти'
    ],
    'Образование': [
        'Аттестат о дошкольном образовании',
        'Аттестат о начальном образовании',
        'Об основном общем образовании',
        'О среднем общем образовании',
        'Диплом о среднем профессиональном образовании',
        'Диплом о базовом высшем образовании',
        'Диплом о Специализированном высшем образовании',
        'Диплом о профессиональном высшем образовании',
        'Докторская степень'
    ],
    'Экзамены': ['ОГЭ', 'ЕГЭ', 'ГВЭ']
};

// Проверка существования пользователя
document.getElementById('docPersonalCode').addEventListener('blur', function() {
    const personalCode = this.value.trim();
    if (!personalCode.match(/^\d{4}-\d{4}$/)) {
        return;
    }
    
    checkUserExists(personalCode);
});

function checkUserExists(personalCode) {
    db.collection('users').doc(personalCode).get()
        .then(doc => {
            const userInfo = document.getElementById('userInfo');
            if (doc.exists) {
                const user = doc.data();
                document.getElementById('userName').textContent = 
                    `${user.lastName} ${user.firstName} ${user.middleName || ''}`;
                document.getElementById('userBirthDate').textContent = 
                    `Дата рождения: ${user.birthDate}`;
                userInfo.style.display = 'block';
            } else {
                userInfo.style.display = 'none';
                showToast('Пользователь с таким личным кодом не найден', 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка проверки пользователя:', error);
        });
}

// Изменение типа документа
function onDocumentTypeChange() {
    const type = document.getElementById('documentType').value;
    const subtypeGroup = document.getElementById('subtypeGroup');
    const latinNameGroup = document.getElementById('latinNameGroup');
    const detailsGroup = document.getElementById('detailsGroup');
    
    // Обработка подтипов
    const subtypeSelect = document.getElementById('documentSubtype');
    subtypeSelect.innerHTML = '<option value="">Выберите подтип</option>';
    
    if (documentSubtypes[type]) {
        documentSubtypes[type].forEach(subtype => {
            const option = document.createElement('option');
            option.value = subtype;
            option.textContent = subtype;
            subtypeSelect.appendChild(option);
        });
        subtypeGroup.style.display = 'flex';
    } else {
        subtypeGroup.style.display = 'none';
    }
    
    // Показать латинские имена для загранпаспорта
    if (type === 'Загранпаспорт') {
        latinNameGroup.style.display = 'flex';
    } else {
        latinNameGroup.style.display = 'none';
    }
    
    // Показать дополнительные сведения для докторской степени и экзаменов
    if (type === 'Образование' || type === 'Экзамены') {
        detailsGroup.style.display = 'block';
    } else {
        detailsGroup.style.display = 'none';
    }
}

// Обработка формы добавления документа
document.getElementById('addDocumentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!firebase.auth().currentUser) {
        showToast('Требуется авторизация', 'error');
        return;
    }
    
    const formData = new FormData(this);
    const personalCode = document.getElementById('docPersonalCode').value;
    
    // Проверяем существование пользователя
    const userDoc = await db.collection('users').doc(personalCode).get();
    if (!userDoc.exists) {
        showToast('Пользователь с таким личным кодом не найден', 'error');
        return;
    }
    
    const userData = userDoc.data();
    
    // Собираем данные документа
    const documentData = {
        id: generateDocumentId(),
        personalCode: personalCode,
        type: document.getElementById('documentType').value,
        subtype: document.getElementById('documentSubtype').value || '',
        details: document.getElementById('documentDetails').value || '',
        lastName: userData.lastName,
        firstName: userData.firstName,
        middleName: userData.middleName || '',
        latinLastName: document.getElementById('latinLastName').value || '',
        latinFirstName: document.getElementById('latinFirstName').value || '',
        latinMiddleName: document.getElementById('latinMiddleName').value || '',
        birthDate: userData.birthDate,
        issueDate: document.getElementById('issueDate').value,
        expiryDate: document.getElementById('expiryDate').value || '',
        seriesNumber: document.getElementById('documentNumber').value,
        issuedBy: document.getElementById('issuedBy').value,
        status: calculateDocumentStatus(document.getElementById('expiryDate').value),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: firebase.auth().currentUser.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Сохранение в Firestore
    try {
        await db.collection('documents').doc(documentData.id).set(documentData);
        
        // Обновление счетчика документов у пользователя
        await db.collection('users').doc(personalCode).update({
            documentCount: firebase.firestore.FieldValue.increment(1),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Документ успешно добавлен!', 'success');
        resetDocumentForm();
        updateDashboardStats();
    } catch (error) {
        console.error('Ошибка добавления документа:', error);
        showToast('Ошибка добавления документа: ' + error.message, 'error');
    }
});

function generateDocumentId() {
    // Генерация 8-значного ID
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function calculateDocumentStatus(expiryDate) {
    if (!expiryDate) return 'Бессрочный';
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    
    if (expiry < today) {
        return 'Недействителен';
    } else if ((expiry - today) / (1000 * 60 * 60 * 24) <= 30) {
        return 'Истекает';
    } else {
        return 'Действителен';
    }
}

function resetDocumentForm() {
    document.getElementById('addDocumentForm').reset();
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('subtypeGroup').style.display = 'none';
    document.getElementById('latinNameGroup').style.display = 'none';
    document.getElementById('detailsGroup').style.display = 'none';
}

function showToast(message, type = 'info') {
    // Реализация toast-уведомлений
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}