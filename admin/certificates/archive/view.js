// admin/certificates/js/view.js
import { supabase } from '../../../js/supabase-config.js'
import { requireAdmin, getTypeInfo, fetchCertificateById, updateCertificateStatus, formatDate, getStatusLabel, escapeHTML } from './certificates-common.js'

document.addEventListener('DOMContentLoaded', async () => {
  if (!await requireAdmin()) return

  const urlParams = new URLSearchParams(window.location.search)
  const type = urlParams.get('type')
  const id = urlParams.get('id')

  const typeInfo = getTypeInfo(type)
  if (!type || !id || !typeInfo) {
    document.getElementById('error').style.display = 'block'
    document.getElementById('error').textContent = 'Неверные параметры'
    document.getElementById('loading').style.display = 'none'
    return
  }

  document.getElementById('certTitle').textContent = `Просмотр: ${typeInfo.title}`

  try {
    const data = await fetchCertificateById(type, id)

    document.getElementById('loading').style.display = 'none'
    const display = document.getElementById('certificateDisplay')
    display.style.display = 'block'

    // Отображаем все поля в виде таблицы
    let html = `<p><strong>Статус:</strong> ${getStatusLabel(data.status)}</p>`
    html += '<table class="details-table"><tbody>'

    for (let [key, value] of Object.entries(data)) {
      // Пропускаем служебные поля, если нужно (можно показать все)
      // if (key === 'id' || key === 'created_at' || key === 'updated_at') continue
      let displayValue = value
      if (value === null || value === undefined) displayValue = '—'
      else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) displayValue = formatDate(value)
      else if (typeof value === 'object') displayValue = JSON.stringify(value)
      else displayValue = String(value)

      html += `<tr><th>${escapeHTML(key)}</th><td>${escapeHTML(displayValue)}</td></tr>`
    }
    html += '</tbody></table>'
    display.innerHTML = html

    // Кнопки управления статусом
    const actionsDiv = document.createElement('div')
    actionsDiv.className = 'actions'
    actionsDiv.style.marginTop = '20px'

    const statuses = [
      { status: 'verified', label: 'Подтвердить', class: 'btn-verify', disabled: data.status === 'verified' },
      { status: 'rejected', label: 'Отклонить', class: 'btn-reject', disabled: data.status === 'rejected' },
      { status: 'archived', label: 'Архивировать', class: 'btn-archive', disabled: data.status === 'archived' }
    ]

    statuses.forEach(s => {
      const btn = document.createElement('button')
      btn.textContent = s.label
      btn.className = s.class
      btn.disabled = s.disabled
      btn.addEventListener('click', async () => {
        try {
          await updateCertificateStatus(type, id, s.status)
          alert('Статус обновлён')
          window.location.reload()
        } catch (err) {
          alert('Ошибка: ' + err.message)
        }
      })
      actionsDiv.appendChild(btn)
    })

    // Кнопка "Назад"
    const backBtn = document.createElement('button')
    backBtn.textContent = 'Назад'
    backBtn.className = 'btn-secondary'
    backBtn.addEventListener('click', () => history.back())
    actionsDiv.appendChild(backBtn)

    display.appendChild(actionsDiv)

  } catch (err) {
    document.getElementById('loading').style.display = 'none'
    document.getElementById('error').style.display = 'block'
    document.getElementById('error').textContent = err.message
  }
})