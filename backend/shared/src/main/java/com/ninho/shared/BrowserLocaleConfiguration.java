package com.ninho.shared;

import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** A real browser can send more than Tomcat's default ten language preferences. */
@Configuration(proxyBeanMethods = false)
public class BrowserLocaleConfiguration {
    @Bean
    WebServerFactoryCustomizer<TomcatServletWebServerFactory> browserLocaleLimit() {
        return factory -> factory.addConnectorCustomizers(connector -> connector.setMaxLocaleCount(128));
    }
}
