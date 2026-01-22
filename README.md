# StudyLens AI

**Your intelligent study companion. Organize coursework, learn faster, and ace your exams with AI-powered insights.**

StudyLens AI is a comprehensive course management platform that helps students organize their study materials, generate AI-powered study aids, and practice with interactive flashcards and exams. Built with modern web technologies and powered by OpenAI, it transforms how students interact with their course content.

## Overview

StudyLens AI solves the problem of information overload and inefficient study methods. Students often struggle with:
- **Scattered course materials** across multiple PDFs and documents
- **Difficulty finding specific information** when reviewing for exams
- **Lack of personalized study aids** like flashcards and practice questions
- **Inefficient study techniques** that don't adapt to their learning pace

This platform addresses these challenges by providing:
- **Centralized course organization** with file uploads and management
- **AI-powered search** that finds relevant content instantly using vector embeddings
- **Intelligent study tools** that generate flashcards, summaries, and practice exams from course materials
- **Spaced repetition system** that optimizes flashcard review timing based on the SM-2 algorithm

The platform is designed for students at any level—from high school to graduate school—who want to study more efficiently and effectively.

## Key Features

### 📚 Course Management
- Create and organize courses with custom names, descriptions, emojis, and colors
- Upload PDF files that are automatically processed and indexed
- View all course files in an organized sidebar
- Delete files and courses as needed

### 🤖 AI-Powered Chat Assistant
- **Context-aware conversations** that understand your course materials
- **Retrieval Augmented Generation (RAG)** that searches your uploaded files to provide accurate, source-based answers
- **Multiple generation modes**:
  - **Practice Questions**: Generate test questions with varying difficulty levels
  - **Summary**: Create comprehensive summaries of course materials
  - **Key Concepts**: Extract and explain important concepts
  - **Study Guide**: Build detailed study guides organized by topics
  - **Flashcards**: Generate question-answer pairs for memorization
  - **Explain Concept**: Get detailed explanations of specific topics
- **Real-time streaming responses** for immediate feedback
- **Chat history** that persists across sessions

### 🎴 Intelligent Flashcards
- **AI-generated flashcards** from course materials or specific topics
- **Spaced repetition algorithm (SM-2)** that adapts review intervals based on your performance
- **Difficulty tracking** that categorizes cards as Easy, Medium, or Hard based on review quality
- **Filter options** to focus on cards by difficulty or review all cards
- **Review system** with quality ratings (Hard, Medium, Easy) that adjusts future review dates
- **Progress tracking** showing repetitions and review history

### 📝 Practice Exam Generator
- **Multi-step workflow** that analyzes course materials, identifies key topics, and generates questions
- **Customizable difficulty** (Easy, Medium, Hard, or Mixed)
- **Variable question count** (5-50 questions per exam)
- **Multiple question types**: Multiple choice and short answer
- **Detailed explanations** for each answer
- **Export functionality** to download exams as HTML files
- **Progress tracking** with status indicators (Analyzing → Identifying Topics → Generating → Completed)

### 🔍 Vector Search & Embeddings
- **Automatic PDF processing** that extracts text and creates embeddings
- **Semantic search** using OpenAI's text-embedding-3-small model (1536 dimensions)
- **Vector indexing** in Convex for fast, relevant content retrieval
- **Context-aware responses** that cite specific source files

### 🔐 User Authentication
- **Email-based signup** with verification codes
- **Secure password authentication** with bcrypt hashing
- **Password reset** functionality with email verification
- **Session management** with automatic token refresh

## Live Demo / Screenshots

*Note: Add your live demo URL and screenshots here when available.*

The demo showcases:
- A clean, modern interface for managing courses
- Interactive AI chat with real-time responses
- Flashcard review interface with flip animations
- Practice exam generation with progress tracking

## Architecture & Tech Stack

StudyLens AI follows a modern full-stack architecture with a React frontend, Convex backend, and AI services integration.

