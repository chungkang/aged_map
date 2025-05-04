// Mapbox와 Leaflet 설정
const map = L.map('map').setView([36.5, 128], 7); // 서울 중심으로 초기 설정

// Mapbox 기본 스타일 설정
L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiY2h1bmdrYW5nIiwiYSI6ImNtYTVocWN3YzBoNXkydXNpcmI3bjc1NWYifQ.oAxBjVUo3AVCUtNJ2ewv4w', {
  attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
    'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
  maxZoom: 19,
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

        // 간단한 팝업 (정보 표시용)
        layer.bindPopup(hospitalName);

        // 마커 클릭 시 isochrone 실행
        layer.on('click', function() {
          const lat = layer.getLatLng().lat;
          const lng = layer.getLatLng().lng;
          drawIsochrone(lat, lng);
        });

        layer.on('mouseover', function() {
          layer.openPopup();
        });

        layer.on('mouseout', function() {
          // 마우스아웃 시 팝업 유지
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

  const profile = 'driving';
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
}
