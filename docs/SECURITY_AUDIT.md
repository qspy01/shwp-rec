# Security Audit

## 1. Existing Security Risks in Legacy Code
1. **Unbounded Resource Exhaustion (DoS Risk):** `main.js` attempts to open a Chromium instance for every online model up to `maxConcurrentRecordings`. A sudden spike in online models could crash the host system, leading to a self-inflicted Denial of Service.
2. **Missing Secrets Management:** The current implementation relies on simple local configuration files (`config.yml`).
3. **No Access Control:** There is no authentication or authorization layer for viewing the VODs or managing the system.
4. **Local File Traversal Risk:** The legacy scripts handle raw file names derived directly from usernames. While Node.js limits this, poor sanitization could lead to local file manipulation.

## 2. Mitigations in Target Architecture

### 2.1. Resource Protection
- **Strict Concurrency Limits:** BullMQ will limit exactly how many active `RecordStreamJob`s are processed by a single `worker-recorder` instance. Excess jobs wait in the queue safely.
- **Container Limits:** Docker `deploy.resources.limits` will constrain RAM/CPU per worker, preventing a single runaway Chromium instance from bringing down the node.

### 2.2. Secrets and Environment
- **Environment Variables:** All credentials (DB, Redis, MinIO) will be moved to environment variables, out of source control.
- **Principle of Least Privilege:** Workers will only have access to the MinIO buckets they need (e.g., `PUT` for Processor, `GET` for Web).

### 2.3. Web Platform Security
- **Authentication:** Next.js application will implement NextAuth.js or a similar provider for the Admin Dashboard.
- **API Rate Limiting:** Next.js API routes will implement IP-based rate limiting to prevent scraping of the VOD catalog.
- **Safe File Handling:** Filenames will be generated using UUIDs (e.g., `${uuid}.mp4`). Usernames will only be stored as metadata in PostgreSQL, eliminating directory traversal risks.

### 2.4. Infrastructure Security
- **Private Networking:** Redis and PostgreSQL will NOT be exposed to the public internet; they will only be accessible within the Docker network / VPC.
- **SSL/TLS:** Traefik/Nginx will enforce HTTPS for all public endpoints.
