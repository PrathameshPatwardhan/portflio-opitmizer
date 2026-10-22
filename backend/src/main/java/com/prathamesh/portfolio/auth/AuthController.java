package com.prathamesh.portfolio.auth;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Public endpoints: signup and login. /me requires the JWT (see SecurityConfig). */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthRepository users;
    private final BCryptPasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(AuthRepository users, BCryptPasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    @PostMapping("/signup")
    public Map<String, Object> signup(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        String password = body.getOrDefault("password", "");
        if (!email.contains("@") || email.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "enter a valid email");
        }
        if (password.length() < 8) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "password must be at least 8 characters");
        }
        if (users.findByEmail(email) != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "email already registered");
        }
        long id = users.createUser(email, encoder.encode(password));
        return Map.of("token", jwt.issue(email, id), "email", email);
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        String password = body.getOrDefault("password", "");
        Map<String, Object> row = users.findByEmail(email);
        if (row == null || !encoder.matches(password, (String) row.get("password_hash"))) {
            // Same message for both cases: don't reveal which emails are registered.
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid email or password");
        }
        long id = ((Number) row.get("id")).longValue();
        return Map.of("token", jwt.issue(email, id), "email", email);
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        AuthPrincipal p = (AuthPrincipal) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return Map.of("email", p.email(), "userId", p.userId());
    }
}
