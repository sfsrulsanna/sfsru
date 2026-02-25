import { supabase } from '../../js/supabase-config.js'

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentDocId = null
let documentData = {}
let userPersonalCode = null
let userProfile = null
let userId = null

let formData = {
  child_surname: '',
  child_name: '',
  child_patronymic: '',
  child_birth_date: '',
  child_personal_code: '',
  child_birth_place: '',
  
  guardian1_full_name: '',
  guardian1_citizenship: '',
  guardian1_nationality: '',
  guardian1_personal_code: '',
  
  guardian2_full_name: '',
  guardian2_citizenship: '',
  guardian2_nationality: '',
  guardian2_personal_code: '',
  
  new_full_name: '',
  new_birth_date: '',
  new_birth_place: '',
  
  registry_act_date: '',
  registry_act_number: '',
  registry_place: '',
  issue_place: '',
  registry_official: '',
  certificate_series_number: '',
  issue_date: '',
  owner_full_name: '',
  personal_code: '',
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
        .from('documents_adoption_certificate')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .from('documents_adoption_certificate')
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
  // Разбиваем ФИО ребёнка, если они хранятся раздельно (предполагаем, что поля существуют)
  // Если хранится child_full_name, можно распарсить, но мы используем отдельные поля
  const childSurname = data.child_surname || '—'
  const childName = data.child_name || '—'
  const childPatronymic = data.child_patronymic || '—'
  const childFullName = `${childSurname} ${childName} ${childPatronymic}`.trim()

  // Разбиваем ФИО первого опекуна
  const g1Parts = (data.guardian1_full_name || '').split(' ')
  const g1Surname = g1Parts[0] || '—'
  const g1FirstPatronymic = g1Parts.slice(1).join(' ') || '—'

  // Разбиваем ФИО второго опекуна
  const g2Parts = (data.guardian2_full_name || '').split(' ')
  const g2Surname = g2Parts[0] || '—'
  const g2FirstPatronymic = g2Parts.slice(1).join(' ') || '—'

  // Даты
  const childBirthDate = data.child_birth_date ? formatDateForRussian(data.child_birth_date) : '—'
  const newBirthDate = data.new_birth_date ? formatDateForRussian(data.new_birth_date) : '—'
  const issueDate = data.issue_date ? formatDateForRussian(data.issue_date) : '—'

  // Актовая запись
  let actYear = '', actMonth = '', actDay = ''
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
      <div class="subtitle">ОБ УСЫНОВЛЕНИИ (УДОЧЕРЕНИИ)</div>
    </div>
    
    <div class="certificate-content">
      <!-- ========== РЕБЁНОК ========== -->
      <div class="child-section">
        <!-- Фамилия ребёнка -->
        <div class="field-block">
          <div class="field-value">${escapeHTML(childSurname)}</div>
          <div class="field-line"></div>
          <div class="field-label">фамилия</div>
        </div>
        <!-- Имя отчество ребёнка -->
        <div class="field-block">
          <div class="field-value">${escapeHTML(childName + ' ' + childPatronymic).trim()}</div>
          <div class="field-line"></div>
          <div class="field-label">имя отчество</div>
        </div>
        <!-- Дата рождения и личный код -->
        <div class="birth-details-row">
          <div class="field-block">
            <div class="field-value">${childBirthDate}</div>
            <div class="field-line"></div>
            <div class="field-label">дата рождения</div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.child_personal_code || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">личный код</div>
          </div>
        </div>
        <!-- Место рождения -->
        <div class="field-block">
          <div class="field-value">${escapeHTML(data.child_birth_place || '—')}</div>
          <div class="field-line"></div>
          <div class="field-label">место рождения</div>
        </div>
      </div>

      <!-- ========== ПЕРВЫЙ ОПЕКУН (ОТЕЦ) ========== -->
      <div class="guardian-section">
        <div class="guardian-block">
          <!-- Фамилия отца -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(g1Surname)}</div>
            <div class="field-line"></div>
            <div class="field-label">отец</div>
          </div>
          <!-- Имя отчество отца -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(g1FirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
          <!-- Гражданство и национальность -->
          <div class="citizenship-row">
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.guardian1_citizenship || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">гражданство</div>
            </div>
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.guardian1_nationality || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">национальность</div>
            </div>
          </div>
          <!-- Личный код -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.guardian1_personal_code || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">личный код</div>
          </div>
        </div>

        <!-- ========== ВТОРОЙ ОПЕКУН (МАТЬ) ========== -->
        <div class="guardian-block">
          <!-- Строка с "и" и фамилией матери -->
          <div class="guardian-row">
            <span class="guardian-label">и</span>
            <div class="field-block" style="flex:1;">
              <div class="field-value">${escapeHTML(g2Surname)}</div>
              <div class="field-line"></div>
              <div class="field-label">мать</div>
            </div>
          </div>
          <!-- Имя отчество матери -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(g2FirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
          <!-- Гражданство и национальность -->
          <div class="citizenship-row">
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.guardian2_citizenship || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">гражданство</div>
            </div>
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.guardian2_nationality || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">национальность</div>
            </div>
          </div>
          <!-- Личный код -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.guardian2_personal_code || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">личный код</div>
          </div>
        </div>
      </div>

      <!-- ========== НОВЫЕ ДАННЫЕ РЕБЁНКА ========== -->
      <div class="new-data-row">
        <div class="marriage-row has-wide-label">
          <span class="marriage-label wide-label">с присвоением ребенку</span>
          <div class="field-block marriage-field">
            <div class="field-value">${escapeHTML(data.new_full_name || '—')}</div>
            <div class="field-line"></div>
          </div>
        </div>
        <div class="marriage-row has-wide-label">
          <span class="marriage-label wide-label">и указанием даты рождения</span>
          <div class="field-block marriage-field">
            <div class="field-value">${newBirthDate}</div>
            <div class="field-line"></div>
          </div>
        </div>
        <div class="marriage-row has-wide-label">
          <span class="marriage-label wide-label">места рождения</span>
          <div class="field-block marriage-field">
            <div class="field-value">${escapeHTML(data.new_birth_place || '—')}</div>
            <div class="field-line"></div>
          </div>
        </div>
      </div>

      <!-- ========== АКТОВАЯ ЗАПИСЬ ========== -->
      <div class="act-record">
        <div class="act-row">
          <span class="act-label">о чем</span>
          <div class="field-block act-field">
            <div class="field-value">${actYear}</div>
            <div class="field-line"></div>
          </div>
          <span class="act-label">года</span>
          <div class="field-block act-field">
            <div class="field-value">${actMonth}</div>
            <div class="field-line"></div>
          </div>
          <span class="act-label">месяца</span>
          <div class="field-block act-field">
            <div class="field-value">${actDay}</div>
            <div class="field-line"></div>
          </div>
          <span class="act-label">числа составлена актовая запись об усыновлении (удочерении) №</span>
          <div class="field-block act-field" style="flex: 0 1 auto; min-width: 100px;">
            <div class="field-value">${escapeHTML(data.registry_act_number || '—')}</div>
            <div class="field-line"></div>
          </div>
        </div>
      </div>

      <!-- ========== МЕСТО РЕГИСТРАЦИИ ========== -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Место государственной регистрации</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.registry_place || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- ========== МЕСТО ВЫДАЧИ ========== -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Место выдачи свидетельства</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.issue_place || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- ========== ПРАВЫЙ БЛОК ========== -->
      <div class="right-info-container">
        <div class="right-row">
          <span class="right-label">Дата выдачи:</span>
          <div class="field-block right-field">
            <div class="field-value">${issueDate}</div>
            <div class="field-line"></div>
          </div>
        </div>
        <div class="right-row">
          <span class="right-label">Руководитель органа ЗАГС</span>
          <div class="field-block right-field">
            <div class="field-value">${escapeHTML(data.registry_official || '—')}</div>
            <div class="field-line"></div>
          </div>
        </div>
      </div>

      <!-- ========== СЕРИЯ И НОМЕР ========== -->
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
  replaceLink.href = '../../services/documents/adoption-certificate/'
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
  
  document.getElementById('statusAndEditContainer').innerHTML = ''
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

  const ownerFullName = userProfile ? `${userProfile.surname || ''} ${userProfile.name || ''} ${userProfile.patronymic || ''}`.trim() : ''

  modalBody.innerHTML = `
    <h4>Ребёнок</h4>
    <div class="form-group">
      <label>Фамилия ребёнка</label>
      <input type="text" id="edit_child_surname" class="form-input" value="${escapeHTML(formData.child_surname || '')}">
    </div>
    <div class="form-group">
      <label>Имя ребёнка</label>
      <input type="text" id="edit_child_name" class="form-input" value="${escapeHTML(formData.child_name || '')}">
    </div>
    <div class="form-group">
      <label>Отчество ребёнка</label>
      <input type="text" id="edit_child_patronymic" class="form-input" value="${escapeHTML(formData.child_patronymic || '')}">
    </div>
    <div class="form-group">
      <label>Дата рождения ребёнка</label>
      <input type="date" id="edit_child_birth_date" class="form-input" value="${formData.child_birth_date || ''}">
    </div>
    <div class="form-group">
      <label>Личный код ребёнка</label>
      <input type="text" id="edit_child_personal_code" class="form-input" value="${escapeHTML(formData.child_personal_code || '')}">
    </div>
    <div class="form-group">
      <label>Место рождения ребёнка</label>
      <input type="text" id="edit_child_birth_place" class="form-input" value="${escapeHTML(formData.child_birth_place || '')}">
    </div>

    <h4>Первый опекун (отец)</h4>
    <div class="form-group">
      <label>ФИО отца (полностью)</label>
      <input type="text" id="edit_guardian1_full_name" class="form-input" value="${escapeHTML(formData.guardian1_full_name || '')}">
    </div>
    <div class="form-group">
      <label>Гражданство отца</label>
      <input type="text" id="edit_guardian1_citizenship" class="form-input" value="${escapeHTML(formData.guardian1_citizenship || '')}">
    </div>
    <div class="form-group">
      <label>Национальность отца</label>
      <input type="text" id="edit_guardian1_nationality" class="form-input" value="${escapeHTML(formData.guardian1_nationality || '')}">
    </div>
    <div class="form-group">
      <label>Личный код отца</label>
      <input type="text" id="edit_guardian1_personal_code" class="form-input" value="${escapeHTML(formData.guardian1_personal_code || '')}">
    </div>

    <h4>Второй опекун (мать)</h4>
    <div class="form-group">
      <label>ФИО матери (полностью)</label>
      <input type="text" id="edit_guardian2_full_name" class="form-input" value="${escapeHTML(formData.guardian2_full_name || '')}">
    </div>
    <div class="form-group">
      <label>Гражданство матери</label>
      <input type="text" id="edit_guardian2_citizenship" class="form-input" value="${escapeHTML(formData.guardian2_citizenship || '')}">
    </div>
    <div class="form-group">
      <label>Национальность матери</label>
      <input type="text" id="edit_guardian2_nationality" class="form-input" value="${escapeHTML(formData.guardian2_nationality || '')}">
    </div>
    <div class="form-group">
      <label>Личный код матери</label>
      <input type="text" id="edit_guardian2_personal_code" class="form-input" value="${escapeHTML(formData.guardian2_personal_code || '')}">
    </div>

    <h4>Новые данные ребёнка (после усыновления)</h4>
    <div class="form-group">
      <label>Новое ФИО (если меняется)</label>
      <input type="text" id="edit_new_full_name" class="form-input" value="${escapeHTML(formData.new_full_name || '')}">
    </div>
    <div class="form-group">
      <label>Новая дата рождения</label>
      <input type="date" id="edit_new_birth_date" class="form-input" value="${formData.new_birth_date || ''}">
    </div>
    <div class="form-group">
      <label>Новое место рождения</label>
      <input type="text" id="edit_new_birth_place" class="form-input" value="${escapeHTML(formData.new_birth_place || '')}">
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

    <h4>Свидетельство</h4>
    <div class="form-group">
      <label>Место государственной регистрации</label>
      <input type="text" id="edit_registry_place" class="form-input" value="${escapeHTML(formData.registry_place || '')}">
    </div>
    <div class="form-group">
      <label>Место выдачи свидетельства</label>
      <input type="text" id="edit_issue_place" class="form-input" value="${escapeHTML(formData.issue_place || '')}">
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

    <h4>Владелец свидетельства</h4>
    <div class="form-group">
      <label>ФИО владельца</label>
      <input type="text" id="edit_owner_full_name" class="form-input" value="${escapeHTML(formData.owner_full_name || ownerFullName)}">
    </div>
    <div class="form-group">
      <label>Личный код владельца</label>
      <input type="text" id="edit_personal_code" class="form-input" value="${escapeHTML(formData.personal_code || userPersonalCode || '')}" readonly>
    </div>
  `
}

function collectFormData() {
  const getVal = (id) => (document.getElementById(id)?.value || '').trim()
  return {
    child_surname: getVal('edit_child_surname'),
    child_name: getVal('edit_child_name'),
    child_patronymic: getVal('edit_child_patronymic'),
    child_birth_date: getVal('edit_child_birth_date'),
    child_personal_code: getVal('edit_child_personal_code'),
    child_birth_place: getVal('edit_child_birth_place'),
    
    guardian1_full_name: getVal('edit_guardian1_full_name'),
    guardian1_citizenship: getVal('edit_guardian1_citizenship'),
    guardian1_nationality: getVal('edit_guardian1_nationality'),
    guardian1_personal_code: getVal('edit_guardian1_personal_code'),
    
    guardian2_full_name: getVal('edit_guardian2_full_name'),
    guardian2_citizenship: getVal('edit_guardian2_citizenship'),
    guardian2_nationality: getVal('edit_guardian2_nationality'),
    guardian2_personal_code: getVal('edit_guardian2_personal_code'),
    
    new_full_name: getVal('edit_new_full_name'),
    new_birth_date: getVal('edit_new_birth_date'),
    new_birth_place: getVal('edit_new_birth_place'),
    
    registry_act_date: getVal('edit_registry_act_date'),
    registry_act_number: getVal('edit_registry_act_number'),
    registry_place: getVal('edit_registry_place'),
    issue_place: getVal('edit_issue_place'),
    registry_official: getVal('edit_registry_official'),
    certificate_series_number: getVal('edit_certificate_series_number'),
    issue_date: getVal('edit_issue_date'),
    owner_full_name: getVal('edit_owner_full_name'),
    personal_code: getVal('edit_personal_code')
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

    if (!newData.personal_code) {
      newData.personal_code = userPersonalCode
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
        .from('documents_adoption_certificate')
        .update(dataToSend)
        .eq('id', currentDocId)
        .select()
    } else {
      dataToSend.created_at = new Date().toISOString()
      result = await supabase
        .from('documents_adoption_certificate')
        .insert([dataToSend])
        .select()
    }

    if (result.error) throw result.error

    window.closeModal()
    const newId = currentDocId || result.data[0].id
    window.location.href = `adoption-certificate.html?id=${newId}`
  } catch (err) {
    console.error('Ошибка сохранения:', err)
    alert('Ошибка сохранения: ' + err.message)
  }
}

// ==================== ОТКРЫТИЕ МОДАЛОК ====================
function openAddModal() {
  const ownerFullName = userProfile ? `${userProfile.surname || ''} ${userProfile.name || ''} ${userProfile.patronymic || ''}`.trim() : ''
  formData = {
    child_surname: '',
    child_name: '',
    child_patronymic: '',
    child_birth_date: '',
    child_personal_code: '',
    child_birth_place: '',
    
    guardian1_full_name: '',
    guardian1_citizenship: '',
    guardian1_nationality: '',
    guardian1_personal_code: '',
    
    guardian2_full_name: '',
    guardian2_citizenship: '',
    guardian2_nationality: '',
    guardian2_personal_code: '',
    
    new_full_name: '',
    new_birth_date: '',
    new_birth_place: '',
    
    registry_act_date: '',
    registry_act_number: '',
    registry_place: '',
    issue_place: '',
    registry_official: '',
    certificate_series_number: '',
    issue_date: '',
    owner_full_name: ownerFullName,
    personal_code: userPersonalCode || '',
    status: 'oncheck'
  }
  openModal('Добавление свидетельства об усыновлении (удочерении)')
}

function openEditModal() {
  formData = { ...documentData }
  openModal('Редактирование свидетельства об усыновлении (удочерении)')
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