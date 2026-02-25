// admin/certificates/js/certificates-common.js
import { supabase } from '../../../js/supabase-config.js'

// Конфигурация таблиц свидетельств
export const CERTIFICATE_TABLES = {
  birth: 'documents_birth_certificate',
  marriage: 'documents_marriage_certificate',
  divorce: 'documents_divorce_certificate',
  adoption: 'documents_adoption_certificate'
  // добавить другие
}

// Получить название таблицы по типу
export function getTableName(type) {
  return CERTIFICATE_TABLES[type] || null
}

// Загрузить список записей из конкретной таблицы с фильтрацией
export async function fetchCertificates(table, filters = {}) {
  let query = supabase.from(table).select('*')

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.personal_code) {
    query = query.eq('personal_code', filters.personal_code)
  }
  if (filters.search) {
    // поиск по серии/номеру или ФИО владельца
    query = query.or(`certificate_series_number.ilike.%${filters.search}%,owner_full_name.ilike.%${filters.search}%`)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return data
}

// Обновить статус документа
export async function updateCertificateStatus(table, id, status, comment = '') {
  const { error } = await supabase
    .from(table)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// Проверка прав администратора (перенаправление на вход)
export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = '../login.html'
    return false
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (error || profile?.role !== 'admin') {
    alert('Доступ запрещён')
    window.location.href = '../../personal-profile/index.html'
    return false
  }
  return true
}