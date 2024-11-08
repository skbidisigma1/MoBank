async function loadHeaderFooter() {
    try {
        const headerPath = window.location.pathname.includes('/pages/') ? '../header.html' : 'header.html';
        const footerPath = window.location.pathname.includes('/pages/') ? '../footer.html' : 'footer.html';

        const headerResponse = await fetch(headerPath);
        const footerResponse = await fetch(footerPath);

        if (!headerResponse.ok || !footerResponse.ok) {
            throw new Error('Failed to load header or footer');
        }

        const headerContent = await headerResponse.text();
        const footerContent = await footerResponse.text();

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

        const isAdmin = false;
        const adminLink = headerPlaceholder.querySelector('#admin-link');
        const adminLinkMobile = headerPlaceholder.querySelector('#admin-link-mobile');

        if (adminLink) {
            adminLink.style.display = isAdmin ? 'block' : 'none';
        }
        if (adminLinkMobile) {
            adminLinkMobile.style.display = isAdmin ? 'block' : 'none';
        }

    } catch (error) {
        console.error('Error loading header and footer:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadHeaderFooter);