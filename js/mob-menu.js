// js/mob-menu.js
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.nav-menu');
  const overlay = document.querySelector('.menu-overlay');
  const body = document.body;
  const html = document.documentElement;

  // Если нет кнопки или меню — выходим (страница без мобильного меню)
  if (!toggle || !menu) {
    console.warn('Мобильное меню: кнопка или меню не найдены');
    return;
  }

  const menuLinks = menu.querySelectorAll('a');

  function openMenu() {
    toggle.classList.add('active');
    menu.classList.add('active');
    if (overlay) overlay.classList.add('active');

    // Блокируем прокрутку
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';
  }

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

  // Открытие/закрытие по клику на гамбургер
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Закрытие по клику на оверлей
  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  // Закрытие по клику на ссылку внутри меню
  menuLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('active')) {
      closeMenu();
    }
  });

  // При ресайзе на десктоп — принудительно закрыть
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });
});