(function() {
    let mainContainer = null;
    let previewContainer = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 400;
    
    const BREAKPOINTS = {
        MOBILE: 768,
        TABLET: 1024,
        FULL_HD: 1920,
        WIDE_2K: 2560
    };

    const DEFAULT_CONFIG = {
        particles: {
            number: {
                value: 50
            },
            color: { value: "#bebebe" },
            shape: {
                type: "circle",
                options: {
                    polygon: { sides: 5 },
                    star: { sides: 5 },
                    image: { src: "", width: 100, height: 100 }
                }
            },
            opacity: { value: 0.4, random: false },
            size: {
                value: 3,
                random: false
            },
            links: {
                enable: true,
                distance: 150,
                color: "#005fa3",
                opacity: 0.4,
                width: 1,
                shadow: { enable: false, color: "#000000", blur: 5 }
            },
            move: {
                enable: true,
                speed: 0.5,
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

    const PRESETS = {
        minimal: {
            particles: {
                number: { value: 50 },
                color: { value: "#005fa3" },
                shape: { type: "circle" },
                opacity: { value: 0.6, random: false },
                size: { value: 2.5, random: false },
                links: { enable: false },
                move: { enable: true, speed: 0.2, direction: "none", random: false, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: true, mode: "remove" }, resize: true },
                modes: { remove: { quantity: 1 } }
            },
            detectRetina: true
        },
        snow: {
            particles: {
                number: { value: 300 },
                color: { value: "#ffffff" },
                shape: { type: "circle" },
                opacity: { value: 0.8, random: true, animation: { enable: true, speed: 0.3, minimumValue: 0.7 } },
                size: { value: 4, random: true, animation: { enable: true, speed: 0.6, minimumValue: 4, maximumValue: 7 } },
                links: { enable: false },
                move: { enable: true, speed: 0.4, direction: "bottom", random: false, straight: true, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: false }, resize: true },
                modes: {}
            },
            detectRetina: true
        },
        stars: {
            particles: {
                number: { value: 120 },
                color: { value: "#ffffff" },
                shape: { 
                    type: "star",
                    options: { star: { sides: 5 } }
                },
                opacity: { value: 0.9, random: true, animation: { enable: true, speed: 0.6, minimumValue: 0.3 } },
                size: { value: 2, random: true, animation: { enable: true, speed: 0.3, minimumValue: 1, maximumValue: 3 } },
                links: { enable: false },
                move: { enable: true, speed: 0.05, direction: "none", random: false, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: true, mode: "push" }, resize: true },
                modes: { push: { quantity: 1 } }
            },
            detectRetina: true
        },
        bubbles: {
            particles: {
                number: { value: 100 },
                color: { value: ["#33aaff", "#66ccff"] },
                shape: { type: "circle" },
                opacity: { value: 0.3, random: true, animation: { enable: true, speed: 0.8, minimumValue: 0.1 } },
                size: { value: 10, random: true, animation: { enable: true, speed: 1, minimumValue: 4, maximumValue: 12 } },
                links: { enable: false },
                move: { enable: true, speed: 0.8, direction: "top", random: false, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: true, mode: "push" }, resize: true },
                modes: { push: { quantity: 1 } }
            },
            detectRetina: true
        },
        neon: {
            particles: {
                number: { value: 90 },
                color: { value: ["#ff007f", "#00eaff"] },
                shape: { type: "circle" },
                opacity: { value: 0.8, random: false },
                size: { value: 3, random: false },
                links: { 
                    enable: true, 
                    distance: 200, 
                    color: "#00eaff", 
                    opacity: 0.6, 
                    width: 2,
                    triangles: { enable: true, color: "#ff007f", opacity: 0.05 }
                },
                move: { enable: true, speed: 0.5, direction: "none", random: false, straight: false, outModes: { default: "out" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: false }, resize: true },
                modes: {}
            },
            detectRetina: true
        },
        rainbow: {
            particles: {
                number: { value: 80 },
                color: { value: "random" },
                shape: { type: "circle" },
                opacity: { value: 0.8, random: true, animation: { enable: true, speed: 1.5, minimumValue: 0.4 } },
                size: { value: 6, random: true, animation: { enable: true, speed: 2, minimumValue: 3, maximumValue: 9 } },
                links: { enable: false },
                move: { enable: true, speed: 1, direction: "none", random: true, straight: false, outModes: { default: "bounce" } }
            },
            interactivity: {
                detectsOn: "canvas",
                events: { onClick: { enable: true, mode: "push" }, resize: true },
                modes: { push: { quantity: 1 } }
            },
            detectRetina: true
        }
    };

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
        const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        
        config.particles.number.value = settings.enabled ? (settings.count || 50) : 0;
        
        if (settings.reducedMotion) {
            config.particles.number.value = Math.floor(config.particles.number.value / 2);
        }
        
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
        
        if (settings.colorMode === "single") {
            config.particles.color.value = settings.particleColor || "#0066cc";
        } else if (settings.colorMode === "multiple") {
            config.particles.color.value = settings.colors || ["#0066cc"];
        } else if (settings.colorMode === "random") {
            config.particles.color.value = "random";
        }
        
        const baseSize = settings.size || 3;
        const sizeVariation = settings.sizeVariation || 0;
        
        if (settings.sizeRandom && sizeVariation > 0) {
            const minSize = Math.max(0.1, baseSize * (1 - sizeVariation));
            const maxSize = baseSize * (1 + sizeVariation);
            config.particles.size.value = {
                min: minSize,
                max: maxSize
            };
        } else {
            config.particles.size.value = baseSize;
        }
        
        const baseOpacity = Math.max(0.01, settings.opacity || 0.5);
        const opacityVariation = settings.opacityVariation || 0;
        
        if (settings.opacityRandom && opacityVariation > 0) {
            const minOpacity = Math.max(0.01, baseOpacity * (1 - opacityVariation));
            const maxOpacity = Math.min(1, baseOpacity * (1 + opacityVariation));
            config.particles.opacity.value = {
                min: minOpacity,
                max: maxOpacity
            };
        } else {
            config.particles.opacity.value = baseOpacity;
        }
        
        config.particles.move.enable = settings.moveEnable !== false;
        config.particles.move.speed = settings.moveSpeed || 1;
        
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
            default:
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
        
        if (settings.reducedMotion) {
            config.particles.move.enable = false;
        }
        
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
            enable: false,
            color: settings.lineShadowColor || "#000000",
            blur: settings.lineShadowBlur || 5
        };
        
    config.interactivity.detectsOn = settings.detectOn || "canvas";
    config.interactivity.events.onClick.enable = false;
    config.interactivity.events.onClick.mode = [];
    delete config.interactivity.modes.push;
    delete config.interactivity.modes.remove;
        
        config.interactivity.events.resize = settings.resizeEnable !== false;
        
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
            
            const settings = await loadParticleSettings();
            window.currentParticleSettings = settings;
            
            if (!settings.enabled) {
                particlesContainer.style.display = 'none';
                return;
            }
            
            const config = createParticlesConfig(settings);
            
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
            if (window._particleClickHandler) {
                document.body.removeEventListener('click', window._particleClickHandler);
            }

            window._particleClickHandler = function(e) {
                if (!document.hidden && mainContainer && window.currentParticleSettings?.enabled) {
                    const pos = { x: e.clientX, y: e.clientY };

                    try {
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

    const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionMediaQuery.addEventListener('change', async (e) => {
        const settings = await loadParticleSettings();
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

    document.addEventListener('visibilitychange', () => {
        if (mainContainer && mainContainer.particles) {
            if (document.hidden) {
                mainContainer.pause();
            } else {
                mainContainer.play();
            }
        }
    });

    // resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(async () => {
            const settings = await loadParticleSettings();
            
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

    window.addEventListener('load', function() {
        setTimeout(setupClickHandler, 100); // ensure particles are loaded
    });

    window.addEventListener('unload', function() {
        destroyParticles('main');
        destroyParticles('preview');
    });

    // IndexedDB particle settings
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
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cfg = DEFAULT_CONFIG; // single source of truth

        // Derive color mode & values
        let colorMode = 'single';
        let particleColor = '#ffffff';
        let colors = [];
        if (Array.isArray(cfg.particles.color.value)) {
            colorMode = 'multiple';
            colors = cfg.particles.color.value.slice();
            particleColor = colors[0];
        } else if (cfg.particles.color.value === 'random') {
            colorMode = 'random';
            particleColor = '#ffffff';
            colors = ['#ffffff'];
        } else if (typeof cfg.particles.color.value === 'string') {
            colorMode = 'single';
            particleColor = cfg.particles.color.value;
            colors = [cfg.particles.color.value];
        }

        let size = 3;
        let sizeRandom = false;
        let sizeVariation = 0;
        if (typeof cfg.particles.size.value === 'object') {
            sizeRandom = true;
            size = (cfg.particles.size.value.min + cfg.particles.size.value.max) / 2;
            sizeVariation = (cfg.particles.size.value.max - size) / size || 0;
        } else {
            size = cfg.particles.size.value;
        }

        let opacity = 0.5;
        let opacityRandom = false;
        let opacityVariation = 0;
        if (typeof cfg.particles.opacity.value === 'object') {
            opacityRandom = true;
            opacity = (cfg.particles.opacity.value.min + cfg.particles.opacity.value.max) / 2;
            opacityVariation = (cfg.particles.opacity.value.max - opacity) / opacity || 0;
        } else {
            opacity = cfg.particles.opacity.value;
        }

        const shape = cfg.particles.shape.type;
        const polygonSides = cfg.particles.shape.options?.polygon?.sides || 5;
        const starSides = cfg.particles.shape.options?.star?.sides || 5;
        const imageSource = cfg.particles.shape.options?.image?.src || '';

        let moveType = 'default';
        if (cfg.particles.move.random) moveType = 'random';
        else if (cfg.particles.move.straight) moveType = 'straight';

        const triangles = cfg.particles.links.triangles || { enable: false, color: cfg.particles.links.color, opacity: 0.5 };

        return {
            enabled: cfg.particles.number.value > 0,
            reducedMotion: prefersReducedMotion,
            count: cfg.particles.number.value,
            shape,
            polygonSides,
            starSides,
            imageSource,
            colorMode,
            particleColor,
            colors,
            size,
            sizeRandom,
            sizeVariation,
            opacity,
            opacityRandom,
            opacityVariation,
            moveEnable: cfg.particles.move.enable,
            moveSpeed: cfg.particles.move.speed,
            moveType,
            moveDirection: cfg.particles.move.direction || 'none',
            moveOutMode: (cfg.particles.move.outModes && cfg.particles.move.outModes.default) || 'out',
            moveAttract: cfg.particles.move.attract?.enable || false,
            attractRotateX: cfg.particles.move.attract?.rotateX || 600,
            attractRotateY: cfg.particles.move.attract?.rotateY || 1200,
            lineLinkedEnable: cfg.particles.links.enable,
            lineLinkedDistance: cfg.particles.links.distance,
            lineLinkedColor: cfg.particles.links.color,
            lineLinkedOpacity: cfg.particles.links.opacity,
            lineLinkedWidth: cfg.particles.links.width,
            lineLinkedShadow: false,
            lineWarp: cfg.particles.links.warp || false,
            lineTriangles: triangles.enable || false,
            triangleColor: triangles.color || cfg.particles.links.color,
            triangleOpacity: triangles.opacity ?? 0.5,
            lineShadowColor: cfg.particles.links.shadow?.color || '#000000',
            lineShadowBlur: cfg.particles.links.shadow?.blur || 5,
            detectOn: cfg.interactivity.detectsOn || 'canvas',
            clickMode: (cfg.interactivity.events?.onClick?.mode) || 'push',
            resizeEnable: cfg.interactivity.events?.resize !== false,
            pushParticlesNb: cfg.interactivity.modes?.push?.quantity || 1,
            retinaDetect: cfg.detectRetina !== false
        };
    }

    initParticles();

    window.particleControls = {
        updateConfig: async function(settings) {
            if (!settings) return;
            
            if (updateConfigRunning) {
                console.log('UpdateConfig already running, skipping');
                return;
            }
            updateConfigRunning = true;
            
            try {
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

    initParticles();
})();