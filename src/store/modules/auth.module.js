import axios from "axios"
import { error } from "@/utils/error"

const TOKEN_KEY = "jwt-token"
const VUE_APP_FB_KEY = "AIzaSyAV7pJxsiaL8dunzXzzG-P20f122eiwP_Y"

export default {
   namespaced: true,
   state() {
      return {
         token: localStorage.getItem(TOKEN_KEY),
      }
   },
   mutations: {
      setToken(state, token) {
         state.token = token
         localStorage.setItem(TOKEN_KEY, token)
      },
      logout(state) {
         state.token = null
         localStorage.removeItem(TOKEN_KEY)
      },
   },
   actions: {
      async login({ commit, dispatch }, payload) {
         try {
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${VUE_APP_FB_KEY}`
            const { data } = await axios.post(url, { ...payload, returnSecureToken: true })
            commit("setToken", data.idToken)
            commit("clearMessage", null, { root: true })
         } catch (e) {
            dispatch("setMessage", {
               value: error(e.response.data.error.message),
               type: "danger",
            }, { root: true })
            throw new Error()
         }
      },
      async refreshToken({ commit }, token) {
         await axios.post(`https://securetoken.googleapis.com/v1/token?key=${VUE_APP_FB_KEY}`,
            `grant_type=refresh_token&refresh_token=${token}`,
            {
               headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
               },
            },
         ).then(res => {
            localStorage.setItem("refresh-token", token)
            commit("setToken", res.idToken)
         })
      },
   },
   getters: {
      token(state) {
         return state.token
      },
      isAuthenticated(_, getters) {
         return !!getters.token
      },
   },
}