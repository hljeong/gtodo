<script setup>
import { Button } from 'ant-design-vue';
import { GoogleOutlined } from '@ant-design/icons-vue';
import { signIn } from '../backend/firebase.js';
</script>

<template>
  <Button
    type="primary"
    @click="signIn"
    style="
      top: 50%;
      left: 50%;
      transform: translateX(-50%); translateY(-50%);
    "
  >
    <GoogleOutlined />
  </Button>
</template>
