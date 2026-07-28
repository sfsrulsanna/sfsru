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
    .select('id, personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender')
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

// --- Получение последнего активного свидетельства о браке ---
async function getLastMarriageCertificate() {
  try {
    const { data, error } = await supabase
      .schema('documents_certificates')
      .from('marriage')
      .select('*')
      .or(`personal_code.eq.${currentUserPersonalCode},wife_personal_code.eq.${currentUserPersonalCode}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('Ошибка загрузки свидетельства о браке:', err);
    return null;
  }
}

// --- Получение последнего активного свидетельства о разводе ---
async function getLastDivorceCertificate() {
  try {
    const { data, error } = await supabase
      .schema('documents_certificates')
      .from('divorce')
      .select('*')
      .or(`personal_code.eq.${currentUserPersonalCode},wife_personal_code.eq.${currentUserPersonalCode}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('Ошибка загрузки свидетельства о разводе:', err);
    return null;
  }
}

// --- Получение связи с супругом (таблица marriages) ---
async function getSpouseLink() {
  try {
    const { data, error } = await supabase
      .schema('documents_certificates')
      .from('marriages')
      .select('*')
      .or(`personal_code.eq.${currentUserPersonalCode},wife_personal_code.eq.${currentUserPersonalCode}`)
      .in('status', ['active', 'divorced'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('Ошибка загрузки связи с супругом:', err);
    return null;
  }
}

// --- Получение данных пользователя по личному коду ---
async function getUserDataByPersonalCode(personalCode) {
  if (!personalCode) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id, surname, name, patronymic, date_of_birth, place_of_birth, personal_code, gender')
    .eq('personal_code', personalCode)
    .maybeSingle();
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
    // 1. Сначала ищем активный брак
    let certificate = await getLastMarriageCertificate();
    let isDivorce = false;
    if (!certificate) {
      certificate = await getLastDivorceCertificate();
      isDivorce = true;
    }

    // 2. Получаем связь с супругом (таблица marriages)
    const spouseLink = await getSpouseLink();

    let html = '';

    // --- Карточка свидетельства о браке/разводе ---
    if (!certificate) {
      html += `
        <div class="certificate-card no-data">
          <p>У вас нет свидетельства о браке или разводе.</p>
          <div class="no-data-actions">
            <a href="../../services/documents/marriage-certificate/" class="btn-primary">Получить свидетельство о браке</a>
          </div>
        </div>
      `;
    } else {
      const isMarriage = !isDivorce;
      const myCode = currentUserPersonalCode;
      // Определяем код супруга
      const partnerCode = certificate.personal_code === myCode 
        ? certificate.wife_personal_code 
        : certificate.personal_code;
      
      const dateField = isMarriage ? certificate.marriage_date : certificate.divorce_date;
      const dateLabel = isMarriage ? 'Дата заключения брака' : 'Дата развода';
      const title = isMarriage ? 'Свидетельство о браке' : 'Свидетельство о разводе';
      const statusText = isMarriage ? '✅ Брак действителен' : '❌ Брак расторгнут';
      const statusClass = isMarriage ? 'active' : 'divorced';

      // Получаем ФИО супруга
      let partnerName = partnerCode || '—';
      const partnerUser = await getUserDataByPersonalCode(partnerCode);
      if (partnerUser) {
        partnerName = `${partnerUser.surname} ${partnerUser.name} ${partnerUser.patronymic || ''}`.trim();
      }

      // Ссылка на страницу просмотра
      const viewLink = isMarriage 
        ? '../../documents/certificates/marriage-certificate.html' 
        : '../../documents/certificates/divorce-certificate.html';

      html += `
        <div class="marriage-card certificate-card ${statusClass}">
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
    }

    // --- Карточка связи с супругом (таблица marriages) ---
    html += `<div class="spouse-link-card">`;
    html += `<h3>Связь с супругом</h3>`;

    if (spouseLink) {
      const isActive = spouseLink.status === 'active';
      const myCode = currentUserPersonalCode;
      const partnerCode = spouseLink.personal_code === myCode 
        ? spouseLink.wife_personal_code 
        : spouseLink.personal_code;

      // Проверяем, есть ли у нас данные супруга
      const spouseData = partnerCode ? await getUserDataByPersonalCode(partnerCode) : null;

      if (spouseData) {
        // Связь подтверждена (есть данные супруга)
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
        if (!isActive) {
          html += `<p class="text-muted">Брак расторгнут.</p>`;
        }
      } else if (partnerCode) {
        // Есть код супруга, но пользователь не найден в системе – показываем краткую информацию
        html += `
          <div class="spouse-info">
            <div class="spouse-avatar">?</div>
            <div class="spouse-details">
              <div class="spouse-name">Супруг не зарегистрирован в системе</div>
              <div class="spouse-meta">Личный код: ${partnerCode}</div>
            </div>
          </div>
          <p class="text-muted">Для получения полных данных супруг должен зарегистрироваться в системе.</p>
        `;
      } else {
        html += `<p class="text-muted">Нет данных о супруге.</p>`;
      }
    } else {
      // Нет записи в marriages – предложить создать
      html += `
        <div class="no-data">
          <p>У вас нет активной связи с супругом.</p>
          <button class="btn-primary" id="createMarriageLinkBtn">Создать связь</button>
        </div>
      `;
    }

    html += `</div>`;

    marriageContent.innerHTML = html;
    marriageLoading.style.display = 'none';
    marriageContent.style.display = 'block';

    // --- Обработчики для кнопок ---
    const createLinkBtn = document.getElementById('createMarriageLinkBtn');
    if (createLinkBtn) {
      createLinkBtn.addEventListener('click', () => {
        const partnerCode = prompt('Введите личный код супруга для создания связи:');
        if (partnerCode) {
          createMarriageLink(partnerCode);
        }
      });
    }

  } catch (err) {
    console.error('Ошибка рендера блока брака:', err);
    marriageLoading.style.display = 'none';
    marriageContent.style.display = 'block';
    marriageContent.innerHTML = `<p class="error">Не удалось загрузить данные.</p>`;
  }
}

// --- Создание новой связи (вставка в marriages) ---
async function createMarriageLink(partnerCode) {
  try {
    // Проверяем, что пользователь не пытается создать связь с самим собой
    if (partnerCode === currentUserPersonalCode) {
      alert('Нельзя создать связь с самим собой.');
      return;
    }

    // Проверяем, существует ли пользователь с таким личным кодом
    const { data: partner, error: findErr } = await supabase
      .from('users')
      .select('personal_code')
      .eq('personal_code', partnerCode)
      .maybeSingle();
    if (findErr || !partner) {
      alert('Пользователь с таким личным кодом не найден в системе.');
      return;
    }

    // Проверяем, нет ли уже активной связи
    const { data: existing } = await supabase
      .schema('documents_certificates')
      .from('marriages')
      .select('id')
      .or(`personal_code.eq.${currentUserPersonalCode},wife_personal_code.eq.${currentUserPersonalCode}`)
      .eq('status', 'active')
      .maybeSingle();
    if (existing) {
      alert('У вас уже есть активная связь с супругом.');
      return;
    }

    // Вставляем запись
    const { error: insertErr } = await supabase
      .schema('documents_certificates')
      .from('marriages')
      .insert({
        personal_code: currentUserPersonalCode,
        wife_personal_code: partnerCode,
        marriage_date: new Date().toISOString().slice(0,10),
        status: 'active'
      });

    if (insertErr) {
      alert('Ошибка создания связи: ' + insertErr.message);
      return;
    }

    alert('Связь создана!');
    await renderMarriageBlock();
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

// Экспорт функций (не используется, но для совместимости)
window.createMarriageLink = createMarriageLink;