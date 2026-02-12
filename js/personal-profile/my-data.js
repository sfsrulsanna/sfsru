// js/personal-profile/my-data-supabase.js
import { supabase } from '../supabase-config.js'

// --- Глобальное состояние ---
let userData = {}          // данные пользователя (camelCase)
let addressesData = {}     // данные адресов (camelCase)
let currentEditType = null // тип редактируемого блока

// --- Функция-преобразователь snake_case -> camelCase ---
function toCamelCase(obj) {
  if (!obj) return {}
  const newObj = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    newObj[camelKey] = value
  }
  return newObj
}

// --- Обратная функция для подготовки данных к отправке (camelCase -> snake_case) ---
function toSnakeCase(obj) {
  if (!obj) return {}
  const newObj = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    newObj[snakeKey] = value
  }
  return newObj
}

// --- Загрузка данных пользователя и адресов ---
async function loadUserData() {
  try {
    // 1. Проверяем сессию
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    if (!session) {
      window.location.href = '../login.html'
      return
    }

    const userId = session.user.id

    // 2. Загружаем данные из таблицы users
    const { data: userRaw, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError) throw userError
    if (!userRaw) throw new Error('Пользователь не найден')

    // 3. Загружаем адреса из users_addresses (если есть)
    const { data: addressRaw, error: addressError } = await supabase
      .from('users_addresses')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // Преобразуем snake_case -> camelCase для удобства
    userData = toCamelCase(userRaw)
    addressesData = addressRaw ? toCamelCase(addressRaw) : {}

    // Скрываем загрузку, показываем блоки
    document.getElementById('loading').style.display = 'none'
    document.getElementById('dataBlocks').style.display = 'block'

    // Отрисовываем данные
    renderData()
  } catch (error) {
    console.error('Ошибка загрузки данных:', error)
    document.getElementById('loading').textContent = 'Ошибка загрузки. Перезагрузите страницу.'
  }
}

// --- Отображение всех данных на странице ---
function renderData() {
  // ФИО
  document.getElementById('surnameValue').textContent = userData.surname || '—'
  updateStatus('surname', userData.surnameStatus)
  document.getElementById('nameValue').textContent = userData.name || '—'
  updateStatus('name', userData.nameStatus)
  document.getElementById('patronymicValue').textContent = userData.patronymic || '—'
  updateStatus('patronymic', userData.patronymicStatus)

  // Дата и место рождения
  document.getElementById('birthDateValue').textContent = userData.dateOfBirth || '—'
  updateStatus('dateOfBirth', userData.dateOfBirthStatus)
  document.getElementById('birthPlaceValue').textContent = userData.placeOfBirth || '—'
  updateStatus('placeOfBirth', userData.placeOfBirthStatus)

  // Контакты
  document.getElementById('phoneValue').textContent = userData.phone || '—'
  document.getElementById('emailValue').textContent = userData.email || '—'

  // Личный код
  document.getElementById('personalCodeValue').textContent = userData.personalCode || '—'

  // Адреса
  renderAddresses()
}

// --- Отображение адресов (без дат, т.к. в БД их пока нет) ---
function renderAddresses() {
  const container = document.getElementById('addressesContent')
  if (!container) return

  const hasPermanent = addressesData.permanent && addressesData.permanent.trim()
  const hasTemporary = addressesData.temporary && addressesData.temporary.trim()
  const hasResidence = addressesData.residence && addressesData.residence.trim()

  if (!hasPermanent && !hasTemporary && !hasResidence) {
    container.innerHTML = '<div class="no-addresses">На ваше имя не зарегистрировано ни одного адреса.</div>'
    return
  }

  let html = ''
  if (hasPermanent) {
    html += `<div class="address-block">
      <div class="address-title">Постоянная регистрация</div>
      <div><strong>Адрес:</strong> ${addressesData.permanent}</div>
    </div>`
  }
  if (hasTemporary) {
    html += `<div class="address-block">
      <div class="address-title">Временная регистрация</div>
      <div><strong>Адрес:</strong> ${addressesData.temporary}</div>
    </div>`
  }
  if (hasResidence) {
    html += `<div class="address-block">
      <div class="address-title">Место пребывания</div>
      <div><strong>Адрес:</strong> ${addressesData.residence}</div>
    </div>`
  }
  container.innerHTML = html
}

// --- Обновление статусного бейджа ---
function updateStatus(field, status) {
  const el = document.getElementById(`${field}Status`)
  if (!el) return

  let text = '', className = ''
  if (status === 'verified') {
    text = '✅ Подтверждено'
    className = 'status-badge status-verified'
  } else if (status === 'oncheck') {
    text = '⏳ На проверке'
    className = 'status-badge status-pending'
  } else if (status === 'rejected') {
    text = '❌ Отклонено'
    className = 'status-badge status-rejected'
  } else {
    el.style.display = 'none'
    return
  }

  el.textContent = text
  el.className = className
  el.style.display = 'inline-block'
}

