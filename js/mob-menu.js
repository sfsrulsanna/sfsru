document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.nav-menu');
  const overlay = document.querySelector('.menu-overlay');
  const body = document.body;
  const menuLinks = menu.querySelectorAll('a');
  
  // Функция открытия меню
  function openMenu() {
    toggle.classList.add('active');
    menu.classList.add('active');
    overlay.classList.add('active');
    body.style.overflow = 'hidden';
  }
  
  // Функция закрытия меню
  function closeMenu() {
    toggle.classList.remove('active');
    menu.classList.remove('active');
    overlay.classList.remove('active');
    body.style.overflow = '';
  }
  
  // Обработчик кнопки гамбургера
  toggle.addEventListener('click', () => {
    if (menu.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  });
  
  // Закрытие меню при клике на оверлей
  overlay.addEventListener('click', closeMenu);
  
  // Закрытие меню при клике на ссылку
  menuLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });
  
  // Закрытие меню при нажатии Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('active')) {
      closeMenu();
    }
  });
  
  // Закрытие меню при изменении размера окна на десктопный
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });
});