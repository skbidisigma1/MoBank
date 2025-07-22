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
                value: 50
            },
            color: { value: "#0066cc" },
            shape: {
                type: "circle",
                options: {
                    polygon: { sides: 5 },
                    star: { sides: 5 },
                    image: { src: "", width: 100, height: 100 }
                }
            },
            opacity: {
                value: 0.5,
                random: false
            },
            size: {
                value: 3,
                random: false
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
                outModes: { default: "out" },
                attract: { enable: false, rotateX: 600, rotateY: 1200 }
            }
        },
        interactivity: {
            detectsOn: "canvas",
            events: {
                onClick: { enable: true, mode: "push" },
                resize: true
            },
            modes: {
                push: { quantity: 1 },
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
                number: { value: 20 },
                color: { value: "#cccccc" },
                shape: { type: "circle" },
                opacity: { value: 0.4, random: false },
                size: { value: 2, random: false },
                links: { enable: false },
                move: { enable: true, speed: 0.5, direction: "none", random: false, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: false }, resize: true },
                modes: {}
            },
            detectRetina: true
        },
        default: {
            particles: {
                number: { value: 50 },
                color: { value: "#0066cc" },
                shape: { type: "circle" },
                opacity: { value: 0.8, random: false },
                size: { value: 3, random: false },
                links: { enable: true, distance: 150, color: "#0066cc", opacity: 0.4, width: 1 },
                move: { enable: true, speed: 1, direction: "none", random: false, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: true, mode: "push" }, resize: true },
                modes: { push: { quantity: 1 } }
            },
            detectRetina: true
        },
        energetic: {
            particles: {
                number: { value: 80 },
                color: { value: "#00b894" },
                shape: { type: "circle" },
                opacity: { value: 0.9, random: true },
                size: { value: 4, random: true },
                links: { enable: true, distance: 200, color: "#00b894", opacity: 0.6, width: 1 },
                move: { enable: true, speed: 2, direction: "none", random: false, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: true, mode: "push" }, resize: true },
                modes: { push: { quantity: 1 } }
            },
            detectRetina: true
        },
        cosmic: {
            particles: {
                number: { value: 100 },
                color: { value: "#6c5ce7" },
                shape: { type: "circle" },
                opacity: { value: 0.7, random: true },
                size: { value: 2.5, random: true },
                links: { enable: true, distance: 180, color: "#a29bfe", opacity: 0.4, width: 1 },
                move: { enable: true, speed: 0.8, direction: "none", random: false, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: true, mode: "push" }, resize: true },
                modes: { push: { quantity: 1 } }
            },
            detectRetina: true
        },
        snow: {
            particles: {
                number: { value: 150 },
                color: { value: "#ffffff" },
                shape: { type: "circle" },
                opacity: { value: 0.8, random: true },
                size: { value: 3, random: true },
                links: { enable: false },
                move: { enable: true, speed: 2, direction: "bottom", random: false, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: false }, resize: true },
                modes: {}
            },
            detectRetina: true
        },
        bubbles: {
            particles: {
                number: { value: 60 },
                color: { value: ["#ff6b6b", "#4ecdc4", "#45b7d1", "#f9ca24", "#f0932b"] },
                shape: { type: "circle" },
                opacity: { value: 0.6, random: true },
                size: { value: 8, random: true },
                links: { enable: false },
                move: { enable: true, speed: 1.5, direction: "top", random: false, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: true, mode: "remove" }, resize: true },
                modes: { remove: { quantity: 2 } }
            },
            detectRetina: true
        },
        nasa: {
            particles: {
                number: { value: 160 },
                color: { value: "#ffffff" },
                shape: { type: "circle" },
                opacity: { value: 0.8, random: true },
                size: { value: 1, random: true },
                links: { enable: false },
                move: { enable: true, speed: 0.2, direction: "none", random: true, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: true, mode: "remove" }, resize: true },
                modes: { remove: { quantity: 5 } }
            },
            detectRetina: true,
            background: { color: "transparent" }
        },
        "nyan-cat": {
            particles: {
                number: { value: 100 },
                color: { value: ["#ff0080", "#00ff80", "#0080ff", "#ff8000", "#8000ff"] },
                shape: { 
                    type: "star",
                    options: { star: { sides: 6 } }
                },
                opacity: { value: 1, random: false },
                size: { value: 4, random: true },
                links: { enable: false },
                move: { enable: true, speed: 6, direction: "left", random: false, straight: true, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: true, mode: "remove" }, resize: true },
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
        
        // Basic settings - remove density
        config.particles.number.value = settings.enabled ? (settings.count || 50) : 0;
        
        // Apply minimal particles settings if reduced motion is enabled
        if (settings.reducedMotion) {
            config.particles.number.value = Math.floor(config.particles.number.value / 2);
        }
        
        // Shape configuration - fix polygon/star sides
        config.particles.shape.type = settings.shape || "circle";
        if (settings.shape === "polygon") {
            config.particles.shape.options = {
                polygon: { sides: settings.polygonSides || 5 }
            };
        } else if (settings.shape === "star") {
            config.particles.shape.options = {
                star: { sides: settings.starSides || 5 }
            };
        } else if (settings.shape === "image") {
            config.particles.shape.options = {
                image: { src: settings.imageSource || "", width: 100, height: 100 }
            };
        }
        
        // Color configuration
        if (settings.colorMode === "single") {
            config.particles.color.value = settings.particleColor || "#0066cc";
        } else if (settings.colorMode === "multiple") {
            config.particles.color.value = settings.colors || ["#0066cc"];
        } else if (settings.colorMode === "random") {
            config.particles.color.value = "random";
        }
        
        // Size configuration - use modern range-based approach
        const baseSize = settings.size || 3;
        const sizeVariation = settings.sizeVariation || 0;
        
        if (settings.sizeRandom && sizeVariation > 0) {
            // Use range object for size variation
            const minSize = Math.max(0.1, baseSize * (1 - sizeVariation));
            const maxSize = baseSize * (1 + sizeVariation);
            config.particles.size.value = {
                min: minSize,
                max: maxSize
            };
        } else {
            config.particles.size.value = baseSize;
        }
        
        // Opacity configuration - use modern range-based approach  
        const baseOpacity = Math.max(0.01, settings.opacity || 0.5);
        const opacityVariation = settings.opacityVariation || 0;
        
        if (settings.opacityRandom && opacityVariation > 0) {
            // Use range object for opacity variation
            const minOpacity = Math.max(0.01, baseOpacity * (1 - opacityVariation));
            const maxOpacity = Math.min(1, baseOpacity * (1 + opacityVariation));
            config.particles.opacity.value = {
                min: minOpacity,
                max: maxOpacity
            };
        } else {
            config.particles.opacity.value = baseOpacity;
        }
        
        // Movement - handle new movement type system
        config.particles.move.enable = settings.moveEnable !== false;
        config.particles.move.speed = settings.moveSpeed || 1;
        
        // Handle movement type
        const moveType = settings.moveType || "default";
        switch (moveType) {
            case "random":
                config.particles.move.direction = "none";
                config.particles.move.random = true;
                config.particles.move.straight = false;
                break;
            case "straight":
                config.particles.move.direction = settings.moveDirection || "none";
                config.particles.move.random = false;
                config.particles.move.straight = true;
                break;
            default: // "default"
                config.particles.move.direction = settings.moveDirection || "none";
                config.particles.move.random = false;
                config.particles.move.straight = false;
                break;
        }
        
        config.particles.move.outModes.default = settings.moveOutMode || "out";
        config.particles.move.attract.enable = settings.moveAttract || false;
        if (settings.moveAttract) {
            config.particles.move.attract.rotateX = settings.attractRotateX || 600;
            config.particles.move.attract.rotateY = settings.attractRotateY || 1200;
        }
        
        // Override movement for minimal particles
        if (settings.reducedMotion) {
            config.particles.move.enable = false;
        }
        
        // Links (formerly line_linked)
        config.particles.links.enable = settings.lineLinkedEnable !== false;
        config.particles.links.distance = settings.lineLinkedDistance || 150;
        config.particles.links.color = settings.lineLinkedColor || settings.particleColor || "#0066cc";
        config.particles.links.opacity = settings.lineLinkedOpacity || 0.4;
        config.particles.links.width = settings.lineLinkedWidth || 1;
        config.particles.links.warp = settings.lineWarp || false;
        config.particles.links.triangles = {
            enable: settings.lineTriangles || false,
            color: settings.triangleColor || settings.lineLinkedColor || "#0066cc",
            opacity: settings.triangleOpacity || 0.5
        };
        config.particles.links.shadow = {
            enable: settings.lineLinkedShadow || false,
            color: settings.lineShadowColor || "#000000",
            blur: settings.lineShadowBlur || 5
        };
        
    // Interactivity - simplified, disable built-in click
    config.interactivity.detectsOn = settings.detectOn || "canvas";
    config.interactivity.events.onClick.enable = false;
    config.interactivity.events.onClick.mode = [];
    delete config.interactivity.modes.push;
    delete config.interactivity.modes.remove;
        
        config.interactivity.events.resize = settings.resizeEnable !== false;
        
        // Advanced settings
        config.detectRetina = settings.retinaDetect !== false;
        
        config.background.color = "transparent";
        
        return config;
    }

    let updateConfigRunning = false;

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
            // Store current settings for manual click handler
            window.currentParticleSettings = settings;
            
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
            // Remove previous handler if exists
            if (window._particleClickHandler) {
                document.body.removeEventListener('click', window._particleClickHandler);
            }

            // Create a single persistent handler
            window._particleClickHandler = function(e) {
                if (!document.hidden && mainContainer && window.currentParticleSettings?.enabled) {
                    const pos = { x: e.clientX, y: e.clientY };

                    try {
                        // Determine click effect from settings
                        const clickMode = window.currentParticleSettings.clickMode;
                        if (clickMode === 'push') {
                            const quantity = window.currentParticleSettings.pushParticlesNb || 1;
                            for (let i = 0; i < quantity; i++) {
                                mainContainer.particles.addParticle({ x: pos.x, y: pos.y });
                            }
                        } else if (clickMode === 'remove') {
                            const quantity = window.currentParticleSettings.pushParticlesNb || 2;
                            mainContainer.particles.removeQuantity(quantity);
                        }
                    } catch (err) {
                        console.warn('Could not handle click interaction', err);
                    }
                }
            };

            document.body.addEventListener('click', window._particleClickHandler);
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

    // Reduced motion change handler - updates user preference when device preference changes
    const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionMediaQuery.addEventListener('change', async (e) => {
        const settings = await loadParticleSettings();
        // Only auto-update if user hasn't manually overridden the preference
        if (settings.reducedMotionAutoSet !== false) {
            settings.reducedMotion = e.matches;
            await saveParticleSettings(settings);
            
            const particlesContainer = document.getElementById('particles-js');
            if (settings.enabled && window.innerWidth >= BREAKPOINTS.MOBILE) {
                particlesContainer.style.display = 'block';
                destroyParticles('main');
                const config = createParticlesConfig(settings);
                mainContainer = await tsParticles.load({
                    id: 'particles-js',
                    options: config
                });
                setupClickHandler();
            } else {
                particlesContainer.style.display = 'none';
                destroyParticles('main');
            }
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
            const settings = await loadParticleSettings();
            
            // Check if resize detection is enabled
            if (!settings.resizeEnable) {
                return;
            }
            
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
        // Check if user prefers reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        return {
            enabled: true,
            reducedMotion: prefersReducedMotion, // This will disable particles if device prefers reduced motion
            count: 50,
            shape: "circle",
            polygonSides: 5,
            starSides: 5,
            imageSource: "",
            colorMode: "single",
            particleColor: "#0066cc",
            colors: ["#0066cc"],
            size: 3,
            sizeRandom: false,
            sizeVariation: 0.5,
            opacity: 0.8, // Increased opacity for better visibility
            opacityRandom: false,
            opacityVariation: 0.3,
            moveEnable: true,
            moveSpeed: 1,
            moveType: "default",
            moveDirection: "none",
            moveOutMode: "out",
            moveAttract: false,
            attractRotateX: 600,
            attractRotateY: 1200,
            lineLinkedEnable: true,
            lineLinkedDistance: 150,
            lineLinkedColor: "#0066cc",
            lineLinkedOpacity: 0.6, // Increased line opacity for better visibility
            lineLinkedWidth: 1,
            lineLinkedShadow: false,
            lineWarp: false,
            lineTriangles: false,
            triangleColor: "#0066cc",
            triangleOpacity: 0.5,
            lineShadowColor: "#000000",
            lineShadowBlur: 5,
            detectOn: "canvas",
            clickMode: "push",
            resizeEnable: true,
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
            
            // Prevent multiple concurrent updates
            if (updateConfigRunning) {
                console.log('UpdateConfig already running, skipping');
                return;
            }
            updateConfigRunning = true;
            
            try {
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
            } finally {
                updateConfigRunning = false;
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

    // Initialize particles when page loads
    initParticles();
})();