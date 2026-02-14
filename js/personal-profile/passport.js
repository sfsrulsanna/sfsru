	{
      "imports": {
        "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
      }
    }
  </script>
  <!-- ========== ПОЛНЫЙ JS КОД ========== -->
  <script type="module">
    import { supabase } from '../../js/supabase-config.js'

    // -------------------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ --------------------
    let currentStep = 1
    const totalSteps = 7
    let formData = {}               // данные формы модалки
    let userPersonalCode = null    // личный код текущего пользователя
    let currentDocId = null        // ID текущего документа (если есть)
    let userProfile = null        // профиль пользователя из таблицы users

    // -------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ --------------------
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

    // -------------------- ЗАГРУЗКА ПРОФИЛЯ --------------------
    async function loadUserProfile() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        window.location.href = '../../login.html'
        return null
      }

      const { data, error } = await supabase
        .from('users')
        .select('personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender')
        .eq('id', session.user.id)
        .single()

      if (error) {
        console.error('Ошибка загрузки профиля:', error)
        // Показываем сообщение на странице
        const loadingEl = document.getElementById('loading')
        if (loadingEl) loadingEl.textContent = 'Ошибка загрузки профиля. Перезагрузите страницу.'
        return null
      }

      userPersonalCode = data.personal_code
      userProfile = data
      return data
    }

    // -------------------- ЗАГРУЗКА ПАСПОРТА --------------------
    async function loadPassport() {
      try {
        const profile = await loadUserProfile()
        if (!profile) return   // профиль не загрузился – дальше не идём

        const urlParams = new URLSearchParams(window.location.search)
        currentDocId = urlParams.get('id')

        let data = null
        if (currentDocId) {
          const { data: doc, error } = await supabase
            .from('document_passport')
            .select('*')
            .eq('id', currentDocId)
            .single()
          if (error) throw error
          data = doc
        } else {
          // Ищем последний паспорт по personal_code
          const { data: docs, error } = await supabase
            .from('document_passport')
            .select('*')
            .eq('personal_code', userPersonalCode)
            .order('created_at', { ascending: false })
            .limit(1)
          if (error) throw error
          data = docs?.[0]
          if (data) currentDocId = data.id
        }

        if (data) {
          renderPassport(data)
        } else {
          document.getElementById('loading').style.display = 'none'
          document.getElementById('noData').style.display = 'block'
        }
      } catch (err) {
        console.error('Ошибка загрузки паспорта:', err)
        const loadingEl = document.getElementById('loading')
        if (loadingEl) loadingEl.textContent = 'Ошибка загрузки данных'
      }
    }

