import createAuth0Client from "../node_modules/@auth0/auth0-spa-js/dist/auth0-spa-js.production.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    sendEmailVerification,
    sendPasswordResetEmail, 
    confirmPasswordReset
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyC8ZICdwkxoZXWHyfG9xMCkCsdKJVni2Rs",
    authDomain: "mo-bank.firebaseapp.com",
    projectId: "mo-bank",
    storageBucket: "mo-bank.firebasestorage.app",
    messagingSenderId: "269537209156",
    appId: "1:269537209156:web:c3b1917b8707183ca10511"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Auth0 Configuration
let auth0 = null;

async function configureAuth0Client() {
    auth0 = await createAuth0Client({
        domain: "dev-nqdfwemz14t8nf7w.us.auth0.com",
        client_id: "IJVNKTUu7mlBsvxDhdNNYOOtTXfFOtqA",
        redirect_uri: window.location.origin
    });
}

// Auth0 Functions
export async function signInWithAuth0() {
    await auth0.loginWithRedirect();
}

export async function handleAuthRedirect() {
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        await auth0.handleRedirectCallback();
        window.history.replaceState({}, document.title, "/");
    }
}

export async function logoutUser() {
    await auth0.logout({ returnTo: window.location.origin });
}

// Firebase Functions (Commented out Firebase Google Sign-In, using Auth0 for Google only)
export async function loginWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (!user.emailVerified) {
            alert("Please verify your email before logging in.");
            await signOut(auth);
        } else {
            window.location.href = '/pages/dashboard.html';
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login failed. Please try again.");
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await configureAuth0Client();
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        await handleAuthRedirect();
    }
});
