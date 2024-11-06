// Import Firebase and Auth0
const firebaseConfig = {
    apiKey: "AIzaSyC8ZICdwkxoZXWHyfG9xMCkCsdKJVni2Rs",
    authDomain: "mo-bank.firebaseapp.com",
    projectId: "mo-bank",
    storageBucket: "mo-bank.firebasestorage.app",
    messagingSenderId: "269537209156",
    appId: "1:269537209156:web:c3b1917b8707183ca10511"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

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

// Firebase Functions
export async function registerWithEmail(email, password) {
    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        const user = result.user;
        await user.sendEmailVerification();
        await db.collection("users").doc(user.uid).set({
            email: user.email,
            displayName: user.displayName || "",
            balance: 0,
            isAdmin: false
        });
    } catch (error) {
        console.error("Registration Error:", error);
    }
}

export async function loginWithEmail(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        if (!user.emailVerified) {
            await auth.signOut();
        } else {
            window.location.href = '/dashboard';
        }
    } catch (error) {
        console.error("Login Error:", error);
    }
}

export async function sendPasswordReset(email) {
    try {
        await auth.sendPasswordResetEmail(email);
    } catch (error) {
        console.error("Password Reset Error:", error);
    }
}

export async function confirmPasswordResetAction(oobCode, newPassword) {
    try {
        await auth.confirmPasswordReset(oobCode, newPassword);
    } catch (error) {
        console.error("Password Reset Confirmation Error:", error);
    }
}

export async function signInWithGoogle() {
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (!userDoc.exists) {
            await db.collection("users").doc(user.uid).set({
                email: user.email,
                displayName: user.displayName || "",
                balance: 0,
                isAdmin: false
            });
        }
    } catch (error) {
        console.error("Google Sign-In Error:", error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await configureAuth0Client();
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        await handleAuthRedirect();
        window.history.replaceState({}, document.title, "/");
    }
});
