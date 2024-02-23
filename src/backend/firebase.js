import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
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

export let userUid = 'default';

const db = getFirestore(firebaseApp);
const getTasksRef = (userUid) => collection(db, import.meta.env.VITE_FIREBASE_DATABASE, userUid, 'tasks');
let tasksRef = getTasksRef(userUid);

export const signIn = async () => {
  const auth = getAuth(firebaseApp);
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
  const auth = getAuth(firebaseApp);
  onAuthStateChanged(auth, (user) => {
    unsubscribe();
    tasksRef = getTasksRef(user.uid);
    unsubscribe = registerTasksOnce(tasks);
  });
};

const getTaskRef = (id) => {
  return doc(tasksRef, id.toString());
};

const createTask = () => new Promise((resolve) => {
  getCountFromServer(tasksRef).then(
    snapshot => {
      const id = snapshot.data().count + 1;
      const currentTime = new Date().toLocaleString();
      resolve({
        id: id,
        description: '',
        finished: false,
        deleted: false,
        timeCreated: currentTime,
        timeFinished: null,
        tags: [], // todo: add 'Id's back
        requirements: [],
        dependents: [],
        parent: null,
        subtasks: [],
      });
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
