import { supabase } from '../../../js/supabase-config.js';

// Глобальные переменные
let userPersonalCode = null;
let currentPageIndex = 0;
let pagesData = [];
let totalPages = 0;
let flipAnimationTimeout = null;
let activePassport = null;   // текущий активный паспорт
let archivedPassports = [];   // архивные паспорта

// Вспомогательные функции
function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
  } catch {
    return dateString;
  }
}

function escapeHTML(str) {
  if (!str) return '—';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function getStatusLabel(status) {
  if (status === 'verified') return '✅ Подтверждено';
  if (status === 'oncheck') return '⏳ На проверке';
  if (status === 'rejected') return '❌ Отклонено';
  if (status === 'archived') return '📦 Архивный';
  return '—';
}

function getStatusClass(status) {
  if (status === 'verified') return 'document-status status-verified';
  if (status === 'oncheck') return 'document-status status-pending';
  if (status === 'rejected') return 'document-status status-rejected';
  if (status === 'archived') return 'document-status status-archived';
  return 'document-status';
}

async function getPassportPhotoSignedUrl(personalCode) {
  if (!personalCode) return null;
  try {
    const filePath = `passport/${encodeURIComponent(personalCode)}/photo.jpg`;
    const { data, error } = await supabase.storage
      .from('documents-files')
      .createSignedUrl(filePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  } catch (err) {
    console.warn('Фото не найдено:', err.message);
    return null;
  }
}

// Загрузка профиля пользователя
async function loadUserProfile() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    window.location.href = '../../login.html';
    return null;
  }
  const { data, error } = await supabase
    .from('users')
    .select('personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender')
    .eq('id', session.user.id)
    .single();
  if (error) {
    console.error('Ошибка загрузки профиля:', error);
    return null;
  }
  userPersonalCode = data.personal_code;
  return data;
}

// Загрузка всех паспортов пользователя
async function loadAllPassports() {
  try {
    const profile = await loadUserProfile();
    if (!profile) return { active: null, archived: [] };

    const { data: passports, error } = await supabase
      .schema('documents')
      .from('passport')
      .select('*')
      .eq('personal_code', userPersonalCode)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!passports || passports.length === 0) return { active: null, archived: [] };

    // Активный – первый не архивный
    const active = passports.find(p => p.status !== 'archived');
    const archived = passports.filter(p => p.status === 'archived');
    return { active, archived };
  } catch (err) {
    console.error('Ошибка загрузки паспортов:', err);
    return { active: null, archived: [] };
  }
}

