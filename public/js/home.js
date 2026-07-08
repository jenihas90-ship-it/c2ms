// Simple modal opener for About
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('about-modal');
  if (!modal) return;
  // Un-hide hidden class elements
  const openBtns = document.querySelectorAll('a[href="/about.html"], a[href="#"][onclick*="openAboutModal"]');
  openBtns.forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.add('open');
  }));
});
