import { supabase } from '../../js/supabase-config.js'

// --- Глобальные переменные ---
let currentDocId = null
let documentData = {}
let userPersonalCode = null
let userProfile = null
let formData = {
  surname1: '',
  name1: '',
  patronymic1: '',
  birth_date: '',
  birth_place: '',
  gender1: '',
  issue_date: '',
  expiry_date: '',
  card_number: '',
  issued_by: '',
  department_code: '',
  personal_code_ref: '',
  oms_policy_number: '',
  blood_group: '',
  rh_factor: '',
  inn_number: '',
  nss_number: '',
  registration_address: '',
  previous_id_cards: []
}
let currentStep = 1 // 1 - основные данные, 2 - предыдущие карты

// --- Вспомогательные функции ---
function formatDate(dateString) {
  if (!dateString) return '—'
  try { return new Date(dateString).toLocaleDateString('ru-RU') }
  catch { return dateString }
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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')
}

// --- Загрузка данных из Supabase ---
async function loadData() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) {
    window.location.href = '../../login.html'
    return
  }

  const [profileResult, docResult] = await Promise.allSettled([
    supabase.from('users').select('personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender').eq('id', session.user.id).single(),
    (async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const id = urlParams.get('id')
      if (id) {
        return supabase.from('documents_idcard').select('*').eq('id', id).maybeSingle()
      } else {
        const { data: user } = await supabase.from('users').select('personal_code').eq('id', session.user.id).single()
        if (!user) return { data: null, error: 'No user' }
        const { data, error } = await supabase
          .from('documents_idcard')
          .select('*')
          .eq('personal_code', user.personal_code)
          .order('created_at', { ascending: false })
          .limit(1)
        return { data: data?.[0], error }
      }
    })()
  ])

  if (profileResult.status === 'fulfilled' && !profileResult.value.error) {
    userProfile = profileResult.value.data
    userPersonalCode = userProfile.personal_code
  } else {
    console.error('Ошибка профиля')
    document.getElementById('loading').textContent = 'Ошибка загрузки профиля'
    return
  }

  if (docResult.status === 'fulfilled' && !docResult.value.error && docResult.value.data) {
    documentData = docResult.value.data
    currentDocId = documentData.id
    if (typeof documentData.previous_id_cards === 'string') {
      try {
        documentData.previous_id_cards = JSON.parse(documentData.previous_id_cards)
      } catch {
        documentData.previous_id_cards = []
      }
    }
    renderCard(documentData)
    renderPreviousCardsTable(documentData.previous_id_cards || [])
    document.getElementById('loading').style.display = 'none'
    document.getElementById('content').style.display = 'block'
    document.getElementById('noData').style.display = 'none'
  } else {
    document.getElementById('loading').style.display = 'none'
    document.getElementById('noData').style.display = 'block'
  }
}

