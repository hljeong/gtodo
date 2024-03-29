import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection,
  doc, getDoc, getDocs,
  setDoc, deleteDoc, onSnapshot,
  getCountFromServer,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;
const databaseName = import.meta.env.VITE_FIREBASE_DATABASE;
const debugMode = import.meta.env.VITE_DEBUG === 'true';

const debug = debugMode ?
  (msg) => console.log(msg) :
  () => null;

export const firebaseApp = initializeApp({
  apiKey: apiKey,
  authDomain: authDomain,
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: messagingSenderId,
  appId: appId,
});

const auth = getAuth(firebaseApp);
export let userUid = 'default';

const db = getFirestore(firebaseApp);
const getTasksRef = (userUid) => collection(
  db, databaseName, userUid, 'tasks'
);
const getPersistedRef = (userUid) => collection(
  db, databaseName, userUid, 'persisted'
);

let tasksRef = getTasksRef(userUid);
let persistedRef = getPersistedRef(userUid);

const taskSchema = {
  description: () => '',
  finished: () => false,
  pinned: () => false,
  deleted: () => false,
  timeCreated: () => null,
  timeFinished: () => null,
  tags: () => [],
  requirementIds: () => [],
  dependentIds: () => [],
  parentId: () => null,
  subtaskIds: () => [],
};

const settingsSchema = {
  showTags: () => true,
  searchSubtasks: () => false,
  showParents: () => true,
  showBlocked: () => true,
  showFinished: () => false,
};

const generateFromSchema = (schema) => {
  const generated = {};
  for (const key in schema) {
    generated[key] = schema[key]();
  }
  return generated;
};

export const signIn = async () => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    userUid = result.user.uid;
    tasksRef = getTasksRef(userUid);
    persistedRef = getPersistedRef(userUid);
  } catch(error) {
    console.error(`Failed to sign in: ${error}`);
  }
};

const getTaskRef = (id) => doc(tasksRef, id.toString());

const getSettingsRef = () => doc(persistedRef, 'settings');

const needsUpdate = (original, synced) => {
  const originalKeys = Object.keys(original);
  const syncedKeys = Object.keys(synced);
  if (originalKeys.length !== syncedKeys.length) return true;
  return originalKeys.some(
    key => !syncedKeys.includes(key)
  );
};

const syncTaskSchema = async (user) => {
  tasksRef = getTasksRef(user.uid);
  const snapshot = await getDocs(tasksRef);
  const tasks = snapshot.docs.map((doc) => doc.data());
  for (const task of tasks) {
    const syncedTask = { id: task.id };
    for (const property in taskSchema) {
      syncedTask[property] = property in task ? task[property] : taskSchema[property]();
    }
    if (needsUpdate(task, syncedTask)) {
      debug(`task #${task.id} schema out of sync, syncing...`);
      await setDoc(getTaskRef(task.id), syncedTask);
      debug(`task #${task.id} schema synced`)
    }
  }
};

const syncSettingsSchema = async (user) => {
  persistedRef = getPersistedRef(user.uid);
  const settingsRef = getSettingsRef();
  const settings = (await getDoc(settingsRef)).data() || {};
  const syncedSettings = {};
  for (const setting in settingsSchema) {
    syncedSettings[setting] = setting in settings ? settings[setting] : settingsSchema[setting]();
  }
  if (needsUpdate(settings, syncedSettings)) {
    debug(`settings schema out of sync, syncing...`);
    await setDoc(settingsRef, syncedSettings);
    debug(`settings schema synced`)
  }
};

const syncSchemas = async (user) => {
  await syncTaskSchema(user);
  await syncSettingsSchema(user);
};

let cancelAuthListener = onAuthStateChanged(auth, syncSchemas);

const registerOnce = ({
  tasks,
  persisted,
}) => {
  return {
    tasks: onSnapshot(tasksRef, (snapshot) => {
      tasks.target.value = snapshot.docs.map((doc) => doc.data());
      tasks.after();
    }),
    persisted: onSnapshot(persistedRef, (snapshot) => {
      persisted.target.value = {};
      for (const doc of snapshot.docs) {
        persisted.target.value[doc.id] = doc.data();
      }
      persisted.after();
    }),
  }
};

// register update listener
export const register = ({
  tasks,
  persisted,
}) => {
  let unsubscribe = registerOnce({
    tasks,
    persisted,
  });
  cancelAuthListener();
  cancelAuthListener = onAuthStateChanged(auth, async(user) => {
    for (const listener in unsubscribe) {
      unsubscribe[listener]();
    }
    await syncSchemas(user);
    tasksRef = getTasksRef(user.uid);
    persistedRef = getPersistedRef(user.uid);
    unsubscribe = registerOnce({
      tasks,
      persisted,
    });
  });
};

const createTask = () => new Promise((resolve) => {
  getCountFromServer(tasksRef).then(
    snapshot => {
      const id = snapshot.data().count + 1;
      const currentTime = Date.now();
      const task = generateFromSchema(taskSchema);
      task.id = id;
      task.timeCreated = currentTime;
      resolve(task);
    }
  );
});

export const addTask = async (data) => {
  const taskTemplate = await createTask();
  const task = { ...taskTemplate, ...data };
  return await setDoc(getTaskRef(task.id), task);
};

export const updateTask = async (id, data) => {
  const taskRef = getTaskRef(id);
  const task = (await getDoc(taskRef)).data();
  const updatedTask = { ...task, ...data };
  return await setDoc(taskRef, updatedTask);
};

export const updateSettings = async (data) => {
  const settingsRef = getSettingsRef();
  const settings = (await getDoc(settingsRef)).data();
  const updatedSettings = { ...settings, ...data };
  return await setDoc(settingsRef, updatedSettings);
};
