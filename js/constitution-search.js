document.addEventListener('DOMContentLoaded', function () {
    // === Поиск по статьям ===
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const articles = document.querySelectorAll('.article');

    // Создаём элемент ошибки, если его ещё нет
    let searchError = document.getElementById('searchError');
    if (!searchError) {
        searchError = document.createElement('div');
        searchError.id = 'searchError';
        searchError.className = 'search-error';
        searchError.textContent = 'Статья или фраза не найдена.';
        document.querySelector('.search-box').appendChild(searchError);
    }

    function hideError() {
        searchError.classList.remove('show');
    }

    function showError() {
        hideError();
        // Задержка для плавного появления
        setTimeout(() => {
            searchError.classList.add('show');
        }, 10);
        // Автоматически скрыть через 3 секунды
        setTimeout(hideError, 3000);
    }

    function search(query) {
        hideError();
        if (!query.trim()) {
            showError();
            return;
        }

        const lowerQuery = query.toLowerCase();
        let found = false;

        // Убираем старую подсветку
        document.querySelectorAll('mark').forEach(m => {
            if (m.parentNode) m.outerHTML = m.innerHTML;
        });

        articles.forEach(article => {
            const text = article.textContent.toLowerCase();
            const strongText = article.querySelector('strong')?.textContent || '';

            const matchesArticleNumber = 
                query.match(/^статья\s*(\d+)$/i) &&
                strongText.includes(query.replace(/\D/g, ''));

            if (text.includes(lowerQuery) || matchesArticleNumber) {
                article.scrollIntoView({ behavior: 'smooth', block: 'center' });
                article.style.backgroundColor = 'rgba(255, 200, 200, 0.4)';
                setTimeout(() => {
                    article.style.backgroundColor = '';
                }, 2000);
                found = true;
            }
        });

        if (!found) {
            showError();
        }
    }

    searchButton.addEventListener('click', () => {
        search(searchInput.value);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') search(searchInput.value);
    });

    searchInput.addEventListener('input', hideError);

    // === Кнопка "Наверх" ===
    let backToTopButton = document.getElementById('backToTop');
    if (!backToTopButton) {
        backToTopButton = document.createElement('button');
        backToTopButton.id = 'backToTop';
        backToTopButton.innerHTML = '↑';
        document.body.appendChild(backToTopButton);
    }

    const toggleBackToTop = () => {
        if (window.scrollY > 400) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    };

    window.addEventListener('scroll', toggleBackToTop);
    toggleBackToTop(); // Инициализация при загрузке

    backToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});