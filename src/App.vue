<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { navigation } from './router'
import { useBank } from './store'
import { firebaseConfigured, resetPassword } from './firebase'
import AppIcon from './components/AppIcon.vue'
const bank = useBank()
const route = useRoute()
const email = ref('')
const password = ref('')
const register = ref(false)
const resetting = ref(false)
const notifications = ref(false)
const initials = computed(() =>
  bank.data.profile.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)
const today = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  timeZone: 'Europe/Kyiv',
}).format(new Date())
async function reset() {
  if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    bank.error = 'Введіть email у полі вище.'
    return
  }
  resetting.value = true
  try {
    await resetPassword(email.value)
    bank.notice = 'Якщо обліковий запис існує, лист для скидання пароля надіслано.'
    bank.error = ''
  } catch (e) {
    bank.error = e instanceof Error ? e.message : 'Не вдалося надіслати лист.'
  } finally {
    resetting.value = false
  }
}
onMounted(() => {
  if (bank.mode === 'firebase') void bank.refresh()
})
</script>
<template>
  <div v-if="!bank.mode" class="auth-page">
    <section class="auth-story">
      <a class="brand" href="/" aria-label="North, головна"
        ><span class="brand-mark">n</span>north<span class="brand-dot">.</span></a
      ><span class="eyebrow">ВАШІ ГРОШІ. ВАШІ МОЖЛИВОСТІ.</span>
      <h1>Більше свободи.<br />Менше турбот.</h1>
      <p>Щодня — на крок ближче до ваших планів. Керуйте фінансами в одному зручному просторі.</p>
      <div class="auth-visual">
        <span>north.</span><small>ЩОДЕННА КАРТКА</small
        ><strong>•••• &nbsp; •••• &nbsp; •••• &nbsp; 4821</strong>
        <div>ВАШ НОВИЙ РОЗДІЛ <b>↗</b></div>
      </div>
      <p class="auth-foot">Особистий фінансовий кабінет · UAH</p>
    </section>
    <section class="auth-form">
      <div class="auth-form-inner">
        <span class="tag">Ласкаво просимо</span>
        <h2>{{ register ? 'Створіть обліковий запис' : 'Ваші фінанси — поруч' }}</h2>
        <p class="muted">
          {{
            register
              ? 'Реєстрація через Firebase Authentication.'
              : 'Увійдіть, щоб продовжити з того місця, де зупинилися.'
          }}
        </p>
        <form @submit.prevent="bank.login(email.trim(), password, register)">
          <label
            >Email<input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
              maxlength="254"
          /></label>
          <label
            >Пароль<input
              v-model="password"
              type="password"
              :minlength="register ? 8 : 6"
              required
              :autocomplete="register ? 'new-password' : 'current-password'"
              placeholder="Щонайменше 8 символів"
          /></label>
          <button
            type="button"
            class="text-button forgot"
            :disabled="resetting || bank.busy || !firebaseConfigured"
            @click="reset"
          >
            {{ resetting ? 'Надсилаємо…' : 'Забули пароль?' }}
          </button>
          <p v-if="!firebaseConfigured" class="inline-info">
            Для входу підключіть Firebase за інструкцією в README. Демо доступне одразу.
          </p>
          <p v-if="bank.error" class="alert error" role="alert">{{ bank.error }}</p>
          <p v-if="bank.notice" class="alert success" role="status">{{ bank.notice }}</p>
          <button class="button primary full" :disabled="bank.busy || !firebaseConfigured">
            {{ bank.busy ? 'Підключаємося…' : register ? 'Зареєструватися' : 'Увійти до кабінету' }}
            <AppIcon name="arrow" />
          </button>
        </form>
        <button class="text-button full" :disabled="bank.busy" @click="register = !register">
          {{
            register ? 'Уже є обліковий запис? Увійти' : 'Немає облікового запису? Зареєструватися'
          }}
        </button>
        <div class="divider"><span>або познайомтеся з продуктом</span></div>
        <button class="button secondary full" :disabled="bank.busy" @click="bank.startDemo">
          Відкрити демокабінет <AppIcon name="arrow" />
        </button>
        <p class="auth-disclaimer">
          <AppIcon name="shield" :size="16" /> Демооперації не переміщують справжні гроші.
        </p>
      </div>
    </section>
  </div>
  <div v-else class="app-shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/"
        ><span class="brand-mark">n</span>north<span class="brand-dot">.</span></RouterLink
      >
      <div class="workspace-label">ОСОБИСТИЙ КАБІНЕТ</div>
      <nav aria-label="Основна навігація">
        <RouterLink
          v-for="item in navigation.slice(0, 6)"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          exact-active-class="selected"
          ><AppIcon :name="item.path === '/' ? 'overview' : item.path.slice(1)" /><span>{{
            item.label
          }}</span
          ><span
            v-if="
              item.path === '/requests' &&
              bank.data.requests.filter((r) => r.status === 'pending').length
            "
            class="nav-count"
            >{{ bank.data.requests.filter((r) => r.status === 'pending').length }}</span
          ></RouterLink
        >
      </nav>
      <div class="sidebar-bottom">
        <div class="peace-card">
          <AppIcon name="shield" /><strong>Усе під контролем</strong>
          <p>
            {{
              bank.mode === 'demo'
                ? 'Демо зберігається в цьому браузері.'
                : 'Ваші дані зберігаються у Firebase.'
            }}
          </p>
          <RouterLink to="/help">Дізнатися більше ↗</RouterLink>
        </div>
        <RouterLink
          v-for="item in navigation.slice(6)"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          exact-active-class="selected"
          ><AppIcon :name="item.path.slice(1)" />{{ item.label }}</RouterLink
        ><button class="nav-link logout" :disabled="bank.busy || bank.loading" @click="bank.logout">
          <AppIcon name="logout" />Вийти
        </button>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">
          Особистий кабінет <span>/</span> <strong>{{ route.meta.title }}</strong>
        </div>
        <div class="topbar-actions">
          <span class="connection"
            ><i></i>{{ bank.mode === 'demo' ? 'Деморежим' : 'Firebase' }}</span
          ><button
            class="icon-button"
            aria-label="Сповіщення"
            :aria-expanded="notifications"
            @click="notifications = !notifications"
          >
            <AppIcon name="bell" /><span
              v-if="bank.data.requests.some((r) => r.status === 'pending')"
              class="notification-dot"
            ></span></button
          ><RouterLink to="/settings" class="avatar" aria-label="Відкрити профіль">{{
            initials
          }}</RouterLink>
        </div>
      </header>
      <div v-if="notifications" class="notification-panel panel">
        <h3>Сповіщення</h3>
        <p v-if="!bank.data.requests.some((r) => r.status === 'pending')" class="muted">
          Нових сповіщень немає.
        </p>
        <RouterLink v-else to="/requests" @click="notifications = false"
          >Заявок на розгляді:
          {{ bank.data.requests.filter((r) => r.status === 'pending').length }} →</RouterLink
        >
      </div>
      <main id="main-content" class="main-content">
        <div class="page-heading">
          <div>
            <p class="eyebrow">{{ today }}</p>
            <h1>
              {{
                route.path === '/'
                  ? `Добрий день, ${bank.data.profile.name.split(' ')[0]}`
                  : route.meta.title
              }}<span v-if="route.path === '/'" class="greeting-dot">.</span>
            </h1>
            <p class="muted">
              {{
                route.path === '/'
                  ? 'Ваш фінансовий день починається тут.'
                  : 'Усе необхідне — в одному місці.'
              }}
            </p>
          </div>
          <button
            class="button secondary small"
            :disabled="bank.busy || bank.loading"
            @click="bank.refresh"
          >
            <AppIcon name="refresh" :size="16" />{{ bank.loading ? 'Завантаження…' : 'Оновити' }}
          </button>
        </div>
        <p v-if="bank.mode === 'demo'" class="mode-banner">
          Демокабінет · Усі суми й операції навчальні. Дані зберігаються в цьому браузері.
        </p>
        <p v-else class="mode-banner">
          Firebase підключено · Тут ведеться облік фінансів. Справжні банківські платежі не
          виконуються.
        </p>
        <div v-if="bank.error" class="alert error" role="alert">
          {{ bank.error
          }}<button class="text-button" @click="bank.error = ''" aria-label="Приховати помилку">
            ×
          </button>
        </div>
        <div v-if="bank.notice" class="alert success" role="status">
          {{ bank.notice
          }}<button class="text-button" @click="bank.notice = ''" aria-label="Приховати сповіщення">
            ×
          </button>
        </div>
        <div v-if="bank.loading" class="loading-state" role="status">
          <span class="spinner"></span>Завантажуємо ваші дані…
        </div>
        <RouterView v-else />
      </main>
      <footer class="footer">
        <span>© {{ new Date().getFullYear() }} North · Фінанси з ясністю</span
        ><RouterLink to="/help">Підтримка та інформація ↗</RouterLink>
      </footer>
    </div>
  </div>
</template>
