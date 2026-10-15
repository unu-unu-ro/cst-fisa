/*
 * Configurarea Firebase pentru salvarea fișelor în cont (Google login + Firestore).
 *
 * 1. Creează un proiect la https://console.firebase.google.com
 * 2. Authentication → Sign-in method → activează „Google”.
 *    Authentication → Settings → Authorized domains → adaugă fisa.predicare-expozitiva.ro (și localhost).
 * 3. Firestore Database → Create database (production mode) → publică regulile din firestore.rules.
 * 4. Project settings → Your apps → Web app → copiază obiectul firebaseConfig mai jos.
 *
 * Valorile de mai jos NU sunt secrete (sunt identificatori publici ai proiectului);
 * accesul la date este protejat de regulile Firestore.
 */
window.FIREBASE_CONFIG = {
apiKey: "AIzaSyAmYuDhesnUK5Y72Ydy3FPDOjAJ7lulWzY",
  authDomain: "cst-fisa.firebaseapp.com",
  projectId: "cst-fisa",
  storageBucket: "cst-fisa.firebasestorage.app",
  messagingSenderId: "223779421860",
  appId: "1:223779421860:web:1da19426c6b5dc89993031",
  measurementId: "G-SVBMPLTJS6"
};
