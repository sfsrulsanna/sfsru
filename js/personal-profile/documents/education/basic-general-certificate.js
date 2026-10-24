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
    return date.toLocaleDateString('ru-RU')
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
      window.location.href = '../../../login.html' // Путь на 3 уровня вверх
      return
    }

    userId = session.user.id

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('personal_code, surname, name, patronymic')
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
        .from('documents_education')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .from('documents_education')
        .select('*')
        .eq('personal_code', userPersonalCode)
        .eq('type', 'basic_general')
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

// ==================== ОТРИСОВКА ДОКУМЕНТА ====================
function renderCertificate(data) {
  // Получаем ФИО
  const fullName = data.full_name || `${userProfile?.surname || ''} ${userProfile?.name || ''} ${userProfile?.patronymic || ''}`.trim() || '—'

  // Проверка на "С ОТЛИЧИЕМ"
  // Предполагаем, что в БД есть поле with_honors (boolean) или honors (boolean)
  const isHonors = data.with_honors || data.honors || false
  const honorsText = isHonors ? ' С ОТЛИЧИЕМ' : ''

  // Обработка предметов (могут приходить строкой JSON)
  let subjects = data.subjects || []
  if (typeof subjects === 'string') {
    try { subjects = JSON.parse(subjects) } catch { subjects = [] }
  }

  // Формируем HTML для приложения
  let appendixHtml = ''
  if (subjects.length > 0) {
    appendixHtml = `
      <div class="appendix-container">
        <div class="appendix-header">Приложение к аттестату</div>
        <table class="subjects-table">
          <thead>
            <tr>
              <th>Предмет</th>
              <th>Оценка</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map(subj => `
              <tr>
                <td>${escapeHTML(subj.name || '')}</td>
                <td>${escapeHTML(subj.grade || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  const html = `
    <div class="certificate-header">
      <div class="title">АТТЕСТАТ</div>
      <div class="subtitle">ОБ ОСНОВНОМ ОБЩЕМ ОБРАЗОВАНИИ${honorsText}</div>
    </div>
    
    <div class="certificate-content">
      <div class="field-block">
        <div class="field-label">ФИО</div>
        <div class="field-value">${escapeHTML(fullName)}</div>
        <div class="field-line"></div>
      </div>
      
      <div class="field-block">
        <div class="field-label">Кем выдан</div>
        <div class="field-value">${escapeHTML(data.issued_by || '—')}</div>
        <div class="field-line"></div>
      </div>
      
      <div class="field-block">
        <div class="field-label">Директор</div>
        <div class="field-value">${escapeHTML(data.director || '—')}</div>
        <div class="field-line"></div>
      </div>
      
      <div class="field-block">
        <div class="field-label">Номер документа</div>
        <div class="field-value">${escapeHTML(data.document_number || '—')}</div>
        <div class="field-line"></div>
      </div>

      <!-- Блок с оценками -->
      ${appendixHtml}
    </div>
  `

  document.getElementById('certificateContainer').innerHTML = html

  // Блок статуса (без кнопки редактирования)
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)
  
  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'
  
  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)
  
  const replaceLink = document.createElement('a')
  replaceLink.href = '../../../services/documents/education/basic-general/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить аттестат'
  statusAndEdit.appendChild(replaceLink)
  
  document.getElementById('statusAndEditContainer').innerHTML = ''
  document.getElementById('statusAndEditContainer').appendChild(statusAndEdit)
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()
})