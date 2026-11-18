import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { startTheme } from "./composables/useTheme";
import { createAppRouter } from "./router";
import { registerServiceWorker } from "./pwa/register";

startTheme();
createApp(App).use(createAppRouter()).mount("#app");
void registerServiceWorker();
