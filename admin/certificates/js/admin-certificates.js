import { supabase } from '../../../js/supabase-config.js'

// Проверка прав администратора
async function checkAdmin() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = '/login.html'
    return
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (error || profile?.role !== 'admin') {
    alert('У вас нет прав доступа к этой странице.')
    window.location.href = '/personal-profile/index.html'
  }
}

// Выполняем проверку при загрузке страницы
checkAdmin()