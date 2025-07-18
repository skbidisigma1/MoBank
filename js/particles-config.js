(function() {
    let mainContainer = null;
    let previewContainer = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 500;
    
    const BREAKPOINTS = {
        MOBILE: 768,
        TABLET: 1024,
        FULL_HD: 1920,
        WIDE_2K: 2560
    };

    // Default configuration template - Updated for tsParticles v3
    const DEFAULT_CONFIG = {
        particles: {
            number: {
                value: 50,
                density: { enable: true, area: 800 }
            },
            color: { value: "#0066cc" },
            shape: {
                type: "circle",
                stroke: { width: 0, color: "#000000" },
                polygon: { sides: 5 },
                image: { src: "", width: 100, height: 100 }
            },
            opacity: {
                value: 0.5,
                random: false,
                animation: { enable: false, speed: 1, minimumValue: 0.1, sync: false }
            },
            size: {
                value: 3,
                random: false,
                animation: { enable: false, speed: 40, minimumValue: 0.1, sync: false }
            },
            links: {
                enable: true,
                distance: 150,
                color: "#0066cc",
                opacity: 0.4,
                width: 1,
                shadow: { enable: false, color: "#000000", blur: 5 }
            },
            move: {
                enable: true,
                speed: 1,
                direction: "none",
                random: false,
                straight: false,
                outModes: { default: "bounce" },
                bounce: false,
                attract: { enable: false, rotateX: 600, rotateY: 1200 }
            }
        },
        interactivity: {
            detectsOn: "canvas",
            events: {
                onHover: { enable: true, mode: "grab" },
                onClick: { enable: true, mode: "push" },
                resize: true
            },
            modes: {
                grab: { distance: 120, links: { opacity: 0.5 } },
                bubble: { distance: 100, size: 10, duration: 0.4, opacity: 8, speed: 3 },
                repulse: { distance: 100, duration: 0.4 },
                push: { quantity: 4 },
                remove: { quantity: 2 }
            }
        },
        detectRetina: true,
        background: {
            color: "transparent"
        }
    };

    // Comprehensive preset configurations - Updated for tsParticles v3
    const PRESETS = {
        minimal: {
            particles: {
                number: { value: 20, density: { enable: true, area: 800 } },
                color: { value: "#cccccc" },
                shape: { type: "circle" },
                opacity: { value: 0.4, random: false, animation: { enable: false } },
                size: { value: 2, random: false, animation: { enable: false } },
                links: { enable: false },
                move: { enable: true, speed: 0.5, direction: "none", random: false, straight: false, outModes: { default: "out" }, bounce: false }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onHover: { enable: false }, onClick: { enable: false }, resize: true },
                modes: {}
            },
            detectRetina: true
        },
        default: {
            particles: {
                number: { value: 50, density: { enable: true, area: 800 } },
                color: { value: "#0066cc" },
                shape: { type: "circle" },
                opacity: { value: 0.8, random: false, animation: { enable: false } },
                size: { value: 3, random: false, animation: { enable: false } },
                links: { enable: true, distance: 150, color: "#0066cc", opacity: 0.4, width: 1 },
                move: { enable: true, speed: 1, direction: "none", random: false, straight: false, outModes: { default: "bounce" }, bounce: false }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onHover: { enable: true, mode: "grab" }, onClick: { enable: true, mode: "push" }, resize: true },
                modes: { grab: { distance: 150, links: { opacity: 0.5 } }, push: { quantity: 4 } }
            },
            detectRetina: true
        },
        energetic: {
            particles: {
                number: { value: 80, density: { enable: true, area: 800 } },
                color: { value: "#00b894" },
                shape: { type: "circle" },
                opacity: { value: 0.9, random: true, animation: { enable: true, speed: 2, minimumValue: 0.1, sync: false } },
                size: { value: 4, random: true, animation: { enable: true, speed: 40, minimumValue: 0.1, sync: false } },
                links: { enable: true, distance: 200, color: "#00b894", opacity: 0.6, width: 1 },
                move: { enable: true, speed: 2, direction: "none", random: false, straight: false, outModes: { default: "bounce" }, bounce: false }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onHover: { enable: true, mode: "repulse" }, onClick: { enable: true, mode: "push" }, resize: true },
                modes: { repulse: { distance: 100, duration: 0.4 }, push: { quantity: 6 } }
            },
            detectRetina: true
        },
        cosmic: {
            particles: {
                number: { value: 100, density: { enable: true, area: 800 } },
                color: { value: "#6c5ce7" },
                shape: { type: "circle" },
                opacity: { value: 0.7, random: true, animation: { enable: true, speed: 1, minimumValue: 0.1, sync: false } },
                size: { value: 2.5, random: true, animation: { enable: false } },
                links: { enable: true, distance: 180, color: "#a29bfe", opacity: 0.4, width: 1 },
                move: { enable: true, speed: 0.8, direction: "none", random: false, straight: false, outModes: { default: "bounce" }, bounce: false }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onHover: { enable: true, mode: "bubble" }, onClick: { enable: true, mode: "push" }, resize: true },
                modes: { bubble: { distance: 150, size: 8, duration: 0.4 }, push: { quantity: 3 } }
            },
            detectRetina: true
        },
        snow: {
            particles: {
                number: { value: 150, density: { enable: true, area: 800 } },
                color: { value: "#ffffff" },
                shape: { type: "circle" },
                opacity: { value: 0.8, random: true, animation: { enable: false } },
                size: { value: 3, random: true, animation: { enable: false } },
                links: { enable: false },
                move: { enable: true, speed: 2, direction: "bottom", random: false, straight: false, outModes: { default: "out" }, bounce: false }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onHover: { enable: false }, onClick: { enable: false }, resize: true },
                modes: {}
            },
            detectRetina: true
        },
        bubbles: {
            particles: {
                number: { value: 60, density: { enable: true, area: 800 } },
                color: { value: ["#ff6b6b", "#4ecdc4", "#45b7d1", "#f9ca24", "#f0932b"] },
                shape: { type: "circle" },
                opacity: { value: 0.6, random: true, animation: { enable: true, speed: 1, minimumValue: 0.1, sync: false } },
                size: { value: 8, random: true, animation: { enable: true, speed: 20, minimumValue: 0.1, sync: false } },
                links: { enable: false },
                move: { enable: true, speed: 1.5, direction: "top", random: false, straight: false, outModes: { default: "out" }, bounce: false }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onHover: { enable: true, mode: "bubble" }, onClick: { enable: true, mode: "repulse" }, resize: true },
                modes: { bubble: { distance: 100, size: 15, duration: 0.4 }, repulse: { distance: 150, duration: 0.4 } }
            },
            detectRetina: true
        },
        nasa: {
            particles: {
                number: { value: 160, density: { enable: true, area: 800 } },
                color: { value: "#ffffff" },
                shape: { type: "circle" },
                opacity: { value: 0.8, random: true, animation: { enable: true, speed: 1, minimumValue: 0.1, sync: false } },
                size: { value: 1, random: true, animation: { enable: false } },
                links: { enable: false },
                move: { enable: true, speed: 0.2, direction: "none", random: true, straight: false, outModes: { default: "out" }, bounce: false }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onHover: { enable: true, mode: "bubble" }, onClick: { enable: true, mode: "repulse" }, resize: true },
                modes: { bubble: { distance: 250, size: 0, duration: 2, opacity: 0 }, repulse: { distance: 400, duration: 0.4 } }
            },
            detectRetina: true,
            background: { color: "transparent" }
        },
        "nyan-cat": {
            particles: {
                number: { value: 100, density: { enable: false } },
                color: { value: ["#ff0080", "#00ff80", "#0080ff", "#ff8000", "#8000ff"] },
                shape: { type: "star", polygon: { sides: 6 } },
                opacity: { value: 1, random: false, animation: { enable: false } },
                size: { value: 4, random: true, animation: { enable: false } },
                links: { enable: false },
                move: { enable: true, speed: 6, direction: "left", random: false, straight: true, outModes: { default: "out" }, bounce: false }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onHover: { enable: false }, onClick: { enable: true, mode: "remove" }, resize: true },
                modes: { remove: { quantity: 10 } }
            },
            detectRetina: true,
            background: { color: "transparent" }
        }
    };

    function getResponsiveParticleCount(baseCount = 50) {
        const width = window.innerWidth;
        if (width < BREAKPOINTS.MOBILE) return 0;
        if (width >= BREAKPOINTS.WIDE_2K) return Math.floor(baseCount * 1.5);
        if (width >= BREAKPOINTS.FULL_HD) return Math.floor(baseCount * 1.3);
        if (width >= BREAKPOINTS.TABLET) return Math.floor(baseCount * 1.1);
        return Math.floor(baseCount * 0.9);
    }

    function getReducedMotionConfig(baseConfig) {
        return {
            ...baseConfig,
            particles: {
                ...baseConfig.particles,
                move: {
                    ...baseConfig.particles.move,
                    speed: baseConfig.particles.move.speed * 0.3,
                    bounce: false
                },
                number: {
                    ...baseConfig.particles.number,
                    value: Math.floor(baseConfig.particles.number.value / 2)
                },
                opacity: {
                    ...baseConfig.particles.opacity,
                    animation: { ...baseConfig.particles.opacity.animation, enable: false }
                },
                size: {
                    ...baseConfig.particles.size,
                    animation: { ...baseConfig.particles.size.animation, enable: false }
                }
            }
        };
    }

    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    function destroyParticles(instance = 'main') {
        try {
            if (instance === 'main' && mainContainer) {
                tsParticles.domItem(0)?.destroy();
                mainContainer = null;
            } else if (instance === 'preview' && previewContainer) {
                previewContainer.destroy();
                previewContainer = null;
            }
        } catch (error) {
            console.warn('Error destroying particles:', error);
        }
    }

    function createParticlesConfig(settings) {
        const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep clone
        
        // Basic settings
        config.particles.number.value = settings.enabled ? (settings.count || 50) : 0;
        config.particles.number.density.area = settings.density || 800;
        
        // Shape configuration
        config.particles.shape.type = settings.shape || "circle";
        if (settings.shape === "polygon") {
            config.particles.shape.polygon.sides = settings.polygonSides || 5;
        } else if (settings.shape === "star") {
            config.particles.shape.polygon.sides = settings.starSides || 5;
        } else if (settings.shape === "image") {
            config.particles.shape.image.src = settings.imageSource || "";
        }
        config.particles.shape.stroke.width = settings.strokeWidth || 0;
        config.particles.shape.stroke.color = settings.strokeColor || "#000000";
        
        // Color configuration
        if (settings.colorMode === "single") {
            config.particles.color.value = settings.particleColor || "#0066cc";
        } else if (settings.colorMode === "multiple") {
            config.particles.color.value = settings.colors || ["#0066cc"];
        } else if (settings.colorMode === "random") {
            config.particles.color.value = "random";
        }
        
        // Size and opacity
        config.particles.size.value = settings.size || 3;
        config.particles.size.random = settings.sizeRandom || false;
        config.particles.size.animation.enable = settings.sizeAnim || false;
        if (settings.sizeAnim) {
            config.particles.size.animation.speed = settings.sizeAnimSpeed || 40;
            config.particles.size.animation.minimumValue = settings.sizeAnimMin || 0.1;
            config.particles.size.animation.sync = settings.sizeAnimSync || false;
        }
        
        config.particles.opacity.value = Math.max(0.01, settings.opacity || 0.5);
        config.particles.opacity.random = settings.opacityRandom || false;
        config.particles.opacity.animation.enable = settings.opacityAnim || false;
        if (settings.opacityAnim) {
            config.particles.opacity.animation.speed = settings.opacityAnimSpeed || 1;
            config.particles.opacity.animation.minimumValue = Math.max(0.01, settings.opacityAnimMin || 0.1);
            config.particles.opacity.animation.sync = settings.opacityAnimSync || false;
        }
        
        // Movement
        config.particles.move.enable = settings.moveEnable !== false;
        config.particles.move.speed = settings.moveSpeed || 1;
        config.particles.move.direction = settings.moveDirection || "none";
        config.particles.move.random = settings.moveRandom || false;
        config.particles.move.straight = settings.moveStraight || false;
        config.particles.move.outModes.default = settings.moveOutMode || "bounce";
        config.particles.move.bounce = settings.moveBounce || false;
        config.particles.move.attract.enable = settings.moveAttract || false;
        if (settings.moveAttract) {
            config.particles.move.attract.rotateX = settings.attractRotateX || 600;
            config.particles.move.attract.rotateY = settings.attractRotateY || 1200;
        }
        
        // Links (formerly line_linked)
        config.particles.links.enable = settings.lineLinkedEnable !== false;
        config.particles.links.distance = settings.lineLinkedDistance || 150;
        config.particles.links.color = settings.lineLinkedColor || settings.particleColor || "#0066cc";
        config.particles.links.opacity = settings.lineLinkedOpacity || 0.4;
        config.particles.links.width = settings.lineLinkedWidth || 1;
        config.particles.links.shadow = {
            enable: settings.lineLinkedShadow || false,
            color: settings.lineShadowColor || "#000000",
            blur: settings.lineShadowBlur || 5
        };
        
        // Interactivity
        config.interactivity.detectsOn = settings.detectOn || "canvas";
        config.interactivity.events.onHover.enable = settings.hoverEnable !== false;
        config.interactivity.events.onHover.mode = settings.hoverMode || "grab";
        config.interactivity.events.onClick.enable = settings.clickEnable !== false;
        config.interactivity.events.onClick.mode = settings.clickMode || "push";
        config.interactivity.events.resize = settings.resizeEnable !== false;
        
        // Interaction modes
        config.interactivity.modes.grab.distance = settings.grabDistance || 120;
        config.interactivity.modes.grab.links.opacity = settings.grabLineOpacity || 0.5;
        
        config.interactivity.modes.bubble.distance = settings.bubbleDistance || 100;
        config.interactivity.modes.bubble.size = settings.bubbleSize || 10;
        config.interactivity.modes.bubble.duration = settings.bubbleDuration || 0.4;
        
        config.interactivity.modes.repulse.distance = settings.repulseDistance || 100;
        config.interactivity.modes.repulse.duration = settings.repulseDuration || 0.4;
        
        config.interactivity.modes.push.quantity = settings.pushParticlesNb || 4;
        config.interactivity.modes.remove.quantity = settings.pushParticlesNb || 2;
        
        // Advanced settings
        config.detectRetina = settings.retinaDetect !== false;
        
        // Always use transparent background to inherit page background
        config.background.color = "transparent";
        
        // Apply reduced motion if needed
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return reducedMotion ? getReducedMotionConfig(config) : config;
    }

    async function initParticles() {
        if (retryCount >= MAX_RETRIES) {
            console.warn(`tsParticles initialization failed after ${MAX_RETRIES} attempts. Giving up.`);
            return;
        }

        retryCount++;
        const particlesContainer = document.getElementById('particles-js');
        
        if (!particlesContainer || typeof tsParticles === 'undefined') {
            console.warn(`Dependencies not ready, will retry in ${RETRY_DELAY}ms (attempt ${retryCount}/${MAX_RETRIES})`);
            setTimeout(initParticles, RETRY_DELAY);
            return;
        }

        try {
            if (window.innerWidth < BREAKPOINTS.MOBILE) {
                if (particlesContainer) {
                    particlesContainer.style.display = 'none';
                }
                return;
            }
            
            destroyParticles('main');
            
            // Load saved settings or use defaults
            const settings = await loadParticleSettings();
            
            if (!settings.enabled) {
                particlesContainer.style.display = 'none';
                return;
            }
            
            const config = createParticlesConfig(settings);
            
            // Use tsParticles.load instead of particlesJS
            mainContainer = await tsParticles.load({
                id: 'particles-js',
                options: config
            });
            
            setupClickHandler();
            
        } catch (error) {
            console.error('Error initializing tsParticles:', error);
        }
    }

    function setupClickHandler() {
        if (mainContainer) {
            const handler = function(e) {
                if (!document.hidden && mainContainer) {
                    const pos = { x: e.clientX, y: e.clientY };
                    
                    try {
                        // tsParticles click interaction is handled automatically
                        // by the interactivity configuration, but we can still
                        // manually trigger effects if needed
                        
                        // Get the interactivity mode from the config
                        const mode = mainContainer.actualOptions?.interactivity?.events?.onClick?.mode;
                        
                        if (mode === 'push') {
                            // Add particles at click position
                            const quantity = mainContainer.actualOptions?.interactivity?.modes?.push?.quantity || 4;
                            for (let i = 0; i < quantity; i++) {
                                mainContainer.particles.addParticle({
                                    x: pos.x,
                                    y: pos.y
                                });
                            }
                        } else if (mode === 'remove') {
                            // Remove particles
                            const quantity = mainContainer.actualOptions?.interactivity?.modes?.remove?.quantity || 2;
                            mainContainer.particles.removeQuantity(quantity);
                        }
                    } catch (err) {
                        console.warn('Could not handle click interaction', err);
                    }
                }
            };

            document.body.removeEventListener('click', handler);
            document.body.addEventListener('click', handler);
        }
    }

    // Theme change handler
    window.addEventListener('themechange', async (e) => {
        const settings = await loadParticleSettings();
        const config = createParticlesConfig(settings);
        destroyParticles('main');
        if (settings.enabled && window.innerWidth >= BREAKPOINTS.MOBILE) {
            mainContainer = await tsParticles.load({
                id: 'particles-js',
                options: config
            });
            setupClickHandler();
        }
    });

    // Reduced motion change handler
    const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionMediaQuery.addEventListener('change', async (e) => {
        const settings = await loadParticleSettings();
        const config = createParticlesConfig(settings);
        destroyParticles('main');
        if (settings.enabled && window.innerWidth >= BREAKPOINTS.MOBILE) {
            mainContainer = await tsParticles.load({
                id: 'particles-js',
                options: config
            });
            setupClickHandler();
        }
    });

    // Visibility change handler
    document.addEventListener('visibilitychange', () => {
        if (mainContainer && mainContainer.particles) {
            // tsParticles automatically handles visibility changes,
            // but we can manually pause/resume if needed
            if (document.hidden) {
                mainContainer.pause();
            } else {
                mainContainer.play();
            }
        }
    });

    // Resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(async () => {
            const particlesContainer = document.getElementById('particles-js');
            if (particlesContainer) {
                if (window.innerWidth < BREAKPOINTS.MOBILE) {
                    particlesContainer.style.display = 'none';
                    destroyParticles('main');
                    return;
                } else {
                    particlesContainer.style.display = 'block';
                }
            }
            
            const settings = await loadParticleSettings();
            if (settings.enabled) {
                const config = createParticlesConfig(settings);
                destroyParticles('main');
                mainContainer = await tsParticles.load({
                    id: 'particles-js',
                    options: config
                });
                setupClickHandler();
            }
        }, 250);
    });

    // Window load handler
    window.addEventListener('load', function() {
        setTimeout(setupClickHandler, 100); // Small delay to ensure particles are loaded
    });

    // Window unload handler
    window.addEventListener('unload', function() {
        destroyParticles('main');
        destroyParticles('preview');
    });

    // Database functions
    async function initParticleDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MoBankParticles', 3);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings');
                }
                if (!db.objectStoreNames.contains('presets')) {
                    db.createObjectStore('presets');
                }
            };
        });
    }

    async function saveParticleSettings(settings) {
        try {
            const db = await initParticleDB();
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            
            await new Promise((resolve, reject) => {
                const request = store.put(settings, 'particleConfig');
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to save particle settings:', error);
        }
    }

    async function loadParticleSettings() {
        try {
            const db = await initParticleDB();
            const transaction = db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            
            const settings = await new Promise((resolve, reject) => {
                const request = store.get('particleConfig');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            return settings || getDefaultSettings();
        } catch (error) {
            console.error('Failed to load particle settings:', error);
            return getDefaultSettings();
        }
    }

    function getDefaultSettings() {
        return {
            enabled: true,
            count: 50,
            density: 800,
            shape: "circle",
            polygonSides: 5,
            starSides: 5,
            imageSource: "",
            strokeWidth: 0,
            strokeColor: "#000000",
            colorMode: "single",
            particleColor: "#0066cc",
            colors: ["#0066cc"],
            size: 3,
            sizeRandom: false,
            sizeAnim: false,
            sizeAnimSpeed: 40,
            sizeAnimMin: 0.1,
            sizeAnimSync: false,
            opacity: 0.8, // Increased opacity for better visibility
            opacityRandom: false,
            opacityAnim: false,
            opacityAnimSpeed: 1,
            opacityAnimMin: 0.1,
            opacityAnimSync: false,
            moveEnable: true,
            moveSpeed: 1,
            moveDirection: "none",
            moveRandom: false,
            moveStraight: false,
            moveOutMode: "bounce",
            moveBounce: false,
            moveAttract: false,
            attractRotateX: 600,
            attractRotateY: 1200,
            lineLinkedEnable: true,
            lineLinkedDistance: 150,
            lineLinkedColor: "#0066cc",
            lineLinkedOpacity: 0.6, // Increased line opacity for better visibility
            lineLinkedWidth: 1,
            lineLinkedShadow: false,
            lineShadowColor: "#000000",
            lineShadowBlur: 5,
            detectOn: "canvas",
            hoverEnable: true,
            hoverMode: "grab",
            clickEnable: true,
            clickMode: "push",
            resizeEnable: true,
            grabDistance: 120,
            grabLineOpacity: 0.5,
            bubbleDistance: 100,
            bubbleSize: 10,
            bubbleDuration: 0.4,
            repulseDistance: 100,
            repulseDuration: 0.4,
            pushParticlesNb: 4,
            retinaDetect: true
        };
    }

    // Initialize particles
    initParticles();

    // Global API for particle configuration
    window.particleControls = {
        updateConfig: async function(settings) {
            if (!settings) return;
            
            // Check if any modal is currently open to avoid interference
            const isModalOpen = document.querySelector('.modal:not(.hidden)') || 
                               document.querySelector('[role="dialog"]:not(.hidden)');
            
            const config = createParticlesConfig(settings);
            const particlesContainer = document.getElementById('particles-js');
            
            if (!particlesContainer) {
                console.warn('particles-js container not found');
                return;
            }
            
            if (settings.enabled && window.innerWidth >= BREAKPOINTS.MOBILE) {
                particlesContainer.style.display = 'block';
                destroyParticles('main');
                
                // Small delay if modal is open to prevent interference
                if (isModalOpen) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                try {
                    mainContainer = await tsParticles.load({
                        id: 'particles-js',
                        options: config
                    });
                    setupClickHandler();
                } catch (error) {
                    console.error('Failed to load particles:', error);
                }
            } else {
                particlesContainer.style.display = 'none';
                destroyParticles('main');
            }
        },
        
        getCurrentConfig: function() {
            return loadParticleSettings();
        },
        
        reinitialize: function() {
            initParticles();
        },
        
        getPresets: function() {
            return PRESETS;
        },
        
        saveSettings: saveParticleSettings,
        loadSettings: loadParticleSettings
    };

    // Secondary initialization to ensure particles load with correct settings
    setTimeout(() => {
        if (typeof tsParticles !== 'undefined' && window.particleControls) {
            loadParticleSettings().then(async settings => {
                console.log('Secondary initialization with settings:', settings);
                try {
                    await window.particleControls.updateConfig(settings);
                } catch (error) {
                    console.warn('Failed to apply particle settings on secondary init:', error);
                }
            }).catch(error => {
                console.warn('Failed to load particle settings on secondary init:', error);
            });
        }
    }, 1500); // Wait for everything to settle
})();