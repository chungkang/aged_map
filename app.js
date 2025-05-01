// Mapbox와 Leaflet 설정
const map = L.map('map').setView([36.5, 128], 7); // 서울 중심으로 초기 설정

// Mapbox 기본 스타일 설정
L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiY2h1bmdrYW5nIiwiYSI6ImNtYTVocWN3YzBoNXkydXNpcmI3bjc1NWYifQ.oAxBjVUo3AVCUtNJ2ewv4w', {
  attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
    'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
  maxZoom: 19,
}).addTo(map);

// GeoJSON 파일 로드 - 고령화 지수 지역
let agingLayer; // 고령화 레이어를 전역 변수로 선언

fetch('aged_administrative_region_2024.geojson')
  .then(response => response.json())
  .then(data => {
    agingLayer = L.geoJSON(data, {
      style: function(feature) {
        return getColorStyle(feature.properties.aged);
      },
      onEachFeature: onEachFeature
    }).addTo(map); // 여기 추가!
  });


// GeoJSON 파일 로드 - 병원 데이터
fetch('hospital_data_3_4.geojson')
  .then(response => response.json())
  .then(data => {
    // 클러스터 그룹 생성
    const hospitalLayer = L.markerClusterGroup();

    // 병원 위치를 지도에 표시 (클러스터링 추가)
    L.geoJSON(data, {
      pointToLayer: function(feature, latlng) {
        return L.marker(latlng);
      },
      onEachFeature: function(feature, layer) {
        // 병원 이름과 홈페이지를 표시하는 팝업
        layer.bindPopup(`<a href="${feature.properties.병원홈페이지}" target="_blank">${feature.properties.요양기관명}</a>`);
        
        // 마우스 오버 시 팝업 표시
        layer.on('mouseover', function() {
          layer.openPopup();  // 팝업을 열기
        });

        // 마우스 아웃 시 팝업을 닫지 않도록 설정
        layer.on('mouseout', function() {
          // 여기선 팝업을 닫지 않음
        });

        // 클릭 시 팝업을 열거나 닫기
        layer.on('click', function() {
          if (layer.isPopupOpen()) {
            layer.closePopup();  // 이미 열려있으면 닫기
          } else {
            layer.openPopup();  // 팝업 열기
          }
        });
      }
    }).addTo(hospitalLayer);

    // 클러스터 그룹을 지도에 추가
    hospitalLayer.addTo(map);
  });

// 고령화 지수에 따른 색상 지정
function getColorStyle(aged) {
  let color;
  if (aged >= 30) {
    color = 'red'; // 초고령 (30% 이상)
  } else if (aged >= 20) {
    color = 'orange'; // 고령 (20% 이상)
  } else if (aged >= 15) {
    color = 'yellow'; // 저고령 (15% 이상)
  } else {
    color = 'lightgreen'; // 저고령 이하
  }
  return {
    fillColor: color,
    fillOpacity: 0.5,
    weight: 2,
    color: 'black'
  };
}

// 고령화 지역에 마우스 Hover 시 팝업 표시 (autoPan 방지)
function onEachFeature(feature, layer) {
  const popupContent = ` 
    <strong>지역: ${feature.properties.SIDO_NM}</strong><br>
    고령화율: ${feature.properties.aged}%<br>
    인구수: ${feature.properties.Population}명
  `;
  const popup = L.popup({
    autoPan: false, // 팝업에 의해 지도 이동 방지
    closeButton: false,
    offset: [0, -10]
  }).setContent(popupContent);

  layer.on('mouseover', function(e) {
    popup.setLatLng(e.latlng).openOn(map);
  });

  layer.on('mouseout', function() {
    map.closePopup(popup);
  });
}


// 지도 줌 레벨에 따른 고령화 레이어 표시/숨기기
map.on('zoomend', function() {
  const zoomLevel = map.getZoom();
  
  // 줌 레벨이 15 이상이면 고령화 레이어를 제거하고, 15 미만이면 다시 추가
  if (zoomLevel >= 15) {
    if (map.hasLayer(agingLayer)) {
      map.removeLayer(agingLayer); // 고령화 레이어 제거
    }
  } else {
    if (!map.hasLayer(agingLayer)) {
      agingLayer.addTo(map); // 고령화 레이어 추가
    }
  }
});

let isochroneLayer; // isochrone 폴리곤 레이어를 전역으로 선언

map.on('click', function(e) {
  const zoomLevel = map.getZoom();

  if (zoomLevel < 15) return; // 15 미만에서는 실행하지 않음

  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  // 기존 isochrone 레이어 제거
  if (isochroneLayer && map.hasLayer(isochroneLayer)) {
    map.removeLayer(isochroneLayer);
  }

  // Mapbox Isochrone API 호출
  const profile = 'driving'; // 도보: walking, 자전거: cycling
  const minutes = 30;
  const accessToken = 'pk.eyJ1IjoiY2h1bmdrYW5nIiwiYSI6ImNtYTVocWN3YzBoNXkydXNpcmI3bjc1NWYifQ.oAxBjVUo3AVCUtNJ2ewv4w';

  const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${accessToken}`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      isochroneLayer = L.geoJSON(data, {
        style: {
          fillColor: 'blue',
          fillOpacity: 0.3,
          color: 'blue',
          weight: 2
        }
      }).addTo(map);
    })
    .catch(err => console.error('Isochrone API 에러:', err));
});
