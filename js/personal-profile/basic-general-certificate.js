import { supabase } from '../../js/supabase-config.js'

let currentDocId = null
let documentData = {}
let userPersonalCode = null
let userProfile = null
let userId = null

// Начальные данные формы
let formData = {
  full_name: '',
  issued_by: '',
  director: '',
  document_number: '',
  subjects: [], // массив объектов { name, grade }
  status: 'oncheck'
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function formatDate(dateString) {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU')
  } catch {
    return dateString
  }
}

function getStatusLabel(status) {
  if (status === 'verified') return '✅ Подтверждено'
  if (status === 'oncheck') return '⏳ На проверке'
  if (status === 'rejected') return '❌ Отклонено'
  if (status === 'archived') return '📦 Архивный'
  return '—'
}

function getStatusClass(status) {
  if (status === 'verified') return 'document-status status-verified'
  if (status === 'oncheck') return 'document-status status-pending'
  if (status === 'rejected') return 'document-status status-rejected'
  if (status === 'archived') return 'document-status status-archived'
  return 'document-status'
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
      .select('personal_code, surname, name, patronymic')
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
        .from('documents_education')
        .select('*')
        .eq('id', idFromUrl)
        .maybeSingle()
      if (!error && doc) data = doc
    } else {
      // Если ID нет, ищем последний документ типа 'basic_general' для пользователя
      const { data: docs, error } = await supabase
        .from('documents_education')
        .select('*')
        .eq('personal_code', userPersonalCode)
        .eq('type', 'basic_general')
        .order('created_at', { ascending: false })
        .limit(1)
      if (!error && docs && docs.length > 0) {
        data = docs[0]
      }
    }

    const loadingEl = document.getElementById('loading')
    const contentEl = document.getElementById('content')
    const noDataEl = document.getElementById('noData')

    if (data) {
      documentData = data
      currentDocId = data.id
      renderCertificate(data)
      loadingEl.style.display = 'none'
      contentEl.style.display = 'block'
      noDataEl.style.display = 'none'
    } else {
      loadingEl.style.display = 'none'
      contentEl.style.display = 'none'
      noDataEl.style.display = 'block'
    }
  } catch (err) {
    console.error('Необработанная ошибка в loadData:', err)
    document.getElementById('loading').textContent = 'Произошла критическая ошибка'
  }
}

