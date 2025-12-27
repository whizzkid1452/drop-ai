# FileUpload 컴포넌트 구현 작업 기록

## 작업 개요

음원 파일 업로드 기능을 위한 `FileUpload` 컴포넌트를 구현했습니다. 드래그 앤 드롭과 파일 선택 다이얼로그를 지원하며, 파일 검증, 메타데이터 추출, 오디오 미리보기 기능을 포함합니다.

## 파일 구조

```markdown:records/file-upload-implementation.md
<code_block_to_apply_changes_from>
```

src/components/DropZone/components/FileUpload/
├── components/
│ ├── AudioPreview.tsx # 오디오 미리보기 컴포넌트
│ ├── DropHere.tsx # 드래그 앤 드롭 영역 컴포넌트
│ └── ErrorMessage.tsx # 에러 메시지 컴포넌트
├── hooks/
│ ├── useDragAndDrop.ts # 드래그 앤 드롭 로직 훅
│ └── useAudioFileUpload.ts # 오디오 파일 업로드 로직 훅
├── utils/
│ ├── audioMetadata.ts # 오디오 메타데이터 추출 유틸
│ └── fileValidation.ts # 파일 검증 유틸
├── constants.ts # 상수 정의
├── types.ts # 타입 정의
├── FileUpload.css.ts # 스타일 정의
└── FileUpload.tsx # 메인 컴포넌트

````

## 주요 기능

### 1. 드래그 앤 드롭 지원
- 파일을 드래그하여 드롭 영역에 놓으면 자동으로 업로드
- 드래그 중 시각적 피드백 제공 (드롭 영역 강조)
- HTML5 Drag and Drop API 사용

### 2. 파일 선택 다이얼로그
- 클릭으로 파일 선택 다이얼로그 열기
- 오디오 파일만 필터링하여 표시

### 3. 파일 검증
- 지원 형식: MP3, WAV, OGG, AAC, FLAC, WebM
- 최대 파일 크기: 100MB
- 잘못된 파일 형식이나 크기 초과 시 에러 메시지 표시

### 4. 오디오 메타데이터 추출
- 파일 재생 시간(duration) 자동 추출
- HTML5 Audio API를 사용하여 메타데이터 읽기

### 5. 오디오 미리보기
- 업로드된 파일의 HTML5 audio 플레이어 표시
- 브라우저 기본 컨트롤 제공

## 구현 세부사항

### 타입 정의 (`types.ts`)

```typescript
export interface AudioFile {
  file: File;
  name: string;
  size: number;
  type: string;
  duration?: number;
  url: string;
}

export interface FileUploadProps {
  onFileUploaded?: (file: AudioFile) => void;
}
````

### 상수 정의 (`constants.ts`)

```typescript
export const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/flac',
] as const;

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export const ERROR_MESSAGES = {
  UNSUPPORTED_FORMAT: 'Unsupported file format...',
  FILE_TOO_LARGE: (maxSize: number) => `File size is too large...`,
  FILE_READ_ERROR: 'Unable to read the file.',
  PROCESSING_ERROR: 'An error occurred while processing the file.',
} as const;
```

### 파일 검증 (`utils/fileValidation.ts`)

```typescript
export function validateFile(file: File): string | null {
  if (!ACCEPTED_AUDIO_TYPES.includes(file.type as any)) {
    return ERROR_MESSAGES.UNSUPPORTED_FORMAT;
  }

  if (file.size > MAX_FILE_SIZE) {
    return ERROR_MESSAGES.FILE_TOO_LARGE(MAX_FILE_SIZE_MB);
  }

  return null;
}
```

### 오디오 메타데이터 추출 (`utils/audioMetadata.ts`)

```typescript
export function getFileDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    audio.addEventListener('loadedmetadata', () => {
      cleanup();
      resolve(audio.duration);
    });

    audio.addEventListener('error', () => {
      cleanup();
      reject(new Error(ERROR_MESSAGES.FILE_READ_ERROR));
    });

    audio.src = url;
  });
}
```

### 드래그 앤 드롭 훅 (`hooks/useDragAndDrop.ts`)

```typescript
export function useDragAndDrop({ onDrop }: UseDragAndDropOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onDrop(files[0]);
      }
    },
    [onDrop]
  );

  return {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
```

### 오디오 파일 업로드 훅 (`hooks/useAudioFileUpload.ts`)

```typescript
export function useAudioFileUpload({
  onFileUploaded,
}: UseAudioFileUploadOptions = {}) {
  const [uploadedFile, setUploadedFile] = useState<AudioFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setIsLoading(false);
        return;
      }

      try {
        const url = URL.createObjectURL(file);
        let duration: number | undefined;

        try {
          duration = await getFileDuration(file);
        } catch (err) {
          console.warn('Unable to get file duration:', err);
        }

        const audioFile: AudioFile = {
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          duration,
          url,
        };

        setUploadedFile(audioFile);
        onFileUploaded?.(audioFile);
      } catch (err) {
        setError(ERROR_MESSAGES.PROCESSING_ERROR);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [onFileUploaded]
  );

  return {
    uploadedFile,
    error,
    isLoading,
    processFile,
    reset,
  };
}
```

## 레퍼런스 분석: Ardour의 오디오 파일 업로드 방식

### Ardour의 아키텍처

Ardour는 데스크톱 DAW 애플리케이션으로, GTK+ 기반 GUI와 C++ 백엔드를 사용합니다. 오디오 파일 임포트는 다음과 같은 구조로 이루어집니다:

#### 1. 드래그 앤 드롭 처리 흐름

**파일 경로 변환** (`utils.cc`)

```cpp
bool ARDOUR_UI_UTILS::convert_drop_to_paths(vector<string>& paths, const SelectionData& data)
{
  vector<string> uris = data.get_uris();

  // URI 리스트 파싱 (file:// 형식)
  // Nautilus 등 파일 매니저 호환성 처리
  for (vector<string>::iterator i = uris.begin(); i != uris.end(); ++i) {
    if ((*i).substr(0, 7) == "file://") {
      paths.push_back(Glib::filename_from_uri(*i));
    }
  }

  return !paths.empty();
}
```

**드롭 이벤트 핸들링** (`editor_canvas.cc`)

```cpp
void Editor::track_canvas_drag_data_received(
    const RefPtr<Gdk::DragContext>& context,
    int x, int y,
    const SelectionData& data,
    guint info, guint time)
{
  if (data.get_target() == "x-ardour/region.pbdid") {
    drop_regions(context, x, y, data, info, time);
  } else {
    drop_paths(context, x, y, data, info, time);
  }
}

