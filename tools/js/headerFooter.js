/**
 * MoTools specific header and footer loader
 * Modified to correctly handle paths for tools directory structure
 */

// Inherit the original getRelativeTimeString function
function getRelativeTimeString(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const secondsAgo = Math.floor((now - date) / 1000);
    const minutesAgo = Math.floor(secondsAgo / 60);
    const hoursAgo = Math.floor(minutesAgo / 60);
    const daysAgo = Math.floor(hoursAgo / 24);

    if (secondsAgo < 60) return 'just now';
    if (minutesAgo < 60) return `${minutesAgo}m ago`;
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    if (daysAgo < 7) return `${daysAgo}d ago`;
    
    return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
}

async function loadHeaderFooter() {
    try {
        // Determine the correct paths based on the current location
        let headerPath, footerPath;
        
        if (window.location.pathname.includes('/tools/tuner/')) {
            // Inside tuner directory
            headerPath = '/header.html';
            footerPath = '/footer.html';
        } else if (window.location.pathname.includes('/tools/')) {
            // Inside tools directory but not in a subdirectory
            headerPath = '/header.html';
            footerPath = '/footer.html';
        } else {
            // Default to original behavior for other cases
            headerPath = window.location.pathname.includes('/pages/') ? '../header.html' : 'header.html';
            footerPath = window.location.pathname.includes('/pages/') ? '../footer.html' : 'footer.html';
        }

        const [headerResponse, footerResponse] = await Promise.all([fetch(headerPath), fetch(footerPath)]);

        if (!headerResponse.ok || !footerResponse.ok) {
            console.error('Failed to load header or footer');
            return;
        }

        const [headerContent, footerContent] = await Promise.all([headerResponse.text(), footerResponse.text()]);

        document.getElementById('footer-placeholder').innerHTML = footerContent;
        
        // Only override the header if we're not already using the MoTools header
        if (!document.querySelector('header.motools-header')) {
            document.getElementById('header-placeholder').innerHTML = headerContent;
        }

        // Rest of original function for handling mobile menu, authentication, etc.
        // ...
    } catch (error) {
        console.error('Error loading header and footer:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadHeaderFooter);