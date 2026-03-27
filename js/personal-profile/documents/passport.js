import { supabase } from '../../../js/supabase-config.js';

// -------------------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ --------------------
let userPersonalCode = null;
let currentDocId = null;          // ID текущего (активного) паспорта
let userProfile = null;

// -------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ --------------------
function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateString;
  }
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

function escapeHTML(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

// -------------------- ЗАГРУЗКА ПРОФИЛЯ --------------------
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
  userProfile = data;
  return data;
}

// -------------------- ЗАГРУЗКА ПАСПОРТОВ (активный + архивные) --------------------
async function loadPassports() {
  try {
    const profile = await loadUserProfile();
    if (!profile) return;

    // Получаем все паспорта пользователя
    const { data: allPassports, error } = await supabase
      .schema('documents')
      .from('passport')
      .select('*')
      .eq('personal_code', userPersonalCode)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!allPassports || allPassports.length === 0) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('noData').style.display = 'block';
      return;
    }

    // Разделяем: активные (не архивные) и архивные
    const activePassports = allPassports.filter(p => p.status !== 'archived');
    const archivedPassports = allPassports.filter(p => p.status === 'archived');

    if (activePassports.length === 0) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('noData').style.display = 'block';
      return;
    }

    // Активный паспорт – самый свежий (по created_at)
    const active = activePassports[0];
    currentDocId = active.id;

    // Отображаем активный паспорт
    renderPassport(active);

    // Отображаем архивные паспорта
    if (archivedPassports.length > 0) {
      renderArchivedPassports(archivedPassports);
    }

    // Скрываем загрузку
    document.getElementById('loading').style.display = 'none';
  } catch (err) {
    console.error('Ошибка загрузки паспортов:', err);
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.textContent = 'Ошибка загрузки данных';
  }
}

// -------------------- ОТРИСОВКА АКТИВНОГО ПАСПОРТА --------------------
function renderPassport(data) {
  const statusText = getStatusLabel(data.status);
  const statusClass = getStatusClass(data.status);

  const html = `
    <div class="passport-template">
      <div class="passport-header">
        <div class="country-name">СФСР ЮЛЬСАННА</div>
        <div class="document-type">ПАСПОРТ</div>
      </div>
      <div class="passport-content">
        <div class="data-field">
          <div class="field-label">Серия и номер</div>
          <div class="field-value series-number">${escapeHTML(data.series_number || '—')}</div>
        </div>
        <div class="data-field">
          <div class="field-label">Дата выдачи</div>
          <div class="field-value">${formatDate(data.issue_date)}</div>
        </div>
        <div class="data-field">
          <div class="field-label">Срок действия</div>
          <div class="field-value">${formatDate(data.expiry_date)}</div>
        </div>
        <div class="data-field">
          <div class="field-label">Кем выдан</div>
          <div class="field-value">${escapeHTML(data.issued_by || '—')}</div>
        </div>
        <div class="data-field">
          <div class="field-label">Код подразделения</div>
          <div class="field-value">${escapeHTML(data.department_code || '—')}</div>
        </div>
        <div class="data-field">
          <div class="field-label">Личный код</div>
          <div class="field-value">${escapeHTML(data.personal_code || '—')}</div>
        </div>

        <div class="passport-divider"></div>

        <div class="passport-lower">
          <div class="photo-barcode-section">
            <div class="passport-photo-container">
              <img id="passportAvatar" src="../../images/default-avatar.png" alt="Фото" class="passport-photo" />
            </div>
            <div class="barcode-container">
              <svg id="passportBarcode" class="barcode"></svg>
            </div>
            <div style="text-align: center; margin-top: 15px;">
              <div id="passportQrCode" style="display: inline-block; width: 80px; height: 80px;"></div>
            </div>
          </div>

          <div class="fio-section">
            <div class="data-field">
              <div class="field-label">Фамилия</div>
              <div class="field-value">${escapeHTML(data.surname || '—')}</div>
            </div>
            <div class="data-field">
              <div class="field-label">Имя</div>
              <div class="field-value">${escapeHTML(data.name || '—')}</div>
            </div>
            <div class="data-field">
              <div class="field-label">Отчество</div>
              <div class="field-value">${escapeHTML(data.patronymic || '—')}</div>
            </div>
            <div class="data-field">
              <div class="field-label">Пол</div>
              <div class="field-value">${escapeHTML(data.gender || '—')}</div>
            </div>
            <div class="data-field">
              <div class="field-label">Дата рождения</div>
              <div class="field-value">${formatDate(data.birth_date)}</div>
            </div>
            <div class="data-field">
              <div class="field-label">Место рождения</div>
              <div class="field-value">${escapeHTML(data.birth_place || '—')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="status-and-edit">
      <span class="${statusClass}">${statusText}</span>
    </div>
  `;

  document.getElementById('passportContent').innerHTML = html;
  document.getElementById('passportContent').style.display = 'block';

  // QR и штрихкод
  const personalCode = data.personal_code || '';
  if (personalCode) {
    const qrContainer = document.getElementById('passportQrCode');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      new QRCode(qrContainer, {
        text: `https://e-pass-sfsru.web.app/${personalCode}/`,
        width: 80,
        height: 80,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L
      });
    }

    const avatarImg = document.getElementById('passportAvatar');
    if (avatarImg) {
      avatarImg.src = '../../images/default-avatar.png';
      getPassportPhotoSignedUrl(personalCode).then(url => {
        if (url) avatarImg.src = url;
      });
    }
  }

  const seriesNumber = (data.series_number || '').replace(/\s/g, '');
  if (seriesNumber.length >= 6) {
    try {
      JsBarcode("#passportBarcode", seriesNumber, {
        format: "CODE128",
        displayValue: false,
        height: 50,
        margin: 0
      });
    } catch(e) {}
  }

  // Сохраняем дополнительные данные для кнопки "Подробная информация"
  window.extraData = data;
}

