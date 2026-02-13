  import { supabase } from '../../js/supabase-config.js'

  let currentDocId = null
  let documentData = {}
  let userPersonalCode = null
  let userProfile = null
  let formData = {}

  function formatDate(dateString) {
    if (!dateString) return '—'
    try { return new Date(dateString).toLocaleDateString('ru-RU') } catch { return dateString }
  }

  function getStatusLabel(status) {
    if (status === 'verified') return '✅ Подтверждено'
    if (status === 'oncheck') return '⏳ На проверке'
    if (status === 'rejected') return '❌ Отклонено'
    return '—'
  }

  async function loadData() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        window.location.href = '../../login.html'
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('personal_code, surname, name, patronymic, date_of_birth, place_of_birth, gender')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        console.error('Ошибка загрузки профиля:', profileError)
        document.getElementById('loading').textContent = 'Ошибка загрузки профиля'
        return
      }

      userProfile = profile
      userPersonalCode = profile.personal_code
      console.log('Профиль пользователя:', userProfile)

      const urlParams = new URLSearchParams(window.location.search)
      const idFromUrl = urlParams.get('id')

      let documentResult = null

      if (idFromUrl) {
        const { data, error } = await supabase
          .from('documents_nss')
          .select('*')
          .eq('id', idFromUrl)
          .single()
        if (!error) documentResult = { data }
      } else {
        const { data, error } = await supabase
          .from('documents_nss')
          .select('*')
          .eq('personal_code', userPersonalCode)
          .order('created_at', { ascending: false })
          .limit(1)
        if (!error && data && data.length > 0) documentResult = { data: data[0] }
      }

      const loadingEl = document.getElementById('loading')
      const contentEl = document.getElementById('content')
      const noDataEl = document.getElementById('noData')

      if (documentResult && documentResult.data) {
        documentData = documentResult.data
        currentDocId = documentData.id
        console.log('Загружен документ:', documentData)

        renderDocument(documentData)
        loadingEl.style.display = 'none'
        contentEl.style.display = 'block'
        noDataEl.style.display = 'none'
      } else {
        loadingEl.style.display = 'none'
        contentEl.style.display = 'none'
        noDataEl.style.display = 'block'
      }
    } catch (err) {
      console.error('Необработанная ошибка в loadData:', err)
      document.getElementById('loading').textContent = 'Произошла критическая ошибка'
    }
  }

  function renderDocument(data) {
    document.getElementById('nssNumber').textContent = data.nss_number || '—'
    document.getElementById('surname').textContent = data.surname || '—'
    document.getElementById('name').textContent = data.name || '—'
    document.getElementById('patronymic').textContent = data.patronymic || '—'
    document.getElementById('gender').textContent = data.gender || '—'
    document.getElementById('birthDate').textContent = formatDate(data.birth_date)
    document.getElementById('birthPlace').textContent = data.birth_place || '—'
    document.getElementById('issueDate').textContent = formatDate(data.issue_date)
    document.getElementById('issuedBy').textContent = data.issued_by || '—'

    const qrContainer = document.getElementById('qrCode')
    qrContainer.innerHTML = ''
    if (data.nss_number) {
      new QRCode(qrContainer, {
        text: data.nss_number,
        width: 180,
        height: 180,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L
      })
    }

    const statusBadge = document.getElementById('statusBadge')
    const status = data.status || 'oncheck'
    statusBadge.className = `document-status status-${status}`
    statusBadge.textContent = getStatusLabel(status)
    statusBadge.style.display = 'inline-block'
  }

// --- Функции для модального окна ---
window.closeModal = function() {
  document.getElementById('modalOverlay').classList.remove('active');
}

function openModal(title) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalOverlay').classList.add('active');
  renderModalForm();
}

