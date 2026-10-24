import { supabase } from '../../../../js/supabase-config.js'

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentDocId = null
let documentData = {}
let userPersonalCode = null
let userProfile = null
let userId = null

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
      window.location.href = '../../../login.html' // Путь исправлен на 3 уровня вверх
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
        .schema('documents_certificates')
        .from('marriage')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .schema('documents_certificates')
        .from('marriage')
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
          <div class="field-block">
            <div class="field-value">${escapeHTML(husbandSurname)}</div>
            <div class="field-line"></div>
            <div class="field-label">фамилия</div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(husbandFirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
          <!-- Дата рождения + личный код -->
          <div class="birth-details-row">
            <div class="field-block">
              <div class="field-value">${formatDateForRussian(data.husband_birth_date)}</div>
              <div class="field-line"></div>
              <div class="field-label">число, месяц, год рождения</div>
            </div>
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.husband_personal_code || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">личный код</div>
            </div>
          </div>
          <!-- Место рождения отдельно -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.husband_birth_place || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">место рождения</div>
          </div>
          <!-- Гражданство и национальность в одной строке -->
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
      </div>

      <!-- ЖЕНА -->
      <div class="spouse-section">
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
          <!-- Дата рождения + личный код -->
          <div class="birth-details-row">
            <div class="field-block">
              <div class="field-value">${formatDateForRussian(data.wife_birth_date)}</div>
              <div class="field-line"></div>
              <div class="field-label">число, месяц, год рождения</div>
            </div>
            <div class="field-block">
              <div class="field-value">${escapeHTML(data.wife_personal_code || '—')}</div>
              <div class="field-line"></div>
              <div class="field-label">личный код</div>
            </div>
          </div>
          <!-- Место рождения отдельно -->
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

      <!-- Дата заключения брака -->
      <div class="marriage-row">
        <span class="marriage-label">заключили брак</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(marriageDate)}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- Актовая запись -->
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
          <span class="act-label">числа</span>
        </div>
        <div class="act-row">
          <span class="act-label">составлена запись акта о заключении брака №</span>
          <div class="field-block act-field">
            <div class="field-value">${escapeHTML(data.registry_act_number || '—')}</div>
            <div class="field-line"></div>
          </div>
        </div>
      </div>

      <!-- Присвоенные фамилии -->
      <div class="assigned-header">После заключения брака присвоены фамилии:</div>

      <div class="assigned-section">
        <div class="assigned-row">
          <span class="assigned-label">мужу</span>
          <div class="field-block assigned-field">
            <div class="field-value">${escapeHTML(data.assigned_surname_husband || '—')}</div>
            <div class="field-line"></div>
          </div>
        </div>
        <div class="assigned-row">
          <span class="assigned-label">жене</span>
          <div class="field-block assigned-field">
            <div class="field-value">${escapeHTML(data.assigned_surname_wife || '—')}</div>
            <div class="field-line"></div>
          </div>
        </div>
      </div>

      <!-- МЕСТО ГОСУДАРСТВЕННОЙ РЕГИСТРАЦИИ -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Место государственной регистрации</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.registry_place || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- МЕСТО ВЫДАЧИ СВИДЕТЕЛЬСТВА -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Место выдачи свидетельства</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.issue_place || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- ПРАВАЯ ИНФОРМАЦИЯ -->
      <div class="right-info-container">
        <div class="right-row">
          <span class="right-label">Дата выдачи</span>
          <div class="field-block right-field">
            <div class="field-value">${formatDateForRussian(data.issue_date)}</div>
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

  // Блок статуса (без кнопок редактирования)
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)
  
  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'
  
  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)
  
  const replaceLink = document.createElement('a')
  replaceLink.href = '../../../services/documents/marriage-certificate/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить свидетельство'
  statusAndEdit.appendChild(replaceLink)
  
  const container = document.getElementById('statusAndEditContainer')
  container.innerHTML = ''
  container.appendChild(statusAndEdit)
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()
})