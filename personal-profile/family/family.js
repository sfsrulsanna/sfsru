import { supabase } from '../../js/supabase-config.js';

// --- DOM элементы ---
const marriageLoading = document.getElementById('marriageLoading');
const marriageContent = document.getElementById('marriageContent');
const childrenLoading = document.getElementById('childrenLoading');
const childrenContent = document.getElementById('childrenContent');

let currentUser = null;
let currentUserPersonalCode = null;

// --- Вспомогательные функции ---
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 3) {
    return `${parts[0]} ${parts[1][0]}. ${parts[2][0]}.`;
  }
  if (parts.length === 2) {
    return `${parts[0]} ${parts[1][0]}.`;
  }
  return parts[0];
}

function getGenderIcon(gender) {
  if (gender === 'male') return '<i class="fas fa-mars" style="color:#007bff;"></i>';
  if (gender === 'female') return '<i class="fas fa-venus" style="color:#dc3545;"></i>';
  return '<i class="fas fa-genderless"></i>';
}

// --- Загрузка данных пользователя ---
async function loadUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '../../login.html';
    return false;
  }
  const { data, error } = await supabase
    .from('users')
    .select('id, personal_code, surname, name, patronymic')
    .eq('id', session.user.id)
    .single();
  if (error) {
    console.error('Ошибка загрузки пользователя:', error);
    return false;
  }
  currentUser = data;
  currentUserPersonalCode = data.personal_code;
  return true;
}

