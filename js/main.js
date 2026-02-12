document.addEventListener("DOMContentLoaded", function() {
    const blocks = document.querySelectorAll('.block, .info-block');
    blocks.forEach((block, index) => {
        block.style.animationDelay = `${index * 0.15}s`;
        block.classList.add('fade-in');
    });

    // Эффект параллакса фона при движении мыши (опционально)
    const body = document.body;
    body.addEventListener('mousemove', (e) => {
        const x = (window.innerWidth - e.pageX * 2) / 100;
        const y = (window.innerHeight - e.pageY * 2) / 100;
        body.style.backgroundPosition = `calc(50% + ${x}px) calc(50% + ${y}px)`;
    });
});