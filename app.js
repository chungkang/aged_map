// Mapbox와 Leaflet 설정
const map = L.map('map').setView([36.5, 128], 7); // 서울 중심으로 초기 설정

// Mapbox 기본 스타일 설정
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & CartoDB',
  subdomains: 'abcd',
  maxZoom: 16
}).addTo(map);

let roadLayer, boundaryLayer, hospitalLayer, isochroneLayer;

// 행정경계 데이터 로드
fetch('administrative_boundary.geojson')
  .then(response => response.json())
  .then(data => {
    boundaryLayer = L.geoJSON(data, {
      style: {
        color: '#999',
        weight: 1,
        fillOpacity: 0.1
      }
    });
    boundaryLayer.addTo(map);
  });

// 병원 데이터 로드
fetch('hospital_data.geojson')
  .then(response => response.json())
  .then(data => {
    hospitalLayer = L.layerGroup();
    const gradeColors = {
      '종합병원': 'orange',
      '상급종합': 'red'
    };

    L.geoJSON(data, {
      interactive: false,  // 클릭 이벤트 전파 가능하도록 설정
      pointToLayer: function(feature, latlng) {
        const type = feature.properties.종별코드명;
        if (type === '종합병원' || type === '상급종합') {
          return L.circleMarker(latlng, {
            radius: 6,
            color: gradeColors[type] || 'gray',
            fillOpacity: 1,
            weight: 1
          });
        } else {
          return null;
        }
      },
      onEachFeature: function(feature, layer) {
        if (!layer) return;
        const name = feature.properties.요양기관명;
        const type = feature.properties.종별코드명;
        layer.bindPopup(`<b>${name}</b><br>유형: ${type}`);
      }
    }).eachLayer(function(layer) {
      if (layer) hospitalLayer.addLayer(layer);
    });

    hospitalLayer.addTo(map);
  });

// 도로 데이터 로드
fetch('road.geojson')
  .then(response => response.json())
  .then(data => {
    roadLayer = L.geoJSON(data, {
      style: {
        color: '#555',
        weight: 2
      }
    });
    roadLayer.addTo(map);
  });

// Isochrone 그리기 함수
function drawIsochrone(lat, lng) {
  if (isochroneLayer && map.hasLayer(isochroneLayer)) {
    // 이전 이벤트 제거
    isochroneLayer.off();
    map.removeLayer(isochroneLayer);
  }

  const minutes = 60;
  const url = `https://golden-hour-map.vercel.app/api/isochrone?lat=${lat}&lng=${lng}&minutes=${minutes}&profile=driving`;

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

      map.fitBounds(isochroneLayer.getBounds());

      // 병원 필터 및 popup 업데이트
      updateIsochronePopup(data, lat, lng); // lat, lng 추가
    });
}



// 지도 클릭 시 Isochrone 계산
let clickTimeout = null;

function handleMapClick(lat, lng) {
  // 이전 Isochrone 레이어 제거 + 새로 그리기
  drawIsochrone(lat, lng);
}

map.on('click', function(e) {
  if (clickTimeout !== null) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
  }

  clickTimeout = setTimeout(() => {
    handleMapClick(e.latlng.lat, e.latlng.lng);
    clickTimeout = null;
  }, 250); // 250ms 이내에 다시 클릭되면 실행 취소 (더블클릭 방지)
});

// 모바일에서 더블탭 방지를 위해 touchstart 처리
map.on('touchstart', function(e) {
  const touch = e.originalEvent.touches ? e.originalEvent.touches[0] : e.originalEvent;
  const latlng = map.mouseEventToLatLng(touch);

  if (clickTimeout !== null) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
  }

  clickTimeout = setTimeout(() => {
    handleMapClick(latlng.lat, latlng.lng);
    clickTimeout = null;
  }, 250); // 모바일도 동일한 딜레이 처리
});

// 더블클릭 이벤트 자체는 막기
map.on('dblclick', function(e) {
  e.originalEvent.preventDefault();
  if (clickTimeout !== null) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
  }
});

// 주소 검색 핀 및 Isochrone
function searchAddress(address) {
  const query = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        const marker = L.marker([lat, lon]).addTo(map);
        map.setView([lat, lon], 12);
        drawIsochrone(lat, lon);
      } else {
        alert('주소를 찾을 수 없습니다.');
      }
    });
}

// 범례 추가
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function(map) {
  const div = L.DomUtil.create('div', 'info legend');
  div.innerHTML = `
    <strong>범례</strong><br>
    <i style="background:#555; width:14px; height:14px; display:inline-block"></i> 도로<br>
    <i style="background:#999; width:14px; height:14px; display:inline-block"></i> 행정경계<br>
    <i style="background:red; width:14px; height:14px; display:inline-block"></i> 상급종합병원<br>
    <i style="background:orange; width:14px; height:14px; display:inline-block"></i> 종합병원<br>
    <i style="background:blue; opacity:0.3; width:14px; height:14px; display:inline-block; border: 1px solid blue"></i> 1시간 이내 Isochrone
  `;
  return div;
};
legend.addTo(map);

// 병원 필터 및 popup 기능을 위한 함수
function updateIsochronePopup(isochroneGeoJSON, lat, lon) {
  const isochronePolygon = turf.polygon(isochroneGeoJSON.features[0].geometry.coordinates);

  let generalHospitals = 0;
  let topHospitals = 0;

  hospitalLayer.eachLayer(layer => {
    const latlng = layer.getLatLng();
    const point = turf.point([latlng.lng, latlng.lat]);

    if (turf.booleanPointInPolygon(point, isochronePolygon)) {
      const type = layer.feature.properties.종별코드명;
      if (type === '종합병원') generalHospitals++;
      else if (type === '상급종합') topHospitals++;
    }
  });

  const reverseGeocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;

  fetch(reverseGeocodeUrl)
    .then(response => response.json())
    .then(data => {
      const fullAddress = data.display_name || '주소를 찾을 수 없습니다.';

      const popupContent = `
        <strong>기준 위치 주소: <b>${fullAddress}</b></strong><br>
        상급종합: ${topHospitals}개<br>
        종합병원: ${generalHospitals}개
      `;

      isochroneLayer.bindPopup(popupContent);

      isochroneLayer.on('mouseover', function(e) {
        this.openPopup(e.latlng);
      });
      isochroneLayer.on('mouseout', function() {
        this.closePopup();
      });
    });
}
