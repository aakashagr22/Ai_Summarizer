package com.example.springaisummarizer;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.document.Document;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@CrossOrigin(origins = "*")
public class SummaryController {

  @Value("classpath:/summarize.st")
  private Resource summarizeTemplate;

  private final ChatClient chatClient;

  public SummaryController(ChatClient.Builder chatClientBuilder) {
    this.chatClient = chatClientBuilder.build();
  }

  @PostMapping(path="/summarize", produces = "text/plain")
  public ResponseEntity<String> summarize(
      @RequestParam("file") MultipartFile file,
      @RequestHeader(value = "X-OpenAI-Api-Key", required = false) String customApiKey) {
    
    try {
      if (file == null || file.isEmpty()) {
        return ResponseEntity.badRequest().body("Uploaded file is empty or not provided.");
      }

      Resource resource = file.getResource();
      List<Document> documents;
      try {
        documents = new TikaDocumentReader(resource).get();
      } catch (Exception e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body("Failed to extract content from the document. Please verify the file is not corrupted: " + e.getMessage());
      }

      if (documents == null || documents.isEmpty()) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body("No text content could be extracted from this document.");
      }

      String documentText = documents.stream()
          .map(Document::getFormattedContent)
          .collect(Collectors.joining("\n\n"));

      ChatClient activeChatClient = this.chatClient;

      if (customApiKey != null && !customApiKey.trim().isEmpty()) {
        OpenAiApi openAiApi = OpenAiApi.builder()
            .apiKey(customApiKey)
            .build();
        OpenAiChatModel chatModel = OpenAiChatModel.builder()
            .openAiApi(openAiApi)
            .defaultOptions(OpenAiChatOptions.builder()
                .model("gpt-4o-mini")
                .build())
            .build();
        activeChatClient = ChatClient.builder(chatModel).build();
      }

      String summary = activeChatClient.prompt()
          .user("Summarize the text")
          .system(systemSpec -> systemSpec
              .text(summarizeTemplate)
              .param("document", documentText))
          .call()
          .content();

      return ResponseEntity.ok(summary);

    } catch (Exception e) {
      // Traverse exception hierarchy to find the root cause
      Throwable rootCause = e;
      while (rootCause.getCause() != null && rootCause.getCause() != rootCause) {
        rootCause = rootCause.getCause();
      }
      
      String message = rootCause.getMessage();
      if (message == null) {
        message = rootCause.toString();
      }

      // Check for common OpenAI errors
      if (message.contains("dummy-key-to-allow-startup") || 
          message.toLowerCase().contains("invalid api key") || 
          message.toLowerCase().contains("incorrect api key") ||
          message.contains("401")) {
        
        if (customApiKey == null || customApiKey.trim().isEmpty()) {
          return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body("No OpenAI API Key has been configured yet. Please click the 'API Key' button in the top-right corner to add a valid OpenAI API key.");
        } else {
          return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body("The provided OpenAI API Key is invalid or expired. Please click the 'API Key' button in the top-right to update it.");
        }
      }

      if (message.contains("429") || message.toLowerCase().contains("quota") || message.toLowerCase().contains("insufficient_quota")) {
        return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
            .body("OpenAI API Quota Exceeded. You have run out of API credits or exceeded your rate limits. Please check your OpenAI account billing.");
      }

      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body("Summarization Error: " + message);
    }
  }

}

