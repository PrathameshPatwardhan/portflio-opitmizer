package com.prathamesh.portfolio.dto;

import java.util.List;

/** Body for POST /api/optimize/target — same as optimize plus the return target. */
public record TargetOptimizeRequest(
        List<String> tickers,
        String period,
        double riskFreeRate,
        boolean longOnly,
        double maxWeight,
        int frontierPoints,
        int cloudSize,
        double targetReturn,
        String source) {
    public TargetOptimizeRequest {
        if (source == null) {
            source = "live";
        }
    }
}
