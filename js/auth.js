export let auth0Client = null;

export async function configureAuth0Client() {
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
    await auth0Client.logout({
        returnTo: window.location.origin
    });
}

export async function isAuthenticated() {
    return await auth0Client.isAuthenticated();
}

export async function getUser() {
    return await auth0Client.getUser();
}

export async function getToken() {
    return await auth0Client.getTokenSilently();
}

export async function checkSilentAuth() {
    try {
        const authenticated = await auth0Client.isAuthenticated();
        if (authenticated) {
            console.log("User is authenticated.");
            const user = await getUser();
            document.getElementById("login-status").textContent = `Welcome, ${user.name}!`;
        } else {
            console.log("User is not authenticated.");
        }
    } catch (error) {
        console.error("Silent Authentication Error:", error);
    }
}