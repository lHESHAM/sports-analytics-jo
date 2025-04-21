require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);


const apiKey = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

console.log('API Key configured. Using Google Gemini API for analysis.');

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    abortOnLimit: true,
    useTempFiles: true,
    tempFileDir: './tmp/'
}));

if (!fs.existsSync('./tmp')) {
    fs.mkdirSync('./tmp');
}

async function extractFramesFromVideo(videoPath) {
    const frameDir = './tmp/frames';

    if (!fs.existsSync(frameDir)) {
        fs.mkdirSync(frameDir, { recursive: true });
    } else {
        fs.readdirSync(frameDir).forEach(file => {
            fs.unlinkSync(path.join(frameDir, file));
        });
    }

    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .outputOptions('-vf', 'fps=1')
            .output(path.join(frameDir, 'frame-%d.png'))
            .on('end', () => {
                const frames = fs.readdirSync(frameDir)
                    .filter(file => file.startsWith('frame-'))
                    .map(file => path.join(frameDir, file));
                resolve(frames);
            })
            .on('error', (err) => {
                reject(err);
            })
            .run();
    });
}

async function analyzeVideoWithGemini(frames) {
    try {
        const framesToAnalyze = [
            frames[0],
            frames[Math.floor(frames.length / 2)],
            frames[frames.length - 1]
        ];

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });

        // Create a position-specific prompt based on the manual position
        let basePrompt = `أنت محلل رياضي محترف متخصص في تقييم أداء لاعبي كرة القدم.\nقم بتحليل هذه الإطارات من فيديو رياضي وقدم تقريراً مفصلاً عن أداء اللاعب.\n\nمهم جداً: لا تذكر رقم قميص اللاعب أو أي معلومات شخصية عنه. ركز فقط على تحليل الأداء الفني.`;

        // Add position-specific instructions if a manual position was provided
        if (manualPosition) {
            console.log('Using manual position for prompt:', manualPosition);

            let positionType = '';
            let positionName = '';

            // Determine position type and name based on the code
            if (['CB', 'RB', 'LB'].includes(manualPosition)) {
                positionType = 'مدافع';
                if (manualPosition === 'CB') positionName = 'قلب دفاع';
                else if (manualPosition === 'RB') positionName = 'ظهير أيمن';
                else positionName = 'ظهير أيسر';
            } else if (['CDM', 'CM', 'CAM'].includes(manualPosition)) {
                positionType = 'لاعب وسط';
                if (manualPosition === 'CDM') positionName = 'وسط دفاعي';
                else if (manualPosition === 'CAM') positionName = 'وسط هجومي';
                else positionName = 'وسط';
            } else if (['RW', 'LW', 'ST'].includes(manualPosition)) {
                positionType = 'مهاجم';
                if (manualPosition === 'ST') positionName = 'صريح';
                else if (manualPosition === 'RW') positionName = 'جناح أيمن';
                else positionName = 'جناح أيسر';
            }

            // Add the position instruction to the prompt
            basePrompt += `\n\nملاحظة مهمة جداً: اللاعب الذي تشاهده هو ${positionType} (${manualPosition}) ${positionName}. قم بتحليله ك${positionType} وحدد مركزه بدقة كـ ${manualPosition}.`;

            console.log('Using position-specific prompt for:', positionType, positionName);
        } else {
            // Default instruction for position detection
            basePrompt += `\n\nملاحظة مهمة جداً: قم بتحليل اللاعب الرئيسي في الفيديو وحدد مركزه بدقة بناءً على ما تشاهده في الفيديو فقط.`;
        }

        console.log('Prompt prepared with position instruction');

        basePrompt += `

أولاً، حدد مركز اللاعب بدقة من بين المراكز التالية:
- حارس مرمى (GK)
- قلب دفاع (CB)
- ظهير أيمن (RB)
- ظهير أيسر (LB)
- لاعب وسط دفاعي (CDM)
- لاعب وسط (CM)
- لاعب وسط هجومي (CAM)
- جناح أيمن (RW)
- جناح أيسر (LW)
- مهاجم صريح (ST)

ثم حدد أسلوب لعبه بناءً على مركزه (مثل: مدافع قوي، مدافع سريع، لاعب وسط إبداعي، مهاجم هداف، إلخ).

ركز على اللاعب الرئيسي الذي يمتلك الكرة وقيّم المهارات التالية (قيّم كل منها على مقياس من 0 إلى 100):
1. التحكم بالكرة: مدى جودة استقبال اللاعب للكرة والحفاظ على الاستحواذ
2. المراوغة: فعالية التحرك بالكرة وتجاوز المدافعين
3. التمرير الدقيق: دقة وفعالية التمريرات (إن وجدت)
4. التسديد القوي والدقيق: جودة التسديدات على المرمى (إن وجدت)
5. الدفاع الصلب: المساهمات الدفاعية (إن وجدت)
6. القراءة التكتيكية: الوعي والتموضع واتخاذ القرار
7. الاحتفاظ بالكرة تحت الضغط: القدرة على الاحتفاظ بالكرة عند التعرض للضغط
8. اللعب الجماعي: المساهمة في تحركات الفريق والهجمات
9. السرعة والرشاقة: قدرة اللاعب على التحرك بسرعة وتغيير الاتجاه
10. القوة البدنية: قوة اللاعب في المواجهات والصراعات على الكرة
11. الدقة في التسديد: نسبة دقة تسديداته على المرمى
12. الذكاء التكتيكي: فهم اللاعب للعبة واتخاذ القرارات الصحيحة

بالإضافة إلى ذلك، قم بتقييم المهارات الخاصة بمركز اللاعب:

إذا كان اللاعب حارس مرمى (GK):
- سرعة رد الفعل: قدرة الحارس على الاستجابة السريعة للتسديدات
- التعامل مع الكرة: قدرة الحارس على مسك الكرة بثبات وأمان
- التمركز: قدرة الحارس على اتخاذ المواقع الصحيحة في المرمى
- توزيع الكرة: دقة وفعالية تمريرات وركلات الحارس
- قيادة خط الدفاع: قدرة الحارس على تنظيم وتوجيه المدافعين

إذا كان اللاعب مدافعاً (CB, RB, LB):
- قوة الالتحام: قدرة اللاعب على الفوز بالالتحامات والتدخلات الدفاعية
- الكرات الهوائية: قدرة اللاعب على الفوز بالكرات الهوائية
- التغطية الدفاعية: قدرة اللاعب على تغطية المساحات وتأمين الدفاع
- بناء اللعب من الخلف: قدرة اللاعب على بدء الهجمات من الخلف

إذا كان اللاعب وسطاً (CDM, CM, CAM):
- التمريرات المفتاحية: قدرة اللاعب على تقديم تمريرات حاسمة
- التحكم بإيقاع اللعب: قدرة اللاعب على التحكم بإيقاع المباراة
- الاستحواذ: قدرة اللاعب على الاحتفاظ بالكرة وتدوير اللعب
- الرؤية: قدرة اللاعب على رؤية المساحات والتمريرات المتاحة

إذا كان اللاعب مهاجماً (RW, LW, ST):
- التمركز: قدرة اللاعب على التمركز الصحيح لاستلام الكرة أو التسجيل
- الإنهاء: قدرة اللاعب على إنهاء الهجمات بنجاح
- الحركة بدون كرة: قدرة اللاعب على التحرك بشكل فعال بدون كرة
- خلق الفرص: قدرة اللاعب على خلق فرص للتسجيل لنفسه أو لزملائه

لكل مهارة، قدم تقييماً رقمياً وشرحاً موجزاً بين قوسين.
ضع علامة "غير متوفر" للمهارات التي لم يتم إظهارها في المقطع.
احسب تقييماً نهائياً من 100 بناءً على المهارات المعروضة.

قم بتحديد نقاط القوة الرئيسية للاعب ونقاط الضعف التي يجب تحسينها.
قدم توصيات محددة لتطوير مهارات اللاعب بناءً على مركزه وأسلوب لعبه.
قارن أداء اللاعب بلاعبين محترفين معروفين يلعبون في نفس المركز.

قم بتنسيق إجابتك بالضبط مثل هذا المثال:

تحليل اللاعب (من 100 بناءً على هذا المقطع):

المركز: قلب دفاع (CB)
أسلوب اللعب: مدافع قوي يجيد بناء اللعب

التحكم بالكرة: 85 (يستقبل الكرة بثقة ويتحكم بها جيداً)
المراوغة: 70 (يستخدم مهارات بسيطة لتجاوز الضغط)
التمرير الدقيق: 82 (يقدم تمريرات دقيقة للاعبي الوسط)
التسديد القوي والدقيق: غير متوفر (لم يسدد على المرمى في هذا المقطع)
الدفاع الصلب: 90 (يقوم بتدخلات دفاعية نظيفة وفعالة)
القراءة التكتيكية: 88 (يتوقع تحركات المهاجمين ويقطع الكرات)
الاحتفاظ بالكرة تحت الضغط: 80 (يحافظ على الكرة رغم ضغط المهاجمين)
اللعب الجماعي: 85 (يتواصل جيداً مع زملائه في خط الدفاع)
السرعة والرشاقة: 75 (سرعة مقبولة لمركزه)
القوة البدنية: 88 (قوي في المواجهات والصراعات على الكرة)
الدقة في التسديد: غير متوفر (لم يسدد في هذا المقطع)
الذكاء التكتيكي: 86 (يتخذ قرارات جيدة في معظم الحالات)

// مهارات خاصة بمركز المدافع
قوة الالتحام: 92 (يفوز بمعظم الالتحامات ويستخلص الكرة بنظافة)
الكرات الهوائية: 88 (يتفوق في الكرات الهوائية بفضل قوته وتوقيته)
التغطية الدفاعية: 85 (يغطي المساحات بشكل جيد ويساند زملاءه)
بناء اللعب من الخلف: 83 (يبدأ الهجمات بتمريرات دقيقة من الخلف)

نقاط القوة:
- قوة بدنية عالية وتفوق في الالتحامات
- قراءة جيدة للعب وتوقع لتحركات الخصم
- مهارات جيدة في بناء اللعب من الخلف

نقاط الضعف:
- يحتاج لتحسين السرعة والرشاقة
- يمكن تطوير مهارات المراوغة عند الضغط العالي

توصيات للتطوير:
- تمارين لزيادة السرعة والرشاقة
- تدريبات على التعامل مع الضغط العالي
- تحسين مهارات التمرير تحت الضغط

مقارنة مع لاعبين محترفين:
- يشبه أسلوب لعبه سيرجيو راموس في القوة والقدرة على بناء اللعب
- يحتاج لتطوير مهارات التمرير ليصل لمستوى فيرجيل فان دايك

التقييم النهائي: 85/100

قم أيضاً بتضمين هذه المقاييس في قسم JSON منفصل للتطبيق:
{
  "position": "CB",
  "positionFull": "قلب دفاع",
  "playingStyle": "مدافع قوي يجيد بناء اللعب",
  "speed": 75,
  "ballControl": 85,
  "dribbling": 70,
  "passing": 82,
  "shooting": 0,
  "defending": 90,
  "tacticalReading": 88,
  "ballRetention": 80,
  "teamPlay": 85,
  "speedAgility": 75,
  "physicalStrength": 88,
  "shootingAccuracy": 0,
  "tacticalIntelligence": 86,
  "performance": 85,

  "positionSpecificSkills": {
    "tackling": 92,
    "aerialAbility": 88,
    "defensiveCoverage": 85,
    "buildUpPlay": 83
  },

  "strengths": ["قوة بدنية عالية وتفوق في الالتحامات", "قراءة جيدة للعب وتوقع لتحركات الخصم", "مهارات جيدة في بناء اللعب من الخلف"],
  "weaknesses": ["يحتاج لتحسين السرعة والرشاقة", "يمكن تطوير مهارات المراوغة عند الضغط العالي"],
  "recommendations": ["تمارين لزيادة السرعة والرشاقة", "تدريبات على التعامل مع الضغط العالي", "تحسين مهارات التمرير تحت الضغط"],
  "similarPlayers": ["سيرجيو راموس", "فيرجيل فان دايك"]
}`;

        const prompt = basePrompt;

        const imagesParts = await Promise.all(framesToAnalyze.map(async (frame) => {
            const data = await fs.promises.readFile(frame);
            return {
                inlineData: {
                    data: data.toString('base64'),
                    mimeType: 'image/png'
                }
            };
        }));

        const parts = [
            { text: prompt },
            ...imagesParts
        ];

        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        const response = result.response;
        const text = response.text();

        const analysisMatch = text.match(/تحليل اللاعب[\s\S]*?التقييم النهائي: (\d+)\/100/);
        const detailedAnalysis = analysisMatch ? analysisMatch[0] : '';

        const jsonMatch = text.match(/\{[\s\S]*\}/);

        const responseData = {
            speed: extractNumber(text, 'speed', 30),
            ballControl: extractSkillRating(text, 'التحكم بالكرة'),
            dribbling: extractSkillRating(text, 'المراوغة'),
            shooting: extractSkillRating(text, 'التسديد القوي والدقيق'),
            tacticalReading: extractSkillRating(text, 'القراءة التكتيكية'),
            ballRetention: extractSkillRating(text, 'الاحتفاظ بالكرة تحت الضغط'),
            teamPlay: extractSkillRating(text, 'اللعب الجماعي'),
            performance: analysisMatch ? parseInt(analysisMatch[1]) : extractNumber(text, 'performance', 100),
            detailedAnalysis: detailedAnalysis,
            // Extract position and playing style
            position: extractPosition(text),
            positionFull: extractPositionFull(text),
            playingStyle: extractPlayingStyle(text),
            // Extract additional metrics
            physicalStrength: extractSkillRating(text, 'القوة البدنية'),
            shootingAccuracy: extractSkillRating(text, 'الدقة في التسديد'),
            tacticalIntelligence: extractSkillRating(text, 'الذكاء التكتيكي'),
            speedAgility: extractSkillRating(text, 'السرعة والرشاقة'),
            // Extract position-specific skills
            positionSpecificSkills: extractPositionSpecificSkills(text),
            // Extract strengths, weaknesses, recommendations, and similar players
            strengths: extractListItems(text, 'نقاط القوة', 'نقاط الضعف'),
            weaknesses: extractListItems(text, 'نقاط الضعف', 'توصيات للتطوير'),
            recommendations: extractListItems(text, 'توصيات للتطوير', 'مقارنة مع لاعبين محترفين'),
            similarPlayers: extractListItems(text, 'مقارنة مع لاعبين محترفين', 'التقييم النهائي'),
            ...(jsonMatch ? tryParseJson(jsonMatch[0]) : {})
        };

        return responseData;
    } catch (error) {
        console.error('Error analyzing video with Gemini:', error);
        throw new Error('Failed to analyze video with Google Gemini API: ' + error.message);
    }
}

