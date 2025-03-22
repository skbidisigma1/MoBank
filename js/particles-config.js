(function() {
  let pJSInstance = null;
  let retryCount = 0;
  const MAX_RETRIES = 5;

  function initParticles() {
    if (retryCount >= MAX_RETRIES) {
      console.warn(`Particles.js initialization failed after ${MAX_RETRIES} attempts. Giving up.`);
      return;
    }

    retryCount++;
    const particlesContainer = document.getElementById('particles-js');
    
    if (!particlesContainer) {
      console.warn(`Particles container not found, will retry in 500 ms (attempt ${retryCount}/${MAX_RETRIES})`);
      setTimeout(initParticles, 500);
      return;
    }
    
    if (typeof particlesJS === 'undefined') {
      console.warn(`particlesJS library not loaded yet, will retry in 500 ms (attempt ${retryCount}/${MAX_RETRIES})`);
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
            "random": true,
            "anim": {
              "enable": true,
              "speed": 0.5,
              "opacity_min": 0.25,
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
            "distance": 150,
            "color": "#0066cc",
            "opacity": 0.4,
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
          "detect_on": "window",
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
              "distance": 120,
              "line_linked": {
                "opacity": 0.5
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
              "particles_nb": 1
            },
            "remove": {
              "particles_nb": 2
            }
          }
        },
        "retina_detect": true
      });
    } catch (error) {
      console.error('Error initializing particles.js:', error);
    }
  }

  function setupClickHandler() {
    if (typeof pJSDom !== 'undefined' && pJSDom.length > 0 && pJSDom[0].pJS) {
      document.body.addEventListener('click', function(e) {
        const pos = {
          x: e.clientX,
          y: e.clientY
        };
        
        try {
          pJSDom[0].pJS.interactivity.mouse.click_pos.x = pos.x;
          pJSDom[0].pJS.interactivity.mouse.click_pos.y = pos.y;
          pJSDom[0].pJS.interactivity.mouse.click_time = new Date().getTime();
          pJSDom[0].pJS.fn.modes.pushParticles(4, pos);
        } catch (err) {
          console.warn('Could not add particles on click', err);
        }
      });
      console.log('Global click handler for particles attached to body');
      return true;
    }
    return false;
  }

  initParticles();
  
  function checkAndSetupParticles() {
    if (typeof pJSDom !== 'undefined' && pJSDom.length > 0) {
      if (setupClickHandler()) {
        console.log('Particles click handler initialized successfully');
      }
    } else {
      setTimeout(checkAndSetupParticles, 1000);
    }
  }
  
  window.addEventListener('load', function() {
    checkAndSetupParticles();
  });
})();