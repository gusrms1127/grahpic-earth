# 고도 자료 출처

- 배포기관: NASA Earth Observatory
- 자료 페이지: Blue Marble Next Generation Topography and Bathymetry Maps
- 페이지 주소: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/
- 직접 다운로드 주소: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/topography/gebco_08_rev_elev_5400x2700.jpg
- 원본 파일명: gebco_08_rev_elev_5400x2700.jpg
- 프로젝트 내부 파일명: data/heightmap.jpg
- 원본 크기: 5400 × 2700 픽셀, RGB JPEG
- 자료 범위: 배포 페이지 기준 육지 고도 0~6400m
- 배포 페이지 표기 출처: Jesse Allen / NASA Earth Observatory, GEBCO 자료, British Oceanographic Data Centre
- 다운로드일: 2026-11-27
- 원본 SHA256: 97828a87bcb6549a527232455e478c5f9e4556f761b37d620a46446da17593ab

## 전처리

1. 원본을 회색조로 변환합니다.
2. 경도 -180부터 179도까지 360개 표본과 위도 90부터 -90도까지 181개 표본을 추출합니다.
3. 원본 픽셀 좌표는 x = floor((경도 + 180) / 360 × 이미지 너비), y = floor((90 - 위도) / 180 × 이미지 높이)이며 경계는 이미지 안으로 제한합니다.
4. 양 극점에서는 경도에 따른 차이를 없애기 위해 해당 표본 행의 평균으로 통일합니다.
5. 밝기를 Uint8Array 형태의 JavaScript 파일에 저장합니다. 웹 페이지는 이 배열을 로드하므로 로컬 이미지의 Canvas 읽기 권한 문제와 추가 서버 설치를 피할 수 있습니다.
6. 실행 시 네 표본을 보간한 밝기값을 255로 나누고 6400을 곱해 고도를 근사 환산합니다.

## 주의할 한계

JPEG 압축과 8bit 양자화 및 단순 표본화로 오차가 있습니다. 실제 최고봉의 정확한 높이를 표시하는 자료가 아닙니다. 0~6400m라는 범위에 맞춘 시각화용 근사 환산이며 원본 수치 DEM을 복원한 것은 아닙니다. 별도의 육지 마스크가 없으므로 해수면 부근 육지가 바다 색으로 표시될 수 있습니다. NASA나 자료 제작자의 보증 또는 지지를 의미하지 않으며 출처 표기를 유지합니다.
