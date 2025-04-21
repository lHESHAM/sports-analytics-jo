async function startAnalysis() {
    const fileInput = document.getElementById('videoInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('الرجاء اختيار ملف فيديو أولاً');
        return;
    }

    // عرض مؤشر التحميل
    document.getElementById('loading').style.display = 'block';
    
    try {
        const formData = new FormData();
        formData.append('video', file);
        
        const response = await fetch('http://localhost:3000/analyze', {
            method: 'POST',
            body: formData
        });
        
        const results = await response.json();
        showResults(results);
    } catch (error) {
        alert('حدث خطأ أثناء التحليل: ' + error.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function showResults(data) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = `
        <div class="result-card">
            <h3>النتائج:</h3>
            <p>السرعة القصوى: ${data.speed} كم/س</p>
            <p>الدقة: ${data.accuracy}%</p>
            <p>التقييم العام: ${data.performance}/100</p>
        </div>
    `;
}