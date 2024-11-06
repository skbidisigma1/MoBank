import createAuth0Client from "@auth0/auth0-spa-js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    sendEmailVerification,
    sendPasswordResetEmail, 
    confirmPasswordReset,
    GoogleAuthProvider,
    signInWithPopup
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

// Firebase Functions (Commented out, for fallback if needed)
// export async function registerWithEmail(email, password) {
//     try {
//         const result = await createUserWithEmailAndPassword(auth, email, password);
//         const user = result.user;
//         await sendEmailVerification(user, {
//             url: 'https://mo-bank.vercel.app/pages/action.html',
//             handleCodeInApp: true
//         });
//         await setDoc(doc(db, "users", user.uid), {
//             email: user.email,
//             displayName: user.displayName || "",
//             balance: 0,
//             isAdmin: false
//         });
//         alert("Registration successful! Please verify your email to continue.");
//         window.location.href = '/pages/login.html';
//     } catch (error) {
//         console.error("Registration Error:", error);
//         alert("Registration failed. Please try again.");
//     }
// }

// export async function loginWithEmail(email, password) {
//     try {
//         const userCredential = await signInWithEmailAndPassword(auth, email, password);
//         const user = userCredential.user;
//         if (!user.emailVerified) {
//             alert("Please verify your email before logging in.");
//             await signOut(auth);
//         } else {
//             window.location.href = '/pages/dashboard.html';
//         }
//     } catch (error) {
//         console.error("Login Error:", error);
//         alert("Login failed. Please try again.");
//     }
// }

// export async function sendPasswordReset(email) {
//     const actionCodeSettings = {
//         url: 'https://mo-bank.vercel.app/pages/action.html',
//         handleCodeInApp: false
//     };

//     try {
//         await sendPasswordResetEmail(auth, email, actionCodeSettings);
//         alert("Password reset email sent. Please check your inbox.");
//     } catch (error) {
//         console.error("Password Reset Error:", error);
//         alert("Failed to send password reset email. Please try again.");
//     }
// }

document.addEventListener('DOMContentLoaded', async () => {
    await configureAuth0Client();

    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        await handleAuthRedirect();
        window.history.replaceState({}, document.title, "/");
    }
});
