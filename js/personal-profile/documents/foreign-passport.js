import { supabase } from '../../js/supabase-config.js'

// -------------------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ --------------------
let currentStep = 1
const totalSteps = 3
let formData = {}
let userPersonalCode = null
let currentDocId = null
let userProfile = null

// -------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ --------------------
function formatDate(dateString) {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  } catch {
    return dateString
  }
}

function getStatusLabel(status) {
  if (status === 'verified') return '✅ Подтверждено'
  if (status === 'oncheck') return '⏳ На проверке'
  if (status === 'rejected') return '❌ Отклонено'
  return '—'
}

function getStatusClass(status) {
  if (status === 'verified') return 'document-status status-verified'
  if (status === 'oncheck') return 'document-status status-pending'
  if (status === 'rejected') return 'document-status status-rejected'
  return 'document-status'
}

// -------------------- ЗАГРУЗКА ПРОФИЛЯ --------------------
async function loadUserProfile() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) {
    window.location.href = '../../login.html'
    return null
  }

  const { data, error } = await supabase
    .from('users')
    .select('personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender')
    .eq('id', session.user.id)
    .single()

  if (error) {
    console.error('Ошибка загрузки профиля:', error)
    const loadingEl = document.getElementById('loading')
    if (loadingEl) loadingEl.textContent = 'Ошибка загрузки профиля. Перезагрузите страницу.'
    return null
  }

  userPersonalCode = data.personal_code
  userProfile = data
  return data
}

// -------------------- ЗАГРУЗКА ЗАГРАНПАСПОРТА --------------------
async function loadForeignPassport() {
  try {
    const profile = await loadUserProfile()
    if (!profile) return

    const urlParams = new URLSearchParams(window.location.search)
    currentDocId = urlParams.get('id')

    let data = null
    if (currentDocId) {
      const { data: doc, error } = await supabase
        .schema('documents')
        .from('foreign_passport')
        .select('*')
        .eq('id', currentDocId)
        .maybeSingle()
      if (error) throw error
      data = doc
    } else {
      const { data: docs, error } = await supabase
        .schema('documents')
        .from('foreign_passport')
        .select('*')
        .eq('personal_code', userPersonalCode)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      data = docs?.[0]
      if (data) currentDocId = data.id
    }

    if (data) {
      renderPassport(data)
    } else {
      document.getElementById('loading').style.display = 'none'
      document.getElementById('noData').style.display = 'block'
    }
  } catch (err) {
    console.error('Ошибка загрузки загранпаспорта:', err)
    const loadingEl = document.getElementById('loading')
    if (loadingEl) loadingEl.textContent = 'Ошибка загрузки данных'
  }
}

