import { supabase } from '../../js/supabase-config.js';

const loadingEl = document.getElementById('loading');
const currentContainer = document.getElementById('currentAddresses');
const archivedContainer = document.getElementById('archivedAddresses');
const noDataEl = document.getElementById('noData');
const tabBtns = document.querySelectorAll('.tab-btn');

const SCHEMA = 'addresses';

const STATUS_META = {
  verified: { label: 'Подтверждено', class: 'verified' },
  pending:  { label: 'На проверке', class: 'pending' },
  rejected: { label: 'Отклонено', class: 'rejected' },
  archived: { label: 'Архивный', class: 'archived' },
};

function getStatusMeta(status) {
  return STATUS_META[status] || { label: status || 'Неизвестно', class: '' };
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function renderAddressCard(address, isArchived = false) {
  const card = document.createElement('div');
  card.className = `address-card ${isArchived ? 'archived' : ''}`;

  let title = '';
  let datesHtml = '';

  if (address.registration_date !== undefined) {
    title = 'Постоянная регистрация по месту жительства';
    datesHtml = `<span>Дата регистрации: ${formatDate(address.registration_date)}</span>`;
  } else if (address.start_date !== undefined && address.end_date !== undefined) {
    title = 'Временная регистрация по месту пребывания';
    datesHtml = `
      <span>Начало: ${formatDate(address.start_date)}</span>
      <span>Конец: ${formatDate(address.end_date)}</span>
    `;
  } else {
    title = 'Фактическое место жительства';
    datesHtml = '';
  }

  const statusMeta = getStatusMeta(address.status);
  const statusPill = document.createElement('div');
  statusPill.className = `status-pill ${statusMeta.class}`;
  statusPill.textContent = statusMeta.label;

  const addressText = document.createElement('div');
  addressText.className = 'card-address';
  addressText.textContent = address.address || 'Адрес не указан';

  const datesBlock = document.createElement('div');
  datesBlock.className = 'card-dates';
  datesBlock.innerHTML = datesHtml;

  const titleEl = document.createElement('h3');
  titleEl.className = 'card-title';
  titleEl.textContent = title;

  card.appendChild(statusPill);
  card.appendChild(titleEl);
  card.appendChild(addressText);
  if (datesHtml) card.appendChild(datesBlock);

  return card;
}

async function loadAddresses() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Пользователь не авторизован');
    }
    const userId = user.id;

    const tables = ['permanent_registration', 'temporary_registration', 'actual_residence'];
    const allResults = await Promise.all(
      tables.map(table =>
        supabase
          .from(table)
          .schema(SCHEMA) // <-- явно указываем схему
          .select('*')
          .eq('user_id', userId)
      )
    );

    let allAddresses = [];
    allResults.forEach((result, idx) => {
      if (result.error) {
        console.warn(`Ошибка загрузки ${tables[idx]}:`, result.error);
        return;
      }
      const records = result.data.map(rec => ({
        ...rec,
        _table: tables[idx],
      }));
      allAddresses = allAddresses.concat(records);
    });

    const current = allAddresses.filter(a => a.status !== 'archived');
    const archived = allAddresses.filter(a => a.status === 'archived');

    renderAddresses(currentContainer, current, false);
    renderAddresses(archivedContainer, archived, true);

    loadingEl.style.display = 'none';
    if (current.length === 0 && archived.length === 0) {
      noDataEl.style.display = 'block';
      currentContainer.style.display = 'none';
      archivedContainer.style.display = 'none';
    } else {
      noDataEl.style.display = 'none';
      currentContainer.style.display = 'block';
      archivedContainer.style.display = 'block';
    }

    switchTab('current');

  } catch (err) {
    console.error('Ошибка загрузки адресов:', err);
    loadingEl.textContent = 'Ошибка загрузки данных. Попробуйте позже.';
  }
}

function renderAddresses(container, addresses, isArchived) {
  container.innerHTML = '';
  if (!addresses || addresses.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'no-data';
    msg.textContent = 'Нет адресов';
    container.appendChild(msg);
    return;
  }
  addresses.forEach(addr => {
    const card = renderAddressCard(addr, isArchived);
    container.appendChild(card);
  });
}

function switchTab(tabId) {
  const isCurrent = tabId === 'current';
  currentContainer.style.display = isCurrent ? 'block' : 'none';
  archivedContainer.style.display = isCurrent ? 'none' : 'block';
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

loadAddresses();