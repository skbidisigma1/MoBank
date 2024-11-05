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
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import createAuth0Client from "@auth0/auth0-spa-js";

// Firebase configuration
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

// Auth0 configuration
const auth0Client = await createAuth0Client({
    domain: "YOUR_AUTH0_DOMAIN",
    clientId: "YOUR_AUTH0_CLIENT_ID",
    redirect_uri: window.location.origin + "/pages/dashboard.html" // Adjust to your post-login page
});

// Firebase functions for email/password
export async function registerWithEmail(email, password) {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        await sendEmailVerification(user);
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            displayName: user.displayName || "",
            balance: 0,
            isAdmin: false
        });
        alert("Registration successful! Please verify your email.");
        window.location.href = '/pages/login.html';
    } catch (error) {
        console.error("Registration Error:", error);
        alert("Registration failed. Please try again.");
    }
}

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

export async function logoutUser() {
    try {
        await signOut(auth);
        window.location.href = '/pages/login.html';
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Logout failed. Please try again.");
    }
}

// Auth0 login function
export async function signInWithAuth0() {
    try {
        await auth0Client.loginWithRedirect({
            redirect_uri: window.location.origin + "/pages/dashboard.html"
        });
    } catch (error) {
        console.error("Auth0 Sign-In Error:", error);
        alert("Auth0 Sign-In failed. Please try again.");
    }
}

// Check for Auth0 login completion
document.addEventListener("DOMContentLoaded", async () => {
    const isAuthenticated = await auth0Client.isAuthenticated();
    if (isAuthenticated) {
        const user = await auth0Client.getUser();
        console.log("Auth0 User:", user);
        window.location.href = "/pages/dashboard.html";
    }
});
