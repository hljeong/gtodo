<script setup>
import {
  onMounted, ref, watch,
  nextTick, Transition,
} from 'vue';
import {
  AutoComplete, Input, Modal,
  Select, Space, Switch, Tag,
} from 'ant-design-vue';
import {
  CheckOutlined, CloseOutlined,
  ExportOutlined, ImportOutlined, 
  LockOutlined, PlusOutlined, 
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
} from '../backend/firebase.js';

const hierarchicalTagDivider = '/';
const displayedHierarchicalTagDivider = ' > ';

const container = ref(null);

const importTasksInput = ref(null);

const blockTasksOnUpdate = ref(false);
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
// focus state for escape logic
const addFilterTagHasFocus = ref(false);
const addFilterTagEscapeCount = ref(0);

const displayEdit = ref(false);
const editId = ref(null);
const dummyEditInput = ref(null);

const editDescription = ref(false);
const editDescriptionInput = ref(null);
const editDescriptionValue = ref('');

const modalTags = ref([]);
const addTagOptions = ref([]);
const addTagValue = ref('');
// focus state for escape logic
const addTagHasFocus = ref(false);
const addTagEscapeCount = ref(0);

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
watch(tasks, () => tasksOnUpdate());

const matchTerm = (searchTerm, targetTerm) => targetTerm.toLowerCase().startsWith(searchTerm.toLowerCase());

const matchTermExact = (searchTerm, targetTerm) => targetTerm.toLowerCase() === searchTerm.toLowerCase();

const getTask = (id) => taskIndex.value[id];

const indexTasks = () => {
  taskIndex.value = {};
  for (const task of tasks.value) {
    taskIndex.value[task.id] = task;
  }
};

const isParent = task => task.subtasks.length !== 0;

const requirementsFinished = task => task.requirements.every(
  (requirementId) => getTask(requirementId).finished
);

const isBlocked = task => !requirementsFinished(task);

const subtasksFinished = task => task.subtasks.every(
  (subtaskId) => getTask(subtaskId).finished
);

const resetTaskFilter = () => {
  displayedTasks.value = allTasks.value.slice();
};

const filterTasksBy = filter => {
  displayedTasks.value = displayedTasks.value.filter(filter);
};

const includesTag = (parent, subtag) => matchTermExact(subtag, parent) || matchTermExact(subtag, parent + hierarchicalTagDivider);

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
  const filterByTags = task => filterTags.value.length === 0 ?
    true :
    filterTags.value.some(
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

const removeInvalidTags = (tags) => tags.filter(
  (tag) => (
    !tag.includes(' ') &&
    !tag.includes(hierarchicalTagDivider + hierarchicalTagDivider)
  )
);

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
    const optionLabel = getDisplayedTag(tag);
    return {
      label: optionLabel,
      value: tag,
    }
  });
};

const tasksOnUpdate = () => {
  if (blockTasksOnUpdate.value) return;
  allTasks.value = tasks.value.filter(task => !task.deleted);
  indexTasks();
  unfinishedTasks.value = allTasks.value.filter(
    (task) => !task.finished
  );
  updateDisplayedTasks();
  updateAllTags();
  if (editId.value !== null) {
    const task = getTask(editId.value);
    requirements.value = task.requirements;
    dependents.value = task.dependents;
  }
};

const fetchTasks = async () => {
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
  if (editId.value !== null) {
    const task = getTask(editId.value);
    requirements.value = task.requirements;
    dependents.value = task.dependents;
  }
};

