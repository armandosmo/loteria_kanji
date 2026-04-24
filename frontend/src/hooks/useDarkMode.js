import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    // 1. Si el usuario eligió explícitamente → respetar
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    // 2. Si no → usar preferencia del SO
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      dark ? 'dark' : 'light'
    );
    localStorage.setItem('darkMode', String(dark));
  }, [dark]);

  // Seguir cambios del SO en tiempo real (solo si el usuario no eligió)
  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return; // usuario eligió → no seguir al SO
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggle = () => setDark((d) => !d);
  return { dark, toggle };
}
