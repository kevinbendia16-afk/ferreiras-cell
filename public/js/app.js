document.addEventListener('DOMContentLoaded', function() {
  const path = location.pathname.split('/')[1];
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') && link.getAttribute('href').includes('/' + path)) {
      link.classList.add('active');
    }
  });
  applyTheme(localStorage.getItem('theme') || 'dark');
});

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyTheme(next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = theme === 'dark' ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
  }
}
