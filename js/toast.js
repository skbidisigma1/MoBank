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

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');

        toast.addEventListener('animationend', function(e) {
            if (e.animationName === 'toast-slide-out') {
                toast.remove();
            }
        });
    }, 5000);
}
