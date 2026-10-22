package com.prathamesh.portfolio.auth;

/** The authenticated user, carried as the SecurityContext principal. */
public record AuthPrincipal(long userId, String email) {}
