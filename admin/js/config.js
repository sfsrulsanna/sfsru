// Конфигурация проекта
export const CONFIG = {
    // Firebase конфигурация (уже есть в firebase-config.js)
    FIREBASE: {
        apiKey: "AIzaSyC4gsGgvzBQTtMbeJcUn2zTqcTUnoktPBE",
        authDomain: "sfsru-gosuslugi.firebaseapp.com",
        projectId: "sfsru-gosuslugi",
        // ... остальные настройки из firebase-config.js
    },
    
    // ImgBB API конфигурация
    IMGBB: {
        API_KEY: "ea96b1722f207fbeddb9eebefbe9d5d3", // Замените на ваш ключ
        UPLOAD_URL: "https://api.imgbb.com/1/upload",
        MAX_FILE_SIZE: 32 * 1024 * 1024, // 32 MB - лимит ImgBB
        ALLOWED_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"]
    },
    
    // Настройки генерации кодов
    CODES: {
        BARCODE_WIDTH: 2,
        BARCODE_HEIGHT: 100,
        QRCODE_SIZE: 200,
        QRCODE_COLOR: "#000000",
        QRCODE_BG: "#FFFFFF"
    },
    
    // Ограничения для Base64 (если ImgBB недоступен)
    BASE64: {
        MAX_SIZE: 500 * 1024, // 500 KB максимум для Base64
        COMPRESSION_QUALITY: 0.7
    }
};