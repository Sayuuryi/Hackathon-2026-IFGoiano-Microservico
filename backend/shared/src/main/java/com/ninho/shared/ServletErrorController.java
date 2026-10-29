package com.ninho.shared;

import java.net.URI;
import java.util.Objects;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Preserves container errors without disclosing exception messages or stack traces. */
@RestController
public class ServletErrorController implements ErrorController {
    @RequestMapping("/error")
    ResponseEntity<ProblemDetail> error(HttpServletRequest request) {
        Object value = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        int status = value instanceof Number n ? n.intValue() : 500;
        if (status < 400 || status > 599) status = 500;
        String code = status == 503 ? "SERVICE_UNAVAILABLE" : status >= 500 ? "INTERNAL_ERROR" : "REQUEST_REJECTED";
        String detail = status >= 500
            ? "Não conseguimos concluir esta ação agora. Suas escolhas continuam aqui; tente novamente em instantes."
            : "Não conseguimos ler esta solicitação. Confira os dados e tente novamente.";
        var problem = ProblemDetail.forStatusAndDetail(org.springframework.http.HttpStatusCode.valueOf(status), detail);
        problem.setTitle(status >= 500 ? "Uma pausa por aqui" : "Não foi possível concluir");
        problem.setType(URI.create("urn:ninho:error:" + code.toLowerCase(java.util.Locale.ROOT)));
        problem.setProperty("code", code);
        problem.setProperty("requestId", Objects.toString(request.getAttribute("requestId"), ""));
        return ResponseEntity.status(status).body(problem);
    }
}
