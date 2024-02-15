<script setup>
import Prompt from './Prompt.vue';
import TodoList from './TodoList.vue';
import { Space } from 'ant-design-vue';
</script>

<template>
  <div id="container">
    <Prompt />
    <div style="height: 30px" />
    <TodoList />
  </div>
</template>

<style scoped>
  #container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 30px;
  }
</style>
