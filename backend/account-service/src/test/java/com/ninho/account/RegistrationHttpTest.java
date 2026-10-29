package com.ninho.account;

import java.io.IOException;
import java.net.*;
import java.net.http.*;
import java.nio.file.*;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.UUID;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(classes = {AccountApplication.class, RegistrationHttpTest.Config.class},
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RegistrationHttpTest {
    private static final String BROWSER_LANGUAGES = "pt-BR,pt;q=0.95,en-US;q=0.9,en;q=0.85,es-ES;q=0.8,es;q=0.75,fr-FR;q=0.7,fr;q=0.65,de-DE;q=0.6,de;q=0.55,it-IT;q=0.5,it;q=0.45,ja-JP;q=0.4,ja;q=0.35";
    private static final Path KEYS = testKeys();
    @Value("${local.server.port}") private int port;

    private static Path testKeys() {
        try {
            var dir = Files.createTempDirectory("ninho-registration-http-");
            var generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            var pair = generator.generateKeyPair();
            var encoder = Base64.getMimeEncoder(64, new byte[]{'\n'});
            Files.writeString(dir.resolve("private.pem"), "-----BEGIN PRIVATE KEY-----\n" + encoder.encodeToString(pair.getPrivate().getEncoded()) + "\n-----END PRIVATE KEY-----\n");
            Files.writeString(dir.resolve("public.pem"), "-----BEGIN PUBLIC KEY-----\n" + encoder.encodeToString(pair.getPublic().getEncoded()) + "\n-----END PUBLIC KEY-----\n");
            dir.resolve("private.pem").toFile().deleteOnExit();
            dir.resolve("public.pem").toFile().deleteOnExit();
            dir.toFile().deleteOnExit();
            return dir;
        } catch (Exception e) { throw new ExceptionInInitializerError(e); }
    }

    @DynamicPropertySource
    static void configuration(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> "jdbc:h2:mem:registration;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
        r.add("spring.datasource.username", () -> "sa");
        r.add("spring.datasource.password", () -> "");
        r.add("ninho.public-key", () -> KEYS.resolve("public.pem").toString());
        r.add("ninho.private-key", () -> KEYS.resolve("private.pem").toString());
        r.add("ninho.allowed-origin", () -> "auto");
        r.add("ninho.secure-cookie", () -> "false");
    }

    private String origin() { return "http://localhost:" + port; }
    private HttpResponse<String> send(HttpClient client, String path, String body, boolean staleCookie) throws Exception {
        var b = HttpRequest.newBuilder(URI.create(origin() + path)).header("Origin", origin()).header("Accept-Language", BROWSER_LANGUAGES);
        if (staleCookie) b.header("Cookie", "ninho_session=old-invalid-token").header("Authorization", "Bearer old-invalid-token");
        if (body != null) b.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body));
        return client.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }
    private String signup(String email, int color, String accessory, String environment) {
        return """
          {"name":"Clara","age":26,"email":"%s","password":"Synthetic-Test-2026!","petName":"Pingo","petColor":%d,"accessory":"%s","environment":"%s"}
          """.formatted(email, color, accessory, environment);
    }

    @ParameterizedTest
    @CsvSource({"0,leaf,garden", "1,bow,dusk", "2,star,night"})
    void anonymousSignupCreatesAccountAppearanceAndUsableSession(int color, String accessory, String environment) throws Exception {
        var cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        var client = HttpClient.newBuilder().cookieHandler(cookies).build();
        String email = UUID.randomUUID() + "@example.test";
        var result = send(client, "/api/auth/register", signup(email, color, accessory, environment), false);
        assertEquals(200, result.statusCode(), result.body());
        assertTrue(result.headers().allValues("Set-Cookie").stream().anyMatch(h -> h.contains("ninho_session=") && h.contains("HttpOnly")));
        var me = send(client, "/api/me", null, false);
        assertEquals(200, me.statusCode(), me.body());
        assertTrue(me.body().contains(email), me.body());
        assertTrue(me.body().contains("\"petColor\":" + color), me.body());
        assertTrue(me.body().contains("\"environment\":\"" + environment + "\""), me.body());
        assertTrue(me.body().contains("\"accessory\":\"" + accessory + "\""), me.body());
        assertEquals(200, send(client, "/api/presence", "{\"kind\":\"welcome\"}", false).statusCode());
    }

    @Test void staleCookiesDoNotRequireLoginToCreateANewAccount() throws Exception {
        var result = send(HttpClient.newHttpClient(), "/api/auth/register", signup(UUID.randomUUID() + "@example.test", 2, "star", "night"), true);
        assertEquals(200, result.statusCode(), result.body());
    }

    @Test void readinessAcceptsBrowsersWithManyLanguagePreferences() throws Exception {
        var result = send(HttpClient.newHttpClient(), "/api/auth/status", null, false);
        assertEquals(200, result.statusCode(), result.body());
        assertTrue(result.body().contains("\"available\":true"), result.body());
    }

    @Test void servletErrorOnPublicRouteIsNotReplacedByLoginRequirement() throws Exception {
        var result = send(HttpClient.newHttpClient(), "/api/auth/_test-error", null, true);
        assertEquals(503, result.statusCode(), result.body());
        assertTrue(result.body().contains("SERVICE_UNAVAILABLE"), result.body());
        assertFalse(result.body().contains("AUTH_REQUIRED"), result.body());
    }

    @Test void protectedResourcesStillRequireAuthentication() throws Exception {
        var result = send(HttpClient.newHttpClient(), "/api/memories", null, false);
        assertEquals(401, result.statusCode());
        assertTrue(result.body().contains("AUTH_REQUIRED"));
    }

    @Test void errorPathIsNotPublicAsANormalRequest() throws Exception {
        assertEquals(401, send(HttpClient.newHttpClient(), "/error", null, false).statusCode());
    }

    @Test void existingEmailHasItsOwnErrorAndCanSignIn() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        var client = HttpClient.newHttpClient();
        String input = signup(email, 0, "leaf", "garden");
        assertEquals(200, send(client, "/api/auth/register", input, false).statusCode());
        var duplicate = send(client, "/api/auth/register", input, false);
        assertEquals(409, duplicate.statusCode(), duplicate.body());
        assertTrue(duplicate.body().contains("EMAIL_IN_USE"), duplicate.body());
        assertEquals(200, send(client, "/api/auth/login", "{\"email\":\"" + email + "\",\"password\":\"Synthetic-Test-2026!\"}", true).statusCode());
    }

    @Test void invalidSignupIsAValidationErrorNotALoginRequirement() throws Exception {
        var result = send(HttpClient.newHttpClient(), "/api/auth/register", "{}", true);
        assertEquals(400, result.statusCode(), result.body());
        assertFalse(result.body().contains("AUTH_REQUIRED"), result.body());
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class Config {
        @Bean ErrorProbe errorProbe() { return new ErrorProbe(); }
    }
    @RestController
    static class ErrorProbe {
        @GetMapping("/api/auth/_test-error")
        void fail(HttpServletResponse response) throws IOException { response.sendError(503); }
    }
}
