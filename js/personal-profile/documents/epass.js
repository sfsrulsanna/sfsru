import { supabase } from '../../../js/supabase-config.js'

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
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  } catch {
    return dateString
  }
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

// ==================== ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ПОДПИСАННОЙ ССЫЛКИ НА ФОТО ====================
async function getSignedPhotoUrl(personalCode) {
  if (!personalCode) return null
  try {
    const filePath = `epass/${encodeURIComponent(personalCode)}/photo.jpg`
    const { data, error } = await supabase.storage
      .from('documents-files')
      .createSignedUrl(filePath, 3600) // 1 час
    if (error) throw error
    return data.signedUrl
  } catch (err) {
    console.error('Ошибка получения signed URL для фото:', err.message)
    return null
  }
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
        .schema('documents')
        .from('epass')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      const { data: docs, error } = await supabase
        .schema('documents')
        .from('epass')
        .select('*')
        .eq('personal_code', userPersonalCode)
        .order('created_at', { ascending: false })
        .limit(1)
      if (!error && docs && docs.length > 0) {
        data = docs[0]
      }
    }

    const loadingEl = document.getElementById('loading')
    const contentEl = document.getElementById('content')
    const noDataEl = document.getElementById('noData')
    const actionBtn = document.getElementById('actionBtn')

    if (data) {
      documentData = data
      currentDocId = data.id
      await renderCard(documentData)
      loadingEl.style.display = 'none'
      contentEl.style.display = 'block'
      noDataEl.style.display = 'none'
      if (actionBtn) actionBtn.style.display = 'none' // скрываем кнопку получения, если документ уже есть
    } else {
      loadingEl.style.display = 'none'
      contentEl.style.display = 'none'
      noDataEl.style.display = 'block'
      if (actionBtn) actionBtn.style.display = 'inline-block' // показываем кнопку для получения
    }
  } catch (err) {
    console.error('Необработанная ошибка в loadData:', err)
    document.getElementById('loading').textContent = 'Произошла критическая ошибка'
  }
}

// ==================== ОТРИСОВКА КАРТОЧКИ ====================
async function renderCard(data) {
  const setText = (id, text) => {
    const el = document.getElementById(id)
    if (el) el.textContent = text
  }

  setText('surname', data.surname || '—')
  setText('name', data.name || '—')
  setText('patronymic', data.patronymic || '—')
  
  const birthEl = document.getElementById('birthDate')
  if (birthEl) birthEl.textContent = formatDate(data.birth_date)
  const ageEl = document.getElementById('age')
  if (ageEl) ageEl.textContent = calculateAge(data.birth_date)

  setText('gender', data.gender || '—')
  setText('personalCode', data.personal_code || userPersonalCode || '—')
  setText('epassNumber', data.epass_number || '—')

  // Фото
  const photoImg = document.getElementById('userPhoto')
  if (photoImg) {
    photoImg.src = '../../images/default-avatar.png'
    if (userPersonalCode) {
      const signedUrl = await getSignedPhotoUrl(userPersonalCode)
      if (signedUrl) {
        const img = new Image()
        img.onload = () => { photoImg.src = signedUrl }
        img.onerror = () => { photoImg.src = '../../images/default-avatar.png' }
        img.src = signedUrl
      }
    }
  }

  // QR-код
  const qrContainer = document.getElementById('qrCode')
  if (qrContainer) {
    qrContainer.innerHTML = ''
    if (userPersonalCode) {
      new QRCode(qrContainer, {
        text: userPersonalCode,
        width: 80,
        height: 80,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L
      })
    }
  }

  // Блок статуса (без кнопок редактирования)
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)

  const statusContainer = document.createElement('div')
  statusContainer.className = 'status-container'
  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusContainer.appendChild(statusSpan)

  const card = document.querySelector('.epass-card')
  if (card && card.parentNode) {
    card.parentNode.insertBefore(statusContainer, card.nextSibling)
  }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()
  const actionBtn = document.getElementById('actionBtn')
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      window.location.href = 'apply.html' // страница подачи заявления
    })
  }
})