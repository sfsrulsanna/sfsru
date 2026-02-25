// admin/certificates/js/list.js
import { supabase } from '../../../js/supabase-config.js'
import { requireAdmin, CERTIFICATE_TABLES, fetchCertificates } from './certificates-common.js'

document.addEventListener('DOMContentLoaded', async () => {
  if (!await requireAdmin()) return

  const typeSelect = document.getElementById('typeSelect')
  const statusFilter = document.getElementById('statusFilter')
  const searchInput = document.getElementById('searchInput')
  const applyBtn = document.getElementById('applyFilters')
  const loading = document.getElementById('loading')
  const tableContainer = document.getElementById('tableContainer')

  async function loadCertificates() {
    const type = typeSelect.value
    const table = CERTIFICATE_TABLES[type]
    if (!table) return

    loading.style.display = 'block'
    tableContainer.innerHTML = ''

    try {
      const filters = {
        status: statusFilter.value || undefined,
        search: searchInput.value || undefined
      }
      const data = await fetchCertificates(table, filters)

      if (data.length === 0) {
        tableContainer.innerHTML = '<p class="no-data">Нет записей</p>'
        return
      }

      // Строим таблицу
      let html = '<table class="admin-table"><thead><tr><th>ID</th><th>Владелец</th><th>Серия/номер</th><th>Статус</th><th>Дата создания</th><th>Действия</th></tr></thead><tbody>'
      data.forEach(rec => {
        html += `<tr>
          <td>${rec.id}</td>
          <td>${rec.owner_full_name || '—'}</td>
          <td>${rec.certificate_series_number || '—'}</td>
          <td><span class="status-badge status-${rec.status}">${rec.status}</span></td>
          <td>${new Date(rec.created_at).toLocaleDateString()}</td>
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