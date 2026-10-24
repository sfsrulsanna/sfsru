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
      window.location.href = '../../../login.html' // Исправлен путь на 3 уровня вверх
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
        .from('divorce')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .schema('documents_certificates')
        .from('divorce')
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
  // Разбиваем ФИО супругов
  const husbandNameParts = (data.husband_full_name || '').split(' ')
  const husbandSurname = husbandNameParts[0] || '—'
  const husbandFirstPatronymic = husbandNameParts.slice(1).join(' ') || '—'

  const wifeNameParts = (data.wife_full_name || '').split(' ')
  const wifeSurname = wifeNameParts[0] || '—'
  const wifeFirstPatronymic = wifeNameParts.slice(1).join(' ') || '—'

  // Форматирование дат
  const divorceDate = data.divorce_date ? formatDateForRussian(data.divorce_date) : '—'
  const basisDate = data.basis_date ? formatDateForRussian(data.basis_date) : '—'
  const issueDate = data.issue_date ? formatDateForRussian(data.issue_date) : '—'

  // Подготовка данных для актовой записи
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

  // Объединение основания и даты основания в одну строку
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
      <!-- ========== МУЖ ========== -->
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
          <!-- Дата рождения и личный код мужа -->
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
          <!-- Место рождения мужа -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.husband_birth_place || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">место рождения</div>
          </div>
          <!-- Гражданство и национальность мужа -->
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

        <!-- ========== ЖЕНА ========== -->
        <div class="spouse-block">
          <!-- Строка с префиксом "и" и фамилией жены -->
          <div class="spouse-row">
            <span class="spouse-title">и</span>
            <div class="field-block">
              <div class="field-value">${escapeHTML(wifeSurname)}</div>
              <div class="field-line"></div>
              <div class="field-label">фамилия</div>
            </div>
          </div>
          <!-- Имя отчество жены -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(wifeFirstPatronymic)}</div>
            <div class="field-line"></div>
            <div class="field-label">имя отчество</div>
          </div>
          <!-- Дата рождения и личный код жены -->
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
          <!-- Место рождения жены -->
          <div class="field-block">
            <div class="field-value">${escapeHTML(data.wife_birth_place || '—')}</div>
            <div class="field-line"></div>
            <div class="field-label">место рождения</div>
          </div>
          <!-- Гражданство и национальность жены -->
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

      <!-- ========== АКТОВАЯ ЗАПИСЬ ========== -->
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
          <div class="field-block act-field" style="flex: 0 1 auto; min-width: 100px;">
            <div class="field-value">${escapeHTML(data.registry_act_number || '—')}</div>
            <div class="field-line"></div>
          </div>
        </div>
      </div>

      <!-- ========== ДАТА ПРЕКРАЩЕНИЯ БРАКА ========== -->
      <div class="marriage-row">
        <span class="marriage-label">Брак прекращен</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(divorceDate)}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- ========== ОСНОВАНИЕ ========== -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">на основании</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(basisFull)}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- ========== ПРИСВОЕННАЯ ФАМИЛИЯ ========== -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">После расторжения брака присвоена фамилия:</span>
      </div>
      <div class="assigned-row">
        <span class="assigned-label">ему(ей)</span>
        <div class="field-block assigned-field">
          <div class="field-value">${escapeHTML(data.assigned_surname_owner || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- ========== МЕСТО ГОСУДАРСТВЕННОЙ РЕГИСТРАЦИИ ========== -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Место государственной регистрации</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.registry_place || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- ========== МЕСТО ВЫДАЧИ СВИДЕТЕЛЬСТВА ========== -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Место выдачи свидетельства</span>
        <div class="field-block marriage-field">
          <div class="field-value">${escapeHTML(data.issue_place || '—')}</div>
          <div class="field-line"></div>
        </div>
      </div>

      <!-- ========== СВИДЕТЕЛЬСТВО ВЫДАНО ========== -->
      <div class="marriage-row has-wide-label">
        <span class="marriage-label wide-label">Свидетельство выдано</span>
        <div class="field-block marriage-field">
          <div class="field-value">
            ${escapeHTML(data.owner_full_name || '—')}${data.personal_code ? `, ${escapeHTML(data.personal_code)}` : ''}
          </div>
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

  // Вставляем сгенерированный HTML в контейнер
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
  replaceLink.href = '../../../services/documents/divorce-certificate/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить свидетельство'
  statusAndEdit.appendChild(replaceLink)
  
  // Очищаем контейнер и добавляем новый блок
  const container = document.getElementById('statusAndEditContainer')
  container.innerHTML = ''
  container.appendChild(statusAndEdit)
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()
})