// /js/auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    sendSignInLinkToEmail, 
    isSignInWithEmailLink, 
    signInWithEmailLink, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    addDoc, 
    collection 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC8ZICdwkxoZXWHyfG9xMCkCsdKJVni2Rs",
    authDomain: "mo-bank.firebaseapp.com",
    projectId: "mo-bank",
    storageBucket: "mo-bank.appspot.com",
    messagingSenderId: "269537209156",
    appId: "1:269537209156:web:c3b1917b8707183ca10511"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const actionCodeSettings = {
    url: 'https://mo-bank.vercel.app/pages/dashboard.html',
    handleCodeInApp: true
};

async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        await setDoc(doc(db, "users", user.uid), {
            displayName: user.displayName || "",
            email: user.email,
            isAdmin: false
        }, { merge: true });
        window.location.href = '/pages/dashboard.html';
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        alert("Google Sign-In failed. Please try again.");
    }
}

async function sendSignInLink() {
    const email = document.getElementById('email').value;
    try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', email);
        alert("Sign-in link sent to your email. Please check your inbox.");
    } catch (error) {
        console.error("Email Link Sign-In Error:", error);
        alert("Failed to send sign-in link. Please try again.");
    }
}

async function logoutUser() {
    try {
        await signOut(auth);
        window.location.href = '/pages/login.html';
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Logout failed. Please try again.");
    }
}

async function handleEmailLinkSignIn() {
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = prompt("Please enter your email for confirmation");
        }
        try {
            const result = await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            const user = result.user;
            await setDoc(doc(db, "users", user.uid), {
                displayName: user.displayName || "",
                email: user.email,
                isAdmin: false
            }, { merge: true });
            window.location.href = '/pages/dashboard.html';
        } catch (error) {
            console.error("Email Link Sign-In Completion Error:", error);
            alert("Sign-in failed. Please try again.");
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    if (path.endsWith('/login.html')) {
        document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);
        document.getElementById('email-form').addEventListener('submit', (e) => {
            e.preventDefault();
            sendSignInLink();
        });
    }

    if (path.endsWith('/dashboard.html')) {
        handleEmailLinkSignIn();
    }
});