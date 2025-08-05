# Employee Timesheet Management System

A modern, responsive web application for employee time tracking and management built with React, TypeScript, and Supabase.

## 🚀 Quick Start Guide for macOS

### Prerequisites

Before you begin, ensure you have the following installed on your macOS:

1. **Node.js** (v18 or higher)
   ```bash
   # Install using Homebrew (recommended)
   brew install node
   
   # Or download from https://nodejs.org/
   # Verify installation
   node --version
   npm --version
   ```

2. **Git**
   ```bash
   # Install using Homebrew
   brew install git
   
   # Verify installation
   git --version
   ```

3. **VS Code** (recommended)
   ```bash
   # Install using Homebrew
   brew install --cask visual-studio-code
   
   # Or download from https://code.visualstudio.com/
   ```

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd employee-timesheet-app

# Open in VS Code
code .
```

### Step 2: Install Dependencies

```bash
# Install all project dependencies
npm install

# This will install all packages listed in package.json
```

### Step 3: Supabase Setup

#### 3.1 Create a Supabase Account
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for a free account
3. Create a new project

#### 3.2 Get Your Project Credentials
1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-id.supabase.co`)
   - **Anon Key** (public key for client-side operations)

#### 3.3 Update Environment Configuration
1. Open `src/integrations/supabase/client.ts`
2. Replace the placeholder values with your actual Supabase credentials:
   ```typescript
   const SUPABASE_URL = "https://your-project-id.supabase.co";
   const SUPABASE_PUBLISHABLE_KEY = "your-anon-key-here";
   ```

### Step 4: Database Setup

#### 4.1 Run Database Migrations
The project includes SQL migration files. Execute them in your Supabase SQL editor:

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and run the contents of files in the `supabase/migrations/` folder in order

#### 4.2 Set up Edge Functions (Optional)
If you plan to use authentication features:

1. Install Supabase CLI:
   ```bash
   npm install -g @supabase/cli
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-id
   ```

4. Deploy functions:
   ```bash
   supabase functions deploy
   ```

### Step 5: Run the Application

```bash
# Start the development server
npm run dev

# The application will be available at http://localhost:5173
```

### Step 6: Initial Setup

#### 6.1 Create Admin User
1. In your Supabase dashboard, go to **Authentication** > **Users**
2. Create a new user with admin privileges
3. Add the user to the `admin_users` table with appropriate role

#### 6.2 Add Company Settings
1. Go to **Database** > **Table Editor**
2. Add a record to the `company_settings` table with your timezone and company info

## 📱 Features

### Core Functionality
- ⏰ **Real-time Clock In/Out** - Employees can track their work hours
- 📊 **Dashboard Analytics** - Comprehensive reporting and insights
- 👥 **Employee Management** - Admin tools for managing staff
- 📈 **Timesheet Management** - Detailed time tracking and reports
- 🌍 **Timezone Support** - Multi-timezone compatibility
- 📱 **Mobile Responsive** - Works perfectly on all devices

### User Roles
- **Admin** - Full access to all features and employee management
- **Employee** - Clock in/out, view personal timesheets, basic dashboard

### Technology Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **State Management**: TanStack Query
- **UI Components**: Radix UI + Custom components
- **Charts**: Recharts
- **Date Handling**: date-fns
- **Routing**: React Router DOM

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (shadcn/ui)
│   └── ...             # Feature-specific components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── integrations/       # External service integrations
│   └── supabase/       # Supabase configuration
└── contexts/           # React contexts

supabase/
├── functions/          # Edge functions
├── migrations/         # Database migrations
└── config.toml        # Supabase configuration
```

## 🔧 Configuration

### Environment Variables
All configuration is handled through the Supabase client file. No environment variables needed for basic setup.

### Timezone Configuration
The app uses company timezone settings stored in the database. Configure this in the `company_settings` table.

### Customization
- **Styling**: Modify `src/index.css` and `tailwind.config.ts`
- **Components**: Customize components in `src/components/`
- **Business Logic**: Update hooks and utils in respective folders

## 🚀 Deployment

### Option 1: Lovable Platform (Recommended)
Simply open [Lovable](https://lovable.dev/projects/733db91f-0f1c-4315-9d4f-8743f7fa150f) and click on Share -> Publish.

### Option 2: Manual Deployment
1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy the `dist/` folder to your hosting provider:
   - **Vercel**: Connect your GitHub repo
   - **Netlify**: Drag and drop the dist folder
   - **AWS S3**: Upload dist contents to S3 bucket

## 🔒 Security Features

- **Row Level Security (RLS)** - Database-level access control
- **JWT Authentication** - Secure token-based auth
- **Role-based Access** - Different permissions for admins and employees
- **Location Tracking** - GPS-based attendance verification

## 🐛 Troubleshooting

### Common Issues

1. **App won't start**
   ```bash
   # Clear node modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Database connection errors**
   - Verify your Supabase credentials in `src/integrations/supabase/client.ts`
   - Check if your Supabase project is active

3. **Build errors**
   ```bash
   # Check TypeScript errors
   npm run type-check
   
   # Fix linting issues
   npm run lint
   ```

4. **Authentication issues**
   - Ensure your Supabase project has auth enabled
   - Check RLS policies are correctly configured

### Performance Tips
- The app uses React Query for caching - data is automatically cached and refreshed
- Lazy loading is implemented for better performance
- Mobile-optimized with touch-friendly interactions

## 📞 Support

For technical issues or questions:
1. Check the troubleshooting section above
2. Review the Supabase documentation
3. Check the browser console for error messages
4. Ensure all dependencies are properly installed

## 🔄 Updates

To update the project:
```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Run any new migrations in Supabase
```

---

Built with ❤️ using modern web technologies for seamless employee time tracking.