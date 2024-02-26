<script setup>
import {
  onMounted,
  ref,
  watch,
  nextTick,
  Transition,
} from 'vue';
import {
  AutoComplete,
  Input,
  Modal,
  Space,
  Switch,
  Tag,
  Upload,
} from 'ant-design-vue';
import {
  CheckOutlined,
  CloseOutlined,
  ExportOutlined,
  FormOutlined,
  ImportOutlined,
  LockOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue';
import gsap from 'gsap';
import { saveAs } from 'file-saver';
import TaskList from './TaskList.vue';
import {
  register,
  addTask,
  updateTask,
  updateSettings,
  deleteTask,
} from '../backend/firebase.js';

const hierarchicalTagDivider = '/';
const displayedHierarchicalTagDivider = ' > ';

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

const importTasksInput = ref(null);

const allTasks = ref([]);
const taskIndex = ref({});
const displayedTasks = ref([]);
const unfinishedTasks = ref([]);

const allTagCounts = ref({});
const allTagsOrdered = ref([]);
const allTagOptions = ref([]);

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

const persisted = ref({
  settings: {
    showTags: true,
    searchSubtasks: false,
    showParents: true,
    showBlocked: true,
    showFinished: false,
  },
});

const tasks = ref([]);
watch(tasks, () => fetchTasks());

/*
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
*/

const hasTask = id => id in taskIndex.value;

const getTask = id => {
  if (!hasTask(id)) throw new Error(`task #${id} does not exist`);
  return taskIndex.value[id];
};

const indexTasks = () => {
  taskIndex.value = {};
  for (const task of tasks.value) {
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

const resetTaskFilter = () => {
  displayedTasks.value = allTasks.value.slice();
};

const filterTasksBy = filter => {
  displayedTasks.value = displayedTasks.value.filter(filter);
};

const includesTag = (parent, subtag) => subtag === parent || subtag.startsWith(parent + hierarchicalTagDivider);

const getTagTargetSequence = (tag) => [
  ...tag.split(hierarchicalTagDivider),
  tag
];

const getTaskTargetSequence = (id) => {
  const pathFromRoot = [getTask(id)];
  if (persisted.value.settings.searchSubtasks) {
    while (pathFromRoot[0].parent !== null) {
      pathFromRoot.unshift(getTask(pathFromRoot[0].parent));
    }
  }
  const targetSequence = [].concat(...pathFromRoot.map(
    task => [
      `#${task.id}`,
      ...task.description.split(' '),
      ...[].concat(...task.tags.map(getTagTargetSequence)),
    ]
  ));
  return targetSequence;
};

const filterTasks = () => {
  resetTaskFilter();

  // filter out parents if not showing them
  if (!persisted.value.settings.showParents) {
    const filterOutParents = task => !isParent(task);
    filterTasksBy(filterOutParents);
  }

  // filter by tags
  const filterByTags = task => filterTags.value.every(
    filterTag => task.tags.some(
      taskTag => includesTag(filterTag, taskTag)
    )
  );
  filterTasksBy(filterByTags);

  // filter by prompt
  const promptSequence = promptValue.value.trim().split(' ');
  const filterByPrompt = task => (
    arbitraryMatch(
      promptSequence,
      getTaskTargetSequence(task.id)
    )
  );
  filterTasksBy(filterByPrompt);

  // filter out finished tasks if not showing them
  if (!persisted.value.settings.showFinished) {
    const filterOutFinished = task => !task.finished;
    filterTasksBy(filterOutFinished);
  }

  // filter out blocked tasks if not showing them
  if (!persisted.value.settings.showBlocked) {
    const filterOutBlocked = requirementsFinished;
    filterTasksBy(filterOutBlocked);
  }
};

const deduplicateTags = (tags) => {
  let deduplicatedTags = [];
  for (const tag of tags) {
    if (deduplicatedTags.some(
      existingTag => includesTag(tag, existingTag)
    )) continue;
    deduplicatedTags = deduplicatedTags.filter(
      existingTag => !includesTag(existingTag, tag)
    )
    deduplicatedTags.push(tag);
  }
  return deduplicatedTags;
};

const orderTags = (tags) => [
  ...allTagsOrdered.value.filter(
    tag => tags.includes(tag)
  ),
  ...tags.filter(
    tag => !allTagsOrdered.value.includes(tag)
  ),
];

const orderTasks = () => {
  // reversed for now, todo: reorder according to policy
  displayedTasks.value.sort((task1, task2) => task2.timeCreated - task1.timeCreated);

  const displayedPinnedTasks = displayedTasks.value.filter(
    task => task.pinned
  );
  const displayedUnpinnedTasks = displayedTasks.value.filter(
    task => !task.pinned
  );
  displayedTasks.value = displayedPinnedTasks;
  displayedTasks.value.push(...displayedUnpinnedTasks);
};

const updateDisplayedTasks = () => {
  filterTasks();
  orderTasks();
};

const getDisplayedTag = (tag) => tag.replaceAll(hierarchicalTagDivider, displayedHierarchicalTagDivider);

const updateAllTags = () => {
  allTagCounts.value = {};
  const allTagsFlattened = [].concat(...allTasks.value.map(
    task => task.tags
  ));
  for (const tag of allTagsFlattened) {
    if (tag in allTagCounts.value) allTagCounts.value[tag] += 1;
    else allTagCounts.value[tag] = 1;
  }
  allTagsOrdered.value = Object.keys(allTagCounts.value);
  allTagsOrdered.value.sort((tag1, tag2) => allTagCounts.value[tag2] - allTagCounts.value[tag1]);
  allTagOptions.value = allTagsOrdered.value.map(tag => {
    const components = tag.split(hierarchicalTagDivider);
    let optionLabel = components.map(component => component[0]).join(displayedHierarchicalTagDivider);
    optionLabel += components[components.length - 1].substring(1);
    return {
      tag: tag,
      value: optionLabel,
    };
  });
};

const fetchTasks = async () => {
  // allTasks.value = await (await fetch(ep_tasks)).json();
  allTasks.value = tasks.value.filter(task => !task.deleted);
  indexTasks();
  for (const task of allTasks.value) {
    if (await finishTaskIfCompleted(task)) return;
  }
  unfinishedTasks.value = allTasks.value.filter(
    task => !task.finished
  );
  updateDisplayedTasks();
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
  register({
    tasks: { target: tasks, after: updateDisplayedTasks },
    persisted: { target: persisted, after: updateDisplayedTasks },
  });
});

const promptOnChange = updateDisplayedTasks;

const promptOnPressEnter = async () => {
  if (promptValue.value.trim() === '') return;

  // post(ep_add, { description: promptValue.value.trim(), tags: filterTags.value })
  /*
  const id = fsTasks.value.length + 1;
  setDoc(doc(fsTasksRef, id.toString()), {
    id: id,
    description: promptValue.value.trim(),
    finished: false,
    deleted: false,
    timeCreated: new Date().toLocaleString(),
    timeFinised: null,
    tags: filterTags.value,
    requirements: [],
    dependents: [],
    parent: null,
    subtasks: [],
  });// .then(fetchTasks);
  */
  addTask({
    description: promptValue.value.trim(),
    timeCreated: Date.now(),
    tags: filterTags.value,
  });
  promptValue.value = '';
  // updateDisplayedTasks();
};

const addFilterTagOnSearch = searchText => {
  const searchSequence = searchText.trim().split(' ');
  addFilterTagOptions.value = allTagOptions.value.filter(
    tagOption => (
      arbitraryMatch(
        searchSequence,
        getTagTargetSequence(tagOption.tag)
      ) && 
      !filterTags.value.includes(tagOption.tag)
    )
  );
};

const addFilterTagClearValue = () => {
  addFilterTagValue.value = '';
  addFilterTagOptions.value = [];
};

const addFilterTagOnSelect = (value, option) => {
  if ('value' in option) {
    const tag = option.tag;
    filterTags.value.push(tag);
    filterTags.value = orderTags(filterTags.value);
    updateDisplayedTasks();
  }
  addFilterTagClearValue();
};

const addFilterTagOnPressEnter = () => {
  const tag = addFilterTagValue.value.trim();
  if (tag === '') return;
  // defer to addFilterTagOnSelect()
  if (allTagsOrdered.value.includes(tag)) return;
  filterTags.value.push(tag);
  filterTags.value = orderTags(filterTags.value);
  updateDisplayedTasks();
  addFilterTagClearValue();
};

const deleteFilterTag = tag => {
  filterTags.value = filterTags.value.filter(
    filterTag => filterTag !== tag
  );
  updateDisplayedTasks();
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

const modalDescriptionOnClick = async () => {
  editDescriptionValue.value = getTask(modalId.value).description;
  editDescription.value = true;
  await nextTick();
  editDescriptionInput.value.select();
};

const editDescriptionOnPressEnter = () => {
  const task = getTask(modalId.value);
  if (editDescriptionValue.value.trim() === '') {
    editDescription.value = false;
    editDescriptionValue.value = task.description;
  }
  task.description = editDescriptionValue.value.trim();
  updateTask(modalId.value, { description: editDescriptionValue.value.trim() })
    .then(fetchTasks);
  
  editDescription.value = false;
  dummyModalInput.value.focus();
};

const editDescriptionCancel = () => {
  editDescription.value = false;
  editDescriptionValue.value = '';
};

const addTag = async (id, tag) => {
  const task = getTask(id);
  // skip check: !task.tags.includes(tag)
  task.tags.push(tag);
  task.tags = deduplicateTags(task.tags);
  task.tags = orderTags(task.tags);
  updateTask(id, { tags: task.tags });

  // post(ep_add_tag, { id: id, tag: tag })
  //   .then(fetchTasks);
};

const deleteTag = async (id, tag) => {
  const task = getTask(id);
  // skip check: task.tags.includes(tag)
  task.tags = task.tags.filter(taskTag => taskTag !== tag);
  updateTask(id, { tags: task.tags });

  // post(ep_delete_tag, { id: id, tag: tag })
  //   .then(fetchTasks);
};

const addTagClearValue = () => {
  addTagValue.value = '';
  addTagOptions.value = [];
};

const addTagOnPressEnter = () => {
  const tag = addTagValue.value.trim();
  if (tag === '') return;
  // todo: notify illegal
  if (tag.includes(' ') || tag.includes(hierarchicalTagDivider + hierarchicalTagDivider)) {
    addTagClearValue();
    return;
  }
  // defer to addTagOnSelect()
  if (allTagsOrdered.value.includes(tag)) return;
  addTag(modalId.value, tag);
  addTagClearValue();
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

const arbitraryMatch = function(searchSequence, targetSequence) {
  for (const searchWord of searchSequence) {
    if (!targetSequence.some(
      targetWord => targetWord.startsWith(searchWord)
    )) {
      return false;
    }
  }
  return true;
};

const addTagOnSearch = searchText => {
  const searchSequence = searchText.trim().split(' ');
  addTagOptions.value = allTagOptions.value.filter(
    tagOption => (
      arbitraryMatch(
        searchSequence,
        getTagTargetSequence(tagOption.tag)
      ) && 
      !getTask(modalId.value).tags.some(
        taskTag => includesTag(tagOption.tag, taskTag)
      )
    )
  );
};

const addTagOnSelect = (value, option) => {
  if ('value' in option) {
    addTag(modalId.value, option.tag);
  }
  addTagClearValue();
};

const addRequirementOnSearch = searchText => {
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
      arbitraryMatch(
        searchSequence,
        option.value.split(' ')
      ) && 
      modalId.value !== option.id && 
      !isRequirement(modalId.value, option.id) && 
      !isDependent(modalId.value, option.id)
    )
  );
};

const addDependentOnSearch = searchText => {
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
      arbitraryMatch(
        searchSequence,
        option.value.split(' ')
      ) && 
      modalId.value !== option.id && 
      !isRequirement(modalId.value, option.id) && 
      !isDependent(modalId.value, option.id)
    )
  );
};

