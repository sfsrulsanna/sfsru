import { supabase } from '../../../../js/supabase-config.js'

let userProfile = null
let personalCode = null

function formatDate(dateString) {
  if (!dateString) return '—'
  try { return new Date(dateString).toLocaleDateString('ru-RU') }
  catch { return dateString }
}

function getStatusLabel(status) {
  if (status === 'verified') return '✅ Подтверждено'
  if (status === 'oncheck') return '⏳ На проверке'
  if (status === 'rejected') return '❌ Отклонено'
  if (status === 'archived') return '📦 Архивный'
  return '—'
}

function safeSetText(id, text) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

async function loadUserProfile() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = '../../login.html'
    return
  }

  const { data, error } = await supabase
    .from('users')
    .select('surname, name, patronymic, date_of_birth, place_of_birth, personal_code, gender')
    .eq('id', session.user.id)
    .single()

  if (error || !data) {
    console.error('Ошибка загрузки профиля:', error)
    return
  }

  userProfile = data
  personalCode = data.personal_code
}

// Определяем все типы документов об образовании
const educationTypes = [
  // Аттестаты
  { type: 'preschool', title: 'Аттестат о дошкольном образовании', url: 'preschool-certificate.html' },
  { type: 'primary', title: 'Аттестат о начальном образовании', url: 'primary-certificate.html' },
  { type: 'basic_general', title: 'Аттестат об основном общем образовании', url: 'basic-general-certificate.html' },
  { type: 'secondary_general', title: 'Аттестат о среднем общем образовании', url: 'secondary-general-certificate.html' },
  { type: 'memorial', title: 'Памятный аттестат', url: 'memorial-certificate.html' },
  // Дипломы
  { type: 'secondary_vocational', title: 'Диплом о среднем профессиональном образовании', url: 'secondary-vocational-diploma.html' },
  { type: 'basic_higher', title: 'Диплом о базовом высшем образовании', url: 'basic-higher-diploma.html' },
  { type: 'specialized_higher', title: 'Диплом о специализированном высшем образовании', url: 'specialized-higher-diploma.html' },
  { type: 'qualified_higher', title: 'Диплом о квалифицированном высшем образовании', url: 'qualified-higher-diploma.html' },
  { type: 'professional_retraining', title: 'Диплом о профессиональной переподготовке', url: 'professional-retraining-diploma.html' },
  { type: 'incomplete_higher', title: 'Диплом о неполном высшем образовании', url: 'incomplete-higher-diploma.html' },
  // Степени
  { type: 'candidate_sciences', title: 'Диплом кандидата наук', url: 'candidate-sciences-diploma.html' },
  { type: 'doctor_sciences', title: 'Диплом доктора наук', url: 'doctor-sciences-diploma.html' },
  // Специальные
  { type: 'special_school', title: 'Свидетельство об окончании спецшколы', url: 'special-school-certificate.html' },
  { type: 'driving_school', title: 'Свидетельство об окончании автошколы', url: 'driving-school-certificate.html' },
  { type: 'school_certificate', title: 'Справка об окончании школы (колледжа)', url: 'school-certificate.html' }
]

async function loadAllEducationDocuments() {
  if (!personalCode) return []

  let docs = []

  for (const ed of educationTypes) {
    const { data, error } = await supabase
      .from('documents_education')
      .select('*')
      .eq('personal_code', personalCode)
      .eq('type', ed.type)
      .neq('status', 'archived') // исключаем архивные
      .order('created_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      docs.push({
        ...data[0],
        typeInfo: ed,
        id: data[0].id
      })
    }
  }

  return docs
}

function renderEducationGrid(documents) {
  const grid = document.getElementById('educationGrid')
  if (!grid) return

  grid.innerHTML = ''

  // Статическая карточка для архивных документов (как в certificates)
  const archiveCard = document.createElement('a')
  archiveCard.href = 'archive.html'
  archiveCard.className = 'certificate-card'
  archiveCard.innerHTML = `
    <div class="certificate-header">
      <div class="certificate-title">Архивные документы</div>
    </div>
    <div class="certificate-fields">
      <div class="certificate-field">
        <span class="field-label">Перейти к архиву </span>
        <span class="field-value"> →</span>
      </div>
    </div>
  `
  grid.appendChild(archiveCard)

  // Динамические карточки
  documents.forEach(doc => {
    const statusLabel = getStatusLabel(doc.status)
    const statusClass = doc.status === 'verified' ? 'status-verified' : (doc.status === 'oncheck' ? 'status-pending' : 'status-rejected')
    const number = doc.document_number || '—'

    const card = document.createElement('a')
    card.href = `${doc.typeInfo.url}?id=${doc.id}`
    card.className = 'certificate-card'
    card.innerHTML = `
      <div class="certificate-header">
        <div class="certificate-title">${doc.typeInfo.title}</div>
        <span class="certificate-status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="certificate-fields">
        <div class="certificate-field">
          <span class="field-label">Номер:</span>
          <span class="field-value">${number}</span>
        </div>
      </div>
    `
    grid.appendChild(card)
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile()
  if (personalCode) {
    const docs = await loadAllEducationDocuments()
    renderEducationGrid(docs)
  }
  document.getElementById('loading').style.display = 'none'
  document.getElementById('content').style.display = 'block'
})