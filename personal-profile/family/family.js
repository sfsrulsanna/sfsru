import { supabase } from '../../js/supabase-config.js';

// --- DOM элементы ---
const marriageLoading = document.getElementById('marriageLoading');
const marriageContent = document.getElementById('marriageContent');
const childrenLoading = document.getElementById('childrenLoading');
const childrenContent = document.getElementById('childrenContent');

let currentUserPersonalCode = null;
let currentUserData = null;

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
  currentUserData = data;
  currentUserPersonalCode = data.personal_code;
  return true;
}

// --- Получение данных пользователя по личному коду ---
async function getUserByPersonalCode(personalCode) {
  if (!personalCode) return null;
  const { data, error } = await supabase
    .from('users')
    .select('surname, name, patronymic, date_of_birth, place_of_birth, personal_code, gender')
    .eq('personal_code', personalCode)
    .maybeSingle();
  if (error) {
    console.warn('Не удалось загрузить пользователя по коду:', error);
    return null;
  }
  return data;
}

// --- Получение последнего свидетельства о браке ---
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

// --- Получение последнего свидетельства о разводе ---
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

// --- Рендер всего блока "Брак и развод" ---
async function renderMarriageBlock() {
  marriageLoading.style.display = 'block';
  marriageContent.style.display = 'none';
  marriageContent.innerHTML = '';

  try {
    // 1. Получаем свидетельство о браке
    let certificate = await getLastMarriageCertificate();
    let isDivorce = false;

    // 2. Если брака нет, ищем развод
    if (!certificate) {
      certificate = await getLastDivorceCertificate();
      isDivorce = true;
    }

    // 3. Получаем связь с супругом (таблица marriages)
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
      const partnerCode = certificate.personal_code === currentUserPersonalCode 
        ? certificate.wife_personal_code 
        : certificate.personal_code;
      const dateField = isMarriage ? certificate.marriage_date : certificate.divorce_date;
      const dateLabel = isMarriage ? 'Дата заключения брака' : 'Дата развода';
      const title = isMarriage ? 'Свидетельство о браке' : 'Свидетельство о разводе';
      const statusText = isMarriage ? '✅ Брак действителен' : '❌ Брак расторгнут';
      const statusClass = isMarriage ? 'active' : 'divorced';

      let partnerName = partnerCode || '—';
      const partnerData = await getUserByPersonalCode(partnerCode);
      if (partnerData) {
        partnerName = `${partnerData.surname} ${partnerData.name} ${partnerData.patronymic || ''}`.trim();
      }

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
    html += `<h3>Связь с супругом (для автозаполнения)</h3>`;

    if (spouseLink) {
      const isActive = spouseLink.status === 'active';
      const isDivorced = spouseLink.status === 'divorced';
      const partnerCode = spouseLink.personal_code === currentUserPersonalCode 
        ? spouseLink.wife_personal_code 
        : spouseLink.personal_code;

      if (partnerCode) {
        const partnerData = await getUserByPersonalCode(partnerCode);
        if (partnerData) {
          const fullName = `${partnerData.surname} ${partnerData.name} ${partnerData.patronymic || ''}`.trim();
          const avatarLetter = (partnerData.name?.[0] || '?').toUpperCase();
          html += `
            <div class="spouse-info">
              <div class="spouse-avatar">${avatarLetter}</div>
              <div class="spouse-details">
                <div class="spouse-name">${fullName}</div>
                <div class="spouse-meta">${partnerData.date_of_birth ? 'Дата рождения: ' + formatDate(partnerData.date_of_birth) : ''}</div>
                <div class="spouse-meta">${partnerData.place_of_birth ? 'Место рождения: ' + partnerData.place_of_birth : ''}</div>
                <div class="spouse-meta">Личный код: ${partnerData.personal_code}</div>
              </div>
            </div>
          `;
        } else {
          // Супруг найден в marriages, но не в users (редкий случай)
          html += `
            <div class="spouse-info">
              <div class="spouse-details">
                <div class="spouse-name">Супруг(а) не найден(а) в системе</div>
                <div class="spouse-meta">Личный код: ${partnerCode}</div>
              </div>
            </div>
          `;
        }
      } else {
        html += `<p class="text-muted">Нет данных о супруге.</p>`;
      }

      if (isDivorced) {
        html += `<p class="text-muted">Брак расторгнут.</p>`;
      }
    } else {
      // Нет записи в marriages
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

    // --- Обработчик для кнопки создания связи ---
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
    if (!partnerCode || partnerCode.trim() === '') {
      alert('Введите личный код супруга.');
      return;
    }

    if (partnerCode === currentUserPersonalCode) {
      alert('Нельзя создать связь с самим собой.');
      return;
    }

    // Проверяем, существует ли пользователь с таким кодом
    const partner = await getUserByPersonalCode(partnerCode);
    if (!partner) {
      alert('Пользователь с таким личным кодом не найден в системе.');
      return;
    }

    // Проверяем, нет ли уже связи
    const existing = await getSpouseLink();
    if (existing) {
      alert('У вас уже есть активная связь. Если хотите обновить, удалите существующую.');
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

    alert('Связь успешно создана!');
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