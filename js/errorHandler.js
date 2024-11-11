function createPopup(message) {
    const popup = document.createElement('div');
    popup.className = 'error-popup';
    popup.textContent = message;

    popup.style.position = 'fixed';
    popup.style.top = '20px';
    popup.style.right = '20px';
    popup.style.padding = '15px';
    popup.style.backgroundColor = '#ff4c4c';
    popup.style.color = '#fff';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    popup.style.zIndex = '1000';
    popup.style.fontFamily = 'Arial, sans-serif';
    popup.style.fontSize = '16px';
    popup.style.transition = 'opacity 0.5s';

    document.body.appendChild(popup);

    setTimeout(() => {
        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 500);
    }, 5000);
}

export function handleError(errorType, details) {
    console.error(`${errorType}:`, details);

    let message;
    switch (errorType) {
        case 'TokenError':
            message = 'Your session has expired. Please log in again.';
            break;
        case 'NetworkError':
            message = 'Unable to connect. Please check your internet connection.';
            break;
        case 'AuthRedirectError':
            message = 'An issue occurred during login. Please try again.';
            break;
        case 'RateLimitError':
            message = 'Too many requests. Please wait and try again.';
            break;
        case 'InvalidDataError':
            message = 'Invalid input. Please check your data and try again.';
            break;
        case 'UnauthorizedError':
            message = 'You do not have permission to perform this action.';
            break;
        case 'ParseError':
            message = 'An error occurred loading data. Please refresh the page.';
            break;
        case 'LogoutError':
            message = 'An issue occurred while logging out. Please try again.';
            break;
        case 'Auth0ClientError':
            message = 'Authentication setup issue. Please contact support.';
            break;
        case 'AuthError':
            message = 'An issue occurred during login. Please try again.';
            break;
        default:
            message = 'An unexpected error occurred. Please try again.';
            break;
    }

    createPopup(message);
}
