<script setup>
import {
  nextTick,
  TransitionGroup,
} from 'vue';
import {
  Space,
  Tag,
} from 'ant-design-vue';
import {
  ApartmentOutlined,
  CheckOutlined,
  CloseOutlined,
  FormOutlined,
  LockOutlined,
  PushpinOutlined,
} from '@ant-design/icons-vue';
import gsap from 'gsap';
import Flip from 'gsap/Flip';
gsap.registerPlugin(Flip);

const props = defineProps([
  'tasks',
  'showTags',
  'editTask',
  'deleteTask',
  'finishTask',
  'pinTask',
  'unpinTask',
  'isBlocked',
  'isParent',
  'getDisplayedTag',
]);

const animate = change => {
  const state = Flip.getState('.task-list-item');
  change();
  nextTick(() =>
    Flip.from(state, {
      targets: '.task-list-item',
      duration: 0.5,
      scale: true,
      ease: 'power1.inOut',
    })
  );
};

const onBeforeEnter = el => {
  el.style.opacity = 0;
  el.style.height = 0;
  el.style.padding = '0px 6px';
};

const onEnter = (el, done) => {
  gsap.to(el, {
    opacity: 1,
    height: 'auto',
    onComplete: done,
  });
};

const onLeave = (el, done) => {
  gsap.to(el, {
    opacity: 0,
    height: 0,
    onComplete: done,
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
      v-for="task in props.tasks"
      :key="task.id"
      :data-flip-id="task.id"
      class="
        task-list-item
        child-show-on-hover
        rounded-corners
        hover-highlight
      "
      style="
        width: 65%;
        display: flex;
        align-items: stretch;
      "
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
        <apartment-outlined
          v-else-if="props.isParent(task)"
          class="icon"
        />
        <check-outlined
          v-else
          class="show-on-hover clickable-icon"
          @click="
            task.finished ?
              null : props.finishTask(task.id)
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
            {{ getDisplayedTag(tag) }}
          </Tag>
        </Space>
      </Space>

      <Space style="margin-left: auto;">
        <pushpin-outlined
          :class="
            task.pinned ?
              'icon' :
              'show-on-hover clickable-icon'
          "
          @click="
            task.pinned ?
              animate(() => props.unpinTask(task.id)) :
              animate(() => props.pinTask(task.id))
          "
        />

        <form-outlined
          class="show-on-hover clickable-icon"
          @click="props.editTask(task.id)"
        />

        <close-outlined
          class="show-on-hover clickable-icon"
          @click="
            task.deleted ?
              null : props.deleteTask(task.id)
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

.clickable-icon-bright {
  color: #888;
  font-size: 1.25rem;
  padding-top: 6px;
}

.clickable-icon-bright:hover {
  cursor: pointer;
  color: #aaa;
}

.clickable-icon-bright:active {
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