// ==================== ОТРИСОВКА ДОКУМЕНТА ====================
function renderCertificate(data) {
  // Получаем ФИО (можно из data.full_name, если есть, или из профиля)
  const fullName = data.full_name || `${userProfile?.surname || ''} ${userProfile?.name || ''} ${userProfile?.patronymic || ''}`.trim() || '—'

  // Формируем HTML для предметов
  let subjectsHtml = ''
  if (data.subjects && Array.isArray(data.subjects) && data.subjects.length > 0) {
    subjectsHtml = '<table class="subjects-table"><thead><tr><th>Предмет</th><th>Оценка</th></tr></thead><tbody>'
    data.subjects.forEach(subj => {
      subjectsHtml += `<tr><td>${escapeHTML(subj.name || '')}</td><td>${escapeHTML(subj.grade || '')}</td></tr>`
    })
    subjectsHtml += '</tbody></table>'
  } else {
    subjectsHtml = '<p>Нет данных о предметах</p>'
  }

  const html = `
    <div class="certificate-header">
      <div class="title">АТТЕСТАТ</div>
      <div class="subtitle">ОБ ОСНОВНОМ ОБЩЕМ ОБРАЗОВАНИИ</div>
    </div>
    
    <div class="certificate-content">
      <div class="field-block">
        <div class="field-label">ФИО</div>
        <div class="field-value">${escapeHTML(fullName)}</div>
        <div class="field-line"></div>
      </div>
      
      <div class="field-block">
        <div class="field-label">Кем выдан</div>
        <div class="field-value">${escapeHTML(data.issued_by || '—')}</div>
        <div class="field-line"></div>
      </div>
      
      <div class="field-block">
        <div class="field-label">Директор</div>
        <div class="field-value">${escapeHTML(data.director || '—')}</div>
        <div class="field-line"></div>
      </div>
      
      <div class="field-block">
        <div class="field-label">Номер документа</div>
        <div class="field-value">${escapeHTML(data.document_number || '—')}</div>
        <div class="field-line"></div>
      </div>
      
      <div class="field-block">
        <div class="field-label">Предметы и оценки</div>
        <div class="field-value">${subjectsHtml}</div>
      </div>
    </div>
  `

  document.getElementById('certificateContainer').innerHTML = html

  // Блок статуса и кнопок
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)
  
  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'
  
  const statusSpan = document.createElement('span')
  statusSpan.className = statusClass
  statusSpan.textContent = statusText
  statusAndEdit.appendChild(statusSpan)
  
  const replaceLink = document.createElement('a')
  replaceLink.href = '../../services/documents/education/basic-general/'
  replaceLink.className = 'edit-btn'
  replaceLink.textContent = 'Заменить аттестат'
  statusAndEdit.appendChild(replaceLink)
  
  if (data.status !== 'verified') {
    const editBtn = document.createElement('button')
    editBtn.className = 'edit-btn'
    editBtn.id = 'editBtn'
    editBtn.textContent = 'Изменить данные'
    editBtn.addEventListener('click', () => {
      formData = { ...data }
      // Преобразуем subjects в массив, если это JSON строка
      if (typeof formData.subjects === 'string') {
        try {
          formData.subjects = JSON.parse(formData.subjects)
        } catch {
          formData.subjects = []
        }
      }
      openEditModal()
    })
    statusAndEdit.appendChild(editBtn)
  }
  
  document.getElementById('statusAndEditContainer').appendChild(statusAndEdit)
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
window.closeModal = function() {
  document.getElementById('modalOverlay').classList.remove('active')
}

function openModal(title) {
  document.getElementById('modalTitle').textContent = title
  document.getElementById('modalOverlay').classList.add('active')
  renderModalForm()
}

function renderModalForm() {
  const modalBody = document.getElementById('modalBody')
  if (!modalBody) return

  // Подготовим subjects
  const subjects = formData.subjects || []
  let subjectsRows = ''
  subjects.forEach((subj, index) => {
    subjectsRows += `
      <tr>
        <td><input type="text" class="form-input subject-name" data-index="${index}" value="${escapeHTML(subj.name || '')}" placeholder="Предмет"></td>
        <td><input type="text" class="form-input subject-grade" data-index="${index}" value="${escapeHTML(subj.grade || '')}" placeholder="Оценка"></td>
        <td><button type="button" class="remove-subject" data-index="${index}">✖</button></td>
      </tr>
    `
  })

  modalBody.innerHTML = `
    <h4>Основная информация</h4>
    <div class="form-group">
      <label>ФИО владельца</label>
      <input type="text" id="edit_full_name" class="form-input" value="${escapeHTML(formData.full_name || userProfile ? `${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}`.trim() : '')}">
    </div>
    <div class="form-group">
      <label>Кем выдан (организация)</label>
      <input type="text" id="edit_issued_by" class="form-input" value="${escapeHTML(formData.issued_by || '')}">
    </div>
    <div class="form-group">
      <label>Директор</label>
      <input type="text" id="edit_director" class="form-input" value="${escapeHTML(formData.director || '')}">
    </div>
    <div class="form-group">
      <label>Номер документа</label>
      <input type="text" id="edit_document_number" class="form-input" value="${escapeHTML(formData.document_number || '')}">
    </div>

    <h4>Предметы и оценки</h4>
    <table class="subjects-table" id="subjectsTable">
      <thead>
        <tr><th>Предмет</th><th>Оценка</th><th></th></tr>
      </thead>
      <tbody id="subjectsBody">
        ${subjectsRows}
      </tbody>
    </table>
    <button type="button" id="addSubjectBtn" class="edit-btn">+ Добавить предмет</button>
  `

  // Добавляем обработчик для кнопки добавления предмета
  document.getElementById('addSubjectBtn').addEventListener('click', () => {
    const tbody = document.getElementById('subjectsBody')
    const newIndex = subjects.length
    const row = document.createElement('tr')
    row.innerHTML = `
      <td><input type="text" class="form-input subject-name" data-index="${newIndex}" placeholder="Предмет"></td>
      <td><input type="text" class="form-input subject-grade" data-index="${newIndex}" placeholder="Оценка"></td>
      <td><button type="button" class="remove-subject" data-index="${newIndex}">✖</button></td>
    `
    tbody.appendChild(row)
    subjects.push({ name: '', grade: '' }) // расширяем массив
    attachRemoveHandlers()
  })

  // Обработчики удаления
  function attachRemoveHandlers() {
    document.querySelectorAll('.remove-subject').forEach(btn => {
      btn.removeEventListener('click', removeHandler)
      btn.addEventListener('click', removeHandler)
    })
  }

  function removeHandler(e) {
    const index = e.target.getAttribute('data-index')
    if (index !== null) {
      subjects.splice(index, 1)
      // Перерендерим форму, чтобы обновить индексы
      renderModalForm()
    }
  }

  attachRemoveHandlers()
}

