export const fileToAudioElement = (file: File): Promise<HTMLAudioElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);

    // 메타데이터(재생 시간 등)가 로드되었을 때 객체 반환
    audio.onloadedmetadata = () => {
      resolve(audio);
    };

    // 파일 읽기 실패 시
    audio.onerror = err => {
      reject(err);
    };
  });
};
