import { supabase } from '../../js/supabase-config.js'

const SCHEMA = 'site_info'
let allVersions = []
let changeRowId = 0

/* ============================================================
   Проверка прав администратора
   ============================================================ */
async function checkAdmin() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = '../../login.html'
    return false
  }
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', session.user.id)
    .single()
  if (error || profile?.role !== 'admin') {
    await supabase.auth.signOut()
    window.location.href = '../../login.html'
    return false
  }
  const emailEl = document.getElementById('adminEmail')
  if (emailEl) emailEl.textContent = profile.email || session.user.email
  return true
}

/* ============================================================
   Утилиты
   ============================================================ */
function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

function formatDateRu(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('ru-RU') }
  catch { return d }
}

/* ============================================================
   Загрузка версий
   ============================================================ */
async function loadVersions() {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('versions')
    .select(`*, version_changes(*)`)
    .order('release_date', { ascending: false })
  if (error) throw error
  allVersions = data || []
  renderVersionsList()
}

/* ============================================================
   Рендер списка версий
   ============================================================ */
function renderVersionsList() {
  const list = document.getElementById('versionsList')
  if (!list) return

  if (allVersions.length === 0) {
    list.innerHTML = '<p class="no-data">Версий пока нет. Добавьте первую через форму слева.</p>'
    return
  }

  list.innerHTML = allVersions.map(v => {
    const changesCount = (v.version_changes || []).length
    const date = formatDateRu(v.release_date)
    return `
      <div class="version-item ${v.is_current ? 'is-current' : ''}">
        <div class="version-header">
          <div class="version-info">
            <span class="version-tag">v${escapeHtml(v.version)}</span>
            <span class="version-date">${date}</span>
            ${v.is_current ? '<span class="current-badge">Текущая</span>' : ''}
          </div>
          <div class="version-actions">
            ${!v.is_current ? `
              <button class="icon-btn" data-action="set-current" data-id="${v.id}" title="Сделать текущей">
                <i class="fas fa-check"></i>
              </button>
            ` : ''}
            <button class="icon-btn danger" data-action="delete" data-id="${v.id}" title="Удалить">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="version-title">${escapeHtml(v.title)}</div>
        ${v.description ? `<div class="version-desc">${escapeHtml(v.description)}</div>` : ''}
        <div class="version-meta">Изменений: ${changesCount}</div>
      </div>
    `
  }).join('')

  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id } = btn.dataset
      if (action === 'set-current') setCurrent(id)
      else if (action === 'delete') deleteVersion(id)
    })
  })
}

/* ============================================================
   Динамические строки изменений
   ============================================================ */
function addChangeRow(type = 'added', desc = '') {
  const container = document.getElementById('changesList')
  const row = document.createElement('div')
  row.className = 'change-row'
  row.dataset.rowId = ++changeRowId
  row.innerHTML = `
    <select class="change-type">
      <option value="added"${type === 'added' ? ' selected' : ''}>Добавлено</option>
      <option value="changed"${type === 'changed' ? ' selected' : ''}>Изменено</option>
      <option value="fixed"${type === 'fixed' ? ' selected' : ''}>Исправлено</option>
      <option value="removed"${type === 'removed' ? ' selected' : ''}>Удалено</option>
    </select>
    <input type="text" class="change-desc" placeholder="Что изменилось" value="${escapeHtml(desc)}" />
    <button type="button" class="remove-change" title="Удалить">
      <i class="fas fa-times"></i>
    </button>
  `
  row.querySelector('.remove-change').addEventListener('click', () => row.remove())
  container.appendChild(row)
}

function collectChanges() {
  const rows = document.querySelectorAll('#changesList .change-row')
  return Array.from(rows)
    .map((row, idx) => ({
      change_type: row.querySelector('.change-type').value,
      description: row.querySelector('.change-desc').value.trim(),
      sort_order: idx
    }))
    .filter(c => c.description.length > 0)
}

/* ============================================================
   Сохранение версии
   ============================================================ */
