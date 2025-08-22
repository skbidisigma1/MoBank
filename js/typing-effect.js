document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = {
        words: ['Ease', 'Efficiency', 'Trust', 'Confidence', 'MoBank'],
        timing: {
            typeSpeed: 130,
            deleteSpeed: 90,
            delayBeforeDelete: 1100,
            delayAfterWord: 130,
            chaosInterval: 5
        },
        chaos: {
            fonts: ['Poppins', 'Orbitron', 'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Tahoma', 'Comic Sans MS'],
            colors: ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#33FFF5', '#F5FF33', '#FF8C33', '#8C33FF', '#33FF8C', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'],
            chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:',.<>?/`~",
            sizeRange: { min: 14, max: 20 }
        },
        effects: {
            glowColors: ['#0066cc', '#00b894', '#ff8e6bff', '#f5f845ff']
        },
        konamiCode: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
        morseCode: ['...', '---', '...'],
        spacebarClicks: 3
    };

    let state = {
        wordIndex: 0,
        charIndex: 0,
        isDeleting: false,
        chaosActivated: false,
        konamiIndex: 0,
        morseIndex: 0,
        currentGlowIndex: 0,
        glowInterval: null,
        spacebarCount: 0,
        lastSpacebarTime: 0
    };

    const typingElement = document.getElementById('typing-text');
    const typingShell = typingElement?.closest('.typing-shell');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function startGlowEffect() {
        if (state.glowInterval) return;
        
        const glowColors = CONFIG.effects.glowColors;
        state.glowInterval = setInterval(() => {
            if (!typingElement) return;
            state.currentGlowIndex = (state.currentGlowIndex + 1) % glowColors.length;
            typingElement.style.textShadow = `0 0 10px ${glowColors[state.currentGlowIndex]}40`;
        }, 2000);
    }

    function typeEffect() {
        if (state.chaosActivated) return;
        
        const currentWord = CONFIG.words[state.wordIndex];
        const { timing } = CONFIG;

        if (state.isDeleting) {
            typingElement.textContent = currentWord.substring(0, state.charIndex - 1);
            state.charIndex--;
        } else {
            typingElement.textContent = currentWord.substring(0, state.charIndex + 1);
            state.charIndex++;
        }

        typingElement.setAttribute('aria-label', `Currently typing: ${typingElement.textContent}`);

        let nextTimeout = state.isDeleting ? timing.deleteSpeed : timing.typeSpeed;

        if (!state.isDeleting && state.charIndex === currentWord.length) {
            state.isDeleting = true;
            nextTimeout = timing.delayBeforeDelete;
        } else if (state.isDeleting && state.charIndex === 0) {
            state.isDeleting = false;
            state.wordIndex = (state.wordIndex + 1) % CONFIG.words.length;
            nextTimeout = timing.delayAfterWord;
        }

        const timeoutId = setTimeout(() => {
            requestAnimationFrame(typeEffect);
        }, prefersReducedMotion ? nextTimeout * 1.5 : nextTimeout);

        typingElement.dataset.timeoutId = timeoutId;
    }

    // CLS fix
    if (typingElement) {
        if (typingShell) {
            const placeholder = typingShell.querySelector('.typing-placeholder');
            if (placeholder) {
                let longest = placeholder.textContent || '';
                for (const w of CONFIG.words) if (w.length > longest.length) longest = w;
                placeholder.textContent = longest;
            }
        }
        typingElement.setAttribute('role', 'text');
        typingElement.setAttribute('aria-live', 'polite');
        
        Object.assign(typingElement.style, {
            display: 'inline-block',
            whiteSpace: 'nowrap',
            wordBreak: 'normal',
            overflow: 'visible',
            transition: 'text-shadow 0.5s ease'
        });

    typingElement.style.padding = '0 5px';
        typeEffect();
        startGlowEffect();
    }

    function konamiHandler(e) {
        if (e.key.toLowerCase() === CONFIG.konamiCode[state.konamiIndex].toLowerCase()) {
            state.konamiIndex++;
            if (!prefersReducedMotion) {
                typingElement.style.transform = 'scale(1.05)';
                setTimeout(() => typingElement.style.transform = '', 200);
            }
            if (state.konamiIndex === CONFIG.konamiCode.length) {
                activateChaosMode();
            }
        } else if (e.key === ' ') {
            const currentTime = Date.now();
            if (currentTime - state.lastSpacebarTime > 1000) {
                state.spacebarCount = 1;
            } else {
                state.spacebarCount++;
            }
            state.lastSpacebarTime = currentTime;
            
            if (state.spacebarCount === CONFIG.spacebarClicks) {
                state.spacebarCount = 0;
                handleMorseCode();
            }
        } else {
            state.konamiIndex = 0;
        }
    }

    // shout out to claude for this easter egg it's soooo cool not boring at all
    function handleMorseCode() {
        if (state.morseIndex >= CONFIG.morseCode.length) {
            state.morseIndex = 0;
            return;
        }

        const morsePattern = CONFIG.morseCode[state.morseIndex];
        let patternIndex = 0;

        function flashText() {
            if (patternIndex >= morsePattern.length) {
                state.morseIndex++;
                return;
            }

            if (morsePattern[patternIndex] === '.') {
                typingElement.style.opacity = '0';
                setTimeout(() => typingElement.style.opacity = '1', 100);
            } else {
                typingElement.style.opacity = '0';
                setTimeout(() => typingElement.style.opacity = '1', 300);
            }

            patternIndex++;
            setTimeout(flashText, 400);
        }

        flashText();
    }

    document.removeEventListener('keydown', konamiHandler);
    document.addEventListener('keydown', konamiHandler);

    function activateChaosMode() {
        if (!typingElement || state.chaosActivated) return;
        
        state.chaosActivated = true;
        typingElement.textContent = "";
        typingElement.style.overflowWrap = "break-word";
        typingElement.style.whiteSpace = "normal";
        typingElement.style.width = "50rem";

        const fragment = document.createDocumentFragment();
        const { chaos } = CONFIG;

        function getRandomFromArray(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }

        function createChaosChar() {
            const span = document.createElement("span");
            span.textContent = chaos.chars.charAt(Math.floor(Math.random() * chaos.chars.length));
            
            Object.assign(span.style, {
                fontSize: `${chaos.sizeRange.min + Math.floor(Math.random() * (chaos.sizeRange.max - chaos.sizeRange.min))}px`,
                fontFamily: getRandomFromArray(chaos.fonts),
                color: getRandomFromArray(chaos.colors),
                fontWeight: Math.random() > 0.5 ? 'bold' : 'normal',
                fontStyle: Math.random() > 0.5 ? 'italic' : 'normal',
                textDecoration: getRandomFromArray(['none', 'underline', 'line-through']),
                textTransform: getRandomFromArray(['none', 'uppercase', 'lowercase', 'capitalize']),
                transition: 'transform 0.3s ease',
                display: 'inline-block'
            });

            span.addEventListener('mouseover', () => {
                if (!prefersReducedMotion) {
                    span.style.transform = `rotate(${Math.random() * 360}deg) scale(1.2)`;
                }
            });
            span.addEventListener('mouseout', () => {
                span.style.transform = '';
            });

            return span;
        }

        function fillChaos() {
            if (!state.chaosActivated) return;

            fragment.appendChild(createChaosChar());
            
            if (fragment.childNodes.length % 100 === 0) {
                fragment.appendChild(document.createElement("br"));
            }

            if (fragment.childNodes.length >= 1000) {
                state.chaosActivated = false;
                return;
            }

            typingElement.appendChild(fragment.cloneNode(true));
            requestAnimationFrame(() => setTimeout(fillChaos, CONFIG.timing.chaosInterval));
        }

        fillChaos();
    }

    window.addEventListener('unload', () => {
        const timeoutId = typingElement?.dataset.timeoutId;
        if (timeoutId) clearTimeout(Number(timeoutId));
        if (state.glowInterval) clearInterval(state.glowInterval);
        document.removeEventListener('keydown', konamiHandler);
    });
});