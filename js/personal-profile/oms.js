import { supabase } from '../../js/supabase-config.js'

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentDocId = null
let documentData = {}
let userPersonalCode = null
let userProfile = null
let userId = null
let formData = {
  surname: '',
  name: '',
  patronymic: '',
  birth_date: '',
  gender: '',
  oms_number: '',
  issue_date: '',
  insurance_organizations: [] // массив страховых организаций
}
let currentStep = 1 // 1 – основные данные, 2 – страховые организации
const totalSteps = 2

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
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

function escapeHTML(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadData() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      window.location.href = '../../login.html'
      return
    }
    userId = session.user.id

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Ошибка загрузки профиля:', profileError)
      document.getElementById('loading').textContent = 'Ошибка загрузки профиля'
      return
    }

    userProfile = profile
    userPersonalCode = profile.personal_code

    const urlParams = new URLSearchParams(window.location.search)
    const idFromUrl = urlParams.get('id')

    let data = null
    if (idFromUrl) {
      const { data: doc, error } = await supabase
        .from('documents_oms')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .from('documents_oms')
        .select('*')
        .eq('personal_code', userPersonalCode)
        .order('created_at', { ascending: false })
        .limit(1)
      if (!error && docs && docs.length > 0) {
        data = docs[0]
      }
    }

    const loadingEl = document.getElementById('loading')
    const contentEl = document.getElementById('content')
    const noDataEl = document.getElementById('noData')

    if (data) {
      documentData = data
      currentDocId = data.id
      // Парсим insurance_organizations, если пришло строкой
      if (typeof documentData.insurance_organizations === 'string') {
        try {
          documentData.insurance_organizations = JSON.parse(documentData.insurance_organizations)
        } catch {
          documentData.insurance_organizations = []
        }
      }
      renderOms(documentData)
      loadingEl.style.display = 'none'
      contentEl.style.display = 'block'
      noDataEl.style.display = 'none'
    } else {
      loadingEl.style.display = 'none'
      contentEl.style.display = 'none'
      noDataEl.style.display = 'block'
    }
  } catch (err) {
    console.error('Необработанная ошибка в loadData:', err)
    document.getElementById('loading').textContent = 'Произошла критическая ошибка'
  }
}

// ==================== ОТРИСОВКА ДОКУМЕНТА ====================
function renderOms(data) {
  const setText = (id, text) => {
    const el = document.getElementById(id)
    if (el) el.textContent = text
    else console.warn(`Element #${id} not found`)
  }

  setText('surname', data.surname || '—')
  setText('name', data.name || '—')
  setText('patronymic', data.patronymic || '—')
  setText('birthDate', formatDate(data.birth_date))
  setText('gender', data.gender || '—')
  setText('omsNumber', data.oms_number || '—')
  setText('issueDate', formatDate(data.issue_date))

  // Генерация штрих-кода (номер полиса)
  const barcodeContainer = document.getElementById('omsBarcode')
  if (barcodeContainer && data.oms_number) {
    try {
      JsBarcode("#omsBarcode", data.oms_number.replace(/\s/g, ''), {
        format: "CODE128",
        displayValue: false,
        height: 50,
        margin: 0,
        width: 2
      })
    } catch (e) {
      console.warn('Barcode error', e)
    }
  }

  // Отрисовка таблицы страховых организаций
  const tbody = document.getElementById('insuranceBody')
  const orgs = data.insurance_organizations || []
  if (orgs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Нет данных</td></tr>'
  } else {
    tbody.innerHTML = orgs.map(org => `
      <tr>
        <td>${escapeHTML(org.name || '—')}</td>
        <td>${formatDate(org.start_date)}</td>
        <td>${escapeHTML(org.signed_by || '—')}</td>
      </tr>
    `).join('')
  }

  // --- Блок статуса и кнопок ---
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)

  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'

  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)

  const replaceLink = document.createElement('a')
  replaceLink.href = '../../services/documents/oms/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить полис'
  statusAndEdit.appendChild(replaceLink)

  if (data.status !== 'verified') {
    const editBtn = document.createElement('button')
    editBtn.className = 'edit-btn'
    editBtn.id = 'editBtn'
    editBtn.textContent = 'Изменить данные'
    editBtn.addEventListener('click', () => {
      formData = { ...data }
      openEditModal()
    })
    statusAndEdit.appendChild(editBtn)
  }

  // Вставляем блок после карточки, но перед таблицей
  const card = document.querySelector('.document-container')
  const insuranceSection = document.querySelector('.insurance-section')
  if (insuranceSection) {
    card.parentNode.insertBefore(statusAndEdit, insuranceSection)
  } else {
    card.parentNode.insertBefore(statusAndEdit, card.nextSibling)
  }
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
window.closeModal = function() {
  document.getElementById('modalOverlay').classList.remove('active')
  currentStep = 1
}

