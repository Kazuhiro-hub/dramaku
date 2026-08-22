import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { app } from "./firebase-config.js";

export const auth = getAuth(app);

export function watchAuth(callback) {
    return onAuthStateChanged(auth, callback);
}

export async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function register(email, password, displayName = "") {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName.trim()) {
        await updateProfile(credential.user, { displayName: displayName.trim() });
    }
    return credential;
}

export function logout() {
    return signOut(auth);
}
