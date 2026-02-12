document.addEventListener('DOMContentLoaded', function () {
  // Защита: только админ
  firebase.auth().onAuthStateChanged(user => {
    if (!user || user.email !== 'sfsru@admin.su') {
      window.location.href = '../login.html';
    }
  });

  // Выход
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    firebase.auth().signOut().then(() => {
      window.location.href = '../login.html';
    });
  });

  // Поиск
  document.getElementById('searchBtn').addEventListener('click', searchUser);
  document.getElementById('searchCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchUser();
  });

  // Сохранение
  document.getElementById('saveAddressesBtn').addEventListener('click', saveAddresses);
});

let currentUserId = null;
let currentPersonalCode = null;

async function searchUser() {
  const code = document.getElementById('searchCode').value.trim();
  if (!code || !/^\d{4}-\d{4}$/.test(code)) {
    showAlert('Введите корректный личный код (XXXX-XXXX)', 'error');
    return;
  }

  try {
    // Находим пользователя по personalCode
    const userSnapshot = await firebase.firestore()
      .collection('users')
      .where('personalCode', '==', code)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      showAlert('Пользователь не найден', 'error');
      document.getElementById('addressesResult').style.display = 'none';
      return;
    }

    const userDoc = userSnapshot.docs[0];
    currentUserId = userDoc.id;
    currentPersonalCode = code;

    // Загружаем все адреса (включая архивные)
    const addressesSnapshot = await firebase.firestore()
      .collection('users_addresses')
      .where('personalCode', '==', code)
      .orderBy('createdAt', 'desc')
      .get();

    renderAddresses(addressesSnapshot);
    document.getElementById('resultPersonalCode').textContent = code;
    document.getElementById('addressesResult').style.display = 'block';
  } catch (err) {
    console.error(err);
    showAlert('Ошибка при поиске', 'error');
  }
}

function renderAddresses(snapshot) {
  const container = document.getElementById('addressesList');
  container.innerHTML = '';

  if (snapshot.empty) {
    container.innerHTML = '<p>У пользователя нет записей об адресах.</p>';
    return;
  }

  snapshot.forEach(doc => {
    const addr = doc.data();
    const status = addr.status || 'oncheck';

    const card = document.createElement('div');
    card.className = `address-card ${status}`;
    card.innerHTML = `
      <div class="address-type">
        <span>${getAddressTypeName(addr.type)}</span>
        <span class="status-badge ${status}">${getStatusLabel(status)}</span>
      </div>
      <div class="address-field">
        <label>Адрес</label>
        <input type="text" data-id="${doc.id}" data-field="address" value="${addr.address || ''}" />
      </div>
      <div class="address-field">
        <label>Дата начала</label>
        <input type="date" data-id="${doc.id}" data-field="fromDate" value="${addr.fromDate || ''}" />
      </div>
      <div class="address-field">
        <label>Дата окончания</label>
        <input type="date" data-id="${doc.id}" data-field="toDate" value="${addr.toDate || ''}" />
      </div>
      <div class="status-select">
        <label>Статус</label>
        <select data-id="${doc.id}" data-field="status">
          <option value="verified" ${status === 'verified' ? 'selected' : ''}>✅ Подтверждён</option>
          <option value="oncheck" ${status === 'oncheck' ? 'selected' : ''}>⏳ На проверке</option>
          <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>❌ Отклонён</option>
          <option value="archived" ${status === 'archived' ? 'selected' : ''}>📦 Архивный</option>
        </select>
      </div>
    `;
    container.appendChild(card);
  });
}

function getStatusLabel(status) {
  const labels = {
    verified: 'Подтверждён',
    oncheck: 'На проверке',
    rejected: 'Отклонён',
    archived: 'Архивный'
  };
  return labels[status] || status;
}

function getAddressTypeName(type) {
  const map = {
    permanent: 'Постоянная регистрация',
    temporary: 'Временная регистрация',
    residence: 'Место пребывания'
  };
  return map[type] || type;
}

async function saveAddresses() {
  if (!currentUserId || !currentPersonalCode) return;

  try {
    const inputs = document.querySelectorAll('[data-id]');
    const batch = firebase.firestore().batch();

    inputs.forEach(input => {
      const docId = input.dataset.id;
      const field = input.dataset.field;
      let value = input.value;

      if (field === 'status' || field === 'address') {
        // Обновляем только через select или текст
        const select = document.querySelector(`[data-id="${docId}"][data-field="status"]`);
        const addressInput = document.querySelector(`[data-id="${docId}"][data-field="address"]`);

        const updateData = {
          status: select.value,
          address: addressInput.value,
          fromDate: document.querySelector(`[data-id="${docId}"][data-field="fromDate"]`).value,
          toDate: document.querySelector(`[data-id="${docId}"][data-field="toDate"]`).value,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const ref = firebase.firestore().collection('users_addresses').doc(docId);
        batch.update(ref, updateData);
      }
    });

    await batch.commit();
    showAlert('Адреса успешно обновлены', 'success');
    searchUser(); // перезагрузка
  } catch (err) {
    console.error(err);
    showAlert('Ошибка при сохранении', 'error');
  }
}

function showAlert(message, type) {
  const el = document.getElementById('alertMessage');
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}