function openModal(title) {
  document.getElementById('modalTitle').textContent = title
  document.getElementById('modalOverlay').classList.add('active')
  currentStep = 1
  updateStep()
}

function updateStep() {
  const stepIndicator = document.getElementById('stepIndicator')
  if (stepIndicator) stepIndicator.textContent = `Шаг ${currentStep} из ${totalSteps}`

  const prevBtn = document.getElementById('prevBtn')
  if (prevBtn) prevBtn.style.display = currentStep > 1 ? 'inline-block' : 'none'

  const nextBtn = document.getElementById('nextBtn')
  if (nextBtn) nextBtn.textContent = currentStep === totalSteps ? 'Сохранить' : 'Далее'

  let content = ''
  switch (currentStep) {
    case 1:
      content = renderStep1()
      break
    case 2:
      content = renderStep2()
      break
  }
  const modalBody = document.getElementById('modalBody')
  if (modalBody) modalBody.innerHTML = content

  if (currentStep === 2) {
    renderOrganizationsList()
  }
}

// --- Шаг 1: основные данные ---
function renderStep1() {
  return `
    <div class="form-group">
      <label>Фамилия</label>
      <input type="text" id="edit_surname" class="form-input" value="${escapeHTML(formData.surname || '')}">
    </div>
    <div class="form-group">
      <label>Имя</label>
      <input type="text" id="edit_name" class="form-input" value="${escapeHTML(formData.name || '')}">
    </div>
    <div class="form-group">
      <label>Отчество</label>
      <input type="text" id="edit_patronymic" class="form-input" value="${escapeHTML(formData.patronymic || '')}">
    </div>
    <div class="form-group">
      <label>Дата рождения</label>
      <input type="date" id="edit_birth_date" class="form-input" value="${formData.birth_date || ''}">
    </div>
    <div class="form-group">
      <label>Пол</label>
      <select id="edit_gender" class="form-input">
        <option value="Мужской" ${formData.gender === 'Мужской' ? 'selected' : ''}>Мужской</option>
        <option value="Женский" ${formData.gender === 'Женский' ? 'selected' : ''}>Женский</option>
      </select>
    </div>
    <div class="form-group">
      <label>Номер полиса ОМС</label>
      <input type="text" id="edit_oms_number" class="form-input" value="${escapeHTML(formData.oms_number || '')}">
    </div>
    <div class="form-group">
      <label>Дата выдачи</label>
      <input type="date" id="edit_issue_date" class="form-input" value="${formData.issue_date || ''}">
    </div>
    <div class="form-group">
      <label>Личный код</label>
      <input type="text" id="edit_personal_code_ref" class="form-input" value="${userPersonalCode || ''}" readonly>
    </div>
  `
}

// --- Шаг 2: страховые организации ---
function renderStep2() {
  return `
    <div class="form-group">
      <label>Страховые организации</label>
      <div id="organizationsContainer"></div>
      <button type="button" class="btn btn-secondary" id="addOrgBtn" style="margin-top: 0.5rem;">+ Добавить организацию</button>
    </div>
  `
}

// --- Отображение списка организаций внутри модального окна ---
function renderOrganizationsList() {
  const container = document.getElementById('organizationsContainer')
  if (!container) return

  const orgs = formData.insurance_organizations || []
  if (orgs.length === 0) {
    container.innerHTML = '<p>Нет добавленных организаций</p>'
    return
  }

  const table = document.createElement('table')
  table.className = 'insurance-table'
  table.innerHTML = `
    <thead>
      <tr>
        <th>Наименование</th>
        <th>Дата начала</th>
        <th>Кем подписано</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${orgs.map((org, index) => `
        <tr>
          <td>${escapeHTML(org.name || '')}</td>
          <td>${org.start_date || ''}</td>
          <td>${escapeHTML(org.signed_by || '')}</td>
          <td><button type="button" class="btn btn-secondary" style="padding:0.2rem 0.5rem;" onclick="window.removeOrganization(${index})">Удалить</button></td>
        </tr>
      `).join('')}
    </tbody>
  `
  container.innerHTML = ''
  container.appendChild(table)
}

