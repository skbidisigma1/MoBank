function showToast(title, message, type = 'default') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type) {
        toast.classList.add(type);
    }

    const content = document.createElement('div');
    content.className = 'toast-content';

    const toastTitle = document.createElement('div');
    toastTitle.className = 'toast-title';
    toastTitle.textContent = title || 'Notification';

    const toastMessage = document.createElement('div');
    toastMessage.className = 'toast-message';
    toastMessage.textContent = message || '';

    content.appendChild(toastTitle);
    content.appendChild(toastMessage);
    toast.appendChild(content);
    document.body.appendChild(toast);

    // Remove any existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach((existing, index) => {
        if (existing !== toast) {
            existing.classList.add('hide');
            setTimeout(() => existing.remove(), 300);
        }
    });

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    toast.addEventListener('click', () => {
        hideToast(toast);
    });

    const autoHideTimeout = setTimeout(() => {
        hideToast(toast);
    }, 5000);

    function hideToast(toastElement) {
        clearTimeout(autoHideTimeout);
        if (!toastElement.classList.contains('hide')) {
            toastElement.classList.remove('show');
            toastElement.classList.add('hide');
            toastElement.addEventListener('animationend', function handler(e) {
                if (e.animationName === 'toast-slide-out') {
                    toastElement.remove();
                    toastElement.removeEventListener('animationend', handler);
                }
            });
        }
    }
}