const addRequirementClearValue = () => {
  addRequirementValue.value = '';
  addRequirementOptions.value = [];
};

const addDependentClearValue = () => {
  addDependentValue.value = '';
  addDependentOptions.value = [];
};

const addRequirementOnSelect = (value, option) => {
  if ('value' in option) {
    const requirement = getTaskFromDescriptionWithId(option.value);
    /*
    post(
      ep_add_dependency,
      {
        requirement: requirement.id,
        dependent: modalId.value,
      }
    ).then(fetchTasks);
    */
    // skip checks
    requirements.value.push(requirement.id);
    updateTask(modalId.value, { requirements: requirements.value });
    requirement.dependents.push(modalId.value);
    updateTask(requirement.id, { dependents: requirement.dependents });
  }
  addRequirementClearValue();
};

const addDependentOnSelect = (value, option) => {
  if ('value' in option) {
    const dependent = getTaskFromDescriptionWithId(option.value);
    /*
    post(
      ep_add_dependency,
      {
        requirement: modalId.value,
        dependent: dependent.id,
      }
    ).then(fetchTasks);
    */
    // skip checks
    dependents.value.push(dependent.id);
    updateTask(modalId.value, { dependents: dependents.value });
    dependent.requirements.push(modalId.value);
    updateTask(dependent.id, { requirements: dependent.requirements });
  }
  addDependentClearValue();
};

