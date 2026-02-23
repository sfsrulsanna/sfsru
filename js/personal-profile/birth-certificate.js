import { supabase } from '../../js/supabase-config.js'

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentDocId = null
let documentData = {}
let userPersonalCode = null
let userProfile = null
let userId = null

let formData = {
  child_full_name: '',
  child_birth_date: '',
  child_birth_place: '',
  child_personal_code: '',
  father_full_name: '',
  father_citizenship: '',
  father_nationality: '',
  father_personal_code: '',
  mother_full_name: '',
  mother_citizenship: '',
  mother_nationality: '',
  mother_personal_code: '',
  registry_act_number: '',
  registry_act_date: '',
  registry_place: '',
  registry_official: '',
  certificate_series_number: '',
  issue_date: '',
  status: 'oncheck'
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

function formatDateForRussian(dateString) {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ]
    const day = date.getDate()
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    return `${day} ${month} ${year} года`
  } catch {
    return dateString
  }
}

function getStatusLabel(status) {
  if (status === 'verified') return '✅ Подтверждено'
  if (status === 'oncheck') return '⏳ На проверке'
  if (status === 'rejected') return '❌ Отклонено'
  if (status === 'archived') return '📦 Архивный'
  return '—'
}

function getStatusClass(status) {
  if (status === 'verified') return 'document-status status-verified'
  if (status === 'oncheck') return 'document-status status-pending'
  if (status === 'rejected') return 'document-status status-rejected'
  if (status === 'archived') return 'document-status status-archived'
  return 'document-status'
}

function escapeHTML(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
        .from('documents_birth_certificate')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .from('documents_birth_certificate')
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
      renderCertificate(data)
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

// ==================== ОТРИСОВКА СВИДЕТЕЛЬСТВА ====================
function renderCertificate(data) {
  // Разбиваем ФИО на части
  const childNameParts = (data.child_full_name || '').split(' ')
  const childSurname = childNameParts[0] || '—'
  const childFirstPatronymic = childNameParts.slice(1).join(' ') || '—'

  const fatherNameParts = (data.father_full_name || '').split(' ')
  const fatherSurname = fatherNameParts[0] || '—'
  const fatherFirstPatronymic = fatherNameParts.slice(1).join(' ') || '—'

  const motherNameParts = (data.mother_full_name || '').split(' ')
  const motherSurname = motherNameParts[0] || '—'
  const motherFirstPatronymic = motherNameParts.slice(1).join(' ') || '—'

  // Дата актовой записи
  let actYear = ''
  let actMonth = '____'
  let actDay = ''
  if (data.registry_act_date) {
    const actDate = new Date(data.registry_act_date)
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ]
    actYear = actDate.getFullYear()
    actMonth = months[actDate.getMonth()]
    actDay = String(actDate.getDate()).padStart(2, '0')
  }

  const html = `
    <div class="certificate-header">
      <div class="title">СВИДЕТЕЛЬСТВО</div>
      <div class="subtitle">О РОЖДЕНИИ</div>
    </div>
    
    <div class="certificate-content">
      <!-- Фамилия ребенка -->
      <div class="field-block">
        <div class="field-value">${escapeHTML(childSurname)}</div>
        <div class="field-line"></div>
        <div class="field-label">фамилия</div>
      </div>
      
      <!-- Имя Отчество -->
      <div class="field-block">
        <div class="field-value">${escapeHTML(childFirstPatronymic)}</div>
        <div class="field-line"></div>
        <div class="field-label">имя отчество</div>
      </div>
      
      <!-- Дата рождения -->
      <div class="field-block">
        <div class="field-value">${formatDateForRussian(data.child_birth_date)}</div>
        <div class="field-line"></div>
        <div class="field-label">дата рождения</div>
      </div>
      
      <!-- Место рождения -->
      <div class="field-block">
        <div class="field-value">${escapeHTML(data.child_birth_place || '—')}</div>
        <div class="field-line"></div>
        <div class="field-label">место рождения</div>
      </div>
      
      <!-- Актовая запись -->
      <div class="registration-block">
        <span class="label">о чем</span>
        <span class="value">${actYear}</span>
        <span class="label">года</span>
        <span class="value">${actMonth}</span>
        <span class="label">месяца</span>
        <span class="value">${actDay}</span>
        <span class="label">числа составлена запись акта о рождении №</span>
        <span class="value">${escapeHTML(data.registry_act_number || '—')}</span>
      </div>
      
      <!-- Родители -->
      <div class="parents-section">
        <!-- Отец -->
        <div class="parent-block">
          <div class="parent-row">
            <span class="parent-title">Отец</span>
            <div class="field-block">
              <div class="field-value">${escapeHTML(fatherSurname)}</div>
              <div class="field-line"></div>
              <div class="field-label">фамилия</div>
            </div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(fatherFirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.father_citizenship || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">гражданство</div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.father_nationality || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">национальность</div>
          </div>
        </div>
        
        <!-- Мать -->
        <div class="parent-block">
          <div class="parent-row">
            <span class="parent-title">Мать</span>
            <div class="field-block">
              <div class="field-value">${escapeHTML(motherSurname)}</div>
              <div class="field-line"></div>
              <div class="field-label">фамилия</div>
            </div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(motherFirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.mother_citizenship || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">гражданство</div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.mother_nationality || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">национальность</div>
          </div>
        </div>
      </div>
      
      <!-- Место государственной регистрации -->
      <div class="registration-row">
        <span class="label">Место государственной регистрации:</span>
        <span class="value">${escapeHTML(data.registry_place || '—')}</span>
      </div>
      
      <!-- Правая колонка: дата выдачи и руководитель -->
      <div class="right-info">
        <div class="info-row">
          <span class="info-label">Дата выдачи:</span>
          <span class="info-value">${formatDate(data.issue_date)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Руководитель органа ЗАГС</span>
          <span class="info-value">${escapeHTML(data.registry_official || '—')}</span>
        </div>
      </div>
      
      <!-- Серия и номер -->
      <div class="series-number">
        ${escapeHTML(data.certificate_series_number || '—')}
      </div>
    </div>
  `

  document.getElementById('certificateContainer').innerHTML = html

  // Блок статуса и кнопок
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)
  
  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'
  
  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)
  
  const replaceLink = document.createElement('a')
  replaceLink.href = '../../services/documents/birth-certificate/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить свидетельство'
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
  
  document.getElementById('statusAndEditContainer').appendChild(statusAndEdit)
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
window.closeModal = function() {
  document.getElementById('modalOverlay').classList.remove('active')
}

