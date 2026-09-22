# Daily Journal

A full-stack journaling application for writing, organizing, and reflecting on daily experiences.

Daily Journal allows users to create rich-text journal entries, track moods and tags, upload multiple photos with captions, browse entries through a calendar, search and filter their journal, track journaling streaks, view mood and sentiment analytics, and export entries as PDFs.

## 🚀 Live Demo

**[Open Daily Journal](https://daily-journal-gules.vercel.app/)**

**Backend API:** https://daily-journal-backend-edag.onrender.com

---

## ✨ Features

### 📝 Journal Entries

- Create one journal entry per day
- Rich-text editing
- Add a title and journal content
- Edit and delete existing entries
- Automatic sentiment analysis
- Mood tracking
- Custom tags

### 📷 Photo Management

- Upload multiple photos to a journal entry
- Store images securely using Cloudinary
- Add captions to individual photos
- Delete individual photos
- Display photos as a gallery inside journal entries

### 📅 Calendar

- Browse journal entries by date
- Quickly identify days with journal entries
- Navigate between months
- Open an entry directly from the calendar

### 🔎 Search and Filtering

Search and filter journal entries using:

- Text
- Tags
- Mood
- Date range

### 📊 Mood and Sentiment Analytics

The application provides basic analytics including:

- Mood distribution
- Sentiment trends
- Journaling activity
- Current journaling streak
- Longest journaling streak

### 🔐 Authentication

- User registration
- User login
- JWT-based authentication
- Protected journal routes
- Persistent authentication using browser storage

### 📄 PDF Export

Journal entries can be exported as PDF documents.

### 🌓 Themes

- Light theme
- Dark theme
- Theme preference managed through React context

### 📱 Progressive Web App

The frontend is configured as a PWA and can be installed as an application on supported devices.

---

## 🛠️ Tech Stack

### Frontend

- React
- Vite
- Axios
- React Calendar
- TipTap
- jsPDF
- Recharts
- vite-plugin-pwa
- CSS

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- Multer
- Sentiment npm package

### Cloud Services

- MongoDB Atlas — production database
- Cloudinary — image storage
- Render — backend deployment
- Vercel — frontend deployment
- GitHub — source control

---

## 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │       Vercel         │
                         │   React + Vite App   │
                         └──────────┬───────────┘
                                    │
                                    │ HTTPS API
                                    ▼
                         ┌──────────────────────┐
                         │       Render         │
                         │ Node.js + Express    │
                         │      REST API        │
                         └───────┬───────┬──────┘
                                 │       │
                    ┌────────────┘       └─────────────┐
                    ▼                                  ▼
          ┌──────────────────┐               ┌──────────────────┐
          │  MongoDB Atlas   │               │    Cloudinary    │
          │                  │               │                  │
          │ Users            │               │ Journal photos   │
          │ Entries          │               │ Image metadata   │
          │ Mood / Tags      │               │                  │
          └──────────────────┘               └──────────────────┘
```

---

## 📁 Project Structure

```text
journal-app/
│
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   └── Entry.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── entries.js
│   ├── utils/
│   │   └── sentiment.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── components/
│   │   │   ├── CalendarView.jsx
│   │   │   ├── ExportPdfButton.jsx
│   │   │   ├── MoodPicker.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── RichTextEditor.jsx
│   │   │   ├── SearchPanel.jsx
│   │   │   ├── StreakBadge.jsx
│   │   │   └── TagInput.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── pages/
│   │   │   ├── InsightsPage.jsx
│   │   │   ├── JournalPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

---

## 🗃️ Data Model

Each journal entry belongs to a specific user and date.

There is one entry per user per day.

```text
Entry {
  user,
  date,
  title,
  body,
  mood,
  tags,
  sentimentScore,
  sentimentLabel,
  images[]
}
```

### Image Data

Each uploaded image contains information such as:

```text
Image {
  url,
  publicId,
  caption,
  width,
  height,
  createdAt
}
```

Images are stored in Cloudinary while their metadata is stored with the corresponding journal entry in MongoDB.

---

## 🧠 Sentiment Analysis

Journal text is processed when an entry is saved.

The backend uses the `sentiment` npm package to calculate a basic sentiment score and label.

Possible labels include:

```text
positive
neutral
negative
```

The sentiment functionality is isolated in:

```text
backend/utils/sentiment.js
```

This makes it possible to replace the lightweight sentiment implementation with a more advanced ML or AI model in the future without restructuring the journal routes.

---

## 🔌 API

The backend exposes REST APIs under:

```text
/api
```

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
```

### Journal Entries

```text
GET    /api/entries/:date
PUT    /api/entries/:date
DELETE /api/entries/:date
```

### Search

```text
GET /api/entries/search?q=&tag=&mood=&from=&to=
```

### Calendar Summary

```text
GET /api/entries/summary
```

### Streak

```text
GET /api/entries/streak
```

### Analytics

```text
GET /api/entries/analytics?from=&to=
```

### Images

Journal entries support multiple image operations, including:

```text
POST   /api/entries/:date/images
DELETE /api/entries/:date/images/:imageId
PUT    /api/entries/:date/images/:imageId
```

The image update endpoint is used for operations such as updating an image caption.

---

## 🔑 Environment Variables

### Backend

Create:

```text
backend/.env
```

The backend requires:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Never commit `.env` files or secrets to GitHub.

### Frontend

The frontend uses:

```env
VITE_API_URL=https://your-backend-url/api
```

For local development:

```env
VITE_API_URL=http://localhost:5000/api
```

The API client automatically uses the environment variable:

```javascript
import.meta.env.VITE_API_URL
```

and falls back to the local backend URL when the variable is not provided.

---

## 💻 Running Locally

### 1. Clone the Repository

```bash
git clone https://github.com/anushreedas1/daily-journal.git
cd daily-journal
```

### 2. Start the Backend

```bash
cd backend
npm install
npm run dev
```

The backend runs locally on:

```text
http://localhost:5000
```

### 3. Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The Vite development server will provide the local frontend URL.

---

## ☁️ Production Deployment

The project is deployed using separate services for the frontend and backend.

### Frontend

**Vercel**

The frontend is built from:

```text
frontend/
```

Production API URL:

```text
VITE_API_URL=https://daily-journal-backend-edag.onrender.com/api
```

### Backend

**Render**

The backend is built from:

```text
backend/
```

Production services include:

- MongoDB Atlas
- Cloudinary

Environment variables are configured directly in the deployment platforms and are not stored in the repository.

---

## 🔄 Git Workflow

The project uses Git for version control.

Typical workflow:

```bash
git status
git add .
git commit -m "Describe your changes"
git push
```

The production deployments are connected to the GitHub repository so changes can be deployed after being pushed to the appropriate branch.

---

## 🔒 Security

The application uses several measures to protect user data and credentials:

- JWT authentication
- Protected backend routes
- Environment variables for secrets
- `.gitignore` protection for `.env`
- Cloudinary for image storage
- MongoDB Atlas for managed database hosting
- Separate production database credentials
- Secrets are not exposed to the React frontend

Sensitive credentials such as:

```text
MONGODB_URI
JWT_SECRET
CLOUDINARY_API_SECRET
```

must never be committed to GitHub.

---

## ✅ Current Features

- [x] User registration
- [x] User login
- [x] JWT authentication
- [x] Rich-text journal editor
- [x] Daily journal entries
- [x] Calendar navigation
- [x] Mood tracking
- [x] Tags
- [x] Search and filtering
- [x] Journaling streaks
- [x] Sentiment analysis
- [x] Mood analytics
- [x] Light/dark theme
- [x] PDF export
- [x] Multiple photos per journal entry
- [x] Image captions
- [x] Cloudinary image storage
- [x] PWA support
- [x] Production deployment
- [x] MongoDB Atlas integration

---

## 🚀 Future Improvements

Possible future improvements include:

- Daily memory reminders such as "On this day last year..."
- Dedicated photo gallery page
- Automatic image compression and resizing
- Drag-and-drop image uploads
- More advanced AI-based sentiment analysis
- AI-powered journal summaries
- Weekly and monthly journal summaries
- More detailed analytics
- Google Calendar integration
- Push notifications and journaling reminders
- Additional themes
- Improved PDF layouts with journal photos

---

## 🤝 Contributing

Contributions and suggestions are welcome.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

## 📄 License

This project is intended as a personal/portfolio project.
