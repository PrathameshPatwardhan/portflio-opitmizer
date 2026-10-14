package com.prathamesh.portfolio.controller;

import com.prathamesh.portfolio.dto.OptimizeRequest;
import com.prathamesh.portfolio.dto.OptimizeResponse;
import com.prathamesh.portfolio.dto.PortfolioResult;
import com.prathamesh.portfolio.dto.RebalanceRequest;
import com.prathamesh.portfolio.dto.RebalanceResponse;
import com.prathamesh.portfolio.dto.TargetOptimizeRequest;
import com.prathamesh.portfolio.service.QuantServiceClient;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    /** Manual refresh: fetch fresh market data into MySQL. */
    @PostMapping("/ingest")
    public Map<String, Object> ingest(@RequestBody Map<String, Object> req) {
        return quant.ingest(req);
    }

    /** The curated MySQL universe with per-ticker coverage. */
    @GetMapping("/universe")
    public Map<String, Object> universe() {
        return quant.universe();
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
