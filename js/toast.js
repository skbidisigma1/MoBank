function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message || 'Action Completed!';
    
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
