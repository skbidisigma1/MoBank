// Import required modules
import createAuth0Client from "../node_modules/@auth0/auth0-spa-js/dist/auth0-spa-js.production.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
const provider = new GoogleAuthProvider();

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
export async function loginWithAuth0() {
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

export async function isAuthenticated() {
    return await auth0.isAuthenticated();
}

export async function getUser() {
    return await auth0.getUser();
}

// Firebase Google Sign-In
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                displayName: user.displayName || "",
                balance: 0,
                isAdmin: false
            });
        }

        window.location.href = '/pages/dashboard.html';
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        alert("Google Sign-In failed. Please try again.");
    }
}

// Initialize Auth0 Client on Page Load
document.addEventListener('DOMContentLoaded', async () => {
    await configureAuth0Client();
    await handleAuthRedirect();
});
