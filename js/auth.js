// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8ZICdwkxoZXWHyfG9xMCkCsdKJVni2Rs",
  authDomain: "mo-bank.firebaseapp.com",
  projectId: "mo-bank",
  storageBucket: "mo-bank.appspot.com",
  messagingSenderId: "269537209156",
  appId: "1:269537209156:web:c3b1917b8707183ca10511"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Function to handle Google Sign-In
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("User signed in:", user);
    
    // Optionally, store user information in Firestore
    // You need to set up Firestore and import necessary functions if you want to do this
    /*
    import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
    const db = getFirestore(app);
    await addDoc(collection(db, "users"), {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email
    });
    */
    
    // Redirect to dashboard after successful login
    window.location.href = '/pages/dashboard.html';
  } catch (error) {
    console.error("Sign-in error:", error);
    alert("Sign-in failed. Please try again.");
  }
}

// Function to handle Logout
export async function logoutUser() {
  try {
    await signOut(auth);
    console.log("User signed out");
    localStorage.removeItem('googleToken');
    window.location.href = '/pages/login.html';
  } catch (error) {
    console.error("Sign-out error:", error);
    alert("Sign-out failed. Please try again.");
  }
}