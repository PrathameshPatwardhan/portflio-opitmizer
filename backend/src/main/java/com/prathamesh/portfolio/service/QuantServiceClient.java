package com.prathamesh.portfolio.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.prathamesh.portfolio.dto.OptimizeRequest;
import com.prathamesh.portfolio.dto.OptimizeResponse;
import com.prathamesh.portfolio.dto.PortfolioResult;
import com.prathamesh.portfolio.dto.RebalanceRequest;
import com.prathamesh.portfolio.dto.RebalanceResponse;
import com.prathamesh.portfolio.dto.TargetOptimizeRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Thin forwarder: every call goes to the quant-service, which owns the math.
 *  Quant-side 4xx/5xx responses are re-thrown with the same status and body
 *  so the frontend sees the real error (e.g. 422 infeasible constraints). */
@Service
@SuppressWarnings("unchecked")
public class QuantServiceClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(120);

    private final WebClient webClient;
    private final QuantResponseCache cache;

    public QuantServiceClient(WebClient quantWebClient, QuantResponseCache cache) {
        this.webClient = quantWebClient;
        this.cache = cache;
    }

    public OptimizeResponse optimize(OptimizeRequest req) {
        return post("/optimize", req, OptimizeResponse.class);
    }

    public PortfolioResult optimizeTarget(TargetOptimizeRequest req) {
        return post("/optimize/target", req, PortfolioResult.class);
    }

    public RebalanceResponse rebalance(RebalanceRequest req) {
        return post("/rebalance", req, RebalanceResponse.class);
    }

    /** Minimum-tail-risk (CVaR) portfolio. Body mirrors /optimize plus "alpha". */
    public Map<String, Object> optimizeCvar(Map<String, Object> req) {
        return post("/optimize/cvar", req, Map.class);
    }


    /** Manual refresh: fetch fresh bars into MySQL. Body: {"tickers": [...], "period": "5y"}. */
    public Map<String, Object> ingest(Map<String, Object> req) {
        try {
            return webClient.post().uri("/ingest").bodyValue(req)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofMinutes(10));
        } catch (WebClientResponseException e) {
            throw new ResponseStatusException(
                    e.getStatusCode(), e.getResponseBodyAsString(), e);
        }
    }

    /** The curated MySQL universe with per-ticker coverage. q filters server-side. */
    public Map<String, Object> universe(String q) {
        String path = (q == null || q.isBlank()) ? "/universe"
                : "/universe?q=" + URLEncoder.encode(q, StandardCharsets.UTF_8);
        return get(path, Map.class);
    }

    /** Pre-check a custom ticker against Yahoo Finance (always 200 with a status field). */
    public Map<String, Object> validateTicker(String ticker) {
        return get("/universe/validate?ticker=" + URLEncoder.encode(ticker, StandardCharsets.UTF_8),
                Map.class);
    }

    /** Register a custom ticker in the MySQL universe (no price fetch). No cache: writes must not serve stale. */
    public Map<String, Object> universeAdd(Map<String, Object> req) {
        try {
            return webClient.post().uri("/universe").bodyValue(req)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(TIMEOUT);
        } catch (WebClientResponseException e) {
            throw new ResponseStatusException(
                    e.getStatusCode(), e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "quant service unavailable", e);
        }
    }

    /** The most recent ingest run, or {"lastIngest": null}. */
    public Map<String, Object> ingestLast() {
        return get("/ingest/last", Map.class);
    }

    /** Liveness probe used by GET /api/health. */
    public boolean quantUp() {
        try {
            webClient.get().uri("/health").retrieve()
                    .bodyToMono(JsonNode.class)
                    .block(Duration.ofSeconds(3));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private <T> T post(String path, Object body, Class<T> type) {
        String key = "POST " + path + " " + body.hashCode();
        try {
            T result = webClient.post().uri(path).bodyValue(body)
                    .retrieve()
                    .bodyToMono(type)
                    .block(TIMEOUT);
            cache.put(key, result);
            return result;
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().is4xxClientError()) {
                // Real answer for this request (e.g. 422 infeasible): don't mask it.
                throw new ResponseStatusException(
                        e.getStatusCode(), e.getResponseBodyAsString(), e);
            }
            // 5xx: the quant is sick -> fall through to the stale cache below.
        } catch (Exception e) {
            // Quant unreachable -> fall through to the stale cache below.
        }
        T stale = cache.get(key, type);
        if (stale != null) {
            return stale;
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "quant service unavailable and no cached response for " + path);
    }

    private <T> T get(String path, Class<T> type) {
        String key = "GET " + path;
        try {
            T result = webClient.get().uri(path).retrieve()
                    .bodyToMono(type)
                    .block(TIMEOUT);
            cache.put(key, result);
            return result;
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().is4xxClientError()) {
                throw new ResponseStatusException(
                        e.getStatusCode(), e.getResponseBodyAsString(), e);
            }
        } catch (Exception e) {
            // Quant unreachable -> fall through to the stale cache below.
        }
        T stale = cache.get(key, type);
        if (stale != null) {
            return stale;
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "quant service unavailable and no cached response for " + path);
    }

}
