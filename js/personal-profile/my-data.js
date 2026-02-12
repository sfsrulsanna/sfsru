let userData = {};
let currentEditType = null;

document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('nav-open');
      menuToggle.classList.toggle('menu-open');
      document.body.style.overflow = mainNav.classList.contains('nav-open') ? 'hidden' : '';
    });
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('nav-open');
        menuToggle.classList.remove('menu-open');
        document.body.style.overflow = '';
      });
    });
  }

  firebase.auth().onAuthStateChanged(user => {
    if (!user) return window.location.href = '../login.html';
    loadUserData(user.uid);
  });

  // Обработчик сохранения — НАЗНАЧАЕМ ОДИН РАЗ
  document.getElementById('saveBtn').addEventListener('click', saveChanges);

  const modal = document.getElementById('modal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
});

async function loadUserData(userId) {
  try {
    const userDoc = await firebase.firestore().collection('users').doc(userId).get();
    const addrDoc = await firebase.firestore().collection('users_addresses').doc(userId).get();

    if (!userDoc.exists) throw new Error('Пользователь не найден');

    userData = userDoc.data();
    if (addrDoc.exists) userData.addresses = addrDoc.data();

    renderData();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('dataBlocks').style.display = 'block';
  } catch (err) {
    console.error(err);
    alert('Ошибка загрузки данных');
  }
}

function renderData() {
  document.getElementById('surnameValue').textContent = userData.surname || '—';
  updateStatus('surname', userData.surnameStatus);

  document.getElementById('nameValue').textContent = userData.name || '—';
  updateStatus('name', userData.nameStatus);

  document.getElementById('patronymicValue').textContent = userData.patronymic || '—';

  document.getElementById('birthDateValue').textContent = userData.dateOfBirth || '—';
  updateStatus('dateOfBirth', userData.dateOfBirthStatus);

  document.getElementById('birthPlaceValue').textContent = userData.placeOfBirth || '—';

  document.getElementById('phoneValue').textContent = userData.phone || '—';
  document.getElementById('emailValue').textContent = userData.email || '—';

  document.getElementById('personalCodeValue').textContent = userData.personalCode || '—';

  renderAddresses();
}

function renderAddresses() {
  const container = document.getElementById('addressesContent');
  const addr = userData.addresses || {};

  const hasPermanent = addr.permanent && addr.permanent.trim();
  const hasTemporary = addr.temporary && addr.temporary.trim();
  const hasResidence = addr.residence && addr.residence.trim();

  if (!hasPermanent && !hasTemporary && !hasResidence) {
    container.innerHTML = '<div class="no-addresses">На ваше имя не зарегистрировано ни одного адреса.</div>';
    return;
  }

  let html = '';

  if (hasPermanent) {
    html += `<div class="address-block">
      <div class="address-title">Постоянная регистрация</div>
      <div><strong>Адрес:</strong> ${addr.permanent}</div>
      <div><strong>Период:</strong> ${formatPeriod(addr.permanentFrom, addr.permanentTo)}</div>
    </div>`;
  }
  if (hasTemporary) {
    html += `<div class="address-block">
      <div class="address-title">Временная регистрация</div>
      <div><strong>Адрес:</strong> ${addr.temporary}</div>
      <div><strong>Период:</strong> ${formatPeriod(addr.temporaryFrom, addr.temporaryTo)}</div>
    </div>`;
  }
  if (hasResidence) {
    html += `<div class="address-block">
      <div class="address-title">Место пребывания</div>
      <div><strong>Адрес:</strong> ${addr.residence}</div>
      <div><strong>Период:</strong> ${formatPeriod(addr.residenceFrom, addr.residenceTo)}</div>
    </div>`;
  }

  container.innerHTML = html;
}

function formatPeriod(from, to) {
  if (!from && !to) return '—';
  const f = from ? new Date(from).toLocaleDateString('ru-RU') : '...';
  const t = to ? new Date(to).toLocaleDateString('ru-RU') : 'настоящее время';
  return `${f} — ${t}`;
}