onMounted(() => {

  // register listeners
  register({
    tasks: { target: tasks, after: updateDisplayedTasks },
    persisted: { target: persisted, after: updateDisplayedTasks },
  });

  // global escape listener
  // activate only when modal is not displayed and
  // filter tag input dropdown is not visible
  window.addEventListener('keydown', (e) => {

    if (e.key === 'Escape') {

      if (displayEdit.value) {

        // same hack as filter tag (see below)
        addTagEscapeCount.value += 1;
        if (addTagHasFocus.value && addTagEscapeCount.value < 2) return;

        displayEdit.value = false;

      } else if (addFilterTagHasFocus.value) {

        // first escape closes the dropdown
        // using dropdownVisibleChange listener doesnt help
        // since variable visible changes to false
        // before escape listener is invoked
        // thus this hacky solution with an escape counter
        // todo: ...can this be solved with the open prop?
        // 
        // known issue:
        // still need 2 escape presses after deleting tags
        // while dropdown is not visible

        addFilterTagEscapeCount.value += 1;
        if (addFilterTagEscapeCount.value >= 2) {
          filterTags.value = [];
          updateDisplayedTasks();
        }

      // clear todo bar if not empty
      } else if (promptValue.value !== '') {

        promptValue.value = '';
        updateDisplayedTasks();

      // clear filter tags if todo bar empty
      } else if (filterTags.value.length !== 0) {

        filterTags.value = [];
        updateDisplayedTasks();

      }
    }
  });

});

const promptOnChange = updateDisplayedTasks;

const promptOnPressEnter = async () => {
  if (promptValue.value.trim() === '') return;

  addTask({
    description: promptValue.value.trim(),
    timeCreated: Date.now(),
    tags: filterTags.value,
  });
  promptValue.value = '';
};

// applied to all lists of tags
const processTags = (tags) => orderTags(
  deduplicateTags(
    removeInvalidTags(
      tags
    )
  )
);

const searchTags = (searchText, options, tags) => {
  const searchSequence = searchText.trim().split(' ');

  // filter from ordered allTagOptions so they are
  // already in order by occurence
  const orderedTagOptions = allTagOptions.value.filter(
    (tagOption) => (
      arbitraryMatch(
        searchSequence,
        getTagTargetSequence(tagOption.value)
      ) &&
      // no tags on lineages of existing tags
      !tags.value.some((tag) => 
        includesTag(tag, tagOption.value) ||
        includesTag(tagOption.value, tag)
      )
    )
  );

  // strip out the ones to prioritize
  // i.e. those whose last component match with the last search term
  const lastSearchTerm = searchSequence[searchSequence.length - 1];
  const prioritizedTagOptions = orderedTagOptions.filter(
    (tagOption) => {
      const components = tagOption.value.split(hierarchicalTagDivider);
      const lastComponent = components[components.length - 1];
      return matchTerm(lastSearchTerm, lastComponent);
    }
  );
  const unprioritizedTagOptions = orderedTagOptions.filter(
    (tagOption) => !prioritizedTagOptions.includes(tagOption)
  );

  options.value = [
    ...prioritizedTagOptions,
    ...unprioritizedTagOptions,
  ];
}

const addFilterTagOnFocus = () => {
  addFilterTagEscapeCount.value = 0;

  addFilterTagHasFocus.value = true;

  // generate search options
  addFilterTagOnSearch('');
};

const addFilterTagOnSearch = searchText => {
  // reset escape count on input
  addFilterTagEscapeCount.value = 0;

  searchTags(searchText, addFilterTagOptions, filterTags);
};

const addFilterTagOnChange = () => {
  addFilterTagEscapeCount.value = 0;

  filterTags.value = processTags(filterTags.value);
  updateDisplayedTasks();

  // reset search options
  addFilterTagOnSearch('');
};

const addFilterTagOnBlur = () => {
  addFilterTagHasFocus.value = false;
};

const showEdit = (id) => {
  addTagEscapeCount.value = 0;

  const task = getTask(id);

  editDescription.value = false;
  editDescriptionValue.value = task.description;

  modalTags.value = task.tags;
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
  
  editId.value = id;
  displayEdit.value = true;
};

const modalDescriptionOnClick = async () => {
  editDescriptionValue.value = getTask(editId.value).description;
  editDescription.value = true;
  await nextTick();
  editDescriptionInput.value.select();
};