const deleteRequirementOnClick = id => {
  /*
  post(
    ep_delete_dependency,
    {
      requirement: id,
      dependent: modalId.value,
    }
  ).then(fetchTasks);
  */
  // skip checks
  // todo: fix flicker (debounce rerendering?)
  requirements.value = requirements.value.filter(taskId => taskId !== id);
  updateTask(modalId.value, { requirements: requirements.value });
  getTask(id).dependents = getTask(id).dependents.filter(taskId => taskId !== modalId.value);
  updateTask(id, { dependents: getTask(id).dependents });

  dummyModalInput.value.focus();
};

const deleteDependentOnClick = id => {
  /*
  post(
    ep_delete_dependency,
    {
      requirement: modalId.value,
      dependent: id,
    }
  ).then(fetchTasks);
  */
  // skip checks
  // todo: fix flicker
  dependents.value = dependents.value.filter(taskId => taskId !== id);
  updateTask(modalId.value, { dependents: dependents.value });
  getTask(id).requirements = getTask(id).requirements.filter(taskId => taskId !== modalId.value);
  updateTask(id, { requirements: getTask(id).requirements });

  dummyModalInput.value.focus();
};

const setParentOnSearch = searchText => {
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
      arbitraryMatch(
        searchSequence,
        option.value.split(' ')
      ) && 
      modalId.value !== option.id && 
      !isDescendant(option.id, modalId.value) &&
      !isRequirement(option.id, modalId.value)
    )
  );
};