function extractNumber(text, key, max) {
    const regex = new RegExp(`${key}[^0-9]*(\\d+(\\.\\d+)?)`, 'i');
    const match = text.match(regex);
    return match ? Math.min(parseFloat(match[1]), max).toFixed(2) : '0.00';
}

function extractSkillRating(text, skillName) {
    const regex = new RegExp(`${skillName}:\\s*(\\d+)\\s*\\(`, 'i');
    const match = text.match(regex);

    const naRegex = new RegExp(`${skillName}:\\s*غير متوفر\\s*\\(`, 'i');
    if (text.match(naRegex)) {
        return "0";
    }

    return match ? match[1] : "0";
}

function tryParseJson(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('Error parsing JSON:', e);
        return {};
    }
}

// Global variable to store the manually selected position
let manualPosition = null;

function extractPosition(text) {
    console.log('Extracting position with manualPosition =', manualPosition);

    // If a manual position was provided, use it and ignore AI detection
    if (manualPosition && manualPosition !== 'NONE') {
        console.log('Using manually selected position:', manualPosition);
        return manualPosition;
    }

    // First try to extract the short position code (CB, CM, ST, etc.)
    const positionCodeRegex = /\"position\":\s*\"([A-Z]+)\"/;
    const positionCodeMatch = text.match(positionCodeRegex);

    if (positionCodeMatch && positionCodeMatch[1]) {
        return positionCodeMatch[1].trim();
    }

    // If no position code found, try to extract from the Arabic text
    const regex = /المركز:\s*([^\n]+)/;
    const match = text.match(regex);

    if (match && match[1]) {
        const positionText = match[1].trim();

        // Try to extract position code from the Arabic text
        if (positionText.includes('(GK)')) return 'GK';
        if (positionText.includes('(CB)')) return 'CB';
        if (positionText.includes('(RB)')) return 'RB';
        if (positionText.includes('(LB)')) return 'LB';
        if (positionText.includes('(CDM)')) return 'CDM';
        if (positionText.includes('(CM)')) return 'CM';
        if (positionText.includes('(CAM)')) return 'CAM';
        if (positionText.includes('(RW)')) return 'RW';
        if (positionText.includes('(LW)')) return 'LW';
        if (positionText.includes('(ST)')) return 'ST';


        if (positionText.includes('حارس') || positionText.includes('مرمى')) return 'GK';
        if (positionText.includes('مهاجم') || positionText.includes('هداف')) return 'ST';
        if (positionText.includes('جناح')) {
            if (positionText.includes('أيمن')) return 'RW';
            if (positionText.includes('أيسر')) return 'LW';
            return 'RW';
        }
        if (positionText.includes('وسط')) {
            if (positionText.includes('هجومي')) return 'CAM';
            if (positionText.includes('دفاعي')) return 'CDM';
            return 'CM';
        }
        if (positionText.includes('دفاع')) {
            if (positionText.includes('ظهير') || positionText.includes('أيمن')) return 'RB';
            if (positionText.includes('أيسر')) return 'LB';
            return 'CB';
        }
    }

    if (text.includes('قطع الكرات') || text.includes('تدخلات دفاعية') ||
        text.includes('التغطية الدفاعية') || text.includes('الالتحامات')) {
        return 'CB';
    }

    if (text.includes('تسجيل') || text.includes('هدف') || text.includes('إنهاء الهجمات')) {
        return 'ST';
    }

    if (text.includes('مراوغة') && text.includes('سرعة') && (text.includes('جناح') || text.includes('هجوم'))) {
        return 'RW';
    }

    if (text.includes('بناء اللعب') || text.includes('التحكم بإيقاع') || text.includes('تمريرات حاسمة')) {
        return 'CM';
    }

    return "CM";
}

