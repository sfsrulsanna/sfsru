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

function getFullName(user) {
  if (!user) return '';
  return `${user.surname} ${user.name} ${user.patronymic || ''}`.trim();
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
    .select('id, personal_code, surname, name, patronymic, date_of_birth, place_of_birth')
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

// --- Загрузка последнего свидетельства о браке ---
async function getLastMarriageCertificate() {
  try {
    const { data, error } = await supabase
      .schema('documents_certificates')
      .from('marriage')
      .select('*')
      .or(`user1_personal_code.eq.${currentUserPersonalCode},user2_personal_code.eq.${currentUserPersonalCode}`)
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

// --- Загрузка последнего свидетельства о разводе ---
async function getLastDivorceCertificate() {
  try {
    const { data, error } = await supabase
      .schema('documents_certificates')
      .from('divorce')
      .select('*, marriage_certificate_id')
      .or(`user1_personal_code.eq.${currentUserPersonalCode},user2_personal_code.eq.${currentUserPersonalCode}`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('Ошибка загрузки свидетельства о разводе:', err);
    return null;
  }
}

// --- Загрузка связи с супругом ---
async function getSpouseLink() {
  try {
    // Ищем связь, где пользователь является user1 или user2
    const { data, error } = await supabase
      .schema('documents_certificates')
      .from('marriages')
      .select('*, user1_id, user2_id, user1:user1_id(surname, name, patronymic, date_of_birth, place_of_birth, personal_code), user2:user2_id(surname, name, patronymic, date_of_birth, place_of_birth, personal_code)')
      .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
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

// --- Рендер блока "Свидетельства о браке/разводе" ---
async function renderCertificateBlock() {
  marriageLoading.style.display = 'block';
  marriageContent.style.display = 'none';
  marriageContent.innerHTML = '';

  try {
    // 1. Ищем активное свидетельство о браке
    const marriageCert = await getLastMarriageCertificate();
    if (marriageCert) {
      // Показываем карточку брака
      const isUser1 = marriageCert.user1_personal_code === currentUserPersonalCode;
      const spouseName = isUser1 ? marriageCert.user2_full_name : marriageCert.user1_full_name;
      const spouseCode = isUser1 ? marriageCert.user2_personal_code : marriageCert.user1_personal_code;

      let html = `
        <div class="marriage-card">
          <div class="status-badge active">✅ В браке</div>
          <p><strong>Номер свидетельства:</strong> ${marriageCert.certificate_number}</p>
          <p><strong>Дата регистрации:</strong> ${formatDate(marriageCert.registration_date)}</p>
          <p><strong>Место регистрации:</strong> ${marriageCert.registration_place || '—'}</p>
          <div class="partner-info">
            <div class="partner-details">
              <div class="partner-name">Супруг(а): ${spouseName}</div>
              <div class="partner-code">Личный код: ${spouseCode}</div>
            </div>
          </div>
          <div style="margin-top: 1rem;">
            <a href="../../documents/certificates/marriage-certificate.html?id=${marriageCert.id}" class="action-btn btn-primary">Просмотреть свидетельство</a>
          </div>
        </div>
      `;
      marriageContent.innerHTML = html;
      marriageLoading.style.display = 'none';
      marriageContent.style.display = 'block';
      return;
    }

    // 2. Если активного брака нет, ищем развод
    const divorceCert = await getLastDivorceCertificate();
    if (divorceCert) {
      const isUser1 = divorceCert.user1_personal_code === currentUserPersonalCode;
      const spouseName = isUser1 ? divorceCert.user2_full_name : divorceCert.user1_full_name;
      const spouseCode = isUser1 ? divorceCert.user2_personal_code : divorceCert.user1_personal_code;

      let html = `
        <div class="marriage-card divorce-card">
          <div class="status-badge divorced">❌ Разведены</div>
          <p><strong>Номер свидетельства:</strong> ${divorceCert.certificate_number}</p>
          <p><strong>Дата развода:</strong> ${formatDate(divorceCert.divorce_date)}</p>
          <p><strong>Причина:</strong> ${divorceCert.reason || '—'}</p>
          <div class="partner-info">
            <div class="partner-details">
              <div class="partner-name">Бывший(ая) супруг(а): ${spouseName}</div>
              <div class="partner-code">Личный код: ${spouseCode}</div>
            </div>
          </div>
          <div style="margin-top: 1rem;">
            <a href="../../documents/certificates/divorce-certificate.html?id=${divorceCert.id}" class="action-btn btn-primary">Просмотреть свидетельство</a>
          </div>
        </div>
      `;
      marriageContent.innerHTML = html;
      marriageLoading.style.display = 'none';
      marriageContent.style.display = 'block';
      return;
    }

    // 3. Нет ни брака, ни развода
    marriageLoading.style.display = 'none';
    marriageContent.style.display = 'block';
    marriageContent.innerHTML = `
      <div class="no-data">
        <p>У вас нет свидетельств о браке или разводе.</p>
        <div class="no-data-actions">
          <a href="../../services/documents/marriage-certificate/" class="btn-primary">Заключить брак</a>
        </div>
      </div>
    `;

  } catch (err) {
    console.error('Ошибка рендера свидетельств:', err);
    marriageLoading.style.display = 'none';
    marriageContent.style.display = 'block';
    marriageContent.innerHTML = `<p class="error">Не удалось загрузить данные о свидетельствах.</p>`;
  }
}

// --- Рендер блока "Супруг(а)" (связь) ---
async function renderSpouseBlock() {
  const spouseContainer = document.createElement('div');
  spouseContainer.id = 'spouseBlock';
  // Вставляем после marriageContent или в специальное место
  // Для простоты добавим после marriageContent
  const container = document.getElementById('marriageContent');
  const existingSpouse = document.getElementById('spouseBlock');
  if (existingSpouse) existingSpouse.remove();

  try {
    const link = await getSpouseLink();
    if (!link) {
      // Нет связи – предлагаем создать
      const html = `
        <div class="marriage-card" style="margin-top: 1.5rem; border: 2px dashed #ccc;">
          <h4 style="margin-bottom: 0.5rem;">Связь с супругом</h4>
          <p>У вас пока нет связи с супругом в системе.</p>
          <p style="font-size: 0.9rem; color: #6c757d;">Чтобы ваши данные супруга автоматически подставлялись в заявления, укажите его личный код.</p>
          <div style="display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap;">
            <input type="text" id="spouseCodeInput" placeholder="Введите личный код супруга" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 8px; flex: 1; min-width: 200px;" />
            <button class="action-btn btn-primary" id="addSpouseLinkBtn">Создать связь</button>
          </div>
          <div id="spouseLinkResult" style="margin-top: 0.5rem; font-weight: 500;"></div>
        </div>
      `;
      spouseContainer.innerHTML = html;
      container.appendChild(spouseContainer);

      // Обработчик создания связи
      document.getElementById('addSpouseLinkBtn').addEventListener('click', async () => {
        const code = document.getElementById('spouseCodeInput').value.trim();
        if (!code) {
          document.getElementById('spouseLinkResult').textContent = 'Введите личный код';
          document.getElementById('spouseLinkResult').style.color = '#dc3545';
          return;
        }
        // Проверяем, существует ли пользователь с таким кодом
        const { data: spouseUser, error } = await supabase
          .from('users')
          .select('id, surname, name, patronymic, personal_code')
          .eq('personal_code', code)
          .maybeSingle();
        if (error || !spouseUser) {
          document.getElementById('spouseLinkResult').textContent = 'Пользователь с таким личным кодом не найден.';
          document.getElementById('spouseLinkResult').style.color = '#dc3545';
          return;
        }
        // Проверяем, есть ли уже активная связь с этим пользователем
        const { data: existing } = await supabase
          .schema('documents_certificates')
          .from('marriages')
          .select('id')
          .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
          .eq('status', 'active')
          .maybeSingle();
        if (existing) {
          document.getElementById('spouseLinkResult').textContent = 'У вас уже есть активная связь с супругом.';
          document.getElementById('spouseLinkResult').style.color = '#dc3545';
          return;
        }
        // Создаём связь
        const { error: insertErr } = await supabase
          .schema('documents_certificates')
          .from('marriages')
          .insert({
            user1_id: currentUser.id,
            user2_id: spouseUser.id,
            marriage_date: new Date().toISOString().split('T')[0],
            status: 'active'
          });
        if (insertErr) {
          document.getElementById('spouseLinkResult').textContent = 'Ошибка создания связи: ' + insertErr.message;
          document.getElementById('spouseLinkResult').style.color = '#dc3545';
          return;
        }
        document.getElementById('spouseLinkResult').textContent = 'Связь успешно создана!';
        document.getElementById('spouseLinkResult').style.color = '#28a745';
        setTimeout(() => window.location.reload(), 1500);
      });
      return;
    }

    // Связь найдена
    const isUser1 = link.user1_id === currentUser.id;
    const spouseData = isUser1 ? link.user2 : link.user1;
    const spouseId = isUser1 ? link.user2_id : link.user1_id;

    if (!spouseData) {
      // Если данные супруга не загружены (может быть, user2_id = null)
      const html = `
        <div class="marriage-card" style="margin-top: 1.5rem;">
          <h4 style="margin-bottom: 0.5rem;">Супруг(а)</h4>
          <p>Связь с супругом не подтверждена. Ожидается подтверждение с его стороны.</p>
          <p style="font-size: 0.9rem; color: #6c757d;">Статус: ${link.status === 'active' ? 'Активен' : 'Расторгнут'}</p>
        </div>
      `;
      spouseContainer.innerHTML = html;
      container.appendChild(spouseContainer);
      return;
    }

    // Полные данные супруга
    const fullName = getFullName(spouseData);
    const birthDate = formatDate(spouseData.date_of_birth);
    const birthPlace = spouseData.place_of_birth || '—';
    const personalCode = spouseData.personal_code || '—';

    const statusText = link.status === 'active' ? 'В браке' : 'Разведены';
    const statusClass = link.status === 'active' ? 'active' : 'divorced';

    const html = `
      <div class="marriage-card" style="margin-top: 1.5rem;">
        <h4 style="margin-bottom: 0.5rem;">Супруг(а)</h4>
        <div class="status-badge ${statusClass}">${statusText}</div>
        <div class="partner-info">
          <div class="partner-avatar">${(spouseData.name?.[0] || '?').toUpperCase()}</div>
          <div class="partner-details">
            <div class="partner-name">${fullName}</div>
            <div class="partner-code">Личный код: ${personalCode}</div>
            <div class="partner-detail"><i class="fas fa-calendar-alt"></i> Дата рождения: ${birthDate}</div>
            <div class="partner-detail"><i class="fas fa-map-pin"></i> Место рождения: ${birthPlace}</div>
          </div>
        </div>
        ${link.status === 'divorced' ? '<p class="text-muted">Брак расторгнут.</p>' : ''}
      </div>
    `;
    spouseContainer.innerHTML = html;
    container.appendChild(spouseContainer);

  } catch (err) {
    console.error('Ошибка рендера блока супруга:', err);
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

  await renderCertificateBlock();
  await renderSpouseBlock();
  await loadChildren();
});