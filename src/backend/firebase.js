import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  getCountFromServer,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';

export const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

const auth = getAuth(firebaseApp);
export let userUid = 'default';

const db = getFirestore(firebaseApp);
const getTasksRef = (userUid) => collection(db, import.meta.env.VITE_FIREBASE_DATABASE, userUid, 'tasks');
let tasksRef = getTasksRef(userUid);

export const signIn = async () => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    userUid = result.user.uid;
    tasksRef = getTasksRef(userUid);
  } catch(error) {
    console.error(`Failed to sign in: ${error}`);
  }
};

const registerTasksOnce = (tasks) => onSnapshot(tasksRef, (snapshot) => {
  tasks.value = snapshot.docs.map((doc) => doc.data());
});

// register update listener
export const registerTasks = (tasks) => {
  let unsubscribe = registerTasksOnce(tasks);
  onAuthStateChanged(auth, (user) => {
    unsubscribe();
    tasksRef = getTasksRef(user.uid);
    unsubscribe = registerTasksOnce(tasks);
  });
};

// todo: add 'id's back
const schema = {
  description: () => '',
  finished: () => false,
  pinned: () => false,
  deleted: () => false,
  timeCreated: () => null,
  timeFinished: () => null,
  tags: () => [],
  requirements: () => [],
  dependents: () => [],
  parent: () => null,
  subtasks: () => [],
};

const getTaskRef = (id) => {
  return doc(tasksRef, id.toString());
};

const syncSchema = async (user) => {
  const snapshot = await getDocs(getTasksRef(user.uid));
  const tasks = snapshot.docs.map((doc) => doc.data());
  for (const task of tasks) {
    const syncedTask = { id: task.id };
    for (const property in schema) {
      syncedTask[property] = property in task ? task[property] : schema[property]();
    }
    setDoc(getTaskRef(task.id), syncedTask);
  }
};

onAuthStateChanged(auth, syncSchema);

const createTask = () => new Promise((resolve) => {
  getCountFromServer(tasksRef).then(
    snapshot => {
      const id = snapshot.data().count + 1;
      const currentTime = Date.now();
      const task = { id: id };
      for (const property in schema) {
        task[property] = schema[property]();
      }
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

export const deleteTask = async (id) => {
  return updateTask(id, { deleted: true });
};
