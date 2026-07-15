# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-06-22

### Added
- Initial release of VSocial, a full-stack social network application.
- User authentication (JWT, local and OAuth), registration, and profile management.
- Core social features: posts, comments, likes, stories, reels, and follows.
- Real-time messaging (DMs and group chats) with media and voice notes.
- Marketplace for buying and selling with category listings.
- Gigs / Freelance board for posting and applying to commissions.
- Groups and Pages functionality with events.
- Wallet and transaction system for in-app monetization.
- Notifications system with push support and read receipts.
- Admin panel and moderation tools (reports, user management).
- Structured logging with Pino.
- Database migration system (`_migrations` table) for versioned schema updates.
- Basic security module (rate limiting, input sanitization, validation).
- Health check endpoint at `/api/health`.
- Unit tests setup using Vitest for core utilities and database connectivity.
- Docker and docker-compose configuration for containerized deployment.
- CI/CD hooks with pre-commit linting and build verification.
- `.env.example` with comprehensive production configuration.
