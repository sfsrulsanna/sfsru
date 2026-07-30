// js/register-supabase.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://qeewwoklmjysactfhrum.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZXd3b2tsbWp5c2FjdGZocnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTI2MTEsImV4cCI6MjA4NjQ4ODYxMX0.gWzqku1cS08v17kfJHJbOWbm-DRpzwQ9omlQsKxc96A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------
// 1. DOM-элементы
// ----------------------------------------------
const form = document.getElementById('registrationForm');
const step1Form = document.getElementById('step1Form');
const step2Form = document.getElementById('step2Form');
const step3Form = document.getElementById('step3Form');
const step4Form = document.getElementById('step4Form');
const progressFill = document.getElementById('progressFill');
const steps = {
  1: document.getElementById('step1'),
  2: document.getElementById('step2'),
  3: document.getElementById('step3'),
  4: document.getElementById('step4')
};
const alertDiv = document.getElementById('alertMessage');

const citizenFields = document.getElementById('citizenFields');
const subjectFields = document.getElementById('subjectFields');
const orgFields = document.getElementById('orgFields');

const togglePassword = document.getElementById('togglePassword');
const toggleConfirm = document.getElementById('toggleConfirmPassword');

let currentStep = 1;
let selectedType = null; // 'citizen', 'subject', 'organization'

// ----------------------------------------------
// 2. Инициализация
// ----------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.account-type-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.account-type-option').forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      selectedType = option.dataset.type;
    });
  });

  togglePassword.addEventListener('click', () => togglePasswordVisibility('password', togglePassword));
  toggleConfirm.addEventListener('click', () => togglePasswordVisibility('confirmPassword', toggleConfirm));

  form.addEventListener('submit', handleSubmit);
});

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
  input.setAttribute('type', type);
  btn.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
}

// ----------------------------------------------
// 3. Навигация по шагам
// ----------------------------------------------
function goToStep(step) {
  [step1Form, step2Form, step3Form, step4Form].forEach(s => s.classList.remove('active'));
  document.getElementById(`step${step}Form`).classList.add('active');

  const progressPercent = (step / 4) * 100;
  progressFill.style.width = `${progressPercent}%`;

  Object.keys(steps).forEach(s => {
    const stepEl = steps[s];
    if (s < step) stepEl.classList.add('completed');
    else stepEl.classList.remove('completed');
    if (s == step) stepEl.classList.add('active');
    else stepEl.classList.remove('active');
  });

  if (step === 2) updateStep2Fields();
  if (step === 4) generateSummary();

  currentStep = step;
}

function updateStep2Fields() {
  citizenFields.style.display = 'none';
  subjectFields.style.display = 'none';
  orgFields.style.display = 'none';

  if (selectedType === 'citizen') citizenFields.style.display = 'block';
  else if (selectedType === 'subject') subjectFields.style.display = 'block';
  else if (selectedType === 'organization') orgFields.style.display = 'block';
}

