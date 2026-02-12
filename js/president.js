// president-firestore.js - версия для Firestore
console.log("President Firestore.js loaded");

// Глобальные переменные
let currentUser = null;

// Получаем ссылки на элементы
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const publishBtn = document.getElementById('publishBtn');
const adminPanel = document.getElementById('adminPanel');
const postContent = document.getElementById('postContent');
const newsFeed = document.getElementById('newsFeed');

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing Firestore...");
    
    // Добавляем обработчики событий
    if (loginBtn) loginBtn.addEventListener('click', loginAsPresident);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (publishBtn) publishBtn.addEventListener('click', publishPost);
    
    // Загружаем данные
    loadNews();
    updateStats();
    
    // Проверяем авторизацию
    checkAuthState();
});

// Проверка состояния аутентификации
function checkAuthState() {
    if (!firebase.auth) {
        console.log("Firebase Auth not available");
        return;
    }
    
    firebase.auth().onAuthStateChanged((user) => {
        console.log("Auth state changed:", user);
        if (user) {
            currentUser = user;
            showAdminPanel();
        } else {
            currentUser = null;
            hideAdminPanel();
        }
    });
}

// Функция входа как Президент
function loginAsPresident() {
    console.log("Login attempt...");
    
    if (!firebase.auth) {
        alert("Firebase Auth не доступен");
        return;
    }
    
    // Используем анонимный вход для тестирования
    firebase.auth().signInAnonymously()
        .then((userCredential) => {
            currentUser = userCredential.user;
            console.log("Anonymous login successful:", currentUser);
            showAdminPanel();
            createInitialData(); // Создаем тестовые данные
        })
        .catch((error) => {
            console.error("Login error:", error);
            alert("Ошибка входа: " + error.message);
        });
}

// Создание начальных тестовых данных
function createInitialData() {
    console.log("Creating initial data in Firestore...");
    
    if (!firebase.firestore) {
        alert("Firestore не доступен");
        return;
    }
    
    const db = firebase.firestore();
    
    // Создаем тестовые посты
    const testPosts = [
        {
            content: "Подписан новый указ о развитии промышленности СФСРЮ. Республика движется вперед!",
            author: "Президент СФСРЮ Д. Гордеихин",
            timestamp: new Date(),
            date: new Date().toLocaleString('ru-RU')
        },
        {
            content: "Провел совещание с Советом Министров. Обсуждались вопросы экономического развития.",
            author: "Президент СФСРЮ Д. Гордеихин", 
            timestamp: new Date(Date.now() - 86400000),
            date: new Date(Date.now() - 86400000).toLocaleString('ru-RU')
        },
        {
            content: "Приветствую граждан СФСРЮ! Вместе мы построим сильное социалистическое государство.",
            author: "Президент СФСРЮ Д. Гордеихин",
            timestamp: new Date(Date.now() - 172800000),
            date: new Date(Date.now() - 172800000).toLocaleString('ru-RU')
        }
    ];
    
    // Сохраняем посты в Firestore
    const batch = db.batch();
    const postsRef = db.collection('presidentPosts');
    
    testPosts.forEach(post => {
        const docRef = postsRef.doc();
        batch.set(docRef, post);
    });
    
    batch.commit()
        .then(() => {
            console.log("Test posts created in Firestore");
            loadNews();
        })
        .catch((error) => {
            console.error("Error creating posts:", error);
        });
    
    // Создаем статистику
    const statsRef = db.collection('presidentStats').doc('current');
    const stats = {
        decrees: 15,
        laws: 8,
        lastUpdated: new Date()
    };
    
    statsRef.set(stats)
        .then(() => {
            console.log("Stats created in Firestore");
            updateStats();
        })
        .catch((error) => {
            console.error("Error creating stats:", error);
        });
}

// Функция выхода
function logout() {
    if (!firebase.auth) return;
    
    firebase.auth().signOut()
        .then(() => {
            console.log("Logged out successfully");
            currentUser = null;
            hideAdminPanel();
        })
        .catch((error) => {
            console.error("Logout error:", error);
        });
}

// Показать админскую панель
function showAdminPanel() {
    if (loginBtn) loginBtn.style.display = 'none';
    if (adminPanel) adminPanel.style.display = 'block';
    console.log("Admin panel shown");
}

// Скрыть админскую панель
function hideAdminPanel() {
    if (loginBtn) loginBtn.style.display = 'block';
    if (adminPanel) adminPanel.style.display = 'none';
    if (postContent) postContent.value = '';
    console.log("Admin panel hidden");
}

