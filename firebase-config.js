import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyCMPeZlR6ufkbdeVkezLpIW4EgE3d3oZ0g",
    authDomain: "dramakuvip.firebaseapp.com",
    databaseURL: "https://dramakuvip-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dramakuvip",
    storageBucket: "dramakuvip.firebasestorage.app",
    messagingSenderId: "345528072520",
    appId: "1:345528072520:web:f88175f6f7d58a1a3c9b7d",
    measurementId: "G-LF2JH17KCE"
};

export const app = initializeApp(firebaseConfig);
