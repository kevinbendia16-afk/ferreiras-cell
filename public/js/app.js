// Ferreira's Cell - JS global
document.addEventListener('DOMContentLoaded', function() {
  // Highlight active nav link
  const path = location.pathname.split('/')[1];
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href').includes('/' + path)) {
      link.classList.add('active');
    }
  });
});
