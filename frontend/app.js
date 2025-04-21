// Initialize event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    const storedTheme = localStorage.getItem('theme') || 'dark';

    // Set initial theme
    document.body.setAttribute('data-theme', storedTheme);

    themeToggle.addEventListener('click', function() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Landing page to app transition
    const startAppButton = document.getElementById('start-app');
    const landingPage = document.getElementById('landing-page');
    const appContainer = document.getElementById('app-container');

    startAppButton.addEventListener('click', function() {
        landingPage.style.opacity = '0';
        landingPage.style.transition = 'opacity 0.5s ease';

        setTimeout(() => {
            landingPage.style.display = 'none';
            appContainer.style.display = 'block';

            // Trigger a reflow to enable animations
            void appContainer.offsetWidth;

            // Add fade-in animation to app container
            appContainer.style.animation = 'fadeIn 0.5s ease-out forwards';
        }, 500);
    });

    // Position selection on football pitch
    const positionMarkers = document.querySelectorAll('.position-marker');
    const selectedPositionText = document.querySelector('#selected-position span');
    let selectedPosition = null;

    positionMarkers.forEach(marker => {
        marker.addEventListener('click', function() {
            // Remove selected class from all markers
            positionMarkers.forEach(m => m.classList.remove('selected'));

            // Add selected class to clicked marker
            this.classList.add('selected');

            // Update selected position
            selectedPosition = this.getAttribute('data-position');

            // Update text
            const positionName = this.getAttribute('title');
            selectedPositionText.textContent = positionName;
            selectedPositionText.style.color = 'var(--secondary)';
        });
    });

    // File input change handler
    const fileInput = document.getElementById('videoInput');
    const fileNameDisplay = document.getElementById('fileName');

    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            fileNameDisplay.textContent = this.files[0].name;
            fileNameDisplay.style.display = 'block';
            document.querySelector('.file-input-label').classList.add('file-selected');
        } else {
            fileNameDisplay.textContent = '';
            fileNameDisplay.style.display = 'none';
            document.querySelector('.file-input-label').classList.remove('file-selected');
        }
    });

    // Drag and drop functionality
    const dropArea = document.querySelector('.file-input-label');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('highlight');
    }

    function unhighlight() {
        dropArea.classList.remove('highlight');
    }

    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files && files.length) {
            fileInput.files = files;
            fileNameDisplay.textContent = files[0].name;
            fileNameDisplay.style.display = 'block';
            document.querySelector('.file-input-label').classList.add('file-selected');
        }
    }

    // Add click event listener to the analyze button
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', function() {
            console.log('Analyze button clicked');
            startAnalysis();
        });
    } else {
        console.error('Analyze button not found in the DOM');
    }

    // Make selectedPosition available globally
    window.getSelectedPosition = function() {
        return selectedPosition;
    };
});

