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
        .from('adoption')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .schema('documents_certificates')
        .from('adoption')
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
  const childSurname = data.child_surname || '—'
  const childName = data.child_name || '—'
  const childPatronymic = data.child_patronymic || '—'

  const g1Parts = (data.guardian1_full_name || '').split(' ')
  const g1Surname = g1Parts[0] || '—'
  const g1FirstPatronymic = g1Parts.slice(1).join(' ') || '—'

  const g2Parts = (data.guardian2_full_name || '').split(' ')
  const g2Surname = g2Parts[0] || '—'
  const g2FirstPatronymic = g2Parts.slice(1).join(' ') || '—'

  const childBirthDate = data.child_birth_date ? formatDateForRussian(data.child_birth_date) : '—'
  const newBirthDate = data.new_birth_date ? formatDateForRussian(data.new_birth_date) : '—'
  const issueDate = data.issue_date ? formatDateForRussian(data.issue_date) : '—'

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
        <div class="field-block">
          <div class="field-value">${escapeHTML(childSurname)}</div>
          <div class="field-line"></div>
          <div class="field-label">фамилия</div>
        </div>
        <div class="field-block">
          <div class="field-value">${escapeHTML(childName + ' ' + childPatronymic).trim()}</div>
          <div class="field-line"></div>
          <div class="field-label">имя отчество</div>
        </div>
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
        <div class="field-block">
          <div class="field-value">${escapeHTML(data.child_birth_place || '—')}</div>
          <div class="field-line"></div>
          <div class="field-label">место рождения</div>
        </div>
      </div>

      <div class="guardian-section">
        <div class="guardian-block">
          <div class="guardian-row">
            <span class="guardian-label">опекуны</span>
            <div class="field-block" style="flex:1;">
              <div class="field-value">${escapeHTML(g1Surname)}</div>
              <div class="field-line"></div>
              <div class="field-label">отец</div>
            </div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(g1FirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
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
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.guardian1_personal_code || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">личный код</div>
          </div>
        </div>

        <div class="guardian-block">
          <div class="guardian-row">
            <span class="guardian-label">и</span>
            <div class="field-block" style="flex:1;">
              <div class="field-value">${escapeHTML(g2Surname)}</div>
              <div class="field-line"></div>
              <div class="field-label">мать</div>
            </div>
          </div>
          <div class="field-block">
            <div class="field-value">${escapeHTML(g2FirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
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
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.guardian2_personal_code || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">личный код</div>
          </div>
        </div>
      </div>

      <div class="marriage-row">
        <span class="marriage-label">с присвоением ребенку</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.new_full_name || '—')}</div>
          <div class="field-line"></div>
          <div class="field-label">фамилия, имя, отчество</div>
        </div>
      </div>
      <div class="marriage-row">
        <span class="marriage-label">и указанием даты рождения</span>
        <div class="field-block marriage-field">
          <div class="field-value">${newBirthDate}</div>
          <div class="field-line"></div>
          <div class="field-label">число, месяц, год</div>
        </div>
      </div>
      <div class="marriage-row">
        <span class="marriage-label">места рождения</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.new_birth_place || '—')}</div>
          <div class="field-line"></div>
          <div class="field-label">место рождения</div>
        </div>
      </div>

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

      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Место государственной регистрации</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.registry_place || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Место выдачи свидетельства</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.issue_place || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

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

      <div class="series-number">
        ${escapeHTML(data.certificate_series_number || '—')}
      </div>
    </div>
  `

  document.getElementById('certificateContainer').innerHTML = html

  // Блок статуса (без кнопок редактирования, только статус и ссылка на замену)
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)
  
  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'
  
  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)
  
  const replaceLink = document.createElement('a')
  replaceLink.href = '../../../services/documents/adoption-certificate/'
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