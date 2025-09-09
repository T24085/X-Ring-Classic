# The X-Ring Classic

A comprehensive precision shooting platform for organizing and tracking .22 rifle competitions with advanced classification systems. Built with React, Node.js, Express, and MongoDB.

## About The X-Ring Classic

The X-Ring Classic is a premier platform designed for precision .22 rifle shooting competitions. It features a sophisticated classification system that recognizes skill progression across multiple categories:

- **Indoor Classes**: Controlled environment competitions
- **Outdoor Classes**: Weather-affected competitions  
- **Overall Classes**: Combined performance across both categories

### Classification System
- **Grandmaster**: Elite shooters with exceptional precision
- **Master**: Advanced shooters with high skill levels
- **Expert**: Skilled shooters with strong fundamentals
- **Sharpshooter**: Intermediate shooters with good accuracy
- **Marksman**: Developing shooters building skills
- **Novice**: New shooters learning fundamentals

## Features

### Core Features
- **User Registration & Authentication**: Support for competitors, range officers, and admins
- **Competition Management**: Create, manage, and participate in .22LR competitions
- **Score Submission**: Submit scores with photo/video verification
- **Advanced Classification System**: Automatic class progression based on performance
- **Shooting Classes**: 18 distinct classes across indoor, outdoor, and overall categories
- **Leaderboards**: Separate rankings by class and category with tiebreaker logic
- **User Profiles**: Track performance, personal bests, competition history, and class progression
- **Admin Panel**: Platform management and oversight tools

### Technical Features
- **Modern Tech Stack**: React 18, Node.js, Express, MongoDB
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Real-time Updates**: React Query for efficient data fetching
- **Security**: JWT authentication, input validation, rate limiting
- **Scalable Architecture**: Modular design with clear separation of concerns

## Project Structure

```
.22LR-Rifle-Championship/
├── server/                 # Backend API
│   ├── models/            # MongoDB schemas
│   ├── routes/            # API endpoints
│   ├── middleware/        # Authentication & validation
│   └── index.js           # Server entry point
├── client/                # Frontend React app
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   ├── services/      # API service layer
│   │   └── App.js         # Main app component
│   └── public/            # Static assets
├── package.json           # Root package.json
└── README.md             # This file
```

## Prerequisites

- Node.js (v16 or higher)
- Firebase account (free tier available)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd .22LR-Rifle-Championship
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Firebase Setup**
   
   Follow the detailed setup guide in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) to:
   - Create a Firebase project
   - Enable Firestore Database
   - Download and configure your service account key
   - Set up security rules
   
   Quick setup:
   ```bash
   # Run the automated setup script
   node setup.js
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

   This will start both the backend server (port 5000) and frontend development server (port 3000).

## Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend in development mode
- `npm run server` - Start only the backend server
- `npm run client` - Start only the frontend development server
- `npm run build` - Build the frontend for production
- `npm run install-all` - Install dependencies for all packages

### Backend (server/)
- `npm run dev` - Start server with nodemon
- `npm start` - Start server in production mode
- `npm test` - Run tests

### Frontend (client/)
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile

### Competitions
- `GET /api/competitions` - List competitions
- `POST /api/competitions` - Create competition (Range Officers & Admins)
- `GET /api/competitions/:id` - Get competition details
- `PUT /api/competitions/:id` - Update competition
- `POST /api/competitions/:id/register` - Register for competition

### Scores
- `POST /api/scores` - Submit score
- `GET /api/scores/competition/:id` - Get competition scores
- `PUT /api/scores/:id/verify` - Verify score (Range Officers & Admins)

### Leaderboards
- `GET /api/leaderboards/indoor` - Indoor leaderboard
- `GET /api/leaderboards/outdoor` - Outdoor leaderboard
- `GET /api/leaderboards/overall` - Overall leaderboard

### Users
- `GET /api/users/profile/:id` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/:id/scores` - Get user scores

### Admin
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - Manage users
- `GET /api/admin/competitions` - Manage competitions
- `GET /api/admin/scores` - Manage scores

## Database Collections (Firestore)

### Users
- Authentication info (username, email, password)
- Profile data (name, DOB, location, bio)
- Role-based permissions (competitor, range_officer, admin)
- Statistics and performance tracking

### Competitions
- Competition details (title, description, rules)
- Schedule and location information
- Capacity and registration management
- Status tracking (draft, published, completed)

### Scores
- Competition and competitor references
- Shot-by-shot scoring data
- Verification status and evidence
- Equipment and conditions information

## Future Features (TODO)

### AI Integration
- **Video Score Review**: AI-powered analysis of submitted videos
- **Automatic Verification**: Machine learning for score validation
- **Performance Analytics**: Advanced statistics and insights

### Enhanced Features
- **Live Streaming**: Real-time competition streaming
- **Weather Integration**: Outdoor competition weather data
- **Sponsor Management**: Sponsor banner and prize integration
- **Mobile App**: React Native mobile application
- **Push Notifications**: Real-time updates and alerts

### Platform Enhancements
- **Payment Processing**: Competition entry fee handling
- **Email System**: Automated notifications and confirmations
- **Advanced Search**: Enhanced filtering and search capabilities
- **Social Features**: User connections and sharing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact the development team or create an issue in the repository.

---

**22LR Rifle Championship** - Precision shooting, redefined.
