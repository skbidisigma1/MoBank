async function loadToolsHeaderFooter() {
    try {
        const headerPath = '/tools/tools-header.html';
        const footerPath = '/footer.html';

        const [headerResponse, footerResponse] = await Promise.all([fetch(headerPath), fetch(footerPath)]);

        if (!headerResponse.ok || !footerResponse.ok) return;

        const [headerContent, footerContent] = await Promise.all([headerResponse.text(), footerResponse.text()]);

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

        try {
            await window.auth0Promise;
            const isLoggedIn = await isAuthenticated();
            const profilePicElement = document.getElementById('profile-pic');
            const authLink = headerPlaceholder.querySelector('#auth-link');
            const authLinkMobile = headerPlaceholder.querySelector('#auth-link-mobile');
            
            if (profilePicElement) {
                if (isLoggedIn) {
                    const user = await getUser();
                    if (user && user.picture) {
                        profilePicElement.src = user.picture;
                    }
                }

                profilePicElement.addEventListener('click', () => {
                    window.location.href = isLoggedIn ? '/dashboard' : '/login';
                });
            }
            
            if (isLoggedIn) {
                if (authLink) {
                    authLink.style.display = 'block';
                    authLink.textContent = 'Logout';
                    authLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        sessionStorage.clear();
                        logoutUser();
                    });
                }
                
                if (authLinkMobile) {
                    authLinkMobile.style.display = 'block';
                    authLinkMobile.textContent = 'Logout';
                    authLinkMobile.addEventListener('click', (e) => {
                        e.preventDefault();
                        sessionStorage.clear();
                        logoutUser();
                    });
                }
            }
        } catch (authError) {
            console.error('Auth error:', authError);
        }

    } catch (error) {
        console.error('Error loading header and footer:', error);
        
        const headerPlaceholder = document.getElementById('header-placeholder');
        if (headerPlaceholder) {
            const backupHeader = document.createElement('header');
            const headerTitle = document.createElement('h1');
            headerTitle.textContent = 'MoTools';
            
            const nav = document.createElement('nav');
            const navList = document.createElement('ul');
            navList.className = 'nav-links';
            
            const homeItem = document.createElement('li');
            const homeLink = document.createElement('a');
            homeLink.href = '/tools';
            homeLink.textContent = 'Home';
            homeItem.appendChild(homeLink);
            
            const bankItem = document.createElement('li');
            const bankLink = document.createElement('a');
            bankLink.href = '/';
            bankLink.textContent = 'MoBank';
            bankItem.appendChild(bankLink);
            
            navList.appendChild(homeItem);
            navList.appendChild(bankItem);
            nav.appendChild(navList);
            
            backupHeader.appendChild(headerTitle);
            backupHeader.appendChild(nav);
            
            headerPlaceholder.innerHTML = '';
            headerPlaceholder.appendChild(backupHeader);
        }
        
        const footerPlaceholder = document.getElementById('footer-placeholder');
        if (footerPlaceholder) {
            const backupFooter = document.createElement('footer');
            backupFooter.className = 'site-footer';
            
            const footerContainer = document.createElement('div');
            footerContainer.className = 'footer-container';
            
            const footerContent = document.createElement('div');
            footerContent.className = 'footer-content';
            
            const copyright = document.createElement('span');
            copyright.className = 'copyright';
            copyright.textContent = '© 2025 Sigma Boys. All rights reserved.';
            
            footerContent.appendChild(copyright);
            footerContainer.appendChild(footerContent);
            backupFooter.appendChild(footerContainer);
            
            footerPlaceholder.innerHTML = '';
            footerPlaceholder.appendChild(backupFooter);
        }
    }
}

document.addEventListener('DOMContentLoaded', loadToolsHeaderFooter);