<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const paths: Record<string, string> = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  accounts: 'M3 6h18v13H3z M3 10h18 M7 15h4',
  payments: 'M7 17 17 7 M7 7h10v10',
  transactions: 'M4 8h15 M15 4l4 4-4 4 M20 16H5 M9 12l-4 4 4 4',
  goals: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M12 11v2',
  requests: 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h3',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 16v1',
  plus: 'M12 5v14 M5 12h14',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
  bell: 'M6 8a6 6 0 0 1 12 0v7l2 2H4l2-2z M10 21h4',
  logout: 'M10 4H4v16h6 M10 12h11 M17 8l4 4-4 4',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
  close: 'M6 6l12 12 M6 18 18 6',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 14-3l1 7 M19 16A8 8 0 0 1 5 19l-1-7',
}
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.overview" />
  </svg>
</template>
