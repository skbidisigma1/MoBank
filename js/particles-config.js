(function() {

  function initParticles() {
    const particlesContainer = document.getElementById('particles-js');
    
    if (!particlesContainer) {
      console.warn('Particles container not found, will retry in 500 ms');
      setTimeout(initParticles, 500);
      return;
    }
    
    if (typeof particlesJS === 'undefined') {
      console.warn('particlesJS library not loaded yet, will retry in 500 ms');
      setTimeout(initParticles, 500);
      return;
    }

    console.log('Initializing particles.js');
    
    try {
      particlesJS('particles-js', {
        "particles": {
          "number": {
            "value": 40,
            "density": {
              "enable": true,
              "value_area": 800
            }
          },
          "color": {
            "value": "#0066cc"
          },
          "shape": {
            "type": "circle",
            "stroke": {
              "width": 0,
              "color": "#000000"
            },
            "polygon": {
              "nb_sides": 5
            }
          },
          "opacity": {
            "value": 0.3,
            "random": false,
            "anim": {
              "enable": false,
              "speed": 0.8,
              "opacity_min": 0.1,
              "sync": false
            }
          },
          "size": {
            "value": 3,
            "random": true,
            "anim": {
              "enable": false,
              "speed": 40,
              "size_min": 0.1,
              "sync": false
            }
          },
          "line_linked": {
            "enable": true,
            "distance": 160,
            "color": "#0066cc",
            "opacity": 0.3,
            "width": 1
          },
          "move": {
            "enable": true,
            "speed": 1,
            "direction": "none",
            "random": false,
            "straight": false,
            "out_mode": "bounce",
            "bounce": false,
            "attract": {
              "enable": false,
              "rotateX": 600,
              "rotateY": 1200
            }
          }
        },
        "interactivity": {
          "detect_on": "canvas",
          "events": {
            "onhover": {
              "enable": true,
              "mode": "grab"
            },
            "onclick": {
              "enable": true,
              "mode": "push"
            },
            "resize": true
          },
          "modes": {
            "grab": {
              "distance": 140,
              "line_linked": {
                "opacity": 1
              }
            },
            "bubble": {
              "distance": 400,
              "size": 40,
              "duration": 2,
              "opacity": 8,
              "speed": 3
            },
            "repulse": {
              "distance": 200,
              "duration": 0.4
            },
            "push": {
              "particles_nb": 4
            },
            "remove": {
              "particles_nb": 2
            }
          }
        },
        "retina_detect": true
      });

      setTimeout(() => {
        const canvas = document.querySelector('#particles-js canvas');
        if (!canvas) {
            console.error('Canvas element was not created. Something is wrong with particles.js initialization.');
        
            if (!document.querySelector('#particles-js canvas.fallback')) {  
              const canvasFallback = Object.assign(document.createElement('canvas'), {
                className: 'fallback',
                style: `
                  width: 100%;
                  height: 100%;
                  position: absolute;
                  top: 0;
                  left: 0;
                  z-index: -1;
                `
              });
        
              particlesContainer.appendChild(canvasFallback);
            }
        }
        }, 500);
    } catch (error) {
      console.error('Error initializing particles.js:', error);
    }
  }

  initParticles();

  window.addEventListener('load', function() {
    const canvas = document.querySelector('#particles-js canvas');
    if (!canvas) {
      console.log('No particles canvas found on window load, reinitializing');
      initParticles();
    }
  });
})();