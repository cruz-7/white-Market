# Security Audit Checklist

## 🔐 Authentication & Authorization
- [ ] JWT tokens have reasonable expiration times
- [ ] Password hashing uses bcrypt/scrypt (not MD5/SHA)
- [ ] Rate limiting implemented on auth endpoints
- [ ] Account lockout after failed attempts
- [ ] Secure password reset flow (no token leakage)

## 🛡️ API Security
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (sanitize user inputs)
- [ ] CSRF protection on state-changing operations
- [ ] CORS properly configured (not wildcard in production)

## 📊 Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] HTTPS enforced everywhere
- [ ] No sensitive data in client-side storage
- [ ] Database backups encrypted
- [ ] GDPR compliance for user data

## 🔍 Security Headers
- [ ] Content Security Policy (CSP) headers
- [ ] X-Frame-Options to prevent clickjacking
- [ ] X-Content-Type-Options: nosniff
- [ ] Strict-Transport-Security
- [ ] Referrer-Policy configured

## 📱 File Upload Security
- [ ] File type validation (not just extension)
- [ ] File size limits enforced
- [ ] Malicious file scanning
- [ ] Secure file storage (not in web root)

## 🚨 Monitoring & Response
- [ ] Security event logging
- [ ] Intrusion detection system
- [ ] Regular security updates
- [ ] Incident response plan
- [ ] Security headers scanner (securityheaders.com)