function openModal(title) {
  document.getElementById('modalTitle').textContent = title
  document.getElementById('modalOverlay').classList.add('active')
  renderModalForm()
}

function renderModalForm() {
  const modalBody = document.getElementById('modalBody')
  if (!modalBody) return
  
  modalBody.innerHTML = `
    <div class="form-group">
      <label>ФИО ребёнка (полностью)</label>
      <input type="text" id="edit_child_full_name" class="form-input" value="${escapeHTML(formData.child_full_name || '')}">
    </div>
    
    <div class="form-group">
      <label>Дата рождения ребёнка</label>
      <input type="date" id="edit_child_birth_date" class="form-input" value="${formData.child_birth_date || ''}">
    </div>
    
    <div class="form-group">
      <label>Место рождения ребёнка</label>
      <input type="text" id="edit_child_birth_place" class="form-input" value="${escapeHTML(formData.child_birth_place || '')}">
    </div>
    
    <div class="form-group">
      <label>Личный код ребёнка</label>
      <input type="text" id="edit_child_personal_code" class="form-input" value="${escapeHTML(formData.child_personal_code || '')}">
    </div>
    
<!-- Родители -->
<div class="parents-section">
  <!-- Отец -->
  <div class="parent-block">
    <div class="parent-row">
      <span class="parent-title">Отец</span>
      <div class="field-block">
        <div class="field-value">${escapeHTML(fatherSurname)}</div>
        <div class="field-line"></div>
        <div class="field-label">фамилия</div>
      </div>
    </div>
    <div class="field-block">
      <div class="field-value">${escapeHTML(fatherFirstPatronymic)}</div>
      <div class="field-line"></div>
      <div class="field-label">имя отчество</div>
    </div>
    <div class="field-block">
      <div class="field-value">${escapeHTML(data.father_citizenship || '—')}</div>
      <div class="field-line"></div>
      <div class="field-label">гражданство</div>
    </div>
    <div class="field-block">
      <div class="field-value">${escapeHTML(data.father_nationality || '—')}</div>
      <div class="field-line"></div>
      <div class="field-label">национальность</div>
    </div>
  </div>
  
  <!-- Мать -->
  <div class="parent-block">
    <div class="parent-row">
      <span class="parent-title">Мать</span>
      <div class="field-block">
        <div class="field-value">${escapeHTML(motherSurname)}</div>
        <div class="field-line"></div>
        <div class="field-label">фамилия</div>
      </div>
    </div>
    <div class="field-block">
      <div class="field-value">${escapeHTML(motherFirstPatronymic)}</div>
      <div class="field-line"></div>
      <div class="field-label">имя отчество</div>
    </div>
    <div class="field-block">
      <div class="field-value">${escapeHTML(data.mother_citizenship || '—')}</div>
      <div class="field-line"></div>
      <div class="field-label">гражданство</div>
    </div>
    <div class="field-block">
      <div class="field-value">${escapeHTML(data.mother_nationality || '—')}</div>
      <div class="field-line"></div>
      <div class="field-label">национальность</div>
    </div>
  </div>
    
    <div class="form-group">
      <label>Дата актовой записи</label>
      <input type="date" id="edit_registry_act_date" class="form-input" value="${formData.registry_act_date || ''}">
    </div>
    
    <div class="form-group">
      <label>Место регистрации</label>
      <input type="text" id="edit_registry_place" class="form-input" value="${escapeHTML(formData.registry_place || '')}">
    </div>
    
    <div class="form-group">
      <label>Руководитель органа ЗАГС</label>
      <input type="text" id="edit_registry_official" class="form-input" value="${escapeHTML(formData.registry_official || '')}">
    </div>

    <h4>Свидетельство</h4>
    <div class="form-group">
      <label>Серия и номер свидетельства</label>
      <input type="text" id="edit_certificate_series_number" class="form-input" value="${escapeHTML(formData.certificate_series_number || '')}">
    </div>
    
    <div class="form-group">
      <label>Дата выдачи</label>
      <input type="date" id="edit_issue_date" class="form-input" value="${formData.issue_date || ''}">
    </div>
  `
}

