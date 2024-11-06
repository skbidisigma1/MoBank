import { createAuth0Client } from '@auth0/auth0-spa-js';

let auth0Client = null;

async function configureAuth0Client() {
    auth0Client = await createAuth0Client({
        domain: "dev-nqdfwemz14t8nf7w.us.auth0.com",
        client_id: "IJVNKTUu7mlBsvxDhdNNYOOtTXfFOtqA",
        redirect_uri: window.location.origin
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
            window.history.replaceState({}, document.title, "/");
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

document.addEventListener('DOMContentLoaded', async () => {
    await configureAuth0Client();
    await handleAuthRedirect();
});
