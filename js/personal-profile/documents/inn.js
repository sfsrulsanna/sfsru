import { supabase } from '../../../js/supabase-config.js'

// -------------------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ --------------------
let currentDocId = null
let documentData = {}
let userPersonalCode = null
let userProfile = null
let formData = {} // данные для модальной формы

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
    document.getElementById('loading').textContent = 'Ошибка загрузки профиля. Перезагрузите страницу.'
    return null
  }

  userPersonalCode = data.personal_code
  userProfile = data
  return data
}

// -------------------- ЗАГРУЗКА ДОКУМЕНТА ИНН --------------------
async function loadInnDocument() {
  try {
    const profile = await loadUserProfile()
    if (!profile) return

    const urlParams = new URLSearchParams(window.location.search)
    currentDocId = urlParams.get('id')

    let data = null
    if (currentDocId) {
      const { data: doc, error } = await supabase
        .schema('documents')
        .from('inn')
        .select('*')
        .eq('id', currentDocId)
        .maybeSingle()
      if (error) throw error
      data = doc
    } else {
      const { data: docs, error } = await supabase
        .schema('documents')
        .from('inn')
        .select('*')
        .eq('personal_code', userPersonalCode)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      data = docs?.[0]
      if (data) currentDocId = data.id
    }

    if (data) {
      documentData = data
      renderInn(data)
      document.getElementById('loading').style.display = 'none'
      document.getElementById('content').style.display = 'block'
      document.getElementById('noData').style.display = 'none'
    } else {
      document.getElementById('loading').style.display = 'none'
      document.getElementById('noData').style.display = 'block'
    }
  } catch (err) {
    console.error('Ошибка загрузки ИНН:', err)
    document.getElementById('loading').textContent = 'Ошибка загрузки данных'
  }
}

// -------------------- ОТРИСОВКА ДОКУМЕНТА --------------------
function renderInn(data) {
  const fullName = `${data.surname || ''} ${data.name || ''} ${data.patronymic || ''}`.trim() || '—'

  const innHtml = `
    <div class="document-container">
      <div class="document-header">
        <div class="document-title">СВИДЕТЕЛЬСТВО</div>
        <div class="document-subtitle">О ПОСТАНОВКЕ НА УЧЕТ В НАЛОГОВОМ ОРГАНЕ</div>
      </div>
      <div class="document-content">
        <div class="qr-section">
          <div id="qrCodeContainer" style="width: 180px; height: 180px; margin-bottom: 15px;"></div>
          <div class="qr-label">Отсканируйте QR-код для проверки подлинности</div>
        </div>
        <div class="data-section">
          <div class="inn-number">${escapeHTML(data.inn_number || '—')}</div>
          <div class="info-line">
            <span class="info-label">ФИО</span>
            <span class="info-value">${escapeHTML(fullName)}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Пол</span>
            <span class="info-value">${escapeHTML(data.gender || '—')}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Дата рождения</span>
            <span class="info-value">${formatDate(data.birth_date)}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Место рождения</span>
            <span class="info-value">${escapeHTML(data.birth_place || '—')}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Дата выдачи</span>
            <span class="info-value">${formatDate(data.issue_date)}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Кем выдан</span>
            <span class="info-value">${escapeHTML(data.issued_by || '—')}</span>
          </div>
        </div>
      </div>
    </div>
  `

  document.getElementById('innContainer').innerHTML = innHtml

  const qrContainer = document.getElementById('qrCodeContainer')
  if (qrContainer && data.inn_number) {
    qrContainer.innerHTML = ''
    try {
      new QRCode(qrContainer, {
        text: data.inn_number,
        width: 180,
        height: 180,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L
      })
    } catch (e) { console.warn('QR error', e) }
  }

  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)

  // Создаём блок статуса и кнопок
  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'

  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)

  // Кнопка замены (ссылка на получение нового ИНН) — всегда видна
  const replaceLink = document.createElement('a')
  replaceLink.href = '../../services/documents/inn/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить ИНН'
  statusAndEdit.appendChild(replaceLink)

  // Кнопка изменения данных (только если статус не verified)
  if (data.status !== 'verified') {
    const editBtn = document.createElement('button')
    editBtn.className = 'edit-btn'
    editBtn.id = 'editInnBtn'
    editBtn.textContent = 'Изменить данные'
    editBtn.addEventListener('click', () => {
      formData = { ...data }
      openEditModal()
    })
    statusAndEdit.appendChild(editBtn)
  }

  document.getElementById('statusAndEditContainer').innerHTML = ''
  document.getElementById('statusAndEditContainer').appendChild(statusAndEdit)
}

// -------------------- МОДАЛЬНОЕ ОКНО --------------------
async function openAddModal() {
  if (!userProfile) await loadUserProfile()
  formData = {
    inn_number: '',
    surname: userProfile?.surname || '',
    name: userProfile?.name || '',
    patronymic: userProfile?.patronymic || '',
    gender: userProfile?.gender || 'Мужской',
    birth_date: userProfile?.date_of_birth || '',
    birth_place: userProfile?.place_of_birth || '',
    issue_date: '',
    issued_by: '',
    personal_code: userPersonalCode || ''
  }
  openModal('Добавление ИНН')
}

