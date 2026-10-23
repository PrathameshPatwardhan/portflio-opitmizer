package com.prathamesh.portfolio.auth;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Direct TiDB access for the holdings table (login-gated). */
@Repository
public class HoldingRepository {

    private final JdbcTemplate jdbc;

    public HoldingRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> listByUser(long userId) {
        return jdbc.queryForList(
                "SELECT id, ticker, shares, avg_price FROM holdings WHERE user_id = ? ORDER BY ticker",
                userId);
    }

    /** Insert or update one holding (one row per user+ticker). Returns the row id. */
    public long upsert(long userId, String ticker, double shares, double avgPrice) {
        jdbc.update(
                "INSERT INTO holdings (user_id, ticker, shares, avg_price) VALUES (?, ?, ?, ?) "
                        + "ON DUPLICATE KEY UPDATE shares = VALUES(shares), avg_price = VALUES(avg_price)",
                userId, ticker, shares, avgPrice);
        Long id = jdbc.queryForObject(
                "SELECT id FROM holdings WHERE user_id = ? AND ticker = ?",
                Long.class, userId, ticker);
        return id != null ? id : -1;
    }

    public boolean delete(long userId, long id) {
        return jdbc.update("DELETE FROM holdings WHERE id = ? AND user_id = ?", id, userId) > 0;
    }
}