const editDescriptionOnPressEnter = () => {
  const task = getTask(editId.value);
  if (editDescriptionValue.value.trim() === '') {
    editDescription.value = false;
    editDescriptionValue.value = task.description;
  }
  task.description = editDescriptionValue.value.trim();
  updateTask(editId.value, { description: editDescriptionValue.value.trim() })
    .then(fetchTasks);
  
  editDescription.value = false;
  dummyEditInput.value.focus();
};

const editDescriptionCancel = () => {
  editDescription.value = false;
  editDescriptionValue.value = '';
};

const addTagOnFocus = () => {
  addTagEscapeCount.value = 0;

  addTagHasFocus.value = true;

  // generate search options
  addTagOnSearch('');
};

const addTagOnSearch = (searchText) => {
  // reset escape count on input
  addTagEscapeCount.value = 0;

  searchTags(searchText, addTagOptions, modalTags);
};

const addTagOnChange = () => {
  addTagEscapeCount.value = 0;

  modalTags.value = processTags(modalTags.value);
  updateTask(editId.value, { tags: modalTags.value });

  // reset search options
  addTagOnSearch('');
};

const addTagOnBlur = () => {
  addTagHasFocus.value = false;
}

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
      targetWord => matchTerm(searchWord, targetWord)
    )) {
      return false;
    }
  }
  return true;
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
      editId.value !== option.id && 
      !isRequirement(editId.value, option.id) && 
      !isDependent(editId.value, option.id)
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
      editId.value !== option.id && 
      !isRequirement(editId.value, option.id) && 
      !isDependent(editId.value, option.id)
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
    // skip checks
    requirements.value.push(requirement.id);
    updateTask(editId.value, { requirements: requirements.value });
    requirement.dependents.push(editId.value);
    updateTask(requirement.id, { dependents: requirement.dependents });
  }
  addRequirementClearValue();
};

const addDependentOnSelect = (value, option) => {
  if ('value' in option) {
    const dependent = getTaskFromDescriptionWithId(option.value);
    // skip checks
    dependents.value.push(dependent.id);
    updateTask(editId.value, { dependents: dependents.value });
    dependent.requirements.push(editId.value);
    updateTask(dependent.id, { requirements: dependent.requirements });
  }
  addDependentClearValue();
};

const deleteRequirementOnClick = id => {
  // skip checks
  // todo: fix flicker (debounce rerendering?)
  requirements.value = requirements.value.filter(taskId => taskId !== id);
  updateTask(editId.value, { requirements: requirements.value });
  getTask(id).dependents = getTask(id).dependents.filter(taskId => taskId !== editId.value);
  updateTask(id, { dependents: getTask(id).dependents });

  dummyEditInput.value.focus();
};

const deleteDependentOnClick = id => {
  // skip checks
  // todo: fix flicker
  dependents.value = dependents.value.filter(taskId => taskId !== id);
  updateTask(editId.value, { dependents: dependents.value });
  getTask(id).requirements = getTask(id).requirements.filter(taskId => taskId !== editId.value);
  updateTask(id, { requirements: getTask(id).requirements });

  dummyEditInput.value.focus();
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
      editId.value !== option.id && 
      !isDescendant(option.id, editId.value) &&
      !isRequirement(option.id, editId.value)
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
    // skip checks
    getTask(editId.value).parent = parent.id;
    updateTask(editId.value, { parent: parent.id });
    parent.subtasks.push(editId.value);
    updateTask(parent.id, { subtasks: parent.subtasks });
  }
  setParentClearValue();
  dummyEditInput.value.focus();
};

const deleteParentOnClick = () => {
  const parent = getTask(getTask(editId.value).parent);
  // skip checks
  getTask(editId.value).parent = null;
  updateTask(editId.value, { parent: null });
  parent.subtasks = parent.subtasks.filter(subtaskId => subtaskId !== editId.value);
  updateTask(parent.id, { subtasks: parent.subtasks });
  dummyEditInput.value.focus();
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
      editId.value !== option.id && 
      !isAncestor(option.id, editId.value) && 
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
    // skip checks
    subtasks.value.push(subtask.id);
    updateTask(editId.value, { subtasks: subtasks.value });
    subtask.parent = editId.value;
    updateTask(subtask.id, { parent: editId.value });
  }
  addSubtaskClearValue();
};

