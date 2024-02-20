<script setup>
import {
  onMounted,
  ref,
  nextTick
} from 'vue';
import {
  AutoComplete,
  Button,
  Collapse,
  CollapsePanel,
  Col,
  Input,
  List,
  ListItem,
  ListItemMeta,
  Modal,
  Row,
  Space,
  Switch,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import {
  CheckOutlined,
  CloseOutlined,
  FormOutlined,
  LockOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue';
import gsap from 'gsap';

const ep_tasks = 'http://localhost:3000/v0/tasks'
const ep_add = 'http://localhost:3000/v0/add'
const ep_finish = 'http://localhost:3000/v0/finish';
const ep_delete = 'http://localhost:3000/v0/delete';
const ep_add_dependency = 'http://localhost:3000/v0/add_dependency';
const ep_delete_dependency = 'http://localhost:3000/v0/delete_dependency';
const ep_add_tag = 'http://localhost:3000/v0/add_tag';
const ep_delete_tag = 'http://localhost:3000/v0/delete_tag';
const ep_add_subtask = 'http://localhost:3000/v0/add_subtask';
const ep_delete_subtask = 'http://localhost:3000/v0/delete_subtask';
const ep_update = 'http://localhost:3000/v0/update';

const allTasks = ref([]);
const taskIndex = ref({});
const unfinishedTasks = ref([]);
const activeTasks = ref([]);
const blockedTasks = ref([]);
const finishedTasks = ref([]);
const filteredActiveTasks = ref([]);
const filteredBlockedTasks = ref([]);
const filteredFinishedTasks = ref([]);

const allTags = ref([]);
const allTagOptions = ref([]);

const useArbitraryMatch = ref(false);
const searchStrategy = ref(null);

const showParentTasks = ref(true);

const promptValue = ref('');

const filterTags = ref([]);
const addFilterTagOptions = ref([]);
const addFilterTagValue = ref('');

const displayModal = ref(false);
const modalId = ref(null);
const dummyModalInput = ref(null);

const editDescription = ref(false);
const editDescriptionInput = ref(null);
const editDescriptionValue = ref('');

const addTagOptions = ref([]);
const addTagValue = ref('');

const requirements = ref([]);
const addRequirementOptions = ref([]);
const addRequirementValue = ref('');
const addRequirementInput = ref(null);

const dependents = ref([]);
const addDependentOptions = ref([]);
const addDependentValue = ref('');
const addDependentInput = ref(null);

const setParentOptions = ref([]);
const setParentValue = ref('');
const setParentInput = ref(null);

const subtasks = ref([]);
const addSubtaskOptions = ref([]);
const addSubtaskValue = ref('');
const addSubtaskInput = ref(null);

const showBlocked = ref(false);
const showFinished = ref(false);
const showTags = ref(true);

const post = async (endpoint, data) => {
  return fetch(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );
};

const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};

const onTaskListBeforeEnter = el => {
  el.style.opacity = 0;
  el.style.height = 0;
  el.style.padding = '0px 6px';
}

const onTaskListEnter = (el, done) => {
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
}

const onTaskListLeave = (el, done) => {
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
}

const hasTask = id => id in taskIndex.value;

const getTask = id => {
  if (!hasTask(id)) throw new Error(`task #${id} does not exist`);
  return taskIndex.value[id];
};

const indexTasks = () => {
  taskIndex.value = {};
  for (const task of allTasks.value) {
    taskIndex.value[task.id] = task;
  }
};

const isParent = task => task.subtasks.length !== 0;

const requirementsFinished = task => task.requirements.every(
  requirement_id => getTask(requirement_id).finished
);

const subtasksFinished = task => task.subtasks.every(
  subtask_id => getTask(subtask_id).finished
);

const updateTasks = () => {
  finishedTasks.value = allTasks.value.filter(
    task => task.finished
  );

  unfinishedTasks.value = allTasks.value.filter(
    task => !task.finished
  );

  blockedTasks.value = unfinishedTasks.value.filter(
    task => !requirementsFinished(task)
  );

  activeTasks.value = unfinishedTasks.value.filter(
    task => !blockedTasks.value.includes(task)
  );
};

const onSearchStrategyChange = () => {
  if (useArbitraryMatch.value) {
    searchStrategy.value = arbitraryMatch;
  } else {
    searchStrategy.value = subsequenceMatch;
  }
  filterTasks();
};

const resetTaskFilter = () => {
  filteredActiveTasks.value = activeTasks.value;
  filteredBlockedTasks.value = blockedTasks.value;
  filteredFinishedTasks.value = finishedTasks.value;
};

const filterTasksBy = filter => {
  filteredActiveTasks.value = filteredActiveTasks.value.filter(filter);
  filteredBlockedTasks.value = filteredBlockedTasks.value.filter(filter);
  filteredFinishedTasks.value = filteredFinishedTasks.value.filter(filter);
};

const filterTasks = () => {
  const filterOutParents = task => !isParent(task);

  const filterByTags = task => filterTags.value.every(
    tag => task.tags.includes(tag)
  );

  const promptSequence = promptValue.value.trim().split(' ');
  const filterByPrompt = task => (
    searchStrategy.value(
      promptSequence,
      task.description.split(' '),
      task.tags
    )
  );
    
  resetTaskFilter();
  if (!showParentTasks.value) {
    filterTasksBy(filterOutParents);
  }
  filterTasksBy(filterByTags);
  filterTasksBy(filterByPrompt);
};

const updateAllTags = () => {
  allTags.value = [
    ...new Set(
      [].concat(
        ...unfinishedTasks.value.map(
          task => task.tags
        )
      )
    )
  ];
  allTagOptions.value = allTags.value.map(tag => {
    return { value: tag };
  });
};

const fetchTasks = async () => {
  allTasks.value = await (await fetch(ep_tasks)).json();
  // reversed for now, todo: reorder according to policy
  allTasks.value = allTasks.value.reverse();
  indexTasks();
  for (const task of allTasks.value) {
    if (await finishTaskIfCompleted(task)) return;
  }
  updateTasks();
  filterTasks();
  updateAllTags();
  if (modalId.value !== null) {
    const task = getTask(modalId.value);
    requirements.value = task.requirements;
    dependents.value = task.dependents;
  }
};

onMounted(() => {
  fetchTasks()
    .then(() => {
      addFilterTagOptions.value = allTagOptions.value;
    });
  onSearchStrategyChange();
});

// const onPromptChange = debounce(filterTasks, 100);
const onPromptChange = filterTasks;

const addTask = async () => {
  if (promptValue.value === '') return;

  filterTasks();
  post(ep_add, { description: promptValue.value, tags: filterTags.value })
    .then(fetchTasks);
  promptValue.value = '';
};

const onAddFilterTagSearch = searchText => {
  addFilterTagOptions.value = allTagOptions.value.filter(
    tag => !filterTags.value.includes(tag.value)
  ).filter(
    tag => tag.value.startsWith(searchText)
  );
};

const clearAddFilterTagValue = () => {
  addFilterTagValue.value = '';
  onAddFilterTagSearch('');
};

const onAddFilterTagSelect = (value, option) => {
  if ('value' in option) {
    const tag = option.value;
    filterTags.value.push(tag);
    filterTasks();
  }
  clearAddFilterTagValue();
};

const deleteFilterTag = tag => {
  filterTags.value = filterTags.value.filter(
    filterTag => filterTag !== tag
  );
  filterTasks();
};

const showModal = (id) => {
  if (!hasTask(id)) return;
  const task = getTask(id);

  editDescription.value = false;
  editDescriptionValue.value = task.description;

  addTagValue.value = '';
  addTagOptions.value = allTagOptions.value.filter(
    tag => !task.tags.includes(tag.value)
  );

  requirements.value = task.requirements;
  addRequirementOptions.value = [];
  addRequirementValue.value = '';

  dependents.value = task.dependents;
  addDependentOptions.value = [];
  addDependentValue.value = '';

  setParentOptions.value = [];
  setParentValue.value = '';

  subtasks.value = task.subtasks;
  addSubtaskOptions.value = [];
  addSubtaskValue.value = '';
  
  modalId.value = id;
  displayModal.value = true;
};

const updateTask = async (id, update) => post(ep_update, { id: id, ...update });

const onModalDescriptionClick = async () => {
  editDescriptionValue.value = getTask(modalId.value).description;
  editDescription.value = true;
  await nextTick();
  editDescriptionInput.value.select();
};

const onEditDescriptionPressEnter = () => {
  const task = getTask(modalId.value);
  if (editDescriptionValue.value === '') {
    editDescription.value = false;
    editDescriptionValue.value = task.description;
  }
  task.description = editDescriptionValue.value;
  updateTask(modalId.value, { description: editDescriptionValue.value })
    .then(fetchTasks);
  
  editDescription.value = false;
};

const cancelEditDescription = () => {
  editDescription.value = false;
  editDescriptionValue.value = '';
};

const addTag = async (id, tag) => {
  const task = getTask(id);
  if (!task.tags.includes(tag)) {
    task.tags.push(tag);
  }
  post(ep_add_tag, { id: id, tag: tag })
    .then(fetchTasks);
};

const deleteTag = async (id, tag) => {
  const task = getTask(id);
  task.tags = task.tags.filter(taskTag => taskTag !== tag);
  post(ep_delete_tag, { id: id, tag: tag })
    .then(fetchTasks);
};

const clearAddTagValue = () => {
  addTagValue.value = '';
  onAddTagSearch('');
};

const onAddTagPressEnter = () => {
  if (addTagValue.value === '') return;
  addTag(modalId.value, addTagValue.value);
  clearAddTagValue();
};

const getTaskFromDescriptionWithId = description => {
  const descriptionSplit = description.split('#');
  const id = parseInt(descriptionSplit[descriptionSplit.length - 1]);
  return getTask(id);
};

const getDescriptionWithId = task => `${task.description} #${task.id}`;

const isAncestor = (queryTaskId, taskId) => {
  let ancestorId = getTask(taskId).parent;
  while (ancestorId !== null) {
    if (ancestorId === queryTaskId) return true;
    ancestorId = getTask(ancestorId).parent;
  }
  return false;
};

const isDescendant = (queryTaskId, taskId) => isAncestor(taskId, queryTaskId);

const isRequirement = (queryTaskId, taskId) => {
  for (const requirementId of getTask(taskId).requirements) {
    if (queryTaskId === requirementId) return true;
  }
  return false;
};

const isDependent = (queryTaskId, taskId) => isRequirement(taskId, queryTaskId);

const subsequenceMatch = function(searchSequence, targetSequence, tags = []) {
  for (let i = 0, j = 0; j < searchSequence.length; ++j) {
    const searchWord = searchSequence[j];
    if (tags.some(tag => tag.startsWith(searchWord))) continue;
    while (
      i < targetSequence.length &&
      !targetSequence[i].startsWith(searchWord)
    ) ++i;
    if (i === targetSequence.length) return false;
  }
  return true;
};

const arbitraryMatch = function(searchSequence, targetSequence, tags = []) {
  for (const searchWord of searchSequence) {
    if (
      !tags.some(
        tag => tag.startsWith(searchWord)
      ) &&
      !targetSequence.some(
        targetWord => targetWord.startsWith(searchWord)
      )
    ) {
      return false;
    }
  }
  return true;
};

const onAddTagSearch = searchText => {
  addTagOptions.value = allTagOptions.value.filter(
    tag => !getTask(modalId.value).tags.includes(tag.value)
  ).filter(
    tag => tag.value.startsWith(searchText)
  );
};

const onAddTagSelect = (value, option) => {
  addTag(modalId.value, value);
  clearAddTagValue();
};

const onAddRequirementSearch = searchText => {
  if (searchText === '') {
    addRequirementOptions.value = [];
    return;
  }
  const options = unfinishedTasks.value.map(task => {
    return {
      id: task.id,
      value: getDescriptionWithId(task),
    };
  });
  const searchSequence = searchText.trim().split(' ');
  addRequirementOptions.value = options.filter(
    option => (
      searchStrategy.value(
        searchSequence,
        option.value.split(' ')
      ) && 
      modalId.value !== option.id && 
      !isRequirement(modalId.value, option.id) && 
      !isDependent(modalId.value, option.id)
    )
  );
};

const onAddDependentSearch = searchText => {
  if (searchText === '') {
    addDependentOptions.value = [];
    return;
  }
  const options = unfinishedTasks.value.map(task => {
    return {
      id: task.id,
      value: getDescriptionWithId(task),
    };
  });
  const searchSequence = searchText.trim().split(' ');
  addDependentOptions.value = options.filter(
    option => (
      searchStrategy.value(
        searchSequence,
        option.value.split(' ')
      ) && 
      modalId.value !== option.id && 
      !isRequirement(modalId.value, option.id) && 
      !isDependent(modalId.value, option.id)
    )
  );
};

const clearAddRequirementValue = () => {
  addRequirementValue.value = '';
  onAddRequirementSearch('');
};

const clearAddDependentValue = () => {
  addDependentValue.value = '';
  onAddDependentSearch('');
};

const onAddRequirementSelect = (value, option) => {
  if ('value' in option) {
    const requirement = getTaskFromDescriptionWithId(option.value);
    post(
      ep_add_dependency,
      {
        requirement: requirement.id,
        dependent: modalId.value,
      }
    ).then(fetchTasks);
    requirements.value.push(requirement.id);
  }
  clearAddRequirementValue();
};

const onAddDependentSelect = (value, option) => {
  if ('value' in option) {
    const dependent = getTaskFromDescriptionWithId(option.value);
    post(
      ep_add_dependency,
      {
        requirement: modalId.value,
        dependent: dependent.id,
      }
    ).then(fetchTasks);
    dependents.value.push(dependent.id);
  }
  clearAddDependentValue();
};

const onDeleteRequirementClick = id => {
  post(
    ep_delete_dependency,
    {
      requirement: id,
      dependent: modalId.value,
    }
  ).then(fetchTasks);
  requirements.value = requirements.value.filter(taskId => taskId !== id);
  dummyModalInput.value.focus();
};

const onDeleteDependentClick = id => {
  post(
    ep_delete_dependency,
    {
      requirement: modalId.value,
      dependent: id,
    }
  ).then(fetchTasks);
  dependents.value = dependents.value.filter(taskId => taskId !== id);

  dummyModalInput.value.focus();
};

const onSetParentSearch = searchText => {
  if (searchText === '') {
    setParentOptions.value = [];
    return;
  }
  const options = unfinishedTasks.value.map(task => {
    return {
      id: task.id,
      value: getDescriptionWithId(task),
    };
  });
  const searchSequence = searchText.trim().split(' ');
  setParentOptions.value = options.filter(
    option => (
      searchStrategy.value(
        searchSequence,
        option.value.split(' ')
      ) && 
      modalId.value !== option.id && 
      !isDescendant(option.id, modalId.value)
    )
  );
};

const clearSetParentValue = () => {
  setParentValue.value = '';
  onSetParentSearch('');
};

const onSetParentSelect = (value, option) => {
  if ('value' in option) {
    const parent = getTaskFromDescriptionWithId(option.value);
    post(
      ep_add_subtask,
      {
        id: parent.id,
        subtask_id: modalId.value,
      }
    ).then(fetchTasks);
    getTask(modalId.value).parent = parent.id;
  }
  clearSetParentValue();
  dummyModalInput.value.focus();
};

const onDeleteParentClick = () => {
  post(
    ep_delete_subtask,
    {
      id: getTask(modalId.value).parent,
      subtask_id: modalId.value,
    }
  ).then(fetchTasks);
  getTask(modalId.value).parent = null;
  dummyModalInput.value.focus();
};

const onAddSubtaskSearch = searchText => {
  if (searchText === '') {
    addSubtaskOptions.value = [];
    return;
  }
  const options = unfinishedTasks.value.map(task => {
    return {
      id: task.id,
      value: getDescriptionWithId(task),
    };
  });
  const searchSequence = searchText.trim().split(' ');
  addSubtaskOptions.value = options.filter(
    option => (
      searchStrategy.value(
        searchSequence,
        option.value.split(' ')
      ) && 
      modalId.value !== option.id && 
      !isAncestor(option.id, modalId.value) && 
      getTask(option.id).parent === null
    )
  );
};

const clearAddSubtaskValue = () => {
  addSubtaskValue.value = '';
  onAddSubtaskSearch('');
};

const onAddSubtaskSelect = (value, option) => {
  if ('value' in option) {
    const subtask = getTaskFromDescriptionWithId(option.value);
    post(
      ep_add_subtask,
      {
        id: modalId.value,
        subtask_id: subtask.id,
      }
    ).then(fetchTasks);
    subtasks.value.push(subtask.id);
  }
  clearAddSubtaskValue();
};

const onDeleteSubtaskClick = id => {
  post(
    ep_delete_subtask,
    {
      id: modalId.value,
      subtask_id: id,
    }
  ).then(fetchTasks);
  subtasks.value = subtasks.value.filter(taskId => taskId !== id);
  dummyModalInput.value.focus();
};

const finishTaskIfCompleted = async task => {
  // autocomplete only works on parent tasks
  if (task.finished || !isParent(task)) return false;
  
  if (requirementsFinished(task) && subtasksFinished(task)) {
    await finishTask(task);
    return true;
  }
  return false;
};

const finishTask = async finished_task => {
  allTasks.value = allTasks.value.filter(task => task.id !== finished_task.id);
  activeTasks.value = activeTasks.value.filter(task => task.id !== finished_task.id);
  finished_task.finished = true;

  await post(ep_finish, { id: finished_task.id });
  await fetchTasks();
};

const deleteTask = async id => {
  allTasks.value = allTasks.value.filter(task => task.id !== id);
  activeTasks.value = activeTasks.value.filter(task => task.id !== id);
  blockedTasks.value = blockedTasks.value.filter(task => task.id !== id);
  finishedTasks.value = finishedTasks.value.filter(task => task.id !== id);
  if (modalId.value === id) modalId.value = null;
  post(ep_delete, { id: id })
    .then(fetchTasks);
};
</script>

<template>
  <div id="container">
    <Space
      direction="vertical"
      style="width: 40%;"
    >
      <Input
        v-model:value="promptValue"
        type="text"
        placeholder="to do..."
        size="large"
        style="fontSize: 24px; height: 56px; width: 100%;"
        allow-clear
        @change="onPromptChange"
        @pressEnter="addTask"
      />

      <Space
        :size="[0, 8]"
        wrap
      >
        <Tag v-for="tag of filterTags">
          <template #icon>
            <close-outlined
              class="hover-highlight close"
              style="font-size: 10px;"
              @click="deleteFilterTag(tag)"
            />
          </template>

          <span style="margin-left: -4px;">{{ tag }}</span>
        </Tag>
        <Tag>
          <template #icon>
            <plus-outlined style="font-size: 12px;" />
          </template>

          <AutoComplete
            v-model:value="addFilterTagValue"
            style="margin-left: -10px;"
            :options="addFilterTagOptions"
            @search="onAddFilterTagSearch"
            @select="onAddFilterTagSelect"
          >
            <Input
              :bordered="false"
              placeholder="add filter tag..."
              size="small"
              style="font-size: 14px; width: 160px"
              @blur="clearAddFilterTagValue"
            />
          </AutoComplete>
        </Tag>
      </Space>
    </Space>
    <div style="height: 30px" />

    <TransitionGroup
      :css="false"
      @before-enter="onTaskListBeforeEnter"
      @enter="onTaskListEnter"
      @leave="onTaskListLeave"
    >
      <div
        v-for="(task, index) in filteredActiveTasks"
        :key="task.id"
        :data-index="index"
        class="
          child-show-on-hover
          rounded-corners
          hover-highlight
        "
        style="width: 65%;"
      >
        <Space align="baseline">
          <check-outlined
            :class="
              isParent(task) ? 
                'hide' :
                'show-on-hover clickable-icon'
            "
            style="font-size: 1.25rem; padding-top: 4px;"
            @click="
              task.finished || isParent(task) ? 
                () => null : finishTask(task)
            "
          />

          <p style="font-size: 1.25rem;">
            <span>{{ task.description }}</span>
            <span style="color: #666;"> #{{ task.id }}</span>
          </p>

          <Space
            :class="showTags ? 'smooth-show' : 'smooth-hide'"
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
            class="show-on-hover clickable-icon"
            style="font-size: 1.25rem; padding-top: 4px;"
            @click="showModal(task.id)"
          />
          <close-outlined
            class="show-on-hover clickable-icon"
            style="font-size: 1.25rem; padding-top: 4px;"
            @click="
              allTasks.includes(task) ? 
                deleteTask(task.id) : () => null
            "
          />
        </Space>
      </div>
    </TransitionGroup>

    <template v-if="showBlocked">
      <div style="height: 30px" />

      <p
        class="rounded-corners"
        style="
          width: 65%;
          font-family: Poppins;
          font-weight: bold;
          font-size: 1.2rem;
          padding-left: 4px;
        "
      >
        blocked tasks:
      </p>

      <TransitionGroup
        :css="false"
        @before-enter="onTaskListBeforeEnter"
        @enter="onTaskListEnter"
        @leave="onTaskListLeave"
      >
        <div
          v-for="(task, index) in filteredBlockedTasks"
          :key="task.id"
          :data-index="index"
          class="
            child-show-on-hover
            rounded-corners
            hover-highlight
          "
          style="width: 65%;"
        >
          <Space align="baseline">
            <lock-outlined
              style="font-size: 1.25rem; padding-top: 4px;"
            />

            <p style="font-size: 1.25rem;">
              <span>{{ task.description }}</span>
              <span style="color: #666;"> #{{ task.id }}</span>
            </p>

            <Space
              :class="showTags ? 'smooth-show' : 'smooth-hide'"
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
              class="show-on-hover clickable-icon"
              style="font-size: 1.25rem; padding-top: 4px;"
              @click="showModal(task.id)"
            />
            <close-outlined
              class="show-on-hover clickable-icon"
              style="font-size: 1.25rem; padding-top: 4px;"
              @click="deleteTask(task.id)"
            />
          </Space>
        </div>
      </TransitionGroup>
    </template>

    <template v-if="showFinished">
      <div style="height: 30px" />

      <p
        class="rounded-corners"
        style="
          width: 65%;
          font-family: Poppins;
          font-weight: bold;
          font-size: 1.2rem;
          padding-left: 4px;
        "
      >
        finished tasks:
      </p>

      <List
        :dataSource="filteredFinishedTasks"
        style="width: 65%;"
        :split="false"
      >
        <template #renderItem="{ item: task }">
          <ListItem
            class="
              child-show-on-hover
              rounded-corners
              hover-highlight
            "
          >
            <Space align="baseline">
              <check-outlined
                style="font-size: 1.25rem; padding-top: 4px;"
              />

              <p style="font-size: 1.25rem;">
                <span>{{ task.description }}</span>
                <span style="color: #666;"> #{{ task.id }}</span>
              </p>

              <Space
                :class="showTags ? 'smooth-show' : 'smooth-hide'"
                :size="[0, 4]"
                wrap
              >
                <Tag v-for="tag of task.tags">
                  {{ tag }}
                </Tag>
              </Space>
            </Space>

            <Space style="float: right;">
              <close-outlined
                class="show-on-hover clickable-icon"
                style="font-size: 1.25rem; padding-top: 4px;"
                @click="deleteTask(task.id)"
              />
            </Space>
          </ListItem>
        </template>
      </List>
    </template>

    <Modal
      v-if="modalId !== null && modalId.value !== null"
      v-model:open="displayModal"
    >
      <!-- https://github.com/vuejs/vue/issues/6929#issuecomment-1952352146 -->
      <Input
        ref="dummyModalInput"
        style="position: absolute; opacity: 0%; height: 0%; width: 0%;"
      />
      <Space direction="vertical" style="width: 100%;">
        <Space size="small">
          <Input
            ref="editDescriptionInput"
            v-if="editDescription"
            v-model:value="editDescriptionValue"
            class="rounded-corners"
            :bordered="false"
            style="
              padding: 0px;
              font-family: Poppins;
              font-weight: bold;
              font-size: 20px;
              width: 450px;
            "
            @pressEnter="onEditDescriptionPressEnter"
            @blur="cancelEditDescription"
          />
          <span
            v-else
            style="font-weight: bold; font-size: 20px;"
            @click="onModalDescriptionClick()"
          >
            {{ getTask(modalId).description }}
          </span>
          <span
            :class="editDescription ? 'hide' : 'smooth-show'"
            style="
              font-weight: bold;
              font-size: 20px;
              color: #666;
            "
          >
              {{ ` #${getTask(modalId).id}` }}
          </span>
        </Space>

        <Space
          direction="vertical"
          :size="0"
          style="width: 100%;"
        >
          <h4 class="rounded-corners" style="font-weight: bold;">
            tags:
          </h4>

          <Space
            class="rounded-corners"
            :size="[0, 8]"
            wrap
          >
            <Tag v-for="tag of getTask(modalId).tags">
              <template #icon>
                <close-outlined
                  class="hover-highlight close"
                  style="font-size: 10px;"
                  @click="deleteTag(modalId, tag)"
                />
              </template>

              <span style="margin-left: -4px;">{{ tag }}</span>
            </Tag>
            <Tag>
              <template #icon>
                <plus-outlined style="font-size: 12px;" />
              </template>

              <AutoComplete
                v-model:value="addTagValue"
                style="margin-left: -10px;"
                :options="addTagOptions"
                :defaultActiveFirstOption="false"
                @search="onAddTagSearch"
                @select="onAddTagSelect"
              >
                <Input
                  :bordered="false"
                  placeholder="add tag..."
                  size="small"
                  style="font-size: 14px; width: 160px"
                  @pressEnter="onAddTagPressEnter"
                  @blur="clearAddTagValue"
                />
              </AutoComplete>
            </Tag>
          </Space>
        </Space>

        <Space
          direction="vertical"
          :size="0"
          style="width: 100%;"
        >
          <h4 class="rounded-corners" style="font-weight: bold;">
            requirements:
          </h4>

          <template
            v-if="modalId !== null"
            v-for="taskId of requirements"
          >
            <div
              class="
                child-show-on-hover
                rounded-corners
                hover-highlight
              "
              style="
                width: 100%;
                display: flex;
                align-items: center;
              "
            >
              <p>
                <span>{{ getTask(taskId).description }}</span>
                <span style="color: #666;"> #{{ getTask(taskId).id }}</span>
              </p>

              <div style="flex: 1;">
                <close-outlined
                  class="show-on-hover close"
                  style="float: right;"
                  @click="onDeleteRequirementClick(taskId)"
                />
              </div>
            </div>
          </template>

          <AutoComplete
            ref="addRequirementInput"
            v-model:value="addRequirementValue"
            style="width: 100%;"
            :options="addRequirementOptions"
            @search="onAddRequirementSearch"
            @select="onAddRequirementSelect"
          >
            <Input
              class="
                rounded-corners
                hover-highlight
                active-highlight
              "
              :bordered="false"
              placeholder="add requirement..."
              @blur="clearAddRequirementValue"
            />
          </AutoComplete>
        </Space>

        <Space
          direction="vertical"
          :size="0"
          style="width: 100%;"
        >
          <h4 class="rounded-corners" style="font-weight: bold;">
            dependents:
          </h4>

          <template
            v-if="modalId !== null"
            v-for="taskId of dependents"
          >
            <div
              class="
                child-show-on-hover
                rounded-corners
                hover-highlight
              "
              style="
                width: 100%;
                display: flex;
                align-items: center;
              "
            >
              <p>
                <span>{{ getTask(taskId).description }}</span>
                <span style="color: #666;"> #{{ getTask(taskId).id }}</span>
              </p>

              <div style="flex: 1;">
                <close-outlined
                  class="show-on-hover close"
                  style="float: right;"
                  @click="onDeleteDependentClick(taskId)"
                />
              </div>
            </div>
          </template>

          <AutoComplete
            ref="addDependentInput"
            v-model:value="addDependentValue"
            style="width: 100%;"
            :options="addDependentOptions"
            @search="onAddDependentSearch"
            @select="onAddDependentSelect"
          >
            <Input
              class="
                rounded-corners
                hover-highlight
                active-highlight
              "
              :bordered="false"
              placeholder="add dependent..."
              @blur="clearAddDependentValue"
            />
          </AutoComplete>
        </Space>

        <Space
          :size="0"
          style="width: 100%;"
        >
          <h4 class="rounded-corners" style="font-weight: bold;">
            parent task:
          </h4>

          <div
            v-if="modalId !== null && getTask(modalId).parent !== null"
            class="
              child-show-on-hover
              rounded-corners
              hover-highlight
            "
            style="
              width: 100%;
              display: flex;
              align-items: center;
            "
          >
            <p>
              <span>{{ getTask(getTask(modalId).parent).description }}</span>
              <span style="color: #666;"> #{{ getTask(getTask(modalId).parent).id }}</span>
            </p>

            <div style="flex: 1;">
              <close-outlined
                class="show-on-hover close"
                style="float: right;"
                @click="onDeleteParentClick()"
              />
            </div>
          </div>

          <AutoComplete
            v-else
            ref="setParentInput"
            v-model:value="setParentValue"
            style="width: 100%;"
            :options="setParentOptions"
            @search="onSetParentSearch"
            @select="onSetParentSelect"
          >
            <Input
              class="
                rounded-corners
                hover-highlight
                active-highlight
              "
              :bordered="false"
              placeholder="set parent..."
              @blur="clearSetParentValue"
            />
          </AutoComplete>
        </Space>

        <Space
          direction="vertical"
          :size="0"
          style="width: 100%;"
        >
          <h4 class="rounded-corners" style="font-weight: bold;">
            subtasks:
          </h4>

          <template
            v-if="modalId !== null"
            v-for="taskId of subtasks"
          >
            <div
              class="
                child-show-on-hover
                rounded-corners
                hover-highlight
              "
              style="
                width: 100%;
                display: flex;
                align-items: center;
              "
            >
              <p>
                <span>{{ getTask(taskId).description }}</span>
                <span style="color: #666;"> #{{ getTask(taskId).id }}</span>
              </p>

              <div style="flex: 1;">
                <close-outlined
                  class="show-on-hover close"
                  style="float: right;"
                  @click="onDeleteSubtaskClick(taskId)"
                />
              </div>
            </div>
          </template>

          <AutoComplete
            ref="addSubtaskInput"
            v-model:value="addSubtaskValue"
            style="width: 100%;"
            :options="addSubtaskOptions"
            @search="onAddSubtaskSearch"
            @select="onAddSubtaskSelect"
          >
            <Input
              class="
                rounded-corners
                hover-highlight
                active-highlight
              "
              :bordered="false"
              placeholder="add subtask..."
              @blur="clearAddSubtaskValue"
            />
          </AutoComplete>
        </Space>
      </Space>

      <template #footer>
      </template>
    </Modal>
  </div>
  <div
    id="settings-panel"
    class="
      child-rotate-on-hover
      child-show-on-hover
    "
  >
    <Space
      direction="vertical"
      size="large"
      align="end"
    >
      <setting-outlined
        class="rotate-on-hover"
        style="
          float: right;
          font-size: 36px;
          color: #444;
        "
      />

      <Space class="show-on-hover-1">
        <span
          style="
            font-family: Poppins;
            font-size: 16px;
          "
        >
          show tags
        </span>
        <Switch
          v-model:checked="showTags"
        />
      </Space>

      <Space class="show-on-hover-2">
        <span
          style="
            font-family: Poppins;
            font-size: 16px;
          "
        >
          arbitrary match on search
        </span>
        <Switch
          v-model:checked="useArbitraryMatch"
          @change="onSearchStrategyChange"
        />
      </Space>

      <Space class="show-on-hover-3">
        <span
          style="
            font-family: Poppins;
            font-size: 16px;
          "
        >
          show parent tasks
        </span>
        <Switch
          v-model:checked="showParentTasks"
          @change="filterTasks"
        />
      </Space>

      <Space class="show-on-hover-4">
        <span
          style="
            font-family: Poppins;
            font-size: 16px;
          "
        >
          show blocked tasks
        </span>
        <Switch
          v-model:checked="showBlocked"
        />
      </Space>

      <Space class="show-on-hover-5">
        <span
          style="
            font-family: Poppins;
            font-size: 16px;
          "
        >
          show finished tasks
        </span>
        <Switch
          v-model:checked="showFinished"
        />
      </Space>
    </Space>
  </div>
</template>

<style scoped>

#container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 30px;
}