function renderModalForm() {
  const modalBody = document.getElementById('modalBody');
  if (!modalBody) {
    console.error('Ошибка: элемент modalBody не найден!');
    return;
  }

  // Очищаем содержимое
  modalBody.innerHTML = '';

  // Создаём поля формы программно
  const fields = [
    { id: 'nss_number', label: 'Номер НСС', type: 'text', value: formData.nss_number || '' },
    { id: 'surname', label: 'Фамилия', type: 'text', value: formData.surname || '' },
    { id: 'name', label: 'Имя', type: 'text', value: formData.name || '' },
    { id: 'patronymic', label: 'Отчество', type: 'text', value: formData.patronymic || '' },
    { id: 'gender', label: 'Пол', type: 'text', value: formData.gender || '', placeholder: 'Мужской / Женский' },
    { id: 'birth_date', label: 'Дата рождения', type: 'date', value: formData.birth_date || '' },
    { id: 'birth_place', label: 'Место рождения', type: 'text', value: formData.birth_place || '' },
    { id: 'issue_date', label: 'Дата выдачи', type: 'date', value: formData.issue_date || '' },
    { id: 'issued_by', label: 'Кем выдан', type: 'text', value: formData.issued_by || '' },
    { id: 'personal_code_ref', label: 'Личный код', type: 'text', value: userPersonalCode || '', readonly: true }
  ];

  fields.forEach(field => {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.htmlFor = field.id;
    label.textContent = field.label;
    group.appendChild(label);

    const input = document.createElement('input');
    input.type = field.type;
    input.id = field.id;
    input.className = 'form-input';
    input.value = field.value;
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.readonly) input.readOnly = true;

    group.appendChild(input);
    modalBody.appendChild(group);
  });

  // Проверка, что поля созданы
  console.log('Поля после рендера:');
  ['surname', 'name', 'patronymic', 'gender'].forEach(id => {
    const el = document.getElementById(id);
    console.log(`${id}:`, el, el ? el.value : 'NOT FOUND');
  });
}

// --- Открытие модалки для редактирования ---
window.openEditModal = function() {
  formData = {
    nss_number: documentData.nss_number || '',
    surname: documentData.surname || userProfile?.surname || '',
    name: documentData.name || userProfile?.name || '',
    patronymic: documentData.patronymic || userProfile?.patronymic || '',
    gender: documentData.gender || userProfile?.gender || '',
    birth_date: documentData.birth_date || userProfile?.date_of_birth || '',
    birth_place: documentData.birth_place || userProfile?.place_of_birth || '',
    issue_date: documentData.issue_date || '',
    issued_by: documentData.issued_by || '',
    personal_code_ref: documentData.personal_code_ref || userPersonalCode || ''
  };
  console.log('Редактирование: начальные данные формы', formData);
  openModal('Редактирование НСС');
};

// --- Сохранение ---
async function saveDocument() {
  // Проверим наличие всех полей перед сохранением
  const requiredIds = ['nss_number', 'surname', 'name', 'patronymic', 'gender', 'birth_date', 'birth_place', 'issue_date', 'issued_by', 'personal_code_ref'];
  const missing = [];
  requiredIds.forEach(id => {
    if (!document.getElementById(id)) missing.push(id);
  });
  if (missing.length > 0) {
    console.error('Отсутствуют элементы формы:', missing);
    alert('Ошибка: не удалось найти поля формы. Попробуйте открыть модальное окно заново.');
    return;
  }

  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? (el.value?.trim() ?? '') : '';
  };

  const formDataToSend = {
    nss_number: getVal('nss_number'),
    surname: getVal('surname'),
    name: getVal('name'),
    patronymic: getVal('patronymic'),
    gender: getVal('gender'),
    birth_date: getVal('birth_date') || null,
    birth_place: getVal('birth_place'),
    issue_date: getVal('issue_date') || null,
    issued_by: getVal('issued_by'),
    personal_code_ref: getVal('personal_code_ref') || userPersonalCode,
    personal_code: userPersonalCode,
    status: 'oncheck',
    updated_at: new Date().toISOString()
  };

  if (!formDataToSend.nss_number) {
    alert('Номер НСС обязателен для заполнения');
    return;
  }

  console.log('Сохранение: отправляемые данные', formDataToSend);

  let result;
  if (currentDocId) {
    result = await supabase
      .from('documents_nss')
      .update(formDataToSend)
      .eq('id', currentDocId)
      .select();
  } else {
    formDataToSend.created_at = new Date().toISOString();
    result = await supabase
      .from('documents_nss')
      .insert([formDataToSend])
      .select();
  }

  if (result.error) {
    console.error('Ошибка сохранения:', result.error);
    alert('Ошибка сохранения: ' + result.error.message);
    return;
  }

  console.log('Сохранение успешно, ответ:', result);

  window.closeModal();

  const savedId = currentDocId || (result.data && result.data[0]?.id);
  if (savedId) {
    window.location.href = `nss.html?id=${savedId}`;
  } else {
    window.location.reload();
  }
}

  // --- Инициализация ---
  document.addEventListener('DOMContentLoaded', async () => {
    await loadData()

    document.getElementById('addBtn')?.addEventListener('click', window.openAddModal)
    document.getElementById('editBtn')?.addEventListener('click', window.openEditModal)
    document.getElementById('modalSaveBtn')?.addEventListener('click', saveDocument)
  })