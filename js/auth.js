// /js/auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail, 
    confirmPasswordReset 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "mo-bank.firebaseapp.com",
    projectId: "mo-bank",
    storageBucket: "mo-bank.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Registers a new user with email and password.
 * @param {string} email - User's email address.
 * @param {string} password - User's chosen password.
 */
export async function registerWithEmail(email, password) {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        // Store additional user information in Firestore
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            displayName: user.displayName || "",
            isAdmin: false
        });
        
        // Redirect to dashboard after successful registration
        window.location.href = '/pages/dashboard.html';
    } catch (error) {
        console.error("Registration Error:", error);
        alert("Registration failed. Please try again.");
    }
}

/**
 * Logs in an existing user with email and password.
 * @param {string} email - User's email address.
 * @param {string} password - User's password.
 */
export async function loginWithEmail(email, password) {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        // Redirect to dashboard after successful login
        window.location.href = '/pages/dashboard.html';
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

/**
 * Logs out the currently signed-in user.
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        // Redirect to login page after logout
        window.location.href = '/pages/login.html';
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Logout failed. Please try again.");
    }
}

/**
 * Sends a password reset email to the specified email address.
 * @param {string} email - User's email address.
 */
export async function sendPasswordReset(email) {
    const actionCodeSettings = {
        url: 'https://mo-bank.vercel.app/pages/password-reset-confirm.html',
        handleCodeInApp: false // Use Firebase's default email flow
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

/**
 * Confirms the password reset with the provided action code and new password.
 * @param {string} oobCode - The action code from the password reset email.
 * @param {string} newPassword - The new password entered by the user.
 */
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

// Initialize event listeners if needed (currently handled in HTML inline scripts)
document.addEventListener('DOMContentLoaded', () => {
});