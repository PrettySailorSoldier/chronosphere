// Theme management utility
// Include this script in all HTML pages

(function() {
  // Apply theme immediately to prevent flash
  const savedTheme = localStorage.getItem('chrono-theme') || 'dark';
  applyTheme(savedTheme);

  // Also listen for system theme changes
  if (savedTheme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    applyTheme(mediaQuery.matches ? 'light' : 'dark');

    mediaQuery.addEventListener('change', (e) => {
      const currentTheme = localStorage.getItem('chrono-theme');
      if (currentTheme === 'system') {
        applyTheme(e.matches ? 'light' : 'dark');
      }
    });
  }

  function applyTheme(theme) {
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // Expose for settings page
  window.ChronoTheme = {
    apply: applyTheme,
    save: function(theme) {
      localStorage.setItem('chrono-theme', theme);
      applyTheme(theme);
    },
    get: function() {
      return localStorage.getItem('chrono-theme') || 'dark';
    }
  };
})();
