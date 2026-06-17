import { supabase } from '../../js/supabase-config.js';

// DOM элементы (без изменений)
const loadingDiv = document.getElementById('loading');
const addressesDiv = document.getElementById('addressesData');
const currentContainer = document.getElementById('currentAddressesContainer');
const archivedContainer = document.getElementById('archivedAddressesContainer');
const addBtn = document.getElementById('addAddressBtn');

// Модальные окна (без изменений)
const addressModal = document.getElementById('addressModal');
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const messageModal = document.getElementById('messageModal');

// Поля модалки (без изменений)
const editIdInput = document.getElementById('editAddressId');
const addressType = document.getElementById('addressType');
const addressText = document.getElementById('addressText');
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const endDateGroup = document.getElementById('endDateGroup');
const modalTitle = document.getElementById('modalTitle');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const addressError = document.getElementById('addressError');

const deleteIdInput = document.getElementById('deleteAddressId');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');

const messageTitle = document.getElementById('messageTitle');
const messageText = document.getElementById('messageText');
const messageCloseBtn = document.getElementById('messageCloseBtn');

let currentUser = null;
let currentPersonalCode = null;
let addresses = [];

// --- Вспомогательные функции (без изменений) ---
function openModal(modal) { if (modal) modal.classList.add('active'); }
function closeModal(modal) {
  if (modal) {
    modal.classList.remove('active');
    const errors = modal.querySelectorAll('.error-message');
    errors.forEach(err => err.textContent = '');
  }
}
document.querySelectorAll('.modal .close, .modal .btn-secondary, #messageCloseBtn').forEach(btn => {
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

function showMessage(title, text, isError = false) {
  messageTitle.textContent = title;
  messageText.innerHTML = text;
  messageText.style.color = isError ? '#b91c1c' : 'inherit';
  openModal(messageModal);
}

// --- Получение personal_code (без изменений) ---
async function getPersonalCode(user) {
  let pc = user.user_metadata?.personal_code || user.app_metadata?.personal_code;
  if (pc) return pc;
  const { data, error } = await supabase
    .from('users')
    .select('personal_code')
    .eq('id', user.id)
    .maybeSingle();
  if (!error && data?.personal_code) return data.personal_code;
  return null;
}

// --- Загрузка адресов (используем схему addresses) ---
async function loadAddresses() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Пользователь не авторизован');
    currentUser = user;

    const pc = await getPersonalCode(user);
    if (!pc) throw new Error('Личный код не найден');
    currentPersonalCode = pc;

    const { data, error } = await supabase
      .schema('addresses')
      .from('addresses')
      .select('*')
      .eq('personal_code', pc)
      .order('created_at', { ascending: false });

    if (error) throw error;
    addresses = data || [];
    renderAddresses();

    loadingDiv.style.display = 'none';
    addressesDiv.style.display = 'block';
  } catch (err) {
    console.error(err);
    loadingDiv.textContent = 'Ошибка загрузки: ' + err.message;
  }
}

// --- Отрисовка адресов (без изменений в логике, только схема не влияет) ---
function renderAddresses() {
  const current = addresses.filter(a => a.status === 'active');
  const archived = addresses.filter(a => a.status === 'archived');

  currentContainer.innerHTML = '';
  archivedContainer.innerHTML = '';

  if (current.length === 0) {
    currentContainer.innerHTML = '<div class="empty-message">Нет текущих адресов. Добавьте новый.</div>';
  } else {
    current.forEach(addr => {
      currentContainer.appendChild(createAddressCard(addr, false));
    });
  }

  if (archived.length === 0) {
    archivedContainer.innerHTML = '<div class="empty-message">Нет архивных адресов.</div>';
  } else {
    archived.forEach(addr => {
      archivedContainer.appendChild(createAddressCard(addr, true));
    });
  }
}

function createAddressCard(addr, isArchived) {
  const card = document.createElement('div');
  card.className = `address-card ${isArchived ? 'archived' : ''}`;
  card.dataset.id = addr.id;

  const typeMap = {
    registration: 'Постоянная регистрация',
    temporary: 'Временная регистрация',
    actual: 'Фактическое проживание'
  };
  const typeLabel = typeMap[addr.type] || addr.type;

  let datesHtml = '';
  if (addr.start_date) {
    const start = new Date(addr.start_date).toLocaleDateString('ru-RU');
    datesHtml += `с ${start}`;
    if (addr.end_date) {
      const end = new Date(addr.end_date).toLocaleDateString('ru-RU');
      datesHtml += ` по ${end}`;
    }
  }

  let badgeHtml = '';
  if (isArchived) {
    badgeHtml = `<span class="verification-badge badge-archived">Архивный</span>`;
  } else {
    const status = addr.verification_status || 'oncheck';
    const statusMap = {
      verified: { label: 'Подтверждено', class: 'badge-verified' },
      oncheck: { label: 'На проверке', class: 'badge-oncheck' },
      rejected: { label: 'Отклонено', class: 'badge-rejected' }
    };
    const info = statusMap[status] || statusMap.oncheck;
    badgeHtml = `<span class="verification-badge ${info.class}">${info.label}</span>`;
  }

  card.innerHTML = `
    <div class="address-info">
      <div class="address-type">
        ${typeLabel}
        ${badgeHtml}
      </div>
      <div class="address-text">${addr.address}</div>
      ${datesHtml ? `<div class="address-dates">${datesHtml}</div>` : ''}
    </div>
    <div class="address-actions">
      ${!isArchived ? `<button class="btn-icon edit-address" title="Редактировать">✏️</button>` : ''}
      ${!isArchived ? `<button class="btn-icon archive-address" title="Архивировать">📦</button>` : ''}
      <button class="btn-icon danger delete-address" title="Удалить">🗑️</button>
    </div>
  `;

  if (!isArchived) {
    card.querySelector('.edit-address').addEventListener('click', () => openEditModal(addr));
    card.querySelector('.archive-address').addEventListener('click', () => archiveAddress(addr.id));
  }
  card.querySelector('.delete-address').addEventListener('click', () => openDeleteModal(addr.id));

  return card;
}