// --- Открытие модального окна редактирования ---
window.openEditModal = function(type) {
  currentEditType = type
  let title = '', content = ''

  if (type === 'fio') {
    title = 'Изменение ФИО'
    content = `
      <div class="form-group">
        <label>Фамилия</label>
        <input type="text" id="editSurname" class="form-input" value="${userData.surname || ''}" required>
      </div>
      <div class="form-group">
        <label>Имя</label>
        <input type="text" id="editName" class="form-input" value="${userData.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Отчество</label>
        <input type="text" id="editPatronymic" class="form-input" value="${userData.patronymic || ''}">
      </div>
    `
  } else if (type === 'birth') {
    title = 'Изменение даты и места рождения'
    content = `
      <div class="form-group">
        <label>Дата рождения</label>
        <input type="date" id="editBirthDate" class="form-input" value="${userData.dateOfBirth || ''}" required>
      </div>
      <div class="form-group">
        <label>Место рождения</label>
        <input type="text" id="editBirthPlace" class="form-input" value="${userData.placeOfBirth || ''}" required>
      </div>
    `
  } else if (type === 'contact') {
    title = 'Изменение контактной информации'
    content = `
      <div class="form-group">
        <label>Телефон</label>
        <input type="tel" id="editPhone" class="form-input" value="${userData.phone || ''}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="editEmail" class="form-input" value="${userData.email || ''}" required>
      </div>
    `
  }

  document.getElementById('modalTitle').textContent = title
  document.getElementById('modalBody').innerHTML = content

  const modal = document.getElementById('modal')
  modal.style.display = 'flex'
  setTimeout(() => modal.classList.add('active'), 10)
}

// --- Закрытие модального окна ---
window.closeModal = function() {
  const modal = document.getElementById('modal')
  modal.classList.remove('active')
  setTimeout(() => {
    modal.style.display = 'none'
    currentEditType = null
  }, 300)
}

// --- Сохранение изменений ---
async function saveChanges() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Нет активной сессии')

    const userId = session.user.id
    let updates = {}
    let statusUpdates = {}

    if (currentEditType === 'fio') {
      updates = {
        surname: document.getElementById('editSurname').value.trim(),
        name: document.getElementById('editName').value.trim(),
        patronymic: document.getElementById('editPatronymic').value.trim()
      }
      statusUpdates = {
        surname_status: 'oncheck',
        name_status: 'oncheck',
        patronymic_status: 'oncheck'
      }
    } else if (currentEditType === 'birth') {
      updates = {
        date_of_birth: document.getElementById('editBirthDate').value,
        place_of_birth: document.getElementById('editBirthPlace').value.trim()
      }
      statusUpdates = {
        date_of_birth_status: 'oncheck',
        place_of_birth_status: 'oncheck'
      }
    } else if (currentEditType === 'contact') {
      updates = {
        phone: document.getElementById('editPhone').value.trim(),
        email: document.getElementById('editEmail').value.trim()
      }
      // Статусы телефона и email обычно остаются verified,
      // но если хотим отправлять на проверку — раскомментировать:
      // statusUpdates = {
      //   phone_status: 'oncheck',
      //   email_status: 'oncheck'
      // }
    }

    // Объединяем обновления полей и статусов
    const finalUpdates = { ...updates, ...statusUpdates }

    // Отправляем запрос на обновление
    const { error } = await supabase
      .from('users')
      .update(finalUpdates)
      .eq('id', userId)

    if (error) throw error

    // Обновляем локальный объект userData
    Object.assign(userData, toCamelCase(updates))
    Object.assign(userData, toCamelCase(statusUpdates))

    // Перерисовываем данные
    renderData()

    // Показываем сообщение об успехе
    if (currentEditType === 'contact') {
      showModalMessage('Контактная информация успешно обновлена', true)
    } else {
      showModalMessage('Изменения отправлены на проверку администратору. Это может занять до 24 часов.', true)
    }
  } catch (error) {
    console.error('Ошибка сохранения:', error)
    showModalMessage('Ошибка при сохранении данных', false)
  }
}

// --- Вывод сообщения в модальном окне ---
function showModalMessage(message, success) {
  const modalBody = document.getElementById('modalBody')
  const modalFooter = document.querySelector('.modal-footer')

  modalBody.innerHTML = `<div class="alert alert-${success ? 'success' : 'error'}">${message}</div>`
  modalFooter.style.display = 'none'

  setTimeout(() => {
    modalFooter.style.display = 'flex'
    closeModal()
  }, 4000)
}

// --- Назначение обработчиков после загрузки DOM ---
document.addEventListener('DOMContentLoaded', () => {
  // Загружаем данные
  loadUserData()

  // Обработчик кнопки сохранения в модалке
  document.getElementById('saveBtn').addEventListener('click', saveChanges)

  // Закрытие модалки по клику на оверлей
  const modal = document.getElementById('modal')
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })

  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal()
  })
})

// Экспортируем функции в глобальную область (для inline-обработчиков onclick)
window.openEditModal = openEditModal
window.closeModal = closeModal