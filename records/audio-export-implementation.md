# 오디오 Export 기능 구현 작업 기록

## 작업 개요

여러 오디오 트랙을 하나의 WAV 파일로 믹싱하여 내보내는 기능을 구현했습니다. Ardour DAW의 export 기능을 참고하여 웹 환경에 맞게 Web Audio API를 사용하여 구현했습니다. 샘플레이트, 비트 깊이, 정규화 등 다양한 export 옵션을 지원하며, 실시간 진행 상태 표시 기능을 포함합니다.

## 파일 구조

```
src/components/Daw/
├── utils/
│   └── audioExport.ts              # 오디오 export 핵심 로직
├── components/
│   └── ExportButton/
│       ├── ExportButton.tsx        # Export 버튼 컴포넌트
│       └── ExportButton.css.ts     # Export 버튼 스타일
└── DawPage.tsx                     # Export 버튼 통합
```

## 주요 기능

### 1. 오디오 믹싱 및 Export

- 여러 트랙을 동시에 로드하여 하나의 오디오로 믹싱
- Web Audio API를 사용한 오디오 처리
- 자동 리샘플링 (다양한 샘플레이트 지원)
- 채널 자동 처리 (모노/스테레오/다채널)

### 2. Export 설정 옵션

- **샘플레이트**: 44100Hz (기본값), 48000Hz 등 설정 가능
- **비트 깊이**: 16-bit, 24-bit, 32-bit PCM, 32-bit float 지원
- **정규화**: 0dBFS로 자동 정규화 옵션
- **파일명**: 커스텀 파일명 설정

### 3. 진행 상태 표시

- 실시간 진행률 표시 (0-100%)
- 단계별 상태 표시 (loading → mixing → encoding → complete)
- 진행률 바 시각화

### 4. 에러 처리

- 파일 로드 실패 처리
- 디코딩 실패 처리
- 사용자 친화적인 에러 메시지

## 구현 세부사항

### 1. Export 유틸리티 (`src/components/Daw/utils/audioExport.ts`)

#### 상수 정의

```typescript
/** 기본 샘플레이트 (Hz) */
const DEFAULT_SAMPLE_RATE = 44100;

/** 기본 비트 깊이 */
const DEFAULT_BIT_DEPTH: 16 | 24 | 32 | 'float' = 16;

/** WAV 파일 포맷 상수 */
const WAV_CONSTANTS = {
  RIFF_HEADER_SIZE: 8,
  PCM_FMT_CHUNK_SIZE: 16,
  FLOAT_FMT_CHUNK_SIZE: 18,
  PCM_DATA_CHUNK_OFFSET: 44,
  FLOAT_DATA_CHUNK_OFFSET: 46,
  PCM_AUDIO_FORMAT: 1,
  FLOAT_AUDIO_FORMAT: 3,
  FLOAT_BITS_PER_SAMPLE: 32,
  FLOAT_BYTES_PER_SAMPLE: 4,
} as const;

/** PCM 비트 깊이별 최대값 */
const PCM_MAX_VALUES = {
  16: 32767,
  24: 8388607,
  32: 2147483647,
} as const;
```

#### 타입 정의

```typescript
/**
 * Export 설정 옵션
 * Ardour의 ExportSettings를 참고하여 웹 환경에 맞게 구현
 */
export interface ExportSettings {
  /** 샘플레이트 (Hz), 기본값: 44100 */
  sampleRate?: number;
  /** 비트 깊이 (16, 24, 32, 또는 'float'), 기본값: 16 */
  bitDepth?: 16 | 24 | 32 | 'float';
  /** 정규화 여부, 기본값: false */
  normalize?: boolean;
  /** 출력 파일명 (확장자 제외), 기본값: 'export' */
  filename?: string;
}

/**
 * Export 진행 상태 정보
 */
export interface ExportProgress {
  /** 진행률 (0-100) */
  progress: number;
  /** 현재 단계 설명 */
  stage: 'loading' | 'mixing' | 'encoding' | 'complete';
}
```

#### 오디오 파일 로드 및 디코딩

```typescript
/**
 * 오디오 파일을 ArrayBuffer로 로드하는 함수
 */
async function loadAudioFile(audioFile: AudioFile): Promise<ArrayBuffer> {
  const response = await fetch(audioFile.url);
  if (!response.ok) {
    throw new Error(`Failed to load audio file: ${audioFile.name}`);
  }
  return response.arrayBuffer();
}

/**
 * ArrayBuffer를 AudioBuffer로 디코딩하는 함수
 */
async function decodeAudioData(
  audioContext: AudioContext,
  arrayBuffer: ArrayBuffer
): Promise<AudioBuffer> {
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    throw new Error(
      `Failed to decode audio data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
```

#### 오디오 정규화

```typescript
/**
 * 오디오 버퍼를 정규화하는 함수
 * 모든 샘플의 최대값을 찾아 0dBFS로 정규화
 */