// -------------------- ОТРИСОВКА ЗАГРАНПАСПОРТА --------------------
function renderPassport(data) {
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)

  // Устанавливаем цветовую переменную в зависимости от типа паспорта
  let borderColor = '#7b091a'
  if (data.passport_type === 'дипломатический') borderColor = '#0d4d26'
  else if (data.passport_type === 'служебный') borderColor = '#0d2a4d'
  document.documentElement.style.setProperty('--primary-red', borderColor)

  // Определяем заголовки в зависимости от типа паспорта
  let docTypeCyr = 'ЗАГРАНИЧНЫЙ ПАСПОРТ'
  let docTypeEng = 'FOREIGN PASSPORT'
  if (data.passport_type === 'дипломатический') {
    docTypeCyr = 'ДИПЛОМАТИЧЕСКИЙ ЗАГРАНИЧНЫЙ ПАСПОРТ'
    docTypeEng = 'DIPLOMATIC FOREIGN PASSPORT'
  } else if (data.passport_type === 'служебный') {
    docTypeCyr = 'СЛУЖЕБНЫЙ ЗАГРАНИЧНЫЙ ПАСПОРТ'
    docTypeEng = 'SERVICE FOREIGN PASSPORT'
  }

  const html = `
    <div class="passport-template">
      <div class="passport-header">
        <div class="country-name">СФСР ЮЛЬСАННА</div>
        <div class="country-name-english">SFSR ULSANNA</div>
        <div class="document-type">${docTypeCyr}</div>
        <div class="document-type-english">${docTypeEng}</div>
      </div>
      <div class="passport-content">
        <div class="data-field">
          <div class="field-label">Серия и номер</div>
          <div class="field-label-english">Passport number</div>
          <div class="field-value series-number">${escapeHTML(data.series_number || '—')}</div>
        </div>
        <div class="data-field">
          <div class="field-label">Дата выдачи</div>
          <div class="field-label-english">Date of issue</div>
          <div class="field-value">${formatDate(data.issue_date)}</div>
        </div>
        <div class="data-field">
          <div class="field-label">Срок действия</div>
          <div class="field-label-english">Expiry date</div>
          <div class="field-value">${formatDate(data.expiry_date)}</div>
        </div>
        <div class="data-field">
          <div class="field-label">Кем выдан</div>
          <div class="field-label-english">Issuing authority</div>
          <div class="field-value">${escapeHTML(data.issued_by_cyr || '—')}</div>
          <div class="field-value-english">${escapeHTML(data.issued_by_lat || '—')}</div>
        </div>
        <div class="data-field">
          <div class="field-label">Личный код</div>
          <div class="field-label-english">Personal No.</div>
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

          <div class="fio-and-details">
            <div class="data-field">
              <div class="field-label">Фамилия</div>
              <div class="field-label-english">Surname</div>
              <div class="field-value">${escapeHTML(data.surname_cyr || '—')}</div>
              <div class="field-value-english">${escapeHTML(data.surname_lat || '—')}</div>
            </div>
            <div class="data-field">
              <div class="field-label">Имя</div>
              <div class="field-label-english">Given names</div>
              <div class="field-value">${escapeHTML(data.name_cyr || '—')}</div>
              <div class="field-value-english">${escapeHTML(data.name_lat || '—')}</div>
            </div>
            <div class="data-field">
              <div class="field-label">Пол</div>
              <div class="field-label-english">Sex</div>
              <div class="field-value">${escapeHTML(data.gender_cyr || '—')}</div>
              <div class="field-value-english">${escapeHTML(data.gender_lat || '—')}</div>
            </div>
            <div class="data-field">
              <div class="field-label">Дата рождения</div>
              <div class="field-label-english">Date of birth</div>
              <div class="field-value">${formatDate(data.birth_date)}</div>
            </div>
            <div class="data-field">
              <div class="field-label">Место рождения</div>
              <div class="field-label-english">Place of birth</div>
              <div class="field-value">${escapeHTML(data.birth_place_cyr || '—')}</div>
              <div class="field-value-english">${escapeHTML(data.birth_place_lat || '—')}</div>
            </div>
            <div class="data-field">
              <div class="field-label">Гражданство</div>
              <div class="field-label-english">Citizenship</div>
              <div class="field-value">${escapeHTML(data.citizenship_cyr || 'СФСР Юльсанна')}</div>
              <div class="field-value-english">${escapeHTML(data.citizenship_lat || 'SFSR Ulsanna')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  document.getElementById('passportContent').innerHTML = html
  document.getElementById('passportContent').style.display = 'block'

  // --- Дополнительные секции: информация о паспорте, визы ---
  let extraHtml = `
    <h3 class="section-title"><i class="fas fa-info-circle"></i> Информация о паспорте</h3>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Тип паспорта</div>
        <div class="info-value">${escapeHTML(data.passport_type || '—')}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Биометрический</div>
        <div class="info-value">${data.is_biometric ? 'Да' : 'Нет'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Чип биометрических данных</div>
        <div class="info-value">
          ${data.has_chip ? 'Присутствует' + (data.chip_version ? ` (версия ${escapeHTML(data.chip_version)})` : '') : 'Отсутствует'}
        </div>
      </div>
      <div class="info-item signature-container" style="display: flex; align-items: center; gap: 15px;">
        <div class="info-label">Подпись владельца</div>
        <img id="signatureImg" src="../../images/default-signature.png" alt="Подпись" class="signature-img" />
      </div>
    </div>
  `

  const visas = data.visas || []
  if (visas.length > 0) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-passport"></i> Визы</h3>
      <div class="info-table">
        <table>
          <thead>
            <tr>
              <th>Страна / Country</th>
              <th>Тип визы / Visa type</th>
              <th>Дата выдачи / Issue date</th>
              <th>Действительна до / Expiry date</th>
            </tr>
          </thead>
          <tbody>
            ${visas.map(v => `
              <tr>
                <td>${escapeHTML(v.country || '—')}</td>
                <td>${escapeHTML(v.type || '—')}</td>
                <td>${formatDate(v.issueDate)}</td>
                <td>${formatDate(v.expiryDate)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  if (extraHtml) {
    document.getElementById('extraSections').innerHTML = extraHtml
    document.getElementById('extraSections').style.display = 'block'
  }

  // --- Фото, QR, штрихкод, подпись ---
  const personalCode = data.personal_code || ''
  const avatarImg = document.getElementById('passportAvatar')
  const signatureImg = document.getElementById('signatureImg')

  if (personalCode) {
    const safeCode = personalCode.replace(/[^a-zA-Z0-9\-]/g, '')
    const imgUrl = `../../images/avatars/${safeCode}.jpg`
    const img = new Image()
    img.onload = () => { avatarImg.src = imgUrl }
    img.onerror = () => { avatarImg.src = '../../images/default-avatar.png' }
    img.src = imgUrl

    const sigUrl = `../../images/avatars/signatures/${safeCode}.jpg`
    const sig = new Image()
    sig.onload = () => { signatureImg.src = sigUrl }
    sig.onerror = () => { signatureImg.src = '../../images/default-signature.png' }
    sig.src = sigUrl
  }

  const qrContainer = document.getElementById('passportQrCode')
  if (qrContainer && personalCode) {
    qrContainer.innerHTML = ''
    try {
      new QRCode(qrContainer, {
        text: `https://e-pass-sfsru.web.app/${personalCode}/`,
        width: 80,
        height: 80,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L
      })
    } catch (e) { console.warn('QR error', e) }
  }

  const seriesNumber = (data.series_number || '').replace(/\s/g, '')
  if (seriesNumber && seriesNumber.length >= 6) {
    try {
      JsBarcode("#passportBarcode", seriesNumber, {
        format: "CODE128",
        displayValue: false,
        height: 50,
        margin: 0
      })
    } catch (e) { console.warn('Barcode error', e) }
  }

  // --- Кнопка редактирования и статус ---
  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'

  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)

  // Кнопка замены паспорта (всегда видна)
  const replaceLink = document.createElement('a')
  replaceLink.href = '../../services/documents/passport/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить паспорт'
  statusAndEdit.appendChild(replaceLink)

  // Кнопка изменения данных (только если статус не verified)
  if (data.status !== 'verified') {
    const editBtn = document.createElement('button')
    editBtn.className = 'edit-btn'
    editBtn.id = 'editPassportBtn'
    editBtn.textContent = 'Изменить данные'
    editBtn.addEventListener('click', () => {
      formData = { ...data }
      openEditModal()
    })
    statusAndEdit.appendChild(editBtn)
  }

  document.getElementById('passportContent').parentNode.insertBefore(statusAndEdit, document.getElementById('extraSections'))

  document.getElementById('loading').style.display = 'none'
}

