document.addEventListener('DOMContentLoaded', () => {
    setupToolCardButtons();
});

function setupToolCardButtons() {
    const toolButtons = document.querySelectorAll('.tool-card-button');
    
    toolButtons.forEach(button => {
        button.addEventListener('click', handleToolButtonClick);
    });
}

function handleToolButtonClick(e) {
    const toolType = e.currentTarget.getAttribute('data-tool');
    
    showToolComingSoon(toolType);
}

function showToolComingSoon(toolType) {
    if (typeof showToast === 'function') {
        showToast('Coming Soon', `The ${formatToolName(toolType)} will be available soon!`, 'info');
    } else {
        alert(`The ${formatToolName(toolType)} is coming soon!`);
    }
}

function formatToolName(toolType) {
    switch(toolType) {
        case 'tuner':
            return 'Tuner';
        case 'metronome':
            return 'Metronome';
        case 'movault':
            return 'MoVault';
        default:
            return toolType.charAt(0).toUpperCase() + toolType.slice(1);
    }
}

function navigateToTool(toolType) {
    const toolUrls = {
        'tuner': '/tools/tuner',
        'metronome': '/tools/metronome',
        'movault': '/tools/movault'
    };
    
    const url = toolUrls[toolType];
    if (url) {
        window.location.href = url;
    }
}