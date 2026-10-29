import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getDatabase, onValue, ref, set } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAI-RIffDR2eBT3ZTV9DLDE38_Oz7_PTTI',
  authDomain: 'quanlygiadinh-94ced.firebaseapp.com',
  databaseURL: 'https://quanlygiadinh-94ced-default-rtdb.firebaseio.com',
  projectId: 'quanlygiadinh-94ced',
  storageBucket: 'quanlygiadinh-94ced.firebasestorage.app',
  messagingSenderId: '786194232346',
  appId: '1:786194232346:web:dfca018b4fbc406d130da3',
  measurementId: 'G-ZF345MDWZ4'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const transactionsRef = ref(database, 'households/quanlygiadinh-94ced/transactions');

export function observeAuth(callback, onError) {
  return onAuthStateChanged(auth, callback, onError);
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

export function observeTransactions(callback, onError) {
  return onValue(transactionsRef, snapshot => {
    const data = snapshot.val();
    callback(data && typeof data === 'object' ? Object.values(data) : null);
  }, onError);
}

export function writeTransactions(transactions) {
  const data = Object.fromEntries(transactions.map(transaction => [transaction.id, transaction]));
  return set(transactionsRef, data);
}
