document.addEventListener('DOMContentLoaded', async () => {
    console.log("Stewart likes Bailey");
    
    // Wait for auth0 to be ready
    try {
        await window.auth0Promise;
    } catch (error) {
        console.error('Auth initialization error:', error);
        return;
    }
    
    const ctx = document.getElementById('cuteChart').getContext('2d');
    const labels = [
        'Smile', 'Eyes', 'Voice', 'Laugh', 'Face', 'Style',
        'Body Language', 'Hair', 'Height', 'Personality',
        'Shyness', 'Playfulness'
    ];
    const initialData = labels.map(() => 0);
    const colors = [
        'rgba(255,99,132,0.6)',
        'rgba(255,159,64,0.6)',
        'rgba(255,205,86,0.6)',
        'rgba(75,192,192,0.6)',
        'rgba(54,162,235,0.6)',
        'rgba(153,102,255,0.6)',
        'rgba(201,203,207,0.6)',
        'rgba(255,99,132,0.6)',
        'rgba(255,159,64,0.6)',
        'rgba(255,205,86,0.6)',
        'rgba(75,192,192,0.6)',
        'rgba(54,162,235,0.6)'
    ];

    const cuteChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,            datasets: [{
                label: 'Cuteness',
                data: initialData,
                backgroundColor: 'rgba(255,182,193,0.3)',
                borderColor: 'rgba(255,105,180,1)',
                borderWidth: 3,
                pointBackgroundColor: colors,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: colors,
                pointHoverRadius: 8
            }]
        },        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    angleLines: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        beginAtZero: true,
                        min: 0,
                        max: 5,
                        stepSize: 1,
                        backdropColor: 'rgba(255,255,255,0.8)',
                        font: { 
                            size: function(context) {
                                const width = context.chart.width;
                                return width < 500 ? 10 : width < 800 ? 12 : 14;
                            }
                        },
                        display: true,
                        showLabelBackdrop: true
                    },
                    pointLabels: {
                        font: { 
                            size: function(context) {
                                const width = context.chart.width;
                                return width < 500 ? 11 : width < 800 ? 13 : 15;
                            },
                            family: 'Poppins' 
                        },
                        color: '#444'
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });    // Chart.js handles responsiveness automatically with responsive: true and maintainAspectRatio: true

    const sliders = document.querySelectorAll('.slider-container input[type="range"]');
    sliders.forEach(slider => {
        slider.addEventListener('input', () => {
            const category = slider.dataset.category;
            const value = parseInt(slider.value, 10);
            const idx = labels.indexOf(category);
            
            // Update chart data
            if (idx !== -1) {
                cuteChart.data.datasets[0].data[idx] = value;
                cuteChart.update();
            }
              // Update value display
            const valueDisplay = slider.nextElementSibling;
            if (valueDisplay && valueDisplay.classList.contains('slider-value')) {
                valueDisplay.textContent = value;
            }
            
            // Update simp calculator
            updateSimpScore();
        });
    });

    // Simp calculator logic
    function updateSimpScore() {
        // Get current values from sliders
        const values = {};
        sliders.forEach(slider => {
            const category = slider.dataset.category;
            values[category] = parseInt(slider.value, 10);
        });

        // Calculate simp score using the weights
        const simpScore = 
            (values['Eyes'] || 0) * 15 +
            (values['Smile'] || 0) * 12 +
            (values['Voice'] || 0) * 10 +
            (values['Height'] || 0) * 10 +
            (values['Face'] || 0) * 10 +
            (values['Hair'] || 0) * 8 +
            (values['Style'] || 0) * 8 +
            (values['Laugh'] || 0) * 7 +
            (values['Body Language'] || 0) * 7 +
            (values['Playfulness'] || 0) * 5 +
            (values['Shyness'] || 0) * 4 +
            (values['Personality'] || 0) * 4;

        // Update display
        const scoreElement = document.getElementById('simp-score');
        const barElement = document.getElementById('simp-bar');
        const levelElement = document.getElementById('simp-level');

        if (scoreElement) scoreElement.textContent = simpScore/5;
        
        const percentage = Math.min((simpScore / 500) * 100, 100);
        if (barElement) barElement.style.width = percentage + '%';

        let level, color;
        if (simpScore <= 50) {
            level = "Not a Simp";
            color = "#4CAF50";
        } else if (simpScore <= 100) {
            level = "Perhaps Maybe a Simp";
            color = "#8BC34A";
        } else if (simpScore <= 150) {
            level = "Quite Possibly a Simp";
            color = "#CDDC39";
        } else if (simpScore <= 200) {
            level = "Mild Simp";
            color = "#FFC107";
        } else if (simpScore <= 250) {
            level = "Decently Simp";
            color = "#FF9800";
        } else if (simpScore <= 300) {
            level = "Simp";
            color = "#FF5722";
        } else if (simpScore <= 350) {
            level = "Certified Simp";
            color = "#F44336";
        } else if (simpScore <= 400) {
            level = "Extreme Simp";
            color = "#E91E63";
        } else if (simpScore <= 450) {
            level = "Mega Simp";
            color = "#9C27B0";
        } else {
            level = "Stewart-Level Simp";
            color = "#673AB7";
        }

        if (levelElement) {
            levelElement.textContent = level;
            levelElement.style.color = color;
            levelElement.style.borderColor = color + '40';
        }
    }    // Download chart functionality
    const downloadBtn = document.getElementById('download-chart');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            // Ask user who they are rating
            const ratedUser = prompt("Who are you rating?");
            if (!ratedUser || ratedUser.trim() === '') {
                return; // User cancelled or entered empty name
            }
            
            // Get current user name for display
            let currentUserName = 'User';
            try {
                await window.auth0Promise;
                const user = await getUser();
                if (user && user.name) {
                    currentUserName = user.name;
                }
            } catch (error) {
                console.error('Error getting current user:', error);
                // Continue with default 'User' name
            }
            
            // Create a temporary canvas with white background and extra padding
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            // Add padding (whitespace) around the chart
            const padding = 80; // Increased padding for more text
            tempCanvas.width = ctx.canvas.width + (padding * 2);
            tempCanvas.height = ctx.canvas.height + (padding * 2);
            
            // Fill with white background
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Draw the chart centered with padding
            tempCtx.drawImage(ctx.canvas, padding, padding);
            
            // Add rating information and simp score to the image
            const currentScore = document.getElementById('simp-score')?.textContent || '0';
            const currentLevel = document.getElementById('simp-level')?.textContent || 'Completely Rational';
            
            // Set up text styling
            tempCtx.fillStyle = '#333333';
            tempCtx.textAlign = 'center';
            
            // Add main title
            tempCtx.font = 'bold 28px Poppins, Arial, sans-serif';
            tempCtx.fillText('Cuteness Chart', tempCanvas.width / 2, 35);
            
            // Add rating information
            tempCtx.font = 'bold 18px Poppins, Arial, sans-serif';
            tempCtx.fillStyle = '#2196F3';
            tempCtx.fillText(`${currentUserName} rates ${ratedUser.trim()}`, tempCanvas.width / 2, 60);
            
            // Add simp score
            tempCtx.font = 'bold 20px Poppins, Arial, sans-serif';
            tempCtx.fillStyle = '#ff1493';
            tempCtx.fillText(`Simp Score: ${currentScore} / 100`, tempCanvas.width / 2, tempCanvas.height - 45);
            
            // Add simp level
            tempCtx.font = '16px Poppins, Arial, sans-serif';
            tempCtx.fillStyle = '#666666';
            tempCtx.fillText(`Level: ${currentLevel}`, tempCanvas.width / 2, tempCanvas.height - 22);
            
            // Generate filename with current date and rated user
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            const safeName = ratedUser.trim().replace(/[^a-zA-Z0-9]/g, '-');
            const filename = `cuteness-chart-${safeName}-${dateStr}-${timeStr}.png`;
            
            // Create download link
            tempCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = filename;
                link.href = url;
                link.click();
                
                // Clean up
                URL.revokeObjectURL(url);            }, 'image/png', 1.0);
        });
    }
});