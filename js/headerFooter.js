async function loadHeaderFooter() {
    try {
        const headerPath = window.location.pathname.includes('/pages/') ? '../header.html' : 'header.html';
        const footerPath = window.location.pathname.includes('/pages/') ? '../footer.html' : 'footer.html';

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

        await window.auth0Promise;

        const user = await getUser();
        const roles = user && user['https://mo-classroom.us/roles'] || [];
        const isAdmin = roles.includes('admin');
        const isLoggedIn = await isAuthenticated();

        const adminLink = headerPlaceholder.querySelector('#admin-link');
        const adminLinkMobile = headerPlaceholder.querySelector('#admin-link-mobile');
        if (adminLink) adminLink.style.display = isAdmin ? 'block' : 'none';
        if (adminLinkMobile) adminLinkMobile.style.display = isAdmin ? 'block' : 'none';

        const leaderboardLink = headerPlaceholder.querySelector('#leaderboard-link');
        const leaderboardLinkMobile = headerPlaceholder.querySelector('#leaderboard-link-mobile');

        if (leaderboardLink) leaderboardLink.style.display = isLoggedIn ? 'block' : 'none';
        if (leaderboardLinkMobile) leaderboardLinkMobile.style.display = isLoggedIn ? 'block' : 'none';

        const authLink = headerPlaceholder.querySelector('#auth-link');
        const authLinkMobile = headerPlaceholder.querySelector('#auth-link-mobile');
        const dashboardLink = headerPlaceholder.querySelector('#dashboard-link');
        const dashboardLinkMobile = headerPlaceholder.querySelector('#dashboard-link-mobile');

        function getCachedUserData() {
            const cached = localStorage.getItem('userData');
            const USER_DATA_COOLDOWN_MILLISECONDS = 20 * 1000; // 20 seconds
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < USER_DATA_COOLDOWN_MILLISECONDS) {
                    return parsed.data;
                }
            }
            return null;
        }

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
                authLink.href = 'login';
            }
            if (authLinkMobile) {
                authLinkMobile.textContent = 'Login';
                authLinkMobile.href = 'login';
            }
        }

        if (dashboardLink) {
            dashboardLink.addEventListener('click', (e) => {
                if (!isLoggedIn) {
                    e.preventDefault();
                    window.location.href = `login?redirect=dashboard`;
                }
            });
        }

        if (dashboardLinkMobile) {
            dashboardLinkMobile.addEventListener('click', (e) => {
                if (!isLoggedIn) {
                    e.preventDefault();
                    window.location.href = `login?redirect=dashboard`;
                }
            });
        }

        if (leaderboardLink) {
            leaderboardLink.addEventListener('click', (e) => {
                if (!isLoggedIn) {
                    e.preventDefault();
                    window.location.href = `login?redirect=leaderboard`;
                }
            });
        }

        if (leaderboardLinkMobile) {
            leaderboardLinkMobile.addEventListener('click', (e) => {
                if (!isLoggedIn) {
                    e.preventDefault();
                    window.location.href = `login?redirect=leaderboard`;
                }
            });
        }

        profilePicElement.addEventListener('click', () => {
            window.location.href = isLoggedIn ? 'dashboard' : 'login';
        });

        const notifIcon = document.getElementById('notification-icon');
        const notifDropdown = document.getElementById('notification-dropdown');
        const notifCount = document.getElementById('notification-count');
        let notifications = [];

        function updateNotificationsUI() {
            if (notifications.length > 0) {
                notifCount.textContent = notifications.length;
                notifCount.style.display = '';
                notifCount.classList.remove('hidden');

                notifDropdown.innerHTML = `
                    <div class="notification-header">
                        <h4>Notifications (${notifications.length})</h4>
                        <button class="notification-clear">Clear all</button>
                    </div>
                `;
                
                notifications.forEach((notification, index) => {
                    const notifItem = document.createElement('div');
                    notifItem.className = 'notification-item';
                    if (index < 3) {
                        notifItem.classList.add('unread');
                    }
                    
                    const message = document.createElement('div');
                    message.textContent = notification;
                    
                    const time = document.createElement('span');
                    time.className = 'notification-time';
                    // Generate a random recent time for demo purposes
                    const randomTime = new Date();
                    randomTime.setMinutes(randomTime.getMinutes() - Math.floor(Math.random() * 60));
                    time.textContent = randomTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    
                    notifItem.appendChild(message);
                    notifItem.appendChild(time);
                    notifDropdown.appendChild(notifItem);
                });

                const clearBtn = notifDropdown.querySelector('.notification-clear');
                if (clearBtn) {
                    clearBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        notifications = [];
                        updateNotificationsUI();
                    });
                }
            } else {
                notifCount.textContent = '0';
                notifCount.style.display = 'none';
                notifCount.classList.add('hidden');
                notifDropdown.innerHTML = '<p class="notification-empty">No new notifications</p>';
            }
        }

        function handleNotificationToggle(e) {
            e.preventDefault();
            e.stopPropagation();
            notifDropdown.classList.toggle('hidden');
            notifIcon.classList.toggle('active');
        }

        if (notifIcon) {
            notifIcon.addEventListener('touchstart', handleNotificationToggle, {passive: false});
            notifIcon.addEventListener('click', handleNotificationToggle);
            
            if (notifCount) {
                notifCount.classList.add('hidden');
                notifCount.style.display = 'none';
                notifCount.addEventListener('touchstart', handleNotificationToggle, {passive: false});
                notifCount.addEventListener('click', handleNotificationToggle);
            }

            notifIcon.classList.remove('hidden');
            
            document.addEventListener('click', (e) => {
                if (e.target !== notifIcon && e.target !== notifCount && !notifDropdown.contains(e.target)) {
                    notifDropdown.classList.add('hidden');
                    notifIcon.classList.remove('active');
                }
            });

            document.addEventListener('touchstart', (e) => {
                if (e.target !== notifIcon && e.target !== notifCount && !notifDropdown.contains(e.target)) {
                    notifDropdown.classList.add('hidden');
                    notifIcon.classList.remove('active');
                }
            }, {passive: true});

            updateNotificationsFromUserData();
        }

        function updateNotificationsFromUserData() {
            if (isAuthenticated()) {
                const userData = getCachedUserData();

                if (userData && userData.notifications && Array.isArray(userData.notifications)) {
                    const unreadNotifications = userData.notifications.filter(n => !n.read);

                    notifications = unreadNotifications.map(n => n.message || n.text || "New notification");
                    
                    updateNotificationsUI();
                } else {
                    notifCount.style.display = 'none';
                    notifCount.classList.add('hidden');
                }
            } else {
                notifCount.style.display = 'none';
                notifCount.classList.add('hidden');
            }
        }

    } catch (error) {
        console.error('Error loading header and footer:', error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    manifestLink.href = "/manifest.json";
    document.head.appendChild(manifestLink);
  }
});


document.addEventListener('DOMContentLoaded', loadHeaderFooter);

