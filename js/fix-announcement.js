document.addEventListener('DOMContentLoaded', function() {
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
  
  setTimeout(() => {
    try {
      const originalUpdateFn = window.handleUpdateAnnouncement;
      if (originalUpdateFn) {
        window.handleUpdateAnnouncement = async function(form) {
          try {
            const id = form && form.dataset ? form.dataset.announcementId : null;
            if (!id) {
              window.showToast('Error', 'Missing announcement ID');
              return;
            }
            
            const exists = await window.checkAnnouncementExists(id);
            if (!exists) {
              window.showToast('Error', 'This announcement has been deleted and cannot be updated');
              
              if (typeof window.resetAnnouncementForm === 'function') {
                window.resetAnnouncementForm();
              }
              
              if (typeof window.loadCurrentAnnouncements === 'function') {
                window.loadCurrentAnnouncements();
              }
              
              return;
            }
            
            return originalUpdateFn.apply(this, arguments);
          } catch (error) {
            console.error('Error in patched handleUpdateAnnouncement:', error);
            return originalUpdateFn.apply(this, arguments);
          }
        };
      }
      const originalDeleteFn = window.handleDeleteAnnouncement;
      if (originalDeleteFn) {
        window.handleDeleteAnnouncement = async function(announcementId) {
          try {
            if (!announcementId) {
              window.showToast('Error', 'Missing announcement ID');
              return;
            }
            
            const form = document.getElementById('announcement-form');
            const isEditingThisAnnouncement = form && form.dataset && form.dataset.announcementId === announcementId;
            
            const result = await originalDeleteFn.apply(this, arguments);
            
            if (isEditingThisAnnouncement) {
              
              if (typeof window.resetAnnouncementForm === 'function') {
                setTimeout(() => window.resetAnnouncementForm(), 50);
              }
            }
            
            return result;
          } catch (error) {
            console.error('Error in patched handleDeleteAnnouncement:', error);
            return originalDeleteFn.apply(this, arguments);
          }
        };
      }
      
    } catch (error) {
      console.error('Failed to apply announcement deletion safety patch:', error);
    }
  }, 1000);
});
