// js/personal-profile/account.js
import { supabase } from '../supabase-config.js';

console.log('account.js загружен');

let currentUser = null;

// Функция для логирования найденных элементов
function logElement(id, element) {
  if (element) {
    console.log(`✓ Найден элемент: ${id}`);
  } else {
    console.error(`✗ Элемент не найден: ${id}`);
  }
}

// Элементы DOM - проверяем их наличие
const loadingDiv = document.getElementById('loading');
const accountDiv = document.getElementById('accountData');
const phoneSpan = document.getElementById('phoneValue');
const emailSpan = document.getElementById('emailValue');
const accountTypeSpan = document.getElementById('accountTypeValue');
const accountTypeHelp = document.getElementById('accountTypeHelp');
const userIdSpan = document.getElementById('userIdValue');

logElement('loading', loadingDiv);
logElement('accountData', accountDiv);
logElement('phoneValue', phoneSpan);
logElement('emailValue', emailSpan);
logElement('accountTypeValue', accountTypeSpan);
logElement('accountTypeHelp', accountTypeHelp);
logElement('userIdValue', userIdSpan);

// Все модальные окна
const passwordModal = document.getElementById('passwordModal');
const phoneModal = document.getElementById('phoneModal');
const emailModal = document.getElementById('emailModal');
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const messageModal = document.getElementById('messageModal');

logElement('passwordModal', passwordModal);
logElement('phoneModal', phoneModal);
logElement('emailModal', emailModal);
logElement('confirmDeleteModal', confirmDeleteModal);
logElement('messageModal', messageModal);

// Функция закрытия модального окна
function closeModal(modal) {
  if (!modal) return;
  modal.style.display = 'none';
  // Очищаем поля
  const inputs = modal.querySelectorAll('input');
  inputs.forEach(input => input.value = '');
  const errors = modal.querySelectorAll('.error-message');
  errors.forEach(err => err.textContent = '');
}

// Закрытие по клику на крестик - ищем все .close внутри .modal
document.querySelectorAll('.modal .close').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const modal = btn.closest('.modal');
    if (modal) closeModal(modal);
  });
});

// Закрытие по клику на фон
window.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal')) {
    closeModal(e.target);
  }
});

// Показать сообщение
function showMessage(title, text, isError = false) {
  const msgTitle = document.getElementById('messageTitle');
  const msgText = document.getElementById('messageText');
  if (msgTitle) msgTitle.textContent = title;
  if (msgText) {
    msgText.innerHTML = text;
    msgText.style.color = isError ? '#b91c1c' : 'inherit';
  }
  if (messageModal) messageModal.style.display = 'flex';
}

// Загрузка данных
async function loadAccountData() {
  console.log('loadAccountData вызвана');
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Пользователь не авторизован');
    currentUser = user;
    userIdSpan.textContent = user.id;
    console.log('Пользователь загружен:', user.id);

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
    console.log('Данные загружены, accountDiv показан');
  } catch (err) {
    console.error(err);
    if (loadingDiv) loadingDiv.textContent = 'Ошибка загрузки: ' + err.message;
  }
}

// Копирование UUID
const copyUuidBtn = document.getElementById('copyUuidBtn');
logElement('copyUuidBtn', copyUuidBtn);
if (copyUuidBtn) {
  copyUuidBtn.addEventListener('click', async () => {
    const uuid = userIdSpan.textContent;
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
}

// === Изменение телефона ===
const editPhoneBtn = document.getElementById('editPhoneBtn');
const submitPhoneBtn = document.getElementById('submitPhoneBtn');
logElement('editPhoneBtn', editPhoneBtn);
logElement('submitPhoneBtn', submitPhoneBtn);
if (editPhoneBtn) {
  editPhoneBtn.addEventListener('click', () => {
    console.log('editPhoneBtn клик');
    if (phoneModal) phoneModal.style.display = 'flex';
    else console.error('phoneModal не найден');
  });
}
if (submitPhoneBtn) {
  submitPhoneBtn.addEventListener('click', async () => {
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
      phoneSpan.textContent = newPhone;
      closeModal(phoneModal);
      showMessage('Успешно', 'Номер телефона обновлён.');
    } catch (err) {
      errorDiv.textContent = err.message;
    }
  });
}

// === Изменение email ===
const editEmailBtn = document.getElementById('editEmailBtn');
const submitEmailBtn = document.getElementById('submitEmailBtn');
logElement('editEmailBtn', editEmailBtn);
logElement('submitEmailBtn', submitEmailBtn);
if (editEmailBtn) {
  editEmailBtn.addEventListener('click', () => {
    console.log('editEmailBtn клик');
    if (emailModal) emailModal.style.display = 'flex';
  });
}
if (submitEmailBtn) {
  submitEmailBtn.addEventListener('click', async () => {
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
      closeModal(emailModal);
      showMessage('Успешно', 'Email обновлён. Проверьте новый почтовый ящик для подтверждения.');
    } catch (err) {
      errorDiv.textContent = err.message;
    }
  });
}

// === Смена пароля ===
const changePasswordBtn = document.getElementById('changePasswordBtn');
const submitPasswordBtn = document.getElementById('submitPasswordBtn');
logElement('changePasswordBtn', changePasswordBtn);
logElement('submitPasswordBtn', submitPasswordBtn);
if (changePasswordBtn) {
  changePasswordBtn.addEventListener('click', () => {
    console.log('changePasswordBtn клик');
    if (passwordModal) passwordModal.style.display = 'flex';
  });
}
if (submitPasswordBtn) {
  submitPasswordBtn.addEventListener('click', async () => {
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
}

// === Удаление аккаунта ===
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
logElement('deleteAccountBtn', deleteAccountBtn);
logElement('confirmDeleteBtn', confirmDeleteBtn);
if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener('click', () => {
    console.log('deleteAccountBtn клик');
    if (confirmDeleteModal) confirmDeleteModal.style.display = 'flex';
  });
}
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener('click', async () => {
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
}

// Запуск
loadAccountData();