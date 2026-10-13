package com.prathamesh.portfolio.dto;

import java.util.Map;

public record PortfolioResult(
        Map<String, Double> weights,
        double ret,
        double vol,
        double sharpe) {}
