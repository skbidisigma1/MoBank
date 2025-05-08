// This script fixes the issue with deleting an announcement while editing it
document.addEventListener('DOMContentLoaded', function() {
  // Add a safety check function to the global scope
  window.checkAnnouncementExists = async function(id) {
    try {
      if (!id) return false;
      
      const token = await window.getToken();
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error checking announcement existence:', error);
      return false;
    }
  };
  
  // Wait for the admin page to fully load
  setTimeout(() => {
    try {      // Create a patched version of the handleUpdateAnnouncement function
      const originalUpdateFn = window.handleUpdateAnnouncement;
      if (originalUpdateFn) {
        window.handleUpdateAnnouncement = async function(form) {
          try {
            // Get the announcement ID
            const id = form && form.dataset ? form.dataset.announcementId : null;
            if (!id) {
              window.showToast('Error', 'Missing announcement ID');
              return;
            }
            
            // Check if the announcement still exists
            const exists = await window.checkAnnouncementExists(id);
            if (!exists) {
              window.showToast('Error', 'This announcement has been deleted and cannot be updated');
              
              // Reset the form
              if (typeof window.resetAnnouncementForm === 'function') {
                window.resetAnnouncementForm();
              }
              
              // Reload announcements list
              if (typeof window.loadCurrentAnnouncements === 'function') {
                window.loadCurrentAnnouncements();
              }
              
              return;
            }
            
            // If announcement exists, call the original function
            return originalUpdateFn.apply(this, arguments);
          } catch (error) {
            console.error('Error in patched handleUpdateAnnouncement:', error);
            // Fallback to original function
            return originalUpdateFn.apply(this, arguments);
          }
        };
      }
        // Create a patched version of the handleDeleteAnnouncement function
      const originalDeleteFn = window.handleDeleteAnnouncement;
      if (originalDeleteFn) {
        window.handleDeleteAnnouncement = async function(announcementId) {
          try {
            if (!announcementId) {
              window.showToast('Error', 'Missing announcement ID');
              return;
            }
            
            // Store if we're currently editing the announcement being deleted
            const form = document.getElementById('announcement-form');
            const isEditingThisAnnouncement = form && form.dataset && form.dataset.announcementId === announcementId;
            
            // Delete confirmation is handled in the original function
            // Just call the original function
            const result = await originalDeleteFn.apply(this, arguments);
            
            // After deletion succeeds, check if we need to reset the form
            if (isEditingThisAnnouncement) {
              console.log('Resetting edit form after deletion of the announcement being edited');
              
              // Reset the form
              if (typeof window.resetAnnouncementForm === 'function') {
                setTimeout(() => window.resetAnnouncementForm(), 50);
              }
            }
            
            return result;
          } catch (error) {
            console.error('Error in patched handleDeleteAnnouncement:', error);
            // Fallback to original function
            return originalDeleteFn.apply(this, arguments);
          }
        };
      }
      
      console.log('Announcement deletion safety patch applied successfully');
    } catch (error) {
      console.error('Failed to apply announcement deletion safety patch:', error);
    }
  }, 1000); // Wait 1 second for the main admin.js to initialize
});