// --- Отрисовка карточки (лицевая и оборотная стороны) ---
function renderCard(data) {
  document.getElementById('surname1').textContent = data.surname1 || '—'
  document.getElementById('name1').textContent = data.name1 || '—'
  document.getElementById('patronymic1').textContent = data.patronymic1 || '—'
  document.getElementById('birthDate').textContent = formatDate(data.birth_date)
  document.getElementById('gender1').textContent = data.gender1 || '—'
  document.getElementById('birthPlace').textContent = data.birth_place || '—'
  document.getElementById('issueDate').textContent = formatDate(data.issue_date)
  document.getElementById('expiryDate').textContent = formatDate(data.expiry_date)
  document.getElementById('cardNumber').textContent = data.card_number || '—'
  document.getElementById('backCardNumber').textContent = data.card_number || '—'
  document.getElementById('departmentCode').textContent = data.department_code || '—'
  document.getElementById('issuedBy').textContent = data.issued_by || '—'
  document.getElementById('personalCode').textContent = data.personal_code_ref || userPersonalCode || '—'
  document.getElementById('oms').textContent = data.oms_policy_number || '—'
  const blood = data.blood_group ? (data.rh_factor ? `${data.blood_group} ${data.rh_factor}` : data.blood_group) : '—'
  document.getElementById('blood').textContent = blood
  document.getElementById('inn').textContent = data.inn_number || '—'
  document.getElementById('nss').textContent = data.nss_number || '—'
  document.getElementById('address').textContent = data.registration_address || '—'

  // Фото и подпись
  const safeCode = (userPersonalCode || '').replace(/[^a-zA-Z0-9\-]/g, '')
  const photoImg = document.getElementById('userPhoto')
  const signatureImg = document.getElementById('userSignature')
  if (safeCode) {
    photoImg.src = `../../images/avatars/${safeCode}.jpg`
    photoImg.onerror = () => { photoImg.src = '../../images/default-avatar.png' }
    signatureImg.src = `../../images/avatars/signatures/${safeCode}.jpg`
    signatureImg.onerror = () => { signatureImg.src = '../../images/default-avatar.png' }
  } else {
    photoImg.src = '../../images/default-avatar.png'
    signatureImg.src = '../../images/default-avatar.png'
  }

  // QR-код
  const qrContainer = document.getElementById('qrCode')
  qrContainer.innerHTML = ''
  if (userPersonalCode) {
    new QRCode(qrContainer, {
      text: userPersonalCode,
      width: 60,
      height: 60,
      colorDark: '#000',
      colorLight: '#fff',
      correctLevel: QRCode.CorrectLevel.L
    })
  }

  // --- Кнопка статуса и редактирования (НОВАЯ ЛОГИКА) ---
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)

  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'

  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)

  // Кнопка замены (ссылка на получение новой ID-карты)
  const replaceLink = document.createElement('a')
  replaceLink.href = '../../services/documents/id-card/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить ID-карту'
  statusAndEdit.appendChild(replaceLink)

  // Кнопка изменения данных (только если статус не verified)
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

  // Вставляем блок перед карточкой (после заголовка статуса)
  const container = document.querySelector('.card-container')
  container.parentNode.insertBefore(statusAndEdit, container)
}
  // ... после создания statusAndEdit ...

  // Переворот карты по клику (без кнопки)
  const cardEl = document.getElementById('card')
  if (cardEl) {
    // Убираем старые обработчики, если были
    cardEl.removeEventListener('click', window.toggleFlip)
    window.toggleFlip = function(e) {
      if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A' && e.target.tagName !== 'IMG') {
        e.currentTarget.classList.toggle('flipped')
      }
    }
    cardEl.addEventListener('click', window.toggleFlip)
  }

// --- Отрисовка таблицы ранее выданных карт на основной странице ---
function renderPreviousCardsTable(cards) {
  const tbody = document.getElementById('previousCardsBody')
  if (!cards || cards.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Нет данных</td></tr>'
    return
  }
  tbody.innerHTML = cards.map(c => `
    <tr>
      <td>${escapeHTML(c.card_number || '')}</td>
      <td>${escapeHTML(c.issued_by || '')}</td>
      <td>${formatDate(c.issue_date)}</td>
      <td>${formatDate(c.expiry_date)}</td>
    </tr>
  `).join('')
}

// --- Переворот карты (удалён по требованию, поэтому убираем обработчики) ---
// Обработчики удалены

// ================== МОДАЛЬНОЕ ОКНО ==================
window.closeModal = function() {
  document.getElementById('modalOverlay').classList.remove('active')
  currentStep = 1
}

function openModal(title) {
  document.getElementById('modalTitle').textContent = title
  document.getElementById('modalOverlay').classList.add('active')
  currentStep = 1
  renderModalStep()
}

