// js/register-supabase.js
import { supabase } from './supabase-config.js'

let currentStep = 1
let accountType = null // 'citizen', 'subject', 'organization'

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners()
  updateProgress()
})

function initEventListeners() {
  // Выбор типа аккаунта
  document.querySelectorAll('.account-type-option').forEach(el => {
    el.addEventListener('click', function () {
      document.querySelectorAll('.account-type-option').forEach(x => x.classList.remove('selected'))
      this.classList.add('selected')
    })
  })

  // Показать/скрыть пароль
  document.getElementById('togglePassword')?.addEventListener('click', () => togglePass('password'))
  document.getElementById('toggleConfirmPassword')?.addEventListener('click', () => togglePass('confirmPassword'))

  // Форматирование телефона
  document.getElementById('phone')?.addEventListener('input', formatPhoneNumber)

  // Отправка формы
  document.getElementById('registrationForm')?.addEventListener('submit', handleRegistration)
}

function togglePass(id) {
  const el = document.getElementById(id)
  if (el) el.type = el.type === 'password' ? 'text' : 'password'
}

// Шаг 1: выбор типа аккаунта
window.selectAccountType = function() {
  const selected = document.querySelector('.account-type-option.selected')
  if (!selected) {
    showAlert('Выберите тип аккаунта', 'error')
    return
  }
  accountType = selected.dataset.type

  // Показываем соответствующие поля на шаге 2
  document.querySelectorAll('.category-fields').forEach(el => el.style.display = 'none')
  if (accountType === 'citizen') document.getElementById('citizenFields').style.display = 'block'
  else if (accountType === 'subject') document.getElementById('subjectFields').style.display = 'block'
  else if (accountType === 'organization') document.getElementById('orgFields').style.display = 'block'

  // Переход на шаг 2
  document.getElementById('step1Form').classList.remove('active')
  currentStep = 2
  document.getElementById('step2Form').classList.add('active')
  updateProgress()
}

// Шаг вперёд
window.nextStep = function(step) {
  if (validateStep(step)) {
    document.getElementById(`step${step}Form`).classList.remove('active')
    currentStep = step + 1
    document.getElementById(`step${currentStep}Form`).classList.add('active')
    updateProgress()
    if (currentStep === 4) updateSummary()
  }
}

// Шаг назад
window.prevStep = function(step) {
  document.getElementById(`step${step}Form`).classList.remove('active')
  currentStep = step - 1
  document.getElementById(`step${currentStep}Form`).classList.add('active')
  updateProgress()
}

// Валидация шага
function validateStep(step) {
  if (step === 2) {
    // Валидация в зависимости от типа
    if (!accountType) {
      showAlert('Сначала выберите тип аккаунта', 'error')
      return false
    }

    if (accountType === 'citizen') {
      const fields = ['lastName', 'firstName', 'birthDate', 'birthPlace', 'personalCode', 'gender']
      for (let f of fields) {
        const el = document.getElementById(f)
        if (!el || !el.value.trim()) {
          showAlert('Заполните все обязательные поля', 'error')
          return false
        }
      }
      const pc = document.getElementById('personalCode').value.trim()
      if (!/^\d{4}-\d{4}$/.test(pc)) {
        showAlert('Личный код должен быть в формате XXXX-XXXX', 'error')
        return false
      }
    } else if (accountType === 'subject') {
      const fields = ['subjectFullName', 'subjectBirthDate', 'subjectBirthPlace', 'subjectGender', 'nationality', 'passportNumber']
      for (let f of fields) {
        const el = document.getElementById(f)
        if (!el || !el.value.trim()) {
          showAlert('Заполните все обязательные поля', 'error')
          return false
        }
      }
    } else if (accountType === 'organization') {
      const fields = ['orgName', 'inn', 'ogrn', 'address', 'contactPerson']
      for (let f of fields) {
        const el = document.getElementById(f)
        if (!el || !el.value.trim()) {
          showAlert('Заполните все обязательные поля', 'error')
          return false
        }
      }
      // Проверка ИНН (10 или 12 цифр)
      const inn = document.getElementById('inn').value.trim()
      if (!/^\d{10}$|^\d{12}$/.test(inn)) {
        showAlert('ИНН должен содержать 10 или 12 цифр', 'error')
        return false
      }
      const ogrn = document.getElementById('ogrn').value.trim()
      if (!/^\d{13}$/.test(ogrn)) {
        showAlert('ОГРН должен содержать 13 цифр', 'error')
        return false
      }
    }
  } else if (step === 3) {
    // Email и пароль общие для всех
    let email = document.getElementById('email').value.trim()
    email = email.replace(/\s+/g, '').toLowerCase()
    document.getElementById('email').value = email

    if (!email) {
      showAlert('Введите email', 'error')
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      showAlert('Введите корректный email', 'error')
      return false
    }

    const p = document.getElementById('password').value
    const cp = document.getElementById('confirmPassword').value
    if (p.length < 8 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(p)) {
      showAlert('Пароль должен содержать минимум 8 символов, буквы и цифры', 'error')
      return false
    }
    if (p !== cp) {
      showAlert('Пароли не совпадают', 'error')
      return false
    }
  }
  return true
}

