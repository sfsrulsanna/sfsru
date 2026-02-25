import { CONFIG } from './config.js';

// Класс для генерации штрих-кодов и QR-кодов
export class CodeGenerator {
    constructor() {
        this.barcodeLibraryLoaded = false;
        this.qrcodeLibraryLoaded = false;
        this.loadLibraries();
    }
    
    // Загрузка необходимых библиотек
    async loadLibraries() {
        // Загрузка библиотеки для штрих-кодов (JsBarcode)
        if (typeof JsBarcode === 'undefined') {
            await this.loadScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js');
            this.barcodeLibraryLoaded = true;
        }
        
        // Загрузка библиотеки для QR-кодов (QRCode.js)
        if (typeof QRCode === 'undefined') {
            await this.loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js');
            this.qrcodeLibraryLoaded = true;
        }
    }
    
    // Динамическая загрузка скрипта
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    // Генерация штрих-кода
    async generateBarcode(text, options = {}) {
        await this.ensureBarcodeLibraryLoaded();
        
        const defaultOptions = {
            format: options.format || "CODE128",
            width: options.width || CONFIG.CODES.BARCODE_WIDTH,
            height: options.height || CONFIG.CODES.BARCODE_HEIGHT,
            displayValue: options.displayValue !== undefined ? options.displayValue : true,
            fontSize: options.fontSize || 14,
            background: options.background || "#ffffff",
            lineColor: options.lineColor || "#000000",
            margin: options.margin || 10
        };
        
        // Создаем временный canvas
        const canvas = document.createElement('canvas');
        
        // Генерируем штрих-код
        JsBarcode(canvas, text, defaultOptions);
        
        // Конвертируем в Base64
        const base64 = canvas.toDataURL('image/png');
        
        return {
            base64: base64,
            text: text,
            format: defaultOptions.format,
            size: base64.length,
            type: 'barcode',
            generated_at: new Date().toISOString()
        };
    }
    
    // Генерация QR-кода
    async generateQRCode(text, options = {}) {
        await this.ensureQRCodeLibraryLoaded();
        
        const defaultOptions = {
            width: options.width || CONFIG.CODES.QRCODE_SIZE,
            height: options.height || CONFIG.CODES.QRCODE_SIZE,
            colorDark: options.colorDark || CONFIG.CODES.QRCODE_COLOR,
            colorLight: options.colorLight || CONFIG.CODES.QRCODE_BG,
            correctLevel: options.correctLevel || QRCode.CorrectLevel.H
        };
        
        return new Promise((resolve, reject) => {
            QRCode.toDataURL(text, defaultOptions, (error, base64) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                resolve({
                    base64: base64,
                    text: text,
                    size: base64.length,
                    type: 'qrcode',
                    generated_at: new Date().toISOString()
                });
            });
        });
    }
    
    // Генерация обоих кодов одновременно
    async generateBothCodes(text, barcodeOptions = {}, qrcodeOptions = {}) {
        const [barcode, qrcode] = await Promise.all([
            this.generateBarcode(text, barcodeOptions),
            this.generateQRCode(text, qrcodeOptions)
        ]);
        
        return {
            barcode: barcode,
            qrcode: qrcode,
            text: text,
            generated_at: new Date().toISOString()
        };
    }
    
    // Сохранение кода в виде файла (скачивание)
    downloadCode(base64Data, filename = 'code.png') {
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Вспомогательные методы проверки загрузки библиотек
    async ensureBarcodeLibraryLoaded() {
        if (!this.barcodeLibraryLoaded && typeof JsBarcode === 'undefined') {
            await this.loadLibraries();
        }
    }
    
    async ensureQRCodeLibraryLoaded() {
        if (!this.qrcodeLibraryLoaded && typeof QRCode === 'undefined') {
            await this.loadLibraries();
        }
    }
    
    // Генерация уникального кода для документа
    generateDocumentCode(personalCode, documentType, documentNumber) {
        // Формат: ПЕРСОНАЛЬНЫЙ_КОД-ТИП_ДОКУМЕНТА-НОМЕР-ДАТА
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const typeCode = this.getDocumentTypeCode(documentType);
        
        return `${personalCode}-${typeCode}-${documentNumber}-${date}`;
    }
    
    // Коды типов документов
    getDocumentTypeCode(documentType) {
        const codes = {
            'passport': 'PSPT',
            'foreign_passport': 'FRPS',
            'inn': 'INN',
            'nss': 'NSS',
            'id_card': 'IDCR',
            'driver_license': 'DRVL'
        };
        
        return codes[documentType] || 'DOC';
    }
}

// Singleton экземпляр
export const codeGenerator = new CodeGenerator();