function showToast(title, message) {
    const toast = document.createElement('div');
    toast.className = 'toast';

    const content = document.createElement('div');
    content.className = 'toast-content';

    const toastTitle = document.createElement('div');
    toastTitle.className = 'toast-title';
    toastTitle.textContent = title || 'Achievement Get!';

    const toastMessage = document.createElement('div');
    toastMessage.className = 'toast-message';
    toastMessage.textContent = message || 'Action Completed!';

    content.appendChild(toastTitle);
    content.appendChild(toastMessage);

    toast.appendChild(content);

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

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

            toastElement.addEventListener('animationend', function animationEndHandler(e) {
                if (e.animationName === 'toast-slide-out') {
                    toastElement.remove();
                    toastElement.removeEventListener('animationend', animationEndHandler);
                }
            });
        }
    }
}
