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

        const profilePicElement = document.getElementById('profile-pic');
        if (profilePicElement) {
            try {
                await window.auth0Promise;
                const isLoggedIn = await isAuthenticated();
                
                if (isLoggedIn) {
                    try {
                        const user = await getUser();
                        if (user && user.picture) {
                            profilePicElement.src = user.picture;
                        }
                    } catch (profileError) {
                        console.error('Error getting user profile:', profileError);
                    }
                }

                profilePicElement.addEventListener('click', () => {
                    window.location.href = isLoggedIn ? '/dashboard' : '/login';
                });
            } catch (authError) {
                console.error('Auth error:', authError);
                profilePicElement.addEventListener('click', () => {
                    window.location.href = '/login';
                });
            }
        }

    } catch (error) {
        console.error('Error loading header and footer:', error);
        
        const headerPlaceholder = document.getElementById('header-placeholder');
        if (headerPlaceholder) {
            const backupHeader = `
            <header>
                <h1>MoTools</h1>
                <nav>
                    <ul class="nav-links">
                        <li><a href="/tools">Home</a></li>
                        <li><a href="/">MoBank</a></li>
                    </ul>
                </nav>
            </header>`;
            headerPlaceholder.innerHTML = backupHeader;
        }
        
        const footerPlaceholder = document.getElementById('footer-placeholder');
        if (footerPlaceholder) {
            const backupFooter = `
            <footer class="site-footer">
                <div class="footer-container">
                    <div class="footer-content">
                        <span class="copyright">&copy; 2025 Sigma Boys. All rights reserved.</span>
                    </div>
                </div>
            </footer>`;
            footerPlaceholder.innerHTML = backupFooter;
        }
    }
}

document.addEventListener('DOMContentLoaded', loadToolsHeaderFooter);