(function () {
  "use strict";

  // ==================== Map setup ====================

  var map = L.map("map", { zoomControl: true }).setView([48.05, 7.1], 10);

  var ignPlan = L.tileLayer(
    "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile" +
      "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM" +
      "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png",
    { minZoom: 6, maxZoom: 18, attribution: "&copy; IGN - Géoplateforme" }
  ).addTo(map);

  var ignOrtho = L.tileLayer(
    "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile" +
      "&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM" +
      "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg",
    { minZoom: 6, maxZoom: 19, attribution: "&copy; IGN - Géoplateforme (photographies aériennes)" }
  );

  var osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 6,
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  });

  L.control
    .layers({ "Plan IGN": ignPlan, "Photos aériennes IGN": ignOrtho, OpenStreetMap: osm }, {}, { position: "topright" })
    .addTo(map);

  L.control.scale({ imperial: false }).addTo(map);

  var canvasRenderer = L.canvas({ padding: 0.5 });

  // ==================== Signage: colours & shapes ====================

  var COLOR_HEX = {
    red: "#c0392b",
    blue: "#2a6bb0",
    yellow: "#d1a300",
    green: "#2f8f4e",
    white: "#555555",
    black: "#222222",
    orange: "#d9731c",
    violet: "#8e44ad",
    brown: "#7b4a2f",
    gray: "#7d7d7d",
    grey: "#7d7d7d",
  };
  var COLOR_FR = {
    red: "rouge", blue: "bleu", yellow: "jaune", green: "vert", white: "blanc",
    black: "noir", orange: "orange", violet: "violet", brown: "marron", gray: "gris", grey: "gris",
  };
  var SHAPE_FR = {
    circle: "rond", triangle: "triangle", rectangle: "rectangle",
    diamond: "losange", cross: "croix", x: "croix", stripe: "barre",
  };

  function colorHex(c) {
    return COLOR_HEX[c] || "#d9731c";
  }

  function shapeSvgInner(shape, hex) {
    switch (shape) {
      case "triangle":
        return '<polygon points="8,2 14.5,13.5 1.5,13.5" fill="' + hex + '" stroke="#fff" stroke-width="1.3"/>';
      case "diamond":
        return '<polygon points="8,1 15,8 8,15 1,8" fill="' + hex + '" stroke="#fff" stroke-width="1.3"/>';
      case "rectangle":
        return '<rect x="2" y="4.5" width="12" height="7" fill="' + hex + '" stroke="#fff" stroke-width="1.3"/>';
      case "cross":
        return (
          '<rect x="6.3" y="1.5" width="3.4" height="13" fill="' + hex + '" stroke="#fff" stroke-width="1"/>' +
          '<rect x="1.5" y="6.3" width="13" height="3.4" fill="' + hex + '" stroke="#fff" stroke-width="1"/>'
        );
      case "x":
        return (
          '<line x1="2" y1="2" x2="14" y2="14" stroke="' + hex + '" stroke-width="2.6" stroke-linecap="round"/>' +
          '<line x1="14" y1="2" x2="2" y2="14" stroke="' + hex + '" stroke-width="2.6" stroke-linecap="round"/>' +
          '<line x1="2" y1="2" x2="14" y2="14" stroke="#fff" stroke-width="0.8" stroke-linecap="round"/>' +
          '<line x1="14" y1="2" x2="2" y2="14" stroke="#fff" stroke-width="0.8" stroke-linecap="round"/>'
        );
      case "stripe":
        return '<rect x="1.5" y="6" width="13" height="4" fill="' + hex + '" stroke="#fff" stroke-width="1"/>';
      case "circle":
      default:
        return '<circle cx="8" cy="8" r="6.2" fill="' + hex + '" stroke="#fff" stroke-width="1.3"/>';
    }
  }

  function svgIcon(shape, hex) {
    return '<svg width="16" height="16" viewBox="0 0 16 16">' + shapeSvgInner(shape, hex) + "</svg>";
  }

  function displayName(rel) {
    if (rel.ref) return rel.ref;
    if (rel.name) return rel.name;
    var shapeFr = SHAPE_FR[rel.shape] || rel.shape;
    var colorFr = COLOR_FR[rel.color] || rel.color;
    return shapeFr.charAt(0).toUpperCase() + shapeFr.slice(1) + " " + colorFr;
  }

  var iconCache = {};
  function iconForRel(rel) {
    var key = rel.color + "_" + rel.shape;
    if (!iconCache[key]) {
      iconCache[key] = L.divIcon({
        className: "",
        html: '<div class="blaze-badge">' + svgIcon(rel.shape, colorHex(rel.color)) + "</div>",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    }
    return iconCache[key];
  }

  // ==================== Geometry helpers ====================

  function haversine(lon1, lat1, lon2, lat2) {
    var R = 6371000;
    var toRad = function (d) { return (d * Math.PI) / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var la1 = toRad(lat1);
    var la2 = toRad(lat2);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // ==================== Binary min-heap (for A*) ====================

  function MinHeap() {
    this.a = []; // items: [priority, nodeIdx]
  }
  MinHeap.prototype.push = function (p, idx) {
    var a = this.a;
    a.push([p, idx]);
    var i = a.length - 1;
    while (i > 0) {
      var parent = (i - 1) >> 1;
      if (a[parent][0] <= a[i][0]) break;
      var t = a[parent]; a[parent] = a[i]; a[i] = t;
      i = parent;
    }
  };
  MinHeap.prototype.pop = function () {
    var a = this.a;
    var top = a[0];
    var last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      var i = 0, n = a.length;
      while (true) {
        var l = 2 * i + 1, r = 2 * i + 2, smallest = i;
        if (l < n && a[l][0] < a[smallest][0]) smallest = l;
        if (r < n && a[r][0] < a[smallest][0]) smallest = r;
        if (smallest === i) break;
        var t = a[i]; a[i] = a[smallest]; a[smallest] = t;
        i = smallest;
      }
    }
    return top;
  };
  MinHeap.prototype.isEmpty = function () {
    return this.a.length === 0;
  };

  // ==================== Network state (filled once loaded) ====================

  var NET = null; // { nodeCount, coords(Float64Array), offsets/nbr/wt/lbl(Int32Array), relations, badges }
  var networkReady = false;

  var trailLinesLayer = L.layerGroup();
  var badgeLayer = L.layerGroup();
  var BADGE_MIN_ZOOM = 13;

  var identifyMode = false;
  var highlightLayer = null;
  var currentHighlightRelIdx = null;

  // Served from the repo's raw content (not the app's own server) because the
  // file is too large for some free static-hosting build/disk limits;
  // raw.githubusercontent.com sends CORS headers and is reliable regardless
  // of where this app itself is deployed.
  var NETWORK_DATA_URL = "https://raw.githubusercontent.com/bernflor68/sentiers-club-vosgien/master/data/network.json.gz";

  loadNetwork();

  function loadNetwork() {
    fetch(NETWORK_DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        if (typeof DecompressionStream === "function") {
          return new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).json();
        }
        return r.arrayBuffer().then(function (buf) {
          throw new Error("navigateur trop ancien (DecompressionStream indisponible)");
        });
      })
      .then(function (data) {
        NET = {
          nodeCount: data.nodeCount,
          coords: Float64Array.from(data.coords),
          offsets: Int32Array.from(data.offsets),
          nbr: Int32Array.from(data.nbr),
          wt: Int32Array.from(data.wt),
          lbl: Int32Array.from(data.lbl),
          relations: data.relations,
          badges: data.badges,
        };
        NET.inMainComponent = computeMainComponent();
        drawTrailNetwork();
        networkReady = true;
        hideLoading();
      })
      .catch(function (err) {
        var p = document.getElementById("loading-progress");
        if (p) p.textContent = "Erreur de chargement du réseau (" + err.message + "). Rechargez la page.";
      });
  }

  function hideLoading() {
    var el = document.getElementById("loading-overlay");
    if (el) el.style.display = "none";
  }

  // OSM path/track data includes many short, genuinely disconnected fragments
  // (unlinked forest tracks, mapping gaps...). Routing and snapping must stick
  // to the one large connected network, or "no route found" fires whenever a
  // point snaps into a tiny island. Label components once at load time and
  // keep only the largest.
  function computeMainComponent() {
    var n = NET.nodeCount;
    var offsets = NET.offsets, nbr = NET.nbr;
    var comp = new Int32Array(n).fill(-1);
    var sizes = [];
    var stack = [];
    for (var start = 0; start < n; start++) {
      if (comp[start] !== -1) continue;
      var compId = sizes.length;
      var size = 0;
      stack.length = 0;
      stack.push(start);
      comp[start] = compId;
      while (stack.length) {
        var u = stack.pop();
        size++;
        for (var k = offsets[u]; k < offsets[u + 1]; k++) {
          var v = nbr[k];
          if (comp[v] === -1) { comp[v] = compId; stack.push(v); }
        }
      }
      sizes.push(size);
    }
    var maxId = 0;
    for (var i = 1; i < sizes.length; i++) if (sizes[i] > sizes[maxId]) maxId = i;
    var inMain = new Uint8Array(n);
    for (var j = 0; j < n; j++) inMain[j] = comp[j] === maxId ? 1 : 0;
    return inMain;
  }

  function lon(i) { return NET.coords[i * 2]; }
  function lat(i) { return NET.coords[i * 2 + 1]; }
  function latlngOf(i) { return [lat(i), lon(i)]; }

  function drawTrailNetwork() {
    var rels = NET.relations;
    for (var i = 0; i < rels.length; i++) {
      var rel = rels[i];
      var multi = rel.chains.map(function (chain) {
        var out = new Array(chain.length);
        for (var j = 0; j < chain.length; j++) out[j] = latlngOf(chain[j]);
        return out;
      });
      var isGR = !!(rel.ref && /GR/i.test(rel.ref));
      var line = L.polyline(multi, {
        renderer: canvasRenderer,
        color: colorHex(rel.color),
        weight: isGR ? 3 : 1.6,
        opacity: isGR ? 0.85 : 0.55,
      }).addTo(trailLinesLayer);
      line.bindTooltip(displayName(rel) + (rel.name && rel.ref ? " — " + rel.name : "") + " · " + rel.lengthKm + " km", {
        sticky: true,
      });
      (function (relIdx) {
        line.on("click", function (e) { onTrailClick(relIdx, e); });
      })(i);
    }
    trailLinesLayer.addTo(map);

    map.on("moveend zoomend", syncBadges);
    syncBadges();
  }

  function syncBadges() {
    badgeLayer.clearLayers();
    if (map.getZoom() < BADGE_MIN_ZOOM) return;
    var b = map.getBounds().pad(0.1);
    var badges = NET.badges;
    for (var i = 0; i < badges.length; i++) {
      var lo = badges[i][0], la = badges[i][1], relIdx = badges[i][2];
      if (la < b.getSouth() || la > b.getNorth() || lo < b.getWest() || lo > b.getEast()) continue;
      L.marker([la, lo], { icon: iconForRel(NET.relations[relIdx]), interactive: false }).addTo(badgeLayer);
    }
  }

  // ==================== Trail identification / highlight ====================

  function onTrailClick(relIdx, e) {
    if (!identifyMode) return; // not identifying: let the click bubble to the map for point-picking
    L.DomEvent.stopPropagation(e);
    if (currentHighlightRelIdx === relIdx) {
      clearHighlight();
      return;
    }
    highlightRelation(relIdx, e.latlng);
  }

  function highlightRelation(relIdx, clickLatLng) {
    var rel = NET.relations[relIdx];
    if (highlightLayer) map.removeLayer(highlightLayer);
    currentHighlightRelIdx = relIdx;

    var multi = rel.chains.map(function (chain) {
      var out = new Array(chain.length);
      for (var j = 0; j < chain.length; j++) out[j] = latlngOf(chain[j]);
      return out;
    });

    var halo = L.polyline(multi, { color: "#ff2fb0", weight: 11, opacity: 0.55, lineCap: "round", lineJoin: "round" });
    var core = L.polyline(multi, { color: colorHex(rel.color), weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" });
    highlightLayer = L.layerGroup([halo, core]).addTo(map);

    var bounds = core.getBounds();
    map.fitBounds(bounds, { padding: [40, 40] });

    var popupLatLng = clickLatLng || bounds.getCenter();
    L.popup({ closeButton: true, maxWidth: 260 })
      .setLatLng(popupLatLng)
      .setContent(
        "<strong>" + escapeHtml(displayName(rel)) + "</strong>" +
          (rel.name && rel.ref ? "<br>" + escapeHtml(rel.name) : "") +
          "<br>" + rel.lengthKm + " km"
      )
      .openOn(map);
  }

  function clearHighlight() {
    if (highlightLayer) { map.removeLayer(highlightLayer); highlightLayer = null; }
    currentHighlightRelIdx = null;
  }

  function setIdentifyMode(on) {
    identifyMode = on;
    document.getElementById("identify-toggle").classList.toggle("active", identifyMode);
    document.getElementById("map").classList.toggle("identify-cursor", identifyMode);
    if (!identifyMode) clearHighlight();
  }

  document.getElementById("identify-toggle").addEventListener("click", function () {
    if (!identifyMode) {
      pickingIndex = null;
      updatePickButtonsActive();
    }
    setIdentifyMode(!identifyMode);
  });
  badgeLayer.addTo(map);

  // ---- identify a trail by typing its name/ref (GR5, PR jaune...) ----

  function searchRelationsByName(query) {
    var q = query.trim().toLowerCase();
    var qCompact = q.replace(/\s+/g, "");
    if (!q || !NET) return [];
    var scored = [];
    for (var i = 0; i < NET.relations.length; i++) {
      var rel = NET.relations[i];
      var refCompact = (rel.ref || "").toLowerCase().replace(/\s+/g, "");
      var name = (rel.name || "").toLowerCase();
      var label = displayName(rel).toLowerCase();
      var score = -1;
      if (refCompact && refCompact === qCompact) score = 0;
      else if (refCompact && refCompact.indexOf(qCompact) === 0) score = 1;
      else if (refCompact && refCompact.indexOf(qCompact) !== -1) score = 2;
      else if (name.indexOf(q) !== -1) score = 3;
      else if (label.indexOf(q) !== -1) score = 4;
      if (score !== -1) scored.push({ idx: i, score: score, lengthKm: rel.lengthKm });
    }
    scored.sort(function (a, b) { return a.score - b.score || b.lengthKm - a.lengthKm; });
    return scored.slice(0, 20).map(function (s) { return s.idx; });
  }

  (function setupTrailSearch() {
    var input = document.getElementById("trail-search-input");
    var list = document.getElementById("trail-search-suggestions");
    var timer = null;

    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = input.value;
        if (q.trim().length < 2) { list.classList.remove("show"); return; }
        var matches = searchRelationsByName(q);
        renderMatches(matches);
      }, 150);
    });

    function renderMatches(matches) {
      list.innerHTML = "";
      if (matches.length === 0) { list.classList.remove("show"); return; }
      matches.forEach(function (relIdx) {
        var rel = NET.relations[relIdx];
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(displayName(rel)));
        var muted = document.createElement("span");
        muted.className = "muted";
        muted.textContent = " — " + rel.lengthKm + " km" + (rel.name && rel.ref ? " · " + rel.name : "");
        li.appendChild(muted);
        li.addEventListener("click", function () {
          highlightRelation(relIdx, null);
          input.value = displayName(rel);
          list.classList.remove("show");
        });
        list.appendChild(li);
      });
      list.classList.add("show");
    }
  })();

  // ==================== Fermes-auberges ====================

  var fermeIcon = L.divIcon({
    className: "",
    html: '<div class="ferme-marker">🍴</div>',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

  var fermeLayer = L.layerGroup().addTo(map);
  var FERMES = window.FERMES_AUBERGES || [];

  function fermePopupHtml(idx) {
    var f = FERMES[idx];
    var html = "<strong>" + escapeHtml(f.name) + "</strong>";
    if (f.city) html += "<br>" + escapeHtml(f.city);
    if (f.ele) html += "<br>" + f.ele + " m d'altitude";
    if (f.hours) html += "<br>" + escapeHtml(f.hours);
    if (f.phone) html += '<br><a href="tel:' + escapeHtml(f.phone.replace(/\s+/g, "")) + '">' + escapeHtml(f.phone) + "</a>";
    if (f.website) html += '<br><a href="' + escapeHtml(f.website) + '" target="_blank" rel="noopener">Site web</a>';
    html += '<br><button class="ferme-add-stage" data-idx="' + idx + '">+ Ajouter comme étape</button>';
    return html;
  }

  FERMES.forEach(function (f, idx) {
    L.marker([f.lat, f.lon], { icon: fermeIcon })
      .bindPopup(fermePopupHtml(idx))
      .addTo(fermeLayer);
  });

  // event delegation: popup content is re-created each time it opens, so bind once on the document
  document.addEventListener("click", function (e) {
    if (e.target && e.target.classList.contains("ferme-add-stage")) {
      var idx = Number(e.target.getAttribute("data-idx"));
      addFermeAsStage(idx);
    }
  });

  function addFermeAsStage(idx) {
    var f = FERMES[idx];
    addStage();
    var newIndex = points.length - 2;
    setPointAt(newIndex, f.lon, f.lat, f.name);
    map.closePopup();
  }

  function showFerme(idx) {
    var f = FERMES[idx];
    map.setView([f.lat, f.lon], 15);
    var layers = fermeLayer.getLayers();
    if (layers[idx]) layers[idx].openPopup();
  }

  (function setupFermeSelect() {
    var select = document.getElementById("ferme-select");
    FERMES.forEach(function (f, idx) {
      var opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = f.name + (f.city ? " (" + f.city + ")" : "");
      select.appendChild(opt);
    });
    select.addEventListener("change", function () {
      if (select.value === "") return;
      showFerme(Number(select.value));
    });
  })();

  // ==================== A* shortest path ====================

  function shortestPath(startIdx, endIdx) {
    var n = NET.nodeCount;
    var offsets = NET.offsets, nbr = NET.nbr, wt = NET.wt, lbl = NET.lbl;
    var dist = new Float64Array(n).fill(Infinity);
    var prevNode = new Int32Array(n).fill(-1);
    var prevLbl = new Int32Array(n).fill(-1);
    var prevW = new Float64Array(n);
    var visited = new Uint8Array(n);

    var eLon = lon(endIdx), eLat = lat(endIdx);
    function h(idx) { return haversine(lon(idx), lat(idx), eLon, eLat); }

    dist[startIdx] = 0;
    var heap = new MinHeap();
    heap.push(h(startIdx), startIdx);

    while (!heap.isEmpty()) {
      var top = heap.pop();
      var u = top[1];
      if (visited[u]) continue;
      visited[u] = 1;
      if (u === endIdx) break;
      var s = offsets[u], e = offsets[u + 1];
      for (var k = s; k < e; k++) {
        var v = nbr[k];
        if (visited[v]) continue;
        var nd = dist[u] + wt[k];
        if (nd < dist[v]) {
          dist[v] = nd;
          prevNode[v] = u;
          prevLbl[v] = lbl[k];
          prevW[v] = wt[k];
          heap.push(nd + h(v), v);
        }
      }
    }

    if (dist[endIdx] === Infinity) return null;

    var nodes = [endIdx];
    var edgeLbls = [];
    var edgeDist = [];
    var cur = endIdx;
    while (cur !== startIdx) {
      edgeLbls.push(prevLbl[cur]);
      edgeDist.push(prevW[cur]);
      cur = prevNode[cur];
      nodes.push(cur);
    }
    nodes.reverse();
    edgeLbls.reverse();
    edgeDist.reverse();

    return { totalMeters: dist[endIdx], nodes: nodes, edgeLbls: edgeLbls, edgeDist: edgeDist };
  }

  function nearestNode(qLon, qLat) {
    var n = NET.nodeCount;
    var coords = NET.coords;
    var inMain = NET.inMainComponent;
    var cosLat = Math.cos((qLat * Math.PI) / 180);
    var best = -1, bestD = Infinity;
    for (var i = 0; i < n; i++) {
      if (!inMain[i]) continue; // skip small disconnected fragments
      var dx = (coords[i * 2] - qLon) * cosLat;
      var dy = coords[i * 2 + 1] - qLat;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return { idx: best, distMeters: haversine(qLon, qLat, coords[best * 2], coords[best * 2 + 1]) };
  }

  // ==================== Point selection (start, N stages, end) ====================

  var routeLine = null;
  var points = [null, null]; // [départ, ...étapes, arrivée], each {idx, label} | null
  var markers = [null, null]; // parallel array of Leaflet markers
  var lastPath = null;
  var pickingIndex = null;

  var MARKER_COLORS = { start: "#2f6f4f", end: "#b3392c", stage: "#d9731c" };

  function colorForIndex(i) {
    if (i === 0) return MARKER_COLORS.start;
    if (i === points.length - 1) return MARKER_COLORS.end;
    return MARKER_COLORS.stage;
  }

  function labelForIndex(i) {
    if (i === 0) return "Départ";
    if (i === points.length - 1) return "Arrivée";
    return "Étape " + i;
  }

  var pickIcon = function (color) {
    return L.divIcon({
      className: "",
      html: '<div style="width:16px;height:16px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  };

  function updatePickButtonsActive() {
    var buttons = document.querySelectorAll(".waypoint-pick");
    for (var i = 0; i < buttons.length; i++) buttons[i].classList.toggle("active", pickingIndex === i);
  }

  function renderWaypoints() {
    var container = document.getElementById("waypoints-container");
    container.innerHTML = "";

    points.forEach(function (pt, i) {
      var row = document.createElement("div");
      row.className = "waypoint-row";

      var labelRow = document.createElement("div");
      labelRow.className = "waypoint-label-row";
      var dot = document.createElement("span");
      dot.className = "waypoint-dot";
      dot.style.background = colorForIndex(i);
      var labelSpan = document.createElement("span");
      labelSpan.className = "waypoint-label";
      labelSpan.textContent = labelForIndex(i);
      labelRow.appendChild(dot);
      labelRow.appendChild(labelSpan);
      if (i > 0 && i < points.length - 1) {
        var rm = document.createElement("button");
        rm.type = "button";
        rm.className = "waypoint-remove";
        rm.title = "Supprimer cette étape";
        rm.textContent = "×";
        rm.addEventListener("click", function () { removeStage(i); });
        labelRow.appendChild(rm);
      }
      row.appendChild(labelRow);

      var inputRow = document.createElement("div");
      inputRow.className = "autocomplete waypoint-input-row";
      var input = document.createElement("input");
      input.type = "text";
      input.autocomplete = "off";
      input.placeholder = "Lieu-dit, sommet, village…";
      if (pt) input.value = pt.label || formatLatLng(latlngOf(pt.idx));

      var pickBtn = document.createElement("button");
      pickBtn.type = "button";
      pickBtn.className = "waypoint-pick";
      pickBtn.title = "Choisir sur la carte";
      pickBtn.textContent = "📍";
      pickBtn.addEventListener("click", function () {
        if (identifyMode) setIdentifyMode(false);
        pickingIndex = pickingIndex === i ? null : i;
        updatePickButtonsActive();
      });

      var ul = document.createElement("ul");
      ul.className = "suggestions";

      inputRow.appendChild(input);
      inputRow.appendChild(pickBtn);
      inputRow.appendChild(ul);
      row.appendChild(inputRow);

      container.appendChild(row);

      setupAutocomplete(input, ul, i);
    });

    updatePickButtonsActive();
  }

  function addStage() {
    points.splice(points.length - 1, 0, null);
    markers.splice(markers.length - 1, 0, null);
    pickingIndex = null;
    renderWaypoints();
  }

  function removeStage(i) {
    if (markers[i]) map.removeLayer(markers[i]);
    points.splice(i, 1);
    markers.splice(i, 1);
    pickingIndex = null;
    renderWaypoints();
    maybeComputeRoute();
  }

  document.getElementById("add-stage").addEventListener("click", addStage);

  function setPointAt(i, qLon, qLat, label) {
    if (!networkReady) {
      showTransientHint("Le réseau se charge encore, veuillez patienter quelques secondes…");
      return;
    }
    var snap = nearestNode(qLon, qLat);
    var latlng = latlngOf(snap.idx);
    points[i] = { idx: snap.idx, label: label || null };

    if (markers[i]) map.removeLayer(markers[i]);
    markers[i] = L.marker(latlng, { icon: pickIcon(colorForIndex(i)) }).addTo(map).bindPopup(labelForIndex(i) + (label ? " : " + label : ""));

    var inputs = document.querySelectorAll("#waypoints-container input[type=text]");
    if (inputs[i]) inputs[i].value = label || formatLatLng(latlng);

    if (snap.distMeters > 1500) {
      showTransientHint(labelForIndex(i) + " : point d'accès le plus proche (sentier ou chemin) à " + (snap.distMeters / 1000).toFixed(1) + " km de l'endroit demandé.");
    } else {
      showTransientHint("");
    }

    pickingIndex = null;
    updatePickButtonsActive();

    maybeComputeRoute();
  }

  function maybeComputeRoute() {
    if (points.length >= 2 && points.every(function (p) { return p !== null; })) {
      computeRoute();
    }
  }

  function formatLatLng(latlng) {
    return latlng[0].toFixed(4) + ", " + latlng[1].toFixed(4);
  }

  function showTransientHint(msg) {
    document.getElementById("elev-status").textContent = msg;
  }

  map.on("click", function (e) {
    if (identifyMode) {
      clearHighlight(); // clicked away from any trail: deselect
      return;
    }
    var idx = pickingIndex;
    if (idx === null) {
      idx = points.findIndex(function (p) { return p === null; });
      if (idx === -1) idx = 0;
    }
    setPointAt(idx, e.latlng.lng, e.latlng.lat, null);
  });

  // one shared listener closes any open suggestion list on outside click
  document.addEventListener("click", function (e) {
    document.querySelectorAll(".suggestions.show").forEach(function (list) {
      if (!list.parentElement.contains(e.target)) list.classList.remove("show");
    });
  });

  document.getElementById("reset").addEventListener("click", resetRoute);

  function resetRoute() {
    points = [null, null];
    markers.forEach(function (m) { if (m) map.removeLayer(m); });
    markers = [null, null];
    lastPath = null;
    pickingIndex = null;
    if (routeLine) map.removeLayer(routeLine);
    routeLine = null;
    if (identifyMode) setIdentifyMode(false);
    else clearHighlight();
    renderWaypoints();
    document.getElementById("result").classList.add("hidden");
    document.getElementById("elev-status").textContent = "";
    document.getElementById("itinerary-breakdown").innerHTML = "";
  }

  renderWaypoints();

  // ==================== Route computation ====================

  function computeRoute() {
    var subPaths = [];
    for (var i = 0; i < points.length - 1; i++) {
      var sub = shortestPath(points[i].idx, points[i + 1].idx);
      if (!sub) { subPaths = null; break; }
      subPaths.push(sub);
    }

    document.getElementById("result").classList.remove("hidden");

    if (!subPaths) {
      document.getElementById("stat-distance").textContent = "–";
      document.getElementById("stat-time").textContent = "–";
      document.getElementById("stat-up").textContent = "–";
      document.getElementById("stat-down").textContent = "–";
      document.getElementById("elevation-profile").innerHTML = "";
      document.getElementById("itinerary-breakdown").innerHTML = "";
      showTransientHint("Aucun itinéraire trouvé entre deux de ces points (réseau non connecté à cet endroit).");
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      return;
    }

    var path = subPaths[0];
    for (var s = 1; s < subPaths.length; s++) {
      path = {
        nodes: path.nodes.concat(subPaths[s].nodes.slice(1)),
        edgeLbls: path.edgeLbls.concat(subPaths[s].edgeLbls),
        edgeDist: path.edgeDist.concat(subPaths[s].edgeDist),
        totalMeters: path.totalMeters + subPaths[s].totalMeters,
      };
    }

    lastPath = path;
    var segment = path.nodes.map(latlngOf);

    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline(segment, { color: "#b3392c", weight: 6, opacity: 0.95, lineCap: "round" }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });

    var distanceKm = path.totalMeters / 1000;
    document.getElementById("stat-distance").textContent = distanceKm.toFixed(1) + " km";
    document.getElementById("stat-time").textContent = "…";
    document.getElementById("stat-up").textContent = "…";
    document.getElementById("stat-down").textContent = "…";
    document.getElementById("elevation-profile").innerHTML = "";
    showTransientHint("Calcul du dénivelé…");

    renderItinerary(path, distanceKm);
    fetchElevationProfile(path, distanceKm);
  }

  function renderItinerary(path, distanceKm) {
    var legs = [];
    for (var i = 0; i < path.edgeLbls.length; i++) {
      var relIdx = path.edgeLbls[i];
      var d = path.edgeDist[i];
      if (legs.length > 0 && legs[legs.length - 1].relIdx === relIdx) {
        legs[legs.length - 1].meters += d;
      } else {
        legs.push({ relIdx: relIdx, meters: d });
      }
    }

    var OFFTRAIL_ICON = '<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="#8a8378" stroke-width="2.2" stroke-dasharray="2.5 2.5" stroke-linecap="round"/></svg>';

    var html = "";
    legs.forEach(function (leg) {
      if (leg.meters < 80) return; // skip tiny connector fragments
      var rel = leg.relIdx >= 0 ? NET.relations[leg.relIdx] : null;
      var badgeHtml = rel ? svgIcon(rel.shape, colorHex(rel.color)) : OFFTRAIL_ICON;
      var name = rel ? displayName(rel) : "Liaison hors sentier";
      html +=
        '<div class="leg' + (rel ? "" : " leg-offtrail") + '"><span class="leg-badge">' + badgeHtml + '</span>' +
        '<span class="leg-name">' + escapeHtml(name) + '</span>' +
        '<span class="leg-dist">' + (leg.meters / 1000).toFixed(1) + " km</span></div>";
    });
    document.getElementById("itinerary-breakdown").innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[<>&]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c];
    });
  }

  // ==================== Elevation (IGN altimetry API, throttled) ====================

  function fetchElevationProfile(path, distanceKm) {
    var nodes = path.nodes;
    var cum = new Float64Array(nodes.length);
    for (var i = 1; i < nodes.length; i++) cum[i] = cum[i - 1] + path.edgeDist[i - 1];

    var maxSamples = 40;
    var stride = Math.max(1, Math.ceil(nodes.length / maxSamples));
    var samples = [];
    for (var j = 0; j < nodes.length; j += stride) samples.push(j);
    if (samples[samples.length - 1] !== nodes.length - 1) samples.push(nodes.length - 1);

    var results = new Array(samples.length);
    var failed = false;
    var delayMs = 180;

    function fetchOne(mySlot, attempt) {
      var idx = nodes[samples[mySlot]];
      return fetch(
        "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=" + lon(idx) + "&lat=" + lat(idx) + "&resource=ign_rge_alti_wld"
      ).then(function (r) {
        if (r.status === 429 && attempt < 2) {
          return new Promise(function (resolve) { setTimeout(resolve, 500); }).then(function () {
            return fetchOne(mySlot, attempt + 1);
          });
        }
        return r.json().then(function (data) {
          var z = data.elevations && data.elevations[0] && data.elevations[0].z;
          results[mySlot] = typeof z === "number" ? z : null;
        });
      });
    }

    function step(i) {
      if (i >= samples.length) {
        renderElevation(results, samples, cum, distanceKm, failed);
        return;
      }
      fetchOne(i, 0)
        .catch(function () { failed = true; results[i] = null; })
        .then(function () { setTimeout(function () { step(i + 1); }, delayMs); });
    }
    step(0);
  }

  function renderElevation(results, samples, cum, distanceKm, failed) {
    var pts = [];
    for (var i = 0; i < samples.length; i++) {
      if (results[i] != null) pts.push({ d: cum[samples[i]] / 1000, z: results[i] });
    }

    if (pts.length < 2) {
      document.getElementById("elev-status").textContent = "Dénivelé indisponible (service d'altimétrie IGN inaccessible).";
      document.getElementById("stat-time").textContent = estimateTime(distanceKm, 0);
      document.getElementById("stat-up").textContent = "–";
      document.getElementById("stat-down").textContent = "–";
      return;
    }

    var up = 0, down = 0;
    for (var j = 1; j < pts.length; j++) {
      var diff = pts[j].z - pts[j - 1].z;
      if (diff > 3) up += diff;
      else if (diff < -3) down += -diff;
    }

    document.getElementById("stat-up").textContent = "+" + Math.round(up) + " m";
    document.getElementById("stat-down").textContent = "-" + Math.round(down) + " m";
    document.getElementById("stat-time").textContent = estimateTime(distanceKm, up);
    document.getElementById("elev-status").textContent = failed ? "Profil altimétrique partiel (certains points indisponibles)." : "";

    drawProfileSvg(pts);
  }

  function estimateTime(distanceKm, ascentM) {
    var hours = distanceKm / 4 + ascentM / 300;
    var h = Math.floor(hours);
    var m = Math.round((hours - h) * 60);
    if (m === 60) { h++; m = 0; }
    return h > 0 ? h + "h" + (m < 10 ? "0" : "") + m : m + " min";
  }

  function drawProfileSvg(pts) {
    var w = 320, h = 90, pad = 4;
    var zs = pts.map(function (p) { return p.z; });
    var minZ = Math.min.apply(null, zs);
    var maxZ = Math.max.apply(null, zs);
    var maxD = pts[pts.length - 1].d;
    if (maxZ === minZ) maxZ = minZ + 1;

    function x(d) { return pad + (d / maxD) * (w - 2 * pad); }
    function y(z) { return h - pad - ((z - minZ) / (maxZ - minZ)) * (h - 2 * pad); }

    var line = pts.map(function (p, i) { return (i === 0 ? "M" : "L") + x(p.d).toFixed(1) + "," + y(p.z).toFixed(1); }).join(" ");
    var area = line + " L" + x(maxD).toFixed(1) + "," + (h - pad) + " L" + x(0).toFixed(1) + "," + (h - pad) + " Z";

    var svg =
      '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none">' +
      '<path d="' + area + '" fill="#f3e2de" stroke="none"></path>' +
      '<path d="' + line + '" fill="none" stroke="#b3392c" stroke-width="1.5"></path>' +
      "</svg>";
    document.getElementById("elevation-profile").innerHTML = svg;
  }

  // ==================== GPX export ====================

  document.getElementById("export-gpx").addEventListener("click", function () {
    if (!routeLine) return;
    var latlngs = routeLine.getLatLngs();
    var trkpts = latlngs.map(function (ll) {
      return '<trkpt lat="' + ll.lat.toFixed(6) + '" lon="' + ll.lng.toFixed(6) + '"></trkpt>';
    }).join("\n      ");

    var names = points.map(function (pt, i) {
      return pt.label || labelForIndex(i);
    });
    var title = names.join(" → ");

    var wpts = points.map(function (pt, i) {
      var ll = latlngOf(pt.idx);
      return '  <wpt lat="' + ll[0].toFixed(6) + '" lon="' + ll[1].toFixed(6) + '"><name>' + escapeXml(names[i]) + "</name></wpt>";
    }).join("\n");

    var gpx =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<gpx version="1.1" creator="Sentiers Club Vosgien App" xmlns="http://www.topografix.com/GPX/1/1">\n' +
      "  <metadata><name>" + escapeXml(title) + "</name></metadata>\n" +
      wpts + "\n" +
      "  <trk>\n    <name>" + escapeXml(title) + "</name>\n    <trkseg>\n      " +
      trkpts +
      "\n    </trkseg>\n  </trk>\n</gpx>\n";

    var blob = new Blob([gpx], { type: "application/gpx+xml" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "itineraire-" + slugify(names[0]) + "-" + slugify(names[names.length - 1]) + ".gpx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  function escapeXml(s) {
    return String(s).replace(/[<>&'"]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c];
    });
  }

  function slugify(s) {
    return (
      String(s)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 30) || "point"
    );
  }

  // ==================== Geocoding autocomplete ====================

  function firstStr(v) {
    if (Array.isArray(v)) return v[0] || "";
    return v || "";
  }

  function setupAutocomplete(input, list, index) {
    var timer = null;
    var current = [];

    input.addEventListener("input", function () {
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 3) { list.classList.remove("show"); return; }
      timer = setTimeout(function () {
        fetch("https://data.geopf.fr/geocodage/search?q=" + encodeURIComponent(q) + "&limit=6&index=poi,address")
          .then(function (r) { return r.json(); })
          .then(function (data) { current = data.features || []; renderSuggestions(); })
          .catch(function () { list.classList.remove("show"); });
      }, 300);
    });

    function renderSuggestions() {
      list.innerHTML = "";
      if (current.length === 0) { list.classList.remove("show"); return; }
      current.forEach(function (f) {
        var li = document.createElement("li");
        var name = firstStr(f.properties.toponym) || firstStr(f.properties.name) || f.properties.label || "?";
        var city = firstStr(f.properties.city) || "";
        li.appendChild(document.createTextNode(name));
        if (city && city !== name) {
          var muted = document.createElement("span");
          muted.className = "muted";
          muted.textContent = " — " + city;
          li.appendChild(muted);
        }
        li.addEventListener("click", function () {
          var qLon = f.geometry.coordinates[0];
          var qLat = f.geometry.coordinates[1];
          var label = name + (city && city !== name ? " (" + city + ")" : "");
          setPointAt(index, qLon, qLat, label);
          map.setView([qLat, qLon], 13);
          list.classList.remove("show");
        });
        list.appendChild(li);
      });
      list.classList.add("show");
    }
  }
})();
