package com.prathamesh.portfolio.dto;

import java.util.List;

/** Body for POST /api/rebalance. frequency is "Q" (quarterly) or "M" (monthly). */
public record RebalanceRequest(
        List<String> tickers,
        String period,
        double riskFreeRate,
        boolean longOnly,
        double maxWeight,
        String frequency,
        String source) {
    public RebalanceRequest {
        if (source == null) {
            source = "live";
        }
    }
}