// --- Добавление новой организации ---
window.addOrganization = function() {
  const name = prompt('Введите наименование организации:')
  if (!name) return
  const startDate = prompt('Введите дату начала (ГГГГ-ММ-ДД):')
  const signedBy = prompt('Введите кем подписано:')
  const newOrg = {
    name: name,
    start_date: startDate || null,
    signed_by: signedBy || ''
  }
  if (!formData.insurance_organizations) formData.insurance_organizations = []
  formData.insurance_organizations.push(newOrg)
  renderOrganizationsList()
}

// --- Удаление организации ---
window.removeOrganization = function(index) {
  if (formData.insurance_organizations && index >= 0 && index < formData.insurance_organizations.length) {
    formData.insurance_organizations.splice(index, 1)
    renderOrganizationsList()
  }
}

// --- Сбор данных с первого шага ---
function collectStep1Data() {
  formData.surname = document.getElementById('edit_surname')?.value.trim() || ''
  formData.name = document.getElementById('edit_name')?.value.trim() || ''
  formData.patronymic = document.getElementById('edit_patronymic')?.value.trim() || ''
  formData.birth_date = document.getElementById('edit_birth_date')?.value || ''
  formData.gender = document.getElementById('edit_gender')?.value || ''
  formData.oms_number = document.getElementById('edit_oms_number')?.value.trim() || ''
  formData.issue_date = document.getElementById('edit_issue_date')?.value || ''
  formData.personal_code_ref = document.getElementById('edit_personal_code_ref')?.value.trim() || userPersonalCode
}

// --- Навигация ---
window.nextStep = function() {
  if (currentStep === 1) {
    collectStep1Data()
    currentStep = 2
    updateStep()
  } else {
    saveDocument()
  }
}

window.prevStep = function() {
  if (currentStep > 1) {
    currentStep--
    updateStep()
  }
}

// --- Сохранение документа ---
async function saveDocument() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { alert('Ошибка авторизации'); return }
    if (!userPersonalCode) { alert('Личный код не загружен'); return }

    if (!formData.oms_number) {
      alert('Номер полиса ОМС обязателен')
      return
    }

    const cleanData = { ...formData }
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === null || cleanData[key] === undefined) delete cleanData[key]
    })

    const dataToSend = {
      ...cleanData,
      user_id: session.user.id,
      personal_code: userPersonalCode,
      status: 'oncheck',
      updated_at: new Date().toISOString(),
      insurance_organizations: formData.insurance_organizations || []
    }

    let result
    if (currentDocId) {
      result = await supabase
        .from('documents_oms')
        .update(dataToSend)
        .eq('id', currentDocId)
        .select()
    } else {
      dataToSend.created_at = new Date().toISOString()
      result = await supabase
        .from('documents_oms')
        .insert([dataToSend])
        .select()
    }

    if (result.error) throw result.error

    window.closeModal()
    const newId = currentDocId || result.data[0].id
    window.location.href = `oms.html?id=${newId}`
  } catch (err) {
    console.error('Ошибка сохранения:', err)
    alert('Ошибка сохранения: ' + err.message)
  }
}

// ==================== ОТКРЫТИЕ МОДАЛОК ====================
function openAddModal() {
  formData = {
    surname: userProfile?.surname || '',
    name: userProfile?.name || '',
    patronymic: userProfile?.patronymic || '',
    birth_date: userProfile?.date_of_birth || '',
    gender: userProfile?.gender || 'Мужской',
    oms_number: '',
    issue_date: '',
    insurance_organizations: []
  }
  openModal('Добавление полиса ОМС')
}

function openEditModal() {
  formData = {
    surname: documentData.surname || '',
    name: documentData.name || '',
    patronymic: documentData.patronymic || '',
    birth_date: documentData.birth_date || '',
    gender: documentData.gender || '',
    oms_number: documentData.oms_number || '',
    issue_date: documentData.issue_date || '',
    insurance_organizations: documentData.insurance_organizations || []
  }
  openModal('Редактирование полиса ОМС')
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()

  document.getElementById('addBtn')?.addEventListener('click', openAddModal)

  // Обработчики навигации
  document.getElementById('prevBtn')?.addEventListener('click', () => window.prevStep())
  document.getElementById('nextBtn')?.addEventListener('click', () => window.nextStep())

  // Делегирование для кнопки добавления организации
  document.addEventListener('click', (e) => {
    if (e.target.id === 'addOrgBtn') window.addOrganization()
  })
})

// Экспорт в глобальную область
window.openAddModal = openAddModal
window.openEditModal = openEditModal
window.closeModal = closeModal
window.nextStep = nextStep
window.prevStep = prevStep
window.addOrganization = addOrganization
window.removeOrganization = removeOrganization