// --- Получение активного брака / развода ---
async function getActiveMarriage() {
  try {
    // 1. Ищем брак, где пользователь - user1 или user2, со статусом 'active' или 'divorced'
    const { data, error } = await supabase
      .schema('documents_certificates')
      .from('marriages')
      .select('*, user1_id, user2_id')
      .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
      .in('status', ['active', 'divorced'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      // Если таблицы нет или ошибка, возвращаем null
      console.warn('Ошибка загрузки брака:', error);
      return null;
    }
    if (!data || data.length === 0) return null;
    return data[0];
  } catch (err) {
    console.error('Ошибка загрузки брака:', err);
    return null;
  }
}

// --- Получение данных пользователя по ID ---
async function getUserData(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id, surname, name, patronymic, personal_code')
    .eq('id', userId)
    .single();
  if (error) {
    console.warn('Не удалось загрузить данные пользователя:', error);
    return null;
  }
  return data;
}

// --- Рендер блока "Брак и развод" ---
async function renderMarriageBlock() {
  marriageLoading.style.display = 'block';
  marriageContent.style.display = 'none';
  marriageContent.innerHTML = '';

  try {
    const marriage = await getActiveMarriage();
    marriageLoading.style.display = 'none';
    marriageContent.style.display = 'block';

    if (!marriage) {
      marriageContent.innerHTML = `
        <div class="no-data">
          <p>У вас нет активного брака или развода.</p>
          <div class="no-data-actions">
            <a href="../../services/documents/marriage-certificate/" class="btn-primary">Заключить брак</a>
          </div>
        </div>
      `;
      return;
    }

    // Определяем, кто второй супруг
    const isUser1 = marriage.user1_id === currentUser.id;
    const partnerId = isUser1 ? marriage.user2_id : marriage.user1_id;
    const partnerPersonalCode = isUser1 ? marriage.user2_personal_code : marriage.user1_personal_code;

    let partnerData = null;
    if (partnerId) {
      partnerData = await getUserData(partnerId);
    }

    const isActive = marriage.status === 'active';
    const isDivorced = marriage.status === 'divorced';

    let html = `<div class="marriage-card ${isDivorced ? 'divorce-card' : ''}">`;
    html += `<div class="status-badge ${marriage.status}">${isActive ? '✅ В браке' : isDivorced ? '❌ Разведены' : '⏳ На рассмотрении'}</div>`;
    html += `<p><strong>Дата заключения брака:</strong> ${formatDate(marriage.marriage_date)}</p>`;
    if (isDivorced) {
      html += `<p><strong>Дата развода:</strong> ${formatDate(marriage.divorce_date)}</p>`;
    }

    // Информация о супруге
    if (partnerData) {
      // Супруг уже подтверждён (есть user2_id)
      const fullName = `${partnerData.surname} ${partnerData.name} ${partnerData.patronymic || ''}`.trim();
      const avatarLetter = (partnerData.name?.[0] || '?').toUpperCase();
      html += `
        <div class="partner-info">
          <div class="partner-avatar">${avatarLetter}</div>
          <div class="partner-details">
            <div class="partner-name">${fullName}</div>
            <div class="partner-code">Личный код: ${partnerData.personal_code || '—'}</div>
          </div>
        </div>
      `;
    } else if (partnerPersonalCode && isActive) {
      // Есть личный код супруга, но связь ещё не подтверждена (нет user2_id)
      // Пытаемся найти пользователя по личному коду
      const { data: foundUser } = await supabase
        .from('users')
        .select('id, surname, name, patronymic, personal_code')
        .eq('personal_code', partnerPersonalCode)
        .maybeSingle();

      if (foundUser) {
        // Показываем имя с сокращённой фамилией
        const shortName = `${foundUser.name} ${foundUser.patronymic || ''} ${foundUser.surname[0]}.`.trim();
        html += `
          <div class="partner-info">
            <div class="partner-avatar">${(foundUser.name?.[0] || '?').toUpperCase()}</div>
            <div class="partner-details">
              <div class="partner-name">${shortName}</div>
              <div class="partner-code">Личный код: ${foundUser.personal_code}</div>
            </div>
          </div>
          <button class="action-btn btn-success" id="confirmMarriageBtn">Подтвердить супруга</button>
        `;
      } else {
        html += `
          <div class="partner-info">
            <div class="partner-details">
              <div class="partner-name">Супруг(а) не найден(а) в системе</div>
              <div class="partner-code">Личный код: ${partnerPersonalCode}</div>
            </div>
          </div>
        `;
      }
    } else if (isActive) {
      html += `<p class="text-muted">Информация о супруге отсутствует.</p>`;
    }

    if (isDivorced) {
      html += `<p class="text-muted">Брак расторгнут.</p>`;
    }

    html += `</div>`;
    marriageContent.innerHTML = html;

    // Обработчик для кнопки подтверждения
    const confirmBtn = document.getElementById('confirmMarriageBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => openConfirmModal(marriage, partnerPersonalCode));
    }

  } catch (err) {
    console.error('Ошибка рендера брака:', err);
    marriageLoading.style.display = 'none';
    marriageContent.style.display = 'block';
    marriageContent.innerHTML = `<p class="error">Не удалось загрузить данные о браке.</p>`;
  }
}

// --- Модалка подтверждения супруга ---
function openConfirmModal(marriage, partnerCode) {
  const modal = document.getElementById('confirmModal');
  const body = document.getElementById('confirmModalBody');
  modal.style.display = 'flex';
  body.innerHTML = `
    <p>Вы подтверждаете, что пользователь с личным кодом <strong>${partnerCode}</strong> является вашим супругом/супругой?</p>
    <p>После подтверждения связь будет установлена.</p>
  `;
  document.getElementById('confirmMarriageBtn').onclick = () => confirmMarriage(marriage.id, partnerCode);
}

function closeConfirmModal() {
  document.getElementById('confirmModal').style.display = 'none';
}

window.closeConfirmModal = closeConfirmModal;

async function confirmMarriage(marriageId, partnerCode) {
  try {
    // 1. Находим пользователя по личному коду
    const { data: partner, error: findErr } = await supabase
      .from('users')
      .select('id')
      .eq('personal_code', partnerCode)
      .maybeSingle();
    if (findErr || !partner) {
      alert('Пользователь с таким личным кодом не найден.');
      return;
    }

    // 2. Обновляем запись о браке: добавляем user2_id (если текущий пользователь user1) или user1_id (если текущий user2)
    // Определяем, кто текущий пользователь
    const { data: marriage } = await supabase
      .schema('documents_certificates')
      .from('marriages')
      .select('user1_id, user2_id')
      .eq('id', marriageId)
      .single();

    if (!marriage) {
      alert('Брак не найден.');
      return;
    }

    let updateData = {};
    if (marriage.user1_id === currentUser.id) {
      updateData.user2_id = partner.id;
    } else if (marriage.user2_id === currentUser.id) {
      updateData.user1_id = partner.id;
    } else {
      alert('Вы не являетесь стороной этого брака.');
      return;
    }

    const { error: updateErr } = await supabase
      .schema('documents_certificates')
      .from('marriages')
      .update(updateData)
      .eq('id', marriageId);

    if (updateErr) {
      alert('Ошибка подтверждения: ' + updateErr.message);
      return;
    }

    alert('Связь с супругом подтверждена!');
    closeConfirmModal();
    await renderMarriageBlock(); // обновляем блок

  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

// --- Загрузка детей ---
async function loadChildren() {
  childrenLoading.style.display = 'block';
  childrenContent.style.display = 'none';
  childrenContent.innerHTML = '';

  try {
    // Ищем детей, где пользователь является отцом, матерью или самим ребёнком
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .or(`father_personal_code.eq.${currentUserPersonalCode},mother_personal_code.eq.${currentUserPersonalCode},child_personal_code.eq.${currentUserPersonalCode}`)
      .order('date_of_birth', { ascending: false });

    childrenLoading.style.display = 'none';
    childrenContent.style.display = 'block';

    if (!data || data.length === 0) {
      childrenContent.innerHTML = `
        <div class="no-data">
          <p>У вас пока нет детей в системе.</p>
          <div class="no-data-actions">
            <a href="../../services/documents/birth-certificate/" class="btn-primary">Добавить ребенка</a>
          </div>
        </div>
      `;
      return;
    }

    let html = '<div class="children-grid">';
    data.forEach(child => {
      const fullName = `${child.surname || ''} ${child.name || ''} ${child.patronymic || ''}`.trim() || 'Без имени';
      const genderLabel = child.gender === 'male' ? 'Мужской' : child.gender === 'female' ? 'Женский' : '—';
      const genderClass = child.gender === 'male' ? 'male' : child.gender === 'female' ? 'female' : '';
      html += `
        <div class="child-card">
          <div class="child-name">${fullName}</div>
          <div class="child-detail"><i class="fas fa-calendar-alt"></i> ${formatDate(child.date_of_birth)}</div>
          <div class="child-detail"><i class="fas fa-map-pin"></i> ${child.place_of_birth || '—'}</div>
          <div class="child-detail"><span class="child-gender ${genderClass}">${genderLabel}</span></div>
          <div class="child-detail" style="font-size:0.9rem;color:#6c757d;">
            <i class="fas fa-id-card"></i> Личный код: ${child.child_personal_code || '—'}
          </div>
          ${child.father_full_name ? `<div class="child-detail">👨 Отец: ${child.father_full_name}</div>` : ''}
          ${child.mother_full_name ? `<div class="child-detail">👩 Мать: ${child.mother_full_name}</div>` : ''}
        </div>
      `;
    });
    html += '</div>';
    childrenContent.innerHTML = html;

  } catch (err) {
    console.error('Ошибка загрузки детей:', err);
    childrenLoading.style.display = 'none';
    childrenContent.style.display = 'block';
    childrenContent.innerHTML = `<p class="error">Не удалось загрузить данные о детях.</p>`;
  }
}

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await loadUser();
  if (!ok) return;

  await renderMarriageBlock();
  await loadChildren();
});

// Экспортируем функции для глобального использования (для модалки)
window.confirmMarriage = confirmMarriage;
window.openConfirmModal = openConfirmModal;
window.closeConfirmModal = closeConfirmModal;