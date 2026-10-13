package com.prathamesh.portfolio.dto;

import java.util.List;

public record OptimizeResponse(
        List<AssetPoint> assets,
        List<FrontierPoint> frontier,
        Cloud cloud,
        PortfolioResult maxSharpe,
        PortfolioResult minVol) {}
