import { supabase } from '../../../js/supabase-config.js'

// ==================== КОНСТАНТЫ ====================
const BRACKET_ORDER = { '14-20': 0, '20-45': 1, '45-60': 2, '60+': 3 }
const BRACKET_LABEL = {
  '14-20': '14–20 лет',
  '20-45': '20–45 лет',
  '45-60': '45–60 лет',
  '60+':   '60+ лет'
}

let currentDocId = null
let documentData = {}
let userPersonalCode = null
let userProfile = null
let userId = null

// ==================== ВСПОМОГАТЕЛЬНЫЕ ====================
function formatDate(dateString) {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  } catch { return dateString }
}

function calculateAge(birthDate) {
  if (!birthDate) return ''
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return `(${age} лет)`
}

function getStatusLabel(status) {
  if (status === 'verified') return '✅ Подтверждено'
  if (status === 'oncheck') return '⏳ На проверке'
  if (status === 'rejected') return '❌ Отклонено'
  return '—'
}

function getStatusClass(status) {
  if (status === 'verified') return 'document-status status-verified'
  if (status === 'oncheck') return 'document-status status-pending'
  if (status === 'rejected') return 'document-status status-rejected'
  return 'document-status'
}

// ==================== STORAGE ====================
async function getPhotoSignedUrl(storagePath) {
  if (!storagePath) return null
  try {
    const { data, error } = await supabase.storage
      .from('documents-files')
      .createSignedUrl(storagePath, 3600)
    if (error) throw error
    return data.signedUrl
  } catch (err) {
    console.error('signed URL:', err.message)
    return null
  }
}

// ==================== ФОТОГРАФИИ (только чтение) ====================
async function loadPhotos(personalCode) {
  if (!personalCode) return []
  const { data, error } = await supabase
    .schema('documents')
    .from('epass_photos')
    .select('*')
    .eq('personal_code', personalCode)
  if (error) { console.error('loadPhotos:', error); return [] }
  return data || []
}

// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadData() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      window.location.href = '../../login.html'
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
        .schema('documents').from('epass').select('*')
        .eq('id', idFromUrl).maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .schema('documents').from('epass').select('*')
        .eq('personal_code', userPersonalCode)
        .order('created_at', { ascending: false }).limit(1)
      if (!error && docs?.length > 0) data = docs[0]
    }

    const loadingEl = document.getElementById('loading')
    const contentEl = document.getElementById('content')
    const noDataEl = document.getElementById('noData')

    if (data) {
      documentData = data
      currentDocId = data.id
      await renderCard(documentData)
      loadingEl.style.display = 'none'
      contentEl.style.display = 'block'
      noDataEl.style.display = 'none'
    } else {
      loadingEl.style.display = 'none'
      contentEl.style.display = 'none'
      noDataEl.style.display = 'block'
    }
  } catch (err) {
    console.error('loadData:', err)
    document.getElementById('loading').textContent = 'Произошла критическая ошибка'
  }
}

// ==================== ОТРИСОВКА ====================
async function renderCard(data) {
  const setText = (id, text) => {
    const el = document.getElementById(id)
    if (el) el.textContent = text
  }

  setText('surname', data.surname || '—')
  setText('name', data.name || '—')
  setText('patronymic', data.patronymic || '—')
  setText('birthDate', formatDate(data.birth_date))
  setText('age', calculateAge(data.birth_date))
  setText('gender', data.gender || '—')
  setText('personalCode', data.personal_code || userPersonalCode || '—')
  setText('epassNumber', data.epass_number || '—')

  // Статус
  const statusContainer = document.getElementById('statusAndEditContainer')
  if (statusContainer) {
    statusContainer.innerHTML = `<span class="${getStatusClass(data.status)}">${getStatusLabel(data.status)}</span>`
    statusContainer.style.display = 'flex'
  }

  // QR-код
  const qrContainer = document.getElementById('qrCode')
  if (qrContainer) {
    qrContainer.innerHTML = ''
    if (userPersonalCode) {
      new QRCode(qrContainer, {
        text: userPersonalCode,
        width: 80, height: 80,
        colorDark: '#000', colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L
      })
    }
  }

  // Фото из истории
  const photos = await loadPhotos(userPersonalCode)
  const sorted = photos.slice().sort(
    (a, b) => (BRACKET_ORDER[b.age_bracket] ?? -1) - (BRACKET_ORDER[a.age_bracket] ?? -1)
  )
  const currentPhoto = sorted[0] || null
  const previousPhotos = sorted.slice(1)

  const photoImg = document.getElementById('userPhoto')
  if (photoImg) {
    if (currentPhoto) {
      const url = await getPhotoSignedUrl(currentPhoto.storage_path)
      photoImg.src = url || '../../images/default-avatar.png'
    } else {
      // Fallback: старое расположение одиночного фото
      const legacyUrl = await getPhotoSignedUrl(`epass/${userPersonalCode}/photo.jpg`)
      photoImg.src = legacyUrl || '../../images/default-avatar.png'
    }
  }

  renderPhotoHistory(currentPhoto, previousPhotos)
}

function renderPhotoHistory(currentPhoto, previousPhotos) {
  const container = document.getElementById('photoHistorySection')
  if (!container) return

  const currentLabel = currentPhoto
    ? BRACKET_LABEL[currentPhoto.age_bracket] || currentPhoto.age_bracket
    : null

  const content = previousPhotos.length === 0
    ? `<div class="photo-history-empty">
         <i class="fas fa-images"></i>
         <p>Фотографии из предыдущих возрастных периодов появятся здесь, когда администратор обновит ваше фото.</p>
       </div>`
    : `<div class="photo-grid" id="photoGrid"></div>`

  container.innerHTML = `
    <div class="photo-history-header">
      <h3 class="photo-history-title"><i class="fas fa-history"></i> История фотографий</h3>
    </div>
    <p class="photo-history-intro">
      <strong>E-Pass</strong> — электронный документ, который выдаётся один раз в жизни
      и не подлежит переоформлению. Но человек с возрастом меняется, поэтому фотографию
      необходимо периодически обновлять. Обновлением занимается администратор СФСРЮ.
      При обновлении прежняя фотография не исчезает — она сохраняется в этом разделе как история.
      ${currentLabel ? `<br><br>Текущая фотография в карточке: <strong>${currentLabel}</strong>.` : ''}
    </p>
    ${content}
  `
  container.style.display = 'block'

  if (previousPhotos.length > 0) fillPhotoGrid(previousPhotos)
}

async function fillPhotoGrid(photos) {
  const grid = document.getElementById('photoGrid')
  if (!grid) return

  const items = await Promise.all(photos.map(async (p) => {
    const url = await getPhotoSignedUrl(p.storage_path)
    return { ...p, url }
  }))

  grid.innerHTML = items.map(p => `
    <div class="photo-item">
      <img src="${p.url || '../../images/default-avatar.png'}"
           alt="Фото ${BRACKET_LABEL[p.age_bracket] || p.age_bracket}">
      <div class="photo-item-info">
        <div class="photo-item-bracket">${BRACKET_LABEL[p.age_bracket] || p.age_bracket}</div>
        <div class="photo-item-date">${formatDate(p.created_at)}</div>
      </div>
    </div>
  `).join('')
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()
})