// -------------------- ОТРИСОВКА ПАСПОРТА (ПОЛНАЯ ВЕРСИЯ) --------------------
function renderPassport(data) {
  const statusText = getStatusLabel(data.status)
  const statusClass = getStatusClass(data.status)

  // Устанавливаем цвет обложки (по умолчанию бордовый)
  document.documentElement.style.setProperty('--primary-red', '#7b091a')

  // Основной блок паспорта
  const html = `
    <div class="passport-template">
      <div class="passport-header">
        <div class="country-name">СФСР ЮЛЬСАННА</div>
        <div class="document-type">ПАСПОРТ</div>
      </div>
      <div class="passport-content">
        <!-- Серия и номер -->
        <div class="data-field">
          <div class="field-label">Серия и номер</div>
          <div class="field-value series-number">${escapeHTML(data.series_number || '—')}</div>
        </div>
        <!-- Дата выдачи -->
        <div class="data-field">
          <div class="field-label">Дата выдачи</div>
          <div class="field-value">${formatDate(data.issue_date)}</div>
        </div>
        <!-- Срок действия -->
        <div class="data-field">
          <div class="field-label">Срок действия</div>
          <div class="field-value">${formatDate(data.expiry_date)}</div>
        </div>
        <!-- Кем выдан -->
        <div class="data-field">
          <div class="field-label">Кем выдан</div>
          <div class="field-value">${escapeHTML(data.issued_by || '—')}</div>
        </div>
        <!-- Код подразделения -->
        <div class="data-field">
          <div class="field-label">Код подразделения</div>
          <div class="field-value">${escapeHTML(data.department_code || '—')}</div>
        </div>
        <!-- Личный код -->
        <div class="data-field">
          <div class="field-label">Личный код</div>
          <div class="field-value">${escapeHTML(data.personal_code || '—')}</div>
        </div>

        <div class="passport-divider"></div>

        <!-- Нижняя часть с фото, подписью, штрих-кодом, QR и данными -->
        <div class="passport-lower">
          <div class="photo-barcode-section">
            <div class="passport-photo-container">
              <img id="passportAvatar" src="../../images/default-avatar.png" alt="Фото" class="passport-photo" />
            </div>
            <div class="barcode-container">
              <svg id="passportBarcode" class="barcode"></svg>
            </div>
            <div style="text-align: center; margin-top: 15px;">
              <div id="passportQrCode" style="display: inline-block; width: 80px; height: 80px;"></div>
            </div>
          </div>

          <div class="fio-section">
            <!-- Фамилия -->
            <div class="data-field">
              <div class="field-label">Фамилия</div>
              <div class="field-value">${escapeHTML(data.surname || '—')}</div>
            </div>
            <!-- Имя -->
            <div class="data-field">
              <div class="field-label">Имя</div>
              <div class="field-value">${escapeHTML(data.name || '—')}</div>
            </div>
            <!-- Отчество -->
            <div class="data-field">
              <div class="field-label">Отчество</div>
              <div class="field-value">${escapeHTML(data.patronymic || '—')}</div>
            </div>
            <!-- Пол -->
            <div class="data-field">
              <div class="field-label">Пол</div>
              <div class="field-value">${escapeHTML(data.gender || '—')}</div>
            </div>
            <!-- Дата рождения -->
            <div class="data-field">
              <div class="field-label">Дата рождения</div>
              <div class="field-value">${formatDate(data.birth_date)}</div>
            </div>
            <!-- Место рождения -->
            <div class="data-field">
              <div class="field-label">Место рождения</div>
              <div class="field-value">${escapeHTML(data.birth_place || '—')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  document.getElementById('passportContent').innerHTML = html
  document.getElementById('passportContent').style.display = 'block'

  // --- Дополнительные секции (история регистрации, семейное положение, воинская обязанность и т.д.) ---
  let extraHtml = ''

  // Места регистрации
  if (data.residences && Array.isArray(data.residences) && data.residences.length > 0) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-home"></i> История регистрации</h3>
      <div class="info-table">
        <table>
          <thead>
            <tr>
              <th>Адрес</th>
              <th>Дата регистрации</th>
              <th>Дата снятия</th>
              <th>Тип жилья</th>
            </tr>
          </thead>
          <tbody>
            ${data.residences.map(r => `
              <tr>
                <td>${escapeHTML(r.address || '—')}</td>
                <td>${formatDate(r.registrationDate)}</td>
                <td>${formatDate(r.deregistrationDate)}</td>
                <td>${escapeHTML(r.housingType || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  // Семейное положение
  if (data.marital_statuses && Array.isArray(data.marital_statuses) && data.marital_statuses.length > 0) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-heart"></i> Семейное положение</h3>
      <div class="info-table">
        <table>
          <thead>
            <tr>
              <th>Статус</th>
              <th>Дата изменения</th>
              <th>ФИО супруга</th>
              <th>Номер акта</th>
            </tr>
          </thead>
          <tbody>
            ${data.marital_statuses.map(m => `
              <tr>
                <td>${escapeHTML(m.status || '—')}</td>
                <td>${formatDate(m.changeDate)}</td>
                <td>${escapeHTML(m.spouseName || '—')}</td>
                <td>${escapeHTML(m.actNumber || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  // Воинская обязанность
  if (data.is_military_obligated !== null && data.is_military_obligated !== undefined) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-shield-alt"></i> Военная обязанность</h3>
      <div class="info-table">
        <table>
          <thead>
            <tr>
              <th>Военнообязанный</th>
              <th>Военный билет</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${data.is_military_obligated ? 'Да' : 'Нет'}</td>
              <td>${escapeHTML(data.military_idn || '—')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  }

  // Ранее выданные паспорта
  if (data.previous_passports && Array.isArray(data.previous_passports) && data.previous_passports.length > 0) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-history"></i> Ранее выданные паспорта</h3>
      <div class="info-table">
        <table>
          <thead>
            <tr>
              <th>Серия и номер</th>
              <th>Дата выдачи</th>
              <th>Кем выдан</th>
              <th>Причина замены</th>
            </tr>
          </thead>
          <tbody>
            ${data.previous_passports.map(p => `
              <tr>
                <td>${escapeHTML(p.seriesNumber || '—')}</td>
                <td>${formatDate(p.issueDate)}</td>
                <td>${escapeHTML(p.issuedBy || '—')}</td>
                <td>${escapeHTML(p.reason || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  // Ранее выданные заграничные паспорта
  if (data.previous_foreign_passports && Array.isArray(data.previous_foreign_passports) && data.previous_foreign_passports.length > 0) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-passport"></i> Ранее выданные заграничные паспорта</h3>
      <div class="info-table">
        <table>
          <thead>
            <tr>
              <th>Серия и номер</th>
              <th>Дата выдачи</th>
              <th>Кем выдан</th>
            </tr>
          </thead>
          <tbody>
            ${data.previous_foreign_passports.map(p => `
              <tr>
                <td>${escapeHTML(p.seriesNumber || '—')}</td>
                <td>${formatDate(p.issueDate)}</td>
                <td>${escapeHTML(p.issuedBy || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  // Ранее выданные ID-карты
  if (data.previous_id_cards && Array.isArray(data.previous_id_cards) && data.previous_id_cards.length > 0) {
    extraHtml += `
      <h3 class="section-title"><i class="fas fa-id-card"></i> Ранее выданные ID-карты</h3>
      <div class="info-table">
        <table>
          <thead>
            <tr>
              <th>Серия и номер</th>
              <th>Дата выдачи</th>
              <th>Кем выдан</th>
            </tr>
          </thead>
          <tbody>
            ${data.previous_id_cards.map(p => `
              <tr>
                <td>${escapeHTML(p.seriesNumber || '—')}</td>
                <td>${formatDate(p.issueDate)}</td>
                <td>${escapeHTML(p.issuedBy || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  if (extraHtml) {
    document.getElementById('extraSections').innerHTML = extraHtml
    document.getElementById('extraSections').style.display = 'block'
  }

  // --- Фото, QR, штрихкод, подпись ---
  const personalCode = data.personal_code || ''
  const avatarImg = document.getElementById('passportAvatar')
  if (personalCode) {
    const safeCode = personalCode.replace(/[^a-zA-Z0-9\-]/g, '')
    const imgUrl = `../../images/avatars/${safeCode}.jpg`
    const img = new Image()
    img.onload = () => { avatarImg.src = imgUrl }
    img.onerror = () => { avatarImg.src = '../../images/default-avatar.png' }
    img.src = imgUrl
  }

  const qrContainer = document.getElementById('passportQrCode')
  if (qrContainer && personalCode) {
    qrContainer.innerHTML = ''
    try {
      new QRCode(qrContainer, {
        text: `https://e-pass-sfsru.web.app/${personalCode}/`,
        width: 80,
        height: 80,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L
      })
    } catch (e) {
      console.warn('QR generation failed', e)
    }
  }

  const seriesNumber = (data.series_number || '').replace(/\s/g, '')
  if (seriesNumber && seriesNumber.length >= 6) {
    try {
      JsBarcode("#passportBarcode", seriesNumber, {
        format: "CODE128",
        displayValue: false,
        height: 50,
        margin: 0
      })
    } catch (e) {
      console.warn('Barcode generation failed', e)
    }
  }

  // --- Кнопка редактирования и статус ---
  const statusAndEdit = document.createElement('div')
  statusAndEdit.className = 'status-and-edit'
  statusAndEdit.innerHTML = `
    <span class="${statusClass}">${statusText}</span>
    <button class="edit-btn" id="editPassportBtn">Изменить данные</button>
  `
  document.getElementById('passportContent').parentNode.insertBefore(statusAndEdit, document.getElementById('extraSections'))

  document.getElementById('editPassportBtn').addEventListener('click', () => {
    formData = { ...data }  // загружаем существующие данные в форму
    openEditModal()
  })

  // Скрываем индикатор загрузки
  const loadingEl = document.getElementById('loading')
  if (loadingEl) loadingEl.style.display = 'none'
}

// -------------------- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ЭСКЕЙПИНГА HTML --------------------
function escapeHTML(str) {
  if (!str) return '—'
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

    // -------------------- МОДАЛЬНОЕ ОКНО --------------------
    async function openAddModal() {
      // Убеждаемся, что профиль загружен
      if (!userProfile) {
        await loadUserProfile()
        if (!userProfile) {
          alert('Не удалось загрузить профиль. Перезагрузите страницу.')
          return
        }
      }

      currentStep = 1
      formData = {
        personal_code: userPersonalCode || '',
        surname: userProfile?.surname || '',
        name: userProfile?.name || '',
        patronymic: userProfile?.patronymic || '',
        birth_date: userProfile?.date_of_birth || '',
        birth_place: userProfile?.place_of_birth || '',
        gender: userProfile?.gender || 'Мужской',
        residences: [],
        marital_statuses: [],
        previous_passports: [],
        previous_foreign_passports: [],
        previous_id_cards: []
      }
      openModal('Добавление паспорта')
    }

    function openEditModal() {
      currentStep = 1
      openModal('Редактирование паспорта')
    }

    function openModal(title) {
      const titleEl = document.getElementById('modalTitle')
      if (titleEl) titleEl.textContent = title
      const overlay = document.getElementById('modalOverlay')
      if (overlay) overlay.classList.add('active')
      updateStep()
    }

    window.closeModal = function() {
      const overlay = document.getElementById('modalOverlay')
      if (overlay) overlay.classList.remove('active')
      currentStep = 1
    }

    // -------------------- ОБНОВЛЕНИЕ ШАГА --------------------
    function updateStep() {
      const stepIndicator = document.getElementById('stepIndicator')
      if (stepIndicator) stepIndicator.textContent = `Шаг ${currentStep} из ${totalSteps}`

      const prevBtn = document.getElementById('prevBtn')
      if (prevBtn) prevBtn.style.display = currentStep > 1 ? 'inline-block' : 'none'

      const nextBtn = document.getElementById('nextBtn')
      if (nextBtn) nextBtn.textContent = currentStep === totalSteps ? 'Сохранить' : 'Далее'

      let content = ''
      switch (currentStep) {
        case 1: content = renderStep1(); break
        case 2: content = renderStep2(); break
        case 3: content = renderStep3(); break
        case 4: content = renderStep4(); break
        case 5: content = renderStep5(); break
        case 6: content = renderStep6(); break
        case 7: content = renderStep7(); break
      }
      const modalBody = document.getElementById('modalBody')
      if (modalBody) modalBody.innerHTML = content
    }

    // -------------------- РЕНДЕР ШАГОВ --------------------
    function renderStep1() {
      return `
        <div class="form-group">
          <label>Фамилия</label>
          <input type="text" id="surname" class="form-input" value="${formData.surname || ''}">
        </div>
        <div class="form-group">
          <label>Имя</label>
          <input type="text" id="name" class="form-input" value="${formData.name || ''}">
        </div>
        <div class="form-group">
          <label>Отчество</label>
          <input type="text" id="patronymic" class="form-input" value="${formData.patronymic || ''}">
        </div>
        <div class="form-group">
          <label>Дата рождения</label>
          <input type="date" id="birth_date" class="form-input" value="${formData.birth_date || ''}">
        </div>
        <div class="form-group">
          <label>Место рождения</label>
          <input type="text" id="birth_place" class="form-input" value="${formData.birth_place || ''}">
        </div>
        <div class="form-group">
          <label>Пол</label>
          <select id="gender" class="form-input">
            <option value="Мужской" ${formData.gender === 'Мужской' ? 'selected' : ''}>Мужской</option>
            <option value="Женский" ${formData.gender === 'Женский' ? 'selected' : ''}>Женский</option>
          </select>
        </div>
        <div class="form-group">
          <label>Кем выдан</label>
          <input type="text" id="issued_by" class="form-input" value="${formData.issued_by || ''}">
        </div>
        <div class="form-group">
          <label>Дата выдачи</label>
          <input type="date" id="issue_date" class="form-input" value="${formData.issue_date || ''}">
        </div>
        <div class="form-group">
          <label>Дата окончания действия</label>
          <input type="date" id="expiry_date" class="form-input" value="${formData.expiry_date || ''}">
        </div>
        <div class="form-group">
          <label>Код подразделения</label>
          <input type="text" id="department_code" class="form-input" value="${formData.department_code || ''}">
        </div>
        <div class="form-group">
          <label>Серия и номер</label>
          <input type="text" id="series_number" class="form-input" value="${formData.series_number || ''}">
        </div>
        <div class="form-group">
          <label>Личный код</label>
          <input type="text" id="personal_code" class="form-input" value="${userPersonalCode || ''}" readonly>
        </div>
      `
    }

    function renderStep2() {
      const residences = formData.residences || []
      let listHtml = residences.map((r, i) => `
        <div class="record-block" data-index="${i}">
          <div class="form-group">
            <label>Адрес</label>
            <input type="text" class="form-input residence-address" value="${r.address || ''}">
          </div>
          <div class="form-group">
            <label>Дата регистрации</label>
            <input type="date" class="form-input residence-reg" value="${r.registrationDate || ''}">
          </div>
          <div class="form-group">
            <label>Дата снятия</label>
            <input type="date" class="form-input residence-dereg" value="${r.deregistrationDate || ''}">
          </div>
          <div class="form-group">
            <label>Тип жилья</label>
            <input type="text" class="form-input residence-type" value="${r.housingType || ''}">
          </div>
          <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'residences')">Удалить</button>
        </div>
      `).join('')

      return `
        <p><strong>Места регистрации:</strong></p>
        <div id="residencesContainer">${listHtml}</div>
        <button type="button" class="btn btn-secondary" id="addResidenceBtn">+ Добавить адрес</button>
      `
    }

    function renderStep3() {
      const maritalStatuses = formData.marital_statuses || []
      let listHtml = maritalStatuses.map((m, i) => `
        <div class="record-block" data-index="${i}">
          <div class="form-group">
            <label>Статус</label>
            <select class="form-input marital-status">
              <option value="Не состоит в зарегистрированном браке" ${m.status === 'Не состоит в зарегистрированном браке' ? 'selected' : ''}>Не состоит в зарегистрированном браке</option>
              <option value="В браке" ${m.status === 'В браке' ? 'selected' : ''}>В браке</option>
              <option value="В разводе" ${m.status === 'В разводе' ? 'selected' : ''}>В разводе</option>
              <option value="Вдовец/Вдова" ${m.status === 'Вдовец/Вдова' ? 'selected' : ''}>Вдовец/Вдова</option>
            </select>
          </div>
          <div class="form-group">
            <label>Дата изменения</label>
            <input type="date" class="form-input marital-date" value="${m.changeDate || ''}">
          </div>
          <div class="form-group">
            <label>ФИО супруга</label>
            <input type="text" class="form-input marital-spouse" value="${m.spouseName || ''}">
          </div>
          <div class="form-group">
            <label>Номер акта</label>
            <input type="text" class="form-input marital-act" value="${m.actNumber || ''}">
          </div>
          <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'marital_statuses')">Удалить</button>
        </div>
      `).join('')

      return `
        <p><strong>Семейное положение:</strong></p>
        <div id="maritalContainer">${listHtml}</div>
        <button type="button" class="btn btn-secondary" id="addMaritalBtn">+ Добавить запись</button>
      `
    }

    function renderStep4() {
      return `
        <div class="form-group">
          <label>Военнообязанный</label>
          <select id="is_military_obligated" class="form-input">
            <option value="">—</option>
            <option value="true" ${formData.is_military_obligated === true ? 'selected' : ''}>Да</option>
            <option value="false" ${formData.is_military_obligated === false ? 'selected' : ''}>Нет</option>
          </select>
        </div>
        <div class="form-group">
          <label>Военный билет</label>
          <input type="text" id="military_idn" class="form-input" value="${formData.military_idn || ''}">
        </div>
      `
    }

    function renderStep5() {
      const previousPassports = formData.previous_passports || []
      let listHtml = previousPassports.map((p, i) => `
        <div class="record-block" data-index="${i}">
          <div class="form-group">
            <label>Серия и номер</label>
            <input type="text" class="form-input passport-series" value="${p.seriesNumber || ''}">
          </div>
          <div class="form-group">
            <label>Дата выдачи</label>
            <input type="date" class="form-input passport-date" value="${p.issueDate || ''}">
          </div>
          <div class="form-group">
            <label>Кем выдан</label>
            <input type="text" class="form-input passport-issued" value="${p.issuedBy || ''}">
          </div>
          <div class="form-group">
            <label>Причина замены</label>
            <input type="text" class="form-input passport-reason" value="${p.reason || ''}">
          </div>
          <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'previous_passports')">Удалить</button>
        </div>
      `).join('')

      return `
        <p><strong>Ранее выданные паспорта:</strong></p>
        <div id="prevPassportsContainer">${listHtml}</div>
        <button type="button" class="btn btn-secondary" id="addPrevPassportBtn">+ Добавить паспорт</button>
      `
    }

    function renderStep6() {
      const previousForeignPassports = formData.previous_foreign_passports || []
      let listHtml = previousForeignPassports.map((p, i) => `
        <div class="record-block" data-index="${i}">
          <div class="form-group">
            <label>Серия и номер</label>
            <input type="text" class="form-input foreign-series" value="${p.seriesNumber || ''}">
          </div>
          <div class="form-group">
            <label>Дата выдачи</label>
            <input type="date" class="form-input foreign-date" value="${p.issueDate || ''}">
          </div>
          <div class="form-group">
            <label>Кем выдан</label>
            <input type="text" class="form-input foreign-issued" value="${p.issuedBy || ''}">
          </div>
          <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'previous_foreign_passports')">Удалить</button>
        </div>
      `).join('')

      return `
        <p><strong>Ранее выданные заграничные паспорта:</strong></p>
        <div id="prevForeignContainer">${listHtml}</div>
        <button type="button" class="btn btn-secondary" id="addPrevForeignBtn">+ Добавить</button>
      `
    }

    function renderStep7() {
      const previousIdCards = formData.previous_id_cards || []
      let listHtml = previousIdCards.map((p, i) => `
        <div class="record-block" data-index="${i}">
          <div class="form-group">
            <label>Серия и номер</label>
            <input type="text" class="form-input idcard-series" value="${p.seriesNumber || ''}">
          </div>
          <div class="form-group">
            <label>Дата выдачи</label>
            <input type="date" class="form-input idcard-date" value="${p.issueDate || ''}">
          </div>
          <div class="form-group">
            <label>Кем выдан</label>
            <input type="text" class="form-input idcard-issued" value="${p.issuedBy || ''}">
          </div>
          <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'previous_id_cards')">Удалить</button>
        </div>
      `).join('')

      return `
        <p><strong>Ранее выданные ID-карты:</strong></p>
        <div id="prevIdCardsContainer">${listHtml}</div>
        <button type="button" class="btn btn-secondary" id="addPrevIdCardBtn">+ Добавить</button>
      `
    }

    // -------------------- СОХРАНЕНИЕ ДАННЫХ ТЕКУЩЕГО ШАГА --------------------
    function saveStepData() {
      switch (currentStep) {
        case 1:
          formData.surname = document.getElementById('surname')?.value.trim() || ''
          formData.name = document.getElementById('name')?.value.trim() || ''
          formData.patronymic = document.getElementById('patronymic')?.value.trim() || ''
          formData.birth_date = document.getElementById('birth_date')?.value || ''
          formData.birth_place = document.getElementById('birth_place')?.value.trim() || ''
          formData.gender = document.getElementById('gender')?.value || ''
          formData.issued_by = document.getElementById('issued_by')?.value.trim() || ''
          formData.issue_date = document.getElementById('issue_date')?.value || ''
          formData.expiry_date = document.getElementById('expiry_date')?.value || ''
          formData.department_code = document.getElementById('department_code')?.value.trim() || ''
          formData.series_number = document.getElementById('series_number')?.value.trim() || ''
          formData.personal_code = document.getElementById('personal_code')?.value.trim() || userPersonalCode
          break
        case 2:
          formData.residences = Array.from(document.querySelectorAll('#residencesContainer .record-block')).map(block => ({
            address: block.querySelector('.residence-address')?.value.trim() || '',
            registrationDate: block.querySelector('.residence-reg')?.value || '',
            deregistrationDate: block.querySelector('.residence-dereg')?.value || '',
            housingType: block.querySelector('.residence-type')?.value.trim() || ''
          }))
          break
        case 3:
          formData.marital_statuses = Array.from(document.querySelectorAll('#maritalContainer .record-block')).map(block => ({
            status: block.querySelector('.marital-status')?.value || '',
            changeDate: block.querySelector('.marital-date')?.value || '',
            spouseName: block.querySelector('.marital-spouse')?.value.trim() || '',
            actNumber: block.querySelector('.marital-act')?.value.trim() || ''
          }))
          break
        case 4:
          const isMilitary = document.getElementById('is_military_obligated')?.value
          formData.is_military_obligated = isMilitary === 'true' ? true : (isMilitary === 'false' ? false : null)
          formData.military_idn = document.getElementById('military_idn')?.value.trim() || ''
          break
        case 5:
          formData.previous_passports = Array.from(document.querySelectorAll('#prevPassportsContainer .record-block')).map(block => ({
            seriesNumber: block.querySelector('.passport-series')?.value.trim() || '',
            issueDate: block.querySelector('.passport-date')?.value || '',
            issuedBy: block.querySelector('.passport-issued')?.value.trim() || '',
            reason: block.querySelector('.passport-reason')?.value.trim() || ''
          }))
          break
        case 6:
          formData.previous_foreign_passports = Array.from(document.querySelectorAll('#prevForeignContainer .record-block')).map(block => ({
            seriesNumber: block.querySelector('.foreign-series')?.value.trim() || '',
            issueDate: block.querySelector('.foreign-date')?.value || '',
            issuedBy: block.querySelector('.foreign-issued')?.value.trim() || ''
          }))
          break
        case 7:
          formData.previous_id_cards = Array.from(document.querySelectorAll('#prevIdCardsContainer .record-block')).map(block => ({
            seriesNumber: block.querySelector('.idcard-series')?.value.trim() || '',
            issueDate: block.querySelector('.idcard-date')?.value || '',
            issuedBy: block.querySelector('.idcard-issued')?.value.trim() || ''
          }))
          break
      }
    }

    // -------------------- ДИНАМИЧЕСКОЕ ДОБАВЛЕНИЕ ЗАПИСЕЙ --------------------
    window.addRecord = function(containerId, type) {
      const container = document.getElementById(containerId)
      if (!container) return

      let html = ''
      if (type === 'residences') {
        html = `
          <div class="record-block">
            <div class="form-group"><label>Адрес</label><input type="text" class="form-input residence-address"></div>
            <div class="form-group"><label>Дата регистрации</label><input type="date" class="form-input residence-reg"></div>
            <div class="form-group"><label>Дата снятия</label><input type="date" class="form-input residence-dereg"></div>
            <div class="form-group"><label>Тип жилья</label><input type="text" class="form-input residence-type"></div>
            <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'residences')">Удалить</button>
          </div>
        `
      } else if (type === 'marital') {
        html = `
          <div class="record-block">
            <div class="form-group"><label>Статус</label>
              <select class="form-input marital-status">
                <option value="Не состоит в зарегистрированном браке">Не состоит в зарегистрированном браке</option>
                <option value="В браке">В браке</option>
                <option value="В разводе">В разводе</option>
                <option value="Вдовец/Вдова">Вдовец/Вдова</option>
              </select>
            </div>
            <div class="form-group"><label>Дата изменения</label><input type="date" class="form-input marital-date"></div>
            <div class="form-group"><label>ФИО супруга</label><input type="text" class="form-input marital-spouse"></div>
            <div class="form-group"><label>Номер акта</label><input type="text" class="form-input marital-act"></div>
            <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'marital_statuses')">Удалить</button>
          </div>
        `
      } else if (type === 'prevPassport') {
        html = `
          <div class="record-block">
            <div class="form-group"><label>Серия и номер</label><input type="text" class="form-input passport-series"></div>
            <div class="form-group"><label>Дата выдачи</label><input type="date" class="form-input passport-date"></div>
            <div class="form-group"><label>Кем выдан</label><input type="text" class="form-input passport-issued"></div>
            <div class="form-group"><label>Причина замены</label><input type="text" class="form-input passport-reason"></div>
            <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'previous_passports')">Удалить</button>
          </div>
        `
      } else if (type === 'prevForeign') {
        html = `
          <div class="record-block">
            <div class="form-group"><label>Серия и номер</label><input type="text" class="form-input foreign-series"></div>
            <div class="form-group"><label>Дата выдачи</label><input type="date" class="form-input foreign-date"></div>
            <div class="form-group"><label>Кем выдан</label><input type="text" class="form-input foreign-issued"></div>
            <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'previous_foreign_passports')">Удалить</button>
          </div>
        `
      } else if (type === 'prevIdCard') {
        html = `
          <div class="record-block">
            <div class="form-group"><label>Серия и номер</label><input type="text" class="form-input idcard-series"></div>
            <div class="form-group"><label>Дата выдачи</label><input type="date" class="form-input idcard-date"></div>
            <div class="form-group"><label>Кем выдан</label><input type="text" class="form-input idcard-issued"></div>
            <button type="button" class="btn btn-secondary" onclick="window.removeRecord(this, 'previous_id_cards')">Удалить</button>
          </div>
        `
      }
      container.insertAdjacentHTML('beforeend', html)
    }

    window.removeRecord = function(btn) {
      const block = btn.closest('.record-block')
      if (block) block.remove()
    }

    // -------------------- НАВИГАЦИЯ ПО ШАГАМ --------------------
    window.nextStep = function() {
      saveStepData()
      if (currentStep < totalSteps) {
        currentStep++
        updateStep()
      } else {
        savePassport()
      }
    }

    window.prevStep = function() {
      if (currentStep > 1) {
        currentStep--
        updateStep()
      }
    }

    // -------------------- СОХРАНЕНИЕ ПАСПОРТА В SUPABASE --------------------
    async function savePassport() {
      try {
        if (!userPersonalCode) {
          alert('Ошибка: личный код не загружен')
          return
        }

        // Подготовка данных
        const cleanData = { ...formData }
        Object.keys(cleanData).forEach(key => {
          if (cleanData[key] === null || cleanData[key] === undefined) delete cleanData[key]
        })

        cleanData.personal_code = userPersonalCode
        cleanData.status = 'oncheck'
        cleanData.updated_at = new Date().toISOString()

        let result
        if (currentDocId) {
          result = await supabase
            .from('document_passport')
            .update(cleanData)
            .eq('id', currentDocId)
        } else {
          cleanData.created_at = new Date().toISOString()
          result = await supabase
            .from('document_passport')
            .insert([cleanData])
            .select()
        }

        if (result.error) throw result.error

        closeModal()
        const newId = currentDocId || result.data[0].id
        window.location.href = `passport.html?id=${newId}`
      } catch (err) {
        console.error('Ошибка сохранения:', err)
        alert('Ошибка сохранения: ' + err.message)
      }
    }

    // -------------------- ИНИЦИАЛИЗАЦИЯ --------------------
    document.addEventListener('DOMContentLoaded', async () => {
      await loadPassport()

      const addBtn = document.getElementById('addPassportBtn')
      if (addBtn) addBtn.addEventListener('click', openAddModal)

      const prevBtn = document.getElementById('prevBtn')
      if (prevBtn) prevBtn.addEventListener('click', () => window.prevStep())

      const nextBtn = document.getElementById('nextBtn')
      if (nextBtn) nextBtn.addEventListener('click', () => window.nextStep())

      // Делегирование для динамических кнопок
      document.addEventListener('click', (e) => {
        if (e.target.id === 'addResidenceBtn') window.addRecord('residencesContainer', 'residences')
        if (e.target.id === 'addMaritalBtn') window.addRecord('maritalContainer', 'marital')
        if (e.target.id === 'addPrevPassportBtn') window.addRecord('prevPassportsContainer', 'prevPassport')
        if (e.target.id === 'addPrevForeignBtn') window.addRecord('prevForeignContainer', 'prevForeign')
        if (e.target.id === 'addPrevIdCardBtn') window.addRecord('prevIdCardsContainer', 'prevIdCard')
      })
    })

    // Экспорт в window для inline-обработчиков
    window.openAddModal = openAddModal
    window.openEditModal = openEditModal
    window.closeModal = closeModal
    window.nextStep = nextStep
    window.prevStep = prevStep
    window.addRecord = addRecord
    window.removeRecord = removeRecord