void Editor::drop_paths(...)
{
  vector<string> paths;
  if (convert_drop_to_paths(paths, data)) {
    // 좌표 변환 및 스냅 처리
    timepos_t when = window_event_sample(&ev, 0, &cy);
    drop_paths_part_two(paths, when, cy, copy);
  }
}
```

#### 2. 다중 백엔드 오디오 소스 열기

**순차적 백엔드 시도** (`import.cc`)

```cpp
static std::shared_ptr<ImportableSource>
open_importable_source(const string& path, samplecnt_t samplerate, SrcQuality quality)
{
  // 1. libsndfile 시도 (WAV, AIFF 등)
  try {
    std::shared_ptr<SndFileImportableSource> source(new SndFileImportableSource(path));
    if (source->samplerate() == samplerate) {
      return source;
    }
    return std::shared_ptr<ImportableSource>(
      new ResampledImportableSource(source, samplerate, quality));
  } catch (...) { }

  // 2. CoreAudio 시도 (macOS)
  #ifdef HAVE_COREAUDIO
  try {
    CAImportableSource* src = new CAImportableSource(path);
    // ... 리샘플링 처리
  } catch (...) { }
  #endif

  // 3. MP3 디코더 시도
  try {
    std::shared_ptr<Mp3FileImportableSource> source(new Mp3FileImportableSource(path));
    // ... 리샘플링 처리
  } catch (...) { }

  // 4. FFMPEG 시도 (다양한 포맷)
  try {
    std::shared_ptr<FFMPEGFileImportableSource> source(new FFMPEGFileImportableSource(path));
    // ... 리샘플링 처리
  } catch (...) { }
}
```

#### 3. 세션 임포트 프로세스

**파일 처리 및 소스 생성** (`import.cc`)

```cpp
void Session::import_files(ImportStatus& status)
{
  for (vector<string>::const_iterator p = status.paths.begin();
       p != status.paths.end() && !status.cancel; ++p) {

    // 오디오/MIDI 파일 분류
    const DataType type = SMFSource::safe_midi_file_extension(*p)
      ? DataType::MIDI : DataType::AUDIO;

    if (type == DataType::AUDIO) {
      // ImportableSource 생성
      source = open_importable_source(*p, sample_rate(), status.quality);
      num_channels = source->channels();

      // 세션 디렉토리로 파일 복사 및 소스 생성
      vector<string> new_paths = get_paths_for_new_sources(...);
      create_mono_sources_for_writing(new_paths, ...);

      // 오디오 데이터 쓰기
      write_audio_data_to_new_files(source.get(), status, newfiles);

      // 피크 파일 생성 및 분석 큐잉
      if (Config->get_auto_analyse_audio()) {
        Analyser::queue_source_for_analysis(...);
      }
    }
  }
}
```

### Ardour 방식의 주요 특징

1. **다중 백엔드 지원**: libsndfile → CoreAudio → MP3 → FFMPEG 순으로 시도
2. **자동 리샘플링**: 세션 샘플레이트와 다를 경우 자동 변환
3. **파일 복사 옵션**: 원본 유지 또는 세션 디렉토리로 복사 선택 가능
4. **비동기 처리**: 진행 상태 표시 및 취소 지원
5. **자동 분석**: 임포트 후 오디오 분석 큐잉
6. **URI 기반 경로 처리**: `file://` URI를 로컬 경로로 변환

