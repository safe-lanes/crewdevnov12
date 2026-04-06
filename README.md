# sail-crewing--module
# crewing-r3

## Description
This is the production build for the SAIL crewing module, a REST API built with Express.js and a frontend built with Vite.

## Prerequisites
- Node.js (version 18 or higher)
- npm or yarn
- PM2 (for production process management)

## Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd crewing_build_production
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (create a `.env` file based on `.env.example` if available).

## Building for Production
To build the application for production:

```bash
npm run build:prod
```

This command will:
- Build the frontend using Vite
- Bundle the backend using esbuild
- Output files to the `dist/` directory

## Running in Production
1. Ensure the build is complete.

2. Start the application using PM2:
   ```bash
   pm2 start ecosystem.config.cjs
   ```

3. Alternatively, start directly with Node.js:
   ```bash
   npm run start:prod
   ```

## PM2 Management
- Check status: `pm2 status`
- View logs: `pm2 logs sail-crewing-api`
- Restart: `pm2 restart sail-crewing-api`
- Stop: `pm2 stop sail-crewing-api`
- Delete: `pm2 delete sail-crewing-api`

## Environment Variables
Set the following environment variables for production:
- `NODE_ENV=production`
- `PORT=4000` (or your desired port)

## Database
Run database migrations if needed:
```bash
npm run db:push
```

## Testing
Run tests before deployment:
```bash
npm run test:all
```

## Deployment Checklist
- [ ] Build completed successfully
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] PM2 process started
- [ ] Application accessible on specified port
