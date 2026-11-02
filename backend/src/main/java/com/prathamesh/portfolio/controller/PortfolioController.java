package com.prathamesh.portfolio.controller;

import com.prathamesh.portfolio.dto.OptimizeRequest;
import com.prathamesh.portfolio.dto.OptimizeResponse;
import com.prathamesh.portfolio.dto.PortfolioResult;
import com.prathamesh.portfolio.dto.RebalanceRequest;
import com.prathamesh.portfolio.dto.RebalanceResponse;
import com.prathamesh.portfolio.dto.TargetOptimizeRequest;
import com.prathamesh.portfolio.service.QuantServiceClient;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class PortfolioController {

    private final QuantServiceClient quant;

    public PortfolioController(QuantServiceClient quant) {
        this.quant = quant;
    }

    @PostMapping("/optimize")
    public OptimizeResponse optimize(@RequestBody OptimizeRequest req) {
        return quant.optimize(req);
    }

    @PostMapping("/optimize/target")
    public PortfolioResult optimizeTarget(@RequestBody TargetOptimizeRequest req) {
        return quant.optimizeTarget(req);
    }

    @PostMapping("/rebalance")
    public RebalanceResponse rebalance(@RequestBody RebalanceRequest req) {
        return quant.rebalance(req);
    }

    @PostMapping("/optimize/cvar")
    public Map<String, Object> optimizeCvar(@RequestBody Map<String, Object> req) {
        return quant.optimizeCvar(req);
    }

    /** Dollar split: {tickers, weights, amount} -> dollars + whole/fractional shares. */
    @PostMapping("/allocate")
    public Map<String, Object> allocate(@RequestBody Map<String, Object> req) {
        return quant.allocate(req);
    }

    /** Manual refresh: fetch fresh market data into MySQL. */
    @PostMapping("/ingest")
    public Map<String, Object> ingest(@RequestBody Map<String, Object> req) {
        return quant.ingest(req);
    }

    /** The curated MySQL verse with per-ticker coverage. Optional ?q= server-side search. */
    @GetMapping("/universe")
    public Map<String, Object> universe(@RequestParam(required = false) String q) {
        return quant.universe(q);
    }

    /** Pre-check a custom ticker against Yahoo Finance. */
    @GetMapping("/universe/validate")
    public Map<String, Object> validateTicker(@RequestParam String ticker) {
        return quant.validateTicker(ticker);
    }

    /** Register a custom ticker in the MySQL universe (no price fetch). */
    @PostMapping("/universe")
    public Map<String, Object> universeAdd(@RequestBody Map<String, Object> req) {
        return quant.universeAdd(req);
    }

    @GetMapping("/ingest/last")
    public Map<String, Object> ingestLast() {
        return quant.ingestLast();
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "quant", quant.quantUp() ? "up" : "down");
    }
}
