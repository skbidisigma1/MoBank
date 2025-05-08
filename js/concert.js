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

  // Set initial state to collapsed
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
});