package com.prathamesh.portfolio.dto;

import java.util.List;

/** Body for POST /api/optimize — forwarded as-is to the quant-service. */
public record OptimizeRequest(
        List<String> tickers,
        String period,
        double riskFreeRate,
        boolean longOnly,
        double maxWeight,
        int frontierPoints,
        int cloudSize) {}
