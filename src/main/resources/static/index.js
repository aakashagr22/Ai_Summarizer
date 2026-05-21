/**
 * Premium Web Client Logic - Spring AI Summarizer
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const selectedView = document.querySelector('.dropzone-file-selected-view');
  const defaultView = document.querySelector('.dropzone-default-view');
  const selectedFileName = document.getElementById('selected-file-name');
  const selectedFileSize = document.getElementById('selected-file-size');
  
  const btnCancelFile = document.getElementById('btn-cancel-file');
  const btnSubmitSummarize = document.getElementById('btn-submit-summarize');
  
  const resultEmptyState = document.getElementById('result-empty-state');
  const resultLoadingState = document.getElementById('result-loading-state');
  const resultViewState = document.getElementById('result-view-state');
  
  const stepUpload = document.getElementById('step-upload');
  const stepParse = document.getElementById('step-parse');
  const stepAi = document.getElementById('step-ai');
  
  const execSummaryContent = document.getElementById('executive-summary-content');
  const detailedSectionsList = document.getElementById('detailed-sections-list');
  
  const btnCopySummary = document.getElementById('btn-copy-summary');
  const btnDownloadMd = document.getElementById('btn-download-md');
  
  // API Key Elements
  const btnApiKey = document.getElementById('btn-api-key');
  const apiModal = document.getElementById('api-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const inputApiKey = document.getElementById('input-api-key');
  const btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility');
  const btnClearKey = document.getElementById('btn-clear-key');
  const btnSaveKey = document.getElementById('btn-save-key');
  const keyStatusIndicator = document.getElementById('key-status-indicator');
  
  // Toast Elements
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toast-icon');
  const toastTitle = document.getElementById('toast-title');
  const toastMessage = document.getElementById('toast-message');
  const btnCloseToast = document.getElementById('btn-close-toast');

  let selectedFile = null;
  let activeSummaryMarkdown = "";

  // -------------------------------------------------------------
  // API Key Settings Management
  // -------------------------------------------------------------
  function loadApiKey() {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
      inputApiKey.value = savedKey;
      keyStatusIndicator.className = 'status-dot dot-green';
      keyStatusIndicator.title = 'Using browser-configured OpenAI API Key';
    } else {
      inputApiKey.value = '';
      keyStatusIndicator.className = 'status-dot dot-orange';
      keyStatusIndicator.title = 'Using server default environment key (if configured)';
    }
  }

  btnApiKey.addEventListener('click', () => {
    loadApiKey();
    apiModal.style.display = 'flex';
  });

  btnCloseModal.addEventListener('click', () => {
    apiModal.style.display = 'none';
  });

  btnToggleKeyVisibility.addEventListener('click', () => {
    if (inputApiKey.type === 'password') {
      inputApiKey.type = 'text';
    } else {
      inputApiKey.type = 'password';
    }
  });

  btnClearKey.addEventListener('click', () => {
    localStorage.removeItem('openai_api_key');
    inputApiKey.value = '';
    showToast('Success', 'OpenAI API Key cleared from local storage.', 'success');
    loadApiKey();
    apiModal.style.display = 'none';
  });

  btnSaveKey.addEventListener('click', () => {
    const key = inputApiKey.value.trim();
    if (key) {
      localStorage.setItem('openai_api_key', key);
      showToast('Settings Saved', 'OpenAI API Key updated successfully.', 'success');
    } else {
      localStorage.removeItem('openai_api_key');
      showToast('Settings Saved', 'Using backend-configured OpenAI API key.', 'success');
    }
    loadApiKey();
    apiModal.style.display = 'none';
  });

  // Close modal when clicking outside content
  window.addEventListener('click', (e) => {
    if (e.target === apiModal) {
      apiModal.style.display = 'none';
    }
  });

  // -------------------------------------------------------------
  // File Dropzone Handlers
  // -------------------------------------------------------------
  
  // Click dropzone to trigger input
  dropzone.addEventListener('click', (e) => {
    // Avoid triggering input if clicked buttons on selected file view
    if (e.target.closest('.file-action-buttons') || e.target.closest('#btn-cancel-file') || e.target.closest('#btn-submit-summarize')) {
      return;
    }
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  // Drag and drop events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  function handleFileSelected(file) {
    selectedFile = file;
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = formatBytes(file.size);
    
    // Switch views
    defaultView.style.display = 'none';
    selectedView.style.display = 'flex';
  }

  btnCancelFile.addEventListener('click', (e) => {
    e.stopPropagation();
    resetFileSelection();
  });

  function resetFileSelection() {
    selectedFile = null;
    fileInput.value = '';
    defaultView.style.display = 'flex';
    selectedView.style.display = 'none';
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // -------------------------------------------------------------
  // Summarize Operations
  // -------------------------------------------------------------
  btnSubmitSummarize.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!selectedFile) return;

    // Transition view to loading
    resultEmptyState.style.display = 'none';
    resultViewState.style.display = 'none';
    resultLoadingState.style.display = 'flex';

    // Stepper initial state
    updateStepper(1); // Upload active

    const formData = new FormData();
    formData.append('file', selectedFile);

    const customKey = localStorage.getItem('openai_api_key') || '';
    const headers = {};
    if (customKey) {
      headers['X-OpenAI-Api-Key'] = customKey;
    }

    try {
      // Simulate/trigger step changes for high visual polish
      setTimeout(() => updateStepper(2), 1200); // Transition to Parsing
      setTimeout(() => updateStepper(3), 3200); // Transition to AI Summarizing

      const response = await fetch('/summarize', {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedMessage = errorText;
        try {
          const parsedJson = JSON.parse(errorText);
          if (parsedJson && parsedJson.message) {
            parsedMessage = parsedJson.message;
          } else if (parsedJson && parsedJson.error) {
            parsedMessage = parsedJson.error;
          }
        } catch (e) {
          // not JSON, keep as raw text
        }
        throw new Error(parsedMessage || `Server responded with status ${response.status}`);
      }

      const summaryText = await response.text();
      activeSummaryMarkdown = summaryText;

      // Complete Stepper and show results
      updateStepper(4);
      setTimeout(() => {
        renderSummary(summaryText);
        resultLoadingState.style.display = 'none';
        resultViewState.style.display = 'flex';
      }, 500);

    } catch (error) {
      console.error("Summarization error: ", error);
      resultLoadingState.style.display = 'none';
      resultEmptyState.style.display = 'flex';
      
      let errorMsg = error.message;
      
      // Fallback checks just in case the backend throws raw exceptions that bypass our handler
      if (errorMsg.includes("api.openai.com") || errorMsg.includes("401") || errorMsg.includes("API key") || errorMsg.includes("dummy-key-to-allow-startup")) {
        if (!customKey) {
          errorMsg = "No OpenAI API Key has been configured yet. Please click the 'API Key' button in the top-right corner to add a valid OpenAI API key.";
        } else {
          errorMsg = "The provided OpenAI API Key is invalid or expired. Please click the 'API Key' button in the top-right to update it.";
        }
      } else if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("insufficient_quota")) {
        errorMsg = "OpenAI API Quota Exceeded. You have run out of API credits or exceeded your rate limits. Please check your OpenAI account billing.";
      }
      
      showToast('Summarization Failed', errorMsg, 'error');
    }
  });

  function updateStepper(stepNumber) {
    // Reset classes
    stepUpload.className = 'step';
    stepParse.className = 'step';
    stepAi.className = 'step';

    if (stepNumber === 1) {
      stepUpload.classList.add('step-active');
    } else if (stepNumber === 2) {
      stepUpload.classList.add('step-complete');
      stepParse.classList.add('step-active');
    } else if (stepNumber === 3) {
      stepUpload.classList.add('step-complete');
      stepParse.classList.add('step-complete');
      stepAi.classList.add('step-active');
    } else if (stepNumber === 4) {
      stepUpload.classList.add('step-complete');
      stepParse.classList.add('step-complete');
      stepAi.classList.add('step-complete');
    }
  }

  // -------------------------------------------------------------
  // Markdown & Result Formatting Parser
  // -------------------------------------------------------------
  function renderSummary(markdownText) {
    // Clear list
    detailedSectionsList.innerHTML = '';

    // Advanced Parser: Let's extract the Executive Summary first
    // Usually, the document summary is at the top or labeled "Overall Summary" or "Executive Summary"
    // Let's divide by lines or headings
    const sections = parseMarkdownToSections(markdownText);
    
    if (sections.length === 0) {
      execSummaryContent.innerHTML = simpleMarkdownToHtml(markdownText);
      return;
    }

    // Identify the overall summary. 
    // We assume the first section is the Executive Summary if it's named overall, executive, or if there is no other logical candidate.
    let execSection = sections.find(s => 
      s.title.toLowerCase().includes('overall') || 
      s.title.toLowerCase().includes('executive') || 
      s.title.toLowerCase().includes('global') ||
      s.title.toLowerCase().includes('document summary')
    );

    // Fallback: If no explicit executive summary is found, use the first section, or create one
    if (!execSection && sections.length > 0) {
      execSection = sections[0];
    }

    if (execSection) {
      execSummaryContent.innerHTML = simpleMarkdownToHtml(execSection.content);
    } else {
      execSummaryContent.innerHTML = "<p>No overarching executive summary was identified, but detailed analyses are available below.</p>";
    }

    // Render other sections
    sections.forEach(section => {
      // Don't duplicate the exec summary in the list if we used it above
      if (section === execSection) return;

      const card = document.createElement('div');
      card.className = 'glass-panel section-card';
      
      const titleCleaned = section.title.replace(/^[#\s*]+/, '').replace(/[#\s*]+$/, '');
      
      card.innerHTML = `
        <div class="section-card-header">
          <h4 class="section-title">${titleCleaned}</h4>
        </div>
        <div class="section-card-body markdown-body">
          ${simpleMarkdownToHtml(section.content)}
        </div>
      `;
      detailedSectionsList.appendChild(card);
    });
  }

  // Parses raw markdown into structured sections based on markdown heading blocks
  function parseMarkdownToSections(text) {
    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;
    let headerBuffer = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Detect headings (e.g. ### Section Name or **Section Name**)
      const isHeader = line.startsWith('###') || line.startsWith('##') || line.startsWith('#') || 
                       (line.startsWith('**') && line.endsWith('**') && line.length < 100);

      if (isHeader) {
        // Save previous section
        if (currentSection) {
          currentSection.content = headerBuffer.join('\n').trim();
          sections.push(currentSection);
        }

        const rawTitle = line.replace(/[*#]/g, '').trim();
        currentSection = {
          title: rawTitle,
          content: ''
        };
        headerBuffer = [];
      } else {
        if (!currentSection && line.trim() !== '') {
          // Lines before the first header belong to an implicit introduction/overall summary
          currentSection = {
            title: 'Executive Summary',
            content: ''
          };
        }
        if (currentSection) {
          headerBuffer.push(line);
        }
      }
    }

    // Save final section
    if (currentSection) {
      currentSection.content = headerBuffer.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }

  // Translates core markdown blocks to clean HTML
  function simpleMarkdownToHtml(md) {
    if (!md) return "";
    
    let html = md.trim();

    // Replace Bold tags
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Replace Italic tags
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    const lines = html.split('\n');
    const processedLines = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        if (!inList) {
          processedLines.push('<ul>');
          inList = true;
        }
        const itemText = line.replace(/^[-*•]\s+/, '');
        processedLines.push(`<li>${itemText}</li>`);
      } else {
        if (inList) {
          processedLines.push('</ul>');
          inList = false;
        }

        if (line === '') {
          // Skip empty lines
        } else {
          // Regular paragraph
          processedLines.push(`<p>${line}</p>`);
        }
      }
    }

    if (inList) {
      processedLines.push('</ul>');
    }

    return processedLines.join('\n');
  }

  // -------------------------------------------------------------
  // Clipboard Copy and Export Functionality
  // -------------------------------------------------------------
  btnCopySummary.addEventListener('click', () => {
    if (!activeSummaryMarkdown) return;
    
    navigator.clipboard.writeText(activeSummaryMarkdown).then(() => {
      const copyIcon = btnCopySummary.querySelector('.copy-icon');
      const checkIcon = btnCopySummary.querySelector('.copy-success-check');
      
      copyIcon.style.display = 'none';
      checkIcon.style.display = 'inline-block';
      
      showToast('Copied', 'Summary markdown copied to clipboard.', 'success');
      
      setTimeout(() => {
        copyIcon.style.display = 'inline-block';
        checkIcon.style.display = 'none';
      }, 2000);
    }).catch(err => {
      showToast('Failed to Copy', 'Could not access clipboard.', 'error');
    });
  });

  btnDownloadMd.addEventListener('click', () => {
    if (!activeSummaryMarkdown) return;
    
    const blob = new Blob([activeSummaryMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Create clean file name based on uploaded file
    const origName = selectedFile ? selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) : 'summary';
    link.href = url;
    link.setAttribute('download', `${origName}_summary.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Completed', 'Summary saved successfully.', 'success');
  });

  // -------------------------------------------------------------
  // Toast Alert System
  // -------------------------------------------------------------
  let toastTimeout = null;

  function showToast(title, message, type = 'error') {
    // Clear previous timeout
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toastTitle.textContent = title;
    toastMessage.textContent = message;

    // Style according to type
    if (type === 'success') {
      toastIcon.className = 'toast-icon-wrapper green-success';
      toastIcon.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
    } else {
      toastIcon.className = 'toast-icon-wrapper red-error';
      toastIcon.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      `;
    }

    toast.style.display = 'block';

    // Auto close after 6 seconds
    toastTimeout = setTimeout(() => {
      closeToast();
    }, 6000);
  }

  function closeToast() {
    toast.style.display = 'none';
  }

  btnCloseToast.addEventListener('click', closeToast);

  // Initialize
  loadApiKey();
});
