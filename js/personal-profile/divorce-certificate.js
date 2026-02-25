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
  divorce_date: '',
  divorce_basis: '',
  basis_date: '',
  registry_act_number: '',
  registry_act_date: '',
  assigned_surname_owner: '',
  registry_place: '',
  issue_place: '',
  registry_official: '',
  certificate_series_number: '',
  issue_date: '',
  owner_full_name: '',
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
        .from('documents_divorce_certificate')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .from('documents_divorce_certificate')
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
  // Разбиваем ФИО супругов
  const husbandNameParts = (data.husband_full_name || '').split(' ')
  const husbandSurname = husbandNameParts[0] || '—'
  const husbandFirstPatronymic = husbandNameParts.slice(1).join(' ') || '—'

  const wifeNameParts = (data.wife_full_name || '').split(' ')
  const wifeSurname = wifeNameParts[0] || '—'
  const wifeFirstPatronymic = wifeNameParts.slice(1).join(' ') || '—'

  // Форматируем даты
  const divorceDate = data.divorce_date ? formatDateForRussian(data.divorce_date) : '—'
  const basisDate = data.basis_date ? formatDateForRussian(data.basis_date) : '—'
  const issueDate = data.issue_date ? formatDateForRussian(data.issue_date) : '—'

  // Для актовой записи разбираем дату
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

  // Объединяем основание и дату основания в одну строку
  const basisFull = data.divorce_basis
    ? (basisDate !== '—' ? `${data.divorce_basis} от ${basisDate}` : data.divorce_basis)
    : (basisDate !== '—' ? `от ${basisDate}` : '—')

  // Формируем HTML
  const html = `
    <div class="certificate-header">
      <div class="title">СВИДЕТЕЛЬСТВО</div>
      <div class="subtitle">О РАСТОРЖЕНИИ БРАКА</div>
    </div>
    
    <div class="certificate-content">
      <!-- МУЖ -->
      <div class="spouse-section">
        <div class="spouse-block">
          <!-- Фамилия мужа -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(husbandSurname)}</div>
            <div class="field-line"></div>
            <div class="field-label">фамилия</div>
          </div>
          <!-- Имя отчество мужа -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(husbandFirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
          <!-- Дата рождения и личный код -->
          <div class="birth-details-row">
            <div class="field-block">
              <div class="field-value">${formatDateForRussian(data.husband_birth_date)}</div>
              <div class="field-line"></div>
              <div class="field-label">дата рождения</div>
            </div>
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.husband_personal_code || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">личный код</div>
            </div>
          </div>
          <!-- Место рождения -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.husband_birth_place || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">место рождения</div>
          </div>
          <!-- Гражданство и национальность -->
          <div class="citizenship-row">
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.husband_citizenship || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">гражданство</div>
            </div>
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.husband_nationality || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">национальность</div>
            </div>
          </div>
        </div>

        <!-- ЖЕНА с префиксом "и" -->
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
          <div class="birth-details-row">
            <div class="field-block">
              <div class="field-value">${formatDateForRussian(data.wife_birth_date)}</div>
              <div class="field-line"></div>
              <div class="field-label">дата рождения</div>
            </div>
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.wife_personal_code || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">личный код</div>
            </div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.wife_birth_place || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">место рождения</div>
          </div>
          <div class="citizenship-row">
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.wife_citizenship || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">гражданство</div>
            </div>
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.wife_nationality || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">национальность</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Актовая запись (расторгли брак, о чем...) -->
      <div class="act-record">
        <div class="act-row">
          <span class="act-label">расторгли брак, о чем</span>
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
          <span class="act-label">числа составлена актовая запись о расторжении брака №</span>
        </div>
        <div class="act-row">
          <div class="field-block act-field">
            <div class="field-value">${escapeHTML(data.registry_act_number || '—')}</div>
            <div class="field-line"></div>
          </div>
        </div>
      </div>

      <!-- Дата прекращения брака -->
      <div class="marriage-row">
        <span class="marriage-label">Брак прекращен</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(divorceDate)}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- Основание (объединённое поле) -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">на основании</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(basisFull)}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- Присвоенная фамилия -->
      <div class="assigned-row">
        <span class="assigned-label">После расторжения брака присвоена фамилия: ему(ей)</span>
        <div class="field-block assigned-field">
          <div class="field-value">${escapeHTML(data.assigned_surname_owner || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- Место государственной регистрации -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Место государственной регистрации</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.registry_place || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- Место выдачи свидетельства -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Место выдачи свидетельства</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.issue_place || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- Свидетельство выдано (ФИО + личный код) -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Свидетельство выдано</span>
        <div class="field-block marriage-field">
          <div class="field-value">
            ${escapeHTML(data.owner_full_name || '—')}${data.personal_code ? `, ${escapeHTML(data.personal_code)}` : ''}
          </div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- Правая информация -->
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

      <!-- Серия и номер -->
      <div class="series-number">
        ${escapeHTML(data.certificate_series_number || '—')}
      </div>
    </div>
  `

  document.getElementById('certificateContainer').innerHTML = html

  // ... остальной код (статус и кнопки) без изменений
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

  // Формируем полное имя владельца из профиля
  const ownerFullName = userProfile ? `${userProfile.surname || ''} ${userProfile.name || ''} ${userProfile.patronymic || ''}`.trim() : ''

  modalBody.innerHTML = `
    <h4>Муж (в творительном падеже)</h4>
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

    <h4>Жена (в творительном падеже)</h4>
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

    <h4>Расторжение брака</h4>
    <div class="form-group">
      <label>Дата расторжения брака</label>
      <input type="date" id="edit_divorce_date" class="form-input" value="${formData.divorce_date || ''}">
    </div>
    <div class="form-group">
      <label>Основание расторжения</label>
      <input type="text" id="edit_divorce_basis" class="form-input" value="${escapeHTML(formData.divorce_basis || '')}">
    </div>
    <div class="form-group">
      <label>Дата документа-основания</label>
      <input type="date" id="edit_basis_date" class="form-input" value="${formData.basis_date || ''}">
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

    <h4>Фамилия после расторжения</h4>
    <div class="form-group">
      <label>Присвоенная фамилия (владельцу)</label>
      <input type="text" id="edit_assigned_surname_owner" class="form-input" value="${escapeHTML(formData.assigned_surname_owner || '')}">
    </div>

    <h4>Свидетельство</h4>
    <div class="form-group">
      <label>Место регистрации</label>
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
    divorce_date: getVal('edit_divorce_date'),
    divorce_basis: getVal('edit_divorce_basis'),
    basis_date: getVal('edit_basis_date'),
    registry_act_date: getVal('edit_registry_act_date'),
    registry_act_number: getVal('edit_registry_act_number'),
    assigned_surname_owner: getVal('edit_assigned_surname_owner'),
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

    // Убедимся, что personal_code установлен
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
        .from('documents_divorce_certificate')
        .update(dataToSend)
        .eq('id', currentDocId)
        .select()
    } else {
      dataToSend.created_at = new Date().toISOString()
      result = await supabase
        .from('documents_divorce_certificate')
        .insert([dataToSend])
        .select()
    }

    if (result.error) throw result.error

    window.closeModal()
    const newId = currentDocId || result.data[0].id
    window.location.href = `divorce-certificate.html?id=${newId}`
  } catch (err) {
    console.error('Ошибка сохранения:', err)
    alert('Ошибка сохранения: ' + err.message)
  }
}

// ==================== ОТКРЫТИЕ МОДАЛОК ====================
function openAddModal() {
  // Заполняем данные владельца из профиля
  const ownerFullName = userProfile ? `${userProfile.surname || ''} ${userProfile.name || ''} ${userProfile.patronymic || ''}`.trim() : ''
  formData = {
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
    divorce_date: '',
    divorce_basis: '',
    basis_date: '',
    registry_act_date: '',
    registry_act_number: '',
    assigned_surname_owner: '',
    registry_place: '',
    issue_place: '',
    registry_official: '',
    certificate_series_number: '',
    issue_date: '',
    owner_full_name: ownerFullName,
    personal_code: userPersonalCode || '',
    status: 'oncheck'
  }
  openModal('Добавление свидетельства о расторжении брака')
}

function openEditModal() {
  formData = { ...documentData }
  openModal('Редактирование свидетельства о расторжении брака')
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