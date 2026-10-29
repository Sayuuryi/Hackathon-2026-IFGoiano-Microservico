# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY backend/ .
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp verify
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -g 1000 ninho && adduser -D -u 1000 -G ninho ninho
WORKDIR /app
ARG SERVICE
COPY --from=build /build/${SERVICE}/target/${SERVICE}.jar /app/service.jar
USER 1000:1000
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=4s --start-period=60s --retries=4 CMD wget -q -O /dev/null http://127.0.0.1:8080/actuator/health || exit 1
ENTRYPOINT ["java","-jar","/app/service.jar"]
