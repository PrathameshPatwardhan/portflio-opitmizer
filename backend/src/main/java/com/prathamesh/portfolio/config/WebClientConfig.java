package com.prathamesh.portfolio.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

/** WebClient pointed at the quant-service. URL comes from
 *  {@code quant.service.url} (env QUANT_SERVICE_URL in Docker). */
@Configuration
public class WebClientConfig {

    @Bean
    public WebClient quantWebClient(
            @Value("${quant.service.url:http://localhost:8000}") String baseUrl) {
        return WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
