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

// -------------------- ЗАГРУЗКА ДОКУМЕНТА НСС --------------------
async function loadNssDocument() {
  try {
    const profile = await loadUserProfile()
    if (!profile) return

    const urlParams = new URLSearchParams(window.location.search)
    currentDocId = urlParams.get('id')

    let data = null
    if (currentDocId) {
      const { data: doc, error } = await supabase
        .schema('documents')
        .from('nss')
        .select('*')
        .eq('id', currentDocId)
        .maybeSingle()
      if (error) throw error
      data = doc
    } else {
      const { data: docs, error } = await supabase
        .schema('documents')
        .from('nss')
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
      renderNss(data)
      document.getElementById('loading').style.display = 'none'
      document.getElementById('content').style.display = 'block'
      document.getElementById('noData').style.display = 'none'
    } else {
      document.getElementById('loading').style.display = 'none'
      document.getElementById('noData').style.display = 'block'
    }
  } catch (err) {
    console.error('Ошибка загрузки НСС:', err)
    document.getElementById('loading').textContent = 'Ошибка загрузки данных'
  }
}

// -------------------- ОТРИСОВКА ДОКУМЕНТА --------------------
function renderNss(data) {
  const html = `
    <div class="document-container">
      <div class="document-header">
        <div class="document-title">НОМЕР СОЦИАЛЬНОГО СЧЁТА</div>
        <div class="document-subtitle">(НСС)</div>
      </div>
      <div class="document-content">
        <div class="qr-section">
          <div id="qrCode" class="qr-code"></div>
          <div class="qr-label">Отсканируйте QR-код для проверки подлинности</div>
        </div>
        <div class="data-section">
          <div class="inn-number" id="nssNumber">${escapeHTML(data.nss_number || '—')}</div>
          <div class="info-line">
            <span class="info-label">Фамилия</span>
            <span class="info-value" id="surname">${escapeHTML(data.surname || '—')}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Имя</span>
            <span class="info-value" id="name">${escapeHTML(data.name || '—')}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Отчество</span>
            <span class="info-value" id="patronymic">${escapeHTML(data.patronymic || '—')}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Пол</span>
            <span class="info-value" id="gender">${escapeHTML(data.gender || '—')}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Дата рождения</span>
            <span class="info-value" id="birthDate">${formatDate(data.birth_date)}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Место рождения</span>
            <span class="info-value" id="birthPlace">${escapeHTML(data.birth_place || '—')}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Дата выдачи</span>
            <span class="info-value" id="issueDate">${formatDate(data.issue_date)}</span>
          </div>
          <div class="info-line">
            <span class="info-label">Кем выдан</span>
            <span class="info-value" id="issuedBy">${escapeHTML(data.issued_by || '—')}</span>
          </div>
        </div>
      </div>
    </div>
  `

  document.getElementById('content').innerHTML = html + '<div id="statusAndEditContainer"></div>'

  const qrContainer = document.getElementById('qrCode')
  if (qrContainer && data.nss_number) {
    qrContainer.innerHTML = ''
    try {
      new QRCode(qrContainer, {
        text: data.nss_number,
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

  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'

  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)

  // Кнопка замены (ссылка на получение нового НСС) — всегда видна
  const replaceLink = document.createElement('a')
  replaceLink.href = '../../services/documents/nss/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить НСС'
  statusAndEdit.appendChild(replaceLink)

  // Кнопка изменения данных (только если статус не verified)
  if (data.status !== 'verified') {
    const editBtn = document.createElement('button')
    editBtn.className = 'edit-btn'
    editBtn.id = 'editNssBtn'
    editBtn.textContent = 'Изменить данные'
    editBtn.addEventListener('click', () => {
      formData = { ...data }
      openEditModal()
    })
    statusAndEdit.appendChild(editBtn)
  }

  document.getElementById('statusAndEditContainer').appendChild(statusAndEdit)
}

// -------------------- МОДАЛЬНОЕ ОКНО --------------------
async function openAddModal() {
  if (!userProfile) await loadUserProfile()
  formData = {
    nss_number: '',
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
  openModal('Добавление НСС')
}

function openEditModal() {
  openModal('Редактирование НСС')
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
  if (!modalBody) {
    console.error('Ошибка: элемент modalBody не найден!')
    return
  }

  modalBody.innerHTML = ''

  const fields = [
    { id: 'edit_nss_number', label: 'Номер НСС', type: 'text', value: formData.nss_number || '' },
    { id: 'edit_surname', label: 'Фамилия', type: 'text', value: formData.surname || '' },
    { id: 'edit_name', label: 'Имя', type: 'text', value: formData.name || '' },
    { id: 'edit_patronymic', label: 'Отчество', type: 'text', value: formData.patronymic || '' },
    { id: 'edit_gender', label: 'Пол', type: 'text', value: formData.gender || '', placeholder: 'Мужской / Женский' },
    { id: 'edit_birth_date', label: 'Дата рождения', type: 'date', value: formData.birth_date || '' },
    { id: 'edit_birth_place', label: 'Место рождения', type: 'text', value: formData.birth_place || '' },
    { id: 'edit_issue_date', label: 'Дата выдачи', type: 'date', value: formData.issue_date || '' },
    { id: 'edit_issued_by', label: 'Кем выдан', type: 'text', value: formData.issued_by || '' },
    { id: 'edit_personal_code', label: 'Личный код', type: 'text', value: userPersonalCode || '', readonly: true }
  ]

  fields.forEach(field => {
    const group = document.createElement('div')
    group.className = 'form-group'

    const label = document.createElement('label')
    label.htmlFor = field.id
    label.textContent = field.label
    group.appendChild(label)

    const input = document.createElement('input')
    input.type = field.type
    input.id = field.id
    input.className = 'form-input'
    input.value = field.value
    if (field.placeholder) input.placeholder = field.placeholder
    if (field.readonly) input.readOnly = true

    group.appendChild(input)
    modalBody.appendChild(group)
  })
}

function collectFormData() {
  return {
    nss_number: document.getElementById('edit_nss_number')?.value.trim() || '',
    surname: document.getElementById('edit_surname')?.value.trim() || '',
    name: document.getElementById('edit_name')?.value.trim() || '',
    patronymic: document.getElementById('edit_patronymic')?.value.trim() || '',
    gender: document.getElementById('edit_gender')?.value || '',
    birth_date: document.getElementById('edit_birth_date')?.value || '',
    birth_place: document.getElementById('edit_birth_place')?.value.trim() || '',
    issue_date: document.getElementById('edit_issue_date')?.value || '',
    issued_by: document.getElementById('edit_issued_by')?.value.trim() || '',
    personal_code: document.getElementById('edit_personal_code')?.value.trim() || userPersonalCode
  }
}

async function saveDocument() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { alert('Ошибка авторизации'); return }
    if (!userPersonalCode) { alert('Личный код не загружен'); return }

    const newData = collectFormData()
    if (!newData.nss_number) { alert('Номер НСС обязателен'); return }

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
        .from('nss')
        .update(cleanData)
        .eq('id', currentDocId)
        .select()
    } else {
      cleanData.created_at = new Date().toISOString()
      result = await supabase
        .schema('documents')
        .from('nss')
        .insert([cleanData])
        .select()
    }

    if (result.error) throw result.error

    window.closeModal()
    const newId = currentDocId || result.data[0].id
    window.location.href = `nss.html?id=${newId}`
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
  await loadNssDocument()

  document.getElementById('addBtn')?.addEventListener('click', openAddModal)
  document.getElementById('modalSaveBtn')?.addEventListener('click', saveDocument)
})

// Экспорт в глобальную область для inline-обработчиков
window.openAddModal = openAddModal
window.openEditModal = openEditModal
window.openModal = openModal
window.closeModal = closeModal