function updateStatus(field, status) {
  const el = document.getElementById(`${field}Status`);
  if (!el) return;

  let text = '', className = '';
  if (status === 'verified') {
    text = '✅ Подтверждено';
    className = 'status-badge status-verified';
  } else if (status === 'oncheck') {
    text = '⏳ На проверке';
    className = 'status-badge status-pending';
  } else if (status === 'rejected') {
    text = '❌ Отклонено';
    className = 'status-badge status-rejected';
  } else {
    el.style.display = 'none';
    return;
  }

  el.textContent = text;
  el.className = className;
  el.style.display = 'inline-block';
}

function openEditModal(type) {
  currentEditType = type;
  let title = '', content = '';

  if (type === 'fio') {
    title = 'Изменение ФИО';
    content = `
      <div class="form-group">
        <label>Фамилия</label>
        <input type="text" id="editSurname" class="form-input" value="${userData.surname || ''}" required>
      </div>
      <div class="form-group">
        <label>Имя</label>
        <input type="text" id="editName" class="form-input" value="${userData.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Отчество</label>
        <input type="text" id="editPatronymic" class="form-input" value="${userData.patronymic || ''}">
      </div>
    `;
  } else if (type === 'birth') {
    title = 'Изменение даты и места рождения';
    content = `
      <div class="form-group">
        <label>Дата рождения</label>
        <input type="date" id="editBirthDate" class="form-input" value="${userData.dateOfBirth || ''}" required>
      </div>
      <div class="form-group">
        <label>Место рождения</label>
        <input type="text" id="editBirthPlace" class="form-input" value="${userData.placeOfBirth || ''}" required>
      </div>
    `;
  } else if (type === 'contact') {
    title = 'Изменение контактной информации';
    content = `
      <div class="form-group">
        <label>Телефон</label>
        <input type="tel" id="editPhone" class="form-input" value="${userData.phone || ''}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="editEmail" class="form-input" value="${userData.email || ''}" required>
      </div>
    `;
  }

  // ✅ Обновляем ТОЛЬКО тело, не трогая кнопки
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = content;

  const modal = document.getElementById('modal');
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.classList.add('active');
  }, 10);
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('active');
  setTimeout(() => {
    modal.style.display = 'none';
    currentEditType = null;
  }, 300);
}

async function saveChanges() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return;

  try {
    if (currentEditType === 'contact') {
      const updates = {
        phone: document.getElementById('editPhone').value.trim(),
        email: document.getElementById('editEmail').value.trim()
      };
      await firebase.firestore().collection('users').doc(userId).update(updates);
      Object.assign(userData, updates);
      renderData();
      showResult('Контактная информация успешно обновлена', true);
    } else {
      let updates = {};
      if (currentEditType === 'fio') {
        updates = {
          surname: document.getElementById('editSurname').value.trim(),
          name: document.getElementById('editName').value.trim(),
          patronymic: document.getElementById('editPatronymic').value.trim(),
          surnameStatus: 'oncheck',
          nameStatus: 'oncheck',
          patronymicStatus: 'oncheck'
        };
      } else if (currentEditType === 'birth') {
        updates = {
          dateOfBirth: document.getElementById('editBirthDate').value,
          placeOfBirth: document.getElementById('editBirthPlace').value.trim(),
          dateOfBirthStatus: 'oncheck',
          placeOfBirthStatus: 'oncheck'
        };
      }

      await firebase.firestore().collection('users').doc(userId).update(updates);
      Object.assign(userData, updates);
      renderData();
      showResult('Изменения отправлены на проверку администратору. Это может занять до 24 часов.', true);
    }
  } catch (err) {
    console.error(err);
    showResult('Ошибка при сохранении данных', false);
  }
}

function showResult(message, success) {
  const modalBody = document.getElementById('modalBody');
  const modalFooter = document.querySelector('.modal-footer');
  
  // Показываем сообщение вместо формы
  modalBody.innerHTML = `<div class="alert alert-${success ? 'success' : 'error'}">${message}</div>`;
  modalFooter.style.display = 'none';
  
  setTimeout(() => {
    // Восстанавливаем форму и кнопки
    modalFooter.style.display = 'flex';
    closeModal();
  }, 4000);
}