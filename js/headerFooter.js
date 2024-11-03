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
        const nav = headerPlaceholder.querySelector('nav ul');

        console.log('mobileMenuToggle:', mobileMenuToggle);
        console.log('nav:', nav);

        if (mobileMenuToggle && nav) {
            mobileMenuToggle.addEventListener('click', () => {
                console.log('Mobile menu toggle clicked');
                nav.classList.toggle('active');
                mobileMenuToggle.classList.toggle('active');
            });
        } else {
            console.error('Elements not found:', { mobileMenuToggle, nav });
        }

        const isAdmin = false;
        const adminLink = headerPlaceholder.querySelector('#admin-link');
        if (adminLink) {
            adminLink.style.display = isAdmin ? 'block' : 'none';
        }

    } catch (error) {
        console.error('Error loading header and footer:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadHeaderFooter);
