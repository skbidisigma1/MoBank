document.addEventListener('DOMContentLoaded', () => {
    const words = ['Ease', 'Speed', 'Efficiency', 'Trust', 'Confidence'];
    let wordIndex = 0, charIndex = 0, isDeleting = false;
    let typingSpeed = 100, delayAfterWord = 120, delayBeforeDelete = 1000;
    let chaosActivated = false;
    
    const typingElement = document.getElementById('typing-text');

    function typeEffect() {
        if (chaosActivated) return;
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
            typingSpeed = delayAfterWord;
        }

        setTimeout(typeEffect, typingSpeed);
    }
    
    if (typingElement) {
        typeEffect();
        typingElement.style.display = 'inline-block';
        typingElement.style.wordBreak = 'break-word';
        typingElement.style.whiteSpace = 'normal';
        typingElement.style.maxWidth = '100%';
    }

    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;
    
    function konamiHandler(e) {
        if (e.key.toLowerCase() === konamiCode[konamiIndex].toLowerCase()) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                activateChaosMode();
            }
        } else {
            konamiIndex = 0;
        }
    }

    document.removeEventListener('keydown', konamiHandler);
    document.addEventListener('keydown', konamiHandler);

    function activateChaosMode() {
        chaosActivated = true;
        
        if (typingElement) {
            typingElement.textContent = "";
            typingElement.style.display = 'inline-block';
        }

        function fillChaos() {
            if (!typingElement || !chaosActivated) return;

            const charSpan = document.createElement("span");
            charSpan.textContent = getRandomChar();
            
            charSpan.style.fontSize = `${getRandomSize()}px`;
            charSpan.style.fontFamily = getRandomFont();
            charSpan.style.color = getRandomColor();
            charSpan.style.fontWeight = Math.random() > 0.5 ? 'bold' : 'normal';
            charSpan.style.fontStyle = Math.random() > 0.5 ? 'italic' : 'normal';
            
            charSpan.style.textDecoration = getRandomTextDecoration();
            charSpan.style.textTransform = getRandomTextTransform();
            
            typingElement.appendChild(charSpan);
            
            if (typingElement.textContent.length % 100 === 0) {
                typingElement.appendChild(document.createElement("br"));
            }

            setTimeout(fillChaos, 10);
        }

        fillChaos();
    }

    function getRandomChar() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:',.<>?/`~";
        return chars.charAt(Math.floor(Math.random() * chars.length));
    }

    function getRandomSize() {
        return 14 + Math.floor(Math.random() * 6);
    }

    function getRandomFont() {
        const fonts = ['Poppins', 'Orbitron', 'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Tahoma', 'Comic Sans MS'];
        return fonts[Math.floor(Math.random() * fonts.length)];
    }

    function getRandomColor() {
        const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#33FFF5', '#F5FF33', '#FF8C33', '#8C33FF', '#33FF8C', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function getRandomTextDecoration() {
        const decorations = ['none', 'underline', 'line-through'];
        return decorations[Math.floor(Math.random() * decorations.length)];
    }

    function getRandomTextTransform() {
        const transforms = ['none', 'uppercase', 'lowercase', 'capitalize'];
        return transforms[Math.floor(Math.random() * transforms.length)];
    }
});