#settings-panel {
  position: fixed;
  height: 100%;
  right: 20px;
  top: 20px;
  align-items: right;
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
}

.clickable-icon:hover {
  cursor: pointer;
  color: #888;
}

.clickable-icon:active {
  color: #444;
}

.hover-highlight-text:hover {
  color: #ae96cc;
}

.active-highlight:active {
  cursor: text;
  background-color: #444;
}

.rotate-on-hover {
  transform: rotate(0deg);
  transition: transform 0.8s ease-out;
}

.child-rotate-on-hover:hover .rotate-on-hover {
  transform: rotate(180deg);
  transition: transform 0.5s ease;
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

.show-on-hover {
  opacity: 0%;
  transition: max-height 0.3s ease;
}

.child-show-on-hover:hover .show-on-hover {
  opacity: 100%;
  transition: opacity 0.5s ease;
}

.show-on-hover-1 {
  opacity: 0%;
  transition: opacity 1.5s ease;
}

.child-show-on-hover:hover .show-on-hover-1 {
  opacity: 100%;
  transition: opacity 0.4s ease;
}

.show-on-hover-2 {
  opacity: 0%;
  transition: opacity 1.2s ease;
}

.child-show-on-hover:hover .show-on-hover-2 {
  opacity: 100%;
  transition: opacity 0.8s ease;
}

.show-on-hover-3 {
  opacity: 0%;
  transition: opacity 0.9s ease;
}

.child-show-on-hover:hover .show-on-hover-3 {
  opacity: 100%;
  transition: opacity 1.2s ease;
}

.show-on-hover-4 {
  opacity: 0%;
  transition: opacity 0.6s ease;
}

.child-show-on-hover:hover .show-on-hover-4 {
  opacity: 100%;
  transition: opacity 1.6s ease;
}

.show-on-hover-5 {
  opacity: 0%;
  transition: opacity 0.3s ease;
}

.child-show-on-hover:hover .show-on-hover-5 {
  opacity: 100%;
  transition: opacity 2.0s ease;
}

.taskList-move,
.taskList-enter-active,
.taskList-leave-active {
  transition: all 0.5s ease;
}

.taskList-enter-from,
.taskList-leave-to {
  opacity: 0%;
  transform: translateX(30px);
}

.taskList-leave-active {
  position: absolute;
}

</style>
