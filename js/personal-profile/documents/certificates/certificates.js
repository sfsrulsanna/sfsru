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

// ==================== ЗАГРУЗКА ПРОФИЛЯ (только personal_code) ====================
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

// ==================== ЗАГРУЗКА СВИДЕТЕЛЬСТВ ====================
const certificateTypes = [
  { table: 'birth', title: 'Свидетельство о рождении', url: 'birth-certificate.html' },
  { table: 'marriage', title: 'Свидетельство о заключении брака', url: 'marriage-certificate.html' },
  { table: 'divorce', title: 'Свидетельство о расторжении брака', url: 'divorce-certificate.html' },
  { table: 'death', title: 'Свидетельство о смерти', url: 'death-certificate.html' },
  { table: 'adoption', title: 'Свидетельство об усыновлении (удочерении)', url: 'adoption-certificate.html' },
  { table: 'name_change', title: 'Свидетельство о перемене имени', url: 'name-change-certificate.html' },
  { table: 'fatherhood', title: 'Свидетельство об установлении отцовства', url: 'fatherhood-certificate.html' }
]

async function loadAllCertificates() {
  if (!personalCode) return []

  // Используем Map для предотвращения дублирования по ID
  const certsMap = new Map()

  // 1. Стандартная загрузка по personal_code
  for (const cert of certificateTypes) {
    const { data, error } = await supabase
      .schema('documents_certificates')
      .from(cert.table)
      .select('*')
      .eq('personal_code', personalCode)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      const doc = data[0]
      if (!certsMap.has(doc.id)) {
        certsMap.set(doc.id, {
          ...doc,
          type: cert.title,
          url: cert.url
        })
      }
    }
  }

  // 2. Дополнительная проверка для браков и разводов (поиск по husband/wife)
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
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      const doc = data[0]
      // Добавляем только если такого ID еще нет в Map
      if (!certsMap.has(doc.id)) {
        certsMap.set(doc.id, {
          ...doc,
          type: st.title,
          url: st.url
        })
      }
    }
  }

  // Возвращаем массив уникальных свидетельств
  return Array.from(certsMap.values())
}

function getCertificateNumber(cert) {
  return cert.certificate_series_number || cert.certificate_number || cert.number || '—'
}

function renderCertificatesGrid(certificates) {
  const grid = document.getElementById('certificatesGrid')
  if (!grid) return

  grid.innerHTML = ''

  // Статическая карточка для архива
  const archiveCard = document.createElement('a')
  archiveCard.href = 'archive.html'
  archiveCard.className = 'certificate-card'
  archiveCard.innerHTML = `
    <div class="certificate-header">
      <div class="certificate-title">Архивные свидетельства</div>
    </div>
    <div class="certificate-fields">
      <div class="certificate-field">
        <span class="field-label">Перейти к архиву</span>
        <span class="field-value"> →</span>
      </div>
    </div>
  `
  grid.appendChild(archiveCard)

  // Динамические карточки
  certificates.forEach(cert => {
    const statusLabel = getStatusLabel(cert.status)
    const statusClass = cert.status === 'verified' ? 'status-verified' : (cert.status === 'oncheck' ? 'status-pending' : 'status-rejected')
    const number = getCertificateNumber(cert)

    const card = document.createElement('a')
    card.href = `${cert.url}?id=${cert.id}`
    card.className = 'certificate-card'
    card.innerHTML = `
      <div class="certificate-header">
        <div class="certificate-title">${cert.type}</div>
        <div class="certificate-badges">
          <span class="certificate-status ${statusClass}">${statusLabel}</span>
        </div>
      </div>
      <div class="certificate-fields">
        <div class="certificate-field">
          <span class="field-label">Серия и номер:</span>
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
    const certs = await loadAllCertificates()
    renderCertificatesGrid(certs)
  }
  
  const loadingEl = document.getElementById('loading')
  const contentEl = document.getElementById('content')
  if (loadingEl) loadingEl.style.display = 'none'
  if (contentEl) contentEl.style.display = 'block'
})