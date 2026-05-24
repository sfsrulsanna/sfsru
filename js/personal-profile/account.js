// js/personal-profile/account.js
import { supabase } from '../supabase-config.js';

console.log('account.js загружен (с повышением до стандартной)');

let currentUser = null;

const passwordModal = document.getElementById('passwordModal');
const phoneModal = document.getElementById('phoneModal');
const emailModal = document.getElementById('emailModal');
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const messageModal = document.getElementById('messageModal');

function openModal(modal) {
  if (modal) modal.classList.add('active');
}
function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  const inputs = modal.querySelectorAll('input');
  inputs.forEach(input => input.value = '');
  const errors = modal.querySelectorAll('.error-message');
  errors.forEach(err => err.textContent = '');
}

window.closePasswordModal = () => closeModal(passwordModal);
window.closePhoneModal = () => closeModal(phoneModal);
window.closeEmailModal = () => closeModal(emailModal);
window.closeConfirmDeleteModal = () => closeModal(confirmDeleteModal);
window.closeMessageModal = () => closeModal(messageModal);

document.querySelectorAll('.modal .close').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const modal = btn.closest('.modal');
    if (modal) closeModal(modal);
  });
});
window.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal')) {
    closeModal(e.target);
  }
});

function showMessage(title, text, isError = false) {
  const msgTitle = document.getElementById('messageTitle');
  const msgText = document.getElementById('messageText');
  if (msgTitle) msgTitle.textContent = title;
  if (msgText) {
    msgText.innerHTML = text;
    msgText.style.color = isError ? '#b91c1c' : 'inherit';
  }
  openModal(messageModal);
}

function updateStatusBadge(elementId, status) {
  const el = document.getElementById(elementId);
  if (!el) return;
  let text = '', className = '';
  if (status === 'verified' || status === 'Подтверждённая') {
    text = '✅ Подтверждено';
    className = 'status-badge status-verified';
  } else if (status === 'oncheck' || status === 'Стандартная') {
    text = '⏳ На проверке / Стандартная';
    className = 'status-badge status-pending';
  } else if (status === 'rejected') {
    text = '❌ Отклонено';
    className = 'status-badge status-rejected';
  } else if (status === 'Упрощённая') {
    text = '⚠️ Упрощённая';
    className = 'status-badge';
  } else {
    text = '⚠️ Не подтверждено';
    className = 'status-badge';
  }
  el.textContent = text;
  el.className = className;
}

// Проверка возможности повышения
async function canUpgradeToStandard() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { can: false, missing: ['Пользователь не авторизован'] };
  
  const missing = [];
  
  // Проверка телефона и email
  const { data: profile } = await supabase
    .from('users')
    .select('phone_status, email_status')
    .eq('id', user.id)
    .single();
    
  if (!profile || profile.phone_status !== 'verified') {
    missing.push('номер телефона (не подтверждён)');
  }
  if (!profile || profile.email_status !== 'verified') {
    missing.push('email (не подтверждён)');
  }
  
  // Проверка паспорта по личному коду
  const { data: userData } = await supabase
    .from('users')
    .select('personal_code')
    .eq('id', user.id)
    .single();
    
  if (userData && userData.personal_code) {
    const { data: passport } = await supabase
      .from('passport')
      .select('status')
      .eq('personal_code', userData.personal_code)
      .maybeSingle();
    if (!passport || passport.status !== 'verified') {
      missing.push('паспортные данные (не подтверждены)');
    }
  } else {
    missing.push('паспортные данные (личный код отсутствует)');
  }
  
  return { can: missing.length === 0, missing };
}

