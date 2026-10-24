// admin/certificates/js/add.js
import { supabase } from '../../../js/supabase-config.js'
import { requireAdmin, CERTIFICATE_TABLES, CERTIFICATE_FIELDS, createCertificate, escapeHTML } from './certificates-common.js'

document.addEventListener('DOMContentLoaded', async () => {
  if (!await requireAdmin()) return

  const typeSelect = document.getElementById('typeSelect')
  const form = document.getElementById('certificateForm')
  const formFields = document.getElementById('formFields')
  const messageDiv = document.getElementById('message')

  // Заполняем селект типов
  typeSelect.innerHTML = '<option value="">-- Выберите тип --</option>' +
    Object.entries(CERTIFICATE_TABLES).map(([key, info]) =>
      `<option value="${key}">${escapeHTML(info.title)}</option>`
    ).join('')

  // При изменении типа генерируем форму
  typeSelect.addEventListener('change', () => {
    const type = typeSelect.value
    if (!type) {
      form.style.display = 'none'
      return
    }

    const fields = CERTIFICATE_FIELDS[type]
    if (!fields) {
      alert('Для этого типа пока не описаны поля')
      form.style.display = 'none'
      return
    }

    // Строим HTML формы
    let html = ''
    fields.forEach(field => {
      const required = field.required ? 'required' : ''
      const value = '' // начальное пустое
      if (field.type === 'select') {
        // Для select нужно передать options, но в наших полях select нет, кроме статуса (но статус проставляется автоматически)
        // Можно добавить позже, если появятся select-поля
        html += `
          <div class="form-group">
            <label for="field_${field.name}">${escapeHTML(field.label)} ${field.required ? '*' : ''}</label>
            <select id="field_${field.name}" name="${field.name}" class="form-input" ${required}>
              ${field.options ? field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('') : ''}
            </select>
          </div>
        `
      } else {
        html += `
          <div class="form-group">
            <label for="field_${field.name}">${escapeHTML(field.label)} ${field.required ? '*' : ''}</label>
            <input type="${field.type}" id="field_${field.name}" name="${field.name}" class="form-input" value="${escapeHTML(value)}" ${required}>
          </div>
        `
      }
    })
    formFields.innerHTML = html
    form.style.display = 'block'
    messageDiv.style.display = 'none'
  })

  // Обработка отправки формы
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const type = typeSelect.value
    if (!type) {
      alert('Выберите тип свидетельства')
      return
    }

    const fields = CERTIFICATE_FIELDS[type]
    if (!fields) return

    // Собираем данные
    const formData = {}
    fields.forEach(field => {
      const input = document.getElementById(`field_${field.name}`)
      if (input) {
        let value = input.value.trim()
        if (field.type === 'date' && value === '') value = null
        else if (field.type === 'time' && value === '') value = null
        formData[field.name] = value
      }
    })

    // Проверка обязательных полей
    const missing = fields.filter(f => f.required && !formData[f.name])
    if (missing.length > 0) {
      alert(`Заполните обязательные поля: ${missing.map(f => f.label).join(', ')}`)
      return
    }

    try {
      const result = await createCertificate(type, formData)
      messageDiv.className = 'message success'
      messageDiv.textContent = `Свидетельство успешно создано! ID: ${result.id}`
      messageDiv.style.display = 'block'
      form.reset()
      // Можно перенаправить на страницу просмотра
      // window.location.href = `view.html?type=${type}&id=${result.id}`
    } catch (err) {
      messageDiv.className = 'message error'
      messageDiv.textContent = 'Ошибка: ' + err.message
      messageDiv.style.display = 'block'
    }
  })
})