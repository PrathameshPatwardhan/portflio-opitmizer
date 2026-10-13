package com.prathamesh.portfolio.dto;

import java.util.List;

public record Cloud(List<Double> vol, List<Double> ret, List<Double> sharpe) {}
