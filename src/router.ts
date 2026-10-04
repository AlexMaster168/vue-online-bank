import { createRouter, createWebHistory } from 'vue-router'

export const navigation = [
  { path: '/', label: 'Огляд', icon: '◫' },
  { path: '/accounts', label: 'Рахунки та картки', icon: '▤' },
  { path: '/payments', label: 'Перекази', icon: '↗' },
  { path: '/transactions', label: 'Історія операцій', icon: '↔' },
  { path: '/goals', label: 'Накопичення', icon: '◎' },
  { path: '/requests', label: 'Кредитні заявки', icon: '▧' },
  { path: '/settings', label: 'Налаштування', icon: '⚙' },
  { path: '/help', label: 'Допомога', icon: '?' },
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...navigation.map(({ path, label }) => ({
      path,
      meta: { title: label },
      component: () => import('./views/BankView.vue'),
    })),
    { path: '/auth', redirect: '/' },
    {
      path: '/request/:id',
      redirect: (to) => ({ path: '/requests', query: { request: String(to.params.id) } }),
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('./views/NotFound.vue'),
      meta: { title: 'Сторінку не знайдено' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
