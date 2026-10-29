package com.ninho.shared;
import java.net.URI;import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
@RestControllerAdvice
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
public class ApiExceptionHandler {
 private ProblemDetail problem(int status,String code,String message,HttpServletRequest request){var p=ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(status),message);p.setTitle(status>=500?"Uma pausa por aqui":"Não foi possível concluir");p.setType(URI.create("urn:ninho:error:"+code.toLowerCase(Locale.ROOT)));p.setProperty("code",code);p.setProperty("requestId",request.getAttribute("requestId"));return p;}
 @ExceptionHandler(DomainException.class) ProblemDetail domain(DomainException e,HttpServletRequest r){return problem(e.status,e.code,e.getMessage(),r);}
 @ExceptionHandler(MethodArgumentNotValidException.class) ProblemDetail validation(MethodArgumentNotValidException e,HttpServletRequest r){var p=problem(400,"VALIDATION_ERROR","Confira os campos e tente novamente.",r);p.setProperty("fields",e.getBindingResult().getFieldErrors().stream().map(f->Map.of("field",f.getField(),"message",Objects.toString(f.getDefaultMessage(),"Valor inválido"))).toList());return p;}
 @ExceptionHandler({HttpMessageNotReadableException.class,IllegalArgumentException.class,ConstraintViolationException.class,HandlerMethodValidationException.class}) ProblemDetail malformed(Exception e,HttpServletRequest r){return problem(400,"INVALID_REQUEST","Não consegui ler essa ação. Confira os dados e tente novamente.",r);}
 @ExceptionHandler(DataAccessException.class) ProblemDetail database(DataAccessException e,HttpServletRequest r){return problem(503,"DEPENDENCY_UNAVAILABLE","Esse cantinho está descansando. O restante do Ninho continua disponível.",r);}
 @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class) ProblemDetail absent(Exception e,HttpServletRequest r){return problem(404,"NOT_FOUND","Esse caminho não está disponível.",r);}
 @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class) ProblemDetail method(Exception e,HttpServletRequest r){return problem(405,"METHOD_NOT_ALLOWED","Essa ação não está disponível neste caminho.",r);}
 @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class) ProblemDetail media(Exception e,HttpServletRequest r){return problem(415,"UNSUPPORTED_MEDIA_TYPE","Envie essa ação no formato esperado.",r);}
 @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class) ProblemDetail parameter(Exception e,HttpServletRequest r){return problem(400,"INVALID_PARAMETER","Confira o identificador e tente novamente.",r);}
 @ExceptionHandler(Exception.class) ProblemDetail unexpected(Exception e,HttpServletRequest r){org.slf4j.LoggerFactory.getLogger(getClass()).error("Request {} failed with {}",r.getAttribute("requestId"),e.getClass().getSimpleName());return problem(500,"INTERNAL_ERROR","Essa ação teve uma pausa. Você pode tentar novamente.",r);}
}
