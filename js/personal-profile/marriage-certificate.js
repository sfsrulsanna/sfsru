import { supabase } from '../../js/supabase-config.js'

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentDocId = null
let documentData = {}
let userPersonalCode = null
let userProfile = null
let userId = null

let formData = {
  husband_full_name: '',
  husband_birth_date: '',
  husband_birth_place: '',
  husband_citizenship: '',
  husband_nationality: '',
  husband_personal_code: '',
  wife_full_name: '',
  wife_birth_date: '',
  wife_birth_place: '',
  wife_citizenship: '',
  wife_nationality: '',
  wife_personal_code: '',
  marriage_date: '',
  registry_act_number: '',
  registry_act_date: '',
  assigned_surname_husband: '',
  assigned_surname_wife: '',
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
        .from('documents_marriage_certificate')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .from('documents_marriage_certificate')
        .select('*')
        .or(`husband_personal_code.eq.${userPersonalCode},wife_personal_code.eq.${userPersonalCode}`)
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
  // Разбиваем ФИО супругов на части
  const husbandNameParts = (data.husband_full_name || '').split(' ')
  const husbandSurname = husbandNameParts[0] || '—'
  const husbandFirstPatronymic = husbandNameParts.slice(1).join(' ') || '—'

  const wifeNameParts = (data.wife_full_name || '').split(' ')
  const wifeSurname = wifeNameParts[0] || '—'
  const wifeFirstPatronymic = wifeNameParts.slice(1).join(' ') || '—'

  // Дата брака
  const marriageDate = data.marriage_date ? formatDateForRussian(data.marriage_date) : '—'

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
      <div class="subtitle">О ЗАКЛЮЧЕНИИ БРАКА</div>
    </div>
    
    <div class="certificate-content">
      <!-- МУЖ -->
      <div class="spouse-section">
        <div class="spouse-block">
          <div class="spouse-row">
            <span class="spouse-title">Муж</span>
            <div class="field-block">
              <div class="field-value">${escapeHTML(husbandSurname)}</div>
              <div class="field-line"></div>
              <div class="field-label">фамилия</div>
            </div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(husbandFirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
          <!-- Дата рождения отдельно -->
          <div class="field-block">
            <div class="field-value">${formatDate(data.husband_birth_date)}</div>
            <div class="field-line"></div>
            <div class="field-label">дата рождения</div>
          </div>
          <!-- Место рождения отдельно -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.husband_birth_place || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">место рождения</div>
          </div>
          <!-- Гражданство отдельно -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.husband_citizenship || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">гражданство</div>
          </div>
          <!-- Национальность отдельно -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.husband_nationality || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">национальность</div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.husband_personal_code || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">личный код</div>
          </div>
        </div>

        <!-- ЖЕНА -->
        <div class="spouse-block">
          <div class="spouse-row">
            <span class="spouse-title">и</span>
            <div class="field-block">
              <div class="field-value">${escapeHTML(wifeSurname)}</div>
              <div class="field-line"></div>
              <div class="field-label">фамилия</div>
            </div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(wifeFirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
          <!-- Дата рождения отдельно -->
          <div class="field-block">
            <div class="field-value">${formatDate(data.wife_birth_date)}</div>
            <div class="field-line"></div>
            <div class="field-label">дата рождения</div>
          </div>
          <!-- Место рождения отдельно -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.wife_birth_place || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">место рождения</div>
          </div>
          <!-- Гражданство отдельно -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.wife_citizenship || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">гражданство</div>
          </div>
          <!-- Национальность отдельно -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.wife_nationality || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">национальность</div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.wife_personal_code || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">личный код</div>
          </div>
        </div>
      </div>

      <!-- Дата заключения брака -->
      <div class="field-block">
        <div class="field-value">${escapeHTML(marriageDate)}</div>
        <div class="field-line"></div>
        <div class="field-label">заключили брак</div>
      </div>

      <!-- Актовая запись -->
      <div class="registration-block">
        <span class="label">о чем</span>
        <span class="value">${actYear}</span>
        <span class="label">года</span>
        <span class="value">${actMonth}</span>
        <span class="label">месяца</span>
        <span class="value">${actDay}</span>
        <span class="label">числа составлена запись акта о заключении брака №</span>
        <span class="value">${escapeHTML(data.registry_act_number || '—')}</span>
      </div>

      <!-- Пояснение перед присвоенными фамилиями -->
      <div class="section-label">После заключения брака присвоены фамилии:</div>

      <!-- Присвоенные фамилии (вертикально) -->
      <div class="assigned-row">
        <div class="assigned-item">
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.assigned_surname_husband || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">мужу</div>
          </div>
        </div>
        <div class="assigned-item">
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.assigned_surname_wife || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">жене</div>
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

  // Блок статуса и кнопок (без изменений)
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)
  
  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'
  
  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)
  
  const replaceLink = document.createElement('a')
  replaceLink.href = '../../services/documents/marriage-certificate/'
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
    <h4>Муж</h4>
    <div class="form-group">
      <label>ФИО мужа (полностью)</label>
      <input type="text" id="edit_husband_full_name" class="form-input" value="${escapeHTML(formData.husband_full_name || '')}">
    </div>
    <div class="form-group">
      <label>Дата рождения мужа</label>
      <input type="date" id="edit_husband_birth_date" class="form-input" value="${formData.husband_birth_date || ''}">
    </div>
    <div class="form-group">
      <label>Место рождения мужа</label>
      <input type="text" id="edit_husband_birth_place" class="form-input" value="${escapeHTML(formData.husband_birth_place || '')}">
    </div>
    <div class="form-group">
      <label>Гражданство мужа</label>
      <input type="text" id="edit_husband_citizenship" class="form-input" value="${escapeHTML(formData.husband_citizenship || '')}">
    </div>
    <div class="form-group">
      <label>Национальность мужа</label>
      <input type="text" id="edit_husband_nationality" class="form-input" value="${escapeHTML(formData.husband_nationality || '')}">
    </div>
    <div class="form-group">
      <label>Личный код мужа</label>
      <input type="text" id="edit_husband_personal_code" class="form-input" value="${escapeHTML(formData.husband_personal_code || '')}">
    </div>

    <h4>Жена</h4>
    <div class="form-group">
      <label>ФИО жены (полностью)</label>
      <input type="text" id="edit_wife_full_name" class="form-input" value="${escapeHTML(formData.wife_full_name || '')}">
    </div>
    <div class="form-group">
      <label>Дата рождения жены</label>
      <input type="date" id="edit_wife_birth_date" class="form-input" value="${formData.wife_birth_date || ''}">
    </div>
    <div class="form-group">
      <label>Место рождения жены</label>
      <input type="text" id="edit_wife_birth_place" class="form-input" value="${escapeHTML(formData.wife_birth_place || '')}">
    </div>
    <div class="form-group">
      <label>Гражданство жены</label>
      <input type="text" id="edit_wife_citizenship" class="form-input" value="${escapeHTML(formData.wife_citizenship || '')}">
    </div>
    <div class="form-group">
      <label>Национальность жены</label>
      <input type="text" id="edit_wife_nationality" class="form-input" value="${escapeHTML(formData.wife_nationality || '')}">
    </div>
    <div class="form-group">
      <label>Личный код жены</label>
      <input type="text" id="edit_wife_personal_code" class="form-input" value="${escapeHTML(formData.wife_personal_code || '')}">
    </div>

    <h4>Брак</h4>
    <div class="form-group">
      <label>Дата заключения брака</label>
      <input type="date" id="edit_marriage_date" class="form-input" value="${formData.marriage_date || ''}">
    </div>

    <h4>Актовая запись</h4>
    <div class="form-group">
      <label>Дата актовой записи</label>
      <input type="date" id="edit_registry_act_date" class="form-input" value="${formData.registry_act_date || ''}">
    </div>
    <div class="form-group">
      <label>Номер актовой записи</label>
      <input type="text" id="edit_registry_act_number" class="form-input" value="${escapeHTML(formData.registry_act_number || '')}">
    </div>

    <h4>Фамилии после брака</h4>
    <div class="form-group">
      <label>Присвоенная фамилия мужу</label>
      <input type="text" id="edit_assigned_surname_husband" class="form-input" value="${escapeHTML(formData.assigned_surname_husband || '')}">
    </div>
    <div class="form-group">
      <label>Присвоенная фамилия жене</label>
      <input type="text" id="edit_assigned_surname_wife" class="form-input" value="${escapeHTML(formData.assigned_surname_wife || '')}">
    </div>

    <h4>Свидетельство</h4>
    <div class="form-group">
      <label>Место регистрации</label>
      <input type="text" id="edit_registry_place" class="form-input" value="${escapeHTML(formData.registry_place || '')}">
    </div>
    <div class="form-group">
      <label>Руководитель органа ЗАГС</label>
      <input type="text" id="edit_registry_official" class="form-input" value="${escapeHTML(formData.registry_official || '')}">
    </div>
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
    husband_full_name: getVal('edit_husband_full_name'),
    husband_birth_date: getVal('edit_husband_birth_date'),
    husband_birth_place: getVal('edit_husband_birth_place'),
    husband_citizenship: getVal('edit_husband_citizenship'),
    husband_nationality: getVal('edit_husband_nationality'),
    husband_personal_code: getVal('edit_husband_personal_code'),
    wife_full_name: getVal('edit_wife_full_name'),
    wife_birth_date: getVal('edit_wife_birth_date'),
    wife_birth_place: getVal('edit_wife_birth_place'),
    wife_citizenship: getVal('edit_wife_citizenship'),
    wife_nationality: getVal('edit_wife_nationality'),
    wife_personal_code: getVal('edit_wife_personal_code'),
    marriage_date: getVal('edit_marriage_date'),
    registry_act_date: getVal('edit_registry_act_date'),
    registry_act_number: getVal('edit_registry_act_number'),
    assigned_surname_husband: getVal('edit_assigned_surname_husband'),
    assigned_surname_wife: getVal('edit_assigned_surname_wife'),
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
      status: 'oncheck',
      updated_at: new Date().toISOString()
    }

    let result
    if (currentDocId) {
      result = await supabase
        .from('documents_marriage_certificate')
        .update(dataToSend)
        .eq('id', currentDocId)
        .select()
    } else {
      dataToSend.created_at = new Date().toISOString()
      result = await supabase
        .from('documents_marriage_certificate')
        .insert([dataToSend])
        .select()
    }

    if (result.error) throw result.error

    window.closeModal()
    const newId = currentDocId || result.data[0].id
    window.location.href = `marriage-certificate.html?id=${newId}`
  } catch (err) {
    console.error('Ошибка сохранения:', err)
    alert('Ошибка сохранения: ' + err.message)
  }
}

// ==================== ОТКРЫТИЕ МОДАЛОК ====================
function openAddModal() {
  formData = {
    husband_full_name: '',
    husband_birth_date: '',
    husband_birth_place: '',
    husband_citizenship: '',
    husband_nationality: '',
    husband_personal_code: userPersonalCode || '', // по умолчанию ставим текущего пользователя
    wife_full_name: '',
    wife_birth_date: '',
    wife_birth_place: '',
    wife_citizenship: '',
    wife_nationality: '',
    wife_personal_code: '',
    marriage_date: '',
    registry_act_date: '',
    registry_act_number: '',
    assigned_surname_husband: '',
    assigned_surname_wife: '',
    registry_place: '',
    registry_official: '',
    certificate_series_number: '',
    issue_date: '',
    status: 'oncheck'
  }
  openModal('Добавление свидетельства о браке')
}

function openEditModal() {
  formData = { ...documentData }
  openModal('Редактирование свидетельства о браке')
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