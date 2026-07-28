import { supabase } from '../../js/supabase-config.js';

// --- Глобальные переменные ---
let currentUser = null;
let currentUserData = null;

// --- DOM элементы ---
const marriageContent = document.getElementById('marriageContent');
const childrenContent = document.getElementById('childrenContent');

// --- Вспомогательные функции ---
function showMarriageLoading() {
  marriageContent.innerHTML = '<div class="loading-small">Загрузка...</div>';
}

function showChildrenLoading() {
  childrenContent.innerHTML = '<div class="loading-small">Загрузка...</div>';
}

function showError(container, msg) {
  container.innerHTML = `<div class="no-data-message" style="color: #dc3545;">${msg}</div>`;
}

// --- Загрузка профиля ---
async function loadUserProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '../../login.html';
    return false;
  }
  currentUser = session.user;

  // Загружаем данные пользователя (личный код, ФИО)
  const { data, error } = await supabase
    .from('users')
    .select('surname, name, patronymic, personal_code')
    .eq('id', currentUser.id)
    .single();
  if (error) {
    console.error('Ошибка загрузки профиля:', error);
    return false;
  }
  currentUserData = data;
  return true;
}

// --- Получение активного брака (самого нового) ---
async function getActiveMarriage() {
  // Ищем записи, где user1_id или user2_id = currentUser.id, статус active или pending
  // Сортируем по created_at DESC, берём первую
  const { data, error } = await supabase
    .schema('documents_certificates')
    .from('marriages')
    .select(`
      *,
      user1:user1_id (surname, name, patronymic, personal_code),
      user2:user2_id (surname, name, patronymic, personal_code)
    `)
    .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
    .in('status', ['pending', 'active', 'divorced'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Ошибка загрузки брака:', error);
    return null;
  }
  return data;
}

// --- Получение детей пользователя ---
async function getChildren() {
  const personalCode = currentUserData.personal_code;
  if (!personalCode) return [];

  const { data, error } = await supabase
    .from('children')
    .select('*')
    .or(`father_personal_code.eq.${personalCode},mother_personal_code.eq.${personalCode},child_personal_code.eq.${personalCode}`)
    .order('date_of_birth', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки детей:', error);
    return [];
  }
  return data || [];
}

// --- Отображение блока "Брак и развод" ---
async function renderMarriage() {
  showMarriageLoading();
  try {
    const marriage = await getActiveMarriage();

    if (!marriage) {
      // Нет брака — показываем кнопку "Получить свидетельство"
      marriageContent.innerHTML = `
        <div class="no-data-message">
          <p>У вас нет активного брака.</p>
          <a href="../../services/documents/marriage-certificate/" class="btn btn-primary" style="margin-top: 1rem; display: inline-block;">Получить свидетельство о браке</a>
        </div>
      `;
      return;
    }

    // Определяем партнёра
    const isUser1 = marriage.user1_id === currentUser.id;
    const partner = isUser1 ? marriage.user2 : marriage.user1;
    const partnerUser = partner ? partner : null;
    const partnerPersonalCode = isUser1 ? marriage.partner_personal_code : marriage.user1_personal_code;

    // Строим карточку
    let html = `<div class="marriage-card">`;

    // Статус
    const statusText = marriage.status === 'active' ? 'Состоит в браке' :
                       marriage.status === 'pending' ? 'Ожидает подтверждения' :
                       'Брак расторгнут';
    const statusClass = marriage.status === 'active' ? 'active' :
                        marriage.status === 'pending' ? 'pending' :
                        'divorced';
    html += `<div class="marriage-status ${statusClass}"><i class="fas ${marriage.status === 'active' ? 'fa-heart' : marriage.status === 'pending' ? 'fa-clock' : 'fa-times'}"></i> ${statusText}</div>`;

    html += `<div class="marriage-info">`;
    if (marriage.marriage_date) {
      html += `<div class="marriage-info-item"><strong>Дата брака:</strong> ${new Date(marriage.marriage_date).toLocaleDateString('ru-RU')}</div>`;
    }
    if (marriage.certificate_number) {
      html += `<div class="marriage-info-item"><strong>№ свидетельства:</strong> ${marriage.certificate_number}</div>`;
    }
    if (marriage.divorce_date) {
      html += `<div class="marriage-info-item"><strong>Дата расторжения:</strong> ${new Date(marriage.divorce_date).toLocaleDateString('ru-RU')}</div>`;
    }
    if (marriage.divorce_certificate_number) {
      html += `<div class="marriage-info-item"><strong>№ свидетельства о разводе:</strong> ${marriage.divorce_certificate_number}</div>`;
    }
    html += `</div>`;

    // Карточка супруга
    if (partnerUser && marriage.status === 'active') {
      // Если партнёр подтверждён (есть user2_id)
      html += `<div class="spouse-card">`;
      html += `<div class="spouse-avatar"><i class="fas fa-user"></i></div>`;
      html += `<div class="spouse-info">`;
      const fullName = `${partnerUser.surname} ${partnerUser.name} ${partnerUser.patronymic || ''}`.trim();
      html += `<div class="spouse-name">${fullName}</div>`;
      html += `<div class="spouse-detail">Супруг(а)</div>`;
      html += `</div></div>`;
    } else if (marriage.status === 'pending' && !partnerUser) {
      // Ожидание подтверждения – показываем имя партнёра с сокращённой фамилией
      // Получаем данные по личному коду из таблицы users
      let partnerName = null;
      if (partnerPersonalCode) {
        const { data: userData } = await supabase
          .from('users')
          .select('surname, name, patronymic')
          .eq('personal_code', partnerPersonalCode)
          .single();
        if (userData) {
          const surnameFirst = userData.surname.charAt(0);
          const fullName = `${userData.name} ${userData.patronymic || ''} ${surnameFirst}.`.trim();
          partnerName = fullName;
        } else {
          partnerName = `Личный код ${partnerPersonalCode}`;
        }
      }

      html += `<div style="margin-top: 1rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">`;
      html += `<div>`;
      html += `<div class="spouse-name">${partnerName || 'Супруг(а)'}</div>`;
      html += `<div class="spouse-detail">Ожидается подтверждение связи</div>`;
      html += `</div>`;
      // Кнопка подтверждения (если пользователь ещё не подтвердил)
      html += `<button class="confirm-link-btn" id="confirmMarriageBtn" data-marriage-id="${marriage.id}"><i class="fas fa-link"></i> Подтвердить связь</button>`;
      html += `</div>`;
    }

    html += `</div>`;

    // Если есть развод, показываем дополнительную информацию
    if (marriage.status === 'divorced') {
      html += `<div style="margin-top: 1rem; padding: 1rem; background: #f8d7da; border-radius: 8px; color: #721c24;">`;
      html += `<i class="fas fa-exclamation-triangle"></i> Брак расторгнут.`;
      if (marriage.divorce_reason) {
        html += ` Причина: ${marriage.divorce_reason}`;
      }
      html += `</div>`;
    }

    marriageContent.innerHTML = html;

    // Обработчик для кнопки подтверждения
    const confirmBtn = document.getElementById('confirmMarriageBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        openConfirmModal(confirmBtn.dataset.marriageId);
      });
    }

  } catch (err) {
    console.error(err);
    showError(marriageContent, 'Ошибка загрузки данных о браке');
  }
}