**Architecture Flow:**
```
User (Browser)
    ↓
Next.js Frontend (React 19, TypeScript)
    ↓
Convex Backend (Database + Functions)
    ├─→ OpenAI API (Chat & Embeddings)
    ├─→ Convex Vector Index (Semantic Search)
    └─→ Resend API (Email Service)
```

### Frontend Technologies
- **Next.js 15.3.3**: React framework with App Router, server components, and API routes
- **React 19**: UI library with latest features and performance improvements
- **TypeScript 5**: Type-safe development
- **Tailwind CSS 4**: Utility-first styling with custom design system
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, forms)
- **Lucide React**: Icon library
- **Sonner**: Toast notifications
- **React Markdown**: Markdown rendering for AI responses
- **PDF.js**: Client-side PDF text extraction

### Backend Technologies
- **Convex 1.24.8**: Backend-as-a-Service providing:
  - Real-time database with automatic reactivity
  - Serverless functions (queries, mutations, actions)
  - Built-in vector search with 1536-dimensional embeddings
  - File storage for PDF uploads
  - Authentication system
- **Convex Auth 0.0.87**: Authentication library with password provider
- **OpenAI AI SDK**: Integration with GPT-4o-mini and text-embedding-3-small

### AI & ML
- **OpenAI GPT-4o-mini**: Primary language model for chat, content generation, and exam/question creation
- **OpenAI text-embedding-3-small**: Vector embeddings (1536 dimensions) for semantic search
- **Vector Search**: Convex's built-in vector index for fast similarity search
- **RAG Pipeline**: Retrieval Augmented Generation that combines vector search with LLM responses

### External Services
- **Resend**: Email service for verification codes and password resets
- **Modal** (Optional): Python compute layer for advanced RAG features (Pinecone, Cohere re-ranking)

### Development Tools
- **ESLint**: Code linting
- **TypeScript**: Static type checking
- **Turbopack**: Fast bundler for development

## Getting Started

### Prerequisites

