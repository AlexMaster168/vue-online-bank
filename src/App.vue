<template>
   <component :is="layout + '-layout'" v-if="layout" />
</template>


<script>
import MainLayout from "@/layout/MainLayout"
import { useRoute } from "vue-router"
import { computed } from "vue"
import AuthLayout from "@/layout/AuthLayout"

export default {
   setup() {
      const route = useRoute()
      return {
         layout: computed(() => route.meta.layout),
      }
   },
   components: { MainLayout, AuthLayout },
}
</script>