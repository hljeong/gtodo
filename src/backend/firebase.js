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

/*
export const firebaseApp = initializeApp({
  apiKey: "AIzaSyDsRn9G54ah2s0XRPtrybNMm4Y28jL7-oE",
  authDomain: "gtodo-cc131.firebaseapp.com",
  projectId: "gtodo-cc131",
  storageBucket: "gtodo-cc131.appspot.com",
  messagingSenderId: "202538327350",
  appId: "1:202538327350:web:4287894d51e4a1b0ad2797",
});
*/

export const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

const db = getFirestore(firebaseApp);
const tasksRef = collection(db, 'tasks');
// register update listener
export const registerTasks = (tasks) => {
  onSnapshot(tasksRef, (snapshot) => {
    tasks.value = snapshot.docs.map((doc) => doc.data());
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
