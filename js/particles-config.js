document.addEventListener('DOMContentLoaded', function() {

    setTimeout(initializeParticles, 500);
});

function initializeParticles() {
    const particlesContainer = document.getElementById('particles-js');
    if (!particlesContainer) {
        console.error('Particles container not found');
        return;
    }

    try {
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        const isDark = theme === 'dark';

        if (window.pJSDom && window.pJSDom.length > 0) {
            window.pJSDom[0].pJS.fn.vendors.destroypJS();
            window.pJSDom = [];
        }

        const config = {
            particles: {
                number: {
                    value: 30,
                    density: {
                        enable: true,
                        value_area: 800
                    }
                },
                color: {
                    value: isDark ? '#5ea2ff' : '#0066cc'
                },
                shape: {
                    type: 'circle'
                },
                opacity: {
                    value: 0.2,
                    random: false
                },
                size: {
                    value: 3,
                    random: true
                },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: isDark ? '#5ea2ff' : '#0066cc',
                    opacity: 0.2,
                    width: .5
                },
                move: {
                    enable: true,
                    speed: .5,
                    direction: 'none',
                    random: false,
                    straight: false,
                    out_mode: 'bounce',
                    bounce: true
                }
            },
            interactivity: {
                detect_on: 'canvas',
                events: {
                    onhover: {
                        enable: true,
                        mode: 'grab'
                    },
                    onclick: {
                        enable: true,
                        mode: 'push'
                    },
                    resize: true
                },
                modes: {
                    grab: {
                        distance: 140,
                        line_linked: {
                            opacity: .2
                        }
                    },
                    push: {
                        particles_nb: 3
                    }
                }
            },
            retina_detect: true
        };

        if (window.particlesJS) {
            console.log('Initializing particles.js with theme:', theme);
            window.particlesJS('particles-js', config);
        } else {
            console.error('particles.js is not loaded');
        }
    } catch (error) {
        console.error('Error initializing particles:', error);
    }
}
