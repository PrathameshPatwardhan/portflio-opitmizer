package com.prathamesh.portfolio.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.prathamesh.portfolio.dto.OptimizeRequest;
import com.prathamesh.portfolio.dto.OptimizeResponse;
import com.prathamesh.portfolio.dto.PortfolioResult;
import com.prathamesh.portfolio.dto.RebalanceRequest;
import com.prathamesh.portfolio.dto.RebalanceResponse;
import com.prathamesh.portfolio.dto.TargetOptimizeRequest;
import java.time.Duration;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;

/** Thin forwarder: every call goes to the quant-service, which owns the math.
 *  Quant-side 4xx/5xx responses are re-thrown with the same status and body
 *  so the frontend sees the real error (e.g. 422 infeasible constraints). */
@Service
@SuppressWarnings("unchecked")
public class QuantServiceClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(120);

    private final WebClient webClient;

    public QuantServiceClient(WebClient quantWebClient) {
        this.webClient = quantWebClient;
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

    /** The curated MySQL universe with per-ticker coverage. */
    public Map<String, Object> universe() {
        return get("/universe", Map.class);
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
        try {
            return webClient.post().uri(path).bodyValue(body)
                    .retrieve()
                    .bodyToMono(type)
                    .block(TIMEOUT);
        } catch (WebClientResponseException e) {
            throw new ResponseStatusException(
                    e.getStatusCode(), e.getResponseBodyAsString(), e);
        }
    }

    private <T> T get(String path, Class<T> type) {
        try {
            return webClient.get().uri(path).retrieve()
                    .bodyToMono(type)
                    .block(TIMEOUT);
        } catch (WebClientResponseException e) {
            throw new ResponseStatusException(
                    e.getStatusCode(), e.getResponseBodyAsString(), e);
        }
    }
}
