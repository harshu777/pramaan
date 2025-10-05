# SSL/HTTPS Configuration - Pramaan Certificate System

## ✅ SSL Certificate Successfully Configured

### Certificate Details
- **Domain:** pramaan.0-4.nl
- **Issuer:** Let's Encrypt
- **Type:** ECDSA
- **Expiry:** January 3, 2026 (89 days from now)
- **Auto-Renewal:** Enabled (via systemd timer)

### Certificate Files
- **Full Chain:** /etc/letsencrypt/live/pramaan.0-4.nl/fullchain.pem
- **Private Key:** /etc/letsencrypt/live/pramaan.0-4.nl/privkey.pem

## 🌐 Access URLs

### HTTPS (Secure)
- **Application:** https://pramaan.0-4.nl
- **Health Check:** https://pramaan.0-4.nl/health
- **API:** https://pramaan.0-4.nl/api/

### HTTP Redirect
- All HTTP traffic automatically redirects to HTTPS
- Example: http://pramaan.0-4.nl → https://pramaan.0-4.nl

## 🔄 Certificate Auto-Renewal

Certbot has configured automatic renewal via systemd timer:
```bash
# Check renewal timer status
systemctl status certbot.timer

# Test renewal (dry run)
certbot renew --dry-run

# Force renewal (if needed)
certbot renew --force-renewal
```

## 🔒 SSL Configuration

Nginx is configured with:
- TLS 1.2 and 1.3
- Strong cipher suites (managed by Certbot)
- HTTPS redirect from HTTP
- SSL session caching
- OCSP stapling

## 📊 Monitoring

### Check Certificate Status
```bash
certbot certificates
```

### Check SSL Grade
Test your SSL configuration at:
https://www.ssllabs.com/ssltest/analyze.html?d=pramaan.0-4.nl

### View Nginx SSL Config
```bash
cat /etc/nginx/sites-available/pramaan
```

## 🛠️ Troubleshooting

### If Certificate Renewal Fails
1. Check firewall allows port 80 (for HTTP-01 challenge)
2. Ensure DNS points to correct IP
3. Check logs: `cat /var/log/letsencrypt/letsencrypt.log`

### Manual Renewal
```bash
certbot renew --nginx -d pramaan.0-4.nl
```

### Revoke Certificate (if needed)
```bash
certbot revoke --cert-path /etc/letsencrypt/live/pramaan.0-4.nl/fullchain.pem
```

---
*Certificate installed on: 2025-10-05*
*Valid until: 2026-01-03*
