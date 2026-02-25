import { CONFIG } from './config.js';

// Класс для работы с ImgBB API
export class ImgBBUploader {
    constructor() {
        this.apiKey = CONFIG.IMGBB.API_KEY;
        this.uploadUrl = CONFIG.IMGBB.UPLOAD_URL;
        this.cache = new Map(); // Кэш загруженных изображений
    }
    
    // Основная функция загрузки
    async uploadImage(file, options = {}) {
        // Валидация файла
        this.validateFile(file);
        
        // Опционально: сжатие изображения
        let fileToUpload = file;
        if (options.compress && file.type.startsWith('image/')) {
            fileToUpload = await this.compressImage(file, options.quality || 0.8);
        }
        
        // Создаем FormData
        const formData = new FormData();
        formData.append('image', fileToUpload);
        
        // Добавляем дополнительные параметры
        if (options.name) {
            formData.append('name', options.name);
        }
        
        // Отправляем запрос
        try {
            const response = await fetch(`${this.uploadUrl}?key=${this.apiKey}`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error?.message || 'Ошибка загрузки на ImgBB');
            }
            
            // Сохраняем в кэш
            const result = {
                url: data.data.url,
                display_url: data.data.display_url,
                thumb: data.data.thumb?.url || data.data.url,
                delete_url: data.data.delete_url,
                size: data.data.size,
                width: data.data.width,
                height: data.data.height,
                name: data.data.image.filename,
                uploaded_at: new Date().toISOString()
            };
            
            this.cache.set(file.name, result);
            localStorage.setItem(`imgbb_${file.name}`, JSON.stringify(result));
            
            return result;
            
        } catch (error) {
            console.error('Ошибка ImgBB:', error);
            
            // Fallback: сохраняем как Base64
            if (options.fallbackToBase64 && file.size <= CONFIG.BASE64.MAX_SIZE) {
                const base64Data = await this.fileToBase64(file);
                return {
                    url: null,
                    base64: base64Data,
                    name: file.name,
                    size: file.size,
                    type: 'base64',
                    error: error.message
                };
            }
            
            throw error;
        }
    }
    
    // Валидация файла
    validateFile(file) {
        // Проверка типа
        if (!CONFIG.IMGBB.ALLOWED_TYPES.includes(file.type)) {
            throw new Error(`Неподдерживаемый формат файла: ${file.type}. Разрешены: ${CONFIG.IMGBB.ALLOWED_TYPES.join(', ')}`);
        }
        
        // Проверка размера
        if (file.size > CONFIG.IMGBB.MAX_FILE_SIZE) {
            throw new Error(`Файл слишком большой: ${(file.size / 1024 / 1024).toFixed(2)} MB. Максимум: ${CONFIG.IMGBB.MAX_FILE_SIZE / 1024 / 1024} MB`);
        }
        
        return true;
    }
    
    // Сжатие изображения
    async compressImage(file, quality = 0.8, maxWidth = 1200) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Рассчитываем новые размеры
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        const ratio = maxWidth / width;
                        width = maxWidth;
                        height = height * ratio;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Рисуем сжатое изображение
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Конвертируем в JPG для экономии места
                    canvas.toBlob(
                        (blob) => {
                            const compressedFile = new File([blob], 
                                file.name.replace(/\.[^/.]+$/, '.jpg'),
                                { 
                                    type: 'image/jpeg',
                                    lastModified: Date.now()
                                }
                            );
                            resolve(compressedFile);
                        },
                        'image/jpeg',
                        quality
                    );
                };
                
                img.onerror = reject;
            };
            
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    // Конвертация файла в Base64
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    // Получение изображения из кэша
    getFromCache(filename) {
        // Проверяем memory cache
        if (this.cache.has(filename)) {
            return this.cache.get(filename);
        }
        
        // Проверяем localStorage
        const cached = localStorage.getItem(`imgbb_${filename}`);
        if (cached) {
            return JSON.parse(cached);
        }
        
        return null;
    }
    
    // Очистка кэша
    clearCache() {
        this.cache.clear();
        
        // Удаляем из localStorage все imgbb записи
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('imgbb_')) {
                localStorage.removeItem(key);
            }
        });
    }
}

// Singleton экземпляр
export const imgbbUploader = new ImgBBUploader();