// Опубликовать новость
function publishPost() {
    if (!postContent) return;
    
    const content = postContent.value.trim();
    
    if (!content) {
        alert('Введите текст новости');
        return;
    }
    
    if (!currentUser) {
        alert('Необходимо войти в систему');
        return;
    }
    
    if (!firebase.firestore) {
        alert("Firestore не доступен");
        return;
    }
    
    console.log("Publishing post to Firestore:", content);
    
    const postData = {
        content: content,
        author: 'Президент СФСРЮ Д. Гордеихин',
        timestamp: new Date(),
        date: new Date().toLocaleString('ru-RU')
    };
    
    const db = firebase.firestore();
    
    db.collection('presidentPosts').add(postData)
        .then((docRef) => {
            console.log("Post published successfully with ID:", docRef.id);
            postContent.value = '';
            alert('Новость опубликована!');
            loadNews();
            updateStats();
        })
        .catch((error) => {
            console.error("Publish error:", error);
            alert('Ошибка публикации: ' + error.message);
        });
}

// Загрузка новостей
function loadNews() {
    console.log("Loading news from Firestore...");
    if (!newsFeed) return;
    
    newsFeed.innerHTML = '<div class="loading-news"><div class="loading-spinner"></div><p>Загрузка новостей...</p></div>';
    
    if (!firebase.firestore) {
        newsFeed.innerHTML = '<div class="loading-news"><p>Firestore не доступен</p></div>';
        return;
    }
    
    const db = firebase.firestore();
    
    db.collection('presidentPosts')
        .orderBy('timestamp', 'desc')
        .get()
        .then((querySnapshot) => {
            const posts = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                posts.push({
                    id: doc.id,
                    ...data
                });
            });
            
            console.log("Posts loaded from Firestore:", posts.length);
            displayNews(posts);
        })
        .catch((error) => {
            console.error("News load error:", error);
            newsFeed.innerHTML = `
                <div class="loading-news">
                    <p>Ошибка загрузки новостей: ${error.message}</p>
                    <button onclick="createInitialData()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #cc0000; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Создать тестовые данные
                    </button>
                </div>
            `;
        });
}

// Отображение новостей
function displayNews(posts) {
    if (!newsFeed) return;
    
    if (!posts || posts.length === 0) {
        newsFeed.innerHTML = `
            <div class="loading-news">
                <p>Новостей пока нет</p>
                <button onclick="createInitialData()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #cc0000; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Создать тестовые данные
                </button>
            </div>
        `;
        return;
    }
    
    let newsHTML = '';
    posts.forEach(post => {
        // Форматируем дату
        let displayDate = post.date;
        if (post.timestamp && post.timestamp.toDate) {
            displayDate = post.timestamp.toDate().toLocaleString('ru-RU');
        } else if (post.timestamp instanceof Date) {
            displayDate = post.timestamp.toLocaleString('ru-RU');
        }
        
        newsHTML += `
            <div class="news-item">
                <div class="news-content">${post.content}</div>
                <div class="news-meta">
                    <span class="news-author">${post.author}</span>
                    <span class="news-date">${displayDate}</span>
                </div>
            </div>
        `;
    });
    
    newsFeed.innerHTML = newsHTML;
    console.log("News displayed:", posts.length, "posts");
}

// Обновление статистики
function updateStats() {
    console.log("Updating stats from Firestore...");
    
    if (!firebase.firestore) {
        console.log("Firestore not available for stats");
        return;
    }
    
    const db = firebase.firestore();
    
    // Получаем статистику
    db.collection('presidentStats').doc('current').get()
        .then((doc) => {
            if (doc.exists) {
                const stats = doc.data();
                console.log("Stats from Firestore:", stats);
                
                if (document.getElementById('decreesCount')) {
                    document.getElementById('decreesCount').textContent = stats.decrees || 0;
                }
                if (document.getElementById('lawsCount')) {
                    document.getElementById('lawsCount').textContent = stats.laws || 0;
                }
            }
        })
        .catch((error) => {
            console.error("Stats update error:", error);
        });
    
    // Считаем количество постов
    db.collection('presidentPosts').get()
        .then((querySnapshot) => {
            const postsCount = querySnapshot.size;
            if (document.getElementById('postsCount')) {
                document.getElementById('postsCount').textContent = postsCount;
            }
            console.log("Posts count from Firestore:", postsCount);
        })
        .catch((error) => {
            console.error("Posts count error:", error);
        });
}