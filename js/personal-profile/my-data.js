// js/personal-profile/my-data.js
import { supabase } from '../supabase-config.js'

let userData = {}          // данные пользователя (camelCase)
let currentEditType = null // тип редактируемого блока ('fio' или 'birth')

function toCamelCase(obj) {
  if (!obj) return {}
  const newObj = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    newObj[camelKey] = value
  }
  return newObj
}

function toSnakeCase(obj) {
  if (!obj) return {}
  const newObj = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    newObj[snakeKey] = value
  }
  return newObj
}

async function loadUserData() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    if (!session) {
      window.location.href = '../login.html'
      return
    }

    const userId = session.user.id

    const { data: userRaw, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError) throw userError
    if (!userRaw) throw new Error('Пользователь не найден')

    userData = toCamelCase(userRaw)

    document.getElementById('loading').style.display = 'none'
    document.getElementById('dataBlocks').style.display = 'block'
    renderData()
  } catch (error) {
    console.error('Ошибка загрузки данных:', error)
    document.getElementById('loading').textContent = 'Ошибка загрузки. Перезагрузите страницу.'
  }
}

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

  // Личный код
  document.getElementById('personalCodeValue').textContent = userData.personalCode || '—'
}

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
  }

  document.getElementById('modalTitle').textContent = title
  document.getElementById('modalBody').innerHTML = content

  const modal = document.getElementById('modal')
  modal.style.display = 'flex'
  setTimeout(() => modal.classList.add('active'), 10)
}

window.closeModal = function() {
  const modal = document.getElementById('modal')
  modal.classList.remove('active')
  setTimeout(() => {
    modal.style.display = 'none'
    currentEditType = null
  }, 300)
}

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
    }

    const finalUpdates = { ...updates, ...statusUpdates }

    const { error } = await supabase
      .from('users')
      .update(finalUpdates)
      .eq('id', userId)

    if (error) throw error

    Object.assign(userData, toCamelCase(updates))
    Object.assign(userData, toCamelCase(statusUpdates))
    renderData()

    showModalMessage('Изменения отправлены на проверку администратору. Это может занять до 24 часов.', true)
  } catch (error) {
    console.error('Ошибка сохранения:', error)
    showModalMessage('Ошибка при сохранении данных', false)
  }
}

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

document.addEventListener('DOMContentLoaded', () => {
  loadUserData()
  document.getElementById('saveBtn').addEventListener('click', saveChanges)

  const modal = document.getElementById('modal')
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal()
  })
})

window.openEditModal = openEditModal
window.closeModal = closeModal