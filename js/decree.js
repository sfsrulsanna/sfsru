// Общие функции для работы с указами
// Этот файл содержит функции, которые могут использоваться на всех страницах указов

/**
 * Инициализация PDF просмотрщика для указа
 * @param {string} pdfPath - путь к PDF файлу
 * @param {Object} elements - объект с DOM элементами
 */
function initDecreeViewer(pdfPath, elements) {
    // Устанавливаем путь к worker'у pdf.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    const {
        canvas,
        prevPageBtn,
        nextPageBtn,
        currentPageSpan,
        totalPagesSpan,
        zoomInBtn,
        zoomOutBtn,
        zoomLevelSpan,
        printPdfButton,
        downloadPdfButton,
        pdfLoading
    } = elements;

    const ctx = canvas.getContext('2d');
    let pdfDoc = null;
    let currentPage = 1;
    let scale = 1.5;
    let isRendering = false;

    // Загружаем PDF
    function loadPDF() {
        pdfLoading.style.display = 'block';
        
        pdfjsLib.getDocument(pdfPath).promise.then(function(pdf) {
            pdfDoc = pdf;
            totalPagesSpan.textContent = pdf.numPages;
            pdfLoading.style.display = 'none';
            renderPage(currentPage);
        }).catch(function(error) {
            console.error('Ошибка загрузки PDF:', error);
            pdfLoading.innerHTML = '<p style="color: #cc0000;">Ошибка загрузки документа</p>';
        });
    }

    // Рендерим страницу
    function renderPage(num) {
        if (isRendering) return;
        isRendering = true;

        pdfDoc.getPage(num).then(function(page) {
            const viewport = page.getViewport({ scale: scale });
            
            // Устанавливаем размеры canvas
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Рендерим страницу
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            
            return page.render(renderContext).promise;
        }).then(function() {
            isRendering = false;
            currentPageSpan.textContent = currentPage;
            zoomLevelSpan.textContent = Math.round(scale * 100);
            updateButtons();
        }).catch(function(error) {
            console.error('Ошибка рендеринга:', error);
            isRendering = false;
        });
    }

    // Обновляем состояние кнопок
    function updateButtons() {
        if (!pdfDoc) return;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= pdfDoc.numPages;
        zoomOutBtn.disabled = scale <= 0.5;
        zoomInBtn.disabled = scale >= 3;
    }

    // Следующая страница
    nextPageBtn.addEventListener('click', function() {
        if (!pdfDoc || currentPage >= pdfDoc.numPages) return;
        currentPage++;
        renderPage(currentPage);
    });

    // Предыдущая страница
    prevPageBtn.addEventListener('click', function() {
        if (!pdfDoc || currentPage <= 1) return;
        currentPage--;
        renderPage(currentPage);
    });

    // Увеличение
    zoomInBtn.addEventListener('click', function() {
        if (scale >= 3) return;
        scale += 0.1;
        renderPage(currentPage);
    });

    // Уменьшение
    zoomOutBtn.addEventListener('click', function() {
        if (scale <= 0.5) return;
        scale -= 0.1;
        renderPage(currentPage);
    });

    // Печать
    printPdfButton.addEventListener('click', function() {
        window.print();
    });

    // Скачивание
    downloadPdfButton.addEventListener('click', function() {
        const link = document.createElement('a');
        link.href = pdfPath;
        link.download = getDownloadFilename(pdfPath);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Обработка клавиш для навигации
    document.addEventListener('keydown', function(e) {
        if (!pdfDoc) return;
        
        switch(e.key) {
            case 'ArrowLeft':
                if (currentPage > 1) {
                    currentPage--;
                    renderPage(currentPage);
                }
                break;
            case 'ArrowRight':
                if (currentPage < pdfDoc.numPages) {
                    currentPage++;
                    renderPage(currentPage);
                }
                break;
            case '+':
                if (scale < 3) {
                    scale += 0.1;
                    renderPage(currentPage);
                }
                break;
            case '-':
                if (scale > 0.5) {
                    scale -= 0.1;
                    renderPage(currentPage);
                }
                break;
        }
    });

    // Загружаем PDF при старте
    loadPDF();
}

/**
 * Генерирует имя файла для скачивания на основе пути к PDF
 * @param {string} pdfPath - путь к PDF файлу
 * @returns {string} имя файла для скачивания
 */
function getDownloadFilename(pdfPath) {
    const filename = pdfPath.split('/').pop();
    const nameWithoutExt = filename.replace('.pdf', '');
    return `Указ_СФСРЮ_${nameWithoutExt}.pdf`;
}

/**
 * Упрощенная инициализация для простых случаев
 * @param {string} pdfPath - путь к PDF файлу
 */
function initSimpleDecree(pdfPath) {
    const elements = {
        canvas: document.getElementById('pdfCanvas'),
        prevPageBtn: document.getElementById('prevPage'),
        nextPageBtn: document.getElementById('nextPage'),
        currentPageSpan: document.getElementById('currentPage'),
        totalPagesSpan: document.getElementById('totalPages'),
        zoomInBtn: document.getElementById('zoomIn'),
        zoomOutBtn: document.getElementById('zoomOut'),
        zoomLevelSpan: document.getElementById('zoomLevel'),
        printPdfButton: document.getElementById('printPdfButton'),
        downloadPdfButton: document.getElementById('downloadPdfButton'),
        pdfLoading: document.getElementById('pdfLoading')
    };

    initDecreeViewer(pdfPath, elements);
}