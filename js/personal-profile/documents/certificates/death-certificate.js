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

function formatTime(timeString) {
  if (!timeString) return '—'
  return timeString.substring(0, 5) // HH:MM
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
        .from('death')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .schema('documents_certificates')
        .from('death')
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
      <div class="subtitle">О СМЕРТИ</div>
    </div>
    
    <div class="certificate-content">
      <!-- Фамилия -->
      <div class="field-block">
        <div class="field-value">${escapeHTML(data.surname || '—')}</div>
        <div class="field-line"></div>
        <div class="field-label">фамилия</div>
      </div>
      
      <!-- Имя отчество -->
      <div class="field-block">
        <div class="field-value">${escapeHTML(data.first_patronymic || '—')}</div>
        <div class="field-line"></div>
        <div class="field-label">имя отчество</div>
      </div>
      
      <!-- Дата рождения + личный код -->
      <div class="birth-details-row">
        <div class="field-block">
          <div class="field-value">${formatDateForRussian(data.birth_date)}</div>
          <div class="field-line"></div>
          <div class="field-label">дата рождения</div>
        </div>
        <div class="field-block">
          <div class="field-value">${escapeHTML(data.personal_code || '—')}</div>
          <div class="field-line"></div>
          <div class="field-label">личный код</div>
        </div>
      </div>
      
      <!-- Место рождения -->
      <div class="field-block">
        <div class="field-value">${escapeHTML(data.birth_place || '—')}</div>
        <div class="field-line"></div>
        <div class="field-label">место рождения</div>
      </div>
      
      <!-- Гражданство и национальность -->
      <div class="citizenship-row">
        <div class="field-block">
          <div class="field-value">${escapeHTML(data.citizenship || '—')}</div>
          <div class="field-line"></div>
          <div class="field-label">гражданство</div>
        </div>
        <div class="field-block">
          <div class="field-value">${escapeHTML(data.nationality || '—')}</div>
          <div class="field-line"></div>
          <div class="field-label">национальность</div>
        </div>
      </div>
      
      <!-- Дата и время смерти -->
      <div class="death-details-row">
        <span class="death-label">умер(ла)</span>
        <div class="field-block">
          <div class="field-value">${formatDateForRussian(data.death_date)}</div>
          <div class="field-line"></div>
          <div class="field-label">число, месяц, год</div>
        </div>
        <span class="death-label">в</span>
        <div class="field-block">
          <div class="field-value">${formatTime(data.death_time) || '—'}</div>
          <div class="field-line"></div>
          <div class="field-label">часы, минуты</div>
        </div>
      </div>
      
      <!-- Место смерти -->
      <div class="field-block">
        <div class="field-value">${escapeHTML(data.death_place || '—')}</div>
        <div class="field-line"></div>
        <div class="field-label">место смерти</div>
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
          <span class="act-label">составлена запись акта о смерти №</span>
          <div class="field-block act-field">
            <div class="field-value">${escapeHTML(data.registry_act_number || '—')}</div>
            <div class="field-line"></div>
          </div>
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
      
      <!-- Правая информация -->
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
  replaceLink.href = '../../../services/documents/death-certificate/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить свидетельство'
  statusAndEdit.appendChild(replaceLink)
  
  document.getElementById('statusAndEditContainer').innerHTML = ''
  document.getElementById('statusAndEditContainer').appendChild(statusAndEdit)
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()
})