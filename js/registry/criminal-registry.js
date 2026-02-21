// criminal-registry.js
(function() {
    "use strict";

    if (typeof supabase === 'undefined') {
        console.error('Библиотека Supabase не загружена. Подключите её перед этим скриптом.');
        return;
    }

    // -------------------- КОНФИГУРАЦИЯ --------------------
	const SUPABASE_URL = 'https://qeewwoklmjysactfhrum.supabase.co';
	const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZXd3b2tsbWp5c2FjdGZocnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTI2MTEsImV4cCI6MjA4NjQ4ODYxMX0.gWzqku1cS08v17kfJHJbOWbm-DRpzwQ9omlQsKxc96A';
    const CRIMINAL_TABLE = 'registry_criminal';
    const LOGIN_PAGE = '../../login.html';

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // -------------------- DOM ЭЛЕМЕНТЫ --------------------
    const authSection = document.getElementById('authSection');
    const accessMessageDiv = document.getElementById('accessMessage');
    const cardsGrid = document.getElementById('cardsGrid');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalClose = document.getElementById('modalClose');

    // Элементы модального окна
    const modalFullName = document.getElementById('modalFullName');
    const modalMainPhoto = document.getElementById('modalMainPhoto');
    const photoThumbnails = document.getElementById('photoThumbnails');
    const modalBirthDate = document.getElementById('modalBirthDate');
    const modalBirthPlace = document.getElementById('modalBirthPlace');
    const modalGender = document.getElementById('modalGender');
    const modalCitizenship = document.getElementById('modalCitizenship');
    const modalCrimeArticle = document.getElementById('modalCrimeArticle');
    const modalDetails = document.getElementById('modalDetails');
    const documentsList = document.getElementById('documentsList');

    // -------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ --------------------
    function escapeHTML(unsafe) {
        return unsafe.replace(/[&<>"]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            if (m === '"') return '&quot;';
            return m;
        });
    }

    function showMessage(text, type = 'info') {
        if (!accessMessageDiv) return;
        accessMessageDiv.textContent = text;
        accessMessageDiv.className = `access-message ${type}`;
        accessMessageDiv.style.display = 'block';
    }
    function hideMessage() {
        if (accessMessageDiv) accessMessageDiv.style.display = 'none';
    }

    // -------------------- ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ПУБЛИЧНОГО URL --------------------
    function getPublicUrl(filePath) {
        try {
            const { data } = supabaseClient.storage
                .from('criminal-files')
                .getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error) {
            console.error('Ошибка получения публичного URL:', error);
            return null;
        }
    }

    // -------------------- БЛОК АВТОРИЗАЦИИ --------------------
    function renderAuthSection(session) {
        if (!authSection) return;
        if (session) {
            const user = session.user;
            authSection.innerHTML = `
                <div class="user-info">
                    <span class="user-email">${escapeHTML(user.email)}</span>
                    <button class="logout-btn" id="logoutBtn">Выйти</button>
                </div>
            `;
            document.getElementById('logoutBtn')?.addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
            });
        } else {
            const currentPath = window.location.pathname;
            authSection.innerHTML = `<a href="${LOGIN_PAGE}?redirect=${encodeURIComponent(currentPath)}" class="auth-button">Войти</a>`;
        }
    }

    // -------------------- ПРОВЕРКА ДОСТУПА (ПАСПОРТ) --------------------
    async function checkAccess(session) {
        if (!session) return false;
        const user = session.user;
        console.log('Проверка паспорта для пользователя:', user.id);

        let personalCode = user.user_metadata?.personal_code || user.app_metadata?.personal_code;
        if (!personalCode) {
            personalCode = localStorage.getItem('personalCode');
        }
        if (!personalCode) {
            const { data: userData, error } = await supabaseClient
                .from('users')
                .select('personal_code')
                .eq('id', user.id)
                .maybeSingle();
            if (!error && userData?.personal_code) {
                personalCode = userData.personal_code;
                localStorage.setItem('personalCode', personalCode);
            }
        }

        if (!personalCode) {
            console.error('personal_code не найден');
            showMessage('Не удалось определить ваш personal_code. Обратитесь в поддержку.', 'error');
            return false;
        }

        const { data: passport, error } = await supabaseClient
            .from('document_passport')
            .select('status')
            .eq('personal_code', personalCode)
            .eq('status', 'verified')
            .maybeSingle();

        if (error) {
            console.error('Ошибка при проверке паспорта:', error);
            showMessage('Ошибка при проверке паспорта. Попробуйте позже.', 'error');
            return false;
        }
        return !!passport;
    }

    // -------------------- ЗАГРУЗКА ДАННЫХ --------------------
    async function loadCriminals() {
        const { data, error } = await supabaseClient
            .from(CRIMINAL_TABLE)
            .select('*')
            .order('id', { ascending: true });
        
        if (error) {
            console.error('Ошибка загрузки данных:', error);
            return null;
        }

        // Для каждого преступника получаем публичные URL для фото и документов
        for (const criminal of data || []) {
            // Обрабатываем фото
            if (criminal.photo_paths && criminal.photo_paths.length > 0) {
                criminal.photoUrls = criminal.photo_paths
                    .map(path => getPublicUrl(path))
                    .filter(url => url !== null);
            } else {
                criminal.photoUrls = [];
            }

            // Обрабатываем документы
            if (criminal.document_paths && criminal.document_paths.length > 0) {
                criminal.documentUrls = criminal.document_paths
                    .map(path => getPublicUrl(path))
                    .filter(url => url !== null);
            } else {
                criminal.documentUrls = [];
            }
        }
        
        return data || [];
    }

    // -------------------- SVG-ЗАГЛУШКИ (встроенные, без внешних запросов) --------------------
    const noPhotoSVG = 'data:image/svg+xml,%3Csvg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;300&quot; height=&quot;200&quot; viewBox=&quot;0 0 300 200&quot;%3E%3Crect width=&quot;300&quot; height=&quot;200&quot; fill=&quot;%23f0f0f0&quot;/%3E%3Ctext x=&quot;50%25&quot; y=&quot;50%25&quot; dominant-baseline=&quot;middle&quot; text-anchor=&quot;middle&quot; font-family=&quot;Arial&quot; font-size=&quot;14&quot; fill=&quot;%23999&quot;%3EНет фото%3C/text%3E%3C/svg%3E';
    const errorSVG = 'data:image/svg+xml,%3Csvg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;300&quot; height=&quot;200&quot; viewBox=&quot;0 0 300 200&quot;%3E%3Crect width=&quot;300&quot; height=&quot;200&quot; fill=&quot;%23f0f0f0&quot;/%3E%3Ctext x=&quot;50%25&quot; y=&quot;50%25&quot; dominant-baseline=&quot;middle&quot; text-anchor=&quot;middle&quot; font-family=&quot;Arial&quot; font-size=&quot;14&quot; fill=&quot;%23999&quot;%3EОшибка загрузки%3C/text%3E%3C/svg%3E';
    const noPhotoModalSVG = 'data:image/svg+xml,%3Csvg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;400&quot; height=&quot;300&quot; viewBox=&quot;0 0 400 300&quot;%3E%3Crect width=&quot;400&quot; height=&quot;300&quot; fill=&quot;%23f0f0f0&quot;/%3E%3Ctext x=&quot;50%25&quot; y=&quot;50%25&quot; dominant-baseline=&quot;middle&quot; text-anchor=&quot;middle&quot; font-family=&quot;Arial&quot; font-size=&quot;16&quot; fill=&quot;%23999&quot;%3EНет фото%3C/text%3E%3C/svg%3E';

    // -------------------- ОТРИСОВКА КАРТОЧЕК --------------------
    function renderCards(criminals) {
        cardsGrid.innerHTML = '';
        if (!criminals || criminals.length === 0) {
            showMessage('В реестре пока нет записей.', 'info');
            return;
        }
        criminals.forEach(criminal => {
            const card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('data-id', criminal.id);

            // Основное фото (первое из массива или заглушка)
            const mainPhoto = (criminal.photoUrls && criminal.photoUrls.length > 0) 
                ? criminal.photoUrls[0] 
                : noPhotoSVG;
            
            const birthDate = criminal.birth_date ? new Date(criminal.birth_date).toLocaleDateString('ru-RU') : '—';

            card.innerHTML = `
                <img src="${escapeHTML(mainPhoto)}" alt="Фото" class="card-image" onerror="this.src='${errorSVG}'">
                <div class="card-content">
                    <div class="card-name">${escapeHTML(criminal.full_name || '')}</div>
                    <div class="card-birth">Дата рождения: ${birthDate}</div>
                </div>
            `;
            card.addEventListener('click', () => openModal(criminal));
            cardsGrid.appendChild(card);
        });
        hideMessage();
    }

    // -------------------- МОДАЛЬНОЕ ОКНО --------------------
    function openModal(criminal) {
        modalFullName.textContent = criminal.full_name || '—';

        // Фотографии (используем публичные URL)
        const photos = criminal.photoUrls || [];
        if (photos.length > 0) {
            modalMainPhoto.src = photos[0];
            modalMainPhoto.alt = criminal.full_name;
            
            // Миниатюры
            photoThumbnails.innerHTML = '';
            photos.forEach((photo, index) => {
                const thumb = document.createElement('img');
                thumb.src = photo;
                thumb.alt = `Фото ${index+1}`;
                thumb.className = 'thumbnail';
                thumb.onerror = function() { this.src = errorSVG; }; // обработчик ошибки для миниатюр
                if (index === 0) thumb.classList.add('active');
                thumb.addEventListener('click', () => {
                    modalMainPhoto.src = photo;
                    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
                photoThumbnails.appendChild(thumb);
            });
        } else {
            modalMainPhoto.src = noPhotoModalSVG;
            photoThumbnails.innerHTML = '';
        }

        // Данные
        modalBirthDate.textContent = criminal.birth_date ? new Date(criminal.birth_date).toLocaleDateString('ru-RU') : '—';
        modalBirthPlace.textContent = criminal.birth_place || '—';
        modalGender.textContent = criminal.gender || '—';
        modalCitizenship.textContent = criminal.citizenship || '—';
        modalCrimeArticle.textContent = criminal.crime_article || '—';
        modalDetails.textContent = criminal.details || '—';

        // Документы (используем публичные URL)
        const docs = criminal.documentUrls || [];
        documentsList.innerHTML = '';
        if (docs.length > 0) {
            docs.forEach((doc, index) => {
                const fileName = `Документ ${index + 1}`;
                const link = document.createElement('a');
                link.href = doc;
                link.target = '_blank';
                link.className = 'document-link';
                link.innerHTML = `<i>📄</i> ${escapeHTML(fileName)} (PDF)`;
                documentsList.appendChild(link);
            });
        } else {
            documentsList.innerHTML = '<p>Нет документов</p>';
        }

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    // -------------------- ОСНОВНАЯ ЛОГИКА --------------------
    async function init() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        renderAuthSection(session);

        if (!session) {
            showMessage('Для доступа к реестру необходимо авторизоваться.', 'error');
            return;
        }

        const hasAccess = await checkAccess(session);
        if (!hasAccess) {
            showMessage('У вас нет подтвержденного паспорта гражданина СФСРЮ. Доступ запрещён.', 'error');
            return;
        }

        const criminals = await loadCriminals();
        if (criminals === null) {
            showMessage('Не удалось загрузить данные реестра.', 'error');
            return;
        }
        renderCards(criminals);

        supabaseClient.auth.onAuthStateChange((event, session) => {
            renderAuthSection(session);
            if (event === 'SIGNED_OUT') {
                showMessage('Для доступа к реестру необходимо авторизоваться.', 'error');
                cardsGrid.innerHTML = '';
            } else if (event === 'SIGNED_IN') {
                window.location.reload();
            }
        });
    }

    // -------------------- ОБРАБОТЧИКИ --------------------
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
    });

    // Мобильное меню
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
            menuOverlay.classList.toggle('active');
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : 'auto';
        });
    }
    if (menuOverlay) {
        menuOverlay.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            navMenu.classList.remove('active');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    init();
})();