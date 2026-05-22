# Project Overview 
  
 This repository is evolving from a standalone recorder into a production-grade VOD platform. 
  
 Core assumptions: 
 - recordings are created automatically by the recorder 
 - users CANNOT manually upload videos 
 - videos are automatically ingested into backend/storage 
 - payment systems are NOT implemented yet 
 - architecture MUST be future-proof for billing/subscriptions 
  
 # Architecture Rules 
  
 - Separate recorder from public platform 
 - Never tightly couple storage with business logic 
 - Never couple video processing with frontend 
 - Use clean architecture boundaries 
 - Prefer composition over monolith abstractions 
 - Prefer explicit interfaces 
 - Avoid hidden magic 
 - Avoid hardcoded infrastructure providers 
 - Keep modules independently testable 
  
 # Tech Stack 
  
 Frontend: 
 - Next.js 
 - React 
 - Tailwind 
 - shadcn/ui 
  
 Backend: 
 - NestJS 
 - PostgreSQL 
 - Prisma 
 - Redis 
 - BullMQ 
  
 Infra: 
 - Docker 
 - Cloudflare R2 
 - FFmpeg 
  
 # Workflow Rules 
  
 Before coding: 
 1. Explore existing code 
 2. Create implementation plan 
 3. Explain assumptions 
 4. Only then implement 
  
 After coding: 
 1. Run lint 
 2. Run typecheck 
 3. Run tests 
 4. Verify build passes 
  
 # Coding Rules 
  
 - Strict TypeScript 
 - No any unless absolutely necessary 
 - Use DTOs and validation 
 - Use environment variables 
 - Never hardcode secrets 
 - Keep files focused and small 
 - Prefer services over utility spaghetti 
 - Prefer explicit domain names 
  
 # Backend Rules 
  
 - Controller -> Service -> Repository 
 - No business logic in controllers 
 - Queue long-running tasks 
 - All async jobs must be retry-safe 
 - Use idempotency where possible 
  
 # Video Rules 
  
 - Use HLS 
 - Never serve raw MP4 directly 
 - Storage must support signed URLs 
 - All video operations async 
 - Large files expected 
  
 # Security Rules 
  
 - JWT + refresh tokens 
 - Rate limiting enabled 
 - Audit logs for admin actions 
 - Validate MIME types 
 - Validate inputs everywhere 
  
 # Future Billing Compatibility 
  
 Prepare extension points for: 
 - subscriptions 
 - entitlements 
 - feature flags 
 - premium content 
  
 Do not implement billing yet.
