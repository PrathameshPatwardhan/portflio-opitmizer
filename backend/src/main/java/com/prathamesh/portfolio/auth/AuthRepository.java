package com.prathamesh.portfolio.auth;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Direct TiDB access for the users table. */
@Repository
public class AuthRepository {

    private final JdbcTemplate jdbc;

    public AuthRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> findByEmail(String email) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, email, password_hash FROM users WHERE email = ?", email);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public long createUser(String email, String passwordHash) {
        jdbc.update("INSERT INTO users (email, password_hash) VALUES (?, ?)", email, passwordHash);
        Long id = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        return id != null ? id : -1;
    }
}
