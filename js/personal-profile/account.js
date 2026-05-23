// js/personal-profile/account.js
import { supabase } from '../supabase-config.js'

let currentUser = null

// Элементы DOM
const loadingDiv = document.getElementById('loading')
const accountDiv = document.getElementById('accountData')
const phoneSpan = document.getElementById('phoneValue')
const emailSpan = document.getElementById('emailValue')
const accountTypeSpan = document.getElementById('accountTypeValue')
const accountTypeHelp = document.getElementById('accountTypeHelp')
const userIdSpan = document.getElementById('userIdValue')
const copyUuidBtn = document.getElementById('copyUuidBtn')
const editPhoneBtn = document.getElementById('editPhoneBtn')
const editEmailBtn = document.getElementById('editEmailBtn')
const changePasswordBtn = document.getElementById('changePasswordBtn')
const deleteAccountBtn = document.getElementById('deleteAccountBtn')

// Модальные окна
const passwordModal = document.getElementById('passwordModal')
const phoneModal = document.getElementById('phoneModal')
const emailModal = document.getElementById('emailModal')
const confirmDeleteModal = document.getElementById('confirmDeleteModal')
const messageModal = document.getElementById('messageModal')

// Функции для показа сообщений
function showMessage(title, text, isError = false) {
  document.getElementById('messageTitle').textContent = title
  const msgDiv = document.getElementById('messageText')
  msgDiv.innerHTML = text
  if (isError) {
    msgDiv.style.color = '#b91c1c'
  } else {
    msgDiv.style.color = 'inherit'
  }
  messageModal.style.display = 'flex'
}

function closeMessageModal() {
  messageModal.style.display = 'none'
}

// Вспомогательная функция для закрытия всех модалок
function closeAllModals() {
  passwordModal.style.display = 'none'
  phoneModal.style.display = 'none'
  emailModal.style.display = 'none'
  confirmDeleteModal.style.display = 'none'
}

// Загрузка данных из таблицы users и auth
async function loadAccountData() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Пользователь не авторизован')
    currentUser = user
    userIdSpan.textContent = user.id

    // Получаем данные из таблицы users
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('phone, email, account_type')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') throw profileError

    phoneSpan.textContent = profile?.phone || user.phone || '—'
    emailSpan.textContent = profile?.email || user.email || '—'

    // Тип учётной записи из БД
    let accountType = profile?.account_type || 'simple'
    let helpText = ''
    if (accountType === 'simple') helpText = 'Упрощённая запись: требуется подтверждение email или телефона.'
    else if (accountType === 'standard') helpText = 'Стандартная запись: один из контактов подтверждён.'
    else if (accountType === 'verified') helpText = 'Подтверждённая запись: все контакты верифицированы.'
    else helpText = 'Неизвестный тип'

    accountTypeSpan.textContent = accountType === 'simple' ? 'Упрощённая' : (accountType === 'standard' ? 'Стандартная' : 'Подтверждённая')
    accountTypeHelp.textContent = helpText

    loadingDiv.style.display = 'none'
    accountDiv.style.display = 'block'
  } catch (err) {
    console.error(err)
    loadingDiv.textContent = 'Ошибка загрузки: ' + err.message
  }
}

// Копирование UUID
copyUuidBtn.addEventListener('click', async () => {
  const uuid = userIdSpan.textContent
  if (uuid && uuid !== '—') {
    try {
      await navigator.clipboard.writeText(uuid)
      showMessage('Скопировано', 'UUID успешно скопирован в буфер обмена.')
    } catch (err) {
      showMessage('Ошибка', 'Не удалось скопировать UUID.', true)
    }
  } else {
    showMessage('Ошибка', 'UUID не найден.', true)
  }
})

// --- Изменение телефона ---
function closePhoneModal() {
  phoneModal.style.display = 'none'
  document.getElementById('newPhone').value = ''
  document.getElementById('phonePassword').value = ''
  document.getElementById('phoneError').textContent = ''
}

editPhoneBtn.addEventListener('click', () => {
  phoneModal.style.display = 'flex'
})

document.getElementById('submitPhoneBtn').addEventListener('click', async () => {
  const newPhone = document.getElementById('newPhone').value.trim()
  const password = document.getElementById('phonePassword').value
  const errorDiv = document.getElementById('phoneError')

  if (!newPhone) {
    errorDiv.textContent = 'Введите номер телефона.'
    return
  }
  if (!password) {
    errorDiv.textContent = 'Введите пароль для подтверждения.'
    return
  }

  try {
    // Сначала проверим пароль, попытавшись обновить любые данные (например, email)
    // Лучше вызвать updateUser с пустыми данными, но с currentPassword. Если пароль неверен, будет ошибка.
    const { error: verifyError } = await supabase.auth.updateUser(
      { email: currentUser.email },
      { currentPassword: password }
    )
    if (verifyError) throw new Error('Неверный пароль')

    // Обновляем телефон в таблице users
    const { error: updateError } = await supabase
      .from('users')
      .update({ phone: newPhone })
      .eq('id', currentUser.id)

    if (updateError) throw updateError

    // Обновляем отображение
    phoneSpan.textContent = newPhone
    closePhoneModal()
    showMessage('Успешно', 'Номер телефона обновлён.')
  } catch (err) {
    errorDiv.textContent = err.message
  }
})

