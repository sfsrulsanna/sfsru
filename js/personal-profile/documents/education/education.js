import { supabase } from '../../../../js/supabase-config.js'

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let personalCode = null

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function getStatusLabel(status) {
  if (status === 'verified') return '✅ Подтверждено'
  if (status === 'oncheck') return '⏳ На проверке'
  if (status === 'rejected') return '❌ Отклонено'
  return '—'
}

// ==================== ЗАГРУЗКА ПРОФИЛЯ ====================
async function loadUserProfile() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = '../../../login.html' // Путь на уровень выше
    return
  }

  const { data, error } = await supabase
    .from('users')
    .select('personal_code')
    .eq('id', session.user.id)
    .single()

  if (error || !data) {
    console.error('Ошибка загрузки профиля:', error)
    return
  }

  personalCode = data.personal_code
}

// ==================== ОПРЕДЕЛЕНИЕ ТИПОВ ====================
const basicTypes = [
  { type: 'preschool', title: 'Аттестат о дошкольном образовании', url: 'preschool-certificate.html' },
  { type: 'primary', title: 'Аттестат о начальном образовании', url: 'primary-certificate.html' },
  { type: 'basic_general', title: 'Аттестат об основном общем образовании', url: 'basic-general-certificate.html' },
  { type: 'secondary_general', title: 'Аттестат о среднем общем образовании', url: 'secondary-general-certificate.html' },
  { type: 'secondary_vocational', title: 'Диплом о среднем профессиональном образовании', url: 'secondary-vocational-diploma.html' },
  { type: 'basic_higher', title: 'Диплом о базовом высшем образовании', url: 'basic-higher-diploma.html' },
  { type: 'specialized_higher', title: 'Диплом о специализированном высшем образовании', url: 'specialized-higher-diploma.html' },
  { type: 'qualified_higher', title: 'Диплом о квалифицированном высшем образовании', url: 'qualified-higher-diploma.html' },
  { type: 'incomplete_higher', title: 'Диплом о неполном высшем образовании', url: 'incomplete-higher-diploma.html' }
]

const additionalTypes = [
  { type: 'professional_retraining', title: 'Диплом о профессиональной переподготовке', url: 'professional-retraining-diploma.html' },
  { type: 'driving_school', title: 'Свидетельство об окончании автошколы', url: 'driving-school-certificate.html' }
]

const degreeTypes = [
  { type: 'candidate_sciences', title: 'Диплом кандидата наук', url: 'candidate-sciences-diploma.html' },
  { type: 'doctor_sciences', title: 'Диплом доктора наук', url: 'doctor-sciences-diploma.html' }
]

const nonEducationalTypes = [
  { type: 'memorial', title: 'Памятный аттестат', url: 'memorial-certificate.html' },
  { type: 'special_school', title: 'Свидетельство об окончании спецшколы', url: 'special-school-certificate.html' },
  { type: 'school_certificate', title: 'Справка об окончании школы (колледжа)', url: 'school-certificate.html' }
]

// ==================== ЗАГРУЗКА ДОКУМЕНТОВ ====================
async function loadAllEducationDocuments() {
  if (!personalCode) return []

  const { data, error } = await supabase
    .from('documents_education')
    .select('*')
    .eq('personal_code', personalCode)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Ошибка загрузки документов:', error)
    return []
  }
  return data || []
}

// ==================== ОТРИСОВКА ====================
function getLatestDocsByType(allDocs, typeList) {
  const result = []
  typeList.forEach(t => {
    // Ищем документы этого типа (они уже отсортированы по дате создания)
    const docsOfType = allDocs.filter(d => d.type === t.type)
    if (docsOfType.length > 0) {
      result.push({ ...docsOfType[0], typeInfo: t })
    }
  })
  return result
}

function renderSection(docs, sectionId, gridId) {
  const section = document.getElementById(sectionId)
  const grid = document.getElementById(gridId)
  
  if (!section || !grid) return

  if (docs.length === 0) {
    section.style.display = 'none'
    return
  }

  section.style.display = 'block'
  grid.innerHTML = ''

  docs.forEach(doc => {
    const statusLabel = getStatusLabel(doc.status)
    const statusClass = doc.status === 'verified' ? 'status-verified' : (doc.status === 'oncheck' ? 'status-pending' : 'status-rejected')
    const number = doc.document_number || '—'

    const card = document.createElement('a')
    card.href = `${doc.typeInfo.url}?id=${doc.id}`
    card.className = 'certificate-card'
    card.innerHTML = `
      <div class="certificate-header">
        <div class="certificate-title">${doc.typeInfo.title}</div>
        <div class="certificate-badges">
          <span class="certificate-status ${statusClass}">${statusLabel}</span>
        </div>
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

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile()
  
  if (personalCode) {
    const allDocs = await loadAllEducationDocuments()
    
    // Формируем списки документов для каждого блока
    const basicDocs = getLatestDocsByType(allDocs, basicTypes)
    const additionalDocs = getLatestDocsByType(allDocs, additionalTypes)
    const degreeDocs = getLatestDocsByType(allDocs, degreeTypes)
    const nonEducationalDocs = getLatestDocsByType(allDocs, nonEducationalTypes)

    // Отрисовываем секции
    renderSection(basicDocs, 'basicEducationSection', 'basicEducationGrid')
    renderSection(additionalDocs, 'additionalEducationSection', 'additionalEducationGrid')
    renderSection(degreeDocs, 'degreesSection', 'degreesGrid')
    renderSection(nonEducationalDocs, 'nonEducationalSection', 'nonEducationalGrid')
  }
  
  document.getElementById('loading').style.display = 'none'
  document.getElementById('content').style.display = 'block'
})