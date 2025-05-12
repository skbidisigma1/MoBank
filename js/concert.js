document.addEventListener('DOMContentLoaded', () => {
  const concertSection = document.getElementById('concert-schedule-section');
  const concertList = document.getElementById('concert-list');
  const concertHeader = document.getElementById('concert-header');
  
  if (!concertSection || !concertList || !concertHeader) return;

  concertHeader.addEventListener('click', () => {
    concertSection.classList.toggle('concert-section-expanded');
    const isExpanded = concertSection.classList.contains('concert-section-expanded');
    concertHeader.setAttribute('aria-expanded', isExpanded);
    concertList.setAttribute('aria-hidden', !isExpanded);
  });

  concertHeader.setAttribute('aria-expanded', 'false');
  concertList.setAttribute('aria-hidden', 'true');

  fetch('data/concert.json')
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        concertList.innerHTML = '<p>No concerts scheduled yet. Check back soon!</p>';
        return;
      }

      concertList.innerHTML = data.map(concert => {
        let formattedDate = concert.date || 'TBD';
        // Special formatting for graduation performance
        if (concert.title === "Graduation Performance") {
          formattedDate = "Wednesday, May 21, 2025 (departing just before 1:00 PM)";
        } else if (concert.date && concert.date.includes('-')) {
          try {
            const dateObj = new Date(concert.date);
            formattedDate = dateObj.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric'
            });
          } catch (e) {
          }
        }

        const rehearsalBlock = concert.rehearsals?.length
          ? `<div class="concert-rehearsals">
              <strong>Dress Rehearsals:</strong>
              <ul>${concert.rehearsals.map(r => `<li>${r}</li>`).join('')}</ul>
            </div>`
          : '';        const attireBlock = concert.attire && concert.attire.trim() !== ''
          ? `<div class="concert-attire"><strong>Dress:</strong> ${concert.attire}</div>`
          : '';

        const extraNotes = concert.notes
          ? `<p class="concert-notes">${concert.notes}</p>`
          : '';

        return `
          <div class="concert-item">
            <h3>${concert.title || 'Untitled Concert'}</h3>
            <div class="concert-date"><strong>Date:</strong> ${formattedDate}</div>
            <div class="concert-location"><strong>Location:</strong> ${concert.location || 'TBD'}</div>
            ${attireBlock}
            ${rehearsalBlock}
            ${extraNotes}
          </div>
        `;
      }).join('');
    })
    .catch(() => {
      concertList.innerHTML = '<p style="color:var(--color-danger)">Could not load concert schedule.</p>';
    });

  const carouselSection = document.getElementById('concert-flyer-carousel-section');
  if (carouselSection) {
    const slidesContainer = carouselSection.querySelector('.carousel-slides-container');
    const slides = Array.from(carouselSection.querySelectorAll('.carousel-slide')); // Convert NodeList to Array
    const prevButton = document.getElementById('carousel-prev-btn');
    const nextButton = document.getElementById('carousel-next-btn');
    const indicatorsContainer = document.getElementById('carousel-indicators-container');
    
    let currentSlideIndex = 0;
    const totalSlides = slides.length;

    if (totalSlides > 0) {
      slides.forEach((slide, i) => {
        const button = document.createElement('button');
        button.classList.add('carousel-indicator');
        button.setAttribute('aria-label', `Go to slide ${i + 1}`);
        button.dataset.slideTo = i;
        button.textContent = i + 1; // Add slide number to indicator
        indicatorsContainer.appendChild(button);
      });
      
      const indicators = Array.from(indicatorsContainer.querySelectorAll('.carousel-indicator')); // Convert NodeList to Array

      function showSlide(index) {
        if (index < 0 || index >= totalSlides) {
          console.warn('Invalid slide index:', index);
          return;
        }
        
        // Apply sliding animation
        slidesContainer.style.transform = `translateX(-${index * 100}%)`;
        
        // Update active indicator
        indicators.forEach((indicator, i) => {
          indicator.classList.toggle('active-indicator', i === index);
        });
        
        currentSlideIndex = index;
      }

      prevButton.addEventListener('click', () => {
        const newIndex = (currentSlideIndex - 1 + totalSlides) % totalSlides;
        showSlide(newIndex);
      });

      nextButton.addEventListener('click', () => {
        const newIndex = (currentSlideIndex + 1) % totalSlides;
        showSlide(newIndex);
      });

      indicators.forEach(indicator => {
        indicator.addEventListener('click', (e) => {
          const slideToIndex = parseInt(e.target.dataset.slideTo, 10);
          if (!isNaN(slideToIndex)) {
            showSlide(slideToIndex);
          }
        });
      });
      
      // Add keyboard navigation
      carouselSection.setAttribute('tabindex', '0'); // Make the section focusable
      carouselSection.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          const newIndex = (currentSlideIndex - 1 + totalSlides) % totalSlides;
          showSlide(newIndex);
        } else if (e.key === 'ArrowRight') {
          const newIndex = (currentSlideIndex + 1) % totalSlides;
          showSlide(newIndex);
        } else if (e.key >= '1' && e.key <= totalSlides.toString()) {
          const numKey = parseInt(e.key, 10);
          if (numKey > 0 && numKey <= totalSlides) {
            showSlide(numKey - 1);
          }
        }
      });

      // Initialize with a small delay to ensure DOM is fully ready
      setTimeout(() => {
        showSlide(0);
      }, 100);
    } else {
      if (prevButton) prevButton.style.display = 'none';
      if (nextButton) nextButton.style.display = 'none';
      if (indicatorsContainer) indicatorsContainer.style.display = 'none';
      const heading = carouselSection.querySelector('.concert-flyer-heading');
      if(heading) heading.textContent = 'Concert Flyer Coming Soon!';

    }
  }
});