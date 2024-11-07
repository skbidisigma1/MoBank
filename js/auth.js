let auth0Client = null;

async function configureAuth0Client() {
    auth0Client = await createAuth0Client({
        domain: "dev-nqdfwemz14t8nf7w.us.auth0.com",
        client_id: "IJVNKTUu7mlBsvxDhdNNYOOtTXfFOtqA",
        redirect_uri: "https://mo-bank.vercel.app/pages/dashboard.html",
        cacheLocation: 'localstorage',
        useRefreshTokens: true
    });
}

export async function signInWithAuth0() {
    try {
        await auth0Client.loginWithRedirect({
            connection: 'google-oauth2'
        });
    } catch (error) {
        console.error("Auth0 Login Error:", error);
    }
}

export async function handleAuthRedirect() {
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
        try {
            await auth0Client.handleRedirectCallback();
            window.history.replaceState({}, document.title, "/pages/dashboard.html");
        } catch (error) {
            console.error("Auth0 Callback Error:", error);
        }
    }
}

export async function logoutUser() {
    try {
        await auth0Client.logout({
            returnTo: window.location.origin
        });
    } catch (error) {
        console.error("Auth0 Logout Error:", error);
    }
}

export async function isAuthenticated() {
    try {
        return await auth0Client.isAuthenticated();
    } catch (error) {
        console.error("Auth0 isAuthenticated Error:", error);
        return false;
    }
}

export async function getUser() {
    try {
        return await auth0Client.getUser();
    } catch (error) {
        console.error("Auth0 getUser Error:", error);
        return null;
    }
}

export async function getToken() {
    try {
        return await auth0Client.getTokenSilently();
    } catch (error) {
        console.error("Auth0 getTokenSilently Error:", error);
        return null;
    }
}

export async function checkSilentAuth() {
    try {
        const authenticated = await isAuthenticated();
        if (authenticated) {
            console.log("User is authenticated.");
            const user = await getUser();
            document.getElementById("login-status").innerText = `Welcome, ${user.name}!`;
        } else {
            console.log("User is not authenticated.");
        }
    } catch (error) {
        console.error("Silent Authentication Error:", error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await configureAuth0Client();
    await handleAuthRedirect();
    await checkSilentAuth();
});