## 현재 프로젝트 구현 방식

### 웹 기반 접근 방식

현재 프로젝트는 브라우저 환경에서 동작하므로, Ardour와 다른 접근 방식을 사용합니다:

#### 1. 드래그 앤 드롭 처리

**HTML5 Drag and Drop API 사용**

```typescript
// hooks/useDragAndDrop.ts
export function useDragAndDrop({ onDrop }: UseDragAndDropOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      // 브라우저의 File API 직접 사용
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onDrop(files[0]);
      }
    },
    [onDrop]
  );
}
```

**차이점**:

- Ardour: GTK+의 `Gtk::SelectionData`와 URI 리스트 파싱
- 현재 프로젝트: 브라우저의 `DataTransfer.files` 직접 사용

#### 2. 오디오 파일 처리

**HTML5 Audio API 사용**

```typescript
// utils/audioMetadata.ts
export function getFileDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });

    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error(ERROR_MESSAGES.FILE_READ_ERROR));
    });

    audio.src = url;
  });
}
```

**차이점**:

- Ardour: libsndfile, CoreAudio, FFMPEG 등 네이티브 라이브러리 사용
- 현재 프로젝트: 브라우저 내장 Audio API 사용 (제한적 포맷 지원)

#### 3. 파일 검증

**클라이언트 사이드 검증**

```typescript
// utils/fileValidation.ts
export function validateFile(file: File): string | null {
  if (!ACCEPTED_AUDIO_TYPES.includes(file.type as any)) {
    return ERROR_MESSAGES.UNSUPPORTED_FORMAT;
  }

  if (file.size > MAX_FILE_SIZE) {
    return ERROR_MESSAGES.FILE_TOO_LARGE(MAX_FILE_SIZE_MB);
  }

  return null;
}
```

**차이점**:

- Ardour: 파일 헤더를 읽어 실제 포맷 검증
- 현재 프로젝트: MIME 타입 기반 검증 (브라우저 제한)

#### 4. 파일 처리 흐름

**비동기 처리 및 상태 관리**

```typescript
// hooks/useAudioFileUpload.ts
export function useAudioFileUpload({
  onFileUploaded,
}: UseAudioFileUploadOptions = {}) {
  const processFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);

      // 1. 검증
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      try {
        // 2. Object URL 생성
        const url = URL.createObjectURL(file);

        // 3. 메타데이터 추출
        let duration: number | undefined;
        try {
          duration = await getFileDuration(file);
        } catch (err) {
          console.warn('Unable to get file duration:', err);
        }

        // 4. AudioFile 객체 생성
        const audioFile: AudioFile = {
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          duration,
          url,
        };

        setUploadedFile(audioFile);
        onFileUploaded?.(audioFile);
      } catch (err) {
        setError(ERROR_MESSAGES.PROCESSING_ERROR);
      } finally {
        setIsLoading(false);
      }
    },
    [onFileUploaded]
  );
}
```

## 비교 요약

| 항목               | Ardour (레퍼런스)             | 현재 프로젝트           |
| ------------------ | ----------------------------- | ----------------------- |
| **플랫폼**         | 데스크톱 (C++/GTK+)           | 웹 (React/TypeScript)   |
| **드래그 앤 드롭** | GTK+ SelectionData, URI 파싱  | HTML5 Drag and Drop API |
| **오디오 처리**    | libsndfile, CoreAudio, FFMPEG | HTML5 Audio API         |
| **파일 검증**      | 파일 헤더 읽기                | MIME 타입 검증          |
| **리샘플링**       | 자동 리샘플링 지원            | 브라우저 의존           |
| **파일 저장**      | 세션 디렉토리로 복사          | 메모리/서버 업로드      |
| **비동기 처리**    | 진행 상태 및 취소 지원        | React 상태 관리         |
| **포맷 지원**      | 광범위 (FFMPEG 기반)          | 브라우저 제한적         |

## 향후 개선 방향

Ardour 레퍼런스를 참고하여 다음 기능들을 고려할 수 있습니다:

1. **다중 포맷 지원 강화**: Web Audio API 또는 WebAssembly 기반 디코더 사용
2. **리샘플링 지원**: 오디오 샘플레이트 변환 기능 추가
3. **파일 헤더 검증**: MIME 타입 외 실제 파일 헤더 검증
4. **진행 상태 표시**: 대용량 파일 처리 시 진행률 표시
5. **다중 파일 지원**: 여러 파일 동시 업로드 및 처리
6. **오디오 분석**: 피크 데이터, BPM 등 메타데이터 추출

```

```
