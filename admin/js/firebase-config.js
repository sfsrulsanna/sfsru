// Инициализация Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore,
    collection,
    getDocs,
    query,
    where,
    serverTimestamp,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    getDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Конфигурация Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC4gsGgvzBQTtMbeJcUn2zTqcTUnoktPBE",
  authDomain: "sfsru-gosuslugi.firebaseapp.com",
  databaseURL: "https://sfsru-gosuslugi-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sfsru-gosuslugi",
  storageBucket: "sfsru-gosuslugi.firebasestorage.app",
  messagingSenderId: "925876071042",
  appId: "1:925876071042:web:589f4b8245937167f9229b",
  measurementId: "G-5B8M7RK7C9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Экспортируем все необходимые функции Firestore
export { 
    app, 
    auth, 
    db,
    // Auth functions
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    // Firestore functions
    collection,
    getDocs,
    query,
    where,
    serverTimestamp,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    getDoc,
    orderBy
};