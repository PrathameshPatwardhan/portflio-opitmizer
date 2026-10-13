package com.prathamesh.portfolio.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Allows the Vite dev server (and the Dockerized frontend) to call /api/*. */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${frontend.origin:http://localhost:5173}")
    private String frontendOrigin;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(frontendOrigin, "http://localhost:3000")
                .allowedMethods("GET", "POST", "OPTIONS");
    }
}