function extractPositionFull(text) {
    const regex = /المركز:\s*([^\n]+)/;
    const match = text.match(regex);

    if (match && match[1]) {
        return match[1].trim();
    }

    const position = extractPosition(text);
    switch (position) {
        case 'GK': return 'حارس مرمى';
        case 'ST': return 'مهاجم صريح';
        case 'RW': return 'جناح أيمن';
        case 'LW': return 'جناح أيسر';
        case 'CAM': return 'لاعب وسط هجومي';
        case 'CM': return 'لاعب وسط';
        case 'CDM': return 'لاعب وسط دفاعي';
        case 'RB': return 'ظهير أيمن';
        case 'LB': return 'ظهير أيسر';
        case 'CB': return 'قلب دفاع';
    }
}

function extractPlayingStyle(text) {
    const regex = /أسلوب اللعب:\s*([^\n]+)/;
    const match = text.match(regex);
    return match ? match[1].trim() : "غير محدد";
}

function extractPositionSpecificSkills(text) {
    const position = extractPosition(text);
    const skills = {};

    if (position === 'GK') {
        skills.reflexes = extractSkillRating(text, 'سرعة رد الفعل');
        skills.handling = extractSkillRating(text, 'التعامل مع الكرة');
        skills.positioning = extractSkillRating(text, 'التمركز');
        skills.distribution = extractSkillRating(text, 'توزيع الكرة');
        skills.commanding = extractSkillRating(text, 'قيادة خط الدفاع');
    }

    else if (['CB', 'RB', 'LB'].includes(position)) {
        skills.tackling = extractSkillRating(text, 'قوة الالتحام');
        skills.aerialAbility = extractSkillRating(text, 'الكرات الهوائية');
        skills.defensiveCoverage = extractSkillRating(text, 'التغطية الدفاعية');
        skills.buildUpPlay = extractSkillRating(text, 'بناء اللعب من الخلف');
    }

    else if (['CDM', 'CM', 'CAM'].includes(position)) {
        skills.keyPasses = extractSkillRating(text, 'التمريرات المفتاحية');
        skills.tempoControl = extractSkillRating(text, 'التحكم بإيقاع اللعب');
        skills.possession = extractSkillRating(text, 'الاستحواذ');
        skills.vision = extractSkillRating(text, 'الرؤية');
    }

    else if (['RW', 'LW', 'ST'].includes(position)) {
        skills.positioning = extractSkillRating(text, 'التمركز');
        skills.finishing = extractSkillRating(text, 'الإنهاء');
        skills.offBallMovement = extractSkillRating(text, 'الحركة بدون كرة');
        skills.chanceCreation = extractSkillRating(text, 'خلق الفرص');
    }

    const jsonRegex = /"positionSpecificSkills"\s*:\s*\{([^}]+)\}/;
    const jsonMatch = text.match(jsonRegex);

    if (jsonMatch && jsonMatch[1]) {
        try {
            const jsonStr = '{' + jsonMatch[1] + '}';
            const jsonSkills = JSON.parse(jsonStr.replace(/'/g, '"'));
            return { ...skills, ...jsonSkills };
        } catch (e) {
            console.error('Error parsing position-specific skills JSON:', e);
        }
    }

    return skills;
}

function extractListItems(text, startSection, endSection) {
    const pattern = new RegExp(`${startSection}:\s*\n([\s\S]*?)\n\s*${endSection}:`, 'i');
    const match = text.match(pattern);

    if (!match || !match[1]) {
        return [];
    }

    return match[1].split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-'))
        .map(line => line.substring(1).trim());
}

async function analyzeVideo(videoPath) {
    try {
        const frames = await extractFramesFromVideo(videoPath);

        if (!frames || frames.length === 0) {
            throw new Error('No frames could be extracted from the video');
        }

        return await analyzeVideoWithGemini(frames);
    } catch (error) {
        console.error('Error in video analysis:', error);
        throw error;
    }
}

app.post('/analyze', async (req, res) => {
    try {
        console.log('Analyze request received');
        console.log('Request body:', req.body);
        console.log('Request files:', req.files ? Object.keys(req.files) : 'No files');

        if (!req.files || !req.files.video) {
            console.log('No video file found in request');
            return res.status(400).send('لم يتم تحميل أي ملف');
        }

        const video = req.files.video;
        console.log('Processing video:', video.name);


        manualPosition = null;

        console.log('Position in request body:', req.body);
        console.log('Position value:', req.body.position);

        if (req.body.position && req.body.position !== 'NONE') {
            const validPositions = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST'];
            const position = req.body.position.toUpperCase();

            if (validPositions.includes(position)) {
                console.log('Manual position specified and valid:', position);
                manualPosition = position;

                let positionDescription = '';
                if (position === 'GK') {
                    positionDescription = 'حارس مرمى';
                } else if (['CB', 'RB', 'LB'].includes(position)) {
                    positionDescription = 'مدافع';
                } else if (['CDM', 'CM', 'CAM'].includes(position)) {
                    positionDescription = 'لاعب وسط';
                } else if (['RW', 'LW', 'ST'].includes(position)) {
                    positionDescription = 'مهاجم';
                }

                console.log('Using position description:', positionDescription);
            } else {
                console.log('Invalid position specified:', position);
            }
        } else {
            // Reset manual position if none specified
            console.log('No valid position specified, will use AI detection');
            manualPosition = null;
        }

        try {
            const results = await analyzeVideo(video.tempFilePath);

            if (fs.existsSync(video.tempFilePath)) {
                fs.unlinkSync(video.tempFilePath);
            }

            res.json(results);
        } catch (error) {
            console.error('Analysis error:', error);
            res.status(500).send('فشل تحليل الفيديو: ' + error.message);
        }
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('حدث خطأ أثناء معالجة الفيديو');
    }
});

// Add a test endpoint
app.get('/test', (_req, res) => {
    console.log('Test endpoint hit');
    res.json({ status: 'ok', message: 'Server is running correctly' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`الخادم يعمل على port ${PORT}`);
    console.log(`Test the server at http://localhost:${PORT}/test`);
});
