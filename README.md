# UFO 출현 예측 달력

`dist/index.html`을 브라우저로 열면 달력과 분석을 오프라인으로 시연할 수 있습니다. `dist` 폴더 전체(assets 포함)를 함께 보관하세요. 오늘의 날씨만 인터넷 연결이 필요합니다.

6개 지역의 2026~2030년 날짜별 장기 추정값을 표시합니다. 연도·월·날짜 선택, 연도 경계를 넘는 월 이동, 추천 날짜, 시간·모양 통계, 다크 모드를 지원합니다. 방향키로 날짜를 이동하고 Enter로 선택할 수 있습니다.

상단 제목은 프로젝트명인 'UFO 출현 예측 달력'을 사용합니다. 숫자는 실제 출현률이 아닌 목격 신고의 장기 추정 시나리오 점수입니다. 모양과 시각은 2000~2010년 같은 지역·월의 통계입니다.

Colab에서 기존 모델 결과를 새로 만든 경우 미래 시나리오 데이터도 다시 생성한 후 `node website/prepare-data.mjs`를 실행하면 화면 데이터가 갱신됩니다. 모델은 웹페이지에서 재학습하지 않습니다.
# 2026–2030 달력 업데이트

기존 M2(2000–2010 학습)를 같은 데이터로 재현하고, 미래의 관측되지 않은 최근 보고 수를 지역-월별 과거 일평균 건수로 대체한 **장기 추정 시나리오**입니다. 2013년 예측의 연도만 바꾼 데이터가 아닙니다. 미래 정확도는 검증되지 않았으며 연도 추세가 없습니다.

재현 순서: 루트에서 `python forecast_calendar.py`, `python prepare_experience_data.py`, 이 폴더에서 `node prepare-data.mjs`. 원본 CSV와 기존 `outputs`, 바탕화면 `새 폴더 (2)`의 실험 파일이 필요합니다. `outputs/natural-earth-countries.geojson`은 Natural Earth 원본 경계 파일입니다. 원래 평가 결과는 덮어쓰지 않습니다.

추가된 6개 그래프는 모델 입력 비교, 시간순 검증, 확률 진단, 월별 보고일 비율, 기록 시각별 건수, 모양 비중입니다. 각 그래프는 SVG로 저장할 수 있습니다. 지역 그래프는 달력 지역 선택과 연동되며, 성능 점수는 기존 과거 평가 결과입니다. 달력 비교에는 M4와 같은 입력을 사용하는 랜덤포레스트 후보 M5도 추가했으며, 시간순 검증 평균에서 M2가 여전히 선택되었습니다. PPT는 제작하지 않았습니다.

배포 정적 파일: `dist` 전체. 새 분석은 `experience-main.js`, `experience.css`, `assets/shape-specimens.png`에 있습니다.

자동 검수: `node verify-calendar.mjs`. 날짜 연속성, 윤일, 확률·등급, 중복, 정답 유출 여부, 그래프 통계와 구문을 검사합니다.

## 모양·지역·시간 발표용 분석

모양 5종 설명용 일러스트, 11개 후보 검증 정확도, 모양별 재현율·정밀도·F1, 미국 본토 핫스팟, 지역별 24시간 시계, 지속시간 회귀 산점도를 추가했습니다. 자료 소개 → 정리 → 모델별 제작 과정 순서로 발표 설명을 제공합니다. 기존 달력 그래프는 접을 수 있는 상세 영역에 보존합니다. 모델은 재학습하지 않았습니다.

일러스트는 imagegen 내장 생성으로 제작했습니다. 브리프: 보라·민트·노랑의 입체적인 모양 설명 그림, 3열×2행에서 빛·삼각형·원형·불덩어리·기타를 배치하고 마지막 칸은 비우며 글자는 넣지 않기. 생성 원본은 assets/shape-specimens.png이며 CSS가 다섯 칸을 각각 보여줍니다. 지도는 AI 그림이 아닌 Natural Earth의 실제 경계와 보고 격자를 사용합니다. 시계는 데이터 기반 SVG입니다.

모양: 검증 64.8%, 재사용 시험자료 63.6%, 목표 70% 미달. 자료는 목격 설명 분류용이며 물체의 미래 모양 예측이 아닙니다. 달력 M5 랜덤포레스트는 시간순 검증 평균 PR-AUC 0.1602, 2013년 시험 PR-AUC 0.1653으로 계산되었고 M2보다 안정적인 개선을 보이지 않아 최종 달력 모델로 선택하지 않았습니다. 회귀: 기존 시험자료의 실제 지속시간 24시간 이하 부분집합, 동일 모델의 조건부 평가입니다. 표본 650점만 시각화하며 점수는 16,032건 전체를 사용합니다.

날씨: Open-Meteo current.temperature_2m, current.cloud_cover, daily.sunset. 6개 도시 대표 좌표를 사용하며 이용자 위치를 요청하지 않습니다. 도시 현지 날짜·시각을 표시하고 10분간 메모리에 캐시합니다. 지역을 빠르게 바꿀 때 오래된 응답은 표시하지 않습니다. 실패 시 빈 값과 재시도 안내를 표시합니다. 날씨는 모델 입력이 아닙니다.

## 날씨 카드 그래픽 (v4)

`weather-sky.js`와 `weather-sky.css`에서 Open-Meteo의 `current.is_day`·`weather_code`·`cloud_cover`를 하늘 분위기에 연결합니다. 정보가 없으면 중립 배경과 확인 중/연결 실패 표시를 사용합니다. 현재 날씨와 달력 날짜는 독립적입니다. 작은 UFO는 선택한 달력 날짜의 상대 등급이 high/very_high일 때만 나타나며 날짜·지역·등급을 재미용 표시로 안내합니다.

구름 18~24초, 해·달 12초, UFO 7초 주기의 작은 transform 움직임을 사용하며 `prefers-reduced-motion: reduce`에서 애니메이션을 끕니다. 정적 원본 그림을 CSS로 이동시키며 데이터나 달력 확률은 바꾸지 않습니다.

새 그림: `dist/assets/weather-sprites-v4.png`. 내장 imagegen으로 생성한 투명 2×2 스프라이트입니다. 최종 프롬프트: “Use case: stylized-concept. Asset type: a SINGLE transparent 2x2 sprite atlas for a Korean weather card in a playful UFO calendar site. Square canvas, exactly four evenly-sized square cells with generous clear margins; no drawn dividers or background. Top-left cell: one fluffy volumetric white cloud with slight lavender shadow, cloud cluster only. Top-right cell: a warm glowing yellow sun orb with very subtle short rays, isolated. Bottom-left cell: a small luminous pale ivory crescent moon with lavender edge. Bottom-right cell: one small cute three-quarter-view flying saucer UFO, lavender purple smooth ceramic body, mint glass dome, warm yellow rim lights, no beam, no pilot. Cohesive premium soft 3D/clay illustration style, clean smooth silhouettes, gentle studio lighting. Each object centered strictly within its own quarter and not crossing into any adjacent cell. Objects occupy about 60% of cell area. The four assets will be CSS-cropped and animated very subtly over a weather-app sky background. NO letters, NO numbers, NO text, NO interface, NO watermarks, NO ground, NO checkerboard; genuinely transparent background with preserved alpha.”