function renderModalStep() {
  const modalBody = document.getElementById('modalBody')
  modalBody.innerHTML = ''

  const stepsContainer = document.createElement('div')
  stepsContainer.className = 'modal-steps'

  const stepsIndicator = document.createElement('div')
  stepsIndicator.className = 'steps-indicator'
  stepsIndicator.innerHTML = `
    <span class="step ${currentStep === 1 ? 'active' : ''}">1. Основные данные</span>
    <span class="step ${currentStep === 2 ? 'active' : ''}">2. Предыдущие карты</span>
  `
  stepsContainer.appendChild(stepsIndicator)

  const stepContent = document.createElement('div')
  stepContent.className = 'step-content'

  if (currentStep === 1) {
    stepContent.appendChild(createMainDataForm())
  } else {
    stepContent.appendChild(createPreviousCardsForm())
  }

  stepsContainer.appendChild(stepContent)

  const navButtons = document.createElement('div')
  navButtons.className = 'step-nav-buttons'
  navButtons.style.display = 'flex'
  navButtons.style.justifyContent = 'space-between'
  navButtons.style.marginTop = '1rem'

  if (currentStep === 1) {
    const nextBtn = document.createElement('button')
    nextBtn.type = 'button'
    nextBtn.className = 'btn-primary'
    nextBtn.textContent = 'Далее →'
    nextBtn.onclick = () => {
      collectMainDataFromForm()
      currentStep = 2
      renderModalStep()
    }
    navButtons.appendChild(document.createElement('span'))
    navButtons.appendChild(nextBtn)
  } else {
    const prevBtn = document.createElement('button')
    prevBtn.type = 'button'
    prevBtn.className = 'btn-secondary'
    prevBtn.textContent = '← Назад'
    prevBtn.onclick = () => {
      currentStep = 1
      renderModalStep()
    }
    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'
    saveBtn.className = 'btn-primary'
    saveBtn.textContent = 'Сохранить'
    saveBtn.onclick = saveDocument
    navButtons.appendChild(prevBtn)
    navButtons.appendChild(saveBtn)
  }

  stepsContainer.appendChild(navButtons)
  modalBody.appendChild(stepsContainer)

  if (currentStep === 2) {
    renderPreviousCardsModalList()
  }
}

// --- Форма основных данных (шаг 1) ---
function createMainDataForm() {
  const container = document.createElement('div')
  container.className = 'main-data-form'

  const fields = [
    { id: 'edit_surname1', label: 'Фамилия', type: 'text', value: formData.surname1 },
    { id: 'edit_name1', label: 'Имя', type: 'text', value: formData.name1 },
    { id: 'edit_patronymic1', label: 'Отчество', type: 'text', value: formData.patronymic1 },
    { id: 'edit_birth_date', label: 'Дата рождения', type: 'date', value: formData.birth_date },
    { id: 'edit_birth_place', label: 'Место рождения', type: 'text', value: formData.birth_place },
    { id: 'edit_gender1', label: 'Пол', type: 'select', options: ['Мужской', 'Женский'], value: formData.gender1 },
    { id: 'edit_issue_date', label: 'Дата выдачи', type: 'date', value: formData.issue_date },
    { id: 'edit_expiry_date', label: 'Срок действия', type: 'date', value: formData.expiry_date },
    { id: 'edit_card_number', label: 'Номер карты', type: 'text', value: formData.card_number },
    { id: 'edit_issued_by', label: 'Кем выдан', type: 'text', value: formData.issued_by },
    { id: 'edit_department_code', label: 'Код подразделения', type: 'text', value: formData.department_code },
    { id: 'edit_personal_code_ref', label: 'Личный код', type: 'text', value: userPersonalCode, readonly: true },
    { id: 'edit_oms_policy_number', label: 'Номер полиса ОМС', type: 'text', value: formData.oms_policy_number },
    { id: 'edit_blood_group', label: 'Группа крови', type: 'text', value: formData.blood_group },
    { id: 'edit_rh_factor', label: 'Резус-фактор', type: 'text', value: formData.rh_factor },
    { id: 'edit_inn_number', label: 'ИНН', type: 'text', value: formData.inn_number },
    { id: 'edit_nss_number', label: 'Номер НСС', type: 'text', value: formData.nss_number },
    { id: 'edit_registration_address', label: 'Адрес регистрации', type: 'textarea', value: formData.registration_address }
  ]

  fields.forEach(field => {
    const group = document.createElement('div')
    group.className = 'form-group'

    const label = document.createElement('label')
    label.htmlFor = field.id
    label.textContent = field.label
    group.appendChild(label)

    if (field.type === 'select') {
      const select = document.createElement('select')
      select.id = field.id
      select.className = 'form-input'
      field.options.forEach(opt => {
        const option = document.createElement('option')
        option.value = opt
        option.textContent = opt
        if (opt === field.value) option.selected = true
        select.appendChild(option)
      })
      group.appendChild(select)
    } else if (field.type === 'textarea') {
      const textarea = document.createElement('textarea')
      textarea.id = field.id
      textarea.className = 'form-textarea'
      textarea.value = field.value || ''
      group.appendChild(textarea)
    } else {
      const input = document.createElement('input')
      input.type = field.type
      input.id = field.id
      input.className = 'form-input'
      input.value = field.value || ''
      if (field.readonly) input.readOnly = true
      group.appendChild(input)
    }

    container.appendChild(group)
  })

  return container
}

