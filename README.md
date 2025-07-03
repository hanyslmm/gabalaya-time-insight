# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/733db91f-0f1c-4315-9d4f-8743f7fa150f

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/733db91f-0f1c-4315-9d4f-8743f7fa150f) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

### Option 1: Lovable Platform (Recommended)
Simply open [Lovable](https://lovable.dev/projects/733db91f-0f1c-4315-9d4f-8743f7fa150f) and click on Share -> Publish.

### Option 2: Deploy to Render

Follow these steps to deploy your Employee Timesheet Management System to Render:

#### Prerequisites
- A GitHub account with your project repository
- A Render account (sign up at [render.com](https://render.com))

#### Step-by-Step Deployment

1. **Connect your GitHub repository to Render:**
   - Log in to your Render dashboard
   - Click "New +" and select "Web Service"
   - Connect your GitHub account and select your repository

2. **Configure the build settings:**
   - **Name**: Choose a name for your service
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (root of repository)
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run preview`
   - **Publish Directory**: `dist`

3. **Set Environment Variables:**
   
   **Required for build process:**
   - `NPM_CONFIG_INCLUDE_DEV` = `true` (This ensures devDependencies are installed for the build)
   
   **Required for Supabase integration:**
   - `VITE_SUPABASE_URL` = `https://npmniesobtsoftczeh.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbW5pZXNwaG9idHNvZnRjemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3OTc5ODYsImV4cCI6MjA2NjM3Mzk4Nn0.iTO3IXLxisUhosFZsE3cAo2oNsq8G6mWybSwjAGuJHQ`

4. **Deploy:**
   - Click "Create Web Service"
   - Render will automatically build and deploy your application
   - The first deployment may take 5-10 minutes

#### Troubleshooting Common Issues

**Build fails with "vite: not found" error:**
- Ensure you've set `NPM_CONFIG_INCLUDE_DEV=true` in environment variables
- This tells Render to install devDependencies required for the build process

**Application loads but data doesn't appear:**
- Verify your Supabase environment variables are set correctly
- Check that your Supabase project is accessible from external domains

**Build takes too long or times out:**
- Consider upgrading to a paid Render plan for faster build times
- Check for any large dependencies that might be causing slow builds

#### Post-Deployment Verification
1. Visit your deployed application URL
2. Test the login functionality
3. Verify timesheet upload and data display works correctly
4. Check that all navigation links work properly

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