const setParentClearValue = () => {
  setParentValue.value = '';
  setParentOptions.value = [];
};

const setParentOnSelect = (value, option) => {
  if ('value' in option) {
    const parent = getTaskFromDescriptionWithId(option.value);
    /*
    post(
      ep_add_subtask,
      {
        id: parent.id,
        subtask_id: modalId.value,
      }
    ).then(fetchTasks);
    */
    // skip checks
    getTask(modalId.value).parent = parent.id;
    updateTask(modalId.value, { parent: parent.id });
    parent.subtasks.push(modalId.value);
    updateTask(parent.id, { subtasks: parent.subtasks });
  }
  setParentClearValue();
  dummyModalInput.value.focus();
};

const deleteParentOnClick = () => {
  /*
  post(
    ep_delete_subtask,
    {
      id: getTask(modalId.value).parent,
      subtask_id: modalId.value,
    }
  ).then(fetchTasks);
  */
  const parent = getTask(getTask(modalId.value).parent);
  // skip checks
  getTask(modalId.value).parent = null;
  updateTask(modalId.value, { parent: null });
  parent.subtasks = parent.subtasks.filter(subtaskId => subtaskId !== modalId.value);
  updateTask(parent.id, { subtasks: parent.subtasks });
  dummyModalInput.value.focus();
};