// Сбор данных в зависимости от типа
function getFormData() {
  const base = {
    email: document.getElementById('email').value.trim().replace(/\s+/g, '').toLowerCase(),
    phone: document.getElementById('phone').value.trim()
  }

  if (accountType === 'citizen') {
    return {
      ...base,
      category: 'citizen',
      last_name: document.getElementById('lastName').value.trim(),
      first_name: document.getElementById('firstName').value.trim(),
      middle_name: document.getElementById('middleName').value.trim() || null,
      birth_date: document.getElementById('birthDate').value,
      birth_place: document.getElementById('birthPlace').value.trim(),
      personal_code: document.getElementById('personalCode').value.trim(),
      gender: document.getElementById('gender').value
    }
  } else if (accountType === 'subject') {
    return {
      ...base,
      category: 'subject',
      full_name: document.getElementById('subjectFullName').value.trim(),
      birth_date: document.getElementById('subjectBirthDate').value,
      birth_place: document.getElementById('subjectBirthPlace').value.trim(),
      gender: document.getElementById('subjectGender').value,
      nationality: document.getElementById('nationality').value.trim(),
      passport_number: document.getElementById('passportNumber').value.trim()
    }
  } else if (accountType === 'organization') {
    return {
      ...base,
      category: 'organization',
      organization_name: document.getElementById('orgName').value.trim(),
      inn: document.getElementById('inn').value.trim(),
      kpp: document.getElementById('kpp').value.trim() || null,
      ogrn: document.getElementById('ogrn').value.trim(),
      address: document.getElementById('address').value.trim(),
      contact_person: document.getElementById('contactPerson').value.trim()
    }
  }
}

// Обновление сводки на шаге 4
function updateSummary() {
  const d = getFormData()
  let html = ''
  if (accountType === 'citizen') {
    html = `
      <div class="summary-item"><span class="summary-label">ФИО:</span> <span class="summary-value">${d.last_name} ${d.first_name} ${d.middle_name || ''}</span></div>
      <div class="summary-item"><span class="summary-label">Дата рождения:</span> <span class="summary-value">${d.birth_date}</span></div>
      <div class="summary-item"><span class="summary-label">Место рождения:</span> <span class="summary-value">${d.birth_place}</span></div>
      <div class="summary-item"><span class="summary-label">Личный код:</span> <span class="summary-value">${d.personal_code}</span></div>
      <div class="summary-item"><span class="summary-label">Пол:</span> <span class="summary-value">${d.gender}</span></div>
    `
  } else if (accountType === 'subject') {
    html = `
      <div class="summary-item"><span class="summary-label">ФИО:</span> <span class="summary-value">${d.full_name}</span></div>
      <div class="summary-item"><span class="summary-label">Дата рождения:</span> <span class="summary-value">${d.birth_date}</span></div>
      <div class="summary-item"><span class="summary-label">Место рождения:</span> <span class="summary-value">${d.birth_place}</span></div>
      <div class="summary-item"><span class="summary-label">Гражданство:</span> <span class="summary-value">${d.nationality}</span></div>
      <div class="summary-item"><span class="summary-label">Паспорт:</span> <span class="summary-value">${d.passport_number}</span></div>
    `
  } else if (accountType === 'organization') {
    html = `
      <div class="summary-item"><span class="summary-label">Организация:</span> <span class="summary-value">${d.organization_name}</span></div>
      <div class="summary-item"><span class="summary-label">ИНН:</span> <span class="summary-value">${d.inn}</span></div>
      <div class="summary-item"><span class="summary-label">ОГРН:</span> <span class="summary-value">${d.ogrn}</span></div>
      <div class="summary-item"><span class="summary-label">Адрес:</span> <span class="summary-value">${d.address}</span></div>
    `
  }
  html += `<div class="summary-item"><span class="summary-label">Email:</span> <span class="summary-value">${d.email}</span></div>`
  html += `<div class="summary-item"><span class="summary-label">Телефон:</span> <span class="summary-value">${d.phone || '—'}</span></div>`
  document.getElementById('registrationSummary').innerHTML = html
}

