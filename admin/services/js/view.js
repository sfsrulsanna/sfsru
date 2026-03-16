import { supabase } from '../../../js/supabase-config.js';
import { requireAdmin } from '../certificates/js/certificates-common.js';

let currentAppId = null;
let currentAction = null; // 'complete', 'reject', 'cancel', 'interim'
let selectedFiles = [];

async function loadApplication() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) {
        showError('Не указан ID заявления');
        return;
    }
    currentAppId = id;

    const { data, error } = await supabase
        .schema('services')
        .from('passport')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        showError('Заявление не найдено');
        return;
    }

    document.getElementById('appNumber').textContent = `№ ${data.application_number}`;
    renderDetails(data);
    loadComments();
    loadAttachments();

    // Загружаем фото
    if (data.photo_path) {
        const { data: publicUrl } = supabase.storage.from('services-files').getPublicUrl(data.photo_path);
        document.getElementById('userPhoto').src = publicUrl.publicUrl;
        document.getElementById('downloadPhotoLink').href = publicUrl.publicUrl;
        document.getElementById('photoSection').style.display = 'block';
    }

    document.getElementById('loading').classList.add('hidden');
}

function renderDetails(data) {
    const container = document.getElementById('appDetails');
    // Красивая таблица на русском языке
    let html = '<table class="details-table">';
    html += `<tr><th>Номер заявления</th><td>${data.application_number}</td></tr>`;
    html += `<tr><th>Статус</th><td>${getStatusText(data.status)}</td></tr>`;
    html += `<tr><th>Дата создания</th><td>${new Date(data.created_at).toLocaleString('ru-RU')}</td></tr>`;
    html += `<tr><th>Причина</th><td>${getReasonText(data.reason)}</td></tr>`;
    if (data.reason_details) {
        html += `<tr><th>Детали причины</th><td>${JSON.stringify(data.reason_details)}</td></tr>`;
    }
    if (data.personal_data) {
        const pd = data.personal_data;
        html += `<tr><th>ФИО</th><td>${pd.surname} ${pd.name} ${pd.patronymic}</td></tr>`;
        html += `<tr><th>Дата рождения</th><td>${new Date(pd.birth_date).toLocaleDateString('ru-RU')}</td></tr>`;
        html += `<tr><th>Место рождения</th><td>${pd.birth_place || '—'}</td></tr>`;
        html += `<tr><th>Пол</th><td>${pd.gender}</td></tr>`;
    }
    if (data.new_personal_data && Object.keys(data.new_personal_data).length) {
        html += `<tr><th>Новые данные</th><td>${JSON.stringify(data.new_personal_data)}</td></tr>`;
    }
    html += `<tr><th>Телефон</th><td>${data.phone || '—'}</td></tr>`;
    html += `<tr><th>Email</th><td>${data.email || '—'}</td></tr>`;
    // ... можно добавить другие поля
    html += '</table>';
    container.innerHTML = html;
    container.classList.remove('hidden');
}

function getStatusText(status) {
    const map = {
        'submitted': 'Отправлено в ведомство',
        'processing': 'В работе',
        'completed': 'Завершено',
        'rejected': 'Отказано',
        'cancelled': 'Отменено'
    };
    return map[status] || status;
}

function getReasonText(reason) {
    const map = {
        '14_20_45': 'Исполнилось 14, 20 или 45 лет',
        'no_space': 'Закончилось место для штампов',
        'name_changed': 'Изменилось ФИО, дата или место рождения',
        'lost': 'Паспорт утерян или украден',
        'damaged': 'Паспорт стал непригодным',
        'citizenship': 'Получение гражданства',
        'appearance': 'Изменилась внешность',
        'error': 'Ошибка в паспорте'
    };
    return map[reason] || reason;
}

function showError(msg) {
    const err = document.getElementById('error');
    err.textContent = msg;
    err.classList.remove('hidden');
    document.getElementById('loading').classList.add('hidden');
}

async function loadComments() {
    const { data, error } = await supabase
        .schema('services')
        .from('passport_comments')
        .select('*')
        .eq('passport_id', currentAppId)
        .order('created_at', { ascending: true });

    const list = document.getElementById('commentsList');
    if (error) {
        list.innerHTML = '<p>Ошибка загрузки комментариев</p>';
        return;
    }
    if (!data || data.length === 0) {
        list.innerHTML = '<p>Нет комментариев</p>';
        return;
    }
    list.innerHTML = data.map(c => {
        const typeIcon = c.type === 'interim' ? '📌' : '💬';
        return `
            <div class="comment-item">
                <div class="comment-meta">${new Date(c.created_at).toLocaleString()} — Администратор ${typeIcon}</div>
                <div>${c.comment}</div>
            </div>
        `;
    }).join('');
}

