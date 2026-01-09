
import * as auth from './auth.js';
// Removed ui import as it was commented out in original file

export const APP_STATE = {
    initialized: false,
    authenticated: false
};

export async function initializeAuthentication() {
    console.log('Authentication system initialized');

    // Auth Buttons Demo
    const signInBtn = document.getElementById('sign-in-btn');
    const signOutBtn = document.getElementById('sign-out-btn');

    if (signInBtn && signOutBtn) {
        signInBtn.addEventListener('click', () => {
            signInBtn.style.display = 'none';
            signOutBtn.style.display = 'inline-flex';
            console.log('User tries to sign in');
            handleSignIn();
        });

        signOutBtn.addEventListener('click', () => {
            signOutBtn.style.display = 'none';
            signInBtn.style.display = 'inline-flex';
            handleSignOut();
            console.log('User signed out');
        });
    }

    // Authentication related initialization
    await ensureMsalLoaded();

    // Initialize the authentication module
    APP_STATE.initialized = auth.initializeAuth();

    if (!APP_STATE.initialized) {
        return;
    }

    // Check for authentication event
    window.addEventListener('msalLoginSuccess', async (event) => {
        console.log('MSAL Login Success Event:', event.detail);
        const { account } = event.detail.payload;
        if (account) {
            console.log(`User ${account.username} logged in successfully`);
            console.log("Successful authentication response received");
            await updateUserState();
        }
    })

    // Check if user is already signed in
    await checkExistingAuth();
}

async function ensureMsalLoaded() {
    if (window.msal) {
        return;
    }

    return new Promise((resolve) => {
        const msalScript = document.createElement('script');
        msalScript.src = "https://alcdn.msauth.net/browser/2.30.0/js/msal-browser.min.js";
        msalScript.async = true;
        msalScript.defer = true;

        msalScript.onload = () => {
            console.log("MSAL.js loaded successfully");
            resolve();
        };

        msalScript.onerror = () => {
            console.error("Failed to load MSAL.js");
            resolve();
        };

        document.head.appendChild(msalScript);
    });
}

async function checkExistingAuth() {
    const account = auth.getAccount();
    if (account) {
        console.log("Found existing account", account.username);
        await updateUserState();
    } else {
        APP_STATE.authenticated = false;
    }
}

async function updateUserState() {
    try {
        const userDetails = await auth.getUserDetails();

        if (userDetails) {
            APP_STATE.authenticated = true;
            const idTokenClaims = auth.getIdTokenClaims();
            showAuthenticatedUser(userDetails, idTokenClaims);
        } else {
            APP_STATE.authenticated = false;
        }
    } catch (error) {
        console.error("Error updating user state:", error);
        APP_STATE.authenticated = false;
    }
}

export function handleSignIn() {
    if (!APP_STATE.initialized) {
        return;
    }
    try {
        auth.signIn();
    } catch (error) {
        console.error("Sign in error:", error);
    }
}

export function handleSignOut() {
    if (!APP_STATE.initialized) {
        return;
    }
    try {
        auth.signOut();
        APP_STATE.authenticated = false;
    } catch (error) {
        console.error("Sign out error:", error);
    }
}

function showAuthenticatedUser(userDetails, claims) {
    const welcome = document.getElementById('welcome-message');
    if (welcome) {
        welcome.textContent = `Hi, ${userDetails.displayName || 'User'}`;
        welcome.classList.remove('sr-only');
    }
    console.log(`Hi, ${userDetails.displayName || 'User'}`)
}