// --- Изменение email ---
function closeEmailModal() {
  emailModal.style.display = 'none'
  document.getElementById('newEmail').value = ''
  document.getElementById('emailPassword').value = ''
  document.getElementById('emailError').textContent = ''
}

editEmailBtn.addEventListener('click', () => {
  emailModal.style.display = 'flex'
})

document.getElementById('submitEmailBtn').addEventListener('click', async () => {
  const newEmail = document.getElementById('newEmail').value.trim()
  const password = document.getElementById('emailPassword').value
  const errorDiv = document.getElementById('emailError')

  if (!newEmail) {
    errorDiv.textContent = 'Введите email.'
    return
  }
  if (!password) {
    errorDiv.textContent = 'Введите пароль для подтверждения.'
    return
  }

  try {
    // Меняем email через Supabase Auth (требует текущий пароль)
    const { error: updateError } = await supabase.auth.updateUser(
      { email: newEmail },
      { currentPassword: password }
    )
    if (updateError) throw updateError

    // Обновляем email в таблице users
    await supabase
      .from('users')
      .update({ email: newEmail })
      .eq('id', currentUser.id)

    emailSpan.textContent = newEmail
    closeEmailModal()
    showMessage('Успешно', 'Email обновлён. Проверьте новый почтовый ящик для подтверждения.')
  } catch (err) {
    errorDiv.textContent = err.message
  }
})

// --- Смена пароля ---
function closePasswordModal() {
  passwordModal.style.display = 'none'
  document.getElementById('currentPassword').value = ''
  document.getElementById('newPassword').value = ''
  document.getElementById('confirmPassword').value = ''
  document.getElementById('passwordError').textContent = ''
}

changePasswordBtn.addEventListener('click', () => {
  passwordModal.style.display = 'flex'
})

document.getElementById('submitPasswordBtn').addEventListener('click', async () => {
  const current = document.getElementById('currentPassword').value
  const newPwd = document.getElementById('newPassword').value
  const confirm = document.getElementById('confirmPassword').value
  const errorDiv = document.getElementById('passwordError')

  if (!current || !newPwd || !confirm) {
    errorDiv.textContent = 'Заполните все поля.'
    return
  }
  if (newPwd !== confirm) {
    errorDiv.textContent = 'Новый пароль и подтверждение не совпадают.'
    return
  }
  if (newPwd.length < 6) {
    errorDiv.textContent = 'Пароль должен содержать не менее 6 символов.'
    return
  }

  try {
    const { error } = await supabase.auth.updateUser(
      { password: newPwd },
      { currentPassword: current }
    )
    if (error) throw error
    closePasswordModal()
    showMessage('Пароль изменён', 'Пароль успешно изменён. Войдите заново с новым паролем.')
    await supabase.auth.signOut()
    setTimeout(() => { window.location.href = '../login.html' }, 2000)
  } catch (err) {
    errorDiv.textContent = err.message
  }
})

// --- Удаление аккаунта ---
function closeConfirmDeleteModal() {
  confirmDeleteModal.style.display = 'none'
  document.getElementById('deletePassword').value = ''
  document.getElementById('deleteError').textContent = ''
}

deleteAccountBtn.addEventListener('click', () => {
  confirmDeleteModal.style.display = 'flex'
})

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  const password = document.getElementById('deletePassword').value
  const errorDiv = document.getElementById('deleteError')

  if (!password) {
    errorDiv.textContent = 'Введите пароль для удаления.'
    return
  }

  try {
    // Проверяем пароль, попытавшись обновить данные (например, email)
    const { error: verifyError } = await supabase.auth.updateUser(
      { email: currentUser.email },
      { currentPassword: password }
    )
    if (verifyError) throw new Error('Неверный пароль')

    // Вызываем Edge Function для удаления
    const { data, error: fnError } = await supabase.functions.invoke('delete-user', {
      body: { userId: currentUser.id }
    })
    if (fnError) throw fnError

    await supabase.auth.signOut()
    closeConfirmDeleteModal()
    showMessage('Учётная запись удалена', 'Ваша учётная запись полностью удалена. Вы будете перенаправлены на главную страницу.')
    setTimeout(() => { window.location.href = '../index.html' }, 2000)
  } catch (err) {
    errorDiv.textContent = err.message
  }
})

// Закрытие модалок по клику на оверлей
window.onclick = function(event) {
  if (event.target === passwordModal) closePasswordModal()
  if (event.target === phoneModal) closePhoneModal()
  if (event.target === emailModal) closeEmailModal()
  if (event.target === confirmDeleteModal) closeConfirmDeleteModal()
  if (event.target === messageModal) closeMessageModal()
}

loadAccountData()