function collectFormData() {
  const getVal = (id) => (document.getElementById(id)?.value || '').trim()
  return {
    child_full_name: getVal('edit_child_full_name'),
    child_birth_date: getVal('edit_child_birth_date'),
    child_birth_place: getVal('edit_child_birth_place'),
    child_personal_code: getVal('edit_child_personal_code'),
    father_full_name: getVal('edit_father_full_name'),
    father_citizenship: getVal('edit_father_citizenship'),
    father_nationality: getVal('edit_father_nationality'),
    father_personal_code: getVal('edit_father_personal_code'),
    mother_full_name: getVal('edit_mother_full_name'),
    mother_citizenship: getVal('edit_mother_citizenship'),
    mother_nationality: getVal('edit_mother_nationality'),
    mother_personal_code: getVal('edit_mother_personal_code'),
    registry_act_number: getVal('edit_registry_act_number'),
    registry_act_date: getVal('edit_registry_act_date'),
    registry_place: getVal('edit_registry_place'),
    registry_official: getVal('edit_registry_official'),
    certificate_series_number: getVal('edit_certificate_series_number'),
    issue_date: getVal('edit_issue_date')
  }
}

async function saveDocument() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { alert('Ошибка авторизации'); return }
    if (!userPersonalCode) { alert('Личный код не загружен'); return }
    
    const newData = collectFormData()
    
    if (!newData.certificate_series_number) {
      alert('Серия и номер свидетельства обязательны')
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
        .from('documents_birth_certificate')
        .update(dataToSend)
        .eq('id', currentDocId)
        .select()
    } else {
      dataToSend.created_at = new Date().toISOString()
      result = await supabase
        .from('documents_birth_certificate')
        .insert([dataToSend])
        .select()
    }

    if (result.error) throw result.error

    window.closeModal()
    const newId = currentDocId || result.data[0].id
    window.location.href = `birth-certificate.html?id=${newId}`
  } catch (err) {
    console.error('Ошибка сохранения:', err)
    alert('Ошибка сохранения: ' + err.message)
  }
}

// ==================== ОТКРЫТИЕ МОДАЛОК ====================
function openAddModal() {
  formData = {
    child_full_name: '',
    child_birth_date: '',
    child_birth_place: '',
    child_personal_code: userPersonalCode || '',
    father_full_name: '',
    father_citizenship: '',
    father_nationality: '',
    father_personal_code: '',
    mother_full_name: '',
    mother_citizenship: '',
    mother_nationality: '',
    mother_personal_code: '',
    registry_act_number: '',
    registry_act_date: '',
    registry_place: '',
    registry_official: '',
    certificate_series_number: '',
    issue_date: '',
    status: 'oncheck'
  }
  openModal('Добавление свидетельства о рождении')
}

function openEditModal() {
  formData = { ...documentData }
  openModal('Редактирование свидетельства о рождении')
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()
  document.getElementById('addBtn')?.addEventListener('click', openAddModal)
  document.getElementById('saveBtn')?.addEventListener('click', saveDocument)
})

// Экспорт в глобальную область
window.openAddModal = openAddModal
window.openEditModal = openEditModal
window.closeModal = closeModal