async function saveVersion(e) {
  e.preventDefault()
  const formError = document.getElementById('formError')
  formError.textContent = ''

  const version = document.getElementById('versionInput').value.trim()
  const title = document.getElementById('titleInput').value.trim()
  const description = document.getElementById('descriptionInput').value.trim()
  const releaseDate = document.getElementById('releaseDate').value ||
    new Date().toISOString().slice(0, 10)
  const isCurrent = document.getElementById('isCurrentInput').checked

  if (!version || !title) {
    formError.textContent = 'Заполните номер и название версии.'
    return
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    formError.textContent = 'Номер версии должен быть в формате X.Y.Z (например, 1.1.0).'
    return
  }

  const submitBtn = e.target.querySelector('button[type="submit"]')
  const originalHtml = submitBtn.innerHTML
  submitBtn.disabled = true
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...'

  try {
    if (isCurrent) {
      await supabase.schema(SCHEMA).from('versions')
        .update({ is_current: false }).eq('is_current', true)
    }

    const { data: inserted, error: verErr } = await supabase
      .schema(SCHEMA)
      .from('versions')
      .insert({
        version,
        title,
        description: description || null,
        release_date: releaseDate,
        is_current: isCurrent
      })
      .select('id')
      .single()

    if (verErr) {
      if (verErr.code === '23505') {
        throw new Error('Версия с таким номером уже существует.')
      }
      throw verErr
    }

    const changes = collectChanges()
    if (changes.length > 0) {
      const payload = changes.map(c => ({ ...c, version_id: inserted.id }))
      const { error: chErr } = await supabase
        .schema(SCHEMA).from('version_changes').insert(payload)
      if (chErr) throw chErr
    }

    document.getElementById('versionForm').reset()
    document.getElementById('changesList').innerHTML = ''
    document.getElementById('releaseDate').value =
      new Date().toISOString().slice(0, 10)
    addChangeRow()

    await loadVersions()
    formError.style.color = '#16a34a'
    formError.textContent = 'Версия успешно добавлена.'
    setTimeout(() => { formError.textContent = ''; formError.style.color = '' }, 3000)
  } catch (err) {
    console.error(err)
    formError.style.color = ''
    formError.textContent = 'Ошибка: ' + (err.message || err)
  } finally {
    submitBtn.disabled = false
    submitBtn.innerHTML = originalHtml
  }
}

/* ============================================================
   Установить как текущую
   ============================================================ */
async function setCurrent(id) {
  try {
    const { error: resetErr } = await supabase
      .schema(SCHEMA).from('versions')
      .update({ is_current: false }).eq('is_current', true)
    if (resetErr) throw resetErr

    const { error } = await supabase
      .schema(SCHEMA).from('versions')
      .update({ is_current: true }).eq('id', id)
    if (error) throw error

    await loadVersions()
  } catch (err) {
    alert('Ошибка: ' + err.message)
  }
}

/* ============================================================
   Удаление версии
   ============================================================ */
async function deleteVersion(id) {
  const v = allVersions.find(x => x.id === id)
  const label = v ? `v${v.version} — ${v.title}` : 'эту версию'
  if (!confirm(`Удалить «${label}»? Все связанные изменения также будут удалены.`)) return
  try {
    const { error } = await supabase
      .schema(SCHEMA).from('versions').delete().eq('id', id)
    if (error) throw error
    await loadVersions()
  } catch (err) {
    alert('Ошибка: ' + err.message)
  }
}

/* ============================================================
   Инициализация
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  if (!await checkAdmin()) return

  // Logout
  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut()
      window.location.href = '../../login.html'
    })
  }

  // Дефолтная дата
  const dateInput = document.getElementById('releaseDate')
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10)

  // Стартовая строка изменений
  addChangeRow()

  // Обработчики
  document.getElementById('addChangeBtn')
    .addEventListener('click', () => addChangeRow())
  document.getElementById('versionForm')
    .addEventListener('submit', saveVersion)

  // Загрузка списка версий
  try {
    await loadVersions()
    document.getElementById('loading').style.display = 'none'
    document.getElementById('content').style.display = 'block'
  } catch (err) {
    console.error(err)
    document.getElementById('loading').style.display = 'none'
    const box = document.getElementById('errorBox')
    box.style.display = 'block'

    const isMissingSchema =
      err.code === 'PGRST106' ||
      /schema|does not exist|не найдена|not found/i.test(err.message || '')

    if (isMissingSchema) {
      box.innerHTML = `
        <strong>Схема <code>site_info</code> не найдена.</strong><br>
        Выполните SQL-миграцию в Supabase (CREATE SCHEMA site_info, CREATE TABLE versions, CREATE TABLE version_changes, политики RLS).
        После этого перезагрузите страницу.
      `
    } else {
      box.textContent = 'Ошибка загрузки: ' + (err.message || err)
    }
  }
})