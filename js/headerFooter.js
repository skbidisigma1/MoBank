import { displayUserProfile } from './auth.js';

async function loadHeaderFooter() {
    try {
        const headerResponse = await fetch('/header.html');
        const footerResponse = await fetch('/footer.html');

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

        const isAdmin = true;
        const adminLink = headerPlaceholder.querySelector('#admin-link');
        const adminLinkMobile = headerPlaceholder.querySelector('#admin-link-mobile');

        if (adminLink) {
            adminLink.style.display = isAdmin ? 'block' : 'none';
        }
        if (adminLinkMobile) {
            adminLinkMobile.style.display = isAdmin ? 'block' : 'none';
        }

        await window.displayUserProfile();

    } catch (error) {
        console.error('Error loading header and footer:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadHeaderFooter);