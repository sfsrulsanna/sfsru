document.addEventListener('DOMContentLoaded', function () {
  // Защита: только админ
  firebase.auth().onAuthStateChanged(user => {
    if (!user || user.email !== 'sfsru@admin.su') {
      window.location.href = '../login.html';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    firebase.auth().signOut().then(() => {
      window.location.href = '../login.html';
    });
  });

  document.getElementById('searchBtn').addEventListener('click', searchDocument);
  document.getElementById('searchCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchDocument();
  });

  document.getElementById('editBtn').addEventListener('click', toggleEdit);
  document.getElementById('saveBtn').addEventListener('click', saveDocument);
});

let currentUserId = null;
let currentDocData = null;
let isEditing = false;

async function searchDocument() {
  const code = document.getElementById('searchCode').value.trim();
  const docType = document.getElementById('docType').value;

  if (!code || !/^\d{4}-\d{4}$/.test(code)) {
    showAlert('Введите корректный личный код (XXXX-XXXX)', 'error');
    return;
  }

  try {
    const userSnapshot = await firebase.firestore()
      .collection('users')
      .where('personalCode', '==', code)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      showAlert('Пользователь не найден', 'error');
      document.getElementById('resultSection').style.display = 'none';
      return;
    }

    const userDoc = userSnapshot.docs[0];
    currentUserId = userDoc.id;

    const docRef = firebase.firestore().collection('documents').doc(currentUserId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      showAlert('Документ не найден', 'error');
      document.getElementById('resultSection').style.display = 'none';
      return;
    }

    currentDocData = docSnap.data();
    renderDocument(currentDocData, docType);
    document.getElementById('resultSection').style.display = 'block';
    isEditing = false;
    updateButtons();
  } catch (err) {
    console.error(err);
    showAlert('Ошибка поиска документа', 'error');
  }
}

function renderDocument(data, docType) {
  const titles = {
    passport: 'Паспорт гражданина СФСРЮ',
    'foreign-passport': 'Заграничный паспорт',
    inn: 'ИНН',
    nss: 'Номер социального счёта',
    oms: 'Полис ОМС',
    'military-id': 'Военный билет',
    'driver-license': 'Водительское удостоверение',
    'id-card': 'ID-карта',
    'pensioner-id': 'Удостоверение пенсионера',
    disability: 'Инвалидность'
  };
  document.getElementById('docTitle').textContent = titles[docType] || docType;
  updateStatusBadge(data.status);
  document.getElementById('statusSelect').value = data.status || 'oncheck';

  let html = '';

  if (docType === 'passport') {
    html = `
      <div class="form-group">
        <label>Фамилия</label>
        <input type="text" class="form-input" data-field="surname" value="${data.surname || ''}" ${isEditing ? '' : 'readonly'} />
      </div>
      <div class="form-group">
        <label>Имя</label>
        <input type="text" class="form-input" data-field="name" value="${data.name || ''}" ${isEditing ? '' : 'readonly'} />
      </div>
      <div class="form-group">
        <label>Отчество</label>
        <input type="text" class="form-input" data-field="patronymic" value="${data.patronymic || ''}" ${isEditing ? '' : 'readonly'} />
      </div>
      <div class="form-group">
        <label>Серия и номер</label>
        <input type="text" class="form-input" data-field="seriesNumber" value="${data.seriesNumber || ''}" ${isEditing ? '' : 'readonly'} />
      </div>
      <div class="form-group">
        <label>Дата выдачи</label>
        <input type="date" class="form-input" data-field="issueDate" value="${data.issueDate || ''}" ${isEditing ? '' : 'readonly'} />
      </div>
      <div class="form-group">
        <label>Срок действия</label>
        <input type="date" class="form-input" data-field="expiryDate" value="${data.expiryDate || ''}" ${isEditing ? '' : 'readonly'} />
      </div>
      <div class="form-group">
        <label>Кем выдан</label>
        <input type="text" class="form-input" data-field="issuedBy" value="${data.issuedBy || ''}" ${isEditing ? '' : 'readonly'} />
      </div>
      <div class="form-group">
        <label>Код подразделения</label>
        <input type="text" class="form-input" data-field="departmentCode" value="${data.departmentCode || ''}" ${isEditing ? '' : 'readonly'} />
      </div>
      <div class="form-group">
        <label>Место рождения</label>
        <input type="text" class="form-input" data-field="birthPlace" value="${data.birthPlace || ''}" ${isEditing ? '' : 'readonly'} />
      </div>
      <div class="form-group">
        <label>Пол</label>
        <select class="form-select" data-field="gender" ${isEditing ? '' : 'disabled'}>
          <option value="Мужской" ${data.gender === 'Мужской' ? 'selected' : ''}>Мужской</option>
          <option value="Женский" ${data.gender === 'Женский' ? 'selected' : ''}>Женский</option>
        </select>
      </div>
    `;
  } else {
    html = `<p>Документ типа "${titles[docType]}" найден. Редактирование доступно только для паспорта.</p>`;
  }

  document.getElementById('docContent').innerHTML = html;
}

function updateStatusBadge(status) {
  const el = document.getElementById('statusBadge');
  el.textContent = getStatusLabel(status);
  el.className = 'status-badge';
  if (status === 'verified') el.classList.add('status-verified');
  else if (status === 'oncheck') el.classList.add('status-pending');
  else if (status === 'rejected') el.classList.add('status-rejected');
}

function getStatusLabel(status) {
  if (status === 'verified') return '✅ Подтверждён';
  if (status === 'oncheck') return '⏳ На проверке';
  if (status === 'rejected') return '❌ Отклонён';
  return '—';
}

function toggleEdit() {
  isEditing = !isEditing;
  updateButtons();
  renderDocument(currentDocData, document.getElementById('docType').value);
}

function updateButtons() {
  const editBtn = document.getElementById('editBtn');
  const saveBtn = document.getElementById('saveBtn');
  if (isEditing) {
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
  } else {
    editBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
  }
}

async function saveDocument() {
  if (!currentUserId || !currentDocData) return;

  try {
    // Собираем новые данные
    const newData = { ...currentDocData };
    const inputs = document.querySelectorAll('[data-field]');
    inputs.forEach(input => {
      const field = input.dataset.field;
      newData[field] = input.type === 'checkbox' ? input.checked : input.value;
    });

    // Обновляем статус
    newData.status = document.getElementById('statusSelect').value;

    // Сохраняем в Firestore
    await firebase.firestore().collection('documents').doc(currentUserId).set(newData);
    
    currentDocData = newData;
    isEditing = false;
    updateButtons();
    renderDocument(newData, document.getElementById('docType').value);
    showAlert('Документ успешно обновлён', 'success');
  } catch (err) {
    console.error(err);
    showAlert('Ошибка сохранения документа', 'error');
  }
}

function showAlert(message, type) {
  const el = document.getElementById('alertMessage');
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}