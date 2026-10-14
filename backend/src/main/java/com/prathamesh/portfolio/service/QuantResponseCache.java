package com.prathamesh.portfolio.service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Tiny in-memory TTL cache for quant-service responses.
 * When the quant is unreachable (or answers 5xx), the last known good
 * response is served instead of failing. Entries live 24h; a backend
 * restart clears the cache — TiDB remains the durable store.
 */
@Component
public class QuantResponseCache {

    private record Entry(Object value, Instant storedAt) {}

    private final ConcurrentHashMap<String, Entry> cache = new ConcurrentHashMap<>();
    private final Duration ttl;

    public QuantResponseCache() {
        this(Duration.ofHours(24));
    }

    QuantResponseCache(Duration ttl) {
        this.ttl = ttl;
    }

    @SuppressWarnings("unchecked")
    public <T> T get(String key, Class<T> type) {
        Entry e = cache.get(key);
        if (e == null || Instant.now().isAfter(e.storedAt().plus(ttl))) {
            cache.remove(key);
            return null;
        }
        return (T) e.value();
    }

    public void put(String key, Object value) {
        cache.put(key, new Entry(value, Instant.now()));
    }
}
