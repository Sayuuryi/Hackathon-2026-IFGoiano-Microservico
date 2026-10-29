package com.ninho.shared;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.junit.jupiter.api.Assertions.*;
class OriginPolicyTest {
 @Test void autoUsesActualHostAndPortWithoutAcceptingAnotherOrigin(){var r=new MockHttpServletRequest();r.setScheme("http");r.setServerName("localhost");r.setServerPort(8090);r.addHeader("Origin","http://localhost:8090");assertTrue(OriginPolicy.accepts(r,"auto"));assertFalse(OriginPolicy.accepts(r,"http://localhost:8080"));r.removeHeader("Origin");r.addHeader("Origin","http://localhost.evil:8090");assertFalse(OriginPolicy.accepts(r,"auto"));}
 @Test void normalizationDoesNotOpenWildcardOrigins(){assertTrue(OriginPolicy.same("http://localhost:80","http://localhost"));assertTrue(OriginPolicy.same("https://EXAMPLE.com","https://example.com:443"));for(var invalid:new String[]{"null","http://localhost:8081","https://localhost:8080","http://localhost:8080/path","http://localhost:8080?x=1","http://user@localhost:8080"})assertFalse(OriginPolicy.same(invalid,"http://localhost:8080"));assertFalse(OriginPolicy.same(null,"http://localhost:8080"));}
}
