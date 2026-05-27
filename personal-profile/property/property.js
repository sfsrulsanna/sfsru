// property.js
import { supabase } from '../supabase-config.js';

let currentUserPersonalCode = null;
let currentTab = 'real_estate';
let editId = null;
let currentFileUrl = null;
let allItems = []; // массив всех объектов имущества

// DOM
const loadingDiv = document.getElementById('loading');
const contentDiv = document.getElementById('propertyContent');
const modal = document.getElementById('propertyModal');
const detailModal = document.getElementById('detailModal');
const detailBody = document.getElementById('detailBody');
const detailTitle = document.getElementById('detailTitle');
const downloadStatementBtn = document.getElementById('downloadStatementBtn');
let currentDetailItem = null;

// Функции работы с модалками
function openModal(modalEl) {
  modalEl.classList.add('active');
}
function closeModal(modalEl) {
  modalEl.classList.remove('active');
}
document.querySelectorAll('.modal .close, .modal .btn-secondary').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const modal = btn.closest('.modal');
    if (modal) closeModal(modal);
  });
});
window.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal')) {
    closeModal(e.target);
  }
});

// Закрытие модалки редактирования
function closeEditModal() {
  closeModal(modal);
  document.getElementById('propertyForm').reset();
  editId = null;
  currentFileUrl = null;
  document.getElementById('currentFileLink').innerHTML = '';
  document.getElementById('formError').textContent = '';
}
document.getElementById('cancelModalBtn').addEventListener('click', closeEditModal);

// Показать/скрыть поля в зависимости от типа
const propertyTypeSelect = document.getElementById('propertyType');
const realEstateFields = document.getElementById('realEstateFields');
const transportFields = document.getElementById('transportFields');
const otherFields = document.getElementById('otherFields');
function toggleDynamicFields() {
  const type = propertyTypeSelect.value;
  realEstateFields.style.display = 'none';
  transportFields.style.display = 'none';
  otherFields.style.display = 'none';
  if (type === 'real_estate') realEstateFields.style.display = 'block';
  else if (type === 'transport') transportFields.style.display = 'block';
  else otherFields.style.display = 'block';
}
propertyTypeSelect.addEventListener('change', toggleDynamicFields);

// Получение иконки по подтипу
function getIconForSubtype(subtype) {
  const s = (subtype || '').toLowerCase();
  if (s.includes('квартир') || s.includes('помещ')) return '🏢';
  if (s.includes('дом') || s.includes('коттедж')) return '🏡';
  if (s.includes('участ') || s.includes('земл')) return '🌾';
  if (s.includes('авто') || s.includes('машин') || s.includes('car')) return '🚗';
  if (s.includes('мото')) return '🏍️';
  if (s.includes('груз')) return '🚛';
  if (s.includes('спецтех')) return '🚜';
  return '📄';
}

// Загрузка данных
async function loadData() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Не авторизован');
    let personalCode = user.user_metadata?.personal_code;
    if (!personalCode) {
      const { data: profile } = await supabase.from('users').select('personal_code').eq('id', user.id).single();
      personalCode = profile?.personal_code;
    }
    if (!personalCode) throw new Error('Личный код не найден');
    currentUserPersonalCode = personalCode;

    const { data, error } = await supabase
      .from('user_property')
      .select('*')
      .eq('personal_code', personalCode);
    if (error) throw error;
    allItems = data || [];
    renderCards();
    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'block';
  } catch (err) {
    console.error(err);
    loadingDiv.textContent = 'Ошибка: ' + err.message;
  }
}