// --- Форма для предыдущих карт (шаг 2) ---
function createPreviousCardsForm() {
  const container = document.createElement('div')
  container.className = 'previous-cards-form'

  const addSection = document.createElement('div')
  addSection.className = 'add-card-section'
  addSection.innerHTML = '<h5>Добавить предыдущую карту</h5>'

  const fields = [
    { id: 'prev_card_number', label: 'Номер карты', type: 'text' },
    { id: 'prev_issued_by', label: 'Кем выдан', type: 'text' },
    { id: 'prev_issue_date', label: 'Дата выдачи', type: 'date' },
    { id: 'prev_expiry_date', label: 'Срок действия', type: 'date' }
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
    group.appendChild(input)

    addSection.appendChild(group)
  })

  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'btn-primary'
  addBtn.textContent = 'Добавить'
  addBtn.style.marginTop = '0.5rem'
  addBtn.onclick = addPreviousCard
  addSection.appendChild(addBtn)

  container.appendChild(addSection)

  const listSection = document.createElement('div')
  listSection.className = 'cards-list-section'
  listSection.innerHTML = '<h5>Добавленные карты</h5>'
  const listContainer = document.createElement('div')
  listContainer.id = 'previousCardsModalList'
  listSection.appendChild(listContainer)
  container.appendChild(listSection)

  return container
}

// --- Отображение списка добавленных карт внутри модального окна ---
function renderPreviousCardsModalList() {
  const container = document.getElementById('previousCardsModalList')
  if (!container) return

  if (!formData.previous_id_cards || formData.previous_id_cards.length === 0) {
    container.innerHTML = '<p>Нет добавленных карт</p>'
    return
  }

  const table = document.createElement('table')
  table.className = 'previous-table'
  table.innerHTML = `
    <thead>
      <tr>
        <th>Номер карты</th>
        <th>Кем выдан</th>
        <th>Дата выдачи</th>
        <th>Срок действия</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${formData.previous_id_cards.map((card, index) => `
        <tr>
          <td>${escapeHTML(card.card_number)}</td>
          <td>${escapeHTML(card.issued_by)}</td>
          <td>${formatDate(card.issue_date)}</td>
          <td>${formatDate(card.expiry_date)}</td>
          <td><button type="button" class="btn-secondary" style="padding:0.2rem 0.5rem;" onclick="window.removePreviousCard(${index})">Удалить</button></td>
        </tr>
      `).join('')}
    </tbody>
  `
  container.innerHTML = ''
  container.appendChild(table)
}

// --- Добавление новой предыдущей карты ---
window.addPreviousCard = function() {
  const cardNumber = document.getElementById('prev_card_number')?.value.trim()
  const issuedBy = document.getElementById('prev_issued_by')?.value.trim()
  const issueDate = document.getElementById('prev_issue_date')?.value
  const expiryDate = document.getElementById('prev_expiry_date')?.value

  if (!cardNumber) {
    alert('Номер карты обязателен')
    return
  }

  const newCard = {
    card_number: cardNumber,
    issued_by: issuedBy || '',
    issue_date: issueDate || null,
    expiry_date: expiryDate || null
  }

  if (!formData.previous_id_cards) formData.previous_id_cards = []
  formData.previous_id_cards.push(newCard)

  document.getElementById('prev_card_number').value = ''
  document.getElementById('prev_issued_by').value = ''
  document.getElementById('prev_issue_date').value = ''
  document.getElementById('prev_expiry_date').value = ''

  renderPreviousCardsModalList()
}

// --- Удаление предыдущей карты ---
window.removePreviousCard = function(index) {
  if (formData.previous_id_cards && index >= 0 && index < formData.previous_id_cards.length) {
    formData.previous_id_cards.splice(index, 1)
    renderPreviousCardsModalList()
  }
}

