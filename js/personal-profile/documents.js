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

// ==================== ЗАГРУЗКА ВСЕХ ДОКУМЕНТОВ ====================
async function loadAllDocuments() {
  if (!personalCode) return []

  const tables = [
    { type: 'passport', table: 'document_passport' },
    { type: 'foreignPassport', table: 'document_foreign_passport' },
    { type: 'inn', table: 'documents_inn' },
    { type: 'nss', table: 'documents_nss' },
    { type: 'driverLicense', table: 'documents_driver_license' },
    { type: 'idCard', table: 'documents_idcard' },
    { type: 'militaryId', table: 'documents_military_id' },
    { type: 'oms', table: 'documents_oms' },
    { type: 'pension', table: 'documents_pension' },
    { type: 'disability', table: 'documents_disability' },
    { type: 'internationalDriving', table: 'documents_international_driving' }
  ]

  let allDocs = []

  for (const t of tables) {
    const { data, error } = await supabase
      .from(t.table)
      .select('*')
      .eq('personal_code', personalCode)
      .order('created_at', { ascending: false })

    if (!error && data) {
      allDocs = allDocs.concat(data.map(d => ({
        ...d,
        documentType: t.type,
        id: d.id
      })))
    }
  }

  return allDocs
}

function getDocumentNumber(doc, type) {
  switch (type) {
    case 'passport':
      return doc.series_number || doc.seriesNumber || '—'
    case 'foreignPassport':
      return doc.series_number || doc.seriesNumber || '—'
    case 'inn':
      return doc.inn_number || '—'
    case 'nss':
      return doc.nss_number || doc.number || '—'
    case 'driverLicense':
      return doc.license_number || doc.series_number || '—'
    case 'idCard':
      return doc.card_number || doc.series_number || '—'
    case 'militaryId':
      return doc.ticket_number || doc.series_number || '—'
    case 'oms':
      return doc.oms_number || doc.number || '—'
    case 'pension':
      return doc.pension_number || doc.number || '—'
    case 'disability':
      return doc.disability_number || doc.number || '—'
    case 'internationalDriving':
      return doc.license_number || doc.series_number || '—'
    default:
      return '—'
  }
}

function renderDocumentsGrid(documents) {
  const grid = document.getElementById('documentsGrid')
  if (!grid) return

  grid.innerHTML = ''

  if (documents.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">У вас пока нет добавленных документов.</p>'
    return
  }

  // Группируем по типу, берём последний по дате
  const docsByType = {}
  documents.forEach(doc => {
    const type = doc.documentType
    const createdAt = doc.created_at ? new Date(doc.created_at) : new Date(0)
    if (!docsByType[type] || createdAt > new Date(docsByType[type].created_at)) {
      docsByType[type] = doc
    }
  })

  const docTypes = [
    { type: 'passport', title: 'Паспорт гражданина СФСРЮ', url: 'passport.html' },
    { type: 'foreignPassport', title: 'Заграничный паспорт гражданина СФСРЮ', url: 'foreign-passport.html' },
    { type: 'inn', title: 'ИНН', url: 'inn.html' },
    { type: 'nss', title: 'Номер социального счёта (НСС)', url: 'nss.html' },
    { type: 'driverLicense', title: 'Водительское удостоверение', url: 'driver-license.html' },
    { type: 'idCard', title: 'ID-карта', url: 'id-card.html' },
    { type: 'militaryId', title: 'Военный билет', url: 'military-id.html' },
    { type: 'oms', title: 'Полис ОМС', url: 'oms.html' },
    { type: 'pension', title: 'Удостоверение пенсионера', url: 'pension.html' },
    { type: 'disability', title: 'Инвалидность', url: 'disability.html' },
    { type: 'internationalDriving', title: 'Международное водительское удостоверение', url: 'international-driving.html' }
  ]

  docTypes.forEach(item => {
    const doc = docsByType[item.type]
    if (!doc) return

    const statusLabel = getStatusLabel(doc.status)
    const statusClass = doc.status === 'verified' ? 'status-verified' : (doc.status === 'oncheck' ? 'status-pending' : 'status-rejected')
    const number = getDocumentNumber(doc, item.type)

    const card = document.createElement('a')
    card.href = `${item.url}?id=${doc.id}`
    card.className = 'document-card'
    card.innerHTML = `
      <div class="document-header">
        <div class="document-title">${item.title}</div>
        <span class="document-status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="document-fields">
        <div class="document-field">
          <span class="field-label">Номер:</span>
          <span class="field-value">${number}</span>
        </div>
      </div>
    `
    grid.appendChild(card)
  })
}

// ==================== СПЕЦИАЛЬНЫЕ ДОКУМЕНТЫ ====================
const specialDocTypes = [
  { table: 'documents_president', title: 'Удостоверение Президента СФСРЮ', url: 'president.html' },
  { table: 'documents_vice_president', title: 'Удостоверение Вице-президента СФСРЮ', url: 'vice-president.html' },
  { table: 'documents_council_chair', title: 'Удостоверение Председателя Совета Федерации СФСРЮ', url: 'council-chair.html' },
  { table: 'documents_gov_chair', title: 'Удостоверение Председателя Правительства СФСРЮ', url: 'gov-chair.html' },
  { table: 'documents_deputy', title: 'Удостоверение депутата Совета Федерации СФСРЮ', url: 'deputy.html' },
  { table: 'documents_judge', title: 'Удостоверение судьи', url: 'judge.html' },
  { table: 'documents_lawyer', title: 'Удостоверение адвоката', url: 'lawyer.html' }
]

async function loadSpecialDocuments() {
  if (!personalCode) return []
  const found = []
  for (const spec of specialDocTypes) {
    const { data, error } = await supabase
      .from(spec.table)
      .select('id')
      .eq('personal_code', personalCode)
      .limit(1)
    if (!error && data && data.length > 0) {
      found.push({
        id: data[0].id,
        title: spec.title,
        url: spec.url
      })
    }
  }
  return found
}

function renderSpecialDocuments(docs) {
  const block = document.getElementById('specialDocs')
  const list = document.getElementById('specialList')
  if (!block || !list) return
  if (docs.length === 0) {
    block.classList.remove('visible')
    return
  }
  list.innerHTML = ''
  docs.forEach(doc => {
    const link = document.createElement('a')
    link.href = `${doc.url}?id=${doc.id}`
    link.className = 'special-item'
    link.textContent = doc.title
    list.appendChild(link)
  })
  block.classList.add('visible')
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile()
  if (personalCode) {
    const docs = await loadAllDocuments()
    renderDocumentsGrid(docs)

    const specialDocs = await loadSpecialDocuments()
    renderSpecialDocuments(specialDocs)
  }
  document.getElementById('loading').style.display = 'none'
  document.getElementById('content').style.display = 'block'
})