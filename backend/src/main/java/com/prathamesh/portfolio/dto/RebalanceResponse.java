package com.prathamesh.portfolio.dto;

import java.util.List;

public record RebalanceResponse(
        String dataSource,
        List<String> dates,
        TrackRecord buyHold,
        TrackRecord rebalanced,
        double turnover,
        int rebalances) {}