async function loadAttachments() {
    const { data, error } = await supabase
        .schema('services')
        .from('passport_attachments')
        .select('*')
        .eq('passport_id', currentAppId)
        .order('created_at', { ascending: false });

    const list = document.getElementById('attachmentsList');
    if (error) {
        list.innerHTML = '<p>Ошибка загрузки вложений</p>';
        return;
    }
    if (!data || data.length === 0) {
        list.innerHTML = '<p>Нет вложений</p>';
        return;
    }
    list.innerHTML = data.map(a => {
        const url = supabase.storage.from('services-files').getPublicUrl(a.file_path).data.publicUrl;
        return `
            <div class="attachment-item">
                <a href="${url}" target="_blank">${a.file_name || a.file_path}</a>
                <span class="comment-meta">загружено ${new Date(a.created_at).toLocaleString()}</span>
            </div>
        `;
    }).join('');
}

function openModal(title, allowFiles = true) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalComment').value = '';
    document.getElementById('modalFiles').value = '';
    document.getElementById('fileUploadGroup').style.display = allowFiles ? 'block' : 'none';
    document.getElementById('modalFileList').innerHTML = '';
    selectedFiles = [];
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    currentAction = null;
}

async function uploadFiles(passportId, files) {
    const uploadPromises = Array.from(files).map(async (file) => {
        const filePath = `passport/admin/${passportId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
            .from('services-files')
            .upload(filePath, file);
        if (uploadError) throw uploadError;
        return { file_path: filePath, file_name: file.name };
    });
    return Promise.all(uploadPromises);
}

async function handleAction() {
    const comment = document.getElementById('modalComment').value.trim();
    const files = selectedFiles.length > 0 ? selectedFiles : document.getElementById('modalFiles').files;

    let fileRecords = [];
    if (files.length > 0) {
        try {
            fileRecords = await uploadFiles(currentAppId, files);
        } catch (e) {
            alert('Ошибка загрузки файлов: ' + e.message);
            return;
        }
    }

    // Сохраняем комментарий
    if (comment) {
        const { error } = await supabase
            .schema('services')
            .from('passport_comments')
            .insert({
                passport_id: currentAppId,
                user_id: (await supabase.auth.getUser()).data.user.id,
                comment: comment,
                type: currentAction === 'interim' ? 'interim' : 'comment'
            });
        if (error) {
            alert('Ошибка сохранения комментария: ' + error.message);
            return;
        }
    }

    // Сохраняем файлы
    for (let rec of fileRecords) {
        await supabase
            .schema('services')
            .from('passport_attachments')
            .insert({
                passport_id: currentAppId,
                file_path: rec.file_path,
                file_name: rec.file_name,
                uploaded_by: (await supabase.auth.getUser()).data.user.id
            });
    }

    // Изменяем статус, если действие не промежуточное
    if (currentAction !== 'interim') {
        let newStatus = '';
        if (currentAction === 'complete') newStatus = 'completed';
        else if (currentAction === 'reject') newStatus = 'rejected';
        else if (currentAction === 'cancel') newStatus = 'cancelled';
        if (newStatus) {
            const { error } = await supabase
                .schema('services')
                .from('passport')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', currentAppId);
            if (error) {
                alert('Ошибка обновления статуса: ' + error.message);
                return;
            }
        }
    }

    closeModal();
    // Обновляем страницу
    loadComments();
    loadAttachments();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!await requireAdmin()) return;

    await loadApplication();

    document.getElementById('completeBtn').addEventListener('click', () => {
        currentAction = 'complete';
        openModal('Завершить заявление', true);
    });
    document.getElementById('rejectBtn').addEventListener('click', () => {
        currentAction = 'reject';
        openModal('Отклонить заявление', true);
    });
    document.getElementById('cancelBtn').addEventListener('click', () => {
        currentAction = 'cancel';
        openModal('Отменить заявление', false); // без файлов
    });
    document.getElementById('interimBtn').addEventListener('click', () => {
        currentAction = 'interim';
        openModal('Промежуточный результат', true);
    });

    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    document.getElementById('modalSubmit').addEventListener('click', handleAction);

    // Предпросмотр выбранных файлов
    document.getElementById('modalFiles').addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        const list = document.getElementById('modalFileList');
        list.innerHTML = files.map((f, i) => `
            <div class="file-item">
                ${f.name}
                <button type="button" data-index="${i}">Удалить</button>
            </div>
        `).join('');
        // обработка удаления
        list.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                // удаляем из массива FileList сложно, проще создать новый массив selectedFiles
                // переделаем на использование массива selectedFiles
            });
        });
        // Заменим на использование массива
        selectedFiles = files;
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../../login.html';
    });
});