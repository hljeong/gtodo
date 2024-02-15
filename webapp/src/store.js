import { createStore } from 'vuex';

export default createStore({
  state: {
    tasks: [],
  },
  mutations: {
    setTasks(state, tasks) {
      state.tasks = tasks;
    },
    pushTask(state, task) {
      const newTasks = state.tasks.slice();
      newTasks.push(task);
      state.tasks = newTasks;
    },
    removeTask(state, id) {
      state.tasks = state.tasks.filter(task => id !== task.id);
    },
  },
  actions: {
    async getTasks({ commit }) {
      const response = await fetch('http://localhost:3000/v1/tasks');
      const data = await response.json();
      commit('setTasks', data);
    },
    async addTask({ commit }, task) {
      commit('pushTask', task);
      await fetch('http://localhost:3000/v1/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(task),
      });
    },
    removeTask({ commit }, id) {
      commit('removeTask', id);
    }
  },
  getters: {
    getTasks: state => state.tasks
  },
})