// Повышение до стандартной
async function upgradeToStandard() {
  const { can, missing } = await canUpgradeToStandard();
  if (!can) {
    let message = 'Невозможно повысить тип учётной записи до «Стандартная».<br>Не выполнены условия:<br><ul>';
    missing.forEach(item => message += `<li>${item}</li>`);
    message += '</ul>';
    showMessage('Повышение невозможно', message, true);
    return;
  }
  
  try {
    const { error } = await supabase
      .from('users')
      .update({ account_type: 'Стандартная' })
      .eq('id', currentUser.id);
    if (error) throw error;
    
    document.getElementById('accountTypeValue').textContent = 'Стандартная';
    updateStatusBadge('accountTypeBadge', 'Стандартная');
    document.getElementById('accountTypeHelp').textContent = 'Один из контактов подтверждён.';
    const upgradeBtn = document.getElementById('upgradeToStandardBtn');
    if (upgradeBtn) upgradeBtn.style.display = 'none';
    
    showMessage('Успешно', 'Тип учётной записи повышен до «Стандартная».');
  } catch (err) {
    showMessage('Ошибка', err.message, true);
  }
}

async function loadAccountData() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Пользователь не авторизован');
    currentUser = user;
    document.getElementById('userIdValue').textContent = user.id;

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('phone, email, phone_status, email_status, account_type')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    const phone = profile?.phone || user.phone || '—';
    const email = profile?.email || user.email || '—';
    document.getElementById('phoneValue').textContent = phone;
    document.getElementById('emailValue').textContent = email;

    const phoneStatus = profile?.phone_status || (user.phone ? 'not_verified' : 'none');
    const emailStatus = profile?.email_status || (user.email_confirmed_at ? 'verified' : 'not_verified');
    updateStatusBadge('phoneStatus', phoneStatus);
    updateStatusBadge('emailStatus', emailStatus);

    const accountType = profile?.account_type || 'Упрощённая';
    document.getElementById('accountTypeValue').textContent = accountType;
    updateStatusBadge('accountTypeBadge', accountType);

    let helpText = '';
    if (accountType === 'Упрощённая') helpText = 'Требуется подтверждение email и телефона, а также верификация паспорта.';
    else if (accountType === 'Стандартная') helpText = 'Один из контактов подтверждён.';
    else if (accountType === 'Подтверждённая') helpText = 'Все контакты верифицированы.';
    document.getElementById('accountTypeHelp').textContent = helpText;

    // Показать кнопку повышения, если тип "Упрощённая"
    const upgradeRow = document.getElementById('upgradeButtonRow');
    if (accountType === 'Упрощённая') {
      if (upgradeRow) upgradeRow.style.display = 'flex';
      const upgradeBtn = document.getElementById('upgradeToStandardBtn');
      if (upgradeBtn) upgradeBtn.onclick = upgradeToStandard;
    } else {
      if (upgradeRow) upgradeRow.style.display = 'none';
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('accountData').style.display = 'block';
  } catch (err) {
    console.error(err);
    document.getElementById('loading').textContent = 'Ошибка загрузки: ' + err.message;
  }
}

// Копирование UUID
document.getElementById('copyUuidBtn')?.addEventListener('click', async () => {
  const uuid = document.getElementById('userIdValue').textContent;
  if (uuid && uuid !== '—') {
    try {
      await navigator.clipboard.writeText(uuid);
      showMessage('Скопировано', 'UUID скопирован.');
    } catch {
      showMessage('Ошибка', 'Не удалось скопировать UUID.', true);
    }
  } else {
    showMessage('Ошибка', 'UUID не найден.', true);
  }
});

// === Изменение телефона ===
document.getElementById('editPhoneBtn')?.addEventListener('click', () => openModal(phoneModal));
document.getElementById('submitPhoneBtn')?.addEventListener('click', async () => {
  const newPhone = document.getElementById('newPhone')?.value.trim();
  const password = document.getElementById('phonePassword')?.value;
  const errorDiv = document.getElementById('phoneError');
  if (!newPhone) { errorDiv.textContent = 'Введите номер телефона.'; return; }
  if (!password) { errorDiv.textContent = 'Введите пароль.'; return; }
  try {
    const { error: verifyError } = await supabase.auth.updateUser(
      { email: currentUser.email },
      { currentPassword: password }
    );
    if (verifyError) throw new Error('Неверный пароль');
    const { error: updateError } = await supabase
      .from('users')
      .update({ phone: newPhone, phone_status: 'oncheck' })
      .eq('id', currentUser.id);
    if (updateError) throw updateError;
    document.getElementById('phoneValue').textContent = newPhone;
    updateStatusBadge('phoneStatus', 'oncheck');
    closeModal(phoneModal);
    showMessage('Успешно', 'Номер телефона обновлён, данные отправлены на проверку.');
  } catch (err) {
    errorDiv.textContent = err.message;
  }
});