async function startAnalysis() {
    console.log('startAnalysis function called');
    const fileInput = document.getElementById('videoInput');
    const file = fileInput.files[0];
    const analyzeBtn = document.getElementById('analyzeBtn');
    const selectedPosition = window.getSelectedPosition ? window.getSelectedPosition() : null;

    console.log('Selected position:', selectedPosition);
    console.log('File selected:', file ? file.name : 'No file');

    if (!file) {
        showNotification('الرجاء اختيار ملف فيديو أولاً', 'error');
        return;
    }

    // Update step indicator
    document.getElementById('step-upload').classList.add('completed');
    document.getElementById('step-analyze').classList.add('active');

    // Hide upload section
    document.getElementById('upload-section').style.display = 'none';

    // Show loading
    analyzeBtn.disabled = true;
    analyzeBtn.classList.add('loading');
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('resultsContainer').innerHTML = '';

    try {
        const formData = new FormData();
        formData.append('video', file);

        // Always send the position, even if null (for debugging)
        formData.append('position', selectedPosition || 'NONE');
        console.log('Analyzing with position:', selectedPosition || 'NONE');

        console.log('Sending request to server...');
        let response;
        try {
            response = await fetch('http://localhost:3000/analyze', {
                method: 'POST',
                body: formData
            });

            console.log('Response received:', response.status);
        } catch (fetchError) {
            console.error('Fetch error:', fetchError);
            throw fetchError;
        }

        if (!response.ok) {
            throw new Error(`خطأ في الخادم: ${response.status}`);
        }

        console.log('Parsing response as JSON...');
        const results = await response.json();
        console.log('Results:', results);

        // Update step indicator
        document.getElementById('step-analyze').classList.remove('active');
        document.getElementById('step-analyze').classList.add('completed');
        document.getElementById('step-results').classList.add('active');

        showResults(results);
        showNotification('تم تحليل الفيديو بنجاح', 'success');
    } catch (error) {
        console.error('Analysis error:', error);
        showNotification('حدث خطأ أثناء التحليل', 'error');

        // Reset step indicator
        document.getElementById('step-analyze').classList.remove('active');
        document.getElementById('step-upload').classList.remove('completed');

        // Show upload section again
        document.getElementById('upload-section').style.display = 'block';

        document.getElementById('resultsContainer').innerHTML = `
            <div class="error-card">
                <h3><i class="fas fa-exclamation-triangle"></i> حدث خطأ أثناء التحليل</h3>
                <p>${error.message}</p>
                <p>يرجى المحاولة مرة أخرى باستخدام ملف فيديو آخر</p>
            </div>
        `;
    } finally {
        document.getElementById('loading').style.display = 'none';
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('loading');
    }
}

