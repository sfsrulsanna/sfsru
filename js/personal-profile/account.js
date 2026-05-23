// js/personal-profile/account.js
import { supabase } from '../supabase-config.js';

console.log('account.js загружен');

let currentUser = null;

// Элементы DOM
const loadingDiv = document.getElementById('loading');
const accountDiv = document.getElementById('accountData');
const phoneSpan = document.getElementById('phoneValue');
const emailSpan = document.getElementById('emailValue');
const accountTypeSpan = document.getElementById('accountTypeValue');
const accountTypeHelp = document.getElementById('accountTypeHelp');
const userIdSpan = document.getElementById('userIdValue');

// Все модальные окна
const modals = {
  password: document.getElementById('passwordModal'),
  phone: document.getElementById('phoneModal'),
  email: document.getElementById('emailModal'),
  delete: document.getElementById('confirmDeleteModal'),
  message: document.getElementById('messageModal')
};

// Функция закрытия любого модального окна
function closeModal(modal) {
  if (!modal) return;
  modal.style.display = 'none';
  // Очищаем поля и ошибки внутри этого модального окна
  const inputs = modal.querySelectorAll('input');
  inputs.forEach(input => input.value = '');
  const errors = modal.querySelectorAll('.error-message');
  errors.forEach(err => err.textContent = '');
}

// Закрытие по клику на крестик (для всех модалок)
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

// Показать информационное сообщение
function showMessage(title, text, isError = false) {
  const msgTitle = document.getElementById('messageTitle');
  const msgText = document.getElementById('messageText');
  if (msgTitle) msgTitle.textContent = title;
  if (msgText) {
    msgText.innerHTML = text;
    msgText.style.color = isError ? '#b91c1c' : 'inherit';
  }
  if (modals.message) modals.message.style.display = 'flex';
}

// Загрузка данных пользователя
async function loadAccountData() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Пользователь не авторизован');
    currentUser = user;
    userIdSpan.textContent = user.id;

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('phone, email, account_type')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    phoneSpan.textContent = profile?.phone || user.phone || '—';
    emailSpan.textContent = profile?.email || user.email || '—';

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
    accountTypeSpan.textContent = typeText;
    accountTypeHelp.textContent = helpText;

    loadingDiv.style.display = 'none';
    accountDiv.style.display = 'block';
  } catch (err) {
    console.error(err);
    loadingDiv.textContent = 'Ошибка загрузки: ' + err.message;
  }
}

// Копирование UUID
document.getElementById('copyUuidBtn')?.addEventListener('click', async () => {
  const uuid = userIdSpan.textContent;
  if (uuid && uuid !== '—') {
    try {
      await navigator.clipboard.writeText(uuid);
      showMessage('Скопировано', 'UUID успешно скопирован.');
    } catch {
      showMessage('Ошибка', 'Не удалось скопировать UUID.', true);
    }
  } else {
    showMessage('Ошибка', 'UUID не найден.', true);
  }
});

// === Изменение телефона ===
document.getElementById('editPhoneBtn')?.addEventListener('click', () => {
  if (modals.phone) modals.phone.style.display = 'flex';
});
document.getElementById('submitPhoneBtn')?.addEventListener('click', async () => {
  const newPhone = document.getElementById('newPhone')?.value.trim();
  const password = document.getElementById('phonePassword')?.value;
  const errorDiv = document.getElementById('phoneError');
  if (!newPhone) { errorDiv.textContent = 'Введите номер телефона.'; return; }
  if (!password) { errorDiv.textContent = 'Введите пароль.'; return; }
  try {
    // Проверка пароля
    const { error: verifyError } = await supabase.auth.updateUser(
      { email: currentUser.email },
      { currentPassword: password }
    );
    if (verifyError) throw new Error('Неверный пароль');
    // Обновление телефона
    const { error: updateError } = await supabase
      .from('users')
      .update({ phone: newPhone })
      .eq('id', currentUser.id);
    if (updateError) throw updateError;
    phoneSpan.textContent = newPhone;
    closeModal(modals.phone);
    showMessage('Успешно', 'Номер телефона обновлён.');
  } catch (err) {
    errorDiv.textContent = err.message;
  }
});

// === Изменение email ===
document.getElementById('editEmailBtn')?.addEventListener('click', () => {
  if (modals.email) modals.email.style.display = 'flex';
});
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
    emailSpan.textContent = newEmail;
    closeModal(modals.email);
    showMessage('Успешно', 'Email обновлён. Проверьте новый почтовый ящик для подтверждения.');
  } catch (err) {
    errorDiv.textContent = err.message;
  }
});

// === Смена пароля ===
document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
  if (modals.password) modals.password.style.display = 'flex';
});
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
    closeModal(modals.password);
    showMessage('Пароль изменён', 'Пароль успешно изменён. Войдите заново с новым паролем.');
    await supabase.auth.signOut();
    setTimeout(() => { window.location.href = '../login.html'; }, 2000);
  } catch (err) {
    errorDiv.textContent = err.message;
  }
});

// === Удаление аккаунта ===
document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
  if (modals.delete) modals.delete.style.display = 'flex';
});
document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
  const password = document.getElementById('deletePassword')?.value;
  const errorDiv = document.getElementById('deleteError');
  if (!password) {
    errorDiv.textContent = 'Введите пароль для удаления.';
    return;
  }
  try {
    // Проверка пароля
    const { error: verifyError } = await supabase.auth.updateUser(
      { email: currentUser.email },
      { currentPassword: password }
    );
    if (verifyError) throw new Error('Неверный пароль');
    // Вызов Edge Function для удаления
    const { error: fnError } = await supabase.functions.invoke('delete-user', {
      body: { userId: currentUser.id }
    });
    if (fnError) throw fnError;
    await supabase.auth.signOut();
    closeModal(modals.delete);
    showMessage('Учётная запись удалена', 'Ваша учётная запись полностью удалена. Вы будете перенаправлены на главную страницу.');
    setTimeout(() => { window.location.href = '../index.html'; }, 2000);
  } catch (err) {
    errorDiv.textContent = err.message;
  }
});

// Запуск
loadAccountData();