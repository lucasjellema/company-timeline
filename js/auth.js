/**
 * auth.js
 * Microsoft Entra ID (Azure AD) authentication module
 * 
 * This module handles authentication with Microsoft Entra ID using MSAL.js
 * It exports functions to handle login, logout, and getting the current user
 */

// Import authentication configuration
import { msalConfig, loginRequest } from './authConfig.js';

// Authentication configuration is imported from authConfig.js

// Permission scopes are imported from authConfig.js

// MSAL instance for authentication
let msalInstance = null;

// In-memory storage for user details and tokens
let userSessionData = {
    userDetails: null,
    idToken: null,
    accessToken: null
};

/**
 * Initialize Microsoft Authentication Library
 */
export function initializeAuth() {
    // Import MSAL from CDN if not available
    if (!window.msal) {
        console.warn("MSAL not found. Make sure to include the MSAL script in your HTML.");
        return false;
    }

    // Using msalConfig imported from authConfig.js

    // Create new authentication instance
    msalInstance = new msal.PublicClientApplication(msalConfig);

    // Add event listener for successful login
    msalInstance.addEventCallback((message) => {
        console.log('MSAL Event:', message.eventType);

        if (message.eventType === 'msal:loginSuccess' || message.eventType === 'msal:acquireTokenSuccess') {
            console.log('Login successful:', message);
            userSessionData.idToken = message.payload.idToken;
            userSessionData.idTokenClaims = message.payload.idTokenClaims;
            const event = new CustomEvent('msalLoginSuccess', { detail: message });
            window.dispatchEvent(event);
            // Update UI if needed
            if (message.payload.account) {
                showWelcomeMessage(message.payload.account.username);
            }
        }
    });

    return true;
}

/**
 * Handle redirect response after authentication
 * @returns {Promise<void>}
 */
export async function handleResponse(response) {
    if (response !== null) {
        //  username = response.account.username;
        //  showWelcomeMessage(username);
    } else {
        selectAccount();
    }
}

/**
 * Sign in user using redirect flow
 */
export function signIn() {
    if (!msalInstance) {
        console.error("MSAL instance not initialized");
        return Promise.reject(new Error("MSAL instance not initialized"));
    }

    // Start login process with configuration from authConfig.js
    return msalInstance.loginPopup(loginRequest)
        .then(handleResponse)
        .catch(error => {
            console.error(error);
            throw error;
        });
}

/**
 * Sign out the current user
 */
export function signOut() {
    if (!msalInstance) {
        console.error("MSAL instance not initialized");
        return;
    }

    // Clear in-memory session data
    userSessionData.userDetails = null;
    userSessionData.idToken = null;
    userSessionData.accessToken = null;

    // Find all accounts and remove them
    const currentAccounts = msalInstance.getAllAccounts();
    if (currentAccounts.length > 0) {
        msalInstance.logout({
            account: currentAccounts[0]
        });
    }
}

/**
 * Get the currently signed in user account
 * @returns {Object|null} The user account or null if not signed in
 */
export function getAccount() {
    if (!msalInstance) {
        console.error("MSAL instance not initialized");
        return null;
    }

    // Get all accounts from MSAL
    const currentAccounts = msalInstance.getAllAccounts();

    // Return the first account if available
    if (currentAccounts.length > 0) {
        return currentAccounts[0];
    }

    return null;
}

/**
 * Get a valid access token for the current user
 * @returns {Promise<string|null>} Access token or null
 */
export async function getAccessToken() {
    if (!msalInstance) {
        console.error("MSAL instance not initialized");
        return null;
    }

    const account = getAccount();
    if (!account) {
        // Not signed in
        return null;
    }

    const silentRequest = {
        scopes: loginRequest.scopes,
        account: account,
        forceRefresh: false
    };

    try {
        const response = await msalInstance.acquireTokenSilent(silentRequest);
        return response.accessToken;
    } catch (error) {
        console.error("Failed to acquire access token:", error);
        return null; // Handle interaction requirement if needed, but for now silent only
    }
}

/**
 * Get user details from Microsoft Graph API
 * @returns {Promise<Object|null>} User details object or null on failure
 */
export async function getUserDetails() {
    if (!msalInstance) {
        console.error("MSAL instance not initialized");
        return null;
    }

    const token = await getAccessToken();
    if (!token) return null;

    try {
        // Call Microsoft Graph API to get user details
        const response = await fetch("https://graph.microsoft.com/v1.0/me", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response.ok) {
            // Store user details in memory
            userSessionData.userDetails = await response.json();
            return userSessionData.userDetails;
        } else {
            console.error("Error fetching user data:", await response.text());
            return null;
        }
    } catch (error) {
        console.error("Error in getUserDetails:", error);
        return null;
    }
}

/**
 * Get the stored ID token for the current session
 * @returns {string|null} The ID token or null if not available
 */
export function getIdToken() {
    return userSessionData.idToken;
}

/**
 * Get the parsed ID token claims
 * @returns {Object|null} The parsed ID token claims or null if not available
 */
export function getIdTokenClaims() {
    if (!userSessionData.idToken) {
        return null;
    }

    try {
        // ID token is in format: header.payload.signature
        // We need to get the payload part (index 1)
        const tokenParts = userSessionData.idToken.split('.');
        if (tokenParts.length !== 3) {
            console.error("Invalid token format");
            return null;
        }

        // Base64 decode and parse the payload
        const payload = tokenParts[1];
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Error parsing ID token claims:", error);
        return null;
    }
}


/**
 * Displays account details in the console
 * @param {string} username - The username of the logged-in account
 */
function showWelcomeMessage(username) {
    const accounts = msalInstance.getAllAccounts();
    const account = accounts.find(acc => acc.username === username);

    if (account) {
        console.group('Account Details');
        console.log('👤 Username:', account.username);
        console.log('🏠 Home Account ID:', account.homeAccountId);
        console.log('🏢 Tenant ID:', account.tenantId);
        console.log('🔐 Local Account ID:', account.localAccountId);

        // Log additional claims if available
        if (account.idTokenClaims) {
            console.group('ID Token Claims');
            Object.entries(account.idTokenClaims).forEach(([key, value]) => {
                // Skip standard claims that are already logged
                if (!['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'aio'].includes(key)) {
                    console.log(`🔹 ${key}:`, value);
                }
            });
            console.groupEnd();
        }

        console.log('🔑 Scopes:', loginRequest.scopes);
        console.groupEnd();
    } else {
        console.warn('No account found for username:', username);
    }
}