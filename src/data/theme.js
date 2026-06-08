export function applyTheme(name = 'purple') {
  document.documentElement.setAttribute('data-theme', name)
  document.documentElement.style.colorScheme = 'dark'
}
