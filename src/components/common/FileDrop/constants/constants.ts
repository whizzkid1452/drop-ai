export const ERROR_MESSAGES = {
  FILE_TOO_LARGE: (maxSize: number) =>
    `File size is too large. Maximum ${maxSize}MB is allowed.`,
  FILE_READ_ERROR: 'Unable to read the file.',
  PROCESSING_ERROR: 'An error occurred while processing the file.',
} as const;

export const UI_MESSAGES = {
  TITLE_UPLOAD: 'Upload Audio File',
  TITLE_PROCESSING: 'Processing...',
  SUBTITLE: 'Drag and drop a file here or click to select',
  BUTTON_SELECT: 'Select File',
} as const;
