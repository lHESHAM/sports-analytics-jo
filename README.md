# Sports Analytics Application

تطبيق لتحليل الأداء الرياضي باستخدام الذكاء الاصطناعي

## Important: Setting Up Google Gemini API

This application uses Google Gemini API for AI-powered sports video analysis. To use the real AI functionality:

1. Get a Google Gemini API key from [Google AI Studio](https://ai.google.dev/)
2. Open the `backend/.env` file
3. Replace `YOUR_GEMINI_API_KEY` with your actual API key
4. Restart the backend server

Without a valid API key, the application will use simulated data instead of real AI analysis.

## Project Structure

```
sports-analytics/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env (add your API key here)
├── docker-compose.yml
└── README.md
```

## How to Run Locally

### Without Docker

1. Install dependencies and start the backend server:
   ```
   cd backend
   npm install
   node server.js
   ```

2. Open the frontend:
   - Open `frontend/index.html` in your browser

### With Docker

1. Make sure to add your API key to `backend/.env` first

2. Run the application:
   ```
   docker-compose up
   ```

3. Access the application:
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000

## Features

- Upload sports videos for analysis
- Google Gemini 2.5 Flash Preview AI-powered performance metrics
- Detailed player performance analysis
- Visual representation of results with animations
- Drag-and-drop file upload
- Responsive design for all devices

## Troubleshooting

### "This is a simulation using AI-generated data"

If you see this message in the analysis results, it means:

1. You haven't added a valid Google Gemini API key in the `backend/.env` file, or
2. The API key you added is incorrect or has expired

To fix this:
1. Get a valid API key from [Google AI Studio](https://ai.google.dev/)
2. Update the `GEMINI_API_KEY` value in `backend/.env`
3. Restart the backend server
4. Try uploading a video again
