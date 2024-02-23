import { createApp } from 'vue';
import { VueFire } from 'vuefire';
import App from './App.vue';
import { firebaseApp } from './backend/firebase.js';

const app = createApp(App);
app.use(VueFire, {
  firebaseApp,
});
app.mount('#app');
