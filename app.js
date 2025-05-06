// Mapbox와 Leaflet 설정
const map = L.map('map').setView([36.5, 128], 7); // 서울 중심으로 초기 설정

// Mapbox 기본 스타일 설정
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & CartoDB',
  subdomains: 'abcd',
  maxZoom: 16
}).addTo(map);


// GeoJSON 파일 로드 - 고령화 지수 지역
let agingLayer;

fetch('aged_administrative_region_2024.geojson')
  .then(response => response.json())
  .then(data => {
    agingLayer = L.geoJSON(data, {
      style: function(feature) {
        return getColorStyle(feature.properties.aged);
      },
      onEachFeature: onEachFeature
    }).addTo(map);
  });

// 병원 데이터 로드 및 isochrone 연동
let isochroneLayer;

fetch('hospital_data_3_4.geojson')
  .then(response => response.json())
  .then(data => {
    const hospitalLayer = L.markerClusterGroup();

    L.geoJSON(data, {
      pointToLayer: function(feature, latlng) {
        return L.marker(latlng);
      },
      onEachFeature: function(feature, layer) {
        const hospitalName = feature.properties.요양기관명;

        layer.bindPopup(hospitalName);
      
        // 공통 처리 함수
        const handleIsochrone = () => {
          const lat = layer.getLatLng().lat;
          const lng = layer.getLatLng().lng;
          drawIsochrone(lat, lng);
        };
      
        // PC: 클릭
        layer.on('click', handleIsochrone);
      
        // 모바일: 터치
        layer.on('touchstart', handleIsochrone);
      
        // 마우스오버
        layer.on('mouseover', function() {
          layer.openPopup();
        });
      }
    }).addTo(hospitalLayer);

    hospitalLayer.addTo(map);
  });


// 고령화 색상 스타일
function getColorStyle(aged) {
  let color;
  if (aged >= 30) {
    color = 'red';
  } else if (aged >= 20) {
    color = 'orange';
  } else if (aged >= 15) {
    color = 'yellow';
  } else {
    color = 'lightgreen';
  }
  return {
    fillColor: color,
    fillOpacity: 0.5,
    weight: 2,
    color: 'black'
  };
}

// 고령화 지자체 hover 팝업
function onEachFeature(feature, layer) {
  const popupContent = ` 
    <strong>지역: ${feature.properties.SIDO_NM}</strong><br>
    고령화율: ${feature.properties.aged}%<br>
    인구수: ${feature.properties.Population}명
  `;
  const popup = L.popup({
    autoPan: false,
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

// Isochrone 그리기 함수
function drawIsochrone(lat, lng) {
  if (isochroneLayer && map.hasLayer(isochroneLayer)) {
    map.removeLayer(isochroneLayer);
  }

  const minutes = 30;

  // Vercel에 배포한 API 엔드포인트 사용 (드라이빙 프로파일 기본)
  const url = `https://aged-map.vercel.app/api/isochrone?lat=${lat}&lng=${lng}&minutes=${minutes}&profile=driving`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      isochroneLayer = L.geoJSON(data, {
        style: {
          fillColor: 'blue',
          fillOpacity: 0.2,
          color: 'blue',
          weight: 2
        }
      }).addTo(map);
    })
    .catch(err => console.error('Isochrone API 에러:', err));
}


// 고령화 수준 + Isochrone 범례 추가
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function(map) {
  const div = L.DomUtil.create('div', 'info legend');
  const grades = [15, 20, 30];
  const labels = [];

  // 고령화 단계 범례
  labels.push('<strong>고령화 단계</strong>');

  for (let i = 0; i < grades.length; i++) {
    let from = grades[i];
    let color = '';

    if (from === 15) {
      color = 'yellow';
      labels.push(
        `<i style="background:${color}; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i>저고령사회 (≥ 15%)`
      );
    } else if (from === 20) {
      color = 'orange';
      labels.push(
        `<i style="background:${color}; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i>고령사회 (≥ 20%)`
      );
    } else if (from === 30) {
      color = 'red';
      labels.push(
        `<i style="background:${color}; width: 18px; height: 18px; display: inline-block; margin-right: 8px;"></i>초고령사회 (≥ 30%)`
      );
    }
  }

  // Isochrone 범위 설명 추가
  labels.push('<br><strong>접근성 (Isochrone)</strong>');
  labels.push(
    `<i style="background:blue; width: 18px; height: 18px; display: inline-block; margin-right: 8px; opacity: 0.2; border: 1px solid blue;"></i>차로 30분 이내 이동 가능 범위`
  );

  div.innerHTML = labels.join('<br>');
  return div;
};

legend.addTo(map);
