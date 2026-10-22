package com.prathamesh.portfolio.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** CORS for /api/*. The CorsConfigurationSource bean is what Spring Security's
 *  filter chain actually consults — the WebMvcConfigurer mapping alone is NOT
 *  enough once spring-boot-starter-security is on the classpath. */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${frontend.origin:http://localhost:5173}")
    private String frontendOrigin;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(frontendOrigin, "http://localhost:3000")
                .allowedMethods("GET", "POST", "OPTIONS", "DELETE");
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                frontendOrigin,
                "http://localhost:3000",
                "https://portflio-opitmizer-e1n4.vercel.app",
                "https://portfolio-opitmizer-v1.vercel.app"));
        config.setAllowedMethods(List.of("GET", "POST", "OPTIONS", "DELETE"));
        config.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
