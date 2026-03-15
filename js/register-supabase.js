import { supabase } from './supabase-config.js'

let currentStep = 1;
let accountType = null; // 'citizen', 'subject', 'organization'

document.addEventListener('DOMContentLoaded', () => {
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
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

window.selectAccountType = function() {
  const selected = document.querySelector('.account-type-option.selected');
  if (!selected) {
    showAlert('Выберите тип аккаунта', 'error');
    return;
  }
  accountType = selected.dataset.type;

  document.querySelectorAll('.category-fields').forEach(el => el.style.display = 'none');
  if (accountType === 'citizen') document.getElementById('citizenFields').style.display = 'block';
  else if (accountType === 'subject') document.getElementById('subjectFields').style.display = 'block';
  else if (accountType === 'organization') document.getElementById('orgFields').style.display = 'block';

  document.getElementById('step1Form').classList.remove('active');
  currentStep = 2;
  document.getElementById('step2Form').classList.add('active');
  updateProgress();
};

window.nextStep = function(step) {
  if (validateStep(step)) {
    document.getElementById(`step${step}Form`).classList.remove('active');
    currentStep = step + 1;
    document.getElementById(`step${currentStep}Form`).classList.add('active');
    updateProgress();
    if (currentStep === 4) updateSummary();
  }
};

window.prevStep = function(step) {
  document.getElementById(`step${step}Form`).classList.remove('active');
  currentStep = step - 1;
  document.getElementById(`step${currentStep}Form`).classList.add('active');
  updateProgress();
};

function validateStep(step) {
  if (step === 2) {
    if (!accountType) {
      showAlert('Сначала выберите тип аккаунта', 'error');
      return false;
    }

    if (accountType === 'citizen') {
      const fields = ['lastName', 'firstName', 'birthDate', 'birthPlace', 'personalCode', 'gender'];
      for (let f of fields) {
        if (!document.getElementById(f)?.value.trim()) {
          showAlert('Заполните все обязательные поля', 'error');
          return false;
        }
      }
      const pc = document.getElementById('personalCode').value.trim();
      if (!/^\d{4}-\d{4}$/.test(pc)) {
        showAlert('Личный код должен быть в формате XXXX-XXXX', 'error');
        return false;
      }
    } else if (accountType === 'subject') {
      const fields = ['subjectFullName', 'subjectBirthDate', 'subjectBirthPlace', 'subjectGender', 'nationality', 'passportNumber'];
      for (let f of fields) {
        if (!document.getElementById(f)?.value.trim()) {
          showAlert('Заполните все обязательные поля', 'error');
          return false;
        }
      }
    } else if (accountType === 'organization') {
      const fields = ['orgName', 'inn', 'ogrn', 'address', 'contactPerson'];
      for (let f of fields) {
        if (!document.getElementById(f)?.value.trim()) {
          showAlert('Заполните все обязательные поля', 'error');
          return false;
        }
      }
      const inn = document.getElementById('inn').value.trim();
      if (!/^\d{10}$|^\d{12}$/.test(inn)) {
        showAlert('ИНН должен содержать 10 или 12 цифр', 'error');
        return false;
      }
      const ogrn = document.getElementById('ogrn').value.trim();
      if (!/^\d{13}$/.test(ogrn)) {
        showAlert('ОГРН должен содержать 13 цифр', 'error');
        return false;
      }
    }
  } else if (step === 3) {
    // Проверка email
    let email = document.getElementById('email').value.trim().replace(/\s+/g, '').toLowerCase();
    document.getElementById('email').value = email;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('Введите корректный email', 'error');
      return false;
    }

    // Проверка телефона (обязательное поле)
    const phoneInput = document.getElementById('phone').value.trim();
    if (!phoneInput) {
      showAlert('Введите номер телефона', 'error');
      return false;
    }
    const phoneDigits = phoneInput.replace(/\D/g, '');
    // Российский номер: 10 цифр после кода страны или 11 с 7/8
    if (!/^(7|8)?\d{10}$/.test(phoneDigits)) {
      showAlert('Введите корректный российский номер телефона (10 цифр после кода)', 'error');
      return false;
    }

    // Проверка пароля
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

// Нормализация номера телефона к формату +7XXXXXXXXXX
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  // Если номер начинается с 8, заменяем на 7
  let normalized = digits;
  if (digits[0] === '8') {
    normalized = '7' + digits.substring(1);
  } else if (digits[0] !== '7') {
    // Если нет кода страны и 10 цифр — добавляем 7
    if (digits.length === 10) {
      normalized = '7' + digits;
    }
  }
  // Возвращаем в международном формате
  return '+' + normalized;
}

function getFormData() {
  const base = {
    email: document.getElementById('email').value.trim().replace(/\s+/g, '').toLowerCase(),
    phone: normalizePhone(document.getElementById('phone').value.trim())
  };

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
    };
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
    };
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
    };
  }
}

