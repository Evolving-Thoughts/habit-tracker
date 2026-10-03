import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { registerServiceWorker } from "./pwa/register";

createApp(App).mount("#app");
void registerServiceWorker();
