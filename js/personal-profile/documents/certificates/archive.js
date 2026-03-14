import { supabase } from '../../../../js/supabase-config.js'

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

  let allArchived = []

  for (const cert of certificateTypes) {
    const { data, error } = await supabase
      .schema('documents_certificates')
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

  // Для marriage также ищем записи, где personal_code может быть в husband_personal_code или wife_personal_code
  // (если статус archived и код соответствует)
  const { data: marriageArchived, error: marriageError } = await supabase
    .schema('documents_certificates')
    .from('marriage')
    .select('*')
    .or(`husband_personal_code.eq.${personalCode},wife_personal_code.eq.${personalCode}`)
    .eq('status', 'archived')
    .order('created_at', { ascending: false })

  if (!marriageError && marriageArchived) {
    marriageArchived.forEach(item => {
      allArchived.push({
        ...item,
        type: 'Свидетельство о заключении брака',
        url: 'marriage-certificate.html',
        id: item.id
      })
    })
  }

  // Аналогично для divorce
  const { data: divorceArchived, error: divorceError } = await supabase
    .schema('documents_certificates')
    .from('divorce')
    .select('*')
    .or(`husband_personal_code.eq.${personalCode},wife_personal_code.eq.${personalCode}`)
    .eq('status', 'archived')
    .order('created_at', { ascending: false })

  if (!divorceError && divorceArchived) {
    divorceArchived.forEach(item => {
      allArchived.push({
        ...item,
        type: 'Свидетельство о расторжении брака',
        url: 'divorce-certificate.html',
        id: item.id
      })
    })
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