// === Изменение email ===
document.getElementById('editEmailBtn')?.addEventListener('click', () => openModal(emailModal));
document.getElementById('submitEmailBtn')?.addEventListener('click', async () => {
  const newEmail = document.getElementById('newEmail')?.value.trim();
  const password = document.getElementById('emailPassword')?.value;
  const errorDiv = document.getElementById('emailError');
  if (!newEmail) { errorDiv.textContent = 'Введите email.'; return; }
  if (!password) { errorDiv.textContent = 'Введите пароль.'; return; }
  try {
    const { error: updateError } = await supabase.auth.updateUser(
      { email: newEmail },
      { currentPassword: password }
    );
    if (updateError) throw updateError;
    await supabase
      .from('users')
      .update({ email: newEmail, email_status: 'oncheck' })
      .eq('id', currentUser.id);
    document.getElementById('emailValue').textContent = newEmail;
    updateStatusBadge('emailStatus', 'oncheck');
    closeModal(emailModal);
    showMessage('Успешно', 'Email обновлён, проверьте новый почтовый ящик для подтверждения.');
  } catch (err) {
    errorDiv.textContent = err.message;
  }
});

// === Смена пароля ===
document.getElementById('changePasswordBtn')?.addEventListener('click', () => openModal(passwordModal));
document.getElementById('submitPasswordBtn')?.addEventListener('click', async () => {
  const current = document.getElementById('currentPassword')?.value;
  const newPwd = document.getElementById('newPassword')?.value;
  const confirm = document.getElementById('confirmPassword')?.value;
  const errorDiv = document.getElementById('passwordError');
  if (!current || !newPwd || !confirm) {
    errorDiv.textContent = 'Заполните все поля.';
    return;
  }
  if (newPwd !== confirm) {
    errorDiv.textContent = 'Новый пароль и подтверждение не совпадают.';
    return;
  }
  if (newPwd.length < 6) {
    errorDiv.textContent = 'Пароль должен содержать не менее 6 символов.';
    return;
  }
  try {
    const { error } = await supabase.auth.updateUser(
      { password: newPwd },
      { currentPassword: current }
    );
    if (error) throw error;
    closeModal(passwordModal);
    showMessage('Пароль изменён', 'Пароль успешно изменён. Войдите заново.');
    await supabase.auth.signOut();
    setTimeout(() => { window.location.href = '../login.html'; }, 2000);
  } catch (err) {
    errorDiv.textContent = err.message;
  }
});

// === Удаление аккаунта ===
document.getElementById('deleteAccountBtn')?.addEventListener('click', () => openModal(confirmDeleteModal));
document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
  const password = document.getElementById('deletePassword')?.value;
  const errorDiv = document.getElementById('deleteError');
  if (!password) {
    errorDiv.textContent = 'Введите пароль для удаления.';
    return;
  }
  try {
    const { error: verifyError } = await supabase.auth.updateUser(
      { email: currentUser.email },
      { currentPassword: password }
    );
    if (verifyError) throw new Error('Неверный пароль');
    const { error: fnError } = await supabase.functions.invoke('delete-user', {
      body: { userId: currentUser.id }
    });
    if (fnError) throw fnError;
    await supabase.auth.signOut();
    closeModal(confirmDeleteModal);
    showMessage('Учётная запись удалена', 'Ваша учётная запись удалена. Перенаправление...');
    setTimeout(() => { window.location.href = '../index.html'; }, 2000);
  } catch (err) {
    errorDiv.textContent = err.message;
  }
});

loadAccountData();