// Show notification
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-icon">
            ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>'}
        </div>
        <div class="notification-message">${message}</div>
    `;

    // Add to DOM
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function showResults(data) {
    const container = document.getElementById('resultsContainer');

    // Use the strengths and weaknesses from the API if available, otherwise generate them
    const strengths = data.strengths && data.strengths.length > 0 ? data.strengths : extractStrengthsAndWeaknesses(data).strengths;
    const weaknesses = data.weaknesses && data.weaknesses.length > 0 ? data.weaknesses : extractStrengthsAndWeaknesses(data).weaknesses;

    // Use the recommendations from the API if available, otherwise generate them
    const recommendations = data.recommendations && data.recommendations.length > 0 ? data.recommendations : generateRecommendations(weaknesses);

    // Get player position and playing style
    const position = data.position || "غير محدد";
    const playingStyle = data.playingStyle || "غير محدد";

    // Get similar players if available
    const similarPlayers = data.similarPlayers || [];

    // Format the detailed analysis with highlighting
    let formattedAnalysis = data.detailedAnalysis || 'لا يوجد تحليل متاح';

    // Highlight numbers and important terms
    formattedAnalysis = formattedAnalysis
        .replace(/([0-9]+)(\/100)/g, '<span class="highlight">$1$2</span>')
        .replace(/(\d+)\s*\(/g, '<span class="highlight">$1</span> (')
        .replace(/غير متوفر/g, '<span class="highlight">غير متوفر</span>');

    // Create the results UI
    container.innerHTML = `
        <section class="result-section">
            <div class="result-header">
                <h2><i class="fas fa-chart-line"></i> نتائج تحليل الأداء</h2>
                <p>تحليل شامل لأداء اللاعب باستخدام الذكاء الاصطناعي</p>
            </div>

            <div class="result-body">
                <div class="result-tabs">
                    <div class="result-tab active" data-tab="overview">نظرة عامة</div>
                    <div class="result-tab" data-tab="detailed">التحليل المفصل</div>
                    <div class="result-tab" data-tab="recommendations">التوصيات</div>
                </div>

                <div class="tab-content active" id="overview-tab">
                    <div class="player-info">
                        <div class="player-position">
                            <h3><i class="fas fa-user-tag"></i> مركز اللاعب</h3>
                            <p>${position}</p>
                        </div>
                        <div class="player-style">
                            <h3><i class="fas fa-running"></i> أسلوب اللعب</h3>
                            <p>${playingStyle}</p>
                        </div>
                    </div>

                    <div class="performance-overview">
                        <div class="performance-gauge">
                            <div class="gauge-container">
                                <div class="gauge-background"></div>
                                <div class="gauge-fill" style="transform: rotate(0deg);"></div>
                                <div class="gauge-center">
                                    <div class="gauge-value">${data.performance}</div>
                                    <div class="gauge-label">من 100</div>
                                </div>
                            </div>
                            <div class="gauge-label">التقييم العام للأداء</div>
                        </div>

                        <div class="performance-stats">
                            <div class="stat-grid">
                                ${renderGeneralStats(data)}
                            </div>
                        </div>
                    </div>

                    <!-- Position-specific stats section -->
                    <div class="position-specific-stats">
                        <h3 class="section-title"><i class="fas fa-user-tag"></i> مهارات خاصة بمركز ${data.positionFull || position}</h3>
                        <div class="stat-grid">
                            ${renderPositionSpecificStats(data)}
                        </div>
                    </div>

                    <div class="strengths-weaknesses">
                        <div class="strength-section">
                            <h3 class="section-title"><i class="fas fa-star"></i> نقاط القوة</h3>
                            <ul class="point-list">
                                ${strengths.map(strength => `<li>${strength}</li>`).join('')}
                            </ul>
                        </div>

                        <div class="weakness-section">
                            <h3 class="section-title"><i class="fas fa-exclamation-circle"></i> مجالات التحسين</h3>
                            <ul class="point-list">
                                ${weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                            </ul>
                        </div>
                    </div>

                    ${similarPlayers.length > 0 ? `
                    <div class="similar-players">
                        <h3 class="section-title"><i class="fas fa-user-friends"></i> لاعبين مشابهين</h3>
                        <ul class="point-list">
                            ${similarPlayers.map(player => `<li>${player}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>

                <div class="tab-content" id="detailed-tab">
                    <div class="detailed-analysis">
                        <div class="analysis-content">${formattedAnalysis}</div>
                    </div>
                </div>

                <div class="tab-content" id="recommendations-tab">
                    <div class="recommendations">
                        <h3><i class="fas fa-lightbulb"></i> توصيات لتحسين الأداء</h3>
                        <ul>
                            ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="action-button primary" onclick="window.print()">
                        <i class="fas fa-print"></i>
                        طباعة التقرير
                    </button>
                    <button class="action-button secondary" onclick="resetAnalysis()">
                        <i class="fas fa-redo"></i>
                        تحليل فيديو جديد
                    </button>
                </div>
            </div>
        </section>
    `;

    // Add tab switching functionality
    const tabs = document.querySelectorAll('.result-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');

            // Hide all tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });

    setTimeout(() => {
        const gaugeFill = document.querySelector('.gauge-fill');
        if (gaugeFill) {
            const percentage = Math.min(Math.max(parseFloat(data.performance), 0), 100);
            gaugeFill.style.transform = `rotate(${percentage * 1.8}deg)`;

            let gradientColors;
            if (percentage >= 70) {
                gradientColors = 'conic-gradient(var(--green) 0%, var(--secondary) 50%, transparent 50%, transparent 100%)';
            } else if (percentage >= 40) {
                gradientColors = 'conic-gradient(var(--yellow) 0%, var(--secondary) 50%, transparent 50%, transparent 100%)';
            } else {
                gradientColors = 'conic-gradient(var(--red) 0%, var(--yellow) 50%, transparent 50%, transparent 100%)';
            }
            gaugeFill.style.background = gradientColors;
        }
    }, 100);
}

function extractStrengthsAndWeaknesses(data) {
    const strengths = [];
    const weaknesses = [];

    if (data.ballControl >= 75) strengths.push(`مستوى ممتاز في التحكم بالكرة (${data.ballControl}%)`);
    else if (data.ballControl < 60) weaknesses.push(`يحتاج إلى تحسين التحكم بالكرة (${data.ballControl}%)`);

    if (data.dribbling >= 75) strengths.push(`مهارة عالية في المراوغة (${data.dribbling}%)`);
    else if (data.dribbling < 60) weaknesses.push(`يحتاج إلى تطوير مهارات المراوغة (${data.dribbling}%)`);

    if (data.shooting >= 75) strengths.push(`دقة عالية في التسديد (${data.shooting}%)`);
    else if (data.shooting < 60) weaknesses.push(`يحتاج إلى تحسين دقة التسديد (${data.shooting}%)`);

    if (data.tacticalReading >= 75) strengths.push(`قراءة تكتيكية ممتازة للعب (${data.tacticalReading}%)`);
    else if (data.tacticalReading < 60) weaknesses.push(`يحتاج إلى تطوير القراءة التكتيكية للعب (${data.tacticalReading}%)`);

    if (data.ballRetention >= 75) strengths.push(`قدرة عالية على الاحتفاظ بالكرة تحت الضغط (${data.ballRetention}%)`);
    else if (data.ballRetention < 60) weaknesses.push(`يحتاج إلى تحسين الاحتفاظ بالكرة تحت الضغط (${data.ballRetention}%)`);

    if (data.teamPlay >= 75) strengths.push(`تعاون ممتاز مع الفريق (${data.teamPlay}%)`);
    else if (data.teamPlay < 60) weaknesses.push(`يحتاج إلى تحسين اللعب الجماعي (${data.teamPlay}%)`);

    // If we don't have enough strengths, add some generic ones based on the highest metrics
    if (strengths.length < 2) {
        const metrics = [
            { name: 'التحكم بالكرة', value: data.ballControl },
            { name: 'المراوغة', value: data.dribbling },
            { name: 'التسديد', value: data.shooting },
            { name: 'القراءة التكتيكية', value: data.tacticalReading },
            { name: 'الاحتفاظ بالكرة', value: data.ballRetention },
            { name: 'اللعب الجماعي', value: data.teamPlay }
        ];

        metrics.sort((a, b) => b.value - a.value);

        if (strengths.length === 0 && metrics[0].value >= 60) {
            strengths.push(`مستوى جيد في ${metrics[0].name} (${metrics[0].value}%)`);
        }

        if (strengths.length <= 1 && metrics[1].value >= 60) {
            strengths.push(`أداء جيد في ${metrics[1].name} (${metrics[1].value}%)`);
        }
    }

    // If we don't have enough weaknesses, add some generic ones based on the lowest metrics
    if (weaknesses.length < 2) {
        const metrics = [
            { name: 'التحكم بالكرة', value: data.ballControl },
            { name: 'المراوغة', value: data.dribbling },
            { name: 'التسديد', value: data.shooting },
            { name: 'القراءة التكتيكية', value: data.tacticalReading },
            { name: 'الاحتفاظ بالكرة', value: data.ballRetention },
            { name: 'اللعب الجماعي', value: data.teamPlay }
        ];

        metrics.sort((a, b) => a.value - b.value);

        if (weaknesses.length === 0) {
            weaknesses.push(`يمكن تحسين ${metrics[0].name} (${metrics[0].value}%)`);
        }

        if (weaknesses.length <= 1) {
            weaknesses.push(`مجال للتطوير في ${metrics[1].name} (${metrics[1].value}%)`);
        }
    }

    // Add a generic strength if we still don't have any
    if (strengths.length === 0) {
        strengths.push('يظهر إمكانات جيدة في عدة جوانب من اللعب');
    }

    // Add a generic weakness if we still don't have any
    if (weaknesses.length === 0) {
        weaknesses.push('يحتاج إلى مزيد من التطوير في الجوانب الفنية');
    }

    return { strengths, weaknesses };
}

// Generate recommendations based on weaknesses
function generateRecommendations(weaknesses) {
    const recommendations = [];

    weaknesses.forEach(weakness => {
        if (weakness.includes('التحكم بالكرة')) {
            recommendations.push('تمارين يومية للتحكم بالكرة: تمرير الكرة بين القدمين، التحكم بالكرة في مساحات ضيقة، وتمارين الاستلام والتمرير السريع.');
        }

        if (weakness.includes('المراوغة')) {
            recommendations.push('تدريبات المراوغة: التدرب على تجاوز المدافعين في مواقف 1 ضد 1، وتعلم حركات جديدة للمراوغة، والتدرب على تغيير الاتجاه بسرعة.');
        }

        if (weakness.includes('التسديد')) {
            recommendations.push('تحسين دقة التسديد: تمارين التسديد من مسافات وزوايا مختلفة، والتركيز على تقنية التسديد الصحيحة، وتمارين القوة لزيادة قوة التسديد.');
        }

        if (weakness.includes('القراءة التكتيكية')) {
            recommendations.push('تطوير الوعي التكتيكي: مشاهدة وتحليل المباريات، والمشاركة في تدريبات تكتيكية جماعية، وفهم أدوار مختلف المراكز في الملعب.');
        }

        if (weakness.includes('الاحتفاظ بالكرة')) {
            recommendations.push('تمارين الاحتفاظ بالكرة تحت الضغط: تدريبات في مساحات ضيقة مع ضغط من المدافعين، وتقوية الجسم العلوي والسفلي لتحسين التوازن.');
        }

        if (weakness.includes('اللعب الجماعي')) {
            recommendations.push('تحسين اللعب الجماعي: المشاركة في تمارين جماعية أكثر، وتطوير مهارات التواصل في الملعب، وفهم تحركات الزملاء.');
        }
    });

    if (recommendations.length < 3) {
        const generalRecommendations = [
            'تدريبات اللياقة البدنية: زيادة التحمل والسرعة والقوة من خلال تمارين مخصصة.',
            'تحسين المرونة: ممارسة تمارين الإطالة بانتظام لتجنب الإصابات وتحسين الأداء.',
            'التغذية السليمة: اتباع نظام غذائي متوازن غني بالبروتين والكربوهيدرات المعقدة لدعم التدريب.',
            'الراحة الكافية: الحصول على قسط كافٍ من النوم والراحة بين التدريبات للسماح للعضلات بالتعافي.',
            'التدريب الذهني: تطوير التركيز والثقة بالنفس من خلال تقنيات التصور الذهني والتأمل.'
        ];

        for (let i = 0; recommendations.length < 3 && i < generalRecommendations.length; i++) {
            if (!recommendations.includes(generalRecommendations[i])) {
                recommendations.push(generalRecommendations[i]);
            }
        }
    }

    return recommendations;
}

// Render position-specific stats based on player position
function renderPositionSpecificStats(data) {
    const position = data.position || 'CB';
    const positionSpecificSkills = data.positionSpecificSkills || {};
    let statsHTML = '';
    let hasValidStats = false;

    // Helper function to create stat item with graph
    function createStatItem(icon, value, label, index) {
        // Skip if value is 0 or null
        if (!value || value === '0') return '';

        hasValidStats = true;
        const numValue = parseInt(value);
        const colorClass = numValue >= 80 ? 'high' : (numValue >= 60 ? 'medium' : 'low');

        return `
            <div class="stat-item" style="--i: ${index}">
                <div class="stat-header">
                    <div class="stat-icon"><i class="fas ${icon}"></i></div>
                    <div class="stat-value">${value}%</div>
                </div>
                <div class="stat-graph">
                    <div class="stat-bar ${colorClass}" style="width: ${numValue}%"></div>
                </div>
                <div class="stat-label">${label}</div>
            </div>
        `;
    }

    // Defender skills (CB, RB, LB)
    if (['CB', 'RB', 'LB'].includes(position)) {
        statsHTML += createStatItem('fa-hand-rock', positionSpecificSkills.tackling, 'قوة الالتحام', 0);
        statsHTML += createStatItem('fa-sort-amount-up', positionSpecificSkills.aerialAbility, 'الكرات الهوائية', 1);
        statsHTML += createStatItem('fa-shield-alt', positionSpecificSkills.defensiveCoverage, 'التغطية الدفاعية', 2);
        statsHTML += createStatItem('fa-play-circle', positionSpecificSkills.buildUpPlay, 'بناء اللعب', 3);
    }

    // Midfielder skills (CDM, CM, CAM)
    else if (['CDM', 'CM', 'CAM'].includes(position)) {
        statsHTML += createStatItem('fa-key', positionSpecificSkills.keyPasses, 'التمريرات المفتاحية', 0);
        statsHTML += createStatItem('fa-sliders-h', positionSpecificSkills.tempoControl, 'التحكم بإيقاع اللعب', 1);
        statsHTML += createStatItem('fa-sync-alt', positionSpecificSkills.possession, 'الاستحواذ', 2);
        statsHTML += createStatItem('fa-eye', positionSpecificSkills.vision, 'الرؤية', 3);
    }

    // Forward skills (RW, LW, ST)
    else if (['RW', 'LW', 'ST'].includes(position)) {
        statsHTML += createStatItem('fa-map-marker-alt', positionSpecificSkills.positioning, 'التمركز', 0);
        statsHTML += createStatItem('fa-bullseye', positionSpecificSkills.finishing, 'الإنهاء', 1);
        statsHTML += createStatItem('fa-running', positionSpecificSkills.offBallMovement, 'الحركة بدون كرة', 2);
        statsHTML += createStatItem('fa-magic', positionSpecificSkills.chanceCreation, 'خلق الفرص', 3);
    }

    // If no valid position-specific skills are available, show a message
    if (!hasValidStats) {
        statsHTML = `<div class="no-stats-message">لا توجد معلومات متاحة عن المهارات الخاصة بهذا المركز</div>`;
    }

    return statsHTML;
}

// Render general stats with graphs
function renderGeneralStats(data) {
    let statsHTML = '';

    // Helper function to create stat item with graph
    function createStatItem(icon, value, label, index) {
        // Skip if value is 0, null, or undefined
        if (!value || value === '0') return '';

        const numValue = parseInt(value);
        const colorClass = numValue >= 80 ? 'high' : (numValue >= 60 ? 'medium' : 'low');

        return `
            <div class="stat-item" style="--i: ${index}">
                <div class="stat-header">
                    <div class="stat-icon"><i class="fas ${icon}"></i></div>
                    <div class="stat-value">${value}%</div>
                </div>
                <div class="stat-graph">
                    <div class="stat-bar ${colorClass}" style="width: ${numValue}%"></div>
                </div>
                <div class="stat-label">${label}</div>
            </div>
        `;
    }

    // Add all general stats
    statsHTML += createStatItem('fa-running', data.speed, 'السرعة (كم/س)', 0);
    statsHTML += createStatItem('fa-futbol', data.ballControl, 'التحكم بالكرة', 1);
    statsHTML += createStatItem('fa-wind', data.dribbling, 'المراوغة', 2);
    statsHTML += createStatItem('fa-bullseye', data.shooting, 'التسديد', 3);
    statsHTML += createStatItem('fa-brain', data.tacticalReading, 'القراءة التكتيكية', 4);
    statsHTML += createStatItem('fa-shield-alt', data.ballRetention, 'الاحتفاظ بالكرة', 5);
    statsHTML += createStatItem('fa-users', data.teamPlay, 'اللعب الجماعي', 6);
    statsHTML += createStatItem('fa-bolt', data.speedAgility || data.speed, 'السرعة والرشاقة', 7);
    statsHTML += createStatItem('fa-dumbbell', data.physicalStrength, 'القوة البدنية', 8);
    statsHTML += createStatItem('fa-crosshairs', data.shootingAccuracy || data.shooting, 'دقة التسديد', 9);
    statsHTML += createStatItem('fa-chess', data.tacticalIntelligence || data.tacticalReading, 'الذكاء التكتيكي', 10);

    return statsHTML;
}

function resetAnalysis() {
    document.getElementById('step-upload').classList.remove('completed');
    document.getElementById('step-analyze').classList.remove('active', 'completed');
    document.getElementById('step-results').classList.remove('active');

    document.getElementById('upload-section').style.display = 'block';

    document.getElementById('resultsContainer').innerHTML = '';

    document.getElementById('videoInput').value = '';
    document.getElementById('fileName').textContent = '';
    document.getElementById('fileName').style.display = 'none';
    document.querySelector('.file-input-label').classList.remove('file-selected');
}
