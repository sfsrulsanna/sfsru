import { supabase } from '../../../../js/supabase-config.js'

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let personalCode = null

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function formatDate(dateString) {
  if (!dateString) return '—'
  try { return new Date(dateString).toLocaleDateString('ru-RU') }
  catch { return dateString }
}

function escapeHTML(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ==================== ЗАГРУЗКА ПРОФИЛЯ ====================
async function loadUserProfile() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    // Поднимаемся на 3 уровня вверх до корня, где лежит login.html
    window.location.href = '../../../login.html'
    return null
  }

  const { data, error } = await supabase
    .from('users')
    .select('personal_code')
    .eq('id', session.user.id)
    .single()

  if (error || !data) {
    console.error('Ошибка загрузки профиля:', error)
    return null
  }

  personalCode = data.personal_code
  return data
}

// ==================== ЗАГРУЗКА АРХИВНЫХ СВИДЕТЕЛЬСТВ ====================
const certificateTypes = [
  { table: 'birth', title: 'Свидетельство о рождении', url: 'birth-certificate.html' },
  { table: 'marriage', title: 'Свидетельство о заключении брака', url: 'marriage-certificate.html' },
  { table: 'divorce', title: 'Свидетельство о расторжении брака', url: 'divorce-certificate.html' },
  { table: 'death', title: 'Свидетельство о смерти', url: 'death-certificate.html' },
  { table: 'adoption', title: 'Свидетельство об усыновлении (удочерении)', url: 'adoption-certificate.html' },
  { table: 'name_change', title: 'Свидетельство о перемене имени', url: 'name-change-certificate.html' },
  { table: 'fatherhood', title: 'Свидетельство об установлении отцовства', url: 'fatherhood-certificate.html' }
]

async function loadArchivedCertificates() {
  if (!personalCode) return []

  // Используем Map для исключения дублирования (ключ — уникальный ID документа)
  const certsMap = new Map()

  // 1. Стандартная загрузка по personal_code
  for (const cert of certificateTypes) {
    const { data, error } = await supabase
      .schema('documents_certificates')
      .from(cert.table)
      .select('*')
      .eq('personal_code', personalCode)
      .eq('status', 'archived')
      .order('created_at', { ascending: false })

    if (!error && data) {
      data.forEach(doc => {
        if (!certsMap.has(doc.id)) {
          certsMap.set(doc.id, {
            ...doc,
            type: cert.title,
            url: cert.url
          })
        }
      })
    }
  }

  // 2. Дополнительный поиск для браков и разводов (по husband/wife коду)
  const specialTables = [
    { table: 'marriage', title: 'Свидетельство о заключении брака', url: 'marriage-certificate.html' },
    { table: 'divorce', title: 'Свидетельство о расторжении брака', url: 'divorce-certificate.html' }
  ]

  for (const st of specialTables) {
    const { data, error } = await supabase
      .schema('documents_certificates')
      .from(st.table)
      .select('*')
      .or(`husband_personal_code.eq.${personalCode},wife_personal_code.eq.${personalCode}`)
      .eq('status', 'archived')
      .order('created_at', { ascending: false })

    if (!error && data) {
      data.forEach(doc => {
        // Добавляем только если такого ID еще нет в Map
        if (!certsMap.has(doc.id)) {
          certsMap.set(doc.id, {
            ...doc,
            type: st.title,
            url: st.url
          })
        }
      })
    }
  }

  // Преобразуем Map обратно в массив и сортируем по дате создания
  const allArchived = Array.from(certsMap.values())
  
  allArchived.sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at) : new Date(0)
    const dateB = b.created_at ? new Date(b.created_at) : new Date(0)
    return dateB - dateA
  })

  return allArchived
}

function getCertificateNumber(cert) {
  return cert.certificate_series_number || cert.certificate_number || cert.number || '—'
}

function getCertificateDate(cert) {
  if (cert.birth_date) return formatDate(cert.birth_date)
  if (cert.marriage_date) return formatDate(cert.marriage_date)
  if (cert.death_date) return formatDate(cert.death_date)
  if (cert.adoption_date) return formatDate(cert.adoption_date)
  if (cert.change_date) return formatDate(cert.change_date)
  if (cert.registry_act_date) return formatDate(cert.registry_act_date)
  return '—'
}

function renderArchiveGrid(certificates) {
  const grid = document.getElementById('archiveGrid')
  const emptyMessage = document.getElementById('emptyMessage')
  if (!grid) return

  grid.innerHTML = ''

  if (certificates.length === 0) {
    grid.style.display = 'none'
    if (emptyMessage) emptyMessage.style.display = 'block'
    return
  }

  grid.style.display = 'grid'
  if (emptyMessage) emptyMessage.style.display = 'none'

  certificates.forEach(cert => {
    const number = getCertificateNumber(cert)
    const date = getCertificateDate(cert)

    const card = document.createElement('a')
    card.href = `${cert.url}?id=${cert.id}`
    card.className = 'certificate-card'
    card.innerHTML = `
      <div class="certificate-header">
        <div class="certificate-title">${escapeHTML(cert.type)}</div>
        <div class="certificate-badges">
          <span class="certificate-status status-archived">📦 Архивный</span>
        </div>
      </div>
      <div class="certificate-fields">
        <div class="certificate-field">
          <span class="field-label">Номер:</span>
          <span class="field-value">${escapeHTML(number)}</span>
        </div>
        <div class="certificate-field">
          <span class="field-label">Дата:</span>
          <span class="field-value">${escapeHTML(date)}</span>
        </div>
      </div>
    `
    grid.appendChild(card)
  })
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  const profile = await loadUserProfile()
  if (!profile) return

  const archived = await loadArchivedCertificates()
  renderArchiveGrid(archived)

  const loadingEl = document.getElementById('loading')
  const contentEl = document.getElementById('content')
  if (loadingEl) loadingEl.style.display = 'none'
  if (contentEl) contentEl.style.display = 'block'
})