// -------------------- ОТРИСОВКА АРХИВНЫХ ПАСПОРТОВ (карточки) --------------------
function renderArchivedPassports(passports) {
  const container = document.getElementById('archivedPassports');
  const block = document.getElementById('archivedBlock');

  if (!passports.length) {
    block.style.display = 'none';
    return;
  }

  container.innerHTML = passports.map(p => `
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

// -------------------- ДОПОЛНИТЕЛЬНЫЕ СЕКЦИИ (рендерим при клике) --------------------
function renderExtraSections(data) {
  let extraHtml = '';

  if (data.residences && data.residences.length) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-home"></i> История регистрации</h3>
      <div class="info-table">
        <table>
          <thead><tr><th>Адрес</th><th>Дата регистрации</th><th>Дата снятия</th><th>Тип жилья</th></tr></thead>
          <tbody>
            ${data.residences.map(r => `
              <tr>
                <td>${escapeHTML(r.address || '—')}</td>
                <td>${formatDate(r.registrationDate)}</td>
                <td>${formatDate(r.deregistrationDate)}</td>
                <td>${escapeHTML(r.housingType || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (data.marital_statuses && data.marital_statuses.length) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-heart"></i> Семейное положение</h3>
      <div class="info-table">
        <table>
          <thead><tr><th>Статус</th><th>Дата изменения</th><th>ФИО супруга</th><th>Номер акта</th></tr></thead>
          <tbody>
            ${data.marital_statuses.map(m => `
              <tr>
                <td>${escapeHTML(m.status || '—')}</td>
                <td>${formatDate(m.changeDate)}</td>
                <td>${escapeHTML(m.spouseName || '—')}</td>
                <td>${escapeHTML(m.actNumber || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (data.is_military_obligated !== undefined) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-shield-alt"></i> Военная обязанность</h3>
      <div class="info-table">
        <table>
          <thead><tr><th>Военнообязанный</th><th>Военный билет</th></tr></thead>
          <tbody>
            <tr>
              <td>${data.is_military_obligated ? 'Да' : 'Нет'}</td>
              <td>${escapeHTML(data.military_idn || '—')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  if (data.previous_passports && data.previous_passports.length) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-history"></i> Ранее выданные паспорта</h3>
      <div class="info-table">
        <table>
          <thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th><th>Причина замены</th></tr></thead>
          <tbody>
            ${data.previous_passports.map(p => `
              <tr>
                <td>${escapeHTML(p.seriesNumber || '—')}</td>
                <td>${formatDate(p.issueDate)}</td>
                <td>${escapeHTML(p.issuedBy || '—')}</td>
                <td>${escapeHTML(p.reason || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (data.previous_foreign_passports && data.previous_foreign_passports.length) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-passport"></i> Ранее выданные заграничные паспорта</h3>
      <div class="info-table">
        <table>
          <thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th></tr></thead>
          <tbody>
            ${data.previous_foreign_passports.map(p => `
              <tr>
                <td>${escapeHTML(p.seriesNumber || '—')}</td>
                <td>${formatDate(p.issueDate)}</td>
                <td>${escapeHTML(p.issuedBy || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (data.previous_id_cards && data.previous_id_cards.length) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-id-card"></i> Ранее выданные ID-карты</h3>
      <div class="info-table">
        <table>
          <thead><tr><th>Серия и номер</th><th>Дата выдачи</th><th>Кем выдан</th></tr></thead>
          <tbody>
            ${data.previous_id_cards.map(p => `
              <tr>
                <td>${escapeHTML(p.seriesNumber || '—')}</td>
                <td>${formatDate(p.issueDate)}</td>
                <td>${escapeHTML(p.issuedBy || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const extraContainer = document.getElementById('extraSections');
  extraContainer.innerHTML = extraHtml;
}

// -------------------- ИНИЦИАЛИЗАЦИЯ --------------------
document.addEventListener('DOMContentLoaded', async () => {
  await loadPassports();

  // Кнопка "Подробная информация" – показывает/скрывает дополнительные секции
  const detailsBtn = document.getElementById('showDetailsBtn');
  const extraContainer = document.getElementById('extraSections');

  if (detailsBtn && extraContainer) {
    detailsBtn.addEventListener('click', () => {
      if (extraContainer.style.display === 'none' || !extraContainer.style.display) {
        // Если секции ещё не отрендерены, рендерим их
        if (window.extraData && extraContainer.innerHTML === '') {
          renderExtraSections(window.extraData);
        }
        extraContainer.style.display = 'block';
        detailsBtn.innerHTML = '<i class="fas fa-info-circle"></i> Скрыть подробную информацию';
      } else {
        extraContainer.style.display = 'none';
        detailsBtn.innerHTML = '<i class="fas fa-info-circle"></i> Подробная информация';
      }
    });
  }
});