function normalizeAudioBuffer(
  audioContext: AudioContext,
  audioBuffer: AudioBuffer
): AudioBuffer {
  let maxValue = 0;

  // 모든 채널의 최대값 찾기
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      maxValue = Math.max(maxValue, Math.abs(data[i]));
    }
  }

  // 최대값이 0이거나 이미 정규화된 경우 정규화 불필요
  if (maxValue === 0 || maxValue >= 1.0) {
    return audioBuffer;
  }

  // 정규화 계수 계산 (0dBFS로 정규화)
  const normalizationFactor = 1.0 / maxValue;

  // 새로운 버퍼 생성 및 정규화 적용
  const normalizedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = normalizedBuffer.getChannelData(channel);
    for (let i = 0; i < inputData.length; i++) {
      outputData[i] = inputData[i] * normalizationFactor;
    }
  }

  return normalizedBuffer;
}
```

#### 오디오 믹싱

```typescript
/**
 * 여러 오디오 버퍼를 하나로 믹싱하는 함수
 */
async function mixAudioBuffers(
  audioContext: AudioContext,
  audioBuffers: AudioBuffer[],
  targetSampleRate: number
): Promise<AudioBuffer> {
  if (audioBuffers.length === 0) {
    throw new Error('No audio buffers to mix');
  }

  // 가장 긴 길이와 최대 채널 수 찾기
  let maxLength = 0;
  let maxChannels = 1;

  for (const buffer of audioBuffers) {
    maxLength = Math.max(maxLength, buffer.length);
    maxChannels = Math.max(maxChannels, buffer.numberOfChannels);
  }

  // 리샘플링이 필요한 경우 처리
  const resampledBuffers: AudioBuffer[] = [];
  for (const buffer of audioBuffers) {
    if (buffer.sampleRate !== targetSampleRate) {
      const resampled = resampleBuffer(audioContext, buffer, targetSampleRate);
      resampledBuffers.push(resampled);
    } else {
      resampledBuffers.push(buffer);
    }
  }

  // 믹싱된 버퍼 생성
  const mixedBuffer = audioContext.createBuffer(
    maxChannels,
    Math.ceil(maxLength),
    targetSampleRate
  );

  // 모든 버퍼를 믹싱
  for (const buffer of resampledBuffers) {
    for (let channel = 0; channel < maxChannels; channel++) {
      const mixedChannel = mixedBuffer.getChannelData(channel);
      const sourceChannel = buffer.getChannelData(
        Math.min(channel, buffer.numberOfChannels - 1)
      );

      for (let i = 0; i < sourceChannel.length; i++) {
        mixedChannel[i] += sourceChannel[i];
      }
    }
  }

  // 클리핑 방지 (오버플로우 방지)
  for (let channel = 0; channel < maxChannels; channel++) {
    const channelData = mixedBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = clampSample(channelData[i]);
    }
  }

  return mixedBuffer;
}
```

#### 리샘플링

```typescript
/**
 * 오디오 버퍼를 리샘플링하는 함수 (선형 보간)
 */