// ----------------------------------------------
// 4. Валидация шагов
// ----------------------------------------------
function validateStep(step) {
  if (step === 1) {
    if (!selectedType) {
      showAlert('Пожалуйста, выберите тип аккаунта', 'error');
      return false;
    }
    return true;
  }

  if (step === 2) {
    let valid = true;
    if (selectedType === 'citizen') {
      const required = ['lastName', 'firstName', 'birthDate', 'personalCode', 'gender'];
      required.forEach(id => {
        const input = document.getElementById(id);
        if (!input.value.trim()) {
          input.style.borderColor = 'red';
          valid = false;
        } else {
          input.style.borderColor = '';
        }
      });
      const pc = document.getElementById('personalCode').value.trim();
      if (pc && !/^\d{4}-\d{4}$/.test(pc)) {
        showAlert('Личный код должен быть в формате XXXX-XXXX', 'error');
        valid = false;
      }
    } else if (selectedType === 'subject') {
      const required = ['subjectFullName', 'subjectBirthDate', 'personalCodeSubject', 'nationality', 'subjectGender'];
      required.forEach(id => {
        const input = document.getElementById(id);
        if (!input.value.trim()) {
          input.style.borderColor = 'red';
          valid = false;
        } else {
          input.style.borderColor = '';
        }
      });
      const pc = document.getElementById('personalCodeSubject').value.trim();
      if (pc && !/^\d{4}-\d{6}$/.test(pc)) {
        showAlert('Личный код подданного должен быть в формате XXXX-XXXXXX', 'error');
        valid = false;
      }
    } else if (selectedType === 'organization') {
      const required = ['orgName', 'inn', 'ogrn', 'address', 'contactPerson'];
      required.forEach(id => {
        const input = document.getElementById(id);
        if (!input.value.trim()) {
          input.style.borderColor = 'red';
          valid = false;
        } else {
          input.style.borderColor = '';
        }
      });
      const inn = document.getElementById('inn').value.trim();
      if (inn && !/^\d{10}$/.test(inn)) {
        showAlert('ИНН должен содержать 10 цифр', 'error');
        valid = false;
      }
      const ogrn = document.getElementById('ogrn').value.trim();
      if (ogrn && !/^\d{13}$/.test(ogrn)) {
        showAlert('ОГРН должен содержать 13 цифр', 'error');
        valid = false;
      }
    }
    if (!valid) showAlert('Заполните все обязательные поля корректно', 'error');
    return valid;
  }

  if (step === 3) {
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (!email || !phone || !password || !confirm) {
      showAlert('Заполните все поля', 'error');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('Введите корректный email', 'error');
      return false;
    }
    if (password.length < 8) {
      showAlert('Пароль должен быть не менее 8 символов', 'error');
      return false;
    }
    if (password !== confirm) {
      showAlert('Пароли не совпадают', 'error');
      return false;
    }
    return true;
  }

  if (step === 4) {
    const agreeTerms = document.getElementById('agreeTerms').checked;
    const agreePrivacy = document.getElementById('agreePrivacy').checked;
    if (!agreeTerms || !agreePrivacy) {
      showAlert('Необходимо согласиться с условиями', 'error');
      return false;
    }
    return true;
  }

  return true;
}

// ----------------------------------------------
// 5. Кнопки "Далее/Назад" (глобальные для HTML)
// ----------------------------------------------
window.selectAccountType = function() {
  if (validateStep(1)) goToStep(2);
};

window.nextStep = function(step) {
  if (validateStep(step)) goToStep(step + 1);
};

window.prevStep = function(step) {
  goToStep(step - 1);
};

// ----------------------------------------------
// 6. Генерация сводки (шаг 4)
// ----------------------------------------------
function generateSummary() {
  const summaryDiv = document.getElementById('registrationSummary');
  let html = '';

  if (selectedType === 'citizen') {
    html += `<div class="summary-item"><span class="summary-label">Фамилия:</span> <span class="summary-value">${document.getElementById('lastName').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Имя:</span> <span class="summary-value">${document.getElementById('firstName').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Отчество:</span> <span class="summary-value">${document.getElementById('middleName').value || '—'}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Дата рождения:</span> <span class="summary-value">${document.getElementById('birthDate').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Место рождения:</span> <span class="summary-value">${document.getElementById('birthPlace').value || '—'}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Личный код:</span> <span class="summary-value">${document.getElementById('personalCode').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Пол:</span> <span class="summary-value">${document.getElementById('gender').value === 'male' ? 'Мужской' : 'Женский'}</span></div>`;
  } else if (selectedType === 'subject') {
    html += `<div class="summary-item"><span class="summary-label">ФИО:</span> <span class="summary-value">${document.getElementById('subjectFullName').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Дата рождения:</span> <span class="summary-value">${document.getElementById('subjectBirthDate').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Место рождения:</span> <span class="summary-value">${document.getElementById('subjectBirthPlace').value || '—'}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Личный код:</span> <span class="summary-value">${document.getElementById('personalCodeSubject').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Гражданство:</span> <span class="summary-value">${document.getElementById('nationality').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Пол:</span> <span class="summary-value">${document.getElementById('subjectGender').value === 'male' ? 'Мужской' : document.getElementById('subjectGender').value === 'female' ? 'Женский' : 'Другой'}</span></div>`;
  } else if (selectedType === 'organization') {
    html += `<div class="summary-item"><span class="summary-label">Организация:</span> <span class="summary-value">${document.getElementById('orgName').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Тип:</span> <span class="summary-value">${document.getElementById('orgType').value || '—'}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">ИНН:</span> <span class="summary-value">${document.getElementById('inn').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">КПП:</span> <span class="summary-value">${document.getElementById('kpp').value || '—'}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">ОГРН:</span> <span class="summary-value">${document.getElementById('ogrn').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Адрес:</span> <span class="summary-value">${document.getElementById('address').value}</span></div>`;
    html += `<div class="summary-item"><span class="summary-label">Контактное лицо:</span> <span class="summary-value">${document.getElementById('contactPerson').value}</span></div>`;
  }

  html += `<div class="summary-item"><span class="summary-label">Email:</span> <span class="summary-value">${document.getElementById('email').value}</span></div>`;
  html += `<div class="summary-item"><span class="summary-label">Телефон:</span> <span class="summary-value">${document.getElementById('phone').value}</span></div>`;

  summaryDiv.innerHTML = html;
}