// -------------------- ЭСКЕЙПИНГ HTML --------------------
function escapeHTML(str) {
  if (!str) return '—'
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// -------------------- МОДАЛЬНОЕ ОКНО --------------------
async function openAddModal() {
  if (!userProfile) {
    await loadUserProfile()
    if (!userProfile) {
      alert('Не удалось загрузить профиль. Перезагрузите страницу.')
      return
    }
  }

  currentStep = 1
  formData = {
    personal_code: userPersonalCode || '',
    surname_cyr: userProfile?.surname || '',
    name_cyr: userProfile?.name || '',
    birth_date: userProfile?.date_of_birth || '',
    birth_place_cyr: userProfile?.place_of_birth || '',
    gender_cyr: userProfile?.gender || 'Мужской',
    citizenship_cyr: 'СФСР Юльсанна',
    citizenship_lat: 'SFSR Ulsanna',
    visas: []
  }
  openModal('Добавление заграничного паспорта')
}

function openEditModal() {
  currentStep = 1
  openModal('Редактирование заграничного паспорта')
}

function openModal(title) {
  const titleEl = document.getElementById('modalTitle')
  if (titleEl) titleEl.textContent = title
  const overlay = document.getElementById('modalOverlay')
  if (overlay) overlay.classList.add('active')
  updateStep()
}

window.closeModal = function() {
  const overlay = document.getElementById('modalOverlay')
  if (overlay) overlay.classList.remove('active')
  currentStep = 1
}

// -------------------- ОБНОВЛЕНИЕ ШАГА --------------------
function updateStep() {
  const stepIndicator = document.getElementById('stepIndicator')
  if (stepIndicator) stepIndicator.textContent = `Шаг ${currentStep} из ${totalSteps}`

  const prevBtn = document.getElementById('prevBtn')
  if (prevBtn) prevBtn.style.display = currentStep > 1 ? 'inline-block' : 'none'

  const nextBtn = document.getElementById('nextBtn')
  if (nextBtn) nextBtn.textContent = currentStep === totalSteps ? 'Сохранить' : 'Далее'

  let content = ''
  switch (currentStep) {
    case 1: content = renderStep1(); break
    case 2: content = renderStep2(); break
    case 3: content = renderStep3(); break
  }
  const modalBody = document.getElementById('modalBody')
  if (modalBody) modalBody.innerHTML = content
}

// --- ШАГ 1: Основные данные ---
function renderStep1() {
  return `
    <div class="form-group">
      <label>Фамилия (кириллица)</label>
      <input type="text" id="surname_cyr" class="form-input" value="${escapeHTML(formData.surname_cyr || '')}">
    </div>
    <div class="form-group">
      <label>Фамилия (латиница)</label>
      <input type="text" id="surname_lat" class="form-input" value="${escapeHTML(formData.surname_lat || '')}">
    </div>
    <div class="form-group">
      <label>Имя (кириллица)</label>
      <input type="text" id="name_cyr" class="form-input" value="${escapeHTML(formData.name_cyr || '')}">
    </div>
    <div class="form-group">
      <label>Имя (латиница)</label>
      <input type="text" id="name_lat" class="form-input" value="${escapeHTML(formData.name_lat || '')}">
    </div>
    <div class="form-group">
      <label>Дата рождения</label>
      <input type="date" id="birth_date" class="form-input" value="${formData.birth_date || ''}">
    </div>
    <div class="form-group">
      <label>Место рождения (кириллица)</label>
      <input type="text" id="birth_place_cyr" class="form-input" value="${escapeHTML(formData.birth_place_cyr || '')}">
    </div>
    <div class="form-group">
      <label>Место рождения (латиница)</label>
      <input type="text" id="birth_place_lat" class="form-input" value="${escapeHTML(formData.birth_place_lat || '')}">
    </div>
    <div class="form-group">
      <label>Пол (кириллица)</label>
      <input type="text" id="gender_cyr" class="form-input" value="${escapeHTML(formData.gender_cyr || '')}">
    </div>
    <div class="form-group">
      <label>Пол (латиница)</label>
      <input type="text" id="gender_lat" class="form-input" value="${escapeHTML(formData.gender_lat || '')}">
    </div>
    <div class="form-group">
      <label>Гражданство (кириллица)</label>
      <input type="text" id="citizenship_cyr" class="form-input" value="${escapeHTML(formData.citizenship_cyr || 'СФСР Юльсанна')}">
    </div>
    <div class="form-group">
      <label>Гражданство (латиница)</label>
      <input type="text" id="citizenship_lat" class="form-input" value="${escapeHTML(formData.citizenship_lat || 'SFSR Ulsanna')}">
    </div>
    <div class="form-group">
      <label>Серия и номер</label>
      <input type="text" id="series_number" class="form-input" value="${escapeHTML(formData.series_number || '')}">
    </div>
    <div class="form-group">
      <label>Дата выдачи</label>
      <input type="date" id="issue_date" class="form-input" value="${formData.issue_date || ''}">
    </div>
    <div class="form-group">
      <label>Срок действия</label>
      <input type="date" id="expiry_date" class="form-input" value="${formData.expiry_date || ''}">
    </div>
    <div class="form-group">
      <label>Кем выдан (кириллица)</label>
      <input type="text" id="issued_by_cyr" class="form-input" value="${escapeHTML(formData.issued_by_cyr || '')}">
    </div>
    <div class="form-group">
      <label>Кем выдан (латиница)</label>
      <input type="text" id="issued_by_lat" class="form-input" value="${escapeHTML(formData.issued_by_lat || '')}">
    </div>
    <div class="form-group">
      <label>Личный код</label>
      <input type="text" id="personal_code" class="form-input" value="${userPersonalCode || ''}" readonly>
    </div>
  `
}

// --- ШАГ 2: Тип паспорта, биометрия, чип ---
function renderStep2() {
  return `
    <div class="form-group">
      <label>Тип паспорта</label>
      <select id="passport_type" class="form-input">
        <option value="">—</option>
        <option value="общегражданский" ${formData.passport_type === 'общегражданский' ? 'selected' : ''}>Общегражданский</option>
        <option value="дипломатический" ${formData.passport_type === 'дипломатический' ? 'selected' : ''}>Дипломатический</option>
        <option value="служебный" ${formData.passport_type === 'служебный' ? 'selected' : ''}>Служебный</option>
      </select>
    </div>
    <div class="form-group">
      <label>Биометрический</label>
      <select id="is_biometric" class="form-input">
        <option value="">—</option>
        <option value="true" ${formData.is_biometric === true ? 'selected' : ''}>Да</option>
        <option value="false" ${formData.is_biometric === false ? 'selected' : ''}>Нет</option>
      </select>
    </div>
    <div class="form-group">
      <label>Чип биометрических данных</label>
      <select id="has_chip" class="form-input">
        <option value="">—</option>
        <option value="true" ${formData.has_chip === true ? 'selected' : ''}>Есть</option>
        <option value="false" ${formData.has_chip === false ? 'selected' : ''}>Нет</option>
      </select>
    </div>
    <div class="form-group">
      <label>Номер версии чипа</label>
      <input type="text" id="chip_version" class="form-input" value="${escapeHTML(formData.chip_version || '')}">
    </div>
  `
}

// --- ШАГ 3: Визы ---
function renderStep3() {
  const visas = formData.visas || []
  let listHtml = visas.map((v, i) => `
    <div class="record-block" data-index="${i}">
      <div class="form-group">
        <label>Страна</label>
        <input type="text" class="form-input visa-country" value="${escapeHTML(v.country || '')}">
      </div>
      <div class="form-group">
        <label>Тип визы</label>
        <input type="text" class="form-input visa-type" value="${escapeHTML(v.type || '')}">
      </div>
      <div class="form-group">
        <label>Дата выдачи</label>
        <input type="date" class="form-input visa-issue" value="${v.issueDate || ''}">
      </div>
      <div class="form-group">
        <label>Действительна до</label>
        <input type="date" class="form-input visa-expiry" value="${v.expiryDate || ''}">
      </div>
      <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'visas')">Удалить</button>
    </div>
  `).join('')

  return `
    <p><strong>Сведения о визах:</strong></p>
    <div id="visasContainer">${listHtml}</div>
    <button type="button" class="btn btn-secondary" id="addVisaBtn">+ Добавить визу</button>
  `
}

// -------------------- СОХРАНЕНИЕ ДАННЫХ ШАГА --------------------
function saveStepData() {
  switch (currentStep) {
    case 1:
      formData.surname_cyr = document.getElementById('surname_cyr')?.value.trim() || ''
      formData.surname_lat = document.getElementById('surname_lat')?.value.trim() || ''
      formData.name_cyr = document.getElementById('name_cyr')?.value.trim() || ''
      formData.name_lat = document.getElementById('name_lat')?.value.trim() || ''
      formData.birth_date = document.getElementById('birth_date')?.value || ''
      formData.birth_place_cyr = document.getElementById('birth_place_cyr')?.value.trim() || ''
      formData.birth_place_lat = document.getElementById('birth_place_lat')?.value.trim() || ''
      formData.gender_cyr = document.getElementById('gender_cyr')?.value.trim() || ''
      formData.gender_lat = document.getElementById('gender_lat')?.value.trim() || ''
      formData.citizenship_cyr = document.getElementById('citizenship_cyr')?.value.trim() || 'СФСР Юльсанна'
      formData.citizenship_lat = document.getElementById('citizenship_lat')?.value.trim() || 'SFSR Ulsanna'
      formData.series_number = document.getElementById('series_number')?.value.trim() || ''
      formData.issue_date = document.getElementById('issue_date')?.value || ''
      formData.expiry_date = document.getElementById('expiry_date')?.value || ''
      formData.issued_by_cyr = document.getElementById('issued_by_cyr')?.value.trim() || ''
      formData.issued_by_lat = document.getElementById('issued_by_lat')?.value.trim() || ''
      formData.personal_code = document.getElementById('personal_code')?.value.trim() || userPersonalCode
      break
    case 2:
      formData.passport_type = document.getElementById('passport_type')?.value || null
      const isBio = document.getElementById('is_biometric')?.value
      formData.is_biometric = isBio === 'true' ? true : (isBio === 'false' ? false : null)
      const chip = document.getElementById('has_chip')?.value
      formData.has_chip = chip === 'true' ? true : (chip === 'false' ? false : null)
      formData.chip_version = document.getElementById('chip_version')?.value.trim() || ''
      break
    case 3:
      formData.visas = Array.from(document.querySelectorAll('#visasContainer .record-block')).map(block => ({
        country: block.querySelector('.visa-country')?.value.trim() || '',
        type: block.querySelector('.visa-type')?.value.trim() || '',
        issueDate: block.querySelector('.visa-issue')?.value || '',
        expiryDate: block.querySelector('.visa-expiry')?.value || ''
      }))
      break
  }
}

// -------------------- ДИНАМИЧЕСКОЕ ДОБАВЛЕНИЕ ВИЗ --------------------
window.addRecord = function(containerId, type) {
  if (type === 'visas') {
    const container = document.getElementById(containerId)
    if (!container) return
    const html = `
      <div class="record-block">
        <div class="form-group"><label>Страна</label><input type="text" class="form-input visa-country"></div>
        <div class="form-group"><label>Тип визы</label><input type="text" class="form-input visa-type"></div>
        <div class="form-group"><label>Дата выдачи</label><input type="date" class="form-input visa-issue"></div>
        <div class="form-group"><label>Действительна до</label><input type="date" class="form-input visa-expiry"></div>
        <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'visas')">Удалить</button>
      </div>
    `
    container.insertAdjacentHTML('beforeend', html)
  }
}

window.removeRecord = function(btn) {
  const block = btn.closest('.record-block')
  if (block) block.remove()
}

// -------------------- НАВИГАЦИЯ ПО ШАГАМ --------------------
window.nextStep = function() {
  saveStepData()
  if (currentStep < totalSteps) {
    currentStep++
    updateStep()
  } else {
    saveForeignPassport()
  }
}

window.prevStep = function() {
  if (currentStep > 1) {
    currentStep--
    updateStep()
  }
}

// -------------------- СОХРАНЕНИЕ ЗАГРАНПАСПОРТА --------------------
async function saveForeignPassport() {
  try {
    if (!userPersonalCode) {
      alert('Ошибка: личный код не загружен')
      return
    }

    const cleanData = { ...formData }
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === null || cleanData[key] === undefined) delete cleanData[key]
    })

    cleanData.personal_code = userPersonalCode
    cleanData.status = 'oncheck'
    cleanData.updated_at = new Date().toISOString()

    let result
    if (currentDocId) {
      result = await supabase
        .schema('documents')
        .from('foreign_passport')
        .update(cleanData)
        .eq('id', currentDocId)
    } else {
      cleanData.created_at = new Date().toISOString()
      result = await supabase
        .schema('documents')
        .from('foreign_passport')
        .insert([cleanData])
        .select()
    }

    if (result.error) throw result.error

    window.closeModal()
    const newId = currentDocId || result.data[0].id
    window.location.href = `foreign-passport.html?id=${newId}`
  } catch (err) {
    console.error('Ошибка сохранения:', err)
    alert('Ошибка сохранения: ' + err.message)
  }
}

// -------------------- ИНИЦИАЛИЗАЦИЯ --------------------
document.addEventListener('DOMContentLoaded', async () => {
  await loadForeignPassport()

  const addBtn = document.getElementById('addPassportBtn')
  if (addBtn) addBtn.addEventListener('click', openAddModal)

  const prevBtn = document.getElementById('prevBtn')
  if (prevBtn) prevBtn.addEventListener('click', () => window.prevStep())

  const nextBtn = document.getElementById('nextBtn')
  if (nextBtn) nextBtn.addEventListener('click', () => window.nextStep())

  document.addEventListener('click', (e) => {
    if (e.target.id === 'addVisaBtn') window.addRecord('visasContainer', 'visas')
  })
})

// Экспорт в глобальную область
window.openAddModal = openAddModal
window.openEditModal = openEditModal
window.closeModal = closeModal
window.nextStep = nextStep
window.prevStep = prevStep
window.addRecord = addRecord
window.removeRecord = removeRecord