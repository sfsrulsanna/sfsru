// admin/certificates/js/view.js
import { supabase } from '../../../js/supabase-config.js'
import { requireAdmin, CERTIFICATE_TABLES } from './certificates-common.js'

document.addEventListener('DOMContentLoaded', async () => {
  if (!await requireAdmin()) return

  const urlParams = new URLSearchParams(window.location.search)
  const type = urlParams.get('type')
  const id = urlParams.get('id')

  if (!type || !id || !CERTIFICATE_TABLES[type]) {
    document.getElementById('error').style.display = 'block'
    document.getElementById('error').textContent = 'Неверные параметры'
    document.getElementById('loading').style.display = 'none'
    return
  }

  const table = CERTIFICATE_TABLES[type]
  document.getElementById('certTitle').textContent = `Просмотр: ${type}`

  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) throw error || new Error('Запись не найдена')

    document.getElementById('loading').style.display = 'none'
    const display = document.getElementById('certificateDisplay')
    display.style.display = 'block'

    // Отображаем все поля в виде таблицы
    let html = '<table class="details-table"><tbody>'
    for (let [key, value] of Object.entries(data)) {
      // Пропускаем служебные поля, если нужно
      if (key === 'id' || key === 'created_at' || key === 'updated_at') continue
      let displayValue = value
      if (value instanceof Date) displayValue = value.toLocaleDateString()
      else if (value === null || value === undefined) displayValue = '—'
      html += `<tr><th>${key}</th><td>${displayValue}</td></tr>`
    }
    html += '</tbody></table>'
    display.innerHTML = html

    // Кнопка для редактирования (можно потом добавить модальное окно)
    const editBtn = document.createElement('button')
    editBtn.textContent = 'Редактировать'
    editBtn.className = 'btn-primary'
    editBtn.addEventListener('click', () => {
      alert('Редактирование пока не реализовано')
    })
    display.appendChild(editBtn)

  } catch (err) {
    document.getElementById('loading').style.display = 'none'
    document.getElementById('error').style.display = 'block'
    document.getElementById('error').textContent = err.message
  }
})