function openEditModal() {
  openModal('Редактирование ИНН')
}

function openModal(title) {
  const titleEl = document.getElementById('modalTitle')
  if (titleEl) titleEl.textContent = title
  const overlay = document.getElementById('modalOverlay')
  if (overlay) overlay.classList.add('active')
  renderModalForm()
}

window.closeModal = function() {
  const overlay = document.getElementById('modalOverlay')
  if (overlay) overlay.classList.remove('active')
}

function renderModalForm() {
  const modalBody = document.getElementById('modalBody')
  modalBody.innerHTML = `
    <div class="form-group">
      <label>Номер ИНН</label>
      <input type="text" id="inn_number" class="form-input" value="${escapeHTML(formData.inn_number || '')}" placeholder="12 цифр">
    </div>
    <div class="form-group">
      <label>Фамилия</label>
      <input type="text" id="surname" class="form-input" value="${escapeHTML(formData.surname || '')}">
    </div>
    <div class="form-group">
      <label>Имя</label>
      <input type="text" id="name" class="form-input" value="${escapeHTML(formData.name || '')}">
    </div>
    <div class="form-group">
      <label>Отчество</label>
      <input type="text" id="patronymic" class="form-input" value="${escapeHTML(formData.patronymic || '')}">
    </div>
    <div class="form-group">
      <label>Пол</label>
      <select id="gender" class="form-input">
        <option value="Мужской" ${formData.gender === 'Мужской' ? 'selected' : ''}>Мужской</option>
        <option value="Женский" ${formData.gender === 'Женский' ? 'selected' : ''}>Женский</option>
      </select>
    </div>
    <div class="form-group">
      <label>Дата рождения</label>
      <input type="date" id="birth_date" class="form-input" value="${formData.birth_date || ''}">
    </div>
    <div class="form-group">
      <label>Место рождения</label>
      <input type="text" id="birth_place" class="form-input" value="${escapeHTML(formData.birth_place || '')}">
    </div>
    <div class="form-group">
      <label>Дата выдачи</label>
      <input type="date" id="issue_date" class="form-input" value="${formData.issue_date || ''}">
    </div>
    <div class="form-group">
      <label>Кем выдан</label>
      <input type="text" id="issued_by" class="form-input" value="${escapeHTML(formData.issued_by || '')}">
    </div>
    <div class="form-group">
      <label>Личный код</label>
      <input type="text" id="personal_code" class="form-input" value="${userPersonalCode || ''}" readonly>
    </div>
  `
}

function collectFormData() {
  return {
    inn_number: document.getElementById('inn_number')?.value.trim() || '',
    surname: document.getElementById('surname')?.value.trim() || '',
    name: document.getElementById('name')?.value.trim() || '',
    patronymic: document.getElementById('patronymic')?.value.trim() || '',
    gender: document.getElementById('gender')?.value || '',
    birth_date: document.getElementById('birth_date')?.value || '',
    birth_place: document.getElementById('birth_place')?.value.trim() || '',
    issue_date: document.getElementById('issue_date')?.value || '',
    issued_by: document.getElementById('issued_by')?.value.trim() || '',
    personal_code: document.getElementById('personal_code')?.value.trim() || userPersonalCode
  }
}

async function saveInn() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { alert('Ошибка авторизации'); return }
    if (!userPersonalCode) { alert('Личный код не загружен'); return }

    const newData = collectFormData()
    if (!newData.inn_number) { alert('Номер ИНН обязателен'); return }

    const cleanData = { ...newData }
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
        .from('inn')
        .update(cleanData)
        .eq('id', currentDocId)
    } else {
      cleanData.created_at = new Date().toISOString()
      result = await supabase
        .schema('documents')
        .from('inn')
        .insert([cleanData])
        .select()
    }

    if (result.error) throw result.error

    window.closeModal()
    const newId = currentDocId || result.data[0].id
    window.location.href = `inn.html?id=${newId}`
  } catch (err) {
    console.error('Ошибка сохранения:', err)
    alert('Ошибка сохранения: ' + err.message)
  }
}

// -------------------- ЭСКЕЙПИНГ HTML --------------------
function escapeHTML(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// -------------------- ИНИЦИАЛИЗАЦИЯ --------------------
document.addEventListener('DOMContentLoaded', async () => {
  await loadInnDocument()

  document.getElementById('addInnBtn')?.addEventListener('click', openAddModal)
  document.getElementById('saveInnBtn')?.addEventListener('click', saveInn)
})

// Экспорт в глобальную область для inline-обработчиков
window.openAddModal = openAddModal
window.openEditModal = openEditModal
window.openModal = openModal
window.closeModal = closeModal