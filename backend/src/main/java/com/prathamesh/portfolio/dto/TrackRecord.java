package com.prathamesh.portfolio.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/** CAGR / Sharpe / max-drawdown summary plus the equity curve for charting.
 *  "final" is a Java keyword, so the component is named finalValue and mapped. */
public record TrackRecord(
        List<Double> values,
        @JsonProperty("final") double finalValue,
        double cagr,
        double sharpe,
        double maxDrawdown) {}
