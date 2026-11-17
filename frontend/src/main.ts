import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { createAppRouter } from "./router";
import { registerServiceWorker } from "./pwa/register";

createApp(App).use(createAppRouter()).mount("#app");
void registerServiceWorker();