function resampleBuffer(
  audioContext: AudioContext,
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): AudioBuffer {
  const ratio = targetSampleRate / audioBuffer.sampleRate;
  const newLength = Math.ceil(audioBuffer.length * ratio);
  const newBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    newLength,
    targetSampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = newBuffer.getChannelData(channel);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i / ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
      const t = srcIndex - srcIndexFloor;

      // 선형 보간
      outputData[i] =
        inputData[srcIndexFloor] * (1 - t) + inputData[srcIndexCeil] * t;
    }
  }

  return newBuffer;
}
```

#### WAV 파일 생성

WAV 파일 생성은 여러 단계로 나뉩니다:

1. **헤더 정보 계산**

```typescript
function calculateWavHeaderInfo(
  audioBuffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 | 'float'
): WavHeaderInfo {
  const bytesPerSample = BYTES_PER_SAMPLE[bitDepth];
  const dataSize =
    audioBuffer.length * audioBuffer.numberOfChannels * bytesPerSample;
  const dataChunkOffset =
    bitDepth === 'float'
      ? WAV_CONSTANTS.FLOAT_DATA_CHUNK_OFFSET
      : WAV_CONSTANTS.PCM_DATA_CHUNK_OFFSET;
  const totalSize = dataChunkOffset + 8 + dataSize;

  return {
    dataChunkOffset,
    totalSize,
    dataSize,
    bytesPerSample,
  };
}
```

2. **RIFF 헤더 작성**

```typescript
function writeRiffHeader(view: DataView, totalSize: number): void {
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - WAV_CONSTANTS.RIFF_HEADER_SIZE, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
}
```

3. **fmt Chunk 작성 (PCM vs Float)**

**PCM 형식:**

```typescript
function writePcmFmtChunk(
  view: DataView,
  numberOfChannels: number,
  sampleRate: number,
  bytesPerSample: number,
  bitDepth: 16 | 24 | 32
): void {
  view.setUint32(16, WAV_CONSTANTS.PCM_FMT_CHUNK_SIZE, true); // 16바이트
  view.setUint16(20, WAV_CONSTANTS.PCM_AUDIO_FORMAT, true); // 1 = PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
  view.setUint16(32, numberOfChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
}
```

**Float 형식:**

```typescript
function writeFloatFmtChunk(
  view: DataView,
  numberOfChannels: number,
  sampleRate: number
): void {
  view.setUint32(16, WAV_CONSTANTS.FLOAT_FMT_CHUNK_SIZE, true); // 18바이트 (확장)
  view.setUint16(20, WAV_CONSTANTS.FLOAT_AUDIO_FORMAT, true); // 3 = IEEE float
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate * numberOfChannels * WAV_CONSTANTS.FLOAT_BYTES_PER_SAMPLE,
    true
  );
  view.setUint16(
    32,
    numberOfChannels * WAV_CONSTANTS.FLOAT_BYTES_PER_SAMPLE,
    true
  );
  view.setUint16(34, WAV_CONSTANTS.FLOAT_BITS_PER_SAMPLE, true);
  view.setUint16(36, 0, true); // extension size (확장 헤더 크기)
}
```

**Float 확장 헤더 설명:**

- Float 포맷은 확장 헤더를 사용합니다
- fmt chunk size: 18바이트 (PCM은 16바이트, 추가 2바이트는 extension size 필드)
- extension size: 0 (현재는 사용하지 않지만, 향후 확장을 위해 공간 확보)
- 이는 WAV 파일 포맷 스펙에서 float 포맷을 지원하기 위한 표준 구조입니다

4. **오디오 데이터 작성**

```typescript
function writeAudioData(
  view: DataView,
  audioBuffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 | 'float',
  startOffset: number
): void {
  let offset = startOffset;
  const { length, numberOfChannels } = audioBuffer;

  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];

      switch (bitDepth) {
        case 'float':
          offset = writeFloatSample(view, offset, sample);
          break;
        case 16:
          offset = writePcm16Sample(view, offset, sample);
          break;
        case 24:
          offset = writePcm24Sample(view, offset, sample);
          break;
        case 32:
          offset = writePcm32Sample(view, offset, sample);
          break;
      }
    }
  }
}
```

#### 메인 Export 함수

```typescript
export async function exportTracks(
  tracks: AudioFile[],
  settings: ExportSettings = {},
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  if (tracks.length === 0) {
    throw new Error('No tracks to export');
  }

  const {
    sampleRate = DEFAULT_SAMPLE_RATE,
    bitDepth = DEFAULT_BIT_DEPTH,
    normalize = false,
  } = settings;

  let audioContext: AudioContext | null = null;

  try {
    // 1. AudioContext 생성
    audioContext = new AudioContext({ sampleRate });
    updateProgress(onProgress, 0, 'loading');

    // 2. 모든 오디오 파일 로드 및 디코딩
    const audioBuffers = await loadAndDecodeTracks(
      audioContext,
      tracks,
      onProgress
    );

    updateProgress(onProgress, 50, 'mixing');

    // 3. 모든 버퍼를 하나로 믹싱
    const mixedBuffer = await mixAudioBuffers(
      audioContext,
      audioBuffers,
      sampleRate
    );

    updateProgress(onProgress, 75, 'mixing');

    // 4. 정규화 (옵션)
    let finalBuffer = mixedBuffer;
    if (normalize) {
      finalBuffer = normalizeAudioBuffer(audioContext, mixedBuffer);
    }

    updateProgress(onProgress, 90, 'encoding');

    // 5. WAV 파일로 변환
    const wavBlob = audioBufferToWav(finalBuffer, bitDepth);

    updateProgress(onProgress, 100, 'complete');

    return wavBlob;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Export failed:', error);
    throw new Error(`Export failed: ${errorMessage}`);
  } finally {
    // AudioContext 정리
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close().catch(err => {
        console.warn('Failed to close AudioContext:', err);
      });
    }
  }
}
```

### 2. Export 버튼 컴포넌트 (`src/components/Daw/components/ExportButton/ExportButton.tsx`)

```typescript
export function ExportButton({
  tracks,
  settings,
  onExportComplete,
  onExportError,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (tracks.length === 0) {
      setError('내보낼 트랙이 없습니다.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setProgress(0);

    try {
      const blob = await exportTracks(tracks, settings, (progressInfo) => {
        setProgress(progressInfo.progress);
      });

      // 파일 다운로드
      const filename = settings?.filename || 'export';
      downloadBlob(blob, `${filename}.wav`);

      setIsExporting(false);
      setProgress(0);
      onExportComplete?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Export failed');
      setError(error.message);
      setIsExporting(false);
      setProgress(0);
      onExportError?.(error);
      console.error('Export error:', error);
    }
  }, [tracks, settings, onExportComplete, onExportError]);

  const isDisabled = tracks.length === 0 || isExporting;

  return (
    <div className={styles.container}>
      <button
        className={styles.exportButton}
        onClick={handleExport}
        disabled={isDisabled}
        aria-label="오디오 내보내기"
      >
        {isExporting ? (
          <>
            <span className={styles.progressText}>
              내보내는 중... {Math.round(progress)}%
            </span>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <span className={styles.buttonText}>내보내기</span>
        )}
      </button>
      {error && (
        <div className={styles.errorMessage} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
```

### 3. DawPage 통합

```typescript
export function DawPage() {
  const { tracks, removeTrack } = useTracks();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>트랙 목록</h1>
        <div className={styles.headerRight}>
          <span className={styles.trackCount}>{tracks.length}개 트랙</span>
          <ExportButton tracks={tracks} />
        </div>
      </div>
      {/* ... 트랙 리스트 ... */}
    </div>
  );
}
```

## 레퍼런스 분석: Ardour의 Export 방식

### Ardour의 아키텍처

Ardour는 데스크톱 DAW 애플리케이션으로, C++ 기반의 export 시스템을 사용합니다. `session_utils/export.cc` 파일을 기반으로 한 명령줄 export 유틸리티를 제공하며, GUI에서도 동일한 핵심 시스템을 사용합니다.

### Export Handler 시스템 구조

Ardour의 Export 시스템은 여러 컴포넌트로 구성된 모듈화된 아키텍처를 사용합니다:

#### 1. Export Handler

Export Handler는 export 프로세스의 중앙 관리자 역할을 합니다:

```cpp
// ExportHandler는 다음 컴포넌트들을 관리합니다:
// - ExportTimespan: export할 시간 범위
// - ExportChannelConfiguration: export할 채널 구성
// - ExportFormatSpecification: export 포맷 설정
// - ExportFilename: 출력 파일명 설정
// - BroadcastInfo: BWF 메타데이터 (선택적)

ExportHandler* handler = session->get_export_handler();
```

#### 2. Export Settings 구조

```cpp
struct ExportSettings {
  ExportSettings ()
    : _samplerate (0)                    // 0이면 세션 샘플레이트 사용
    , _sample_format (ExportFormatBase::SF_16)  // 기본 16-bit
    , _normalize (false)                 // 정규화 여부
    , _bwf (false)                       // Broadcast Wave Format 여부
  {}

  int _samplerate;
  ExportFormatBase::SampleFormat _sample_format;  // SF_16, SF_24, SF_32, SF_Float
  bool _normalize;
  bool _bwf;
};
```

#### 3. Export 프로세스 단계별 설명

**단계 1: Export 컴포넌트 생성**

```cpp
static int export_session(Session *session, std::string outfile,
                          ExportSettings const& settings) {
  // 1. ExportTimespan 생성 (export할 시간 범위)
  ExportTimespanPtr tsp = session->get_export_handler()->add_timespan();

  // 2. ExportChannelConfiguration 생성 (마스터 출력 채널)
  std::shared_ptr<ExportChannelConfiguration> ccp =
    session->get_export_handler()->add_channel_config();

  // 3. ExportFilename 생성 (출력 파일명)
  std::shared_ptr<ARDOUR::ExportFilename> fnp =
    session->get_export_handler()->add_filename();

  // 4. BroadcastInfo 생성 (BWF 메타데이터, 선택적)
  std::shared_ptr<ARDOUR::BroadcastInfo> b;
}
```

**단계 2: Export 포맷 설정 (XML 기반)**

Ardour는 XML을 사용하여 export 포맷을 유연하게 설정합니다:

```cpp
XMLTree tree;
tree.read_buffer(std::string (
"<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
"<ExportFormatSpecification name=\"UTIL-WAV-EXPORT\" id=\"b1280899-0459-4aef-9dc9-7e2277fa6d24\">"
"  <Encoding id=\"F_WAV\" type=\"T_Sndfile\" extension=\"wav\" name=\"WAV\" has-sample-format=\"true\" channel-limit=\"256\"/>"
"  <SampleRate rate=\""+ settings.samplerate () +"\"/>"
"  <SRCQuality quality=\"SRC_SincBest\"/>"
"  <EncodingOptions>"
"    <Option name=\"sample-format\" value=\"" + settings.sample_format () + "\"/>"
"    <Option name=\"dithering\" value=\"D_None\"/>"
"    <Option name=\"tag-metadata\" value=\"true\"/>"
"    <Option name=\"tag-support\" value=\"false\"/>"
"    <Option name=\"broadcast-info\" value=\"" + settings.bwf () +"\"/>"
"  </EncodingOptions>"
"  <Processing>"
"    <Normalize enabled=\""+ settings.normalize () +"\" target=\"0\"/>"
"    <Silence>"
"      <Start>"
"        <Trim enabled=\"false\"/>"
"        <Add enabled=\"false\">"
"          <Duration format=\"Timecode\" hours=\"0\" minutes=\"0\" seconds=\"0\" frames=\"0\"/>"
"        </Add>"
"      </Start>"
"      <End>"
"        <Trim enabled=\"false\"/>"
"        <Add enabled=\"false\">"
"          <Duration format=\"Timecode\" hours=\"0\" minutes=\"0\" seconds=\"0\" frames=\"0\"/>"
"        </Add>"
"      </End>"
"    </Silence>"
"  </Processing>"
"</ExportFormatSpecification>"
).c_str());

std::shared_ptr<ExportFormatSpecification> fmp =
  session->get_export_handler()->add_format(*tree.root());
```

**XML 설정 요소 설명:**

- **Encoding**: 출력 포맷 정의
  - `id="F_WAV"`: WAV 포맷 식별자
  - `type="T_Sndfile"`: libsndfile 라이브러리 사용
  - `extension="wav"`: 파일 확장자
  - `channel-limit="256"`: 최대 채널 수

- **SampleRate**: 샘플레이트 설정
  - 세션 샘플레이트 또는 사용자 지정 값

- **SRCQuality**: 리샘플링 품질
  - `SRC_SincBest`: 최고 품질 (sinc 보간)
  - `SRC_SincMedium`: 중간 품질
  - `SRC_SincFastest`: 빠른 처리

- **EncodingOptions**: 인코딩 옵션
  - `sample-format`: 비트 깊이 (SF_16, SF_24, SF_32, SF_Float)
  - `dithering`: 디더링 옵션 (D_None, D_Rectangular, D_Triangular 등)
  - `tag-metadata`: 메타데이터 태그 포함 여부
  - `broadcast-info`: BWF 메타데이터 포함 여부

- **Processing**: 후처리 옵션
  - `Normalize`: 정규화 (target="0"은 0dBFS)
  - `Silence`: 시작/끝 무음 처리 (Trim/Add)

**단계 3: 시간 범위 설정**

```cpp
/* set up range */
samplepos_t start, end;
start = session->current_start_sample();  // 세션 시작 샘플
end   = session->current_end_sample();    // 세션 끝 샘플
tsp->set_range (start, end);
tsp->set_range_id ("session");
```

**단계 4: 마스터 출력 채널 연결**

```cpp
/* add master outs as default */
IO* master_out = session->master_out()->output().get();
if (!master_out) {
  PBD::warning << _("Export Util: No Master Out Ports to Connect for Audio Export") << endmsg;
  return -1;
}

// 마스터 출력의 모든 오디오 포트를 export 채널로 등록
for (uint32_t n = 0; n < master_out->n_ports().n_audio(); ++n) {
  PortExportChannel * channel = new PortExportChannel ();
  channel->add_port (master_out->audio (n));
  ExportChannelPtr chan_ptr (channel);
  ccp->register_channel (chan_ptr);
}
```

**단계 5: 출력 파일명 설정**

```cpp
/* output filename */
if (outfile.empty ()) {
  tsp->set_name ("session");  // 기본 파일명
} else {
  std::string dirname = Glib::path_get_dirname (outfile);
  std::string basename = Glib::path_get_basename (outfile);

  // .wav 확장자 제거 (자동 추가됨)
  if (basename.size() > 4 && !basename.compare (basename.size() - 4, 4, ".wav")) {
    basename = PBD::basename_nosuffix (basename);
  }

  fnp->set_folder(dirname);
  tsp->set_name (basename);
}
```

**단계 6: Broadcast Wave Format 설정 (선택적)**

```cpp
/* set broadcast info */
if (settings._bwf) {
  b.reset (new BroadcastInfo);
  b->set_from_session (*session, tsp->get_start ());
  // BWF 메타데이터에 세션 정보, 시간 코드 등 포함
}
```

**단계 7: Export 실행**

```cpp
/* output */
fnp->set_timespan(tsp);
fnp->include_label = false;

/* do audio export */
fmp->set_soundcloud_upload(false);
session->get_export_handler()->add_export_config (tsp, ccp, fmp, fnp, b);

if (0 != session->get_export_handler()->do_export()) {
  return -1;
}
```

**단계 8: 진행 상태 모니터링**

```cpp
std::shared_ptr<ARDOUR::ExportStatus> status = session->get_export_status ();

while (status->running ()) {
  double progress = 0.0;
  switch (status->active_job) {
    case ExportStatus::Normalizing:
      // 정규화 진행률
      progress = ((float) status->current_postprocessing_cycle) /
                 status->total_postprocessing_cycles;
      printf ("* Normalizing %.1f%%      \r", 100. * progress);
      break;
    case ExportStatus::Exporting:
      // Export 진행률
      progress = ((float) status->processed_samples_current_timespan) /
                 status->total_samples_current_timespan;
      printf ("* Exporting Audio %.1f%%  \r", 100. * progress);
      break;
    default:
      printf ("* Exporting...            \r");
      break;
  }
  Glib::usleep (1000000);  // 1초 대기
}
printf("\n");

status->finish (TRS_UI);
printf ("* Done.\n");
```

#### 4. 명령줄 인터페이스

Ardour의 export 유틸리티는 명령줄에서 사용할 수 있습니다:

```bash
ardour-export [OPTIONS] <session-dir> <session-name>

Options:
  -b, --bitdepth <depth>     set export-format (16, 24, 32, float)
  -B, --broadcast            include broadcast wave header
  -h, --help                 display this help and exit
  -n, --normalize            normalize signal level (to 0dBFS)
  -o, --output <file>        export output file name
  -s, --samplerate <rate>    samplerate to use
  -V, --version              print version information and exit
```

**사용 예제:**

```bash
# 기본 export (16-bit, 세션 샘플레이트)
ardour-export /path/to/session my-session

# 24-bit, 48kHz, 정규화
ardour-export -b 24 -s 48000 -n -o output.wav /path/to/session my-session

# 32-bit float, BWF 포함
ardour-export -b float -B /path/to/session my-session
```

#### 5. Export 컴포넌트 상세 설명

**ExportTimespan**

- export할 시간 범위를 정의
- 세션 전체 또는 특정 범위 지정 가능
- 여러 timespan을 동시에 export 가능

**ExportChannelConfiguration**

- export할 오디오 채널 구성
- 마스터 출력, 개별 트랙, 또는 사용자 정의 버스
- 스테레오, 모노, 다채널 지원

**ExportFormatSpecification**

- 출력 포맷의 모든 설정을 포함
- XML 기반으로 유연한 설정 관리
- 프리셋 저장/로드 가능

**ExportFilename**

- 출력 파일명 및 경로 관리
- 여러 파일로 분할 export 지원
- 타임스탬프, 레이블 등 동적 파일명 생성

**BroadcastInfo**

- Broadcast Wave Format (BWF) 메타데이터
- 시간 코드, 세션 정보, 제작자 정보 등 포함
- 방송 표준 준수

### Ardour 방식의 주요 특징

1. **마스터 버스 기반 Export**: 모든 트랙이 마스터 버스를 통해 믹싱되어 export됨
   - 마스터 버스의 모든 효과, EQ, 컴프레서 등이 적용된 최종 믹스가 export됨
   - 개별 트랙 export도 가능하지만, 기본은 마스터 출력

2. **XML 기반 포맷 설정**: 유연한 export 설정 관리
   - 복잡한 설정을 XML로 표현하여 저장/로드 가능
   - 프리셋 시스템으로 자주 사용하는 설정 재사용

3. **다양한 포맷 지원**: WAV, FLAC, MP3 등 다양한 포맷 지원
   - libsndfile을 통한 다양한 포맷 지원
   - 각 포맷별 최적화된 인코딩 옵션

4. **고품질 리샘플링**: SRC 라이브러리를 사용한 고품질 리샘플링
   - `SRC_SincBest`: 최고 품질 (sinc 보간, 느림)
   - `SRC_SincMedium`: 중간 품질 (균형)
   - `SRC_SincFastest`: 빠른 처리 (품질 약간 저하)

5. **Broadcast Wave Format 지원**: BWF 메타데이터 포함 가능
   - 방송 표준 준수
   - 시간 코드, 세션 정보 등 메타데이터 포함

6. **비동기 처리**: 백그라운드에서 export 실행
   - UI 블로킹 없이 export 가능
   - 진행 상태 실시간 모니터링

7. **에러 처리**: 각 단계에서 에러 처리
   - 파일 I/O 에러
   - 메모리 부족
   - 포맷 변환 실패 등

### 현재 프로젝트와의 비교

| 항목                      | Ardour (레퍼런스)                          | 현재 프로젝트                    |
| ------------------------- | ------------------------------------------ | -------------------------------- |
| **플랫폼**                | 데스크톱 (C++)                             | 웹 (TypeScript/Web Audio)        |
| **아키텍처**              | Export Handler 시스템 (모듈화)             | 단일 함수 기반                   |
| **믹싱 방식**             | 마스터 버스 (모든 효과 적용)               | 직접 믹싱 (트랙 단순 합산)       |
| **리샘플링**              | SRC 라이브러리 (SRC_SincBest 등 고품질)    | 선형 보간 (간단, 빠름)           |
| **포맷 지원**             | WAV, FLAC, MP3 등 다수 (libsndfile)        | WAV만 지원                       |
| **정규화**                | 0dBFS 타겟                                 | 0dBFS 타겟                       |
| **비트 깊이**             | 16, 24, 32-bit PCM, 32-bit float           | 16, 24, 32-bit PCM, 32-bit float |
| **디더링**                | 지원 (D_None, D_Rectangular, D_Triangular) | 미지원                           |
| **진행 상태**             | 콘솔 출력 (단계별)                         | UI 진행률 바 (실시간)            |
| **설정 방식**             | XML 기반 (프리셋 저장/로드 가능)           | TypeScript 인터페이스            |
| **시간 범위 선택**        | 지원 (ExportTimespan)                      | 미지원 (전체 트랙만)             |
| **채널 구성**             | 유연 (마스터/개별 트랙/버스)               | 모든 트랙 자동 믹싱              |
| **Broadcast Wave Format** | 지원 (BWF 메타데이터)                      | 미지원                           |
| **메타데이터**            | 지원 (태그, BWF)                           | 미지원                           |
| **에러 처리**             | 단계별 에러 처리                           | 단계별 에러 처리                 |
| **비동기 처리**           | 백그라운드 스레드                          | Promise 기반 비동기              |
| **명령줄 인터페이스**     | 지원 (ardour-export 유틸리티)              | 웹 UI만                          |

## 기술 스택

- **Web Audio API**: 오디오 처리 및 믹싱
- **TypeScript**: 타입 안정성
- **React**: UI 컴포넌트
- **Vanilla Extract**: CSS-in-TS 스타일링

## 주요 특징

### 1. 모듈화된 구조

- 각 기능이 독립적인 함수로 분리
- 재사용 가능한 유틸리티 함수
- 명확한 책임 분리

### 2. 타입 안정성

- TypeScript로 모든 타입 정의
- 엄격한 타입 체크
- 인터페이스 기반 설계

### 3. 에러 처리

- 모든 단계에서 에러 처리
- 사용자 친화적인 에러 메시지
- AudioContext 정리 보장

### 4. 성능 최적화

- 불필요한 배열 복사 제거
- 효율적인 메모리 사용
- 비동기 처리로 UI 블로킹 방지

### 5. 사용자 경험

- 실시간 진행률 표시
- 단계별 상태 표시
- 명확한 에러 메시지
- 직관적인 UI

## 사용 예제

### 기본 사용

```typescript
import { exportTracks, downloadBlob } from '@/components/Daw/utils/audioExport';

// 기본 설정으로 export
const blob = await exportTracks(tracks);
downloadBlob(blob, 'export.wav');
```

### 커스텀 설정

```typescript
const blob = await exportTracks(
  tracks,
  {
    sampleRate: 48000,
    bitDepth: 24,
    normalize: true,
    filename: 'my-export',
  },
  progress => {
    console.log(`진행률: ${progress.progress}%`);
    console.log(`단계: ${progress.stage}`);
  }
);

downloadBlob(blob, 'my-export.wav');
```

### React 컴포넌트에서 사용

```tsx
<ExportButton
  tracks={tracks}
  settings={{
    sampleRate: 48000,
    bitDepth: 24,
    normalize: true,
    filename: 'my-export',
  }}
  onExportComplete={() => {
    console.log('Export 완료!');
  }}
  onExportError={error => {
    console.error('Export 실패:', error);
  }}
/>
```

## 향후 개선 사항

- [ ] 고품질 리샘플링 알고리즘 구현 (SRC 라이브러리 대체)
- [ ] 추가 포맷 지원 (FLAC, MP3 등)
- [ ] Export 프리셋 저장/로드 기능
- [ ] 다중 Export (각 트랙을 개별 파일로)
- [ ] Export 범위 선택 기능 (시간 범위 지정)
- [ [ ] Fade In/Out 효과
- [ ] 볼륨 조절 옵션
- [ ] 패닝 옵션
- [ ] Broadcast Wave Format (BWF) 지원
- [ ] 메타데이터 추가 (제목, 아티스트 등)

## 참고 자료

- [Web Audio API 문서](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WAV 파일 포맷 스펙](http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html)
- [Ardour Export 소스 코드](https://github.com/Ardour/ardour/tree/master/session_utils)

# 오프셋(Offset) 계산 설명

오프셋은 파일 내에서 데이터가 시작되는 바이트 위치입니다. WAV 파일은 바이너리 형식이므로 각 섹션이 시작되는 위치를 정확히 계산해야 합니다.

## WAV 파일 구조와 오프셋

WAV 파일은 다음과 같은 구조로 되어 있습니다:

```
[0바이트부터 시작]
┌─────────────────────────────────────────┐
│ RIFF 헤더 (12 bytes)                    │
│ - 'RIFF' (0-3)                          │
│ - 파일 크기 (4-7)                       │
│ - 'WAVE' (8-11)                         │
├─────────────────────────────────────────┤
│ fmt chunk (24 or 26 bytes)             │
│ - 'fmt ' (12-15)                        │
│ - chunk size (16-19)                    │
│ - format data (20-35 or 20-37)          │
├─────────────────────────────────────────┤
│ data chunk 헤더 (8 bytes)               │
│ - 'data' (36 or 38)                     │
│ - data size (40 or 42)                  │
├─────────────────────────────────────────┤
│ 오디오 데이터 (나머지)                   │
│ - 실제 샘플 데이터 (44 or 46부터)        │
└─────────────────────────────────────────┘
```

## 오프셋 계산 과정

### 1. **PCM 형식 (16/24/32-bit)의 경우**

```18:42:src/components/Daw/utils/wavConverter.ts
export function calculateWavHeaderInfo(
  audioBuffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 | 'float'
): WavHeaderInfo {
  const bytesPerSample = BYTES_PER_SAMPLE[bitDepth];
  const dataSize = audioBuffer.length * audioBuffer.numberOfChannels * bytesPerSample;

  // fmt chunk 크기: 'fmt ' (4) + size (4) + data (16 or 18)
  const fmtChunkSize = bitDepth === 'float'
    ? 4 + 4 + WAV_CONSTANTS.FLOAT_FMT_CHUNK_SIZE
    : 4 + 4 + WAV_CONSTANTS.PCM_FMT_CHUNK_SIZE;

  // data chunk 시작 위치: RIFF 헤더 (12) + fmt chunk
  const dataChunkOffset = 12 + fmtChunkSize;

  // 전체 파일 크기: RIFF 헤더 (12) + fmt chunk + data chunk 헤더 (8) + 데이터
  const totalSize = 12 + fmtChunkSize + 8 + dataSize;

  return {
    dataChunkOffset,
    totalSize,
    dataSize,
    bytesPerSample,
  };
}
```

**계산 예시 (PCM 16-bit):**

```
RIFF 헤더: 0 ~ 11 (12 bytes)
  - 오프셋 0: 'RIFF'
  - 오프셋 4: 파일 크기
  - 오프셋 8: 'WAVE'

fmt chunk: 12 ~ 35 (24 bytes)
  - 오프셋 12: 'fmt '
  - 오프셋 16: chunk size (16)
  - 오프셋 20: audio format (1 = PCM)
  - 오프셋 22: 채널 수
  - 오프셋 24: 샘플레이트
  - 오프셋 28: byte rate
  - 오프셋 32: block align
  - 오프셋 34: bits per sample

data chunk 헤더: 36 ~ 43 (8 bytes)
  - 오프셋 36: 'data'  ← dataChunkOffset = 36
  - 오프셋 40: data size

오디오 데이터: 44부터 시작  ← dataChunkOffset + 8
```

### 2. **Float 형식의 경우**

**계산 예시 (Float 32-bit):**

```
RIFF 헤더: 0 ~ 11 (12 bytes)

fmt chunk: 12 ~ 37 (26 bytes)  ← Float는 18바이트 데이터
  - 오프셋 12: 'fmt '
  - 오프셋 16: chunk size (18)
  - 오프셋 20: audio format (3 = IEEE float)
  - ... (PCM과 동일)
  - 오프셋 36: extension size (0)

data chunk 헤더: 38 ~ 45 (8 bytes)
  - 오프셋 38: 'data'  ← dataChunkOffset = 38
  - 오프셋 42: data size

오디오 데이터: 46부터 시작  ← dataChunkOffset + 8
```

## 왜 오프셋이 중요한가?

1. 정확한 위치 지정: 각 데이터를 올바른 위치에 써야 파일이 재생됩니다.
2. 파일 크기 계산: 전체 파일 크기를 정확히 계산해야 합니다.
3. 호환성: 표준 WAV 포맷을 따라야 모든 플레이어에서 재생됩니다.

## 코드에서의 사용 예시

```56:60:src/components/Daw/utils/wavConverter.ts
function writeRiffHeader(view: DataView, totalSize: number): void {
  writeString(view, 0, 'RIFF');
  // RIFF chunk size = 전체 파일 크기 - 8 (RIFF ID 4바이트 + chunk size 4바이트)
  view.setUint32(4, totalSize - 8, true);
```

- `writeString(view, 0, 'RIFF')`: 오프셋 0부터 'RIFF' 작성
- `view.setUint32(4, ...)`: 오프셋 4부터 4바이트 크기 값 작성

```107:112:src/components/Daw/utils/wavConverter.ts
function writeDataChunkHeader(
  view: DataView,
  dataSize: number,
  dataChunkOffset: number
): void {
  // 'data' 문자열 작성 (dataChunkOffset 위치)
  writeString(view, dataChunkOffset, 'data');
```

- `dataChunkOffset`: 'data' 문자열이 시작되는 위치
- `dataChunkOffset + 4`: data size가 저장되는 위치
- `dataChunkOffset + 8`: 실제 오디오 데이터가 시작되는 위치

## 요약

- 오프셋 = 파일 시작(0바이트)부터의 바이트 위치
- WAV 파일은 각 섹션이 고정된 위치에 있어야 함
- 오프셋 계산 오류 시 파일이 재생되지 않음
- 현재 코드는 동적으로 오프셋을 계산해 PCM/Float 모두 지원

## clamp?

클램프 = 값을 지정된 범위 안으로 제한
clampSample = 오디오 샘플을 [-1, 1]로 제한
목적 = 클리핑(왜곡) 방지
사용 위치 = 믹싱 후, WAV 변환 시
