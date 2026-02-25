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

  // Поиск пользователя
  document.getElementById('searchBtn').addEventListener('click', searchUser);
  document.getElementById('searchCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchUser();
  });

  // Сохранение
  document.getElementById('saveUserBtn').addEventListener('click', saveUserData);
});

let currentUserId = null;

async function searchUser() {
  const code = document.getElementById('searchCode').value.trim();
  if (!code || !/^\d{4}-\d{4}$/.test(code)) {
    showAlert('Введите корректный личный код (XXXX-XXXX)', 'error');
    return;
  }

  try {
    const snapshot = await firebase.firestore()
      .collection('users')
      .where('personalCode', '==', code)
      .limit(1)
      .get();

    if (snapshot.empty) {
      showAlert('Пользователь с таким личным кодом не найден', 'error');
      document.getElementById('userResult').style.display = 'none';
      return;
    }

    const doc = snapshot.docs[0];
    currentUserId = doc.id;
    const data = doc.data();

    // Заполняем форму
    document.getElementById('resultPersonalCode').textContent = data.personalCode;
    document.getElementById('editSurname').value = data.surname || '';
    document.getElementById('editName').value = data.name || '';
    document.getElementById('editPatronymic').value = data.patronymic || '';
    document.getElementById('editBirthDate').value = data.dateOfBirth || '';
    document.getElementById('editBirthPlace').value = data.placeOfBirth || '';

    // Статусы
    document.getElementById('surnameStatus').value = data.surnameStatus || 'oncheck';
    document.getElementById('nameStatus').value = data.nameStatus || 'oncheck';
    document.getElementById('patronymicStatus').value = data.patronymicStatus || 'oncheck';
    document.getElementById('dateOfBirthStatus').value = data.dateOfBirthStatus || 'oncheck';
    document.getElementById('placeOfBirthStatus').value = data.placeOfBirthStatus || 'oncheck';

    document.getElementById('userResult').style.display = 'block';
  } catch (err) {
    console.error(err);
    showAlert('Ошибка при поиске пользователя', 'error');
  }
}

async function saveUserData() {
  if (!currentUserId) return;

  try {
    const updates = {
      surname: document.getElementById('editSurname').value.trim(),
      name: document.getElementById('editName').value.trim(),
      patronymic: document.getElementById('editPatronymic').value.trim(),
      dateOfBirth: document.getElementById('editBirthDate').value,
      placeOfBirth: document.getElementById('editBirthPlace').value.trim(),

      surnameStatus: document.getElementById('surnameStatus').value,
      nameStatus: document.getElementById('nameStatus').value,
      patronymicStatus: document.getElementById('patronymicStatus').value,
      dateOfBirthStatus: document.getElementById('dateOfBirthStatus').value,
      placeOfBirthStatus: document.getElementById('placeOfBirthStatus').value
    };

    await firebase.firestore().collection('users').doc(currentUserId).update(updates);
    showAlert('Данные успешно обновлены', 'success');
  } catch (err) {
    console.error(err);
    showAlert('Ошибка при сохранении данных', 'error');
  }
}

function showAlert(message, type) {
  const el = document.getElementById('alertMessage');
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}