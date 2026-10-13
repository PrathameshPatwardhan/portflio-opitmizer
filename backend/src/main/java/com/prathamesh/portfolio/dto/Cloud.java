package com.prathamesh.portfolio.dto;

import java.util.List;

/** Random-portfolio scatter behind the frontier. */
public record Cloud(List<Double> vol, List<Double> ret, List<Double> sharpe) {}
