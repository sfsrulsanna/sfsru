import { supabase } from '../../js/supabase-config.js'

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let personalCode = null

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function formatDate(dateString) {
  if (!dateString) return '—'
  try { return new Date(dateString).toLocaleDateString('ru-RU') }
  catch { return dateString }
}

function getStatusLabel(status) {
  // Для архивных всегда показываем "Архивный"
  return '📦 Архивный'
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

// ==================== ЗАГРУЗКА ПРОФИЛЯ ====================
async function loadUserProfile() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = '../../login.html'
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
  { table: 'documents_birth_certificate', title: 'Свидетельство о рождении', url: 'birth-certificate.html' },
  { table: 'documents_marriage_certificate', title: 'Свидетельство о заключении брака', url: 'marriage-certificate.html' },
  { table: 'documents_divorce_certificate', title: 'Свидетельство о расторжении брака', url: 'divorce-certificate.html' },
  { table: 'documents_death_certificate', title: 'Свидетельство о смерти', url: 'death-certificate.html' },
  { table: 'documents_adoption_certificate', title: 'Свидетельство об усыновлении (удочерении)', url: 'adoption-certificate.html' },
  { table: 'documents_name_change_certificate', title: 'Свидетельство о перемене имени', url: 'name-change-certificate.html' },
  { table: 'documents_fatherhood_certificate', title: 'Свидетельство об установлении отцовства', url: 'fatherhood-certificate.html' }
]

async function loadArchivedCertificates() {
  if (!personalCode) return []

  let allArchived = []

  for (const cert of certificateTypes) {
    const { data, error } = await supabase
      .from(cert.table)
      .select('*')
      .eq('personal_code', personalCode)
      .eq('status', 'archived')
      .order('created_at', { ascending: false })

    if (!error && data) {
      // Добавляем к каждой записи информацию о типе и URL
      data.forEach(item => {
        allArchived.push({
          ...item,
          type: cert.title,
          url: cert.url,
          id: item.id
        })
      })
    }
  }

  // Сортируем все записи по дате создания (самые новые сверху)
  allArchived.sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at) : new Date(0)
    const dateB = b.created_at ? new Date(b.created_at) : new Date(0)
    return dateB - dateA
  })

  return allArchived
}

function getCertificateNumber(cert) {
  // В разных таблицах поле может называться по-разному
  return cert.certificate_series_number || cert.certificate_number || cert.number || '—'
}

function getCertificateDate(cert) {
  // Пытаемся получить дату события (например, дату рождения, заключения брака и т.д.)
  // Приоритет: поле, специфичное для типа
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
    const statusLabel = getStatusLabel(cert.status)
    const number = getCertificateNumber(cert)
    const date = getCertificateDate(cert)

    const card = document.createElement('a')
    card.href = `${cert.url}?id=${cert.id}`
    card.className = 'certificate-card'
    card.innerHTML = `
      <div class="certificate-header">
        <div class="certificate-title">${escapeHTML(cert.type)}</div>
        <span class="certificate-status status-archived">${statusLabel}</span>
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

  document.getElementById('loading').style.display = 'none'
  document.getElementById('content').style.display = 'block'
})