const addSubtaskOnSearch = searchText => {
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
      arbitraryMatch(
        searchSequence,
        option.value.split(' ')
      ) && 
      modalId.value !== option.id && 
      !isAncestor(option.id, modalId.value) && 
      getTask(option.id).parent === null
    )
  );
};

const addSubtaskClearValue = () => {
  addSubtaskValue.value = '';
  addSubtaskOptions.value = [];
};

const addSubtaskOnSelect = (value, option) => {
  if ('value' in option) {
    // todo: use option.id?
    const subtask = getTaskFromDescriptionWithId(option.value);
    /*
    post(
      ep_add_subtask,
      {
        id: modalId.value,
        subtask_id: subtask.id,
      }
    ).then(fetchTasks);
    */
    // skip checks
    subtasks.value.push(subtask.id);
    updateTask(modalId.value, { subtasks: subtasks.value });
    subtask.parent = modalId.value;
    updateTask(subtask.id, { parent: modalId.value });
  }
  addSubtaskClearValue();
};

const deleteSubtaskOnClick = id => {
  /*
  post(
    ep_delete_subtask,
    {
      id: modalId.value,
      subtask_id: id,
    }
  ).then(fetchTasks);
  */
  const subtask = getTask(id);
  subtasks.value = subtasks.value.filter(taskId => taskId !== id);
  updateTask(modalId.value, { subtasks: subtasks.value });
  subtask.parent = null;
  updateTask(subtask.id, { parent: null });
  dummyModalInput.value.focus();
};

const finishTaskIfCompleted = async task => {
  // autocomplete only works on parent tasks
  if (task.finished || !isParent(task)) return false;
  
  if (requirementsFinished(task) && subtasksFinished(task)) {
    await finishTask(task.id);
    return true;
  }
  return false;
};

const finishTask = id => {
  const timeFinished = Date.now();
  const task = getTask(id);
  task.pinned = false;
  task.finished = true;
  task.timeFinished = timeFinished;
  updateDisplayedTasks();

  updateTask(id, {
    pinned: false,
    finished: true,
    timeFinished: timeFinished,
  });
  // await post(ep_finish, { id: id });
  // await fetchTasks();
};

const fDeleteTask = id => {
  /*
  allTasks.value = allTasks.value.filter(task => task.id !== id);
  pinnedTaskIds.value = pinnedTaskIds.value.filter(task => task.id !== id);
  updateDisplayedTasks();
  */
  getTask(id).deleted = true;
  deleteTask(id);
  if (modalId.value === id) modalId.value = null;
  /*
  post(ep_delete, { id: id })
    .then(fetchTasks);
  */
};

const pinTask = taskId => {
  getTask(taskId).pinned = true;
  updateTask(taskId, { pinned: true });
  updateDisplayedTasks();
};

const unpinTask = taskId => {
  getTask(taskId).pinned = false;
  updateTask(taskId, { pinned: false });
  updateDisplayedTasks();
};

const importTasksOnChange = async (event) => {
  const file = event.target.files.item(0);
  const content = await file.text();
  const importedTasks = JSON.parse(content);
  // todo: validity checks?
  const idOffset = tasks.value.length;
  importedTasks.forEach(task => {
    task.id += idOffset;
  });
  for (const task of importedTasks) {
    addTask(task);
  }
};

