require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(fileUpload());

// تحليل الفيديو (محاكاة)
function analyzeVideo(videoPath) {
    return {
        speed: (Math.random() * 30).toFixed(2),
        accuracy: (Math.random() * 100).toFixed(2),
        performance: (Math.random() * 100).toFixed(2)
    };
}

app.post('/analyze', (req, res) => {
    if (!req.files || !req.files.video) {
        return res.status(400).send('لم يتم تحميل أي ملف');
    }

    const video = req.files.video;
    const results = analyzeVideo(video.tempFilePath);
    
    res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`الخادم يعمل على port ${PORT}`);
});