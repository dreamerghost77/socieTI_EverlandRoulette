# 에버랜드 룰렛

첫 화면에서 놀이기구와 미션 중 하나를 고르면 가로 원통형 룰렛이 회전하며 항목을 고릅니다. 두 종류는 별도로 뽑을 수 있고, 결과 화면에서 다시 돌리거나 처음으로 돌아갈 수 있습니다. 결과가 나오면 축하 효과를 보여줍니다.

## 실행

빌드나 패키지 설치 없이 index.html을 브라우저에서 열면 됩니다. 로컬 서버가 필요하면 저장소 루트에서 다음 명령을 실행하세요.

```sh
python3 -m http.server 8000
```

그다음 http://localhost:8000 을 열면 됩니다.

## GitHub Pages 배포

저장소의 main 브랜치에 파일을 올린 다음 GitHub 저장소의 **Settings → Pages**에서 **Deploy from a branch**, main, /(root)를 선택하면 프로젝트 사이트로 공개할 수 있습니다. 정적 파일만 사용하므로 서버, 빌드 도구, API 키가 필요하지 않습니다.

저장소가 dreamerghost77/socieTI_EverlandRoulette라면 기본 주소는 https://dreamerghost77.github.io/socieTI_EverlandRoulette/ 형태입니다. 저장소 공개 설정과 Pages 활성화 여부에 따라 실제 접근 가능 여부가 달라집니다.
