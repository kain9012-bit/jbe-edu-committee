// data/ 를 dist/data/ 로 복사한다. 화면은 이 JSON 들을 상대경로로 읽는다.
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

if (!existsSync('data')) {
  console.warn('data/ 가 없습니다. 수집기를 먼저 돌리세요.');
  process.exit(0);
}
await mkdir('dist/data', { recursive: true });
// 오디오는 저장소에 없고 화면도 쓰지 않는다.
await cp('data', 'dist/data', {
  recursive: true,
  filter: (src) => !src.includes('data/audio'),
});
console.log('data → dist/data 복사 완료');
