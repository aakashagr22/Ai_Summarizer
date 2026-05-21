# Multi-stage build for Spring Boot application
FROM maven:3.9.6-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy project files
COPY pom.xml .
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copy built JAR from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Expose port
EXPOSE 8085

# Set environment variables
ENV OPENAI_API_KEY=${OPENAI_API_KEY}
ENV SPRING_PROFILES_ACTIVE=prod
ENV SERVER_PORT=8085

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8085/actuator/health || exit 1

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