- **Node.js**: Version 20 or higher
- **npm** or **yarn**: Package manager
- **Convex account**: Free tier available at [convex.dev](https://convex.dev)
- **OpenAI API key**: Get one at [platform.openai.com](https://platform.openai.com)
- **Resend API key** (for email): Get one at [resend.com](https://resend.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "StudyLens AI"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Convex**
   ```bash
   npx convex dev
   ```
   This will:
   - Create a new Convex project (or connect to existing)
   - Generate configuration files
   - Deploy your schema and functions
   - Provide you with a deployment URL

4. **Configure environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Convex Configuration
   NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
   
   # OpenAI API Key (for AI features)
   OPENAI_API_KEY=sk-your-openai-api-key
   
   # Resend API Key (for email verification)
   RESEND_API_KEY=re_your-resend-api-key
   ```

   **Environment Variable Details:**
   - `NEXT_PUBLIC_CONVEX_URL`: Your Convex deployment URL (found after running `npx convex dev`)
   - `OPENAI_API_KEY`: Your OpenAI API key for GPT-4o-mini and embeddings
   - `RESEND_API_KEY`: Your Resend API key for sending verification emails

5. **Set up Convex environment variables**
   
   In your Convex dashboard or via CLI:
   ```bash
   npx convex env set OPENAI_API_KEY sk-your-openai-api-key
   npx convex env set RESEND_API_KEY re_your-resend-api-key
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

### Building for Production

1. **Build the Next.js application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

### Running Tests

Currently, the project does not include automated tests. To add testing:
- Consider adding Jest or Vitest for unit tests
- Use Playwright or Cypress for end-to-end tests
- Test Convex functions with the Convex testing utilities

## Usage

### Creating Your First Course

1. **Sign up or sign in**
   - Click "Get Started" on the homepage
   - Create an account with your email
   - Verify your email with the code sent to your inbox

2. **Create a course**
   - Click "Create Course" button
   - Enter a course name (e.g., "Introduction to Computer Science")
   - Add an optional description
   - Choose an emoji and color (optional, for visual organization)
   - Click "Create"

3. **Upload course materials**
   - Open your course
   - Click "Upload File" button
   - Select a PDF file from your computer
   - Wait for processing (the file is automatically indexed for search)

### Using the AI Chat Assistant

1. **Start a conversation**
   - Open a course with uploaded files
   - Type a question in the chat box (e.g., "What is SQL?")
   - The AI searches your course materials and provides an answer

2. **Use generation modes**
   - Click the mode selector (Practice Questions, Summary, Key Concepts, etc.)
   - Select a mode
   - The AI generates content based on your course materials
   - Example: Select "Summary" to get a comprehensive overview of all uploaded files

3. **Ask follow-up questions**
   - Continue the conversation with related questions
   - The AI maintains context from your course materials
   - All messages are saved in chat history

### Creating and Reviewing Flashcards

1. **Generate flashcards**
   - Open the Flashcards view (toggle in the course view)
   - Click "Generate Flashcards"
   - Optionally specify a topic (e.g., "SQL basics")
   - Set the number of flashcards (default: 10)
   - Click "Generate Flashcards"
   - Wait for AI to create question-answer pairs from your materials

2. **Review flashcards**
   - Click a flashcard to flip and see the answer
   - Rate your performance:
     - **Hard** (red X): You struggled with this
     - **Medium**: You got it partially right
     - **Easy** (green check): You knew it well
   - The system automatically schedules the next review based on your rating

3. **Filter and organize**
   - Use filter buttons (All, Easy, Medium, Hard) to focus on specific cards
   - Toggle "Review All" to see all cards or only due cards
   - View progress indicators showing repetitions and difficulty

### Generating Practice Exams

1. **Create an exam**
   - Open the Exam Generator view
   - Set the number of questions (5-50)
   - Choose difficulty level (Easy, Medium, Hard, or Mixed)
   - Click "Generate Practice Exam"
   - Watch the progress: Analyzing → Identifying Topics → Generating Questions → Completed

2. **Take the exam**
   - Once completed, click "View" to see all questions
   - Read each question and think about the answer
   - Toggle "Show Answers" to reveal correct answers and explanations

3. **Export the exam**
   - Click "Export" to download as HTML
   - Open the HTML file in a browser
   - Print to PDF if desired

## Project Structure

```
StudyLens AI/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Authentication pages (signin, verify-email, etc.)
│   │   ├── (main)/            # Main application pages (protected routes)
│   │   │   ├── courses/       # Course management components
│   │   │   │   ├── course-ai-chat-box.tsx      # AI chat interface
│   │   │   │   ├── course-files-view.tsx        # File management UI
│   │   │   │   ├── flashcards-view.tsx          # Flashcard review UI
│   │   │   │   ├── exam-generator-view.tsx     # Exam generation UI
│   │   │   │   └── ...
│   │   │   ├── layout.tsx     # Main layout with navbar
│   │   │   └── navbar.tsx     # Navigation bar
│   │   ├── layout.tsx         # Root layout with providers
│   │   └── page.tsx           # Homepage
│   ├── components/            # Reusable UI components
│   │   ├── ui/               # shadcn/ui components (buttons, dialogs, etc.)
│   │   ├── markdown.tsx      # Markdown renderer for AI responses
│   │   └── ...
│   └── lib/                   # Utility functions
│       ├── pdfParser.ts      # PDF text extraction
│       └── embeddings.ts     # Embedding generation utilities
├── convex/                    # Convex backend
│   ├── schema.ts             # Database schema definition
│   ├── courses.ts            # Course CRUD operations
│   ├── files.ts              # File management functions
│   ├── flashcards.ts         # Flashcard logic with SM-2 algorithm
│   ├── examGenerator.ts      # Practice exam generation workflow
│   ├── http.ts               # HTTP endpoint for AI chat
│   ├── fileActions.ts        # Vector search and embedding operations
│   ├── chatMessages.tsx      # Chat history management
│   ├── auth.ts               # Authentication configuration
│   └── ...
├── modal_service/            # Optional Python service for advanced RAG
│   ├── app.py                # Modal deployment configuration
│   └── README.md             # Modal service documentation
├── public/                   # Static assets
│   └── pdf.worker.min.mjs   # PDF.js worker for client-side PDF processing
├── package.json              # Dependencies and scripts
├── next.config.ts            # Next.js configuration
└── tsconfig.json             # TypeScript configuration
```

**Key Files Explained:**
- `convex/schema.ts`: Defines all database tables (courses, files, flashcards, embeddings, etc.)
- `convex/http.ts`: Main HTTP endpoint that handles AI chat requests with RAG
- `convex/flashcards.ts`: Implements SM-2 spaced repetition algorithm
- `convex/examGenerator.ts`: Multi-step workflow for generating practice exams
- `src/app/(main)/courses/course-ai-chat-box.tsx`: React component for AI chat interface
- `src/lib/pdfParser.ts`: Extracts text from PDF files on the client side

## Data & Models

### Core Entities

**Users**
- Stored in Convex Auth tables
- Has email, password hash, and authentication sessions
- Owns courses, files, flashcards, and chat messages

**Courses**
- `_id`: Unique identifier
- `userId`: Owner of the course
- `name`: Course name (e.g., "Introduction to SQL")
- `description`: Optional course description
- `emoji`: Optional emoji for visual identification
- `color`: Optional hex color code
- `createdAt`: Timestamp

**Files**
- `_id`: Unique identifier
- `userId`: Owner
- `courseId`: Parent course
- `name`: Original filename
- `storageId`: Reference to Convex file storage
- `uploadDate`: Timestamp

**File Embeddings**
- `_id`: Unique identifier
- `content`: Text chunk from the PDF
- `embedding`: 1536-dimensional vector (OpenAI text-embedding-3-small)
- `fileId`: Source file
- `userId`: Owner
- `courseId`: For filtering by course
- Indexed with vector search for semantic retrieval

**Flashcards**
- `_id`: Unique identifier
- `courseId`: Parent course
- `userId`: Owner
- `question`: Flashcard question
- `answer`: Flashcard answer
- `easeFactor`: SM-2 algorithm parameter (default: 2.5)
- `interval`: Days until next review
- `repetitions`: Number of successful reviews
- `nextReviewDate`: Timestamp for next review
- `lastReviewDate`: Optional timestamp
- `lastReviewQuality`: Optional 1-5 rating for display

**Exam Workflows**
- `_id`: Unique identifier
- `courseId`: Parent course
- `userId`: Owner
- `status`: "analyzing" | "identifying_topics" | "generating_questions" | "completed" | "failed"
- `syllabusAnalysis`: Optional analysis text
- `identifiedTopics`: Optional array of topic strings
- `questions`: Optional array of question objects
- `difficulty`: Overall exam difficulty
- `createdAt`: Timestamp
- `completedAt`: Optional completion timestamp

**Chat Messages**
- `_id`: Unique identifier
- `courseId`: Parent course
- `userId`: Owner
- `role`: "user" | "assistant"
- `content`: Message text
- `timestamp`: Timestamp

### Relationships

- **User → Courses**: One-to-many (a user can have multiple courses)
- **Course → Files**: One-to-many (a course can have multiple files)
- **File → Embeddings**: One-to-many (a file is chunked into multiple embeddings)
- **Course → Flashcards**: One-to-many (a course can have many flashcards)
- **Course → Exam Workflows**: One-to-many (a course can have multiple generated exams)
- **Course → Chat Messages**: One-to-many (conversation history per course)

## AI / ML Details

### Models Used

1. **OpenAI GPT-4o-mini**
   - **Purpose**: Primary language model for all text generation
   - **Use cases**:
     - Chat responses with course material context
     - Flashcard generation (question-answer pairs)
     - Practice exam question generation
     - Summaries, study guides, and concept explanations
   - **Input**: User questions + retrieved course material context
   - **Output**: Formatted markdown responses

2. **OpenAI text-embedding-3-small**
   - **Purpose**: Vector embeddings for semantic search
   - **Dimensions**: 1536
   - **Use cases**:
     - Converting PDF text chunks into vectors
     - Converting user queries into vectors for search
   - **Input**: Text strings (course content or user queries)
   - **Output**: 1536-dimensional float arrays

### RAG (Retrieval Augmented Generation) Pipeline

1. **Document Processing**
   - PDF files are uploaded and processed client-side using PDF.js
   - Text is extracted and split into chunks (by paragraph breaks)
   - Each chunk is embedded using OpenAI's embedding model
   - Embeddings are stored in Convex with metadata (fileId, courseId, userId)

2. **Query Processing**
   - User asks a question in the chat
   - Query is embedded using the same embedding model
   - Vector search is performed in Convex using cosine similarity
   - Top 15 most relevant chunks are retrieved (configurable)

3. **Context Assembly**
   - Retrieved chunks are formatted with source file names
   - Context is prepended to the system prompt
   - System prompt instructs the LLM to use only the provided materials

4. **Response Generation**
   - GPT-4o-mini generates a response using the context
   - Response is streamed to the user in real-time
   - Response is saved to chat history

### Spaced Repetition Algorithm (SM-2)

The flashcard system uses the **SM-2 algorithm** (SuperMemo 2) to optimize review timing:

- **Initial state**: New cards start with `easeFactor = 2.5`, `interval = 1 day`, `repetitions = 0`
- **Quality ratings**: User rates each review as 1 (Hard), 3 (Medium), or 5 (Easy)
- **Algorithm updates**:
  - If quality < 3: Reset repetitions and interval to initial values
  - If quality ≥ 3: Increase repetitions, calculate new interval based on ease factor
  - Ease factor adjusts based on performance (decreases for poor performance, increases for good)
- **Next review date**: Calculated as `currentDate + interval days`
- **Result**: Cards you struggle with appear more frequently; cards you know well appear less frequently

## Design & Trade-offs

### Design Decisions

1. **Convex as Backend**
   - **Why**: Provides real-time reactivity, built-in vector search, and serverless functions
   - **Trade-off**: Vendor lock-in vs. faster development and built-in features
   - **Benefit**: No need to manage separate database, API server, or real-time infrastructure

2. **Client-Side PDF Processing**
   - **Why**: Reduces server load and processing costs
   - **Trade-off**: Larger client bundle size vs. server processing overhead
   - **Benefit**: PDFs are processed immediately without waiting for server queues

3. **Vector Search in Convex**
   - **Why**: Native integration, no external vector database needed
   - **Trade-off**: Less advanced features vs. simplicity and cost
   - **Benefit**: Single platform for all data and search operations

4. **SM-2 Algorithm for Flashcards**
   - **Why**: Proven algorithm used by Anki and other successful spaced repetition systems
   - **Trade-off**: Simpler algorithms exist but are less effective
   - **Benefit**: Optimal review scheduling based on research-backed methods

5. **Streaming AI Responses**
   - **Why**: Better user experience with immediate feedback
   - **Trade-off**: More complex implementation vs. better UX
   - **Benefit**: Users see responses as they're generated, not after completion

### Known Limitations

1. **PDF-Only Support**: Currently only supports PDF files. Future: Add support for Word docs, images with OCR, etc.
2. **Single Language**: Optimized for English. Future: Multi-language support for embeddings and responses.
3. **No Collaborative Features**: Courses are private to each user. Future: Shared courses, study groups.
4. **Limited Export Formats**: Exams export as HTML only. Future: PDF export, print-friendly formats.
5. **No Mobile App**: Web-only. Future: React Native mobile app for on-the-go studying.

### Future Improvements

- **Advanced RAG**: Integration with Modal service for hybrid search (dense + sparse) and Cohere re-ranking
- **Analytics Dashboard**: Track study time, flashcard performance, exam scores over time
- **Study Plans**: AI-generated study schedules based on exam dates and course load
- **Collaborative Features**: Share courses with classmates, study groups
- **Mobile App**: Native iOS/Android apps for mobile studying
- **Offline Support**: Cache flashcards and course materials for offline access

## Testing & Quality

### Current Testing Status

The project currently does not include automated tests. This is a known area for improvement.

### Code Quality Tools

- **ESLint**: Configured with Next.js recommended rules
- **TypeScript**: Strict type checking enabled
- **Prettier**: Code formatting (if configured)

### Recommended Testing Strategy

1. **Unit Tests** (Jest/Vitest)
   - Test SM-2 algorithm calculations
   - Test PDF text extraction
   - Test embedding generation utilities

2. **Integration Tests**
   - Test Convex functions (queries, mutations, actions)
   - Test RAG pipeline end-to-end
   - Test authentication flows

3. **End-to-End Tests** (Playwright/Cypress)
   - Test user flows: signup → create course → upload file → chat → generate flashcards
   - Test flashcard review workflow
   - Test exam generation and export

### Running Linters

```bash
npm run lint
```

## Deployment

### Deploying to Vercel (Recommended)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Import project in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Configure environment variables in Vercel**
   - `NEXT_PUBLIC_CONVEX_URL`: Your Convex deployment URL
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `RESEND_API_KEY`: Your Resend API key

4. **Deploy**
   - Vercel automatically builds and deploys
   - Your app will be available at `your-project.vercel.app`

### Deploying Convex Functions

Convex functions are automatically deployed when you run:
```bash
npx convex dev
```

For production deployment:
```bash
npx convex deploy
```

### Environment Variables for Production

Ensure these are set in your hosting platform (Vercel, etc.):
- `NEXT_PUBLIC_CONVEX_URL`: Your production Convex URL
- `OPENAI_API_KEY`: Production OpenAI key
- `RESEND_API_KEY`: Production Resend key

### Build Configuration

The project uses Next.js 15 with:
- **Output**: Standalone (for Docker) or default (for Vercel)
- **TypeScript**: Build errors are ignored in config (not recommended for production)
- **ESLint**: Build errors are ignored in config (not recommended for production)

**Note**: Consider fixing TypeScript and ESLint errors before production deployment.

## Roadmap / Future Work

### Short-term (Next 3 months)
- [ ] Add automated testing (unit, integration, e2e)
- [ ] Fix TypeScript and ESLint errors
- [ ] Add PDF export for practice exams
- [ ] Improve error handling and user feedback
- [ ] Add loading states and progress indicators
- [ ] Optimize embedding generation for large files

### Medium-term (3-6 months)
- [ ] Integrate Modal service for advanced RAG (hybrid search, re-ranking)
- [ ] Add analytics dashboard (study time, performance metrics)
- [ ] Support for additional file types (Word, images with OCR)
- [ ] Study plan generator based on exam dates
- [ ] Collaborative features (shared courses, study groups)
- [ ] Mobile-responsive improvements

### Long-term (6+ months)
- [ ] Native mobile apps (iOS/Android)
- [ ] Offline support with service workers
- [ ] Multi-language support
- [ ] Advanced AI features (personalized learning paths, adaptive difficulty)
- [ ] Integration with learning management systems (Canvas, Blackboard)
- [ ] White-label solution for educational institutions

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
   - Follow the existing code style
   - Add comments for complex logic
   - Test your changes locally
4. **Commit your changes**
   ```bash
   git commit -m "Add: Description of your feature"
   ```
5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request**
   - Describe your changes clearly
   - Reference any related issues
   - Wait for review and feedback

### Development Guidelines

- Use TypeScript for all new code
- Follow React best practices (hooks, component composition)
- Keep components small and focused
- Add JSDoc comments for public functions
- Update this README if you add new features

## License

Proprietary / All rights reserved

This project is private and not licensed for public use.

## Author & Contact

**StudyLens AI Development Team**

- **GitHub**: [Your GitHub Profile]
- **Email**: [Your Email]
- **LinkedIn**: [Your LinkedIn]
- **Portfolio**: [Your Portfolio]

---

**Built with ❤️ using Next.js, Convex, and OpenAI**

