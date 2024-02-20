<script setup>
import {
  TransitionGroup,
} from 'vue';
import {
  Space,
  Tag,
} from 'ant-design-vue';
import {
  CheckOutlined,
  CloseOutlined,
  FormOutlined,
  LockOutlined,
  PlusSquareOutlined,
} from '@ant-design/icons-vue';
import {
  nop,
} from './Util.js';
import gsap from 'gsap';

const props = defineProps([
  'tasks',
  'showTags',
  'editTask',
  'deleteTask',
  'finishTask',
  'taskExists',
  'isBlocked',
  'isParent',
]);

const onBeforeEnter = el => {
  el.style.opacity = 0;
  el.style.height = 0;
  el.style.padding = '0px 6px';
};

const onEnter = (el, done) => {
  const idx = el.dataset.index;
  const delay = idx * 0.10;
  const decay = idx * 0.20;
  gsap.to(el, {
    opacity: 1,
    height: '36px',
    padding: '3px 6px',
    delay: delay * Math.exp(-decay),
    onComplete: done
  });
};

const onLeave = (el, done) => {
  const idx = el.dataset.index;
  const delay = idx * 0.10;
  const decay = idx * 0.20;
  gsap.to(el, {
    opacity: 0,
    height: 0,
    padding: '0px 6px',
    delay: delay * Math.exp(-decay),
    onComplete: done
  });
};
</script>

<template>
  <TransitionGroup
    :css="false"
    @before-enter="onBeforeEnter"
    @enter="onEnter"
    @leave="onLeave"
  >
    <div
      v-for="(task, index) in props.tasks"
      :key="task.id"
      :data-index="index"
      class="
        child-show-on-hover
        rounded-corners
        hover-highlight
      "
      style="width: 65%;"
    >
      <Space align="center">
        <check-outlined
          v-if="task.finished"
          class="icon"
        />
        <lock-outlined
          v-else-if="props.isBlocked(task)"
          class="icon"
        />
        <plus-square-outlined
          v-else-if="props.isParent(task)"
          class="icon"
        />
        <check-outlined
          v-else
          class="show-on-hover clickable-icon"
          @click="
            task.finished ?
              nop : props.finishTask(task)
          "
        />

        <p style="font-size: 1.25rem;">
          <span>{{ task.description }}</span>
          <span style="color:#666;"> #{{ task.id }}</span>
        </p>

        <Space
          :class="
            props.showTags ? 
              'smooth-show' : 'smooth-hide'
          "
          :size="[0, 4]"
          wrap
        >
          <Tag v-for="tag of task.tags">
            {{ tag }}
          </Tag>
        </Space>
      </Space>

      <Space style="float: right;">
        <form-outlined
          class="show-on-hover clickable-icon icon"
          @click="props.editTask(task)"
        />

        <close-outlined
          class="show-on-hover clickable-icon icon"
          @click="
            props.taskExists(task) ?
              props.deleteTask(task) : nop
          "
        />
      </Space>
    </div>
  </TransitionGroup>
</template>

<style scoped>

.show-on-hover {
  opacity: 0%;
  transition: max-height 0.3s ease;
}

.child-show-on-hover:hover .show-on-hover {
  opacity: 100%;
  transition: opacity 0.5s ease;
}

.rounded-corners {
  border-radius: 4px;
  padding: 3px 6px;
}

.hover-highlight:hover {
  cursor: pointer;
  background-color: #444;
}

.clickable-icon {
  color: #666;
  font-size: 1.25rem;
  padding-top: 6px;
}

.clickable-icon:hover {
  cursor: pointer;
  color: #888;
}

.clickable-icon:active {
  color: #444;
}

.icon {
  font-size: 1.25rem;
  padding-top: 6px;
}

.hide {
  opacity: 0%;
}

.smooth-hide {
  opacity: 0%;
  transition: opacity 0.3s ease;
}

.smooth-show {
  opacity: 100%;
  transition: opacity 0.5s ease;
}

</style>
