package com.prathamesh.portfolio.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Direct TiDB access for saved portfolios. Every row is scoped to its owner. */
@Repository
public class PortfolioRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public PortfolioRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /** Newest first. The JSON payload column is parsed back into a Map. */
    public List<Map<String, Object>> listByUser(long userId) throws Exception {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, name, payload, created_at FROM saved_portfolios " +
                        "WHERE user_id = ? ORDER BY created_at DESC", userId);
        for (Map<String, Object> row : rows) {
            Object payload = row.get("payload");
            row.put("payload", payload == null
                    ? Map.of()
                    : mapper.readValue(payload.toString(), Map.class));
        }
        return rows;
    }

    public long save(long userId, String name, Object payload) throws Exception {
        jdbc.update("INSERT INTO saved_portfolios (user_id, name, payload) VALUES (?, ?, ?)",
                userId, name, mapper.writeValueAsString(payload));
        Long id = jdbc.queryForObject(
                "SELECT id FROM saved_portfolios WHERE user_id = ? AND name = ? " +
                        "ORDER BY id DESC LIMIT 1", Long.class, userId, name);
        return id != null ? id : -1;
    }

    /** Returns false when the row doesn't exist or belongs to someone else. */
    public boolean delete(long userId, long id) {
        return jdbc.update("DELETE FROM saved_portfolios WHERE id = ? AND user_id = ?",
                id, userId) > 0;
    }
}
