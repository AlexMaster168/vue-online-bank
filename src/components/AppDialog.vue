<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
defineProps<{ title: string; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
let previous: HTMLElement | null = null
onMounted(() => {
  previous = document.activeElement as HTMLElement
  dialog.value?.showModal()
})
onUnmounted(() => previous?.focus())
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="dialog"
      aria-labelledby="dialog-title"
      @cancel.prevent="!busy && emit('close')"
    >
      <div class="section-head">
        <h2 id="dialog-title">{{ title }}</h2>
        <button
          class="icon-button"
          type="button"
          aria-label="Закрити"
          :disabled="busy"
          @click="emit('close')"
        >
          <AppIcon name="close" />
        </button>
      </div>
      <slot />
    </dialog>
  </Teleport>
</template>
