import { supabase } from '../../js/supabase-config.js';

// --- DOM элементы ---
const marriageLoading = document.getElementById('marriageLoading');
const marriageContent = document.getElementById('marriageContent');
const childrenLoading = document.getElementById('childrenLoading');
const childrenContent = document.getElementById('childrenContent');

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
    .select('personal_code')
    .eq('id', session.user.id)
    .single();
  if (error) {
    console.error('Ошибка загрузки пользователя:', error);
    return false;
  }
  currentUserPersonalCode = data.personal_code;
  return true;
}

// --- Получение последнего свидетельства о браке (любой статус) ---
async function getLastMarriage() {
  const { data, error } = await supabase
    .schema('documents_certificates')
    .from('marriage')
    .select('*')
    .or(`personal_code.eq.${currentUserPersonalCode},wife_personal_code.eq.${currentUserPersonalCode}`)
    .in('status', ['verified', 'oncheck', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('Ошибка загрузки брака:', error);
    return null;
  }
  return data && data.length > 0 ? data[0] : null;
}

// --- Получение последнего свидетельства о разводе (любой статус) ---
async function getLastDivorce() {
  const { data, error } = await supabase
    .schema('documents_certificates')
    .from('divorce')
    .select('*')
    .or(`personal_code.eq.${currentUserPersonalCode},wife_personal_code.eq.${currentUserPersonalCode}`)
    .in('status', ['verified', 'oncheck', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('Ошибка загрузки развода:', error);
    return null;
  }
  return data && data.length > 0 ? data[0] : null;
}

// --- Получение связи с супругом (из marriages) ---
async function getSpouseLink() {
  const { data, error } = await supabase
    .schema('documents_certificates')
    .from('marriages')
    .select('*')
    .or(`personal_code.eq.${currentUserPersonalCode},wife_personal_code.eq.${currentUserPersonalCode}`)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('Ошибка загрузки связи:', error);
    return null;
  }
  return data && data.length > 0 ? data[0] : null;
}

// --- Рендер блока "Брак и развод" ---
async function renderMarriageBlock() {
  marriageLoading.style.display = 'block';
  marriageContent.style.display = 'none';
  marriageContent.innerHTML = '';

  try {
    // 1. Пытаемся получить брак
    let certificate = await getLastMarriage();
    let isDivorce = false;

    // 2. Если брака нет – ищем развод
    if (!certificate) {
      certificate = await getLastDivorce();
      if (certificate) isDivorce = true;
    }

    // 3. Получаем связь с супругом
    const spouseLink = await getSpouseLink();

    marriageLoading.style.display = 'none';
    marriageContent.style.display = 'block';

    // 4. Если ничего нет – показываем пустое состояние
    if (!certificate) {
      marriageContent.innerHTML = `
        <div class="no-data">
          <p>У вас нет свидетельства о браке или разводе.</p>
          <div class="no-data-actions">
            <a href="../../services/family/marriage/index.html" class="btn-primary">Зарегистрировать брак</a>
          </div>
        </div>
      `;
      return;
    }

    // 5. Определяем данные для отображения
    const isMarriage = !isDivorce;
    const myCode = currentUserPersonalCode;
    const partnerCode = certificate.personal_code === myCode 
      ? certificate.wife_personal_code 
      : certificate.personal_code;

    const dateField = isMarriage ? certificate.marriage_date : certificate.divorce_date;
    const dateLabel = isMarriage ? 'Дата заключения брака' : 'Дата развода';
    const title = isMarriage ? 'Свидетельство о браке' : 'Свидетельство о разводе';

    // Определяем статус для отображения
    const statusMap = {
      'verified': { label: '✅ Свидетельство подтверждено', class: 'verified' },
      'oncheck': { label: '⏳ На проверке', class: 'oncheck' },
      'rejected': { label: '❌ Отклонено', class: 'rejected' }
    };
    const statusInfo = statusMap[certificate.status] || { label: certificate.status, class: 'unknown' };

    // Получаем ФИО супруга
    let partnerName = partnerCode || '—';
    if (partnerCode) {
      const { data: partnerUser } = await supabase
        .from('users')
        .select('surname, name, patronymic')
        .eq('personal_code', partnerCode)
        .maybeSingle();
      if (partnerUser) {
        partnerName = `${partnerUser.surname} ${partnerUser.name} ${partnerUser.patronymic || ''}`.trim();
      }
    }

    // Ссылка на страницу просмотра
    const viewLink = isMarriage 
      ? '../../documents/certificates/marriage-certificate.html' 
      : '../../documents/certificates/divorce-certificate.html';

    // --- Генерируем две колонки: свидетельство + супруг ---
    let html = `<div class="marriage-row">`;

    // Колонка 1: Свидетельство
    html += `
      <div class="certificate-card">
        <div class="status-badge ${statusInfo.class}">${statusInfo.label}</div>
        <h3>${title}</h3>
        <p><strong>${dateLabel}:</strong> ${formatDate(dateField)}</p>
        <p><strong>Супруг(а):</strong> ${partnerName}</p>
        <p><strong>Личный код супруга:</strong> ${partnerCode || '—'}</p>
        <div class="certificate-actions">
          <a href="${viewLink}?id=${certificate.id}" class="btn-primary">Просмотреть свидетельство</a>
        </div>
      </div>
    `;

    // Колонка 2: Супруг
    html += `<div class="spouse-card">`;
    html += `<h3>Супруг(а)</h3>`;

    if (spouseLink) {
      const spouseCode = spouseLink.personal_code === myCode ? spouseLink.wife_personal_code : spouseLink.personal_code;
      if (spouseCode) {
        const { data: spouseData } = await supabase
          .from('users')
          .select('surname, name, patronymic, date_of_birth, place_of_birth, personal_code')
          .eq('personal_code', spouseCode)
          .maybeSingle();

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
          html += `<p class="text-muted">Супруг не зарегистрирован в системе.</p>`;
        }
      } else {
        html += `<p class="text-muted">Нет данных о супруге.</p>`;
      }
    } else {
      html += `
        <div class="no-data">
          <p>Нет активной связи с супругом.</p>
          <button class="btn-primary" id="createMarriageLinkBtn">Создать связь</button>
        </div>
      `;
    }

    html += `</div>`;
    html += `</div>`; // конец marriage-row

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
        const { data: user } = await supabase
          .from('users')
          .select('personal_code')
          .eq('personal_code', partnerCode)
          .maybeSingle();
        if (!user) {
          alert('Пользователь с таким личным кодом не найден.');
          return;
        }
        const { error } = await supabase
          .schema('documents_certificates')
          .from('marriages')
          .insert({
            personal_code: currentUserPersonalCode,
            wife_personal_code: partnerCode,
            marriage_date: new Date().toISOString().slice(0,10),
            status: 'active'
          });
        if (error) {
          alert('Ошибка: ' + error.message);
        } else {
          alert('Связь создана!');
          renderMarriageBlock();
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