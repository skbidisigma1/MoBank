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

export async function registerWithEmail(email, password) {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            displayName: user.displayName || "",
            isAdmin: false
        });
        window.location.href = '/pages/dashboard.html';
    } catch (error) {
        console.error("Registration Error:", error);
        alert("Registration failed. Please try again.");
    }
}

export async function loginWithEmail(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
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

export async function logoutUser() {
    try {
        await signOut(auth);
        window.location.href = '/pages/login.html';
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Logout failed. Please try again.");
    }
}

export async function sendPasswordReset(email) {
    const actionCodeSettings = {
        url: 'https://mo-bank.vercel.app/pages/password-reset-confirm.html',
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

document.addEventListener('DOMContentLoaded', () => {
    // No actions needed here as event listeners are handled in HTML
});