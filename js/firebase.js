// =========================================
// FIREBASE MODULE CONFIG
// =========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
    getFirestore,
    enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// CONFIG FIREBASE (TA CONFIG)
const firebaseConfig = {
    apiKey: "AIzaSyDpDY5IZQotR_BLttttXjXrWS1K1XqSkfw",
    authDomain: "gestion-finance-saas.firebaseapp.com",
    projectId: "gestion-finance-saas",
    storageBucket: "gestion-finance-saas.firebasestorage.app",
    messagingSenderId: "318410713423",
    appId: "1:318410713423:web:79af99382ff54ac22d7d3a",
    measurementId: "G-D8QFQ76398"
};

// INITIALISATION
const app = initializeApp(firebaseConfig);

// FIRESTORE
export const db = getFirestore(app);

// PERSISTENCE OFFLINE
enableIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code === "failed-precondition") {
            console.warn("Persistence: plusieurs onglets ouverts");
        } else if (err.code === "unimplemented") {
            console.warn("Persistence non supportée");
        } else {
            console.warn("Persistence error", err);
        }
    });