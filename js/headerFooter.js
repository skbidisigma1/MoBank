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

        const headerPlaceholder = document.getElementById('header-placeholder');
        const mobileMenuToggle = headerPlaceholder.querySelector('#mobileMenuToggle');
        const mobileNav = headerPlaceholder.querySelector('.mobile-nav');

        if (mobileMenuToggle && mobileNav) {
            mobileMenuToggle.addEventListener('click', () => {
                const isActive = mobileNav.classList.toggle('active');
                mobileMenuToggle.classList.toggle('active');
                mobileMenuToggle.setAttribute('aria-expanded', isActive);
            });
        }

        const profilePicElement = document.getElementById('profile-pic');
        const placeholderPath = '/images/default_profile.svg';

        await window.auth0Promise;

        const user = await getUser();
        const roles = user && user['https://mo-bank.vercel.app/roles'] || [];
        const isAdmin = roles.includes('admin');
        const isLoggedIn = await isAuthenticated();

        const adminLink = headerPlaceholder.querySelector('#admin-link');
        const adminLinkMobile = headerPlaceholder.querySelector('#admin-link-mobile');
        if (adminLink) adminLink.style.display = isAdmin ? 'block' : 'none';
        if (adminLinkMobile) adminLinkMobile.style.display = isAdmin ? 'block' : 'none';

        const authLink = headerPlaceholder.querySelector('#auth-link');
        const authLinkMobile = headerPlaceholder.querySelector('#auth-link-mobile');
        const dashboardLink = headerPlaceholder.querySelector('#dashboard-link');
        const dashboardLinkMobile = headerPlaceholder.querySelector('#dashboard-link-mobile');

        if (isLoggedIn) {
            if (authLink) {
                authLink.textContent = 'Logout';
                authLink.href = '#';
                authLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    sessionStorage.clear();
                    logoutUser();
                });
            }
            if (authLinkMobile) {
                authLinkMobile.textContent = 'Logout';
                authLinkMobile.href = '#';
                authLinkMobile.addEventListener('click', (e) => {
                    e.preventDefault();
                    sessionStorage.clear();
                    logoutUser();
                });
            }

            if (user && user.picture) {
                profilePicElement.src = user.picture;
                sessionStorage.setItem('userData', JSON.stringify({ ...user, picture: user.picture }));
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
        }

        if (dashboardLink) {
            dashboardLink.addEventListener('click', (e) => {
                if (!isLoggedIn) {
                    e.preventDefault();
                    window.location.href = `/pages/login.html?redirect=/pages/dashboard.html`;
                }
            });
        }

        if (dashboardLinkMobile) {
            dashboardLinkMobile.addEventListener('click', (e) => {
                if (!isLoggedIn) {
                    e.preventDefault();
                    window.location.href = `/pages/login.html?redirect=/pages/dashboard.html`;
                }
            });
        }

        profilePicElement.addEventListener('click', () => {
            window.location.href = isLoggedIn ? '/pages/dashboard.html' : '/pages/login.html';
        });

    } catch (error) {
        console.error('Error loading header and footer:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadHeaderFooter);
