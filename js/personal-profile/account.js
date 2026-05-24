// js/personal-profile/account.js
import { supabase } from '../supabase-config.js';

console.log('account.js загружен (с активными глобальными функциями)');

let currentUser = null;

// Элементы модальных окон
const passwordModal = document.getElementById('passwordModal');
const phoneModal = document.getElementById('phoneModal');
const emailModal = document.getElementById('emailModal');
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const messageModal = document.getElementById('messageModal');

// Функция открытия модалки
function openModal(modal) {
  if (modal) modal.classList.add('active');
}

// Функция закрытия модалки (и очистка полей)
function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  // Очищаем все поля ввода внутри модалки
  const inputs = modal.querySelectorAll('input');
  inputs.forEach(input => input.value = '');
  const errors = modal.querySelectorAll('.error-message');
  errors.forEach(err => err.textContent = '');
}

// Глобальные функции для закрытия конкретных модалок (для inline onclick)
window.closePasswordModal = () => closeModal(passwordModal);
window.closePhoneModal = () => closeModal(phoneModal);
window.closeEmailModal = () => closeModal(emailModal);
window.closeConfirmDeleteModal = () => closeModal(confirmDeleteModal);
window.closeMessageModal = () => closeModal(messageModal);

// Закрытие по крестику (все .close внутри .modal)
document.querySelectorAll('.modal .close').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const modal = btn.closest('.modal');
    if (modal) closeModal(modal);
  });
});

// Закрытие по клику на фон (оверлей)
window.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal')) {
    closeModal(e.target);
  }
});

// Показать информационное сообщение в специальной модалке
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

// Загрузка данных пользователя
async function loadAccountData() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Пользователь не авторизован');
    currentUser = user;
    document.getElementById('userIdValue').textContent = user.id;

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('phone, email, account_type')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    document.getElementById('phoneValue').textContent = profile?.phone || user.phone || '—';
    document.getElementById('emailValue').textContent = profile?.email || user.email || '—';

    const accountType = profile?.account_type || 'simple';
    let typeText = '', helpText = '';
    if (accountType === 'simple') {
      typeText = 'Упрощённая';
      helpText = 'Требуется подтверждение email или телефона.';
    } else if (accountType === 'standard') {
      typeText = 'Стандартная';
      helpText = 'Один из контактов подтверждён.';
    } else if (accountType === 'verified') {
      typeText = 'Подтверждённая';
      helpText = 'Все контакты верифицированы.';
    }
    document.getElementById('accountTypeValue').textContent = typeText;
    document.getElementById('accountTypeHelp').textContent = helpText;

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
      .update({ phone: newPhone })
      .eq('id', currentUser.id);
    if (updateError) throw updateError;
    document.getElementById('phoneValue').textContent = newPhone;
    closeModal(phoneModal);
    showMessage('Успешно', 'Номер телефона обновлён.');
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
    await supabase.from('users').update({ email: newEmail }).eq('id', currentUser.id);
    document.getElementById('emailValue').textContent = newEmail;
    closeModal(emailModal);
    showMessage('Успешно', 'Email обновлён. Проверьте новый почтовый ящик для подтверждения.');
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