function updateProgress() {
  const fill = document.getElementById('progressFill')
  if (fill) fill.style.width = `${(currentStep / 4) * 100}%`
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`step${i}`)
    if (step) step.classList.toggle('active', i === currentStep)
  }
}

function formatPhoneNumber(e) {
  let v = e.target.value.replace(/\D/g, '')
  if (v.length === 0) { e.target.value = ''; return }
  if (v[0] === '7' || v[0] === '8') v = v.substring(1)
  let f = '+7 ('
  if (v.length > 0) f += v.substring(0, 3)
  if (v.length > 3) f += ') ' + v.substring(3, 6)
  if (v.length > 6) f += '-' + v.substring(6, 8)
  if (v.length > 8) f += '-' + v.substring(8, 10)
  e.target.value = f
}

async function handleRegistration(e) {
  e.preventDefault()

  if (!document.getElementById('agreeTerms').checked || !document.getElementById('agreePrivacy').checked) {
    showAlert('Необходимо принять условия использования и политику конфиденциальности', 'error')
    return
  }

  const formData = getFormData()
  const password = document.getElementById('password').value

  showAlert('Регистрация...', 'info')

  try {
    // 1. Создание пользователя в auth.users
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: password,
      options: {
        data: {
          category: accountType,
          ...formData // передаём все данные в metadata (опционально)
        }
      }
    })

    if (error) {
      if (error.status === 429 || error.message?.includes('rate limit')) {
        showAlert('Слишком много попыток регистрации. Подождите несколько минут.', 'error')
        return
      }
      throw error
    }

    const userId = data.user.id

    // 2. Сохранение данных в соответствующую таблицу
    let tableName, record
    if (accountType === 'citizen') {
      tableName = 'citizens'
      record = {
        id: userId,
        personal_code: formData.personal_code,
        last_name: formData.last_name,
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        birth_date: formData.birth_date,
        birth_place: formData.birth_place,
        gender: formData.gender,
        phone: formData.phone,
        email: formData.email,
        account_type: 'standard',
        role: 'user'
      }
    } else if (accountType === 'subject') {
      tableName = 'subjects'
      record = {
        id: userId,
        full_name: formData.full_name,
        birth_date: formData.birth_date,
        birth_place: formData.birth_place,
        gender: formData.gender,
        nationality: formData.nationality,
        passport_number: formData.passport_number,
        phone: formData.phone,
        email: formData.email,
        account_type: 'standard',
        role: 'user'
      }
    } else if (accountType === 'organization') {
      tableName = 'legal_entities'
      record = {
        id: userId,
        organization_name: formData.organization_name,
        inn: formData.inn,
        kpp: formData.kpp,
        ogrn: formData.ogrn,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        contact_person: formData.contact_person,
        account_type: 'standard',
        role: 'user'
      }
    }

    const { error: insertError } = await supabase
      .from(tableName)
      .insert([record])

    if (insertError) throw insertError

    // Успех
    showAlert(`
      <strong>Регистрация завершена!</strong><br>
      ${data.user?.confirmed_at ? 'Аккаунт активирован.' : 'На ваш email отправлено письмо для подтверждения.'}
    `, 'success')

    setTimeout(() => window.location.href = 'login.html', 4000)

  } catch (error) {
    console.error('Registration error:', error)
    let message = 'Ошибка регистрации. Попробуйте позже.'

    if (error.message?.includes('Email')) {
      message = 'Указанный email недопустим.'
    } else if (error.message?.includes('already registered') || error.code === 'user_already_exists') {
      message = 'Этот email уже зарегистрирован'
    } else if (error.code === '23505') { // unique violation
      if (error.message?.includes('personal_code')) message = 'Такой личный код уже используется'
      else if (error.message?.includes('passport_number')) message = 'Такой номер паспорта уже используется'
      else if (error.message?.includes('inn')) message = 'Такой ИНН уже зарегистрирован'
      else if (error.message?.includes('ogrn')) message = 'Такой ОГРН уже зарегистрирован'
      else message = 'Данные уже существуют в системе'
    }

    showAlert(message, 'error')
  }
}

function showAlert(message, type) {
  const el = document.getElementById('alertMessage')
  if (!el) return
  el.innerHTML = message
  el.className = `alert alert-${type}`
  el.style.display = 'block'
  const delay = type === 'success' ? 7000 : 5000
  setTimeout(() => el.style.display = 'none', delay)
}