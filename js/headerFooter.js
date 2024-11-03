async function loadHeaderFooter() {
    try {
        const headerResponse = await fetch('./header.html');
        const footerResponse = await fetch('./footer.html');


        if (!headerResponse.ok || !footerResponse.ok) {
            throw new Error('Failed to load header or footer');
        }

        const headerContent = await headerResponse.text();
        const footerContent = await footerResponse.text();

        document.getElementById('header-placeholder').innerHTML = headerContent;
        document.getElementById('footer-placeholder').innerHTML = footerContent;

        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const nav = document.querySelector('nav ul');

        if (mobileMenuToggle && nav) {
            mobileMenuToggle.addEventListener('click', () => {
                nav.classList.toggle('active');
                mobileMenuToggle.classList.toggle('active');
            });
        }

        const isAdmin = false;
        const adminLink = document.getElementById('admin-link');Q
        if (adminLink) {
            adminLink.style.display = isAdmin ? 'block' : 'none';
        }

    } catch (error) {
        console.error('Error loading header and footer:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadHeaderFooter);
