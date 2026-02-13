  import { supabase } from '../../js/supabase-config.js'

  // --- Глобальные переменные ---
  let currentDocId = null
  let documentData = {}
  let userPersonalCode = null
  let userProfile = null
  let formData = {}

  // --- Вспомогательные функции ---
  function formatDate(dateString) {
    if (!dateString) return '—'
    try {
      return new Date(dateString).toLocaleDateString('ru-RU')
    } catch {
      return dateString
    }
  }

  function getStatusLabel(status) {
    if (status === 'verified') return '✅ Подтверждено'
    if (status === 'oncheck') return '⏳ На проверке'
    if (status === 'rejected') return '❌ Отклонено'
    return '—'
  }

  function escapeHTML(str) {
    if (!str) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  // --- Загрузка данных ---
  async function loadData() {
    try {
      // 1. Проверяем сессию
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        window.location.href = '../../login.html'
        return
      }

      // 2. Загружаем профиль пользователя
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        console.error('Ошибка загрузки профиля:', profileError)
        document.getElementById('loading').textContent = 'Ошибка загрузки профиля'
        return
      }

      userProfile = profile
      userPersonalCode = profile.personal_code
      console.log('Профиль пользователя:', userProfile)

      // 3. Определяем, какой документ загружать (по ID из URL или последний)
      const urlParams = new URLSearchParams(window.location.search)
      const idFromUrl = urlParams.get('id')

      let documentResult = null

      if (idFromUrl) {
        // Загружаем конкретный документ
        const { data, error } = await supabase
          .from('documents_nss')
          .select('*')
          .eq('id', idFromUrl)
          .single()

        if (error) {
          console.error('Ошибка загрузки документа по ID:', error)
        } else {
          documentResult = { data, error: null }
        }
      } else {
        // Загружаем последний документ пользователя
        const { data, error } = await supabase
          .from('documents_nss')
          .select('*')
          .eq('personal_code', userPersonalCode)
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) {
          console.error('Ошибка загрузки последнего документа:', error)
        } else if (data && data.length > 0) {
          documentResult = { data: data[0], error: null }
        }
      }

      // 4. Обрабатываем результат загрузки документа
      const loadingEl = document.getElementById('loading')
      const contentEl = document.getElementById('content')
      const noDataEl = document.getElementById('noData')

      if (documentResult && documentResult.data) {
        documentData = documentResult.data
        currentDocId = documentData.id
        console.log('Загружен документ:', documentData)

        renderDocument(documentData)
        loadingEl.style.display = 'none'
        contentEl.style.display = 'block'
        noDataEl.style.display = 'none'
      } else {
        // Нет документа
        loadingEl.style.display = 'none'
        contentEl.style.display = 'none'
        noDataEl.style.display = 'block'
      }
    } catch (err) {
      console.error('Необработанная ошибка в loadData:', err)
      document.getElementById('loading').textContent = 'Произошла критическая ошибка'
    }
  }

  // --- Отрисовка документа ---
  function renderDocument(data) {
    document.getElementById('nssNumber').textContent = data.nss_number || '—'
    document.getElementById('surname').textContent = data.surname || '—'
    document.getElementById('name').textContent = data.name || '—'
    document.getElementById('patronymic').textContent = data.patronymic || '—'
    document.getElementById('gender').textContent = data.gender || '—'
    document.getElementById('birthDate').textContent = formatDate(data.birth_date)
    document.getElementById('birthPlace').textContent = data.birth_place || '—'
    document.getElementById('issueDate').textContent = formatDate(data.issue_date)
    document.getElementById('issuedBy').textContent = data.issued_by || '—'

    // QR-код
    const qrContainer = document.getElementById('qrCode')
    qrContainer.innerHTML = ''
    if (data.nss_number) {
      new QRCode(qrContainer, {
        text: data.nss_number,
        width: 180,
        height: 180,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L
      })
    }

    const statusBadge = document.getElementById('statusBadge')
    const status = data.status || 'oncheck'
    statusBadge.className = `document-status status-${status}`
    statusBadge.textContent = getStatusLabel(status)
    statusBadge.style.display = 'inline-block'
  }

  // --- Модальное окно ---
  function openModal(title) {
    document.getElementById('modalTitle').textContent = title
    document.getElementById('modalOverlay').classList.add('active')
    renderModalForm()
  }

  window.closeModal = function() {
    document.getElementById('modalOverlay').classList.remove('active')
  }

  function renderModalForm() {
    const modalBody = document.getElementById('modalBody')
    modalBody.innerHTML = `
      <div class="form-group">
        <label>Номер НСС</label>
        <input type="text" id="nss_number" class="form-input" value="${escapeHTML(formData.nss_number || '')}">
      </div>
      <div class="form-group">
        <label>Фамилия</label>
        <input type="text" id="surname" class="form-input" value="${escapeHTML(formData.surname || '')}">
      </div>
      <div class="form-group">
        <label>Имя</label>
        <input type="text" id="name" class="form-input" value="${escapeHTML(formData.name || '')}">
      </div>
      <div class="form-group">
        <label>Отчество</label>
        <input type="text" id="patronymic" class="form-input" value="${escapeHTML(formData.patronymic || '')}">
      </div>
      <div class="form-group">
        <label>Пол</label>
        <input type="text" id="gender" class="form-input" value="${escapeHTML(formData.gender || '')}" placeholder="Мужской / Женский">
      </div>
      <div class="form-group">
        <label>Дата рождения</label>
        <input type="date" id="birth_date" class="form-input" value="${formData.birth_date || ''}">
      </div>
      <div class="form-group">
        <label>Место рождения</label>
        <input type="text" id="birth_place" class="form-input" value="${escapeHTML(formData.birth_place || '')}">
      </div>
      <div class="form-group">
        <label>Дата выдачи</label>
        <input type="date" id="issue_date" class="form-input" value="${formData.issue_date || ''}">
      </div>
      <div class="form-group">
        <label>Кем выдан</label>
        <input type="text" id="issued_by" class="form-input" value="${escapeHTML(formData.issued_by || '')}">
      </div>
      <div class="form-group">
        <label>Личный код</label>
        <input type="text" id="personal_code_ref" class="form-input" value="${userPersonalCode || ''}" readonly>
      </div>
    `
  }

  // --- Открытие модалки для добавления ---
  function openAddModal() {
    formData = {
      nss_number: '',
      surname: userProfile?.surname || '',
      name: userProfile?.name || '',
      patronymic: userProfile?.patronymic || '',
      gender: userProfile?.gender || '',
      birth_date: userProfile?.date_of_birth || '',
      birth_place: userProfile?.place_of_birth || '',
      issue_date: '',
      issued_by: '',
      personal_code_ref: userPersonalCode || ''
    }
    console.log('Добавление: начальные данные формы', formData)
    openModal('Добавление НСС')
  }

  // --- Открытие модалки для редактирования ---
  function openEditModal() {
    formData = {
      nss_number: documentData.nss_number || '',
      surname: documentData.surname || userProfile?.surname || '',
      name: documentData.name || userProfile?.name || '',
      patronymic: documentData.patronymic || userProfile?.patronymic || '',
      gender: documentData.gender || userProfile?.gender || '',
      birth_date: documentData.birth_date || userProfile?.date_of_birth || '',
      birth_place: documentData.birth_place || userProfile?.place_of_birth || '',
      issue_date: documentData.issue_date || '',
      issued_by: documentData.issued_by || '',
      personal_code_ref: documentData.personal_code_ref || userPersonalCode || ''
    }
    console.log('Редактирование: начальные данные формы', formData)
    openModal('Редактирование НСС')
  }

  // --- Сохранение ---
  async function saveDocument() {
    // Собираем данные из формы
    const getVal = (id) => {
      const el = document.getElementById(id)
      return el ? (el.value?.trim() ?? '') : ''
    }

    const formDataToSend = {
      nss_number: getVal('nss_number'),
      surname: getVal('surname'),
      name: getVal('name'),
      patronymic: getVal('patronymic'),
      gender: getVal('gender'),
      birth_date: getVal('birth_date') || null,  // если пусто, ставим null
      birth_place: getVal('birth_place'),
      issue_date: getVal('issue_date') || null,
      issued_by: getVal('issued_by'),
      personal_code_ref: getVal('personal_code_ref') || userPersonalCode,
      personal_code: userPersonalCode,
      status: 'oncheck',
      updated_at: new Date().toISOString()
    }

    // Проверка обязательного поля
    if (!formDataToSend.nss_number) {
      alert('Номер НСС обязателен для заполнения')
      return
    }

    console.log('Сохранение: отправляемые данные', formDataToSend)

    let result
    if (currentDocId) {
      // Обновление существующего документа
      result = await supabase
        .from('documents_nss')
        .update(formDataToSend)
        .eq('id', currentDocId)
        .select() // возвращаем обновлённую запись
    } else {
      // Вставка нового документа
      formDataToSend.created_at = new Date().toISOString()
      result = await supabase
        .from('documents_nss')
        .insert([formDataToSend])
        .select() // возвращаем вставленную запись
    }

    if (result.error) {
      console.error('Ошибка сохранения:', result.error)
      alert('Ошибка сохранения: ' + result.error.message)
      return
    }

    console.log('Сохранение успешно, ответ:', result)

    // Закрываем модалку
    closeModal()

  // --- Инициализация ---
  document.addEventListener('DOMContentLoaded', async () => {
    await loadData()

    // Назначаем обработчики
    document.getElementById('addBtn')?.addEventListener('click', openAddModal)
    document.getElementById('editBtn')?.addEventListener('click', openEditModal)
    document.getElementById('modalSaveBtn')?.addEventListener('click', saveDocument)
  })

  // Делаем функции доступными глобально (для onclick в HTML)
  window.closeModal = closeModal
  window.openAddModal = openAddModal
  window.openEditModal = openEditModal