(function () {
  // Ждём полной загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

function init() {
  const profileTrigger = document.getElementById('profileTrigger');
  const popup = document.getElementById('profilePopup');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!profileTrigger || !popup || !logoutBtn) {
    console.warn('Элементы профиля не найдены');
    return;
  }

  // Позиционирование попапа под кнопкой
  function positionPopup() {
    const rect = profileTrigger.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
    popup.style.right = `${window.innerWidth - rect.right}px`;
  }

  // Открытие/закрытие
  profileTrigger.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();

    if (popup.classList.contains('active')) {
      popup.classList.remove('active');
    } else {
      positionPopup(); // ← позиционируем перед открытием
      loadProfileData();
      popup.classList.add('active');
    }
  });

  // Закрытие по клику вне попапа
  document.addEventListener('click', function (e) {
    if (!popup.contains(e.target) && e.target !== profileTrigger) {
      popup.classList.remove('active');
    }
  });

  // Закрытие при прокрутке
  window.addEventListener('scroll', () => {
    if (popup.classList.contains('active')) {
      popup.classList.remove('active');
    }
  });

  // Выход
  logoutBtn.addEventListener('click', function () {
    firebase.auth().signOut().then(() => {
      window.location.href = '../login.html';
    });
  });
}

  async function loadProfileData() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
      const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
      if (!userDoc.exists) return;

      const data = userDoc.data();
      const surname = data.surname || '';
      const name = data.name || '';
      const personalCode = data.personalCode || '';

      // ФИО
      const fullName = `${surname} ${name}`.trim() || '—';
      document.getElementById('profileName').textContent = fullName;

// Тип учётной записи
const accountType = data.accountType || 'упрощенная';
const badge = document.getElementById('accountTypeBadge');

// Текст
badge.textContent = {
  'упрощенная': 'Упрощённая',
  'стандартная': 'Стандартная',
  'подтвержденная': 'Подтверждённая'
}[accountType] || accountType;

// Полная замена классов
badge.className = 'account-type-badge'; // ← сначала сброс

// Добавляем нужный цветовой класс
if (accountType === 'упрощенная') {
  badge.classList.add('account-type-uproshchennaya');
} else if (accountType === 'стандартная') {
  badge.classList.add('account-type-standartnaya');
} else if (accountType === 'подтвержденная') {
  badge.classList.add('account-type-podtverzhdenная');
}

  function renderAvatar(surname, name, personalCode) {
    const container = document.getElementById('profileAvatarContainer');
    
    if (personalCode) {
      const safeCode = personalCode.replace(/[^a-zA-Z0-9\-]/g, '');
      const imgUrl = `../images/avatars/${safeCode}.jpg`;

      const img = new Image();
      img.onload = () => {
        container.innerHTML = `<img src="${imgUrl}" alt="Аватар">`;
      };
      img.onerror = () => {
        renderInitialsAvatar(surname, name, personalCode);
      };
      img.src = imgUrl;
    } else {
      renderInitialsAvatar(surname, name, personalCode);
    }
  }

  function renderInitialsAvatar(surname, name, personalCode) {
    const initials = getInitials(surname, name);
    const bgColor = getColorFromPersonalCode(personalCode);
    const container = document.getElementById('profileAvatarContainer');
    container.innerHTML = initials;
    container.style.backgroundColor = bgColor;
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
  }

  function renderDefaultAvatar() {
    const container = document.getElementById('profileAvatarContainer');
    container.innerHTML = '—';
    container.style.backgroundColor = '#7b0000';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
  }

  function getInitials(surname, name) {
    let initials = '';
    if (surname) initials += surname[0].toUpperCase();
    if (name) initials += name[0].toUpperCase();
    return initials || '—';
  }

  function getColorFromPersonalCode(code) {
    if (!code) return '#7b0000';
    const cleanCode = code.replace(/-/g, '').substring(0, 4);
    const hash = cleanCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 45%)`;
  }

  function getAccountTypeLabel(type) {
    const labels = {
      'упрощенная': 'Упрощённая',
      'стандартная': 'Стандартная',
      'подтвержденная': 'Подтверждённая'
    };
    return labels[type] || type;
  }
})();