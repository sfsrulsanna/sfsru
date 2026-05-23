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

// Загрузка данных из таблицы users и auth
async function loadAccountData() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Пользователь не авторизован')
    currentUser = user
    userIdSpan.textContent = user.id

    // Получаем данные из таблицы users (телефон, email, статусы)
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('phone, email, email_status, phone_status, account_type')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') throw profileError

    // Отображаем телефон и email
    phoneSpan.textContent = profile?.phone || user.phone || '—'
    emailSpan.textContent = profile?.email || user.email || '—'

    // Определяем тип учётной записи
    let accountType = profile?.account_type || 'simple'
    let helpText = ''

    // Если в таблице нет явного поля account_type, вычисляем на основе статусов
    if (!profile?.account_type) {
      const emailVerified = user.email_confirmed_at || profile?.email_status === 'verified'
      const phoneVerified = profile?.phone_status === 'verified'
      if (emailVerified && phoneVerified) {
        accountType = 'verified'
        helpText = 'Ваша учётная запись имеет максимальный уровень доверия.'
      } else if (emailVerified || phoneVerified) {
        accountType = 'standard'
        helpText = 'Подтвердите оставшийся контакт, чтобы получить подтверждённую запись.'
      } else {
        accountType = 'simple'
        helpText = 'Для повышения типа подтвердите email или телефон в настройках.'
      }
    } else {
      // Подсказки для предустановленных типов
      if (accountType === 'simple') helpText = 'Для повышения типа подтвердите email или телефон.'
      else if (accountType === 'standard') helpText = 'Подтвердите оставшийся контакт для получения полного доступа.'
      else if (accountType === 'verified') helpText = 'Ваша учётная запись полностью подтверждена.'
    }

    accountTypeSpan.textContent = accountType === 'simple' ? 'Упрощённая' : (accountType === 'standard' ? 'Стандартная' : 'Подтверждённая')
    accountTypeHelp.textContent = helpText

    loadingDiv.style.display = 'none'
    accountDiv.style.display = 'block'
  } catch (err) {
    console.error(err)
    loadingDiv.textContent = 'Ошибка загрузки: ' + err.message
  }
}

// Смена пароля
async function changePassword(currentPassword, newPassword) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    currentPassword: currentPassword
  })
  if (error) throw error
}

// Удаление аккаунта через Edge Function
async function deleteAccount() {
  if (!confirm('ВНИМАНИЕ! Удаление учётной записи приведёт к потере всех данных. Вы уверены?')) return
  if (!confirm('Это действие необратимо. Нажмите ОК для окончательного удаления.')) return

  try {
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { userId: currentUser.id }
    })
    if (error) throw error

    await supabase.auth.signOut()
    alert('Учётная запись удалена. Вы будете перенаправлены на главную.')
    window.location.href = '../index.html'
  } catch (err) {
    console.error(err)
    alert('Ошибка при удалении: ' + err.message)
  }
}

// Модальное окно смены пароля
const passwordModal = document.getElementById('passwordModal')
const currentPasswordInput = document.getElementById('currentPassword')
const newPasswordInput = document.getElementById('newPassword')
const confirmPasswordInput = document.getElementById('confirmPassword')
const passwordErrorDiv = document.getElementById('passwordError')

window.closePasswordModal = function() {
  passwordModal.style.display = 'none'
  currentPasswordInput.value = ''
  newPasswordInput.value = ''
  confirmPasswordInput.value = ''
  passwordErrorDiv.textContent = ''
}

document.getElementById('changePasswordBtn').addEventListener('click', () => {
  passwordModal.style.display = 'flex'
})

document.getElementById('submitPasswordBtn').addEventListener('click', async () => {
  const current = currentPasswordInput.value
  const newPwd = newPasswordInput.value
  const confirm = confirmPasswordInput.value

  if (!current || !newPwd || !confirm) {
    passwordErrorDiv.textContent = 'Заполните все поля.'
    return
  }
  if (newPwd !== confirm) {
    passwordErrorDiv.textContent = 'Новый пароль и подтверждение не совпадают.'
    return
  }
  if (newPwd.length < 6) {
    passwordErrorDiv.textContent = 'Пароль должен содержать не менее 6 символов.'
    return
  }

  try {
    await changePassword(current, newPwd)
    alert('Пароль успешно изменён. Войдите заново с новым паролем.')
    await supabase.auth.signOut()
    window.location.href = '../login.html'
  } catch (err) {
    passwordErrorDiv.textContent = err.message
  }
})

document.getElementById('deleteAccountBtn').addEventListener('click', deleteAccount)

// Закрытие модалки по клику вне окна
window.onclick = function(event) {
  if (event.target === passwordModal) closePasswordModal()
}

loadAccountData()