function collectFormData() {
  const getVal = (id) => (document.getElementById(id)?.value || '').trim()

  // Собираем предметы
  const subjectNames = document.querySelectorAll('.subject-name')
  const subjectGrades = document.querySelectorAll('.subject-grade')
  const subjects = []
  for (let i = 0; i < subjectNames.length; i++) {
    const name = subjectNames[i].value.trim()
    const grade = subjectGrades[i].value.trim()
    if (name || grade) { // добавляем, если хоть что-то заполнено
      subjects.push({ name, grade })
    }
  }

  return {
    full_name: getVal('edit_full_name'),
    issued_by: getVal('edit_issued_by'),
    director: getVal('edit_director'),
    document_number: getVal('edit_document_number'),
    subjects: subjects
  }
}

async function saveDocument() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { alert('Ошибка авторизации'); return }
    if (!userPersonalCode) { alert('Личный код не загружен'); return }

    const newData = collectFormData()
    
    if (!newData.document_number) {
      alert('Номер документа обязателен')
      return
    }

    const cleanData = { ...newData }
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === null || cleanData[key] === undefined) delete cleanData[key]
    })

    const dataToSend = {
      ...cleanData,
      personal_code: userPersonalCode,
      type: 'basic_general', // фиксированный тип для этой страницы
      status: 'oncheck',
      updated_at: new Date().toISOString()
    }

    let result
    if (currentDocId) {
      result = await supabase
        .from('documents_education')
        .update(dataToSend)
        .eq('id', currentDocId)
        .select()
    } else {
      dataToSend.created_at = new Date().toISOString()
      dataToSend.user_id = userId
      result = await supabase
        .from('documents_education')
        .insert([dataToSend])
        .select()
    }

    if (result.error) throw result.error

    window.closeModal()
    const newId = currentDocId || result.data[0].id
    window.location.href = `basic-general-certificate.html?id=${newId}`
  } catch (err) {
    console.error('Ошибка сохранения:', err)
    alert('Ошибка сохранения: ' + err.message)
  }
}

// ==================== ОТКРЫТИЕ МОДАЛОК ====================
function openAddModal() {
  formData = {
    full_name: userProfile ? `${userProfile.surname} ${userProfile.name} ${userProfile.patronymic}`.trim() : '',
    issued_by: '',
    director: '',
    document_number: '',
    subjects: [],
    status: 'oncheck'
  }
  openModal('Добавление аттестата об основном общем образовании')
}

function openEditModal() {
  // formData уже установлен перед вызовом
  openModal('Редактирование аттестата об основном общем образовании')
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData()
  document.getElementById('addBtn')?.addEventListener('click', openAddModal)
  document.getElementById('saveBtn')?.addEventListener('click', saveDocument)
})

// Экспорт в глобальную область
window.openAddModal = openAddModal
window.openEditModal = openEditModal
window.closeModal = closeModal