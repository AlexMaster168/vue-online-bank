<template>
  <div class="container with-nav">
     <app-message/>
    <router-view/>
  </div>
</template>

<script>
import Auth from "@/views/Auth";
import AppMessage from "@/components/ui/AppMessage"

export default {
  name: "AuthLayout",
  components: { AppMessage, Auth}
}
</script>

<style scoped>

</style>