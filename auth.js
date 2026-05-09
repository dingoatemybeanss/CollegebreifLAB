/* ─── Firebase Configuration ──────────────────────────── */

var firebaseConfig = {
  apiKey:            "AIzaSyANpGUNgnmrXG4_Mznma2syL0H-ygzA0TQ",
  authDomain:        "college-breif.firebaseapp.com",
  projectId:         "college-breif",
  storageBucket:     "college-breif.firebasestorage.app",
  messagingSenderId: "909905457319",
  appId:             "1:909905457319:web:f1e0290af971e2799d2b82",
  measurementId:     "G-RM84VBESQ5"
};

/* ─── Initialize Firebase ─────────────────────────────── */

var _fbApp      = firebase.initializeApp(firebaseConfig);
var _fbAuth     = firebase.auth();
var _fbAnalytics;

try { _fbAnalytics = firebase.analytics(); } catch(e) {}

/* ─── Google Auth Provider ────────────────────────────── */

var _googleProvider = new firebase.auth.GoogleAuthProvider();
_googleProvider.setCustomParameters({ prompt: 'select_account' });

/* ─── Auth State Listener ─────────────────────────────── */

_fbAuth.onAuthStateChanged(function(user) {
  var detail;

  if (user) {
    detail = {
      user: user,
      profile: {
        uid:         user.uid,
        displayName: user.displayName || '',
        email:       user.email       || '',
        photoURL:    user.photoURL    || ''
      }
    };
  } else {
    detail = { user: null, profile: null };
  }

  document.dispatchEvent(new CustomEvent('ne-auth-state', { detail: detail }));
});

/* ─── Sign In with Google ─────────────────────────────── */

function signInGoogle() {
  _fbAuth.signInWithPopup(_googleProvider).catch(function(err) {
    if (err.code === 'auth/popup-blocked') {
      // Fallback to redirect if popup is blocked
      _fbAuth.signInWithRedirect(_googleProvider);
    } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      console.error('Sign-in error:', err.message);
      alert('Sign-in failed: ' + err.message);
    }
  });
}

/* ─── Handle Redirect Result (for popup-blocked fallback) */

_fbAuth.getRedirectResult().then(function(result) {
  // result.user will be null if no redirect happened — that's fine
}).catch(function(err) {
  if (err.code && err.code !== 'auth/no-auth-event') {
    console.error('Redirect result error:', err.message);
  }
});

/* ─── Sign Out ────────────────────────────────────────── */

function logOut() {
  _fbAuth.signOut().catch(function(err) {
    console.error('Sign-out error:', err.message);
  });
}

/* ─── Expose current user helper ─────────────────────── */

function getCurrentFirebaseUser() {
  return _fbAuth.currentUser;
}