// Рендер карточек для текущей вкладки
function renderCards() {
  const filtered = allItems.filter(item => item.property_type === currentTab);
  const containerId = currentTab === 'real_estate' ? 'realEstateCards' : (currentTab === 'transport' ? 'transportCards' : 'otherCards');
  const container = document.getElementById(containerId);
  if (!container) return;
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-message">Нет объектов</div>';
    return;
  }
  container.innerHTML = filtered.map(item => {
    let primaryInfo = '', secondaryInfo = '';
    if (currentTab === 'real_estate') {
      primaryInfo = item.cadastral_number ? `Кад. номер: ${item.cadastral_number}` : (item.address || 'Адрес не указан');
      secondaryInfo = item.area ? `${item.area} м²` : '';
    } else if (currentTab === 'transport') {
      primaryInfo = item.model || item.subtype || 'Транспорт';
      secondaryInfo = item.horsepower ? `${item.horsepower} л.с.` : '';
      if (item.mileage) secondaryInfo += (secondaryInfo ? ', ' : '') + `${item.mileage} км`;
    } else {
      primaryInfo = item.property_number || item.subtype;
      secondaryInfo = item.description || '';
    }
    const icon = getIconForSubtype(item.subtype);
    return `
      <div class="property-card" data-id="${item.id}">
        <div class="card-icon">${icon}</div>
        <div class="card-info">
          <div class="card-title">${escapeHtml(item.subtype || 'Объект')}</div>
          <div class="card-subtitle">${escapeHtml(primaryInfo)}</div>
          <div class="card-details">
            <span>Доля: ${item.share}</span>
            ${secondaryInfo ? `<span>${escapeHtml(secondaryInfo)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  // Обработчики кликов по карточкам
  document.querySelectorAll(`#${containerId} .property-card`).forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const item = allItems.find(i => i.id === id);
      if (item) showDetailModal(item);
    });
  });
}

// Показать детальное модальное окно
function showDetailModal(item) {
  currentDetailItem = item;
  detailTitle.textContent = `${item.subtype || 'Объект'} (№${item.property_number || '—'})`;
  let detailsHtml = '';
  // Общие поля
  detailsHtml += `<div class="detail-row"><span class="detail-label">Тип:</span> <span class="detail-value">${item.property_type === 'real_estate' ? 'Недвижимость' : (item.property_type === 'transport' ? 'Транспорт' : 'Иное')}</span></div>`;
  detailsHtml += `<div class="detail-row"><span class="detail-label">Подтип:</span> <span class="detail-value">${escapeHtml(item.subtype || '—')}</span></div>`;
  detailsHtml += `<div class="detail-row"><span class="detail-label">Номер в ЕГРИ:</span> <span class="detail-value">${escapeHtml(item.property_number || '—')}</span></div>`;
  detailsHtml += `<div class="detail-row"><span class="detail-label">Дата возникновения:</span> <span class="detail-value">${item.ownership_date ? new Date(item.ownership_date).toLocaleDateString() : '—'}</span></div>`;
  detailsHtml += `<div class="detail-row"><span class="detail-label">Доля:</span> <span class="detail-value">${item.share}</span></div>`;
  // Специфические
  if (item.property_type === 'real_estate') {
    detailsHtml += `<div class="detail-row"><span class="detail-label">Площадь:</span> <span class="detail-value">${item.area ? item.area + ' м²' : '—'}</span></div>`;
    detailsHtml += `<div class="detail-row"><span class="detail-label">Кадастровый номер:</span> <span class="detail-value">${escapeHtml(item.cadastral_number || '—')}</span></div>`;
    detailsHtml += `<div class="detail-row"><span class="detail-label">Адрес:</span> <span class="detail-value">${escapeHtml(item.address || '—')}</span></div>`;
  } else if (item.property_type === 'transport') {
    detailsHtml += `<div class="detail-row"><span class="detail-label">Пробег:</span> <span class="detail-value">${item.mileage ? item.mileage + ' км' : '—'}</span></div>`;
    detailsHtml += `<div class="detail-row"><span class="detail-label">Лошадиные силы:</span> <span class="detail-value">${item.horsepower ? item.horsepower + ' л.с.' : '—'}</span></div>`;
    detailsHtml += `<div class="detail-row"><span class="detail-label">VIN:</span> <span class="detail-value">${escapeHtml(item.vin || '—')}</span></div>`;
    detailsHtml += `<div class="detail-row"><span class="detail-label">Модель/Марка:</span> <span class="detail-value">${escapeHtml(item.model || '—')}</span></div>`;
  } else {
    detailsHtml += `<div class="detail-row"><span class="detail-label">Описание:</span> <span class="detail-value">${escapeHtml(item.description || '—')}</span></div>`;
  }
  detailBody.innerHTML = detailsHtml;
  openModal(detailModal);
}

