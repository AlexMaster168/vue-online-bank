<template>
   <the-navbar></the-navbar>
   <the-sidebar></the-sidebar>
   <app-message />
   <div class="container with-nav">
      <router-view />
   </div>
</template>

<script>
import TheNavbar from "@/components/TheNavbar"
import AppMessage from "@/components/ui/AppMessage"
import TheSidebar from "../components/TheSidebar"

export default {
   name: "MainLayout",
   components: { TheSidebar, AppMessage, TheNavbar },
}
</script>

<style scoped>

</style>