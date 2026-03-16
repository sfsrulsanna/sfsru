import { supabase } from './supabase-config.js'

let currentStep = 1;
let accountType = null;

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

window.selectAccountType = function() { /* ... как раньше ... */ };
window.nextStep = function(step) { /* ... как раньше ... */ };
window.prevStep = function(step) { /* ... как раньше ... */ };
function validateStep(step) { /* ... как раньше ... */ }
function normalizePhone(phone) { /* ... как раньше ... */ }
function getFormData() { /* ... как раньше ... */ }
function updateSummary() { /* ... как раньше ... */ }
function updateProgress() { /* ... как раньше ... */ }
function formatPhoneNumber(e) { /* ... как раньше ... */ }

function showSuccessWithButton(message, buttonText, buttonLink) {
  const alertDiv = document.getElementById('alertMessage');
  if (!alertDiv) return;
  alertDiv.innerHTML = `
    <div style="text-align: center;">
      <p>${message}</p>
      <a href="${buttonLink}" class="btn" style="display: inline-block; margin-top: 10px; background: #7b0000; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">${buttonText}</a>
    </div>
  `;
  alertDiv.className = 'alert alert-success';
  alertDiv.style.display = 'block';
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
    // 1. Создаём пользователя в auth
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: password
    });

    if (error) {
      if (error.status === 429) throw new Error('Слишком много попыток. Подождите.');
      throw error;
    }

    const userId = data.user.id;
    let tableName, record;

    // 2. Определяем таблицу и данные для вставки
    if (accountType === 'citizen') {
      tableName = 'users';
      record = {
        id: userId,
        email: formData.email,
        phone: formData.phone,
        last_name: formData.last_name,
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        birth_date: formData.birth_date,
        birth_place: formData.birth_place,
        personal_code: formData.personal_code,
        gender: formData.gender,
        account_type: 'simplified',
        role: 'user'
      };
    } else if (accountType === 'subject') {
      tableName = 'subjects';
      record = {
        id: userId,
        email: formData.email,
        phone: formData.phone,
        full_name: formData.full_name,
        birth_date: formData.birth_date,
        birth_place: formData.birth_place,
        gender: formData.gender,
        nationality: formData.nationality,
        passport_number: formData.passport_number,
        account_type: 'simplified',
        role: 'user'
      };
    } else if (accountType === 'organization') {
      tableName = 'legal_entities';
      record = {
        id: userId,
        email: formData.email,
        phone: formData.phone,
        organization_name: formData.organization_name,
        inn: formData.inn,
        kpp: formData.kpp,
        ogrn: formData.ogrn,
        address: formData.address,
        contact_person: formData.contact_person,
        account_type: 'simplified',
        role: 'user'
      };
    }

    // 3. Вставляем запись в таблицу профиля
    const { error: insertError } = await supabase
      .from(tableName)
      .insert([record]);

    if (insertError) throw insertError;

    // 4. Успех
    showSuccessWithButton(
      'Регистрация прошла успешно! Теперь вы можете войти.',
      'Перейти на страницу входа',
      'login.html'
    );
    document.getElementById('registrationForm').style.display = 'none';

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
  if (type !== 'success') {
    setTimeout(() => el.style.display = 'none', 5000);
  }
}