// Скачивание выписки
async function downloadFile(filePath) {
  if (!filePath) {
    alert('Выписка не прикреплена');
    return;
  }
  const { data, error } = await supabase.storage.from('property_statements').download(filePath);
  if (error) {
    alert('Ошибка загрузки файла');
    return;
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filePath.split('/').pop();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
downloadStatementBtn.addEventListener('click', () => {
  if (currentDetailItem && currentDetailItem.file_path) {
    downloadFile(currentDetailItem.file_path);
  } else {
    alert('Выписка отсутствует');
  }
});
document.getElementById('closeDetailBtn').addEventListener('click', () => closeModal(detailModal));

// Добавление/редактирование
document.getElementById('addPropertyBtn').addEventListener('click', () => {
  editId = null;
  document.getElementById('propertyForm').reset();
  currentFileUrl = null;
  document.getElementById('propertyId').value = '';
  document.getElementById('currentFileLink').innerHTML = '';
  propertyTypeSelect.value = 'real_estate';
  toggleDynamicFields();
  openModal(modal);
});

async function saveProperty() {
  const formData = {
    personal_code: currentUserPersonalCode,
    property_type: propertyTypeSelect.value,
    property_number: document.getElementById('propertyNumber').value || null,
    ownership_date: document.getElementById('ownershipDate').value,
    share: parseFloat(document.getElementById('share').value) || 1,
    subtype: document.getElementById('subtype').value,
    area: document.getElementById('area').value ? parseFloat(document.getElementById('area').value) : null,
    cadastral_number: document.getElementById('cadastralNumber').value || null,
    address: document.getElementById('address').value || null,
    mileage: document.getElementById('mileage').value ? parseInt(document.getElementById('mileage').value) : null,
    horsepower: document.getElementById('horsepower').value ? parseInt(document.getElementById('horsepower').value) : null,
    vin: document.getElementById('vin').value || null,
    model: document.getElementById('model').value || null,
    description: document.getElementById('description').value || null
  };
  // Загрузка файла
  const fileInput = document.getElementById('statementFile');
  let filePath = currentFileUrl;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
    const storagePath = `${currentUserPersonalCode}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('property_statements')
      .upload(storagePath, file);
    if (uploadError) {
      document.getElementById('formError').textContent = 'Ошибка загрузки файла';
      return;
    }
    if (currentFileUrl && currentFileUrl !== storagePath) {
      await supabase.storage.from('property_statements').remove([currentFileUrl]);
    }
    filePath = storagePath;
  }
  formData.file_path = filePath;

  let result;
  if (editId) {
    result = await supabase.from('user_property').update(formData).eq('id', editId);
  } else {
    result = await supabase.from('user_property').insert([formData]);
  }
  if (result.error) {
    document.getElementById('formError').textContent = result.error.message;
    return;
  }
  closeModal(modal);
  loadData(); // перезагрузить список
}
document.getElementById('savePropertyBtn').addEventListener('click', saveProperty);

// Редактирование по клику на карточке (пока не реализовано, можно добавить кнопку редактирования в деталях)
// Для редактирования можно добавить кнопку в детальное окно
// Здесь пока нет, но можно позже.

// Переключение вкладок
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.type;
    document.querySelectorAll('.cards-container').forEach(container => container.style.display = 'none');
    if (currentTab === 'real_estate') document.getElementById('realEstateCards').style.display = 'flex';
    else if (currentTab === 'transport') document.getElementById('transportCards').style.display = 'flex';
    else document.getElementById('otherCards').style.display = 'flex';
    renderCards();
  });
});

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

loadData();