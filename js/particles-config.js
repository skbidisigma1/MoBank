(function() {
    let pJSInstance = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 500;
    
    const BREAKPOINTS = {
        MOBILE: 768,
        TABLET: 1024,
        FULL_HD: 1920,
        WIDE_2K: 2560
    };
    
    const CONFIG = {
        light: {
            particleColor: '#0066cc',
            lineColor: '#0066cc',
            getParticleCount: () => getResponsiveParticleCount()
        },
        dark: {
            particleColor: '#005fa3',
            lineColor: '#005fa3',
            getParticleCount: () => getResponsiveParticleCount()
        }
    };

    function getResponsiveParticleCount() {
        const width = window.innerWidth;
        if (width < BREAKPOINTS.MOBILE) return 0;
        if (width >= BREAKPOINTS.WIDE_2K) return 75;
        if (width >= BREAKPOINTS.FULL_HD) return 65;
        if (width >= BREAKPOINTS.TABLET) return 55;
        return 45;
    }

    function getReducedMotionConfig(baseConfig) {
        return {
            ...baseConfig,
            particles: {
                ...baseConfig.particles,
                move: {
                    ...baseConfig.particles.move,
                    speed: 0.5,
                    bounce: false
                },
                number: {
                    ...baseConfig.particles.number,
                    value: Math.floor(baseConfig.particles.number.value / 2)
                }
            }
        };
    }

    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    function getParticlesConfig(theme = 'light', reducedMotion = false) {
        const colors = CONFIG[theme] || CONFIG.light;
        const baseConfig = {
            particles: {
                number: {
                    value: colors.getParticleCount(),
                    density: {
                        enable: true,
                        value_area: 800
                    }
                },
                color: {
                    value: colors.particleColor
                },
                shape: {
                    type: "circle",
                    stroke: {
                        width: 0,
                        color: "#000000"
                    }
                },
                opacity: {
                    value: 0.3,
                    random: true,
                    anim: {
                        enable: true,
                        speed: 0.5,
                        opacity_min: 0.25,
                        sync: false
                    }
                },
                size: {
                    value: 3,
                    random: true,
                    anim: {
                        enable: false,
                        speed: 40,
                        size_min: 0.1,
                        sync: false
                    }
                },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: colors.lineColor,
                    opacity: 0.4,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 1,
                    direction: "none",
                    random: false,
                    straight: false,
                    out_mode: "bounce",
                    bounce: false,
                    attract: {
                        enable: false,
                        rotateX: 600,
                        rotateY: 1200
                    }
                }
            },
            interactivity: {
                detect_on: "window",
                events: {
                    onhover: {
                        enable: true,
                        mode: "grab"
                    },
                    onclick: {
                        enable: true,
                        mode: "push"
                    },
                    resize: true
                },
                modes: {
                    grab: {
                        distance: 120,
                        line_linked: {
                            opacity: 0.5
                        }
                    },
                    push: {
                        particles_nb: 1
                    }
                }
            },
            retina_detect: true
        };

        return reducedMotion ? getReducedMotionConfig(baseConfig) : baseConfig;
    }

    function destroyParticles() {
        if (typeof pJSDom !== 'undefined' && pJSDom.length > 0) {
            pJSDom[0].pJS.fn.vendors.destroypJS();
            pJSDom = [];
        }
    }

    function initParticles() {
        if (retryCount >= MAX_RETRIES) {
            console.warn(`Particles.js initialization failed after ${MAX_RETRIES} attempts. Giving up.`);
            return;
        }

        retryCount++;
        const particlesContainer = document.getElementById('particles-js');
        
        if (!particlesContainer || typeof particlesJS === 'undefined') {
            console.warn(`Dependencies not ready, will retry in ${RETRY_DELAY}ms (attempt ${retryCount}/${MAX_RETRIES})`);
            setTimeout(initParticles, RETRY_DELAY);
            return;
        }

        try {
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const currentTheme = getCurrentTheme();
            const config = getParticlesConfig(currentTheme, prefersReducedMotion);
            
            if (window.innerWidth < BREAKPOINTS.MOBILE) {
                if (particlesContainer) {
                    particlesContainer.style.display = 'none';
                }
                return;
            }
            
            destroyParticles();
            particlesJS('particles-js', config);
            
        } catch (error) {
            console.error('Error initializing particles.js:', error);
        }
    }    function setupClickHandler() {
        if (typeof pJSDom !== 'undefined' && pJSDom.length > 0 && pJSDom[0].pJS) {
            const handler = function(e) {
                if (!document.hidden) {
                    const pos = {
                        x: e.clientX,
                        y: e.clientY
                    };
                    
                    try {
                        // Make sure pJSDom is still available when the click happens
                        if (typeof pJSDom !== 'undefined' && pJSDom.length > 0 && pJSDom[0].pJS) {
                            const pJS = pJSDom[0].pJS;
                            Object.assign(pJS.interactivity.mouse, {
                                click_pos: pos,
                                click_time: new Date().getTime()
                            });
                            pJS.fn.modes.pushParticles(4, pos);
                        }
                    } catch (err) {
                        console.warn('Could not add particles on click', err);
                    }
                }
            };

            document.body.removeEventListener('click', handler);
            document.body.addEventListener('click', handler);
            return true;
        }
        return false;
    }

    initParticles();
    
    function checkAndSetupParticles() {
        setupClickHandler();
    }
    
    window.addEventListener('themechange', (e) => {
        const config = getParticlesConfig(e.detail.theme, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        destroyParticles();
        particlesJS('particles-js', config);
    });

    const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionMediaQuery.addEventListener('change', (e) => {
        const config = getParticlesConfig(getCurrentTheme(), e.matches);
        destroyParticles();
        particlesJS('particles-js', config);
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (typeof pJSDom !== 'undefined' && pJSDom.length > 0) {
                pJSDom[0].pJS.particles.move.enable = false;
            }
        } else {
            if (typeof pJSDom !== 'undefined' && pJSDom.length > 0) {
                pJSDom[0].pJS.particles.move.enable = true;
            }
        }
    });

    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const particlesContainer = document.getElementById('particles-js');
            if (particlesContainer) {
                if (window.innerWidth < BREAKPOINTS.MOBILE) {
                    particlesContainer.style.display = 'none';
                    destroyParticles();
                    return;
                } else {
                    particlesContainer.style.display = 'block';
                }
            }
            
            if (typeof pJSDom !== 'undefined' && pJSDom.length > 0) {
                const config = getParticlesConfig(
                    getCurrentTheme(), 
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches
                );
                destroyParticles();
                particlesJS('particles-js', config);
            }
        }, 250);
    });

    window.addEventListener('load', function() {
        checkAndSetupParticles();
    });    window.addEventListener('unload', function() {
        destroyParticles();
    });

    // Global API for particle configuration
    window.particleControls = {
        updateConfig: function(settings) {
            if (!settings) return;
            
            // Update internal CONFIG with user settings
            const theme = getCurrentTheme();
            CONFIG[theme] = {
                ...CONFIG[theme],
                particleColor: settings.particleColor || CONFIG[theme].particleColor,
                lineColor: settings.lineColor || CONFIG[theme].lineColor,
                getParticleCount: () => settings.enabled ? settings.count || 50 : 0
            };
            
            // Generate new config with user settings
            const customConfig = getCustomParticlesConfig(settings, theme);
            
            // Apply immediately
            if (settings.enabled && window.innerWidth >= BREAKPOINTS.MOBILE) {
                const particlesContainer = document.getElementById('particles-js');
                if (particlesContainer) {
                    particlesContainer.style.display = 'block';
                    destroyParticles();
                    particlesJS('particles-js', customConfig);
                }
            } else {
                const particlesContainer = document.getElementById('particles-js');
                if (particlesContainer) {
                    particlesContainer.style.display = 'none';
                    destroyParticles();
                }
            }
        },
        
        getCurrentConfig: function() {
            return CONFIG;
        },
        
        reinitialize: function() {
            initParticles();
        }
    };

    // Custom config generator that uses user settings
    function getCustomParticlesConfig(settings, theme = 'light') {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const baseConfig = {
            particles: {
                number: {
                    value: settings.enabled ? settings.count || 50 : 0,
                    density: {
                        enable: true,
                        value_area: 800
                    }
                },
                color: {
                    value: settings.particleColor || '#0066cc'
                },
                shape: {
                    type: "circle",
                    stroke: {
                        width: 0,
                        color: "#000000"
                    }
                },
                opacity: {
                    value: settings.opacity || 0.8,
                    random: true,
                    anim: {
                        enable: true,
                        speed: (settings.speed || 1.0) * 0.5,
                        opacity_min: (settings.opacity || 0.8) * 0.5,
                        sync: false
                    }
                },
                size: {
                    value: settings.size || 3,
                    random: true,
                    anim: {
                        enable: false,
                        speed: 40,
                        size_min: 0.1,
                        sync: false
                    }
                },
                line_linked: {
                    enable: settings.connectLines !== false,
                    distance: settings.interactionDistance || 150,
                    color: settings.lineColor || settings.particleColor || '#0066cc',
                    opacity: 0.4,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: settings.speed || 1.0,
                    direction: "none",
                    random: false,
                    straight: false,
                    out_mode: "bounce",
                    bounce: false,
                    attract: {
                        enable: false,
                        rotateX: 600,
                        rotateY: 1200
                    }
                }
            },
            interactivity: {
                detect_on: "window",
                events: {
                    onhover: {
                        enable: settings.mouseInteraction !== false,
                        mode: "grab"
                    },
                    onclick: {
                        enable: settings.mouseInteraction !== false,
                        mode: "push"
                    },
                    resize: true
                },
                modes: {
                    grab: {
                        distance: settings.interactionDistance || 150,
                        line_linked: {
                            opacity: 0.5
                        }
                    },
                    push: {
                        particles_nb: 1
                    }
                }
            },
            retina_detect: true
        };

        return reducedMotion ? getReducedMotionConfig(baseConfig) : baseConfig;
    }
})();