// ----------------------------------------------
// 7. ОСНОВНАЯ ЛОГИКА: регистрация (без вставки профиля)
// ----------------------------------------------
async function handleSubmit(e) {
  e.preventDefault();

  if (!validateStep(4)) return;

  const submitBtn = document.querySelector('.btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Регистрация...';
  showAlert('Отправка данных...', 'info');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // --- Сбор метаданных для передачи в raw_user_meta_data ---
  let userMeta = {};

  if (selectedType === 'citizen') {
    userMeta = {
      surname: document.getElementById('lastName').value.trim(),
      name: document.getElementById('firstName').value.trim(),
      patronymic: document.getElementById('middleName').value.trim() || null,
      gender: document.getElementById('gender').value,
      date_of_birth: document.getElementById('birthDate').value,
      place_of_birth: document.getElementById('birthPlace').value.trim() || null,
      personal_code: document.getElementById('personalCode').value.trim(),
      phone: document.getElementById('phone').value.trim()
    };
  } else if (selectedType === 'subject') {
    const fullName = document.getElementById('subjectFullName').value.trim().split(' ');
    userMeta = {
      surname: fullName[0] || '',
      name: fullName[1] || '',
      patronymic: fullName[2] || null,
      gender: document.getElementById('subjectGender').value,
      citizenship: document.getElementById('nationality').value.trim(),
      date_of_birth: document.getElementById('subjectBirthDate').value,
      place_of_birth: document.getElementById('subjectBirthPlace').value.trim() || null,
      personal_code: document.getElementById('personalCodeSubject').value.trim(),
      phone: document.getElementById('phone').value.trim()
    };
  } else if (selectedType === 'organization') {
    userMeta = {
      organization_name_full: document.getElementById('orgName').value.trim(),
      organization_name_short: document.getElementById('orgName').value.trim(),
      organization_type: document.getElementById('orgType').value || null,
      inn: document.getElementById('inn').value.trim(),
      kpp: document.getElementById('kpp').value.trim() || null,
      ogrn: document.getElementById('ogrn').value.trim(),
      address: document.getElementById('address').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      contact_person: document.getElementById('contactPerson').value.trim()
    };
  }

  // 1. Регистрация в Auth (передаём метаданные)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userMeta,  // все данные отправляются в raw_user_meta_data
      emailRedirectTo: window.location.origin + '/profile.html'
    }
  });

  if (authError) {
    showAlert('Ошибка регистрации: ' + authError.message, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Зарегистрироваться';
    return;
  }

  const user = authData.user;
  if (!user) {
    showAlert('Не удалось создать пользователя', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Зарегистрироваться';
    return;
  }

  // 2. Успех — показываем сообщение о подтверждении
  showAlert(
    'Регистрация прошла успешно! На вашу почту отправлено письмо с подтверждением. ' +
    'После подтверждения ваш профиль будет создан автоматически, и вы сможете войти.',
    'success'
  );
  submitBtn.disabled = false;
  submitBtn.textContent = 'Зарегистрироваться';

  // 3. Перенаправляем на страницу входа через 5 секунд
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 5000);
}

// ----------------------------------------------
// 8. Уведомления
// ----------------------------------------------
function showAlert(message, type) {
  alertDiv.textContent = message;
  alertDiv.className = `alert alert-${type}`;
  alertDiv.style.display = 'block';
  clearTimeout(alertDiv._timeout);
  alertDiv._timeout = setTimeout(() => {
    alertDiv.style.display = 'none';
  }, 8000);
}