function updateSummary() {
  const d = getFormData();
  let html = '';
  if (accountType === 'citizen') {
    html = `
      <div><strong>ФИО:</strong> ${d.last_name} ${d.first_name} ${d.middle_name || ''}</div>
      <div><strong>Дата рождения:</strong> ${d.birth_date}</div>
      <div><strong>Место рождения:</strong> ${d.birth_place}</div>
      <div><strong>Личный код:</strong> ${d.personal_code}</div>
      <div><strong>Пол:</strong> ${d.gender}</div>
    `;
  } else if (accountType === 'subject') {
    html = `
      <div><strong>ФИО:</strong> ${d.full_name}</div>
      <div><strong>Дата рождения:</strong> ${d.birth_date}</div>
      <div><strong>Место рождения:</strong> ${d.birth_place}</div>
      <div><strong>Гражданство:</strong> ${d.nationality}</div>
      <div><strong>Паспорт:</strong> ${d.passport_number}</div>
    `;
  } else if (accountType === 'organization') {
    html = `
      <div><strong>Организация:</strong> ${d.organization_name}</div>
      <div><strong>ИНН:</strong> ${d.inn}</div>
      <div><strong>ОГРН:</strong> ${d.ogrn}</div>
      <div><strong>Адрес:</strong> ${d.address}</div>
    `;
  }
  html += `<div><strong>Email:</strong> ${d.email}</div>`;
  html += `<div><strong>Телефон:</strong> ${d.phone || '—'}</div>`;
  document.getElementById('registrationSummary').innerHTML = html;
}

function updateProgress() {
  const fill = document.getElementById('progressFill');
  if (fill) fill.style.width = `${(currentStep / 4) * 100}%`;
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`step${i}`);
    if (step) step.classList.toggle('active', i === currentStep);
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
    showAlert('Необходимо принять условия', 'error');
    return;
  }

  const formData = getFormData();
  const password = document.getElementById('password').value;

  showAlert('Регистрация...', 'info');

  try {
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: password,
      options: { data: { category: accountType } }
    });

    if (error) {
      if (error.status === 429) throw new Error('Слишком много попыток. Подождите.');
      throw error;
    }

    const userId = data.user.id;
    let tableName, record;

    if (accountType === 'citizen') {
      tableName = 'users';
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
        account_type: 'simplified',
        role: 'user'
      };
    } else if (accountType === 'subject') {
      tableName = 'subjects';
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
        account_type: 'simplified',
        role: 'user'
      };
    } else if (accountType === 'organization') {
      tableName = 'legal_entities';
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
        account_type: 'simplified',
        role: 'user'
      };
    }

    const { error: insertError } = await supabase.from(tableName).insert([record]);
    if (insertError) {
      // Если не удалось создать запись в таблице профиля, пробуем удалить пользователя из auth
      // (требует сервисной роли, но попытка не помешает)
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (adminError) {
        console.error('Не удалось откатить создание пользователя:', adminError);
      }
      throw insertError;
    }

    showAlert('Регистрация завершена! Письмо для подтверждения отправлено на email.', 'success');
    setTimeout(() => window.location.href = 'login.html', 4000);
  } catch (error) {
    console.error(error);
    let message = 'Ошибка регистрации';
    if (error.message.includes('duplicate key') || error.code === '23505') {
      if (error.message.includes('personal_code')) message = 'Личный код уже используется';
      else if (error.message.includes('passport_number')) message = 'Паспорт уже зарегистрирован';
      else if (error.message.includes('inn')) message = 'ИНН уже используется';
      else if (error.message.includes('ogrn')) message = 'ОГРН уже используется';
      else if (error.message.includes('email')) message = 'Этот email уже зарегистрирован';
      else message = 'Данные уже существуют';
    } else if (error.message.includes('already registered')) {
      message = 'Этот email уже зарегистрирован';
    } else if (error.message.includes('Слишком много попыток')) {
      message = error.message;
    }
    showAlert(message, 'error');
  }
}

function showAlert(message, type) {
  const el = document.getElementById('alertMessage');
  if (!el) return;
  el.innerHTML = message;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', type === 'success' ? 7000 : 5000);
}