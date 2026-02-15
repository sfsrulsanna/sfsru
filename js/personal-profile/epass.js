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
  epass_number: '',
  personal_code_ref: ''
}

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

function calculateAge(birthDate) {
  if (!birthDate) return ''
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return `(${age} лет)`
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
        .from('documents_epass')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .from('documents_epass')
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
      renderCard(documentData)
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

// ==================== ОТРИСОВКА КАРТОЧКИ ====================
function renderCard(data) {
  // Устанавливаем значения полей
  const setText = (id, text) => {
    const el = document.getElementById(id)
    if (el) el.textContent = text
    else console.warn(`Element #${id} not found`)
  }

  setText('surname', data.surname || '—')
  setText('name', data.name || '—')
  setText('patronymic', data.patronymic || '—')
  
  // Дата рождения и возраст отдельно
  const birthEl = document.getElementById('birthDate')
  if (birthEl) birthEl.textContent = formatDate(data.birth_date)
  const ageEl = document.getElementById('age')
  if (ageEl) ageEl.textContent = calculateAge(data.birth_date)

  setText('gender', data.gender || '—')
  setText('personalCode', data.personal_code_ref || userPersonalCode || '—')
  setText('epassNumber', data.epass_number || '—')

  // Фото
  const safeCode = (userPersonalCode || '').replace(/[^a-zA-Z0-9\-]/g, '')
  const photoImg = document.getElementById('userPhoto')
  if (photoImg) {
    if (safeCode) {
      photoImg.src = `../../images/avatars/${safeCode}.jpg`
      photoImg.onerror = () => { photoImg.src = '../../images/default-avatar.png' }
    } else {
      photoImg.src = '../../images/default-avatar.png'
    }
  }

  // QR-код
  const qrContainer = document.getElementById('qrCode')
  if (qrContainer) {
    qrContainer.innerHTML = ''
    if (userPersonalCode) {
      new QRCode(qrContainer, {
        text: userPersonalCode,
        width: 80,
        height: 80,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L
      })
    }
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
  replaceLink.href = '../../services/documents/epass/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить E-Pass'
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

  const card = document.querySelector('.epass-card')
  if (card && card.parentNode) {
    card.parentNode.insertBefore(statusAndEdit, card.nextSibling)
  }
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
window.closeModal = function() {
  const overlay = document.getElementById('modalOverlay')
  if (overlay) overlay.classList.remove('active')
}

function openModal(title) {
  const titleEl = document.getElementById('modalTitle')
  if (titleEl) titleEl.textContent = title
  const overlay = document.getElementById('modalOverlay')
  if (overlay) overlay.classList.add('active')
  renderModalForm()
}

function renderModalForm() {
  const modalBody = document.getElementById('modalBody')
  if (!modalBody) return

  modalBody.innerHTML = ''
  const fields = [
    { id: 'edit_surname', label: 'Фамилия', type: 'text', value: formData.surname },
    { id: 'edit_name', label: 'Имя', type: 'text', value: formData.name },
    { id: 'edit_patronymic', label: 'Отчество', type: 'text', value: formData.patronymic },
    { id: 'edit_birth_date', label: 'Дата рождения', type: 'date', value: formData.birth_date },
    { id: 'edit_gender', label: 'Пол', type: 'select', options: ['Мужской', 'Женский'], value: formData.gender },
    { id: 'edit_epass_number', label: 'Номер E-Pass', type: 'text', value: formData.epass_number },
    { id: 'edit_personal_code_ref', label: 'Личный код', type: 'text', value: userPersonalCode, readonly: true }
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
    } else {
      const input = document.createElement('input')
      input.type = field.type
      input.id = field.id
      input.className = 'form-input'
      input.value = field.value || ''
      if (field.readonly) input.readOnly = true
      group.appendChild(input)
    }

    modalBody.appendChild(group)
  })
}

function collectFormData() {
  const getVal = (id) => (document.getElementById(id)?.value || '').trim()
  return {
    surname: getVal('edit_surname'),
    name: getVal('edit_name'),
    patronymic: getVal('edit_patronymic'),
    birth_date: getVal('edit_birth_date'),
    gender: getVal('edit_gender'),
    epass_number: getVal('edit_epass_number'),
    personal_code_ref: getVal('edit_personal_code_ref') || userPersonalCode
  }
}

async function saveDocument() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { alert('Ошибка авторизации'); return }
    if (!userPersonalCode) { alert('Личный код не загружен'); return }

    const newData = collectFormData()
    if (!newData.epass_number) {
      alert('Номер E-Pass обязателен')
      return
    }

    const cleanData = { ...newData }
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === null || cleanData[key] === undefined) delete cleanData[key]
    })

    const dataToSend = {
      ...cleanData,
      user_id: session.user.id,
      personal_code: userPersonalCode,
      status: 'oncheck',
      updated_at: new Date().toISOString()
    }

    let result
    if (currentDocId) {
      result = await supabase
        .from('documents_epass')
        .update(dataToSend)
        .eq('id', currentDocId)
        .select()
    } else {
      dataToSend.created_at = new Date().toISOString()
      result = await supabase
        .from('documents_epass')
        .insert([dataToSend])
        .select()
    }

    if (result.error) throw result.error

    window.closeModal()
    const newId = currentDocId || result.data[0].id
    window.location.href = `epass.html?id=${newId}`
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
    epass_number: '',
    personal_code_ref: userPersonalCode || ''
  }
  openModal('Добавление E-Pass')
}

function openEditModal() {
  formData = {
    surname: documentData.surname || '',
    name: documentData.name || '',
    patronymic: documentData.patronymic || '',
    birth_date: documentData.birth_date || '',
    gender: documentData.gender || '',
    epass_number: documentData.epass_number || '',
    personal_code_ref: documentData.personal_code_ref || userPersonalCode || ''
  }
  openModal('Редактирование E-Pass')
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()
  document.getElementById('addBtn')?.addEventListener('click', openAddModal)
  document.getElementById('modalSaveBtn')?.addEventListener('click', saveDocument)
})

// Экспорт в глобальную область
window.openAddModal = openAddModal
window.openEditModal = openEditModal
window.closeModal = closeModal