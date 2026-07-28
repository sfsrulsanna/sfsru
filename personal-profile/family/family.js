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

// --- Загрузка данных пользователя ---
async function loadUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '../../login.html';
    return false;
  }
  const { data, error } = await supabase
    .from('users')
    .select('id, personal_code')
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

// --- Получение последнего свидетельства (брак или развод) с учётом статусов ---
async function getLastCertificate(tableName) {
  const { data, error } = await supabase
    .schema('documents_certificates')
    .from(tableName)
    .select('*')
    .or(`personal_code.eq.${currentUserPersonalCode},wife_personal_code.eq.${currentUserPersonalCode}`)
    .in('status', ['verified', 'oncheck', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error(`Ошибка загрузки ${tableName}:`, error);
    return null;
  }
  return data && data.length > 0 ? data[0] : null;
}

// --- Получение связи с супругом (таблица marriages) ---
async function getSpouseLink() {
  const { data, error } = await supabase
    .schema('documents_certificates')
    .from('marriages')
    .select('*')
    .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
    .in('status', ['active', 'divorced'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('Ошибка загрузки связи:', error);
    return null;
  }
  return data && data.length > 0 ? data[0] : null;
}

// --- Получение данных пользователя по ID ---
async function getUserData(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id, surname, name, patronymic, date_of_birth, place_of_birth, personal_code')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('Не удалось загрузить данные пользователя:', error);
    return null;
  }
  return data;
}

// --- Получение данных пользователя по личному коду ---
async function getUserDataByPersonalCode(personalCode) {
  if (!personalCode) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id, surname, name, patronymic, date_of_birth, place_of_birth, personal_code')
    .eq('personal_code', personalCode)
    .maybeSingle();
  if (error) {
    console.warn('Не удалось загрузить пользователя по личному коду:', error);
    return null;
  }
  return data;
}

// --- Рендер блока "Брак и развод" ---
// --- Рендер блока "Брак и развод" ---
async function renderMarriageBlock() {
  marriageLoading.style.display = 'block';
  marriageContent.style.display = 'none';
  marriageContent.innerHTML = '';

  try {
    // 1. Получаем брак и развод одновременно
    const marriage = await getLastCertificate('marriage');
    const divorce = await getLastCertificate('divorce');

    // 2. Получаем связь с супругом
    const spouseLink = await getSpouseLink();

    marriageLoading.style.display = 'none';
    marriageContent.style.display = 'block';

    // Определяем, что показывать: если есть брак – показываем его, иначе развод
    let certificate = marriage || divorce;
    let isDivorce = !!divorce && !marriage;
    let isMarriage = !isDivorce && !!marriage;

    // Если нет ни брака, ни развода – пустое состояние
    if (!certificate) {
      marriageContent.innerHTML = `
        <div class="no-data">
          <p>У вас нет свидетельств о браке или разводе.</p>
          <div class="no-data-actions">
            <a href="../../services/family/marriage/index.html" class="btn-primary">Зарегистрировать брак</a>
          </div>
        </div>
      `;
      return;
    }

    // Определяем данные для отображения
    const myCode = currentUserPersonalCode;
    const partnerCode = certificate.personal_code === myCode 
      ? certificate.wife_personal_code 
      : certificate.personal_code;

    const dateField = isMarriage ? certificate.marriage_date : certificate.divorce_date;
    const dateLabel = isMarriage ? 'Дата заключения брака' : 'Дата развода';
    const title = isMarriage ? 'Свидетельство о браке' : 'Свидетельство о разводе';
    
    // Статус и цвет
    const statusMap = {
      'verified': { label: '✅ Свидетельство подтверждено', class: 'verified' },
      'oncheck': { label: '⏳ На проверке', class: 'oncheck' },
      'rejected': { label: '❌ Отклонено', class: 'rejected' }
    };
    const statusInfo = statusMap[certificate.status] || { label: certificate.status, class: '' };
    const statusText = statusInfo.label;
    const statusClass = statusInfo.class;

    // Получаем ФИО супруга
    let partnerName = partnerCode || '—';
    if (partnerCode) {
      const partnerUser = await getUserDataByPersonalCode(partnerCode);
      if (partnerUser) {
        partnerName = `${partnerUser.surname} ${partnerUser.name} ${partnerUser.patronymic || ''}`.trim();
      }
    }

    // Ссылка на страницу просмотра
    const viewLink = isMarriage 
      ? '../../documents/certificates/marriage-certificate.html' 
      : '../../documents/certificates/divorce-certificate.html';

    // Начинаем строить HTML
    let html = `<div class="marriage-row">`;

    // --- Левая колонка: свидетельство ---
    html += `
      <div class="certificate-card">
        <div class="status-badge ${statusClass}">${statusText}</div>
        <h3>${title}</h3>
        <p><strong>${dateLabel}:</strong> ${formatDate(dateField)}</p>
        <p><strong>Супруг(а):</strong> ${partnerName}</p>
        <p><strong>Личный код супруга:</strong> ${partnerCode || '—'}</p>
        <div class="certificate-actions">
          <a href="${viewLink}?id=${certificate.id}" class="btn-primary">Просмотреть свидетельство</a>
        </div>
      </div>
    `;

    // --- Правая колонка: карточка супруга (только если есть брак) ---
    if (isMarriage) {
      html += `<div class="spouse-card spouse-active">`;
      if (spouseLink) {
        const spouseId = spouseLink.user1_id === currentUser.id ? spouseLink.user2_id : spouseLink.user1_id;
        if (spouseId) {
          const spouseData = await getUserData(spouseId);
          if (spouseData) {
            const fullName = `${spouseData.surname} ${spouseData.name} ${spouseData.patronymic || ''}`.trim();
            const avatarLetter = (spouseData.name?.[0] || '?').toUpperCase();
            html += `
              <div class="spouse-info">
                <div class="spouse-avatar">${avatarLetter}</div>
                <div class="spouse-details">
                  <div class="spouse-name">${fullName}</div>
                  <div class="spouse-meta">Дата рождения: ${spouseData.date_of_birth ? formatDate(spouseData.date_of_birth) : '—'}</div>
                  <div class="spouse-meta">Место рождения: ${spouseData.place_of_birth || '—'}</div>
                  <div class="spouse-meta">Личный код: ${spouseData.personal_code}</div>
                </div>
              </div>
            `;
          } else {
            html += `<p class="text-muted">Данные супруга не найдены.</p>`;
          }
        } else {
          html += `<p class="text-muted">Связь с супругом не подтверждена.</p>`;
        }
      } else {
        // Если связи нет – кнопка для создания
        html += `
          <div class="no-data">
            <p>Нет связи с супругом.</p>
            <button class="btn-primary" id="createMarriageLinkBtn">Создать связь</button>
          </div>
        `;
      }
      html += `</div>`;
    } else {
      // Если это развод – показываем заглушку
      html += `
        <div class="spouse-card spouse-empty">
          <p class="text-muted">Информация о супруге недоступна при разводе.</p>
        </div>
      `;
    }

    html += `</div>`; // закрываем .marriage-row
    marriageContent.innerHTML = html;

    // Обработчик для кнопки создания связи
    const createBtn = document.getElementById('createMarriageLinkBtn');
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const partnerCode = prompt('Введите личный код супруга:');
        if (!partnerCode) return;
        if (partnerCode === currentUserPersonalCode) {
          alert('Нельзя создать связь с самим собой.');
          return;
        }
        // Проверяем существование пользователя
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('personal_code', partnerCode)
          .maybeSingle();
        if (!user) {
          alert('Пользователь с таким личным кодом не найден.');
          return;
        }
        // Создаём связь
        const { error } = await supabase
          .schema('documents_certificates')
          .from('marriages')
          .insert({
            personal_code: currentUserPersonalCode,
            wife_personal_code: partnerCode,
            user1_id: currentUser.id,
            user2_id: user.id,
            marriage_date: new Date().toISOString().slice(0,10),
            status: 'active'
          });
        if (error) {
          alert('Ошибка: ' + error.message);
        } else {
          alert('Связь создана!');
          renderMarriageBlock(); // обновляем
        }
      });
    }

  } catch (err) {
    console.error('Ошибка рендера брака:', err);
    marriageLoading.style.display = 'none';
    marriageContent.style.display = 'block';
    marriageContent.innerHTML = `<p class="error">Не удалось загрузить данные.</p>`;
  }
}

// --- Загрузка детей ---
async function loadChildren() {
  childrenLoading.style.display = 'block';
  childrenContent.style.display = 'none';

  try {
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
            <a href="../../services/family/birth/index.html" class="btn-primary">Зарегистрировать рождение</a>
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