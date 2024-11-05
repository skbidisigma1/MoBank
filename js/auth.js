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

// Import Auth0 SDK
import createAuth0Client from '@auth0/auth0-spa-js';

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
const auth0 = await createAuth0Client({
    domain: "YOUR_AUTH0_DOMAIN",
    client_id: "YOUR_CLIENT_ID",
    redirect_uri: window.location.origin,
    cacheLocation: 'localstorage'
});

export async function registerWithEmail(email, password) {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        const actionCodeSettings = {
            url: 'https://mo-bank.vercel.app/pages/action.html',
            handleCodeInApp: true
        };

        await sendEmailVerification(user, actionCodeSettings);
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            displayName: user.displayName || "",
            balance: 0,
            isAdmin: false
        });
        alert("Registration successful! Please verify your email to continue.");
        window.location.href = '/pages/login.html';
    } catch (error) {
        console.error("Registration Error:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("This email is already in use. Please try logging in or use a different email.");
        } else {
            alert("Registration failed. Please try again.");
        }
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
        if (error.code === 'auth/user-not-found') {
            alert("No user found with this email.");
        } else if (error.code === 'auth/wrong-password') {
            alert("Incorrect password. Please try again.");
        } else {
            alert("Login failed. Please try again.");
        }
    }
}

export async function logoutUser() {
    try {
        await signOut(auth);
        await auth0.logout({ returnTo: window.location.origin });
        window.location.href = '/pages/login.html';
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Logout failed. Please try again.");
    }
}

export async function sendPasswordReset(email) {
    const actionCodeSettings = {
        url: 'https://mo-bank.vercel.app/pages/action.html',
        handleCodeInApp: false
    };

    try {
        await sendPasswordResetEmail(auth, email, actionCodeSettings);
        alert("Password reset email sent. Please check your inbox.");
    } catch (error) {
        console.error("Password Reset Error:", error);
        if (error.code === 'auth/user-not-found') {
            alert("No user found with this email.");
        } else {
            alert("Failed to send password reset email. Please try again.");
        }
    }
}

export async function confirmPasswordResetAction(oobCode, newPassword) {
    try {
        await confirmPasswordReset(auth, oobCode, newPassword);
        alert("Password has been reset successfully.");
        window.location.href = '/pages/login.html';
    } catch (error) {
        console.error("Password Reset Confirmation Error:", error);
        alert("Failed to reset password. The link may be invalid or expired.");
        window.location.href = '/pages/login.html';
    }
}

// Auth0 Google sign-in
export async function signInWithGoogle() {
    try {
        await auth0.loginWithRedirect({
            connection: 'google-oauth2'
        });
        // Handle after login
        const user = await auth0.getUser();
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.sub));
            if (!userDoc.exists()) {
                await setDoc(doc(db, "users", user.sub), {
                    email: user.email,
                    displayName: user.name,
                    balance: 0,
                    isAdmin: false
                });
            }
            window.location.href = '/pages/dashboard.html';
        }
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        alert("Google Sign-In failed. Please try again.");
    }
}

// Handle redirection back from Auth0
export async function handleRedirectCallback() {
    try {
        if (window.location.search.includes('code=')) {
            await auth0.handleRedirectCallback();
            window.location.replace(window.location.pathname);
        }
    } catch (error) {
        console.error("Auth0 Redirection Error:", error);
    }
}

// Initialize Auth0 client on page load
document.addEventListener('DOMContentLoaded', async () => {
    await handleRedirectCallback();
});
