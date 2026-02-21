import { supabase } from '../../js/supabase-config.js'

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let userProfile = null
let personalCode = null

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function formatDate(dateString) {
  if (!dateString) return '—'
  try { return new Date(dateString).toLocaleDateString('ru-RU') }
  catch { return dateString }
}

function getStatusLabel(status) {
  if (status === 'verified') return '✅ Подтверждено'
  if (status === 'oncheck') return '⏳ На проверке'
  if (status === 'rejected') return '❌ Отклонено'
  return '—'
}

function safeSetText(id, text) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

// ==================== ЗАГРУЗКА ПРОФИЛЯ ====================
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
  renderUserInfo()
}

function renderUserInfo() {
  if (!userProfile) return
  const fullName = `${userProfile.surname || ''} ${userProfile.name || ''} ${userProfile.patronymic || ''}`.trim() || '—'
  safeSetText('fullName', fullName)
  safeSetText('birthDate', formatDate(userProfile.date_of_birth))
  safeSetText('birthPlace', userProfile.place_of_birth || '—')
  safeSetText('gender', userProfile.gender || '—')
  safeSetText('personalCode', userProfile.personal_code || '—')

  // Аватар
  const avatarImg = document.getElementById('userAvatar')
  if (avatarImg && personalCode) {
    const safeCode = personalCode.replace(/[^a-zA-Z0-9\-]/g, '')
    const imgUrl = `../../images/avatars/${safeCode}.jpg`
    const img = new Image()
    img.onload = () => { avatarImg.src = imgUrl }
    img.onerror = () => { avatarImg.src = '../../images/default-avatar.png' }
    img.src = imgUrl
  }

  // QR-код
  const qrContainer = document.getElementById('userQrCode')
  if (qrContainer && personalCode) {
    qrContainer.innerHTML = ''
    new QRCode(qrContainer, {
      text: `https://e-pass-sfsru.web.app/${personalCode}/`,
      width: 72,
      height: 72,
      colorDark: '#000',
      colorLight: '#fff',
      correctLevel: QRCode.CorrectLevel.L
    })
  }
}

// ==================== ЗАГРУЗКА СВИДЕТЕЛЬСТВ ====================
const certificateTypes = [
  { table: 'documents_birth_certificate', title: 'Свидетельство о рождении', url: 'birth-certificate.html' },
  { table: 'documents_marriage_certificate', title: 'Свидетельство о заключении брака', url: 'marriage-certificate.html' },
  { table: 'documents_divorce_certificate', title: 'Свидетельство о расторжении брака', url: 'divorce-certificate.html' },
  { table: 'documents_death_certificate', title: 'Свидетельство о смерти', url: 'death-certificate.html' },
  { table: 'documents_adoption_certificate', title: 'Свидетельство об усыновлении (удочерении)', url: 'adoption-certificate.html' },
  { table: 'documents_name_change_certificate', title: 'Свидетельство о перемене имени', url: 'name-change-certificate.html' },
  { table: 'documents_fatherhood_certificate', title: 'Свидетельство об установлении отцовства', url: 'fatherhood-certificate.html' }
]

async function loadAllCertificates() {
  if (!personalCode) return []

  let allCerts = []

  for (const cert of certificateTypes) {
    const { data, error } = await supabase
      .from(cert.table)
      .select('*')
      .eq('personal_code', personalCode)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      allCerts.push({
        ...data[0],
        type: cert.title,
        url: cert.url,
        id: data[0].id
      })
    }
  }

  return allCerts
}

function getCertificateNumber(cert) {
  // Предполагаем, что в таблице есть поле certificate_number или number
  return cert.certificate_number || cert.number || '—'
}

function renderCertificatesGrid(certificates) {
  const grid = document.getElementById('certificatesGrid')
  if (!grid) return

  grid.innerHTML = ''

  // Статическая карточка для архивных свидетельств (всегда видна)
  const archiveCard = document.createElement('a')
  archiveCard.href = '../archive-certificates/index.html'
  archiveCard.className = 'certificate-card'
  archiveCard.innerHTML = `
    <div class="certificate-header">
      <div class="certificate-title">Архивные свидетельства</div>
    </div>
    <div class="certificate-fields">
      <div class="certificate-field">
        <span class="field-label">Перейти к архиву</span>
        <span class="field-value">→</span>
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

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile()
  if (personalCode) {
    const certs = await loadAllCertificates()
    renderCertificatesGrid(certs)
  }
  document.getElementById('loading').style.display = 'none'
  document.getElementById('content').style.display = 'block'
})