# E-shred-x-periodization Gym Coach App

## Overview

E-shred-x-periodization is a modern gym coach application designed to help fitness coaches manage their clients, track workouts, and monitor progress. The application features a dual interface for both coaches and clients, with comprehensive workout management, progress tracking, and data visualization capabilities. Built with a focus on user experience, it employs a dark/light theme system and modern UI components for an intuitive fitness management platform.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built as a Single Page Application (SPA) using React with TypeScript. The architecture follows a component-based design pattern with clear separation of concerns:

- **React Router**: Uses Wouter for lightweight client-side routing
- **State Management**: React Query (@tanstack/react-query) for server state management with local React state for UI state
- **UI Framework**: Custom component library built on Radix UI primitives with Tailwind CSS for styling
- **Theme System**: Built-in dark/light mode toggle with CSS custom properties
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

The application implements role-based routing, automatically directing users to either the coach dashboard or client portal based on their authentication role.

### Backend Architecture

The backend follows a RESTful API design using Express.js with TypeScript:

- **Framework**: Express.js with middleware for request logging, error handling, and JSON parsing
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **Database Layer**: Drizzle ORM for type-safe database operations
- **Storage Pattern**: Repository pattern implementation through a storage interface for data access abstraction
- **Error Handling**: Centralized error handling middleware with structured error responses

### Data Storage Solutions

The application uses PostgreSQL as the primary database with the following schema design:

- **Users Table**: Stores coach and client user accounts with role-based access
- **Clients Table**: Links clients to coaches with fitness goals and body metrics
- **Workouts Table**: Stores workout plans and completed sessions with exercise data stored as JSON
- **Progress Entries Table**: Tracks client progress measurements over time

The database configuration supports both local development and cloud deployment through environment-based connection strings.

### Authentication and Authorization

The authentication system implements:

- **JWT Tokens**: Stateless authentication with configurable secret keys
- **Role-Based Access**: Coach and client roles with different permission levels
- **Secure Storage**: Client-side token storage with automatic authentication checks
- **Protected Routes**: Middleware-based route protection for API endpoints
- **Session Management**: Automatic logout and token refresh handling

### UI Design System

The application implements a comprehensive design system:

- **Component Library**: Built on Radix UI for accessibility and behavioral consistency
- **E-shred-x-periodization Brand Colors**: Custom color palette with green primary (#00ffab) and orange accent (#ff3c00)
- **Responsive Design**: Mobile-first approach with collapsible navigation
- **Glass Morphism**: Modern UI effects with backdrop blur and transparency
- **Animation System**: Smooth transitions and micro-interactions for enhanced UX

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle Kit**: Database migration and schema management tools

### UI and Styling
- **Radix UI**: Headless UI component primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: Type-safe variant handling for components

### Development Tools
- **Vite**: Build tool and development server with React plugin
- **TypeScript**: Type safety and enhanced developer experience
- **ESBuild**: Fast bundling for production builds

### Form and Validation
- **React Hook Form**: Performant form management with minimal re-renders
- **Zod**: Schema validation for type-safe data handling
- **Hookform Resolvers**: Integration between React Hook Form and Zod

### Authentication and Security
- **JSON Web Tokens**: Stateless authentication token management
- **Bcrypt**: Secure password hashing and comparison
- **Connect PG Simple**: PostgreSQL session store for Express sessions

## Admin Portal & Coach Registration (Phase 1)

This phase introduces the Admin/Owner portal and a public "Register as Coach" flow with email verification and admin approval. Changes are additive and non-breaking.

### New Database Tables
- `shared/schema.ts`:
  - `coach_profiles` (status: `pending | active | suspended`, phone, bio, specialties)
  - `email_verifications` (token, expiresAt, usedAt)
  - `audit_logs` (reserved for future use)
  - Users: added `emailVerifiedAt` and role now supports `admin`.

Run migrations (drizzle push):

```bash
npm run db:push
```

### Environment Variables
See `.env.example` for full list. Recommended for Phase 1:

```bash
EMAIL_VERIFY=true
APPROVAL_REQUIRED=true
ENABLE_ADMIN_MUTATION=false
JWT_SECRET=your-strong-secret
```

On Render, set these under the service's Environment.

### Backend Endpoints
- Public:
  - `POST /api/auth/register-coach` – Creates a coach user (role=coach), pending profile, and an email verification token. Prints a verify URL in logs for development.
  - `GET /api/auth/verify-email?token=...` – Marks the user as email-verified.
- Auth:
  - `POST /api/auth/login` – If `EMAIL_VERIFY=true`, coach login requires `emailVerifiedAt`. If `APPROVAL_REQUIRED=true`, coach login requires `coach_profiles.status === 'active'`.
- Admin (read-only for Phase 1):
  - `GET /api/admin/coaches` – List coaches with profile status and client count.
  - `GET /api/admin/coaches/:id` – Detail view.
  - `PATCH /api/admin/coaches/:id` – Present but gated behind `ENABLE_ADMIN_MUTATION`. Defaults to 405 in Phase 1.

### Frontend Routes
- Public:
  - `/register-coach` – UI form only; posts to `POST /api/auth/register-coach`.
- Admin:
  - `/admin/coaches` – List of coaches.
  - `/admin/coaches/:id` – Detail view with disabled actions by default.
- Root routing:
  - Admin users land on the Admin Coaches list.
  - Coaches land on Coach Dashboard.
  - Clients land on Client Portal.

### Promote an Admin
Promote a user to admin with the helper script:

```bash
npm run promote:admin -- --email=owner@example.com
```

This sets the user's role to `admin` and marks email as verified.

### Test Flow (Local)
1. Set envs from `.env.example` (at least `DATABASE_URL`, `JWT_SECRET`, `EMAIL_VERIFY=true`, `APPROVAL_REQUIRED=true`).
2. Apply schema: `npm run db:push`.
3. Start dev server: `npm run dev`.
4. Visit `/register-coach` and submit the form.
5. Copy the verification URL from server logs and open it to verify.
6. Promote an admin account (or use an existing admin) and visit `/admin/coaches`.
7. Confirm the newly registered coach is `pending`. (Approval action is gated in Phase 1.)

### Notes
- Email provider integration is left as a TODO. The verify URL is logged in development as a hint.
- Admin mutations can be enabled later via `ENABLE_ADMIN_MUTATION=true`.