const exportTasks = () => {
  const data = JSON.stringify(tasks.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  saveAs(blob, 'gtodo-tasks.json');
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
        @change="promptOnChange"
        @pressEnter="promptOnPressEnter"
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

          <span style="margin-left: -4px;">{{ getDisplayedTag(tag) }}</span>
        </Tag>
        <Tag>
          <template #icon>
            <plus-outlined style="font-size: 12px;" />
          </template>

          <AutoComplete
            v-model:value="addFilterTagValue"
            style="margin-left: -10px;"
            :options="addFilterTagOptions"
            @search="addFilterTagOnSearch"
            @select="addFilterTagOnSelect"
          >
            <Input
              :bordered="false"
              placeholder="add filter tag..."
              size="small"
              style="font-size: 14px; width: 160px"
              @pressEnter="addFilterTagOnPressEnter"
              @blur="addFilterTagClearValue"
            />
          </AutoComplete>
        </Tag>
      </Space>
    </Space>
    <div style="height: 30px" />

    <TaskList
      :tasks="displayedTasks"
      :showTags="persisted.settings.showTags"
      :editTask="task => showModal(task.id)"
      :deleteTask="task => fDeleteTask(task.id)"
      :finishTask="finishTask"
      :pinTask="pinTask"
      :unpinTask="unpinTask"
      :isBlocked="task => !requirementsFinished(task)"
      :isParent="isParent"
      :getDisplayedTag="getDisplayedTag"
    />

    <Modal
      v-if="modalId !== null && modalId.value !== null"
      v-model:open="displayModal"
    >
      <!-- https://github.com/vuejs/vue/issues/6929#issuecomment-1952352146 -->
      <Input
        ref="dummyModalInput"
        style="position: absolute; opacity: 0%; height: 0%; width: 0%;"
      />
      <Space direction="vertical" size="middle" style="width: 100%;">
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
            @pressEnter="editDescriptionOnPressEnter"
            @blur="editDescriptionCancel"
          />
          <span
            v-else
            style="font-weight: bold; font-size: 20px;"
            @click="modalDescriptionOnClick"
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
                  @click="() => {
                    deleteTag(modalId, tag);
                    dummyModalInput.focus();
                  }"
                />
              </template>

              <span style="margin-left: -4px;">{{ getDisplayedTag(tag) }}</span>
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
                @search="addTagOnSearch"
                @select="addTagOnSelect"
              >
                <Input
                  :bordered="false"
                  placeholder="add tag..."
                  size="small"
                  style="font-size: 14px; width: 160px"
                  @pressEnter="addTagOnPressEnter"
                  @blur="addTagClearValue"
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
                  @click="deleteRequirementOnClick(taskId)"
                />
              </div>
            </div>
          </template>

          <AutoComplete
            ref="addRequirementInput"
            v-model:value="addRequirementValue"
            style="width: 100%;"
            :options="addRequirementOptions"
            @search="addRequirementOnSearch"
            @select="addRequirementOnSelect"
          >
            <Input
              class="
                rounded-corners
                hover-highlight
                active-highlight
              "
              :bordered="false"
              placeholder="add requirement..."
              @blur="addRequirementClearValue"
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
                  @click="deleteDependentOnClick(taskId)"
                />
              </div>
            </div>
          </template>

          <AutoComplete
            ref="addDependentInput"
            v-model:value="addDependentValue"
            style="width: 100%;"
            :options="addDependentOptions"
            @search="addDependentOnSearch"
            @select="addDependentOnSelect"
          >
            <Input
              class="
                rounded-corners
                hover-highlight
                active-highlight
              "
              :bordered="false"
              placeholder="add dependent..."
              @blur="addDependentClearValue"
            />
          </AutoComplete>
        </Space>

        <div
          style="
            width: 100%;
            display: flex;
            align-items: center;
          "
        >
          <h4 class="rounded-corners" style="font-weight: bold;">
            parent:
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
              flex: 1;
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
                @click="deleteParentOnClick"
              />
            </div>
          </div>

          <AutoComplete
            v-else
            ref="setParentInput"
            v-model:value="setParentValue"
            style="flex: 1;"
            :options="setParentOptions"
            @search="setParentOnSearch"
            @select="setParentOnSelect"
          >
            <Input
              class="
                rounded-corners
                hover-highlight
                active-highlight
              "
              :bordered="false"
              placeholder="set parent..."
              @blur="setParentClearValue"
            />
          </AutoComplete>
        </div>

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
                  @click="deleteSubtaskOnClick(taskId)"
                />
              </div>
            </div>
          </template>

          <AutoComplete
            ref="addSubtaskInput"
            v-model:value="addSubtaskValue"
            style="width: 100%;"
            :options="addSubtaskOptions"
            @search="addSubtaskOnSearch"
            @select="addSubtaskOnSelect"
          >
            <Input
              class="
                rounded-corners
                hover-highlight
                active-highlight
              "
              :bordered="false"
              placeholder="add subtask..."
              @blur="addSubtaskClearValue"
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
        <Input
          ref="importTasksInput"
          type="file"
          style="display: none;"
          @change="importTasksOnChange"
        />
        <span class="setting-label">
          import tasks
        </span>

        <import-outlined
          class="clickable-icon"
          @click="importTasksInput.$el.click()"
        />
      </Space>

      <Space class="show-on-hover-2">
        <span class="setting-label">
          export tasks
        </span>

        <export-outlined
          class="clickable-icon"
          @click="exportTasks"
        />
      </Space>

      <Space class="show-on-hover-3">
        <span class="setting-label">
          show tags
        </span>
        <Switch
          v-model:checked="persisted.settings.showTags"
          @change="(checked) => updateSettings({ showTags: checked })"
        />
      </Space>

      <Space class="show-on-hover-4">
        <span class="setting-label">
          search subtasks
        </span>
        <Switch
          v-model:checked="persisted.settings.searchSubtasks"
          @change="(checked) => {
            updateSettings({ searchSubtasks: checked });
            updateDisplayedTasks();
          }"
        />
      </Space>

      <Space class="show-on-hover-5">
        <span class="setting-label">
          show parent tasks
        </span>
        <Switch
          v-model:checked="persisted.settings.showParents"
          @change="(checked) => {
            updateSettings({ showParents: checked });
            updateDisplayedTasks();
          }"
        />
      </Space>

      <Space class="show-on-hover-6">
        <span class="setting-label">
          show blocked tasks
        </span>
        <Switch
          v-model:checked="persisted.settings.showBlocked"
          @change="(checked) => {
            updateSettings({ showBlocked: checked });
            updateDisplayedTasks();
          }"
        />
      </Space>

      <Space class="show-on-hover-7">
        <span class="setting-label">
          show finished tasks
        </span>
        <Switch
          v-model:checked="persisted.settings.showFinished"
          @change="(checked) => {
            updateSettings({ showFinished: checked });
            updateDisplayedTasks();
          }"
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
  font-size: 1.25rem;
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

