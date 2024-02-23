<script setup>
import { firebaseApp } from './backend/firebase.js';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { onMounted, ref } from 'vue';
import SignIn from './components/SignIn.vue';
import Todo from './components/Todo.vue';
import { ConfigProvider, theme } from 'ant-design-vue';
import './assets/base.css';

const customTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#9e78d4',
    colorWarning: '#ffc95c',
    colorInfo: '#74aeff',
    fontFamily: 'Poppins',
    fontSize: 16,
    borderRadius: 4,
  },
}

const currentUser = ref(null);

const auth = getAuth(firebaseApp);

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    currentUser.value = user ? user.uid : null;
  });
});
</script>

<template>
  <main>
    <ConfigProvider
      :theme="customTheme"
    >
      <div id="scrollbar-hider">
        <Todo v-if="currentUser" />
        <SignIn v-else />
      </div>
    </ConfigProvider>
  </main>
</template>

<style scoped>

@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap');

#scrollbar-hider {
  position: absolute;
  height: 100%;
  width: 125%;
  padding-right: 25%;
  overflow-y: scroll;
}

</style>
