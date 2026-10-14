# 티켓 뽑기 연출 참고 자료

2026-10-14에 아래 공개 GitHub 문서와 코드 예제를 읽고 연출을 설계했다. 현재 클라우드 환경에서 YouTube 검색 요청은 프록시의 `CONNECT 403`으로 거부되어 영상은 직접 시청하지 못했다. 아래 내용은 영상 분석 결과가 아니라 접근 가능한 문서에서 확인한 기법을 바탕으로 만든 독자적인 연출 방향이다.

| 읽은 자료 | 문서에서 확인한 내용 | 티켓 뽑기에 적용한 방향 |
| --- | --- | --- |
| [Anime.js README](https://github.com/juliangarnier/anime/blob/master/README.md) | 실제 예제에 `stagger(65, { from: 'center' })`, 회전, `inOutQuint` 감속이 포함됨 | 티켓 칸과 작은 빛을 중심부터 차례로 켜서 발권되는 느낌을 만든다. |
| [GSAP README](https://github.com/greensock/GSAP/blob/master/README.md) | 순서 제어, easing, SVG와 motion path를 이용한 애니메이션을 소개함 | 회전, 감속, 짧은 멈춤, 테마 공개, 티켓에 기록되는 순간을 구분한다. |
| [canvas-confetti README](https://github.com/catdad/canvas-confetti/blob/master/README.md) | 입자의 색, 모양, 발사 위치·각도, 속도, 중력, drift를 개별 조절하고 SVG 경로도 모양으로 쓸 수 있음 | 놀이기구별로 불씨·물방울·꽃잎·별 등 다른 입자와 움직임을 사용한다. 결과마다 같은 색종이만 떨어지는 연출을 피한다. |
| [Motion README](https://github.com/motiondivision/motion/blob/main/packages/motion/README.md) | springs, layout transitions, timelines와 브라우저 애니메이션 API를 소개함 | 결과 카드가 등장하고 티켓에 정착할 때 작은 반동을 주고, 장면 이동을 부드럽게 이어 준다. |

## 독자적인 연출 구성

1. **발권:** 빈 티켓이 나타나고 슬롯에 빛이 채워진다. 사용자가 채워야 할 목표를 먼저 보여준다.
2. **기대감:** 뽑기 화면의 원통이 빠르게 회전하다 천천히 멈춘다. 결과 이름을 먼저 크게 공개하지 않는다.
3. **테마 힌트:** 선택된 놀이기구의 색과 입자, 상징적인 움직임으로 분위기를 짧게 예고한다.
4. **공개:** 놀이기구에 맞는 장면과 이름을 보여준다. 목재 롤러코스터의 질주, 수상 놀이기구의 파도, 회전형 놀이기구의 궤도처럼 움직임 자체를 다르게 구성한다.
5. **기록:** 선택한 놀이기구가 티켓 칸에 찍히며 뽑기를 끝낸다. 미션 칸은 이후 단계로 남긴다.

이 기법들은 CSS, SVG, Canvas와 브라우저 API로 구현할 수 있어 위 라이브러리의 도입이나 영상 자산의 복제를 전제로 하지 않는다. 접근성 설정에서 동작 줄이기를 선택한 사용자는 긴 회전과 강한 입자 효과를 줄이고 결과를 확인할 수 있게 한다.

## 영상 후속 참고 링크 — 시청하지 않음

- [GreenSock Learning YouTube 채널](https://www.youtube.com/@GreenSockLearning): GSAP README가 제공하는 공식 학습 채널 링크다.
- [가챠 소환 애니메이션 검색](https://www.youtube.com/results?search_query=gacha+summon+animation): 접근 가능한 환경에서 기대감, 공개 타이밍, 카메라 움직임을 비교하기 위한 검색 링크다.
- [티켓 발권 애니메이션 검색](https://www.youtube.com/results?search_query=ticket+printing+animation): 발권과 스탬프 연출을 비교하기 위한 검색 링크다.
