import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

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
const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      localStorage.setItem('googleToken', user.accessToken);
      window.location.href = '/pages/dashboard.html';
    })
    .catch((error) => {
      console.error("Sign-in error:", error);
      alert("Sign-in failed. Please try again.");
    });
}

export function logoutUser() {
  signOut(auth).then(() => {
    localStorage.removeItem('googleToken');
    window.location.href = '/pages/login.html';
  }).catch((error) => {
    console.error("Sign-out error:", error);
    alert("Sign-out failed. Please try again.");
  });
}