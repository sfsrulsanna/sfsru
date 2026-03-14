// admin/certificates/js/certificates-common.js
import { supabase } from '../../../js/supabase-config.js'

// Конфигурация таблиц свидетельств (схема documents_certificates)
export const CERTIFICATE_TABLES = {
  adoption:    { table: 'adoption',    title: 'Свидетельство об усыновлении',     hasTwoCodes: false },
  birth:       { table: 'birth',       title: 'Свидетельство о рождении',        hasTwoCodes: false },
  death:       { table: 'death',       title: 'Свидетельство о смерти',          hasTwoCodes: false },
  divorce:     { table: 'divorce',     title: 'Свидетельство о расторжении брака', hasTwoCodes: true },
  fatherhood:  { table: 'fatherhood',  title: 'Свидетельство об установлении отцовства', hasTwoCodes: false },
  marriage:    { table: 'marriage',    title: 'Свидетельство о браке',           hasTwoCodes: true },
  name_change: { table: 'name_change', title: 'Свидетельство о перемене имени',  hasTwoCodes: false }
}

/**
 * Описание полей для каждого типа свидетельства (для формы добавления/редактирования)
 * Каждое поле: { name, label, type, required, options? (для select) }
 */
export const CERTIFICATE_FIELDS = {
  adoption: [
    { name: 'child_surname', label: 'Фамилия ребёнка', type: 'text', required: true },
    { name: 'child_name', label: 'Имя ребёнка', type: 'text', required: true },
    { name: 'child_patronymic', label: 'Отчество ребёнка', type: 'text' },
    { name: 'child_birth_date', label: 'Дата рождения ребёнка', type: 'date' },
    { name: 'child_personal_code', label: 'Личный код ребёнка', type: 'text' },
    { name: 'child_birth_place', label: 'Место рождения ребёнка', type: 'text' },
    { name: 'guardian1_full_name', label: 'ФИО отца (полностью)', type: 'text' },
    { name: 'guardian1_citizenship', label: 'Гражданство отца', type: 'text' },
    { name: 'guardian1_nationality', label: 'Национальность отца', type: 'text' },
    { name: 'guardian1_personal_code', label: 'Личный код отца', type: 'text' },
    { name: 'guardian2_full_name', label: 'ФИО матери (полностью)', type: 'text' },
    { name: 'guardian2_citizenship', label: 'Гражданство матери', type: 'text' },
    { name: 'guardian2_nationality', label: 'Национальность матери', type: 'text' },
    { name: 'guardian2_personal_code', label: 'Личный код матери', type: 'text' },
    { name: 'new_full_name', label: 'Новое ФИО после усыновления', type: 'text' },
    { name: 'new_birth_date', label: 'Новая дата рождения', type: 'date' },
    { name: 'new_birth_place', label: 'Новое место рождения', type: 'text' },
    { name: 'registry_act_date', label: 'Дата актовой записи', type: 'date' },
    { name: 'registry_act_number', label: 'Номер актовой записи', type: 'text' },
    { name: 'registry_place', label: 'Место регистрации', type: 'text' },
    { name: 'issue_place', label: 'Место выдачи свидетельства', type: 'text' },
    { name: 'registry_official', label: 'Руководитель органа ЗАГС', type: 'text' },
    { name: 'certificate_series_number', label: 'Серия и номер свидетельства', type: 'text', required: true },
    { name: 'issue_date', label: 'Дата выдачи', type: 'date' },
    { name: 'owner_full_name', label: 'ФИО владельца свидетельства', type: 'text' },
    { name: 'personal_code', label: 'Личный код владельца', type: 'text', required: true }
  ],
  birth: [
    { name: 'child_full_name', label: 'ФИО ребёнка (полностью)', type: 'text', required: true },
    { name: 'child_birth_date', label: 'Дата рождения', type: 'date', required: true },
    { name: 'child_birth_place', label: 'Место рождения', type: 'text' },
    { name: 'child_personal_code', label: 'Личный код ребёнка', type: 'text', required: true },
    { name: 'father_full_name', label: 'ФИО отца', type: 'text' },
    { name: 'father_citizenship', label: 'Гражданство отца', type: 'text' },
    { name: 'father_nationality', label: 'Национальность отца', type: 'text' },
    { name: 'father_personal_code', label: 'Личный код отца', type: 'text' },
    { name: 'mother_full_name', label: 'ФИО матери', type: 'text' },
    { name: 'mother_citizenship', label: 'Гражданство матери', type: 'text' },
    { name: 'mother_nationality', label: 'Национальность матери', type: 'text' },
    { name: 'mother_personal_code', label: 'Личный код матери', type: 'text' },
    { name: 'registry_act_number', label: 'Номер актовой записи', type: 'text' },
    { name: 'registry_act_date', label: 'Дата актовой записи', type: 'date' },
    { name: 'registry_place', label: 'Место регистрации', type: 'text' },
    { name: 'registry_official', label: 'Руководитель органа ЗАГС', type: 'text' },
    { name: 'certificate_series_number', label: 'Серия и номер свидетельства', type: 'text', required: true },
    { name: 'issue_date', label: 'Дата выдачи', type: 'date' },
    { name: 'issue_place', label: 'Место выдачи свидетельства', type: 'text' }
  ],
  death: [
    { name: 'surname', label: 'Фамилия умершего', type: 'text', required: true },
    { name: 'first_patronymic', label: 'Имя отчество', type: 'text', required: true },
    { name: 'birth_date', label: 'Дата рождения', type: 'date', required: true },
    { name: 'birth_place', label: 'Место рождения', type: 'text' },
    { name: 'citizenship', label: 'Гражданство', type: 'text' },
    { name: 'nationality', label: 'Национальность', type: 'text' },
    { name: 'personal_code', label: 'Личный код', type: 'text', required: true },
    { name: 'death_date', label: 'Дата смерти', type: 'date', required: true },
    { name: 'death_time', label: 'Время смерти', type: 'time' },
    { name: 'death_place', label: 'Место смерти', type: 'text' },
    { name: 'registry_act_date', label: 'Дата актовой записи', type: 'date' },
    { name: 'registry_act_number', label: 'Номер актовой записи', type: 'text' },
    { name: 'registry_place', label: 'Место регистрации', type: 'text' },
    { name: 'issue_place', label: 'Место выдачи свидетельства', type: 'text' },
    { name: 'registry_official', label: 'Руководитель органа ЗАГС', type: 'text' },
    { name: 'certificate_series_number', label: 'Серия и номер свидетельства', type: 'text', required: true },
    { name: 'issue_date', label: 'Дата выдачи', type: 'date' },
    { name: 'owner_full_name', label: 'ФИО владельца свидетельства', type: 'text' }
  ],
  divorce: [
    { name: 'husband_full_name', label: 'ФИО мужа', type: 'text', required: true },
    { name: 'husband_birth_date', label: 'Дата рождения мужа', type: 'date' },
    { name: 'husband_birth_place', label: 'Место рождения мужа', type: 'text' },
    { name: 'husband_citizenship', label: 'Гражданство мужа', type: 'text' },
    { name: 'husband_nationality', label: 'Национальность мужа', type: 'text' },
    { name: 'husband_personal_code', label: 'Личный код мужа', type: 'text' },
    { name: 'wife_full_name', label: 'ФИО жены', type: 'text', required: true },
    { name: 'wife_birth_date', label: 'Дата рождения жены', type: 'date' },
    { name: 'wife_birth_place', label: 'Место рождения жены', type: 'text' },
    { name: 'wife_citizenship', label: 'Гражданство жены', type: 'text' },
    { name: 'wife_nationality', label: 'Национальность жены', type: 'text' },
    { name: 'wife_personal_code', label: 'Личный код жены', type: 'text' },
    { name: 'divorce_date', label: 'Дата расторжения брака', type: 'date' },
    { name: 'divorce_basis', label: 'Основание расторжения', type: 'text' },
    { name: 'basis_date', label: 'Дата документа-основания', type: 'date' },
    { name: 'registry_act_number', label: 'Номер актовой записи', type: 'text' },
    { name: 'registry_act_date', label: 'Дата актовой записи', type: 'date' },
    { name: 'assigned_surname_owner', label: 'Присвоенная фамилия владельцу', type: 'text' },
    { name: 'registry_place', label: 'Место регистрации', type: 'text' },
    { name: 'issue_place', label: 'Место выдачи свидетельства', type: 'text' },
    { name: 'registry_official', label: 'Руководитель органа ЗАГС', type: 'text' },
    { name: 'certificate_series_number', label: 'Серия и номер свидетельства', type: 'text', required: true },
    { name: 'issue_date', label: 'Дата выдачи', type: 'date' },
    { name: 'owner_full_name', label: 'ФИО владельца', type: 'text' },
    { name: 'personal_code', label: 'Личный код владельца', type: 'text', required: true }
  ],
  fatherhood: [
    { name: 'father_full_name', label: 'ФИО отца', type: 'text', required: true },
    { name: 'father_birth_date', label: 'Дата рождения отца', type: 'date' },
    { name: 'father_birth_place', label: 'Место рождения отца', type: 'text' },
    { name: 'father_citizenship', label: 'Гражданство отца', type: 'text' },
    { name: 'father_nationality', label: 'Национальность отца', type: 'text' },
    { name: 'father_personal_code', label: 'Личный код отца', type: 'text' },
    { name: 'child_full_name', label: 'ФИО ребёнка (до установления)', type: 'text', required: true },
    { name: 'child_birth_date', label: 'Дата рождения ребёнка', type: 'date' },
    { name: 'child_birth_place', label: 'Место рождения ребёнка', type: 'text' },
    { name: 'child_personal_code', label: 'Личный код ребёнка', type: 'text' },
    { name: 'mother_full_name', label: 'ФИО матери', type: 'text' },
    { name: 'mother_birth_date', label: 'Дата рождения матери', type: 'date' },
    { name: 'mother_birth_place', label: 'Место рождения матери', type: 'text' },
    { name: 'mother_citizenship', label: 'Гражданство матери', type: 'text' },
    { name: 'mother_nationality', label: 'Национальность матери', type: 'text' },
    { name: 'mother_personal_code', label: 'Личный код матери', type: 'text' },
    { name: 'registry_act_date', label: 'Дата актовой записи', type: 'date' },
    { name: 'registry_act_number', label: 'Номер актовой записи', type: 'text' },
    { name: 'new_child_full_name', label: 'Новое ФИО ребёнка после установления', type: 'text' },
    { name: 'registry_place', label: 'Место регистрации', type: 'text' },
    { name: 'issue_place', label: 'Место выдачи свидетельства', type: 'text' },
    { name: 'registry_official', label: 'Руководитель органа ЗАГС', type: 'text' },
    { name: 'certificate_series_number', label: 'Серия и номер свидетельства', type: 'text', required: true },
    { name: 'issue_date', label: 'Дата выдачи', type: 'date' },
    { name: 'owner_full_name', label: 'ФИО владельца', type: 'text' },
    { name: 'personal_code', label: 'Личный код владельца', type: 'text', required: true }
  ],
  marriage: [
    { name: 'husband_full_name', label: 'ФИО мужа', type: 'text', required: true },
    { name: 'husband_birth_date', label: 'Дата рождения мужа', type: 'date' },
    { name: 'husband_birth_place', label: 'Место рождения мужа', type: 'text' },
    { name: 'husband_citizenship', label: 'Гражданство мужа', type: 'text' },
    { name: 'husband_nationality', label: 'Национальность мужа', type: 'text' },
    { name: 'husband_personal_code', label: 'Личный код мужа', type: 'text' },
    { name: 'wife_full_name', label: 'ФИО жены', type: 'text', required: true },
    { name: 'wife_birth_date', label: 'Дата рождения жены', type: 'date' },
    { name: 'wife_birth_place', label: 'Место рождения жены', type: 'text' },
    { name: 'wife_citizenship', label: 'Гражданство жены', type: 'text' },
    { name: 'wife_nationality', label: 'Национальность жены', type: 'text' },
    { name: 'wife_personal_code', label: 'Личный код жены', type: 'text' },
    { name: 'marriage_date', label: 'Дата заключения брака', type: 'date' },
    { name: 'registry_act_number', label: 'Номер актовой записи', type: 'text' },
    { name: 'registry_act_date', label: 'Дата актовой записи', type: 'date' },
    { name: 'assigned_surname_husband', label: 'Присвоенная фамилия мужу', type: 'text' },
    { name: 'assigned_surname_wife', label: 'Присвоенная фамилия жене', type: 'text' },
    { name: 'registry_place', label: 'Место регистрации', type: 'text' },
    { name: 'registry_official', label: 'Руководитель органа ЗАГС', type: 'text' },
    { name: 'certificate_series_number', label: 'Серия и номер свидетельства', type: 'text', required: true },
    { name: 'issue_date', label: 'Дата выдачи', type: 'date' },
    { name: 'issue_place', label: 'Место выдачи свидетельства', type: 'text' }
  ],
  name_change: [
    { name: 'old_full_name', label: 'ФИО до перемены', type: 'text', required: true },
    { name: 'birth_date', label: 'Дата рождения', type: 'date', required: true },
    { name: 'birth_place', label: 'Место рождения', type: 'text' },
    { name: 'citizenship', label: 'Гражданство', type: 'text' },
    { name: 'nationality', label: 'Национальность', type: 'text' },
    { name: 'personal_code', label: 'Личный код', type: 'text', required: true },
    { name: 'new_full_name', label: 'Новое ФИО', type: 'text', required: true },
    { name: 'registry_act_number', label: 'Номер актовой записи', type: 'text' },
    { name: 'registry_act_date', label: 'Дата актовой записи', type: 'date' },
    { name: 'registry_place', label: 'Место регистрации', type: 'text' },
    { name: 'issue_place', label: 'Место выдачи свидетельства', type: 'text' },
    { name: 'registry_official', label: 'Руководитель органа ЗАГС', type: 'text' },
    { name: 'certificate_series_number', label: 'Серия и номер свидетельства', type: 'text', required: true },
    { name: 'issue_date', label: 'Дата выдачи', type: 'date' }
  ]
}

