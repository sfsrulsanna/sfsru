// admin/certificates/js/verify.js
import { supabase } from '../../../js/supabase-config.js'
import { requireAdmin, CERTIFICATE_TABLES, getTypeInfo, fetchCertificates, updateCertificateStatus, formatDate, getStatusLabel, escapeHTML } from './certificates-common.js'

let currentData = []

async function loadPendingCertificates() {
  const tbody = document.getElementById('certificatesTableBody')
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка...</td></tr>'

  try {
    let allRecords = []

    // Загружаем записи со статусом oncheck из всех таблиц
    for (const [type, info] of Object.entries(CERTIFICATE_TABLES)) {
      const data = await fetchCertificates(type, { status: 'oncheck' })
      allRecords.push(...data.map(r => ({ ...r, certificate_type: info.title, type_key: type })))
    }

    currentData = allRecords
    renderTable(allRecords)
  } catch (err) {
    console.error(err)
    tbody.innerHTML = '<tr><td colspan="7" class="error">Ошибка загрузки данных</td></tr>'
  }
}

function renderTable(records) {
  const tbody = document.getElementById('certificatesTableBody')
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">Нет записей на проверке</td></tr>'
    return
  }

  tbody.innerHTML = records.map(rec => {
    // Определяем владельца (личный код)
    let owner = ''
    const typeInfo = getTypeInfo(rec.type_key)
    if (typeInfo?.hasTwoCodes) {
      const codes = [rec.husband_personal_code, rec.wife_personal_code].filter(Boolean)
      owner = codes.join(', ') || '—'
    } else {
      owner = rec.personal_code || '—'
    }

    const number = rec.certificate_series_number || '—'
    const created = formatDate(rec.created_at)

    return `
      <tr>
        <td>${escapeHTML(rec.certificate_type)}</td>
        <td>${escapeHTML(rec.id)}</td>
        <td>${escapeHTML(owner)}</td>
        <td>${escapeHTML(number)}</td>
        <td>${escapeHTML(created)}</td>
        <td>
          <button class="btn-verify" data-type="${rec.type_key}" data-id="${rec.id}" data-action="verified">✅ Подтвердить</button>
          <button class="btn-reject" data-type="${rec.type_key}" data-id="${rec.id}" data-action="rejected">❌ Отклонить</button>
        </td>
        <td>
          <a href="view.html?type=${rec.type_key}&id=${rec.id}" class="btn-view">👁️ Просмотр</a>
        </td>
      </tr>
    `
  }).join('')

  document.querySelectorAll('.btn-verify, .btn-reject').forEach(btn => {
    btn.addEventListener('click', handleStatusChange)
  })
}

async function handleStatusChange(e) {
  const btn = e.target
  const type = btn.dataset.type
  const id = btn.dataset.id
  const newStatus = btn.dataset.action

  if (!confirm(`Изменить статус на "${newStatus === 'verified' ? 'Подтверждено' : 'Отклонено'}"?`)) return

  try {
    await updateCertificateStatus(type, id, newStatus)
    currentData = currentData.filter(r => !(r.type_key === type && r.id === id))
    renderTable(currentData)
    showNotification('Статус обновлён', 'success')
  } catch (err) {
    console.error(err)
    showNotification('Ошибка обновления статуса', 'error')
  }
}

function showNotification(msg, type) {
  const el = document.getElementById('notification')
  el.textContent = msg
  el.className = `notification ${type}`
  el.style.display = 'block'
  setTimeout(() => el.style.display = 'none', 3000)
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!await requireAdmin()) return
  loadPendingCertificates()
})