// --- Модалка добавления/редактирования ---
function openEditModal(addr = null) {
  addressError.textContent = '';
  if (addr) {
    modalTitle.textContent = 'Редактировать адрес';
    editIdInput.value = addr.id;
    addressType.value = addr.type;
    addressText.value = addr.address;
    startDate.value = addr.start_date || '';
    endDate.value = addr.end_date || '';
    toggleEndDate(addr.type);
  } else {
    modalTitle.textContent = 'Добавить адрес';
    editIdInput.value = '';
    addressType.value = 'registration';
    addressText.value = '';
    startDate.value = '';
    endDate.value = '';
    toggleEndDate('registration');
  }
  openModal(addressModal);
}

function toggleEndDate(type) {
  if (type === 'temporary') {
    endDateGroup.style.display = 'block';
  } else {
    endDateGroup.style.display = 'none';
    endDate.value = '';
  }
}
addressType.addEventListener('change', (e) => toggleEndDate(e.target.value));

// Сохранение адреса (используем схему addresses)
async function saveAddress() {
  const id = editIdInput.value;
  const type = addressType.value;
  const address = addressText.value.trim();
  const start = startDate.value;
  const end = endDate.value;

  if (!address) {
    addressError.textContent = 'Введите адрес.';
    return;
  }
  if (!start) {
    addressError.textContent = 'Укажите дату начала.';
    return;
  }
  if (type === 'temporary' && !end) {
    addressError.textContent = 'Для временной регистрации укажите дату окончания.';
    return;
  }

  const payload = {
    personal_code: currentPersonalCode,
    type,
    address,
    start_date: start,
    end_date: end || null,
    status: 'active',
    verification_status: 'oncheck'
  };

  try {
    let result;
    if (id) {
      const updatePayload = {
        type,
        address,
        start_date: start,
        end_date: end || null
      };
      const { error } = await supabase
        .schema('addresses')
        .from('addresses')
        .update(updatePayload)
        .eq('id', id)
        .eq('personal_code', currentPersonalCode);
      if (error) throw error;
      result = { id, ...payload };
    } else {
      const { data, error } = await supabase
        .schema('addresses')
        .from('addresses')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      result = { id: data.id, ...payload };
    }

    if (id) {
      const idx = addresses.findIndex(a => a.id === id);
      if (idx !== -1) addresses[idx] = { ...addresses[idx], ...result };
    } else {
      addresses.unshift(result);
    }

    closeModal(addressModal);
    renderAddresses();
    showMessage('Успешно', 'Адрес сохранён.');
  } catch (err) {
    addressError.textContent = 'Ошибка: ' + err.message;
  }
}

modalSaveBtn.addEventListener('click', saveAddress);
modalCancelBtn.addEventListener('click', () => closeModal(addressModal));

// --- Архивирование (схема addresses) ---
async function archiveAddress(id) {
  if (!confirm('Архивировать этот адрес?')) return;
  try {
    const { error } = await supabase
      .schema('addresses')
      .from('addresses')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('personal_code', currentPersonalCode);
    if (error) throw error;
    const idx = addresses.findIndex(a => a.id === id);
    if (idx !== -1) addresses[idx].status = 'archived';
    renderAddresses();
    showMessage('Успешно', 'Адрес архивирован.');
  } catch (err) {
    showMessage('Ошибка', err.message, true);
  }
}

// --- Удаление (схема addresses) ---
function openDeleteModal(id) {
  deleteIdInput.value = id;
  openModal(confirmDeleteModal);
}

confirmDeleteBtn.addEventListener('click', async () => {
  const id = deleteIdInput.value;
  if (!id) return;
  try {
    const { error } = await supabase
      .schema('addresses')
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('personal_code', currentPersonalCode);
    if (error) throw error;
    addresses = addresses.filter(a => a.id !== id);
    closeModal(confirmDeleteModal);
    renderAddresses();
    showMessage('Успешно', 'Адрес удалён.');
  } catch (err) {
    showMessage('Ошибка', err.message, true);
  }
});

deleteCancelBtn.addEventListener('click', () => closeModal(confirmDeleteModal));

// --- Добавление ---
addBtn.addEventListener('click', () => openEditModal(null));

// --- Инициализация ---
loadAddresses();