const deleteSubtaskOnClick = id => {
  const subtask = getTask(id);
  subtasks.value = subtasks.value.filter(taskId => taskId !== id);
  updateTask(editId.value, { subtasks: subtasks.value });
  subtask.parent = null;
  updateTask(subtask.id, { parent: null });
  dummyEditInput.value.focus();
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
};

const deleteTask = id => {
  const task = getTask(id);
  task.pinned = false;
  task.deleted = true;
  updateTask(id, { pinned: false, deleted: true });
  if (editId.value === id) editId.value = null;
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
  blockTasksOnUpdate.value = true;
  for (const task of importedTasks) {
    await addTask(task);
  }
  blockTasksOnUpdate.value = false;
  tasksOnUpdate();
};

const exportTasks = () => {
  const data = JSON.stringify(tasks.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  saveAs(blob, 'gtodo-tasks.json');
};
</script>

<template>
  <div
    id="container"
    ref="container"
  >
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

      <Select
        v-model:value="filterTags"
        mode="tags"
        style="width: 100%;"
        placeholder="add filter tag..."
        notFoundContent=""
        :filterOption="false"
        :options="addFilterTagOptions"
        :getPopupContainer="() => container"
        @focus="addFilterTagOnFocus"
        @search="addFilterTagOnSearch"
        @change="addFilterTagOnChange"
        @blur="addFilterTagOnBlur"
      >
        <template #tagRender="{ label: tag, onClose }">
          <Tag closable style="margin-right: 3px" @close="onClose">
            {{ getDisplayedTag(tag) }}
          </Tag>
        </template>
      </Select>
    </Space>
    <div style="height: 30px" />

    <TaskList
      :tasks="displayedTasks"
      :showTags="persisted.settings.showTags"
      :editTask="showEdit"
      :deleteTask="deleteTask"
      :finishTask="finishTask"
      :pinTask="pinTask"
      :unpinTask="unpinTask"
      :isBlocked="isBlocked"
      :isParent="isParent"
      :getDisplayedTag="getDisplayedTag"
    />

    <Modal
      v-if="editId !== null && editId.value !== null"
      v-model:open="displayEdit"
      :keyboard="false"
    >
      <!-- https://github.com/vuejs/vue/issues/6929#issuecomment-1952352146 -->
      <Input
        ref="dummyEditInput"
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
            {{ getTask(editId).description }}
          </span>
          <span
            :class="editDescription ? 'hide' : 'smooth-show'"
            style="
              font-weight: bold;
              font-size: 20px;
              color: #666;
            "
          >
              {{ ` #${getTask(editId).id}` }}
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

          <Select
            v-model:value="modalTags"
            mode="tags"
            style="width: 100%;"
            placeholder="add tag..."
            notFoundContent=""
            :filterOption="false"
            :options="addTagOptions"
            @focus="addTagOnFocus"
            @search="addTagOnSearch"
            @change="addTagOnChange"
            @blur="addTagOnBlur"
          >
            <template #tagRender="{ label: tag, onClose }">
              <Tag closable style="margin-right: 3px" @close="onClose">
                {{ getDisplayedTag(tag) }}
              </Tag>
            </template>
          </Select>
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
            v-if="editId !== null"
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
            v-if="editId !== null"
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
            v-if="editId !== null && getTask(editId).parent !== null"
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
              <span>{{ getTask(getTask(editId).parent).description }}</span>
              <span style="color: #666;"> #{{ getTask(getTask(editId).parent).id }}</span>
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
            v-if="editId !== null"
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
          show parents
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
          show blocked
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
          show finished
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

<style>

/* why cant i change this within the component??? 😡😡 */
.ant-select-selection-search-input {
  font-size: 16px;
}

</style>