/**
 * Получить информацию о типе свидетельства по ключу
 */
export function getTypeInfo(type) {
  return CERTIFICATE_TABLES[type] || null
}

/**
 * Загрузить список записей из указанной таблицы с фильтрацией
 * @param {string} type - ключ типа (напр. 'birth')
 * @param {object} filters - объект с полями status, personal_code, search
 */
export async function fetchCertificates(type, filters = {}) {
  const typeInfo = getTypeInfo(type)
  if (!typeInfo) throw new Error('Неизвестный тип свидетельства')

  let query = supabase
    .schema('documents_certificates')
    .from(typeInfo.table)
    .select('*')

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.personal_code) {
    if (typeInfo.hasTwoCodes) {
      query = query.or(`husband_personal_code.eq.${filters.personal_code},wife_personal_code.eq.${filters.personal_code}`)
    } else {
      query = query.eq('personal_code', filters.personal_code)
    }
  }
  if (filters.search) {
    const term = `%${filters.search}%`
    if (typeInfo.hasTwoCodes) {
      query = query.or(`certificate_series_number.ilike.${term},husband_full_name.ilike.${term},wife_full_name.ilike.${term}`)
    } else {
      query = query.or(`certificate_series_number.ilike.${term},owner_full_name.ilike.${term}`)
    }
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Обновить статус документа
 */
export async function updateCertificateStatus(type, id, status) {
  const typeInfo = getTypeInfo(type)
  if (!typeInfo) throw new Error('Неизвестный тип свидетельства')

  const { error } = await supabase
    .schema('documents_certificates')
    .from(typeInfo.table)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

/**
 * Получить одну запись по ID
 */
export async function fetchCertificateById(type, id) {
  const typeInfo = getTypeInfo(type)
  if (!typeInfo) throw new Error('Неизвестный тип свидетельства')

  const { data, error } = await supabase
    .schema('documents_certificates')
    .from(typeInfo.table)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Создать новую запись
 */
export async function createCertificate(type, data) {
  const typeInfo = getTypeInfo(type)
  if (!typeInfo) throw new Error('Неизвестный тип свидетельства')

  const record = {
    ...data,
    status: 'oncheck',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { data: inserted, error } = await supabase
    .schema('documents_certificates')
    .from(typeInfo.table)
    .insert([record])
    .select()

  if (error) throw error
  return inserted[0]
}

/**
 * Форматирование даты (ДД.ММ.ГГГГ)
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ru-RU')
}

/**
 * Получение текстовой метки статуса
 */
export function getStatusLabel(status) {
  const labels = {
    verified: '✅ Подтверждено',
    oncheck:  '⏳ На проверке',
    rejected: '❌ Отклонено',
    archived: '📦 Архивный'
  }
  return labels[status] || status
}

/**
 * Экранирование HTML
 */
export function escapeHTML(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Проверка прав администратора (перенаправление на вход)
 */
export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = '../login.html'
    return false
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', session.user.id)
    .single()

  if (error || profile?.role !== 'admin') {
    alert('Доступ запрещён')
    window.location.href = '../../personal-profile/index.html'
    return false
  }

  const emailSpan = document.getElementById('adminEmail')
  if (emailSpan) emailSpan.textContent = profile.email || session.user.email

  return true
}