// --- Отображение детей ---
async function renderChildren() {
  showChildrenLoading();
  try {
    const children = await getChildren();
    if (children.length === 0) {
      childrenContent.innerHTML = `
        <div class="no-data-message">
          <p>У вас нет зарегистрированных детей.</p>
        </div>
      `;
      return;
    }

    let html = `<div class="children-grid">`;
    children.forEach(child => {
      const genderIcon = child.gender === 'male' ? 'fa-mars' : 'fa-venus';
      const fullName = `${child.surname} ${child.name} ${child.patronymic || ''}`.trim();
      html += `
        <div class="child-card">
          <div class="child-avatar"><i class="fas ${genderIcon}"></i></div>
          <div class="child-info">
            <div class="child-name">${fullName}</div>
            <div class="child-detail">${child.date_of_birth ? new Date(child.date_of_birth).toLocaleDateString('ru-RU') : ''}</div>
            <div class="child-detail">${child.place_of_birth || ''}</div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    childrenContent.innerHTML = html;
  } catch (err) {
    console.error(err);
    showError(childrenContent, 'Ошибка загрузки данных о детях');
  }
}

// --- Модальное окно подтверждения брака ---
function openConfirmModal(marriageId) {
  const modal = document.getElementById('confirmModal');
  const body = document.getElementById('confirmModalBody');

  // Находим брак
  supabase.schema('documents_certificates')
    .from('marriages')
    .select('*, user1:user1_id(surname, name, patronymic, personal_code), user2:user2_id(surname, name, patronymic, personal_code)')
    .eq('id', marriageId)
    .single()
    .then(({ data, error }) => {
      if (error) {
        alert('Ошибка загрузки данных брака');
        return;
      }

      // Определяем партнёра
      const isUser1 = data.user1_id === currentUser.id;
      const partner = isUser1 ? data.user2 : data.user1;
      const partnerPersonalCode = isUser1 ? data.partner_personal_code : data.user1_personal_code;

      let partnerName = 'неизвестно';
      if (partner && partner.personal_code) {
        const fullName = `${partner.surname} ${partner.name} ${partner.patronymic || ''}`.trim();
        partnerName = fullName;
      } else if (partnerPersonalCode) {
        // Ищем по личному коду
        supabase.from('users')
          .select('surname, name, patronymic')
          .eq('personal_code', partnerPersonalCode)
          .single()
          .then(({ data: userData }) => {
            if (userData) {
              const fullName = `${userData.surname} ${userData.name} ${userData.patronymic || ''}`.trim();
              document.getElementById('confirmPartnerName').textContent = fullName;
            }
          });
        partnerName = `личный код ${partnerPersonalCode}`;
      }

      body.innerHTML = `
        <p>Вы собираетесь подтвердить брачную связь с супругом(ой):</p>
        <p><strong id="confirmPartnerName">${partnerName}</strong></p>
        <p>Убедитесь, что данные верны.</p>
      `;

      modal.style.display = 'flex';
      document.getElementById('saveConfirmBtn').dataset.marriageId = marriageId;
    });
}

// --- Подтверждение брака ---
async function confirmMarriage(marriageId) {
  const { data: marriage, error } = await supabase
    .schema('documents_certificates')
    .from('marriages')
    .update({
      status: 'active',
      user2_id: currentUser.id, // если второй супруг подтверждает
      updated_at: new Date().toISOString()
    })
    .eq('id', marriageId)
    .select()
    .single();

  if (error) {
    alert('Ошибка подтверждения: ' + error.message);
    return false;
  }

  // Если оба супруга подтвердили, можно также обновить другую сторону
  // Но статус active уже достаточно
  alert('Связь успешно подтверждена!');
  document.getElementById('confirmModal').style.display = 'none';
  renderMarriage(); // обновляем блок
  return true;
}

// --- Закрытие модалки ---
document.getElementById('closeConfirmModal').addEventListener('click', () => {
  document.getElementById('confirmModal').style.display = 'none';
});
document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
  document.getElementById('confirmModal').style.display = 'none';
});
document.getElementById('saveConfirmBtn').addEventListener('click', async (e) => {
  const marriageId = e.target.dataset.marriageId;
  if (marriageId) {
    await confirmMarriage(marriageId);
  }
});

// --- Инициализация ---
async function init() {
  const loaded = await loadUserProfile();
  if (!loaded) return;

  await renderMarriage();
  await renderChildren();
}

document.addEventListener('DOMContentLoaded', init);