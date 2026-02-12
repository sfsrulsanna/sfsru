// js/register-supabase.js
import { supabase } from './supabase-config.js'

let currentStep = 1
let accountType = null

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
  el.type = el.type === 'password' ? 'text' : 'password'
}

function selectAccountType() {
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
window.selectAccountType = selectAccountType

function nextStep(step) {
  if (validateStep(step)) {
    document.getElementById(`step${step}Form`).classList.remove('active')
    currentStep = step + 1
    document.getElementById(`step${currentStep}Form`).classList.add('active')
    updateProgress()
    if (currentStep === 4) updateSummary()
  }
}
window.nextStep = nextStep

function prevStep(step) {
  document.getElementById(`step${step}Form`).classList.remove('active')
  currentStep = step - 1
  document.getElementById(`step${currentStep}Form`).classList.add('active')
  updateProgress()
}
window.prevStep = prevStep

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

function getFormData() {
  return {
    lastName: document.getElementById('lastName').value.trim(),
    firstName: document.getElementById('firstName').value.trim(),
    middleName: document.getElementById('middleName').value.trim(),
    birthDate: document.getElementById('birthDate').value,
    birthPlace: document.getElementById('birthPlace').value.trim(),
    personalCode: document.getElementById('personalCode').value.trim(),
    phone: document.getElementById('phone').value,
    email: document.getElementById('email').value.trim().replace(/\s+/g, '').toLowerCase(),
    permanentAddress: document.getElementById('permanentAddress')?.value.trim() || '',
    temporaryAddress: document.getElementById('temporaryAddress')?.value.trim() || '',
    residenceAddress: document.getElementById('residenceAddress')?.value.trim() || ''
  }
}

function updateSummary() {
  const d = getFormData()
  document.getElementById('registrationSummary').innerHTML = `
    <div class="summary-item"><span class="summary-label">ФИО:</span><span class="summary-value">${d.lastName} ${d.firstName} ${d.middleName}</span></div>
    <div class="summary-item"><span class="summary-label">Дата рождения:</span><span class="summary-value">${d.birthDate}</span></div>
    <div class="summary-item"><span class="summary-label">Место рождения:</span><span class="summary-value">${d.birthPlace}</span></div>
    <div class="summary-item"><span class="summary-label">Личный код:</span><span class="summary-value">${d.personalCode}</span></div>
    <div class="summary-item"><span class="summary-label">Email:</span><span class="summary-value">${d.email}</span></div>
    <div class="summary-item"><span class="summary-label">Телефон:</span><span class="summary-value">${d.phone}</span></div>
  `
}

function updateProgress() {
  document.getElementById('progressFill').style.width = `${(currentStep / 4) * 100}%`
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`step${i}`)
    el?.classList.toggle('active', i === currentStep)
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
    // 1. Создаём пользователя в Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: password,
      options: {
        data: {
          full_name: `${formData.lastName} ${formData.firstName} ${formData.middleName}`.trim()
        }
      }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('Не удалось создать пользователя')

    const userId = authData.user.id

    // 2. Сохраняем данные в таблицу users
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        surname: formData.lastName,
        name: formData.firstName,
        patronymic: formData.middleName || '',
        date_of_birth: formData.birthDate,
        place_of_birth: formData.birthPlace,
        personal_code: formData.personalCode,
        email: formData.email,
        phone: formData.phone,
        account_type: 'упрощенная',
        role: 'citizen',
        surname_status: 'oncheck',
        name_status: 'oncheck',
        patronymic_status: 'oncheck',
        date_of_birth_status: 'oncheck',
        place_of_birth_status: 'oncheck',
        phone_status: 'verified',
        email_status: 'verified'
      })

    if (userError) throw userError

    // 3. Сохраняем адреса (если есть)
    if (formData.permanentAddress || formData.temporaryAddress || formData.residenceAddress) {
      const { error: addressError } = await supabase
        .from('users_addresses')
        .insert({
          user_id: userId,
          permanent: formData.permanentAddress,
          temporary: formData.temporaryAddress,
          residence: formData.residenceAddress,
          permanent_status: 'oncheck',
          temporary_status: 'oncheck',
          residence_status: 'oncheck'
        })

      if (addressError) throw addressError
    }

    // 4. Показываем сообщение и личный код
    showAlert(`
      <strong>Регистрация завершена!</strong><br>
      На ваш email отправлено письмо для подтверждения.<br>
      Ваш личный код: <code>${formData.personalCode}</code>
    `, 'success')

    // Сохраняем код в localStorage для отображения на профиле
    localStorage.setItem('personalCode', formData.personalCode)

    // Через 4 секунды переходим на страницу входа
    setTimeout(() => window.location.href = 'login.html', 4000)

  } catch (error) {
    console.error('Registration error:', error)
    let message = 'Ошибка регистрации'
    if (error.message.includes('already registered')) {
      message = 'Этот email уже зарегистрирован'
    } else if (error.message.includes('duplicate key')) {
      message = 'Такой личный код уже используется'
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
  setTimeout(() => el.style.display = 'none', 5000)
}