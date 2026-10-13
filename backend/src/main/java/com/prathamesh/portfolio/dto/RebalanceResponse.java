package com.prathamesh.portfolio.dto;

import java.util.List;

public record RebalanceResponse(
        List<String> dates,
        TrackRecord buyHold,
        TrackRecord rebalanced,
        double turnover,
        int rebalances) {}
