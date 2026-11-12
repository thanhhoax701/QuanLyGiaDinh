import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getDatabase, onValue, ref, update } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';

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
const goldPurchasesRef = ref(database, 'households/quanlygiadinh-94ced/goldFund/purchases');
const goldContributionsRef = ref(database, 'households/quanlygiadinh-94ced/goldFund/contributions');

function createRecordCollection(collectionRef) {
  let records = Object.create(null);
  let writeQueue = Promise.resolve();

  function enqueueUpdate(createUpdates) {
    const operation = writeQueue.then(async () => {
      const updates = createUpdates();
      const entries = Object.entries(updates);
      if (!entries.length) return;

      await update(collectionRef, updates);
      for (const [id, value] of entries) {
        if (value === null) delete records[id];
        else records[id] = value;
      }
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  function replace(items) {
    const next = Object.fromEntries(items.map(item => [item.id, item]));
    return enqueueUpdate(() => {
      const updates = [];
      for (const id of Object.keys(records)) {
        if (!Object.prototype.hasOwnProperty.call(next, id)) updates.push([id, null]);
      }
      for (const [id, item] of Object.entries(next)) {
        if (!Object.prototype.hasOwnProperty.call(records, id) || JSON.stringify(records[id]) !== JSON.stringify(item)) {
          updates.push([id, item]);
        }
      }
      return Object.fromEntries(updates);
    });
  }

  function writeChanges(items) {
    const changes = Object.fromEntries(items.map(item => [item.id, item]));
    return enqueueUpdate(() => {
      const updates = [];
      for (const [id, item] of Object.entries(changes)) {
        if (!Object.prototype.hasOwnProperty.call(records, id) || JSON.stringify(records[id]) !== JSON.stringify(item)) {
          updates.push([id, item]);
        }
      }
      return Object.fromEntries(updates);
    });
  }

  function removeRecords(ids) {
    return enqueueUpdate(() => Object.fromEntries(
      ids.filter(id => Object.prototype.hasOwnProperty.call(records, id)).map(id => [id, null])
    ));
  }

  function observe(callback, onError) {
    return onValue(collectionRef, snapshot => {
      const data = snapshot.val();
      records = Object.assign(Object.create(null), data && typeof data === 'object' ? data : {});
      callback(data && typeof data === 'object' ? Object.values(data) : null);
    }, onError);
  }

  return { observe, replace, writeChanges, removeRecords };
}

const transactionRecords = createRecordCollection(transactionsRef);
const goldPurchaseRecords = createRecordCollection(goldPurchasesRef);
const goldContributionRecords = createRecordCollection(goldContributionsRef);

export function observeAuth(callback, onError) {
  return onAuthStateChanged(auth, callback, onError);
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function loginWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function loginWithGoogleRedirect() {
  return signInWithRedirect(auth, new GoogleAuthProvider());
}

export function completeGoogleRedirect() {
  return getRedirectResult(auth);
}

export function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

export function logout() {
  return signOut(auth);
}

export function observeTransactions(callback, onError) {
  return transactionRecords.observe(callback, onError);
}

export function writeTransactions(transactions) {
  return transactionRecords.replace(transactions);
}

export function observeGoldPurchases(callback, onError) {
  return goldPurchaseRecords.observe(callback, onError);
}

export function writeGoldPurchases(purchases) {
  return goldPurchaseRecords.replace(purchases);
}

export function observeGoldContributions(callback, onError) {
  return goldContributionRecords.observe(callback, onError);
}

export function writeGoldContributions(contributions) {
  return goldContributionRecords.replace(contributions);
}

export function writeGoldContributionChanges(contributions) {
  return goldContributionRecords.writeChanges(contributions);
}

export function writeGoldContribution(contribution) {
  return writeGoldContributionChanges([contribution]);
}

export function removeGoldContribution(id) {
  return goldContributionRecords.removeRecords([id]);
}