.setting-label {
  font-family: Poppins;
  font-size: 16px;
}

.show-on-hover-1 {
  opacity: 0%;
  transition: opacity 1.4s ease;
}

.child-show-on-hover:hover .show-on-hover-1 {
  opacity: 100%;
  transition: opacity 0.3s ease;
}

.show-on-hover-2 {
  opacity: 0%;
  transition: opacity 1.2s ease;
}

.child-show-on-hover:hover .show-on-hover-2 {
  opacity: 100%;
  transition: opacity 0.6s ease;
}

.show-on-hover-3 {
  opacity: 0%;
  transition: opacity 1.0s ease;
}

.child-show-on-hover:hover .show-on-hover-3 {
  opacity: 100%;
  transition: opacity 0.9s ease;
}

.show-on-hover-4 {
  opacity: 0%;
  transition: opacity 0.8s ease;
}

.child-show-on-hover:hover .show-on-hover-4 {
  opacity: 100%;
  transition: opacity 1.2s ease;
}

.show-on-hover-5 {
  opacity: 0%;
  transition: opacity 0.6s ease;
}

.child-show-on-hover:hover .show-on-hover-5 {
  opacity: 100%;
  transition: opacity 1.5s ease;
}

.show-on-hover-6 {
  opacity: 0%;
  transition: opacity 0.4s ease;
}

.child-show-on-hover:hover .show-on-hover-6 {
  opacity: 100%;
  transition: opacity 1.8s ease;
}

.show-on-hover-7 {
  opacity: 0%;
  transition: opacity 0.2s ease;
}

.child-show-on-hover:hover .show-on-hover-7 {
  opacity: 100%;
  transition: opacity 2.1s ease;
}

</style>
