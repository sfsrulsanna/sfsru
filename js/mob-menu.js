// js/mob-menu.js
document.addEventListener('DOMContentInitialized', () => {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.nav-menu');
  const overlay = document.querySelector('.menu-overlay');
  const body = document.body;
  const html = document.documentElement;

  // Если нет кнопки или меню — выходим (например, страница без шапки)
  if (!toggle || !menu) {
    console.warn('Мобильное меню: кнопка или меню не найдены');
    return;
  }

  const menuLinks = menu.querySelectorAll('a');

  // Функция открытия меню
  function openMenu() {
    toggle.classList.add('active');
    menu.classList.add('active');
    if (overlay) overlay.classList.add('active');
    
    // Блокируем прокрутку страницы
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    
    // Для Safari иногда нужно дополнительно
    body.style.position = 'fixed';
    body.style.width = '100%';
  }

  // Функция закрытия меню
  function closeMenu() {
    toggle.classList.remove('active');
    menu.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    
    // Восстанавливаем прокрутку
    body.style.overflow = '';
    html.style.overflow = '';
    body.style.position = '';
    body.style.width = '';
  }

  // Обработчик кнопки гамбургера
  toggle.addEventListener('click', (e) => {
    e.stopPropagation(); // чтобы случайно не закрыть сразу
    if (menu.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Закрытие меню при клике на оверлей (если он есть)
  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  // Закрытие меню при клике на любую ссылку внутри меню
  menuLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Закрытие меню по клавише Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('active')) {
      closeMenu();
    }
  });

  // При изменении размера окна: если стали десктопом — принудительно закрыть меню и снять блокировку
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });
});