// --- Сбор данных с первого шага ---
function collectMainDataFromForm() {
  formData.surname1 = document.getElementById('edit_surname1')?.value || ''
  formData.name1 = document.getElementById('edit_name1')?.value || ''
  formData.patronymic1 = document.getElementById('edit_patronymic1')?.value || ''
  formData.birth_date = document.getElementById('edit_birth_date')?.value || ''
  formData.birth_place = document.getElementById('edit_birth_place')?.value || ''
  formData.gender1 = document.getElementById('edit_gender1')?.value || ''
  formData.issue_date = document.getElementById('edit_issue_date')?.value || ''
  formData.expiry_date = document.getElementById('edit_expiry_date')?.value || ''
  formData.card_number = document.getElementById('edit_card_number')?.value || ''
  formData.issued_by = document.getElementById('edit_issued_by')?.value || ''
  formData.department_code = document.getElementById('edit_department_code')?.value || ''
  formData.personal_code_ref = document.getElementById('edit_personal_code_ref')?.value || userPersonalCode
  formData.oms_policy_number = document.getElementById('edit_oms_policy_number')?.value || ''
  formData.blood_group = document.getElementById('edit_blood_group')?.value || ''
  formData.rh_factor = document.getElementById('edit_rh_factor')?.value || ''
  formData.inn_number = document.getElementById('edit_inn_number')?.value || ''
  formData.nss_number = document.getElementById('edit_nss_number')?.value || ''
  formData.registration_address = document.getElementById('edit_registration_address')?.value || ''
}

// --- Открытие модалки для добавления ---
function openAddModal() {
  formData = {
    surname1: '',
    name1: '',
    patronymic1: '',
    birth_date: '',
    birth_place: '',
    gender1: '',
    issue_date: '',
    expiry_date: '',
    card_number: '',
    issued_by: '',
    department_code: '',
    personal_code_ref: userPersonalCode || '',
    oms_policy_number: '',
    blood_group: '',
    rh_factor: '',
    inn_number: '',
    nss_number: '',
    registration_address: '',
    previous_id_cards: []
  }
  openModal('Добавление ID-карты')
}

// --- Открытие модалки для редактирования ---
function openEditModal() {
  formData = {
    surname1: documentData.surname1 || '',
    name1: documentData.name1 || '',
    patronymic1: documentData.patronymic1 || '',
    birth_date: documentData.birth_date || '',
    birth_place: documentData.birth_place || '',
    gender1: documentData.gender1 || '',
    issue_date: documentData.issue_date || '',
    expiry_date: documentData.expiry_date || '',
    card_number: documentData.card_number || '',
    issued_by: documentData.issued_by || '',
    department_code: documentData.department_code || '',
    personal_code_ref: documentData.personal_code_ref || userPersonalCode || '',
    oms_policy_number: documentData.oms_policy_number || '',
    blood_group: documentData.blood_group || '',
    rh_factor: documentData.rh_factor || '',
    inn_number: documentData.inn_number || '',
    nss_number: documentData.nss_number || '',
    registration_address: documentData.registration_address || '',
    previous_id_cards: documentData.previous_id_cards || []
  }
  openModal('Редактирование ID-карты')
}

// --- Сохранение документа ---
async function saveDocument() {
  if (currentStep === 2) {
    // ничего дополнительно не собираем
  } else {
    collectMainDataFromForm()
  }

  if (!formData.card_number) {
    alert('Номер карты обязателен')
    return
  }

  const dataToSend = {
    ...formData,
    personal_code: userPersonalCode,
    status: 'oncheck',
    updated_at: new Date().toISOString(),
    previous_id_cards: formData.previous_id_cards || []
  }

  console.log('Сохранение:', dataToSend)

  let result
  if (currentDocId) {
    result = await supabase
      .from('documents_idcard')
      .update(dataToSend)
      .eq('id', currentDocId)
      .select()
  } else {
    dataToSend.created_at = new Date().toISOString()
    result = await supabase
      .from('documents_idcard')
      .insert([dataToSend])
      .select()
  }

  if (result.error) {
    alert('Ошибка сохранения: ' + result.error.message)
    console.error(result.error)
    return
  }

  console.log('Сохранение успешно, ответ:', result)
  window.closeModal()
  const newId = currentDocId || result.data[0].id
  window.location.href = `id-card.html?id=${newId}`
}

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()
  document.getElementById('addBtn')?.addEventListener('click', openAddModal)
  // Обработчик для editBtn теперь создаётся динамически в renderCard, поэтому здесь не нужен
  document.getElementById('modalSaveBtn')?.addEventListener('click', saveDocument)
})

// Экспорт в глобальную область
window.closeModal = closeModal
window.openAddModal = openAddModal
window.openEditModal = openEditModal
window.addPreviousCard = addPreviousCard
window.removePreviousCard = removePreviousCard