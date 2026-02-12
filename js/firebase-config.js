// js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyC4gsGgvzBQTtMbeJcUn2zTqcTUnoktPBE",
  authDomain: "sfsru-gosuslugi.firebaseapp.com",
  projectId: "sfsru-gosuslugi",
  storageBucket: "sfsru-gosuslugi.firebasestorage.app",
  messagingSenderId: "925876071042",
  appId: "1:925876071042:web:589f4b8245937167f9229b",
  measurementId: "G-5B8M7RK7C9"
};

// Инициализация Firebase (совместимая с compat)
firebase.initializeApp(firebaseConfig);

// Экспортируем сервисы
const auth = firebase.auth();
const db = firebase.firestore();

// Google Auth
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Функции (без saveUserRole — она больше не нужна)
async function signInWithGoogle(userRole = 'individual') {
  try {
    const result = await firebase.auth().signInWithPopup(googleProvider);
    return result;
  } catch (error) {
    console.error('Ошибка авторизации через Google:', error);
    throw error;
  }
}

// Глобальный экспорт для совместимости
window.firebase = firebase;
window.auth = auth;
window.db = db;
window.signInWithGoogle = signInWithGoogle;