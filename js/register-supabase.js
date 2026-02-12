// js/register-supabase.js
import { supabase } from './supabase-config.js'

// --- Состояние ---
let currentStep = 1
let accountType = null

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners()
  updateProgress()
})

// --- Обработчики событий ---
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

// --- Переключение видимости пароля ---
function togglePass(id) {
  const el = document.getElementById(id)
  if (el) el.type = el.type === 'password' ? 'text' : 'password'
}

// --- Шаг 1: выбор типа аккаунта ---
window.selectAccountType = function() {
  const selected = document.querySelector('.account-type-option.selected')
  if (!selected) {
    showAlert('Выберите тип аккаунта', 'error')
    return
  }
  accountType = selected.dataset.type
  if (accountType === 'organization') {
    window.location.href = 'organization/register.html'
    return
  }
  // Переход на шаг 2
  document.getElementById('step1Form').classList.remove('active')
  currentStep = 2
  document.getElementById('step2Form').classList.add('active')
  updateProgress()
}

// --- Шаг вперёд ---
window.nextStep = function(step) {
  if (validateStep(step)) {
    document.getElementById(`step${step}Form`).classList.remove('active')
    currentStep = step + 1
    document.getElementById(`step${currentStep}Form`).classList.add('active')
    updateProgress()
    if (currentStep === 4) updateSummary()
  }
}

// --- Шаг назад ---
window.prevStep = function(step) {
  document.getElementById(`step${step}Form`).classList.remove('active')
  currentStep = step - 1
  document.getElementById(`step${currentStep}Form`).classList.add('active')
  updateProgress()
}

// --- Валидация шагов ---
function validateStep(step) {
  if (step === 2) {
    const fields = ['lastName', 'firstName', 'birthDate', 'birthPlace', 'personalCode']
    for (let f of fields) {
      if (!document.getElementById(f).value.trim()) {
        showAlert('Заполните все обязательные поля', 'error')
        return false
      }
    }
    const pc = document.getElementById('personalCode').value.trim()
    if (!/^\d{4}-\d{4}$/.test(pc)) {
      showAlert('Личный код должен быть в формате XXXX-XXXX (например: 1234-5678)', 'error')
      return false
    }
  } else if (step === 3) {
    // Очистка и проверка email
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

// --- Сбор данных формы ---
function getFormData() {
  return {
    lastName: document.getElementById('lastName').value.trim(),
    firstName: document.getElementById('firstName').value.trim(),
    middleName: document.getElementById('middleName').value.trim(),
    birthDate: document.getElementById('birthDate').value,
    birthPlace: document.getElementById('birthPlace').value.trim(),
    personalCode: document.getElementById('personalCode').value.trim(),
    phone: document.getElementById('phone').value,
    email: document.getElementById('email').value.trim().replace(/\s+/g, '').toLowerCase()
  }
}

// --- Обновление сводки на шаге 4 ---
function updateSummary() {
  const d = getFormData()
  document.getElementById('registrationSummary').innerHTML = `
    <div class="summary-item"><span class="summary-label">ФИО:</span> <span class="summary-value">${d.lastName} ${d.firstName} ${d.middleName}</span></div>
    <div class="summary-item"><span class="summary-label">Дата рождения:</span> <span class="summary-value">${d.birthDate}</span></div>
    <div class="summary-item"><span class="summary-label">Место рождения:</span> <span class="summary-value">${d.birthPlace}</span></div>
    <div class="summary-item"><span class="summary-label">Личный код:</span> <span class="summary-value">${d.personalCode}</span></div>
    <div class="summary-item"><span class="summary-label">Email:</span> <span class="summary-value">${d.email}</span></div>
    <div class="summary-item"><span class="summary-label">Телефон:</span> <span class="summary-value">${d.phone}</span></div>
  `
}

// --- Обновление прогресс-бара ---
function updateProgress() {
  const fill = document.getElementById('progressFill')
  if (fill) fill.style.width = `${(currentStep / 4) * 100}%`
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`step${i}`)
    if (step) step.classList.toggle('active', i === currentStep)
  }
}

// --- Форматирование телефона (маска) ---
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

// --- ОСНОВНАЯ ФУНКЦИЯ РЕГИСТРАЦИИ (ВЫЗОВ SUPABASE) ---
async function handleRegistration(e) {
  e.preventDefault()

  if (!document.getElementById('agreeTerms').checked || !document.getElementById('agreePrivacy').checked) {
    showAlert('Необходимо принять условия использования и политику конфиденциальности', 'error')
    return
  }

  const formData = getFormData()
  const password = document.getElementById('password').value
  formData.email = formData.email.replace(/\s+/g, '').toLowerCase()

  showAlert('Регистрация...', 'info')

  try {
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: password,
      options: {
        data: {
          lastName: formData.lastName,
          firstName: formData.firstName,
          middleName: formData.middleName,
          birthDate: formData.birthDate,
          birthPlace: formData.birthPlace,
          personalCode: formData.personalCode,
          phone: formData.phone
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

    // Успешная регистрация
    showAlert(`
      <strong>Регистрация завершена!</strong><br>
      ${data.user?.confirmed_at ? 'Аккаунт активирован.' : 'На ваш email отправлено письмо для подтверждения.'}<br>
      Ваш личный код: <strong>${formData.personalCode}</strong>
    `, 'success')

    localStorage.setItem('personalCode', formData.personalCode)
    setTimeout(() => window.location.href = 'login.html', 4000)

  } catch (error) {
    console.error('Registration error:', error)
    let message = 'Ошибка регистрации. Попробуйте позже.'

    if (error.message?.includes('Email')) {
      message = 'Указанный email недопустим.'
    } else if (error.message?.includes('already registered') || error.code === 'user_already_exists') {
      message = 'Этот email уже зарегистрирован'
    } else if (error.message?.includes('duplicate key') || error.message?.includes('personal_code')) {
      message = 'Такой личный код уже используется'
    } else if (error.code === '23505') {
      message = 'Такой email или личный код уже зарегистрированы'
    }

    showAlert(message, 'error')
  }
}

// --- Отображение уведомлений ---
function showAlert(message, type) {
  const el = document.getElementById('alertMessage')
  if (!el) return
  el.innerHTML = message
  el.className = `alert alert-${type}`
  el.style.display = 'block'
  const delay = type === 'success' ? 7000 : 5000
  setTimeout(() => el.style.display = 'none', delay)
}