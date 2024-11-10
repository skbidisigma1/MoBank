async function loadHeaderFooter(retry = 3) {
    try {
        const headerPath = window.location.pathname.includes('/pages/') ? '../header.html' : 'header.html';
        const footerPath = window.location.pathname.includes('/pages/') ? '../footer.html' : 'footer.html';

        const [headerResponse, footerResponse] = await Promise.all([
            fetch(headerPath),
            fetch(footerPath)
        ]);

        if (!headerResponse.ok || !footerResponse.ok) throw new Error("Header or footer fetch failed");

        const [headerContent, footerContent] = await Promise.all([
            headerResponse.text(),
            footerResponse.text()
        ]);

        document.getElementById('header-placeholder').innerHTML = headerContent;
        document.getElementById('footer-placeholder').innerHTML = footerContent;

        const headerPlaceholder = document.getElementById('header-placeholder');
        const mobileMenuToggle = headerPlaceholder.querySelector('#mobileMenuToggle');
        const mobileNav = headerPlaceholder.querySelector('.mobile-nav');

        if (mobileMenuToggle && mobileNav) {
            mobileMenuToggle.addEventListener('click', () => {
                mobileNav.classList.toggle('active');
                mobileMenuToggle.classList.toggle('active');
            });
        }

        const profilePicElement = document.getElementById('profile-pic');
        const cachedUserData = JSON.parse(localStorage.getItem('userData'));

        if (profilePicElement) {
            profilePicElement.src = cachedUserData && cachedUserData.picture
                ? cachedUserData.picture
                : 'images/default_profile.svg';
        }

        await window.auth0Promise;

        const user = await getUser();
        const roles = user && user['https://mo-bank.vercel.app/roles'] || [];
        const isAdmin = roles.includes('admin');

        updateNavigation(user, isAdmin);

        if (user && user.picture && profilePicElement) {
            profilePicElement.src = user.picture;
            localStorage.setItem('userData', JSON.stringify({ picture: user.picture }));
        }
    } catch (error) {
        if (retry > 0) {
            console.error('Retrying loadHeaderFooter due to error:', error);
            loadHeaderFooter(retry - 1);
        } else {
            console.error('Failed to load header and footer:', error);
        }
    }
}

function updateNavigation(user, isAdmin) {
    const authLink = document.querySelector('#auth-link');
    const authLinkMobile = document.querySelector('#auth-link-mobile');
    const adminLink = document.querySelector('#admin-link');
    const adminLinkMobile = document.querySelector('#admin-link-mobile');

    if (user) {
        if (authLink) {
            authLink.textContent = 'Logout';
            authLink.href = '#';
            authLink.onclick = (e) => {
                e.preventDefault();
                logoutUser();
            };
        }
        if (authLinkMobile) {
            authLinkMobile.textContent = 'Logout';
            authLinkMobile.href = '#';
            authLinkMobile.onclick = (e) => {
                e.preventDefault();
                logoutUser();
            };
        }
        if (isAdmin) {
            if (adminLink) adminLink.style.display = 'block';
            if (adminLinkMobile) adminLinkMobile.style.display = 'block';
        }
    } else {
        if (authLink) {
            authLink.textContent = 'Login';
            authLink.href = '/pages/login.html';
        }
        if (authLinkMobile) {
            authLinkMobile.textContent = 'Login';
            authLinkMobile.href = '/pages/login.html';
        }
        if (adminLink) adminLink.style.display = 'none';
        if (adminLinkMobile) adminLinkMobile.style.display = 'none';
    }
}

async function logoutUser() {
    try {
        await auth0Client.logout({
            logoutParams: {
                returnTo: window.location.origin
            },
            federated: false
        });
        localStorage.removeItem('userData');
        sessionStorage.clear();
        window.location.reload();
    } catch (error) {
        console.error('Auth0 Logout Error:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadHeaderFooter);