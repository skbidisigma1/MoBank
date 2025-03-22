document.addEventListener('DOMContentLoaded', () => {

    const words = ['Ease', 'Speed', 'Efficiency', 'Trust', 'Confidence'];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;
    let delayAfterWord = 2000;
    let delayBeforeDelete = 1000;

    const typingElement = document.getElementById('typing-text');

    function typeEffect() {
        const currentWord = words[wordIndex];

        if (isDeleting) {
            typingElement.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
            typingSpeed = 80;
        } else {
            typingElement.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
            typingSpeed = 120;
        }

        if (!isDeleting && charIndex === currentWord.length) {
            isDeleting = true;
            typingSpeed = delayBeforeDelete;
        }

        if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            typingSpeed = delayAfterWord / 10;
        }

        setTimeout(typeEffect, typingSpeed);
    }

    typeEffect();
});