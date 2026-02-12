// js/register.js
let currentStep = 1;
let accountType = null;

document.addEventListener('DOMContentLoaded', function () {
  initEventListeners();
  updateProgress();
});

function initEventListeners() {
  document.querySelectorAll('.account-type-option').forEach(el => {
    el.addEventListener('click', function () {
      document.querySelectorAll('.account-type-option').forEach(x => x.classList.remove('selected'));
      this.classList.add('selected');
    });
  });

  document.getElementById('togglePassword')?.addEventListener('click', () => togglePass('password'));
  document.getElementById('toggleConfirmPassword')?.addEventListener('click', () => togglePass('confirmPassword'));
  document.getElementById('phone')?.addEventListener('input', formatPhoneNumber);
  document.getElementById('registrationForm')?.addEventListener('submit', handleRegistration);
}

function togglePass(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

function selectAccountType() {
  const selected = document.querySelector('.account-type-option.selected');
  if (!selected) {
    showAlert('Выберите тип аккаунта', 'error');
    return;
  }
  accountType = selected.dataset.type;
  if (accountType === 'organization') {
    window.location.href = 'organization/register.html';
    return;
  }

  document.getElementById('step1Form').classList.remove('active');
  currentStep = 2;
  document.getElementById('step2Form').classList.add('active');
  updateProgress();
}

function nextStep(step) {
  if (validateStep(step)) {
    document.getElementById(`step${step}Form`).classList.remove('active');
    currentStep = step + 1;
    document.getElementById(`step${currentStep}Form`).classList.add('active');
    updateProgress();
    if (currentStep === 4) updateSummary();
  }
}

function prevStep(step) {
  document.getElementById(`step${step}Form`).classList.remove('active');
  currentStep = step - 1;
  document.getElementById(`step${currentStep}Form`).classList.add('active');
  updateProgress();
}

function validateStep(step) {
  if (step === 2) {
    const fields = ['lastName', 'firstName', 'birthDate', 'birthPlace', 'personalCode'];
    for (let f of fields) {
      if (!document.getElementById(f).value.trim()) {
        showAlert('Заполните все обязательные поля', 'error');
        return false;
      }
    }
    const pc = document.getElementById('personalCode').value.trim();
    if (!/^\d{4}-\d{4}$/.test(pc)) {
      showAlert('Личный код должен быть в формате XXXX-XXXX (например: 1234-5678)', 'error');
      return false;
    }
  } else if (step === 3) {
    const p = document.getElementById('password').value;
    const cp = document.getElementById('confirmPassword').value;
    if (p.length < 8 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(p)) {
      showAlert('Пароль должен содержать минимум 8 символов, буквы и цифры', 'error');
      return false;
    }
    if (p !== cp) {
      showAlert('Пароли не совпадают', 'error');
      return false;
    }
  }
  return true;
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
    email: document.getElementById('email').value.trim(),
    permanentAddress: document.getElementById('permanentAddress')?.value.trim() || '',
    temporaryAddress: document.getElementById('temporaryAddress')?.value.trim() || '',
    residenceAddress: document.getElementById('residenceAddress')?.value.trim() || ''
  };
}

function updateSummary() {
  const d = getFormData();
  document.getElementById('registrationSummary').innerHTML = `
    <div class="summary-item"><span class="summary-label">ФИО:</span><span class="summary-value">${d.lastName} ${d.firstName} ${d.middleName}</span></div>
    <div class="summary-item"><span class="summary-label">Дата рождения:</span><span class="summary-value">${d.birthDate}</span></div>
    <div class="summary-item"><span class="summary-label">Место рождения:</span><span class="summary-value">${d.birthPlace}</span></div>
    <div class="summary-item"><span class="summary-label">Личный код:</span><span class="summary-value">${d.personalCode}</span></div>
    <div class="summary-item"><span class="summary-label">Email:</span><span class="summary-value">${d.email}</span></div>
    <div class="summary-item"><span class="summary-label">Телефон:</span><span class="summary-value">${d.phone}</span></div>
  `;
}

function updateProgress() {
  document.getElementById('progressFill').style.width = `${(currentStep / 4) * 100}%`;
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`step${i}`);
    el?.classList.toggle('active', i === currentStep);
  }
}

function formatPhoneNumber(e) {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length === 0) { e.target.value = ''; return; }
  if (v[0] === '7' || v[0] === '8') v = v.substring(1);
  let f = '+7 (';
  if (v.length > 0) f += v.substring(0, 3);
  if (v.length > 3) f += ') ' + v.substring(3, 6);
  if (v.length > 6) f += '-' + v.substring(6, 8);
  if (v.length > 8) f += '-' + v.substring(8, 10);
  e.target.value = f;
}

async function handleRegistration(e) {
  e.preventDefault();
  if (!document.getElementById('agreeTerms').checked || !document.getElementById('agreePrivacy').checked) {
    showAlert('Примите условия', 'error');
    return;
  }

  const data = getFormData();
  const pass = document.getElementById('password').value;
  showAlert('Регистрация...', 'info');

  try {
    const cred = await firebase.auth().createUserWithEmailAndPassword(data.email, pass);
    const code = await saveUserRegistrationData(cred.user.uid, data);
    localStorage.setItem('personalCode', code);
    showAlert(`<strong>Регистрация завершена!</strong><br>Ваш личный код: <code>${code}</code>`, 'success');
    setTimeout(() => window.location.href = 'profile.html', 4000);
  } catch (err) {
    let msg = 'Ошибка регистрации';
    if (err.code === 'auth/email-already-in-use') msg = 'Email уже используется';
    showAlert(msg, 'error');
  }
}

function showAlert(message, type) {
  const el = document.getElementById('alertMessage');
  if (!el) return;
  el.innerHTML = message;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}