import createAuth0Client from "@auth0/auth0-spa-js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase Configuration (For Firestore usage)
const firebaseConfig = {
    apiKey: "AIzaSyC8ZICdwkxoZXWHyfG9xMCkCsdKJVni2Rs",
    authDomain: "mo-bank.firebaseapp.com",
    projectId: "mo-bank",
    storageBucket: "mo-bank.firebasestorage.app",
    messagingSenderId: "269537209156",
    appId: "1:269537209156:web:c3b1917b8707183ca10511"
};

const app = initializeApp(firebaseConfig);
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

// Auth0 Login Functions
export async function signInWithAuth0() {
    try {
        await auth0.loginWithRedirect();
    } catch (error) {
        console.error("Auth0 Login Error:", error);
    }
}

export async function handleAuthRedirect() {
    const isAuthenticated = await auth0.isAuthenticated();
    if (!isAuthenticated) {
        await auth0.handleRedirectCallback();
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

// Firestore Functions for User Data (kept Firebase Firestore for database usage)
export async function saveUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, "users", user.sub));
        if (!userDoc.exists()) {
            await setDoc(doc(db, "users", user.sub), {
                email: user.email,
                name: user.name || "",
                balance: 0,
                isAdmin: false
            });
        }
    } catch (error) {
        console.error("Error saving user data:", error);
    }
}

// Initialize Auth0 on page load
document.addEventListener('DOMContentLoaded', async () => {
    await configureAuth0Client();

    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        await handleAuthRedirect();
        window.history.replaceState({}, document.title, "/");
    }
});