// Построение HTML для каждой страницы (на основе активного паспорта)
async function buildPages(passportData) {
  const pages = [];

  // Страница 1 – обложка
  pages.push(`
    <div class="page page-cover">
      <div class="cover-content">
        <div class="cover-title">СОВЕТСКАЯ ФЕДЕРАТИВНАЯ СОЦИАЛИСТИЧЕСКАЯ РЕСПУБЛИКА ЮЛЬСАННА</div>
        <img src="../../images/gerb.png" alt="Герб" class="cover-gerb" />
        <div class="cover-gold-text">ПАСПОРТ</div>
      </div>
      <div class="page-number">1</div>
    </div>
  `);

  // Страница 2-3 – личные данные + фото, QR, штрихкод
  const photoUrl = await getPassportPhotoSignedUrl(passportData.personal_code);
  pages.push(`
    <div class="page">
      <h2>Личные данные</h2>
      <div class="photo-row">
        <img id="passportAvatar" src="${photoUrl || '../../images/default-avatar.png'}" class="passport-photo" alt="Фото" />
        <div class="qr-barcode">
          <div id="passportQrCode"></div>
          <svg id="passportBarcode" class="barcode"></svg>
        </div>
      </div>
      <div class="data-row"><div class="data-label">Фамилия</div><div class="data-value">${escapeHTML(passportData.surname || '—')}</div></div>
      <div class="data-row"><div class="data-label">Имя</div><div class="data-value">${escapeHTML(passportData.name || '—')}</div></div>
      <div class="data-row"><div class="data-label">Отчество</div><div class="data-value">${escapeHTML(passportData.patronymic || '—')}</div></div>
      <div class="data-row"><div class="data-label">Дата рождения</div><div class="data-value">${formatDate(passportData.birth_date)}</div></div>
      <div class="data-row"><div class="data-label">Место рождения</div><div class="data-value">${escapeHTML(passportData.birth_place || '—')}</div></div>
      <div class="data-row"><div class="data-label">Пол</div><div class="data-value">${escapeHTML(passportData.gender || '—')}</div></div>
      <div class="data-row"><div class="data-label">Личный код</div><div class="data-value">${escapeHTML(passportData.personal_code || '—')}</div></div>
      <div class="data-row"><div class="data-label">Серия и номер</div><div class="data-value series-number">${escapeHTML(passportData.series_number || '—')}</div></div>
      <div class="data-row"><div class="data-label">Дата выдачи</div><div class="data-value">${formatDate(passportData.issue_date)}</div></div>
      <div class="data-row"><div class="data-label">Срок действия</div><div class="data-value">${formatDate(passportData.expiry_date)}</div></div>
      <div class="data-row"><div class="data-label">Кем выдан</div><div class="data-value">${escapeHTML(passportData.issued_by || '—')}</div></div>
      <div class="data-row"><div class="data-label">Код подразделения</div><div class="data-value">${escapeHTML(passportData.department_code || '—')}</div></div>
      <div class="page-number">2-3</div>
    </div>
  `);

  // Страница 5 – прописка
  let residencesHtml = '<p>Нет данных о регистрации</p>';
  if (passportData.residences && passportData.residences.length) {
    residencesHtml = `
      <table class="small-table">
        <thead> <tr><th>Адрес</th><th>Дата регистрации</th><th>Дата снятия</th><th>Тип жилья</th></tr> </thead>
        <tbody>
          ${passportData.residences.map(r => `
            <tr>
              <td>${escapeHTML(r.address || '—')}</td>
              <td>${formatDate(r.registrationDate)}</td>
              <td>${formatDate(r.deregistrationDate)}</td>
              <td>${escapeHTML(r.housingType || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  pages.push(`
    <div class="page">
      <h2>Прописка / регистрация</h2>
      <div class="table-section">${residencesHtml}</div>
      <div class="page-number">5</div>
    </div>
  `);

  // Страница 13 – воинская обязанность
  const militaryHtml = passportData.is_military_obligated !== undefined ? `
    <div class="data-row"><div class="data-label">Военнообязанный</div><div class="data-value">${passportData.is_military_obligated ? 'Да' : 'Нет'}</div></div>
    <div class="data-row"><div class="data-label">Военный билет</div><div class="data-value">${escapeHTML(passportData.military_idn || '—')}</div></div>
  ` : '<p>Нет данных о воинской обязанности</p>';
  pages.push(`
    <div class="page">
      <h2>Воинская обязанность</h2>
      ${militaryHtml}
      <div class="page-number">13</div>
    </div>
  `);

  // Страница 14 – семейное положение
  let maritalHtml = '<p>Нет данных</p>';
  if (passportData.marital_statuses && passportData.marital_statuses.length) {
    maritalHtml = `
      <table class="small-table">
        <thead> <tr><th>Статус</th><th>Дата изменения</th><th>ФИО супруга</th><th>Номер акта</th></tr> </thead>
        <tbody>
          ${passportData.marital_statuses.map(m => `
            <tr>
              <td>${escapeHTML(m.status || '—')}</td>
              <td>${formatDate(m.changeDate)}</td>
              <td>${escapeHTML(m.spouseName || '—')}</td>
              <td>${escapeHTML(m.actNumber || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  pages.push(`
    <div class="page">
      <h2>Семейное положение</h2>
      ${maritalHtml}
      <div class="page-number">14</div>
    </div>
  `);

  // Страницы 16-19 – ранее выданные документы
  let prevDocsHtml = '<p>Нет данных о ранее выданных документах</p>';
  const prevPass = passportData.previous_passports || [];
  const prevForeign = passportData.previous_foreign_passports || [];
  const prevId = passportData.previous_id_cards || [];
  if (prevPass.length || prevForeign.length || prevId.length) {
    prevDocsHtml = '';
    if (prevPass.length) {
      prevDocsHtml += `<h3>Ранее выданные паспорта</h3>
        <table class="small-table"><thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th><th>Причина замены</th></tr></thead>
        <tbody>${prevPass.map(p => `
          <tr><td>${escapeHTML(p.seriesNumber || '—')}</td><td>${formatDate(p.issueDate)}</td><td>${escapeHTML(p.issuedBy || '—')}</td><td>${escapeHTML(p.reason || '—')}</td></tr>
        `).join('')}</tbody></table>`;
    }
    if (prevForeign.length) {
      prevDocsHtml += `<h3>Заграничные паспорта</h3>
        <table class="small-table"><thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th></tr></thead>
        <tbody>${prevForeign.map(p => `
          <tr><td>${escapeHTML(p.seriesNumber || '—')}</td><td>${formatDate(p.issueDate)}</td><td>${escapeHTML(p.issuedBy || '—')}</td></tr>
        `).join('')}</tbody></table>`;
    }
    if (prevId.length) {
      prevDocsHtml += `<h3>ID-карты</h3>
        <table class="small-table"><thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th></tr></thead>
        <tbody>${prevId.map(p => `
          <tr><td>${escapeHTML(p.seriesNumber || '—')}</td><td>${formatDate(p.issueDate)}</td><td>${escapeHTML(p.issuedBy || '—')}</td></tr>
        `).join('')}</tbody></table>`;
    }
  }
  pages.push(`
    <div class="page">
      <h2>Ранее выданные документы</h2>
      <div class="table-section">${prevDocsHtml}</div>
      <div class="page-number">16-19</div>
    </div>
  `);

  return pages;
}

// Отображение статуса текущего паспорта
function renderStatus(passport) {
  const statusBlock = document.getElementById('statusBlock');
  if (!statusBlock) return;
  const statusText = getStatusLabel(passport.status);
  const statusClass = getStatusClass(passport.status);
  statusBlock.innerHTML = `<span class="${statusClass}">${statusText}</span>`;
  statusBlock.style.display = 'block';
}

// Отображение архивных паспортов
function renderArchivedPassports(archived) {
  const block = document.getElementById('archivedBlock');
  const container = document.getElementById('archivedPassports');
  if (!block || !container) return;

  if (!archived.length) {
    block.style.display = 'none';
    return;
  }

  container.innerHTML = archived.map(p => `
    <div class="archived-card">
      <h4>${escapeHTML(p.series_number || '—')}</h4>
      <p><strong>Дата выдачи:</strong> ${formatDate(p.issue_date)}</p>
      <p><strong>Срок действия:</strong> ${formatDate(p.expiry_date)}</p>
      <p><strong>Кем выдан:</strong> ${escapeHTML(p.issued_by || '—')}</p>
      <span class="status-badge">Архивный</span>
    </div>
  `).join('');

  block.style.display = 'block';
}

// Отрисовка книги
async function renderBook(passportData) {
  pagesData = await buildPages(passportData);
  totalPages = pagesData.length;
  currentPageIndex = 0;

  const container = document.getElementById('bookPages');
  container.innerHTML = pagesData[currentPageIndex];

  // Генерация QR и штрихкода для страницы 2-3 (немного задержка)
  setTimeout(() => {
    const qrDiv = document.getElementById('passportQrCode');
    if (qrDiv && passportData.personal_code) {
      qrDiv.innerHTML = '';
      new QRCode(qrDiv, {
const qrText = `https://sfsru.vercel.app/epass/view/passport.html?personal_code=${passport.personal_code}`;
        width: 80, height: 80,
        colorDark: '#000', colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L
      });
    }
    const seriesNumber = (passportData.series_number || '').replace(/\s/g, '');
    if (seriesNumber.length >= 6) {
      try {
        JsBarcode("#passportBarcode", seriesNumber, { format: "CODE128", displayValue: false, height: 40, margin: 0 });
      } catch(e) {}
    }
  }, 100);

  document.getElementById('passportBook').style.display = 'block';
  document.getElementById('loading').style.display = 'none';
  updateButtons();
}

function updateButtons() {
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  prevBtn.disabled = currentPageIndex === 0;
  nextBtn.disabled = currentPageIndex === totalPages - 1;
}

function flipPage(direction) {
  if (flipAnimationTimeout) return;
  const container = document.getElementById('bookPages');
  container.classList.add(direction === 'next' ? 'flipping-left' : 'flipping-right');
  flipAnimationTimeout = setTimeout(() => {
    container.classList.remove('flipping-left', 'flipping-right');
    if (direction === 'next' && currentPageIndex < totalPages - 1) {
      currentPageIndex++;
      container.innerHTML = pagesData[currentPageIndex];
      updateButtons();
    } else if (direction === 'prev' && currentPageIndex > 0) {
      currentPageIndex--;
      container.innerHTML = pagesData[currentPageIndex];
      updateButtons();
    }
    flipAnimationTimeout = null;
  }, 500);
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const noDataEl = document.getElementById('noData');

  // Загружаем все паспорта
  const { active, archived } = await loadAllPassports();
  if (!active) {
    loadingEl.style.display = 'none';
    noDataEl.style.display = 'block';
    return;
  }

  activePassport = active;
  archivedPassports = archived;

  // Отображаем статус
  renderStatus(active);

  // Отображаем архивные паспорта
  renderArchivedPassports(archived);

  // Рендерим книгу
  await renderBook(active);

  // Навешиваем обработчики кнопок
  document.getElementById('prevPageBtn').addEventListener('click', () => flipPage('prev'));
  document.getElementById('nextPageBtn').addEventListener('click', () => flipPage('next'));
});