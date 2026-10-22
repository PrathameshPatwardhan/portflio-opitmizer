package com.prathamesh.portfolio.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Signs and verifies JWTs. Secret comes from the JWT_SECRET env var
 *  (Render env var on the backend service). Fails fast if it is missing —
 *  if the backend refuses to boot, this is the first thing to check. */
@Service
public class JwtService {

    private static final long EXPIRY_MS = 24L * 60 * 60 * 1000; // ~24h

    private final SecretKey key;

    public JwtService(@Value("${JWT_SECRET:}") String secret) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET env var is missing or too short (>= 32 chars required)");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String issue(String email, long userId) {
        Date now = new Date();
        return Jwts.builder()
                .subject(email)
                .claim("uid", userId)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + EXPIRY_MS))
                .signWith(key)
                .compact();
    }

    public String emailOf(String token) {
        return Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload().getSubject();
    }

    public Long uidOf(String token) {
        Number uid = Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload().get("uid", Number.class);
        return uid.longValue();
    }
}
