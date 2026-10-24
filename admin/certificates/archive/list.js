// admin/certificates/js/list.js
import { supabase } from '../../../js/supabase-config.js'
import { requireAdmin, getTypeInfo, CERTIFICATE_TABLES, fetchCertificates, formatDate, getStatusLabel, escapeHTML } from './certificates-common.js'

document.addEventListener('DOMContentLoaded', async () => {
  if (!await requireAdmin()) return

  const typeSelect = document.getElementById('typeSelect')
  const statusFilter = document.getElementById('statusFilter')
  const searchInput = document.getElementById('searchInput')
  const applyBtn = document.getElementById('applyFilters')
  const loading = document.getElementById('loading')
  const tableContainer = document.getElementById('tableContainer')

  // Заполняем селект типов из конфигурации
  typeSelect.innerHTML = Object.entries(CERTIFICATE_TABLES).map(([key, info]) =>
    `<option value="${key}">${escapeHTML(info.title)}</option>`
  ).join('')

  async function loadCertificates() {
    const type = typeSelect.value
    if (!type) return

    loading.style.display = 'block'
    tableContainer.innerHTML = ''

    try {
      const filters = {
        status: statusFilter.value || undefined,
        search: searchInput.value || undefined
      }
      const data = await fetchCertificates(type, filters)

      if (data.length === 0) {
        tableContainer.innerHTML = '<p class="no-data">Нет записей</p>'
        return
      }

      // Строим таблицу
      let html = '<table class="admin-table"><thead><tr><th>ID</th><th>Владелец (личный код)</th><th>Серия/номер</th><th>Статус</th><th>Дата создания</th><th>Действия</th></tr></thead><tbody>'

      data.forEach(rec => {
        // Определяем владельца: для marriage/divorce показываем оба кода
        let owner = ''
        const typeInfo = getTypeInfo(type)
        if (typeInfo?.hasTwoCodes) {
          const codes = [rec.husband_personal_code, rec.wife_personal_code].filter(Boolean)
          owner = codes.join(', ') || '—'
        } else {
          owner = rec.personal_code || '—'
        }

        const number = rec.certificate_series_number || '—'
        const statusLabel = getStatusLabel(rec.status)
        const created = formatDate(rec.created_at)

        html += `<tr>
          <td>${escapeHTML(rec.id)}</td>
          <td>${escapeHTML(owner)}</td>
          <td>${escapeHTML(number)}</td>
          <td><span class="status-badge status-${rec.status}">${escapeHTML(statusLabel)}</span></td>
          <td>${escapeHTML(created)}</td>
          <td><a href="view.html?type=${type}&id=${rec.id}" class="btn-small">Просмотр</a></td>
        </tr>`
      })
      html += '</tbody></table>'
      tableContainer.innerHTML = html
    } catch (err) {
      alert('Ошибка загрузки: ' + err.message)
    } finally {
      loading.style.display = 'none'
    }
  }

  applyBtn.addEventListener('click', loadCertificates)
  typeSelect.addEventListener('change', loadCertificates)
  loadCertificates() // первая загрузка
})