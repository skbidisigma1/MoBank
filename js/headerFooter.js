async function loadHeaderFooter() {
    try {
        const headerPath = window.location.pathname.includes('/pages/') ? '../header.html' : 'header.html';
        const footerPath = window.location.pathname.includes('/pages/') ? '../footer.html' : 'footer.html';

        const [headerResponse, footerResponse] = await Promise.all([
            fetch(headerPath),
            fetch(footerPath)
        ]);

        if (!headerResponse.ok || !footerResponse.ok) return;

        const [headerContent, footerContent] = await Promise.all([
            headerResponse.text(),
            footerResponse.text()
        ]);

        document.getElementById('header-placeholder').innerHTML = headerContent;
        document.getElementById('footer-placeholder').innerHTML = footerContent;

        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileNav = document.querySelector('.mobile-nav');

        if (mobileMenuToggle && mobileNav) {
            mobileMenuToggle.addEventListener('click', () => {
                mobileNav.classList.toggle('active');
                mobileMenuToggle.classList.toggle('active');
            });
        }

        const profilePicElement = document.getElementById('profile-pic');
        const cachedUserData = JSON.parse(localStorage.getItem('userData'));

        if (cachedUserData && cachedUserData.picture) {
            profilePicElement.src = cachedUserData.picture;
        } else {
            profilePicElement.src = 'images/default_profile.svg';
        }

        await window.auth0Promise;

        const user = await getUser();
        const roles = user && user['https://mo-bank.vercel.app/roles'] || [];
        const isAdmin = roles.includes('admin');

        updateNavigation(user, isAdmin);

        if (user && user.picture) {
            profilePicElement.src = user.picture;
            localStorage.setItem('userData', JSON.stringify({ picture: user.picture }));
        }
    } catch (error) {
        console.error('Error loading header and footer:', error);
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