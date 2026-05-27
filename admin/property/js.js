import { supabase } from '../../js/supabase-config.js';

// DOM элементы
const loadingDiv = document.getElementById('loading');
const tableContainer = document.getElementById('tableContainer');
const tbody = document.getElementById('propertyTbody');
const filterType = document.getElementById('filterType');
const filterOwner = document.getElementById('filterOwner');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const addBtn = document.getElementById('addPropertyBtn');
const modal = document.getElementById('propertyModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const modalTitle = document.getElementById('modalTitle');
const propertyForm = document.getElementById('propertyForm');
const saveBtn = document.getElementById('savePropertyBtn');
const propertyType = document.getElementById('propertyType');
const realEstateFields = document.getElementById('realEstateFields');
const transportFields = document.getElementById('transportFields');
const formError = document.getElementById('formError');

let currentEditId = null;
let currentFileUrl = null;

// Проверка администратора
async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../login.html';
        return;
    }
    const { data: profile, error } = await supabase
        .from('users')
        .select('role, email')
        .eq('id', session.user.id)
        .single();
    if (error || profile?.role !== 'admin') {
        await supabase.auth.signOut();
        window.location.href = '../../login.html';
        return;
    }
    document.getElementById('adminEmail').textContent = profile.email || session.user.email;
}
checkAdmin();

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '../../login.html';
});

// Загрузка данных с фильтрацией
async function loadData() {
    loadingDiv.style.display = 'block';
    tableContainer.style.display = 'none';
    
    let query = supabase
        .from('user_property')
        .select('*');
    
    const type = filterType.value;
    if (type !== 'all') {
        query = query.eq('property_type', type);
    }
    
    const ownerFilter = filterOwner.value.trim();
    if (ownerFilter) {
        // сначала ищем personal_code или ФИО через таблицу users
        const { data: users } = await supabase
            .from('users')
            .select('personal_code, surname, name, patronymic')
            .or(`personal_code.ilike.%${ownerFilter}%,surname.ilike.%${ownerFilter}%,name.ilike.%${ownerFilter}%`);
        if (users && users.length > 0) {
            const personalCodes = users.map(u => u.personal_code);
            query = query.in('personal_code', personalCodes);
        } else {
            // если не найдено, то результат пуст
            query = query.eq('personal_code', 'nonexistent');
        }
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        loadingDiv.textContent = 'Ошибка загрузки';
        return;
    }
    
    // Получаем ФИО для всех владельцев
    const personalCodes = [...new Set(data.map(item => item.personal_code))];
    const { data: usersData } = await supabase
        .from('users')
        .select('personal_code, surname, name, patronymic')
        .in('personal_code', personalCodes);
    const userMap = {};
    if (usersData) {
        usersData.forEach(u => {
            userMap[u.personal_code] = `${u.surname || ''} ${u.name || ''} ${u.patronymic || ''}`.trim() || u.personal_code;
        });
    }
    
    renderTable(data, userMap);
    loadingDiv.style.display = 'none';
    tableContainer.style.display = 'block';
}

function renderTable(items, userMap) {
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11">Нет записей</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(item => {
        let extraInfo = '';
        if (item.property_type === 'real_estate') {
            extraInfo = `Площадь: ${item.area ? item.area + ' м²' : '—'}, Кадастр: ${item.cadastral_number || '—'}`;
        } else if (item.property_type === 'transport') {
            extraInfo = `Пробег: ${item.mileage ? item.mileage + ' км' : '—'}, Л.с.: ${item.horsepower || '—'}, VIN: ${item.vin || '—'}`;
        } else {
            extraInfo = '—';
        }
        const ownerName = userMap[item.personal_code] || item.personal_code;
        return `
            <tr data-id="${item.id}">
                <td>${item.id.slice(0,8)}...</td>
                <td>${item.personal_code}</td>
                <td>${escapeHtml(ownerName)}</td>
                <td>${item.property_type === 'real_estate' ? 'Недвижимость' : (item.property_type === 'transport' ? 'Транспорт' : 'Иное')}</td>
                <td>${escapeHtml(item.subtype || '—')}</td>
                <td>${escapeHtml(item.property_number || '—')}</td>
                <td>${item.ownership_date ? new Date(item.ownership_date).toLocaleDateString() : '—'}</td>
                <td>${item.share}</td>
                <td>${extraInfo}</td>
                <td>${item.file_path ? `<button class="btn-icon btn-download" data-file="${item.file_path}">📄</button>` : '—'}</td>
                <td>
                    <button class="btn-icon btn-edit" data-id="${item.id}">✏️</button>
                    <button class="btn-icon btn-delete" data-id="${item.id}">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Обработчики
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            editItem(id);
        });
    });
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            deleteItem(id);
        });
    });
    tbody.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filePath = btn.dataset.file;
            downloadFile(filePath);
        });
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function downloadFile(filePath) {
    const { data, error } = await supabase.storage.from('property_statements').download(filePath);
    if (error) {
        alert('Не удалось скачать файл');
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

function toggleDynamicFields() {
    const type = propertyType.value;
    if (type === 'real_estate') {
        realEstateFields.style.display = 'block';
        transportFields.style.display = 'none';
    } else if (type === 'transport') {
        realEstateFields.style.display = 'none';
        transportFields.style.display = 'block';
    } else {
        realEstateFields.style.display = 'none';
        transportFields.style.display = 'none';
    }
}
propertyType.addEventListener('change', toggleDynamicFields);

function openModal(editMode = false) {
    modal.classList.add('active');
}
function closeModal() {
    modal.classList.remove('active');
    propertyForm.reset();
    currentEditId = null;
    currentFileUrl = null;
    document.getElementById('currentFileLink').innerHTML = '';
    formError.textContent = '';
    propertyType.value = 'real_estate';
    toggleDynamicFields();
}
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

async function editItem(id) {
    const { data, error } = await supabase.from('user_property').select('*').eq('id', id).single();
    if (error) return;
    currentEditId = id;
    fillForm(data);
    openModal(true);
}

function fillForm(data) {
    document.getElementById('propertyId').value = data.id;
    document.getElementById('personalCode').value = data.personal_code;
    propertyType.value = data.property_type;
    toggleDynamicFields();
    document.getElementById('propertyNumber').value = data.property_number || '';
    document.getElementById('ownershipDate').value = data.ownership_date ? data.ownership_date.slice(0,10) : '';
    document.getElementById('share').value = data.share || 1;
    document.getElementById('subtype').value = data.subtype || '';
    document.getElementById('area').value = data.area || '';
    document.getElementById('cadastralNumber').value = data.cadastral_number || '';
    document.getElementById('mileage').value = data.mileage || '';
    document.getElementById('horsepower').value = data.horsepower || '';
    document.getElementById('vin').value = data.vin || '';
    if (data.file_path) {
        currentFileUrl = data.file_path;
        document.getElementById('currentFileLink').innerHTML = `<a href="#" id="currentFileLinkAnchor">Текущая выписка</a>`;
        document.getElementById('currentFileLinkAnchor')?.addEventListener('click', (e) => {
            e.preventDefault();
            downloadFile(data.file_path);
        });
    } else {
        currentFileUrl = null;
        document.getElementById('currentFileLink').innerHTML = '';
    }
    modalTitle.textContent = 'Редактирование объекта';
}

async function deleteItem(id) {
    if (!confirm('Удалить объект имущества? Это действие необратимо.')) return;
    const { error } = await supabase.from('user_property').delete().eq('id', id);
    if (error) {
        alert('Ошибка удаления');
        return;
    }
    loadData();
}

addBtn.addEventListener('click', () => {
    currentEditId = null;
    propertyForm.reset();
    currentFileUrl = null;
    document.getElementById('currentFileLink').innerHTML = '';
    document.getElementById('propertyId').value = '';
    propertyType.value = 'real_estate';
    toggleDynamicFields();
    modalTitle.textContent = 'Добавление объекта';
    openModal();
});

saveBtn.addEventListener('click', async () => {
    formError.textContent = '';
    const personal_code = document.getElementById('personalCode').value.trim();
    if (!personal_code) {
        formError.textContent = 'Личный код обязателен';
        return;
    }
    const property_type = propertyType.value;
    const property_number = document.getElementById('propertyNumber').value.trim() || null;
    const ownership_date = document.getElementById('ownershipDate').value;
    if (!ownership_date) {
        formError.textContent = 'Дата возникновения права обязательна';
        return;
    }
    const share = parseFloat(document.getElementById('share').value) || 1;
    const subtype = document.getElementById('subtype').value.trim();
    if (!subtype) {
        formError.textContent = 'Подтип обязателен';
        return;
    }
    const area = document.getElementById('area').value ? parseFloat(document.getElementById('area').value) : null;
    const cadastral_number = document.getElementById('cadastralNumber').value.trim() || null;
    const mileage = document.getElementById('mileage').value ? parseInt(document.getElementById('mileage').value) : null;
    const horsepower = document.getElementById('horsepower').value ? parseInt(document.getElementById('horsepower').value) : null;
    const vin = document.getElementById('vin').value.trim() || null;
    
    let file_path = currentFileUrl;
    const fileInput = document.getElementById('statementFile');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
        const storagePath = `${personal_code}/${fileName}`;
        const { error: uploadError } = await supabase.storage
            .from('property_statements')
            .upload(storagePath, file);
        if (uploadError) {
            formError.textContent = 'Ошибка загрузки файла: ' + uploadError.message;
            return;
        }
        if (currentFileUrl) {
            await supabase.storage.from('property_statements').remove([currentFileUrl]);
        }
        file_path = storagePath;
    }
    
    const record = {
        personal_code,
        property_type,
        property_number,
        ownership_date,
        share,
        subtype,
        area,
        cadastral_number,
        mileage,
        horsepower,
        vin,
        file_path
    };
    
    let result;
    if (currentEditId) {
        result = await supabase.from('user_property').update(record).eq('id', currentEditId);
    } else {
        result = await supabase.from('user_property').insert([record]);
    }
    if (result.error) {
        formError.textContent = result.error.message;
        return;
    }
    closeModal();
    loadData();
});

applyFiltersBtn.addEventListener('click', () => {
    loadData();
});

loadData();